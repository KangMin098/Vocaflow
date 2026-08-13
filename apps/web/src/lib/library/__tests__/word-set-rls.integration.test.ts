// apps/web/src/lib/library/__tests__/word-set-rls.integration.test.ts
//
// 발행 세트 노출 경계 — RLS 가 원본(도서/글) 발행 상태를 함께 보는가. 실 DB 통합.
// 환경변수(ANON + SERVICE_ROLE) 없으면 skip.
//
// 왜 이 테스트가 있나 (2026-08-13):
//   `shared_word_sets` 의 SELECT 정책이 `is_published` 하나였을 때, UI 3경로
//   (`/library/vocab` 카테고리 제외 · `/library/books` 카탈로그 게이트 ·
//   `recommend_word_sets_for_user`)는 전부 막고 있었는데 **공개 anon 키로는 읽혔다**.
//   미발행 도서 27권의 세트 587개(20,907단어)가 그 상태였다.
//   화면 게이트는 노출 경계의 증거가 아니다 — 경계는 API 로 확인해야 한다.
//
// 무엇을 고정하나:
//   ① 미발행 원본의 세트/단어는 anon 에게 안 보인다
//   ② 발행 원본의 세트/단어는 계속 보인다 (게이트가 과잉 차단하지 않는다)
//   ③ 소스 비종속 카테고리(csat·themed·…)는 종전대로 is_published 만 본다
//   ④ service_role(관리 경로)은 전부 본다
//   ⑤ 세트 정책과 단어 정책이 같은 답을 낸다 — 한쪽만 고쳐 어긋나는 것을 막는다
//
// 마이그레이션: 20260813110729_word_set_rls_inherit_source_gate

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { beforeAll, describe, expect, it } from 'vitest'

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const ANON_KEY =
  process.env['NEXT_PUBLIC_SUPABASE_ANON_KEY'] ?? process.env['NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY']
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const skipIfNoEnv = !SUPABASE_URL || !ANON_KEY || !SERVICE_KEY

interface SetRow {
  id: string
  curation_query: { book_id?: string } | null
}

describe.skipIf(skipIfNoEnv)('발행 세트 RLS (integration · 노출 경계)', () => {
  let anon: SupabaseClient
  let svc: SupabaseClient
  /** 발행 도서에 속한 발행 세트 */
  let visibleSet: SetRow | null = null
  /** 미발행 도서에 속한 발행 세트 — 있으면 가려져야 한다 */
  let hiddenSet: SetRow | null = null

  beforeAll(async () => {
    anon = createClient(SUPABASE_URL!, ANON_KEY!, { auth: { persistSession: false } })
    svc = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } })

    const { data: sets } = await svc
      .from('shared_word_sets')
      .select('id, curation_query')
      .eq('category', 'library_book')
      .eq('is_published', true)
      .limit(2000)

    const { data: books } = await svc
      .from('library_books')
      .select('id, status, copyright_safe_in_kr')
      .limit(2000)

    const openBooks = new Set(
      (books ?? [])
        .filter((b) => (b as { status: string }).status === 'published')
        .filter((b) => (b as { copyright_safe_in_kr: boolean }).copyright_safe_in_kr)
        .map((b) => (b as { id: string }).id),
    )
    const knownBooks = new Set((books ?? []).map((b) => (b as { id: string }).id))

    for (const raw of (sets ?? []) as SetRow[]) {
      const bookId = raw.curation_query?.book_id
      if (!bookId || !knownBooks.has(bookId)) continue
      if (openBooks.has(bookId)) visibleSet ??= raw
      else hiddenSet ??= raw
      if (visibleSet && hiddenSet) break
    }
  }, 60_000)

  it('발행 도서의 세트와 단어는 anon 에게 보인다 (과잉 차단 아님)', async () => {
    expect(visibleSet, '발행 도서에 속한 발행 세트가 하나도 없다 — 픽스처 전제 붕괴').not.toBeNull()

    const { count: setCount } = await anon
      .from('shared_word_sets')
      .select('*', { count: 'exact', head: true })
      .eq('id', visibleSet!.id)
    expect(setCount).toBe(1)

    const { count: wordCount } = await anon
      .from('shared_words')
      .select('*', { count: 'exact', head: true })
      .eq('set_id', visibleSet!.id)
    expect(wordCount ?? 0).toBeGreaterThan(0)
  })

  it('미발행 도서의 세트와 단어는 anon 에게 안 보인다', async () => {
    if (!hiddenSet) {
      // 모든 도서가 발행되면 이 케이스는 사라진다 — 그때는 통과가 아니라 "확인 불가" 다.
      console.warn('[word-set-rls] 미발행 도서에 속한 발행 세트가 없어 ① 케이스 미검증')
      return
    }

    const { count: setCount } = await anon
      .from('shared_word_sets')
      .select('*', { count: 'exact', head: true })
      .eq('id', hiddenSet.id)
    expect(setCount ?? 0).toBe(0)

    // ⑤ 세트가 가려지면 단어도 가려져야 한다 — 두 정책이 어긋나면 여기서 잡힌다.
    const { count: wordCount } = await anon
      .from('shared_words')
      .select('*', { count: 'exact', head: true })
      .eq('set_id', hiddenSet.id)
    expect(wordCount ?? 0).toBe(0)

    // service_role 로는 그 세트에 단어가 실제로 존재해야 한다 — 위 0 이 "원래 빈 세트"가 아님을 증명.
    const { count: realCount } = await svc
      .from('shared_words')
      .select('*', { count: 'exact', head: true })
      .eq('set_id', hiddenSet.id)
    expect(realCount ?? 0).toBeGreaterThan(0)
  })

  it('소스 비종속 카테고리는 종전대로 보인다', async () => {
    const { count: anonCount } = await anon
      .from('shared_word_sets')
      .select('*', { count: 'exact', head: true })
      .eq('is_published', true)
      .not('category', 'in', '("library_book","library_article")')

    const { count: svcCount } = await svc
      .from('shared_word_sets')
      .select('*', { count: 'exact', head: true })
      .eq('is_published', true)
      .not('category', 'in', '("library_book","library_article")')

    expect(anonCount).toBe(svcCount)
  })

  it('anon 에게 보이는 library_book 세트는 전부 발행 도서 소속', async () => {
    const { data: anonSets } = await anon
      .from('shared_word_sets')
      .select('id, curation_query')
      .eq('category', 'library_book')
      .eq('is_published', true)
      .limit(2000)

    const bookIds = [
      ...new Set(
        ((anonSets ?? []) as SetRow[]).map((s) => s.curation_query?.book_id).filter(Boolean),
      ),
    ] as string[]
    expect(bookIds.length).toBeGreaterThan(0)

    const { data: books } = await svc
      .from('library_books')
      .select('id, status')
      .in('id', bookIds)

    const notPublished = (books ?? [])
      .filter((b) => (b as { status: string }).status !== 'published')
      .map((b) => (b as { id: string }).id)

    expect(notPublished, `미발행 도서 세트가 anon 에게 노출: ${notPublished.join(', ')}`).toEqual([])
  })

  it('service_role 은 전부 본다 (관리 경로 무손상)', async () => {
    const { count } = await svc
      .from('shared_word_sets')
      .select('*', { count: 'exact', head: true })
      .eq('is_published', true)
    expect(count ?? 0).toBeGreaterThan(1000)
  })
})
