// apps/web/src/lib/wordvault/__tests__/set-reader-anchor.test.ts
// T-0214 — 기사 단어장 정본 응답에 「글에서 이 문장 보기」 결속(reader)을 세트당 한 번만 싣는다(조회 대역).
// 대역은 **실제 스키마에 있는 열만** 받는다(없는 열을 고르면 PostgREST 처럼 42703) — Codex P1(texts.paragraph_offsets 없음)을 못 잡던 대역을 고쳤다.
// 실제 열 목록은 2026-10-29 information_schema 읽기로 확인: texts(id · user_id · source_url · content …) · v_text_content(id · user_id · content · paragraph_offsets …).
import fs from 'node:fs'
import path from 'node:path'
import { describe, expect, it } from 'vitest'

import { contentHash } from '@/lib/scriptquiz/reader-anchor'
import { READER_TEXT_SOURCE, loadArticleSetMembership, readerAnchorIndex, readerSentencesOf } from '../set-membership-query'

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

/** 실제 열(읽은 것)만 — 대역이 없는 열을 받아 주지 않게 */
const SCHEMA: Record<string, string[]> = {
  shared_word_sets: ['id', 'category', 'is_published', 'curation_query'],
  library_articles: ['id', 'status', 'copyright_safe_in_kr', 'content'],
  shared_words: ['id', 'word', 'source_sentence', 'set_id'],
  texts: ['id', 'user_id', 'source_url', 'content', 'title'],
  v_text_content: ['id', 'user_id', 'content', 'paragraph_offsets', 'sentence_offsets', 'title'],
}

function fake(o: { uid?: string | null; texts?: TextRow[]; textsErr?: boolean; ownContent?: string | null; viewErr?: boolean; rows?: Row[]; body?: string; offsets?: unknown }) {
  const log = { reads: [] as string[], rpc: [] as string[], writes: 0 }
  const write = () => {
    log.writes++
    throw new Error('write')
  }
  const body = o.body ?? BODY
  const client = {
    auth: { getUser: async () => ({ data: { user: o.uid === null ? null : { id: o.uid ?? 'user-a' } } }) },
    rpc: async (fn: string) => {
      log.rpc.push(fn)
      return { data: null, error: { message: 'not expected' } }
    },
    from(t: string) {
      const f: Record<string, string> = {}
      let cols = ''
      const bad = () => cols.split(',').map((c) => c.trim()).filter((c) => c && !(SCHEMA[t] ?? []).includes(c))
      const result = (data: unknown) => (bad().length ? { data: null, error: { code: '42703', message: `column ${bad()[0]} does not exist` } } : { data, error: null })
      const q = {
        insert: write,
        update: write,
        upsert: write,
        delete: write,
        select: (c: string) => {
          cols = c
          log.reads.push(`${t}:${c}`)
          return q
        },
        eq: (k: string, v: string) => {
          f[k] = v
          return q
        },
        order: () => q,
        range: async () => result(o.rows ?? ROWS),
        maybeSingle: async () => {
          if (t === 'shared_word_sets') return result(set)
          if (t === 'library_articles') return result({ status: 'published', copyright_safe_in_kr: true, content: body })
          if (t === 'texts') {
            if (o.textsErr) return { data: null, error: { message: 'x' } }
            const hit = (o.texts ?? [{ id: 'text-a', user_id: 'user-a', source_url: `article:${ART}` }]).find((r) => r.user_id === f.user_id && r.source_url === f.source_url)
            return result(hit ? { id: hit.id } : null)
          }
          if (t === 'v_text_content') {
            if (o.viewErr) return { data: null, error: { message: 'x' } }
            return result({ id: f.id, content: o.ownContent === undefined ? body : o.ownContent, paragraph_offsets: o.offsets ?? null })
          }
          return { data: null, error: { message: `unknown table ${t}` } }
        },
      }
      return q
    },
  }
  return { client: client as never, log }
}

const readerOf = (r: unknown) => (r && typeof r === 'object' && 'reader' in r ? (r as { reader?: unknown }).reader : undefined)

describe('출처 · 열 결속(Codex P1 회귀)', () => {
  it('본문 · 오프셋은 Reader(layout)와 같은 뷰에서 · layout 이 고르는 열의 부분집합 · texts 에서는 id 만', async () => {
    const layout = fs.readFileSync(path.resolve(__dirname, '../../../app/(main)/text/[id]/layout.tsx'), 'utf8')
    const m = /\.from\('v_text_content'\)\s*\.select\(\s*'([^']+)'/.exec(layout)
    expect(m).not.toBeNull()
    const layoutCols = m![1].split(',').map((c) => c.trim())
    expect(READER_TEXT_SOURCE.table).toBe('v_text_content')
    for (const c of READER_TEXT_SOURCE.columns.split(',').map((x) => x.trim())) expect(layoutCols).toContain(c)
    const { client, log } = fake({})
    await loadArticleSetMembership(client, `set:${A}`)
    expect(log.reads).toContain('texts:id')
    expect(log.reads).toContain(`v_text_content:${READER_TEXT_SOURCE.columns}`)
  })
  it('대역은 없는 열을 받지 않는다(예전 코드의 texts.paragraph_offsets 는 실패)', async () => {
    const { client } = fake({})
    const r = await (client as unknown as { from: (t: string) => { select: (c: string) => { maybeSingle: () => Promise<{ error: unknown }> } } }).from('texts').select('id, paragraph_offsets').maybeSingle()
    expect(r.error).toMatchObject({ code: '42703' })
  })
})

describe('loadArticleSetMembership — reader 결속', () => {
  it('본인 글 · 같은 본문: 유일 문장 낱말만 anchors, 중복 문장 낱말은 빠짐 · 해시는 Reader 와 같은 contentHash', async () => {
    const { client, log } = fake({})
    const r = await loadArticleSetMembership(client, `set:${A}`)
    expect(readerOf(r)).toEqual({ textId: 'text-a', hash: contentHash(BODY), anchors: { drought: 1, flooding: 2 } })
    expect(r && 'contexts' in r ? Object.keys(r.contexts ?? {}).sort() : []).toEqual(['drought', 'flooding', 'rain'])
    // 세트당 한 번: 기존 3조회 + texts 1 + v_text_content 1 — 행마다 조회하지 않는다 · RPC 0
    expect(log.reads.map((x) => x.split(':')[0])).toEqual(['shared_word_sets', 'library_articles', 'shared_words', 'texts', 'v_text_content'])
    expect(log.rpc).toEqual([])
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
  it('texts 실패 · 본문 뷰 실패 · 로그아웃 → reader 없음, membership 은 error 가 아니다', async () => {
    for (const o of [{ textsErr: true }, { viewErr: true }, { uid: null }]) {
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

describe('readerAnchorIndex — Reader 문장 단위', () => {
  it('짧은 유일 문장 · 중복 · 일부만 · 빈 값', () => {
    const body = 'They marched on. Resist! We waited. We waited. The end came slowly.'
    const rs = readerSentencesOf(body, [])
    expect(readerAnchorIndex(body, rs, 'Resist!')).toBe(1)
    expect(readerAnchorIndex(body, rs, 'We waited.')).toBeNull()
    expect(readerAnchorIndex(body, rs, 'end came')).toBeNull()
    expect(readerAnchorIndex(body, rs, '  ')).toBeNull()
    expect(readerAnchorIndex(body, rs, 'The end  came slowly.')).toBe(4)
  })
})
