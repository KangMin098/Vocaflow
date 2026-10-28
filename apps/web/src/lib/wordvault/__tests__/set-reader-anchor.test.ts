// apps/web/src/lib/wordvault/__tests__/set-reader-anchor.test.ts
// T-0214 — 기사 단어장 정본 응답에 「글에서 이 문장 보기」 결속(reader)을 세트당 한 번만 싣는다(조회 대역).
// 본인 글 · 같은 본문 · 유일한 한 문장일 때만. 없음 · 다른 판본 · 중복 · 미매칭 · 조회 실패 · 로그아웃은 reader 없음(목록 · 문장 보존).
import { describe, expect, it } from 'vitest'

import { contentHash } from '@/lib/scriptquiz/reader-anchor'
import { exactSentenceIndex, loadArticleSetMembership } from '../set-membership-query'

const A = '404f4977-7d03-4955-8834-833a668f13af'
const ART = '267ef969-2a3a-4dc9-b6b7-a85246df543f'
const BODY = 'Farmers waited for rain. The drought ruined the harvest in many villages. Later, flooding came. Farmers waited for rain.'
const set = { id: A, category: 'library_article', is_published: true, curation_query: { article_id: ART } }
type Row = { word: string; source_sentence: string }
const ROWS: Row[] = [
  { word: 'drought', source_sentence: 'The drought ruined the harvest in many villages.' }, // 유일
  { word: 'rain', source_sentence: 'Farmers waited for rain.' }, // 본문에 두 번 — 중복
  { word: 'flooding', source_sentence: 'Later, flooding came.' }, // 유일
]
type TextRow = { id: string; user_id: string; source_url: string }

function fake(o: { uid?: string | null; texts?: TextRow[]; textsErr?: boolean; ownContent?: string | null; rpcErr?: boolean; rows?: Row[]; body?: string }) {
  const log = { from: [] as string[], rpc: [] as string[], writes: 0 }
  const write = () => {
    log.writes++
    throw new Error('write')
  }
  const base = { insert: write, update: write, upsert: write, delete: write }
  const client = {
    auth: { getUser: async () => ({ data: { user: o.uid === null ? null : { id: o.uid ?? 'user-a' } } }) },
    rpc: async (fn: string) => {
      log.rpc.push(fn)
      return o.rpcErr ? { data: null, error: { message: 'x' } } : { data: o.ownContent === undefined ? (o.body ?? BODY) : o.ownContent, error: null }
    },
    from(t: string) {
      log.from.push(t)
      if (t === 'shared_word_sets') {
        const q = { ...base, select: () => q, eq: () => q, maybeSingle: async () => ({ data: set, error: null }) }
        return q
      }
      if (t === 'library_articles') {
        const q = { ...base, select: () => q, eq: () => q, maybeSingle: async () => ({ data: { status: 'published', copyright_safe_in_kr: true, content: o.body ?? BODY }, error: null }) }
        return q
      }
      if (t === 'texts') {
        const f: Record<string, string> = {}
        const q = {
          ...base,
          select: () => q,
          eq: (k: string, v: string) => {
            f[k] = v
            return q
          },
          maybeSingle: async () => {
            if (o.textsErr) return { data: null, error: { message: 'x' } }
            const hit = (o.texts ?? [{ id: 'text-a', user_id: 'user-a', source_url: `article:${ART}` }]).find((r) => r.user_id === f.user_id && r.source_url === f.source_url)
            return { data: hit ? { id: hit.id } : null, error: null }
          },
        }
        return q
      }
      const q = { ...base, select: () => q, eq: () => q, order: () => q, range: async () => ({ data: o.rows ?? ROWS, error: null }) }
      return q
    },
  }
  return { client: client as never, log }
}

const readerOf = (r: unknown) => (r && typeof r === 'object' && 'reader' in r ? (r as { reader?: unknown }).reader : undefined)

