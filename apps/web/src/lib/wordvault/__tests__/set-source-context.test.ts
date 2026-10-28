// apps/web/src/lib/wordvault/__tests__/set-source-context.test.ts
// T-0210 — 기사 단어장 정본 응답에 「본문에서 확인된 원문 문장」만 싣는다. 같은 조회(N+1 없음) · 쓰기 0 · 권리/계정 경계 유지.
import { describe, expect, it, vi } from 'vitest'

import { loadArticleSetMembership, verifiedSourceSentence } from '../set-membership-query'

const A = '404f4977-7d03-4955-8834-833a668f13af'
const BODY = 'Farmers waited for rain.\n\nThe drought  ruined the harvest in many villages. Later, flooding came.'
const set = { id: A, category: 'library_article', is_published: true, curation_query: { article_id: '267ef969-2a3a-4dc9-b6b7-a85246df543f' } }

function fake(opts: { article?: unknown; rows?: Array<{ word: string; source_sentence: unknown }> }) {
  const log = { from: [] as string[], selects: [] as string[], writes: 0 }
  const write = () => { log.writes++; throw new Error('write not allowed') }
  const client = {
    from(t: string) {
      log.from.push(t)
      const base = { insert: write, update: write, upsert: write, delete: write }
      if (t === 'shared_word_sets') { const q = { ...base, select: (c: string) => (log.selects.push(`${t}:${c}`), q), eq: () => q, maybeSingle: async () => ({ data: set, error: null }) }; return q }
      if (t === 'library_articles') { const q = { ...base, select: (c: string) => (log.selects.push(`${t}:${c}`), q), eq: () => q, maybeSingle: async () => ({ data: opts.article === undefined ? { status: 'published', copyright_safe_in_kr: true, content: BODY } : opts.article, error: null }) }; return q }
      const q = { ...base, select: (c: string) => (log.selects.push(`${t}:${c}`), q), eq: () => q, order: () => q, range: async () => ({ data: opts.rows ?? [], error: null }) }
      return q
    },
  }
  return { client: client as never, log }
}

describe('verifiedSourceSentence', () => {
  it('본문에 그대로 있으면(공백 차이만 무시) 문장, 아니면 null', () => {
    expect(verifiedSourceSentence('The drought ruined the harvest in many villages.', BODY)).toBe('The drought ruined the harvest in many villages.')
    expect(verifiedSourceSentence('The drought ruined the crops.', BODY)).toBeNull()
    expect(verifiedSourceSentence('the drought ruined the harvest in many villages.', BODY)).toBeNull() // 대소문자 바꾸지 않음
    expect(verifiedSourceSentence('', BODY)).toBeNull()
    expect(verifiedSourceSentence(null, BODY)).toBeNull()
    expect(verifiedSourceSentence('The drought ruined the harvest in many villages.', null)).toBeNull()
  })
})

describe('loadArticleSetMembership — 원문 문장', () => {
  it('정확: 본문 확인된 낱말만 contexts, 다른 원문 · 빈 값은 빠지고 words 는 전부', async () => {
    const { client, log } = fake({ rows: [
      { word: 'drought', source_sentence: 'The drought ruined the harvest in many villages.' },
      { word: 'harvest', source_sentence: 'A different article said the harvest was fine.' },
      { word: 'flooding', source_sentence: '' },
      { word: 'rain', source_sentence: null },
    ] })
    const r = await loadArticleSetMembership(client, `set:${A}`)
    expect(r).toEqual({ setId: A, words: ['drought', 'harvest', 'flooding', 'rain'], contexts: { drought: 'The drought ruined the harvest in many villages.' } })
    // 같은 세 조회만(N+1 없음) — 필드만 더했다
    expect(log.from).toEqual(['shared_word_sets', 'library_articles', 'shared_words'])
    expect(log.selects).toContain('library_articles:status, copyright_safe_in_kr, content')
    expect(log.selects).toContain('shared_words:id, word, source_sentence')
    expect(log.writes).toBe(0)
  })
  it('확인된 문장이 하나도 없으면 contexts 없이 기존 모양 그대로(목록 판정 불변)', async () => {
    const { client } = fake({ rows: [{ word: 'harvest', source_sentence: 'Not in this article at all.' }] })
    expect(await loadArticleSetMembership(client, `set:${A}`)).toEqual({ setId: A, words: ['harvest'] })
  })
  it('본문이 비면 문장 없음 · 권리 불가 기사는 기존대로 null(문장도 없음)', async () => {
    const empty = fake({ article: { status: 'published', copyright_safe_in_kr: true, content: null }, rows: [{ word: 'drought', source_sentence: 'The drought ruined the harvest in many villages.' }] })
    expect(await loadArticleSetMembership(empty.client, `set:${A}`)).toEqual({ setId: A, words: ['drought'] })
    const unsafe = fake({ article: { status: 'published', copyright_safe_in_kr: false, content: BODY }, rows: [{ word: 'drought', source_sentence: 'The drought ruined the harvest in many villages.' }] })
    expect(await loadArticleSetMembership(unsafe.client, `set:${A}`)).toBeNull()
    expect(unsafe.log.from).not.toContain('shared_words')
  })
  it('낱말 이름이 객체 키와 같아도 섞이지 않는다', async () => {
    const { client } = fake({ rows: [{ word: 'constructor', source_sentence: 'Farmers waited for rain.' }] })
    expect(await loadArticleSetMembership(client, `set:${A}`)).toEqual({ setId: A, words: ['constructor'], contexts: { constructor: 'Farmers waited for rain.' } })
  })
})

describe('계정 경계 — 서버 action', () => {
  it('로그인 안 됨이면 null, 조회 0', async () => {
    vi.resetModules()
    const from = vi.fn()
    vi.doMock('@/lib/supabase/server', () => ({ createClient: async () => ({ auth: { getUser: async () => ({ data: { user: null } }) }, from }) }))
    const { fetchArticleSetMembership } = await import('../set-membership-actions')
    expect(await fetchArticleSetMembership(`set:${A}`)).toBeNull()
    expect(from).not.toHaveBeenCalled()
    vi.doUnmock('@/lib/supabase/server')
  })
})
