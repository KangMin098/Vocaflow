// apps/web/src/lib/library/__tests__/unpublished-book-sets.integration.test.ts
//
// 회귀 고정: **도서를 내리면 그 도서의 단어장도 함께 내려가야 한다.**
//
// 2026-08-30 실측 — 발행 게이트는 저작권과 어휘 난이도만 본다. 미성년자 적합성은 아무도
//   보지 않았고, 그래서 성인 소재 도서 4권이 진입밴드(V≤7)에 발행돼 있었다. 가장 날카로운
//   사례는 Hemingway `Short Fiction`(V7·B1) — 문장이 쉬워 **오히려 B1 로 분류됐다.**
//
// 그 4권을 내리려다 발견한 것이 이 결함이다. 발행 트리거는 한쪽으로만 돈다:
//     trg_lb_publish_word_sets: IF NEW.status='published' AND OLD.status<>'published'
//                                 THEN publish_book_word_sets(NEW.id)
//   **내리는 경로가 없다.** 그래서 `status='archived'` 로 바꾸면 도서는 카탈로그에서
//   사라지지만 그 도서의 `shared_word_sets` 는 `is_published=true` 로 남아, 단어장
//   카탈로그를 통해 여전히 학습자에게 닿는다. 실제로 158개가 그렇게 남을 뻔했다.
//
// 즉 **보이게 하는 조건과 감추는 조건이 서로 다른 테이블을 본다** — 이 저장소가 반복해서
//   만나 온 게이트 불일치와 같은 형태다. 화면에는 오류가 나지 않으므로 눈으로는 못 찾는다.
//
// 지금은 내리는 쪽을 손으로 맞춘다(도서 UPDATE 와 단어장 UPDATE 를 같은 문장에서).
//   트리거를 양방향으로 만드는 편이 낫지만 마이그레이션이 필요하므로 사용자 승인이 있어야
//   한다. 그때까지 이 테스트가 파수꾼이다.
//
// 환경변수(SERVICE_ROLE_KEY) 없으면 skip — CI 정상.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { describe, it, expect, beforeAll } from 'vitest'

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const skipIfNoEnv = !SUPABASE_URL || !SERVICE_KEY

const PAGE = 1000

interface SetRow {
  id: string
  slug: string | null
  curation_query: { book_id?: string } | null
}

interface BookRow {
  id: string
  status: string | null
}

/** 1,000행 상한 — 발행 단어장은 11,000행대다. 반드시 페이지네이션한다. */
async function fetchAll<T>(
  run: (from: number, to: number) => PromiseLike<{ data: unknown; error: { message: string } | null }>,
  label: string,
): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await run(from, from + PAGE - 1)
    if (error) throw new Error(`${label}: ${error.message}`)
    const rows = (data ?? []) as T[]
    out.push(...rows)
    if (rows.length < PAGE) break
  }
  return out
}

describe.skipIf(skipIfNoEnv)('내린 도서의 단어장은 남지 않는다 (실 DB)', () => {
  let db: SupabaseClient

  beforeAll(() => {
    db = createClient(SUPABASE_URL!, SERVICE_KEY!, { auth: { persistSession: false } })
  })

  it('발행 단어장이 가리키는 도서는 모두 published 다', async () => {
    const sets = await fetchAll<SetRow>(
      (from, to) =>
        db
          .from('shared_word_sets')
          .select('id, slug, curation_query')
          .eq('is_published', true)
          .not('curation_query->book_id', 'is', null)
          .range(from, to),
      '발행 단어장',
    )

    const bookIds = [...new Set(sets.map((s) => s.curation_query?.book_id).filter(Boolean))] as string[]
    expect(bookIds.length).toBeGreaterThan(0) // 0 행이면 조회가 깨진 것 — 통과로 세지 않는다

    const books: BookRow[] = []
    for (let i = 0; i < bookIds.length; i += 50) {
      const { data, error } = await db
        .from('library_books')
        .select('id, status')
        .in('id', bookIds.slice(i, i + 50))
      if (error) throw new Error(`도서 상태 조회 실패: ${error.message}`)
      books.push(...((data ?? []) as BookRow[]))
    }

    const statusById = new Map(books.map((b) => [b.id, b.status]))
    const orphans = sets.filter((s) => {
      const bookId = s.curation_query?.book_id
      if (!bookId) return false
      const status = statusById.get(bookId)
      return status !== undefined && status !== 'published'
    })

    expect(
      orphans,
      `내린 도서의 단어장이 아직 발행 상태다 (${orphans.length}개): ` +
        orphans
          .slice(0, 8)
          .map((s) => `${s.slug ?? s.id}→${statusById.get(s.curation_query!.book_id!)}`)
          .join(', '),
    ).toHaveLength(0)
  }, 60_000)
})
