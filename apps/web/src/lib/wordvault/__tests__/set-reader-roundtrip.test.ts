// apps/web/src/lib/wordvault/__tests__/set-reader-roundtrip.test.ts
// T-0214 — 규칙표(runtime/team-pilot-20261028/pb-t0214-boundary-rules.md)의 11행을 그대로 옮긴 왕복 회귀. 생성(loadArticleSetMembership) → 저장(rememberEvidenceAnchor) → Reader 표(buildParagraphsFromContent ·
// buildEvidenceSentenceMap) → 꺼냄(takeEvidenceAnchor · anchorAfterTake · visibleReaderAnchor) 을 **실제 함수로** 왕복한다.
// 링크가 생기면 Reader 에서 반드시 그 문장으로 풀리고, 풀리지 않는 경우에는 링크가 생기지 않아야 한다.
import { describe, expect, it } from 'vitest'

import { buildParagraphsFromContent } from '@/app/(main)/text/[id]/text-content-helpers'
import {
  anchorAfterTake,
  anchorKey,
  buildEvidenceSentenceMap,
  contentHash,
  rememberEvidenceAnchor,
  takeEvidenceAnchor,
  visibleReaderAnchor,
} from '@/lib/scriptquiz/reader-anchor'
import { loadArticleSetMembership, type SetMembershipReader } from '../set-membership-query'

const A = '404f4977-7d03-4955-8834-833a668f13af'
const ART = '267ef969-2a3a-4dc9-b6b7-a85246df543f'

function client(body: string, rows: Array<{ word: string; source_sentence: string }>) {
  const set = { id: A, category: 'library_article', is_published: true, curation_query: { article_id: ART } }
  const one = (data: unknown) => {
    const q = { select: () => q, eq: () => q, maybeSingle: async () => ({ data, error: null }) }
    return q
  }
  return {
    auth: { getUser: async () => ({ data: { user: { id: 'user-a' } } }) },
    rpc: async () => ({ data: null, error: { message: 'not expected' } }),
    from(t: string) {
      if (t === 'shared_word_sets') return one(set)
      if (t === 'library_articles') return one({ status: 'published', copyright_safe_in_kr: true, content: body })
      if (t === 'texts') return one({ id: 'text-a' })
      if (t === 'v_text_content') return one({ id: 'text-a', content: body, paragraph_offsets: null })
      const q = { select: () => q, eq: () => q, order: () => q, range: async () => ({ data: rows, error: null }) }
      return q
    },
  } as never
}

function memoryStorage() {
  const m = new Map<string, string>()
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v), removeItem: (k: string) => void m.delete(k) }
}

/** Reader(layout + useReaderEvidenceAnchor)와 같은 순서로 문장 id 를 푼다 — 링크를 누른 뒤 Reader 가 실제로 강조할 문장 글자 */
function readerLands(body: string, reader: SetMembershipReader, word: string): string | null {
  const storage = memoryStorage()
  rememberEvidenceAnchor({ textId: reader.textId, hash: reader.hash, sentenceIndex: reader.anchors[word]! }, storage)
  const paragraphs = buildParagraphsFromContent(body, [])
  const readerSentences = paragraphs.flatMap((p) => p.sentences.map((s) => ({ id: s.id, text: s.parts.map((pt) => pt.text).join('') })))
  const hash = contentHash(body)
  const map = buildEvidenceSentenceMap(body, readerSentences)
  const key = anchorKey(reader.textId, hash)
  const state = anchorAfterTake(null, key, takeEvidenceAnchor(reader.textId, hash, storage), map)
  const { anchorSentenceId, anchorAutoMove } = visibleReaderAnchor(state, key)
  if (anchorSentenceId === null || !anchorAutoMove) return null
  return readerSentences.find((s) => s.id === anchorSentenceId)?.text.trim() ?? null
}

async function readerOf(body: string, rows: Array<{ word: string; source_sentence: string }>) {
  const r = await loadArticleSetMembership(client(body, rows), `set:${A}`)
  return r && 'reader' in r ? (r.reader ?? null) : null
}

