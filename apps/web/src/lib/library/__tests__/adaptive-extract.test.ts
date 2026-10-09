// apps/web/src/lib/library/__tests__/adaptive-extract.test.ts
// UG-0001 — adaptive-extract 계약 회귀: CEFR 6단계 · 완료 상태 보호 · 상태 갱신 실패 보존
import { afterEach, describe, expect, it, vi } from 'vitest'
import type { SupabaseClient } from '@supabase/supabase-js'
import {
  adaptiveExtractWords,
  getTargetCefr,
  type AdaptiveExtractContext,
} from '../adaptive-extract'
import type { UserCefr } from '../personalize'

type Call = { method: string; args: unknown[] }
type Result = { data?: unknown; error: { message: string } | null; count?: number | null }
type Builder = { table: string; calls: Call[] }

/** 테이블·첫 동작(select/update/upsert)별로 결과를 돌려주는 fluent-chain mock. 외부 호출 없음. */
function makeClient(resolve: (b: Builder) => Result) {
  const builders: Builder[] = []
  const client = {
    from(table: string) {
      const b: Builder = { table, calls: [] }
      builders.push(b)
      const chain: Record<string, unknown> = {}
      for (const m of ['select', 'update', 'upsert', 'eq', 'not', 'in', 'order', 'limit']) {
        chain[m] = (...args: unknown[]) => {
          b.calls.push({ method: m, args })
          return chain
        }
      }
      chain.then = (ok: (r: Result) => unknown, fail?: (e: unknown) => unknown) =>
        Promise.resolve(resolve(b)).then(ok, fail)
      return chain
    },
  }
  return { client: client as unknown as SupabaseClient, builders }
}

const first = (b: Builder) => b.calls[0]?.method

function happyResolver(updateError: { message: string } | null) {
  return (b: Builder): Result => {
    if (b.table === 'vocabularies' && first(b) === 'select') {
      const head = (b.calls[0].args[1] as { head?: boolean } | undefined)?.head
      return head ? { count: 10, error: null } : { data: [], error: null }
    }
    if (b.table === 'library_book_vocabularies') {
      return {
        data: [
          { word: 'harbor', first_sentence: 'The harbor was calm.', frequency_in_chapter: 3, base_learning_value: 0.9 },
          { word: 'vessel', first_sentence: null, frequency_in_chapter: 2, base_learning_value: 0.8 },
        ],
        error: null,
      }
    }
    if (b.table === 'shared_dictionary') {
      return {
        data: [
          { word: 'harbor', meaning_ko: '항구', example_en: null, pos: 'noun', cefr_level: 'B1', v_level: 4 },
          { word: 'vessel', meaning_ko: '선박', example_en: 'A vessel sailed.', pos: 'noun', cefr_level: 'B2', v_level: 5 },
        ],
        error: null,
      }
    }
    if (b.table === 'vocabularies' && first(b) === 'upsert') return { count: 2, error: null }
    if (b.table === 'texts' && first(b) === 'update') return { error: updateError }
    throw new Error(`unexpected query: ${b.table}.${first(b)}`)
  }
}

const TEXT_ID = 'text-uuid-1'
const ctx: AdaptiveExtractContext = {
  userId: 'user-uuid-1',
  userMastery: 'hot',
  userCefr: 'B1',
  libraryBookId: 'book-uuid-1',
  chapterIdx: 0,
  chapterWordCount: 2000,
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('getTargetCefr — [0] CEFR 6단계 매핑', () => {
  it.each<[UserCefr, UserCefr]>([
    ['A1', 'A2'],
    ['A2', 'B1'],
    ['B1', 'B2'],
    ['B2', 'C1'],
    ['C1', 'C2'],
    ['C2', 'C2'],
  ])('%s → %s', (input, expected) => {
    expect(getTargetCefr(input)).toBe(expected)
  })
})

describe('adaptiveExtractWords — texts.status 갱신 계약', () => {
  it('[1][2] 추출 성공 시 texts 를 extracted 로 갱신하되 eq(id) 와 완료 상태 보호를 건다', async () => {
    const { client, builders } = makeClient(happyResolver(null))

    const result = await adaptiveExtractWords(client, TEXT_ID, ctx)

    expect(result).toEqual({ decidedCount: 10, attemptedCount: 2, insertedCount: 2 })
    const textUpdates = builders.filter((b) => b.table === 'texts')
    expect(textUpdates).toHaveLength(1)
    expect(textUpdates[0].calls).toEqual([
      { method: 'update', args: [{ status: 'extracted' }] },
      { method: 'eq', args: ['id', TEXT_ID] },
      { method: 'not', args: ['status', 'in', '("completed","conquered")'] },
    ])
  })

  it('[3] texts 갱신 오류는 reject 하지 않고 warn 1회 뒤 추출 결과를 돌려준다', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const { client } = makeClient(happyResolver({ message: 'permission denied' }))

    await expect(adaptiveExtractWords(client, TEXT_ID, ctx)).resolves.toEqual({
      decidedCount: 10,
      attemptedCount: 2,
      insertedCount: 2,
    })
    expect(warn).toHaveBeenCalledTimes(1)
    expect(String(warn.mock.calls[0][0])).toContain('permission denied')
  })
})
