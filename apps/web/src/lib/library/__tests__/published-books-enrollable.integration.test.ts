// apps/web/src/lib/library/__tests__/published-books-enrollable.integration.test.ts
//
// 회귀 고정: **카탈로그에 뜨는 도서는 학습을 시작할 수 있어야 한다.**
//
// 2026-08-30 실측 — 발행 316권 중 **282권이 등록 불가**였다.
//   `enroll_library_book` 은 첫머리에서 이렇게 막는다:
//     IF v_book.cefr_level IS NULL OR v_book.cefr_level NOT IN ('A1'…'C2')
//       THEN RAISE EXCEPTION 'Book has invalid cefr_level: %'
//   그런데 발행 게이트(`content_gate_publishable`)는 `cefr_level` 을 보지 않는다.
//   **발행을 허가하는 조건과 학습을 시작하는 조건이 서로 다른 컬럼을 보고 있었다.**
//
// 왜 아무도 못 봤나: 화면의 레벨 배지는 `cefr_band ?? cefr_level` 을 읽는데
//   `cefr_band` 는 316/316 채워져 있었다. 그래서 목록·상세 어디에도 이상이 없어 보였고,
//   학습자가 "학습 시작" 을 누르는 순간에만 예외가 났다. 발행 13권 시절에는 12권이
//   `cefr_level` 을 갖고 있어 드러나지 않았다 — **재고를 24배로 늘리자 비로소 보였다.**
//
// 이 테스트는 등록 RPC 의 전제조건을 **데이터로** 확인한다(실제 enroll 을 부르지 않는다 —
//   부르면 검증 계정에 텍스트 행이 쌓이고, 여러 세션이 공유하는 DB 라 부작용이 남는다).
//   조건이 바뀌면 여기도 같은 커밋에서 고칠 것. 출처는 `enroll_library_book` 본문이다.
//
// 환경변수(SERVICE_ROLE_KEY) 없으면 skip — CI 정상.

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { describe, it, expect, beforeAll } from 'vitest'

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const skipIfNoEnv = !SUPABASE_URL || !SERVICE_KEY

const VALID_CEFR = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const PAGE = 1000

interface BookRow {
  id: string
  title: string
  cefr_level: string | null
  copyright_safe_in_kr: boolean | null
}

describe.skipIf(skipIfNoEnv)('발행 도서는 모두 학습을 시작할 수 있다 (실 DB)', () => {
  let db: SupabaseClient
  let books: BookRow[]

  beforeAll(async () => {
    db = createClient(SUPABASE_URL as string, SERVICE_KEY as string, {
      auth: { persistSession: false },
    })
    // ⚠️ PostgREST 는 한 응답에 1,000행까지만 준다 — 316권이 1,000을 넘기는 날
    //    페이지네이션이 없으면 이 테스트가 조용히 일부만 검사하게 된다.
    books = []
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from('library_books')
        .select('id, title, cefr_level, copyright_safe_in_kr')
        .eq('status', 'published')
        .range(from, from + PAGE - 1)
      if (error) throw new Error(`도서 조회 실패: ${error.message}`)
      books.push(...(data as BookRow[]))
      if (data.length < PAGE) break
    }
  }, 60_000)

  it('발행 도서가 한 권 이상 있다 — 0권이면 아래 검사가 공허하게 통과한다', () => {
    expect(books.length).toBeGreaterThan(0)
  })

  it('모든 발행 도서의 cefr_level 이 유효하다 (enroll_library_book 1차 가드)', () => {
    const bad = books.filter((b) => !b.cefr_level || !VALID_CEFR.includes(b.cefr_level))
    expect(
      bad.map((b) => `${b.title}(${b.cefr_level ?? 'NULL'})`),
      `등록 시 'Book has invalid cefr_level' 로 실패한다: ${bad.length}권`,
    ).toEqual([])
  })

  it('모든 발행 도서가 copyright_safe_in_kr 이다 (enroll_library_book 조회 조건)', () => {
    const bad = books.filter((b) => b.copyright_safe_in_kr !== true)
    expect(bad.map((b) => b.title), `등록 시 'Book not available' 로 실패한다`).toEqual([])
  })

  it('모든 발행 도서가 챕터를 갖는다 (enroll_library_book 3차 가드)', async () => {
    const ids = new Set(books.map((b) => b.id))
    const withChapters = new Set<string>()
    const list = [...ids]
    for (let i = 0; i < list.length; i += 50) {
      const chunk = list.slice(i, i + 50)
      for (let from = 0; ; from += PAGE) {
        const { data, error } = await db
          .from('library_chapters_master')
          .select('library_book_id')
          .in('library_book_id', chunk)
          .range(from, from + PAGE - 1)
        if (error) throw new Error(`챕터 조회 실패: ${error.message}`)
        for (const r of data as { library_book_id: string }[]) withChapters.add(r.library_book_id)
        if (data.length < PAGE) break
      }
    }
    const bad = books.filter((b) => !withChapters.has(b.id))
    expect(bad.map((b) => b.title), `등록 시 'Book has no chapters in master' 로 실패한다`).toEqual([])
  }, 120_000)
})