describe('loadArticleSetMembership — reader 결속', () => {
  it('본인 글 · 같은 본문: 유일 문장 낱말만 anchors, 중복 문장 낱말은 빠짐 · 해시는 Reader 와 같은 contentHash', async () => {
    const { client, log } = fake({})
    const r = await loadArticleSetMembership(client, `set:${A}`)
    expect(readerOf(r)).toEqual({ textId: 'text-a', hash: contentHash(BODY), anchors: { drought: 1, flooding: 2 } })
    expect(r && 'contexts' in r ? Object.keys(r.contexts ?? {}).sort() : []).toEqual(['drought', 'flooding', 'rain'])
    // 세트당 한 번: 기존 3조회 + texts 1 + get_chapter_content 1 — 행마다 조회하지 않는다
    expect(log.from).toEqual(['shared_word_sets', 'library_articles', 'shared_words', 'texts'])
    expect(log.rpc).toEqual(['get_chapter_content'])
    expect(log.writes).toBe(0)
  })
  it('타인 글만 있음 · 본인 글 없음 → reader 없음(문장 · 목록은 그대로)', async () => {
    const r = await loadArticleSetMembership(fake({ texts: [{ id: 'text-b', user_id: 'user-b', source_url: `article:${ART}` }] }).client, `set:${A}`)
    expect(r).toMatchObject({ setId: A, words: ['drought', 'rain', 'flooding'] })
    expect(readerOf(r)).toBeUndefined()
    expect(r && 'contexts' in r ? r.contexts?.drought : null).toBeTruthy()
  })
  it('본인 글 본문이 지금 기사와 다르면(다른 판본) reader 없음', async () => {
    expect(readerOf(await loadArticleSetMembership(fake({ ownContent: `${BODY} Extra old line.` }).client, `set:${A}`))).toBeUndefined()
  })
  it('유일 문장이 하나도 없으면(중복만) reader 없음 · 문장은 그대로', async () => {
    const r = await loadArticleSetMembership(fake({ rows: [ROWS[1]] }).client, `set:${A}`)
    expect(readerOf(r)).toBeUndefined()
    expect(r && 'contexts' in r ? r.contexts?.rain : null).toBe('Farmers waited for rain.')
  })
  it('texts 조회 실패 · get_chapter_content 실패 · 로그아웃 → reader 없음, membership 은 error 가 아니다', async () => {
    for (const o of [{ textsErr: true }, { rpcErr: true }, { uid: null }]) {
      const r = await loadArticleSetMembership(fake(o).client, `set:${A}`)
      expect(r && 'error' in r).toBe(false)
      expect(readerOf(r)).toBeUndefined()
      expect(r && 'words' in r ? r.words.length : 0).toBe(3)
    }
  })
  it('계정이 바뀌면 그 계정의 본인 글만 본다(user_id 로 거름)', async () => {
    const texts = [
      { id: 'text-a', user_id: 'user-a', source_url: `article:${ART}` },
      { id: 'text-b', user_id: 'user-b', source_url: `article:${ART}` },
    ]
    expect((readerOf(await loadArticleSetMembership(fake({ uid: 'user-a', texts }).client, `set:${A}`)) as { textId?: string })?.textId).toBe('text-a')
    expect((readerOf(await loadArticleSetMembership(fake({ uid: 'user-b', texts }).client, `set:${A}`)) as { textId?: string })?.textId).toBe('text-b')
  })
})

describe('짧은 문장(Codex T-0214 P2 회귀)', () => {
  it('exactSentenceIndex: 유일한 짧은 문장은 번호 · 중복 짧은 문장 · 일부만 · 빈 값은 null', () => {
    const body = 'They marched on. Resist! We waited. We waited. The end came slowly.'
    expect(exactSentenceIndex(body, 'Resist!')).toBe(1)
    expect(exactSentenceIndex(body, 'We waited.')).toBeNull()
    expect(exactSentenceIndex(body, 'end came')).toBeNull()
    expect(exactSentenceIndex(body, '  ')).toBeNull()
    expect(exactSentenceIndex(body, 'The end  came slowly.')).toBe(4)
  })
  it('loadArticleSetMembership: 유일 짧은 문장 낱말은 링크 결속, 중복 짧은 문장 낱말은 없음', async () => {
    const body = 'They marched on. Resist! We waited. We waited.'
    const { client } = fake({ rows: [{ word: 'resist', source_sentence: 'Resist!' }, { word: 'wait', source_sentence: 'We waited.' }], ownContent: body, body })
    const r = await loadArticleSetMembership(client, `set:${A}`)
    expect(readerOf(r)).toEqual({ textId: 'text-a', hash: contentHash(body), anchors: { resist: 1 } })
  })
})