/** 규칙표 행 — 링크가 있으면 도착 문장, 없으면 null */
const TABLE: Array<{ n: number; name: string; body: string; source: string; lands: string | null }> = [
  { n: 1, name: '짧은 유일', body: 'They marched on. Resist! The end came.', source: 'Resist!', lands: 'Resist!' },
  { n: 2, name: '부분 포함', body: 'They marched on. Resist! They resist oppression.', source: 'Resist!', lands: 'Resist!' },
  { n: 3, name: '중복(같은 단락)', body: 'We waited. Then rain came. We waited.', source: 'We waited.', lands: null },
  { n: 4, name: '중복(다른 단락 · 줄바꿈 — Codex 사례)', body: 'We waited.\nThe rain stopped.\n\nWe waited.', source: 'We waited.', lands: null },
  { n: 5, name: '공백 차이', body: 'The drought ruined the harvest. Later, flooding came.', source: 'The drought  ruined   the harvest.', lands: 'The drought ruined the harvest.' },
  { n: 6, name: '대소문자 차이', body: 'Resist! The crowd answered.\n\nresist!', source: 'Resist!', lands: null },
  { n: 7, name: '약어 Dr.', body: 'The lab was quiet. Dr. Smith announced the results. Everyone cheered.', source: 'Dr. Smith announced the results.', lands: 'Dr. Smith announced the results.' },
  { n: 8, name: '소수점 3.5', body: 'Markets moved fast. The price rose by 3.5 percent. Traders waited.', source: 'The price rose by 3.5 percent.', lands: 'The price rose by 3.5 percent.' },
  { n: 9, name: '인용부호', body: 'She paused. “We will stay,” she said. They agreed.', source: '“We will stay,” she said.', lands: '“We will stay,” she said.' },
  { n: 10, name: '다문장 출처', body: 'The drought ruined the harvest. Later, flooding came.', source: 'The drought ruined the harvest. Later, flooding came.', lands: null },
  { n: 11, name: 'Reader 가 두 원문 문장을 하나로 병합', body: 'We waited.\nThe rain stopped.\n\nIt ended.', source: 'The rain stopped.', lands: null },
]

describe('규칙표 왕복 — 생성 → 저장 → Reader 표 → 이동', () => {
  for (const row of TABLE) {
    it(`#${row.n} ${row.name}: ${row.lands ? `링크 → 「${row.lands}」` : '링크 없음'}`, async () => {
      const reader = await readerOf(row.body, [{ word: 'w', source_sentence: row.source }])
      if (row.lands === null) {
        expect(reader?.anchors.w).toBeUndefined()
      } else {
        expect(reader?.anchors.w).toBeDefined()
        expect(readerLands(row.body, reader!, 'w')).toBe(row.lands)
      }
    })
  }
  it('링크가 생긴 모든 낱말은 Reader 에서 null 이 아닌 문장으로 풀린다(불일치 0)', async () => {
    const body = 'They marched on. Resist! They resist oppression. We waited. We waited. Dr. Smith announced the results.'
    const reader = await readerOf(body, [
      { word: 'resist', source_sentence: 'Resist!' },
      { word: 'wait', source_sentence: 'We waited.' },
      { word: 'announce', source_sentence: 'Dr. Smith announced the results.' },
      { word: 'march', source_sentence: 'They marched on.' },
    ])
    expect(Object.keys(reader?.anchors ?? {}).sort()).toEqual(['announce', 'march', 'resist'])
    for (const w of Object.keys(reader!.anchors)) expect(readerLands(body, reader!, w)).not.toBeNull()
  })
})

describe('originalSentences — 기존 splitSentences 위 약어 · 소수점 보호만', () => {
  it('Dr. · 3.5 는 붙이고 · 보통 문장 경계 · 줄바꿈 단락은 그대로', async () => {
    const { originalSentences } = await import('../set-membership-query')
    expect(originalSentences('The lab was quiet. Dr. Smith announced the results.')).toEqual(['The lab was quiet.', 'Dr. Smith announced the results.'])
    expect(originalSentences('The price rose by 3.5 percent. Traders waited.')).toEqual(['The price rose by 3.5 percent.', 'Traders waited.'])
    expect(originalSentences('We waited.\nThe rain stopped.\n\nWe waited.')).toEqual(['We waited.', 'The rain stopped.', 'We waited.'])
    expect(originalSentences('It cost 3. 5 people came.')).toEqual(['It cost 3.', '5 people came.'])
  })
})
