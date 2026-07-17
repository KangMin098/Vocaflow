// apps/web/src/lib/library/__tests__/extraction-rpc.integration.test.ts
// 통합 스냅샷 — 실제 Supabase 추출 RPC baseline 고정 (2026-07-04 P0 실측).
// 환경변수 없으면 skip (CI 에서는 skip 이 정상 — 순수 함수 스냅샷만 CI 게이트).
// 주의: compute_book_coverage 는 RETURNS void 의 쓰기형 — 여기서는 호출하지 않고
//       library_books.lexical_coverage 저장값을 스냅샷으로 고정한다.

import { describe, it, expect, beforeAll } from 'vitest'
import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env['NEXT_PUBLIC_SUPABASE_URL']
const SERVICE_KEY = process.env['SUPABASE_SERVICE_ROLE_KEY']
const skipIfNoEnv = !SUPABASE_URL || !SERVICE_KEY

/** 골든 도서 — Pride and Prejudice (published · 61챕터) */
const GOLDEN_BOOK_ID = 'ac506006-6147-4d23-8dba-72698eb7e9ae'
/** 골든 글 — VOA "Common Adverbs in Conversation" (published · PD-Government) */
const GOLDEN_ARTICLE_ID = '8c04120b-a414-4dde-8ca1-31d5ed552f0c'

type Row = Record<string, unknown>
/** 생성 타입(types/database.ts)에 추출 RPC 미포함 — 테스트 한정 최소 시그니처 */
interface MinimalDb {
  rpc(
    fn: string,
    args?: Record<string, unknown>,
  ): PromiseLike<{ data: Row[] | null; error: { message: string } | null }>
  from(table: string): {
    select(cols: string): {
      eq(
        col: string,
        v: string,
      ): {
        single(): PromiseLike<{ data: Row | null; error: { message: string } | null }>
      }
    }
  }
}

describe.skipIf(skipIfNoEnv)('extraction RPC (integration · 골든셋 스냅샷)', () => {
  let client: MinimalDb
  beforeAll(() => {
    client = createClient(SUPABASE_URL!, SERVICE_KEY!, {
      auth: { persistSession: false, autoRefreshToken: false },
    }) as unknown as MinimalDb
  })

  it('select_book_chapter_vocab — P&P ch.1 상위 20', async () => {
    const { data, error } = await client.rpc('select_book_chapter_vocab', {
      p_book_id: GOLDEN_BOOK_ID,
    })
    expect(error).toBeNull()
    const top20 = (data ?? [])
      .filter((r) => r['chapter_idx'] === 1)
      .sort((a, b) => (a['sort_order'] as number) - (b['sort_order'] as number))
      .slice(0, 20)
      .map((r) => ({
        sort_order: r['sort_order'],
        word: r['word'],
        v_level: r['v_level'],
        word_register: r['word_register'],
        composite_score: r['composite_score'],
      }))
    expect(top20).toHaveLength(20)
    expect(top20).toMatchSnapshot()
  })

  it('select_article_vocab — VOA 글 상위 20 (전량 10행)', async () => {
    const { data, error } = await client.rpc('select_article_vocab', {
      p_article_id: GOLDEN_ARTICLE_ID,
    })
    expect(error).toBeNull()
    const top = (data ?? [])
      .sort((a, b) => (a['sort_order'] as number) - (b['sort_order'] as number))
      .slice(0, 20)
      .map((r) => ({
        sort_order: r['sort_order'],
        word: r['word'],
        v_level: r['v_level'],
        composite_score: r['composite_score'],
      }))
    expect(top).toMatchSnapshot()
  })

  it('lexical_coverage 저장값 — P&P (compute_book_coverage 산출물)', async () => {
    const { data, error } = await client
      .from('library_books')
      .select('lexical_coverage')
      .eq('id', GOLDEN_BOOK_ID)
      .single()
    expect(error).toBeNull()
    expect(data?.['lexical_coverage']).toMatchSnapshot()
  })
})
