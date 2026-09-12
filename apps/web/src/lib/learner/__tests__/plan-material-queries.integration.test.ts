// apps/web/src/lib/learner/__tests__/plan-material-queries.integration.test.ts
//
// 회귀 고정: **자동 생성 세트가 큐레이션 단어장을 밀어내지 않는다. 발행 도서가 잘리지 않는다.**
//
// 2026-08-30 실측 — 발행 도서를 13→316권으로 늘리자 학습자 "계획에 추가할 자료" 선택기가
// 두 군데서 조용히 깨졌다. 둘 다 오류를 내지 않았다:
//   ① 도서 `.limit(300)` → 316권 중 **16권이 제목순으로 잘렸다.**
//   ② 단어장 `.limit(600)` 을 카테고리 구분 없이 걸어 두어, 챕터 세트가 1,129→10,923이 되자
//      **큐레이션 70개 중 화면에 남은 것이 1개**였다(수능·고등·중등·어원·비즈니스가 사라진 상태).
//
// 상한은 "지금은 충분한 숫자" 로 보이기 때문에 위험하다 — 카탈로그가 자라면 어느 날 넘고,
// 넘는 순간 화면은 멀쩡히 뜬다. 그래서 **개수를 DB 실측과 대조**한다.
//
// 환경변수(SERVICE_ROLE_KEY) 없으면 skip — CI 정상.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { describe, it, expect, beforeAll } from 'vitest'

import {
  AUTO_SET_CATEGORIES,
  fetchPlanBooks,
  fetchPlanCuratedSets,
  fetchPlanChapterSets,
} from '../plan-material-queries'

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const skipIfNoEnv = !SUPABASE_URL || !SERVICE_KEY

describe.skipIf(skipIfNoEnv)('계획 자료 선택기 목록이 잘리지 않는다 (실 DB)', () => {
  let db: SupabaseClient

  beforeAll(() => {
    db = createClient(SUPABASE_URL as string, SERVICE_KEY as string, {
      auth: { persistSession: false },
    })
  })

  it('발행 도서를 한 권도 빠뜨리지 않는다', async () => {
    const { count, error } = await db
      .from('library_books')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'published')
      .eq('copyright_safe_in_kr', true)
      .not('published_at', 'is', null)
    if (error) throw new Error(error.message)

    const rows = await fetchPlanBooks<{ id: string }>(db)
    expect(rows.length, '상한에 걸려 잘렸다 — 목록에 없는 책은 계획에 넣을 수 없다').toBe(count)
    expect(rows.length).toBeGreaterThan(0)
  }, 60_000)

  it('큐레이션 단어장을 하나도 빠뜨리지 않는다 (자동 생성 세트에 밀리지 않는다)', async () => {
    const { count, error } = await db
      .from('shared_word_sets')
      .select('id', { count: 'exact', head: true })
      .eq('is_published', true)
      .not('category', 'in', `("${AUTO_SET_CATEGORIES.join('","')}")`)
    if (error) throw new Error(error.message)

    const rows = await fetchPlanCuratedSets<{ id: string; category: string }>(db)
    expect(rows.length, '큐레이션 세트가 잘렸다').toBe(count)
    expect(rows.length).toBeGreaterThan(0)

    // 자동 생성 세트가 섞여 들어오면 다시 밀어내기가 시작된다.
    const leaked = rows.filter((r) => (AUTO_SET_CATEGORIES as readonly string[]).includes(r.category))
    expect(leaked.map((r) => r.id), '자동 생성 세트가 큐레이션 목록에 섞였다').toEqual([])
  }, 60_000)

  it('큐레이션 목록이 자동 생성 세트 규모에 좌우되지 않는다', async () => {
    // 두 모집단의 크기 차이가 이 결함의 원인이었다 — 숫자를 남겨 다음 사람이 맥락을 잃지 않게 한다.
    const { count: auto } = await db
      .from('shared_word_sets')
      .select('id', { count: 'exact', head: true })
      .eq('is_published', true)
      .eq('category', 'library_book')
    const curated = await fetchPlanCuratedSets<{ id: string }>(db)
    expect(
      curated.length,
      `자동 생성 ${auto}개 · 큐레이션 ${curated.length}개 — 큐레이션이 한 자릿수로 떨어지면 밀려난 것이다`,
    ).toBeGreaterThan(10)
  }, 60_000)

  it('등록 도서가 없으면 챕터 단어장을 조회하지 않는다', async () => {
    const rows = await fetchPlanChapterSets<{ id: string }>(db, [])
    expect(rows).toEqual([])
  })

  it('등록 도서의 챕터 단어장만 돌려준다', async () => {
    const { data: book } = await db
      .from('library_books')
      .select('id')
      .eq('status', 'published')
      .limit(1)
      .maybeSingle()
    if (!book) return
    const bookId = (book as { id: string }).id

    const { count } = await db
      .from('shared_word_sets')
      .select('id', { count: 'exact', head: true })
      .eq('is_published', true)
      .eq('category', 'library_book')
      .eq('curation_query->>book_id', bookId)

    const rows = await fetchPlanChapterSets<{ id: string; curation_query: { book_id?: string } }>(
      db,
      [bookId],
    )
    expect(rows.length).toBe(count)
    const foreign = rows.filter((r) => r.curation_query?.book_id !== bookId)
    expect(foreign.map((r) => r.id), '등록하지 않은 책의 세트가 섞였다').toEqual([])
  }, 60_000)
})
