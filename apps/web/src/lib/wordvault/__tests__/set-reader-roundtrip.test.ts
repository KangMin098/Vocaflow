// apps/web/src/lib/wordvault/__tests__/set-reader-roundtrip.test.ts
// T-0214 — 경계 결정 T0214_BOUNDARY_DECISION_20261029.md(Rev1.0)의 공식에 맞춘 왕복 회귀(규칙표 pb-t0214-boundary-rules.md 11행 + 약어 · 줄바꿈 · 인용 중복). 생성(loadArticleSetMembership) → 저장(rememberEvidenceAnchor) → Reader 표(buildParagraphsFromContent ·
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

/** 사례 — 링크가 있으면 도착 단위 글자(공백 정규화 = 출처), 없으면 null */
const TABLE: Array<{ n: string; name: string; body: string; source: string; link: boolean }> = [
  { n: '1', name: '짧은 유일', body: 'They marched on. Resist! The end came.', source: 'Resist!', link: true },
  { n: '2', name: '부분 포함(They resist oppression. 은 중복이 아니다)', body: 'They marched on. Resist! They resist oppression.', source: 'Resist!', link: true },
  { n: '3', name: '중복(같은 단락)', body: 'We waited. Then rain came. We waited.', source: 'We waited.', link: false },
  { n: '4', name: '중복(다른 단락 · Reader 병합 넘어 — Codex 사례)', body: 'We waited.\nThe rain stopped.\n\nWe waited.', source: 'We waited.', link: false },
  { n: '5', name: '공백 차이', body: 'The drought ruined the harvest. Later, flooding came.', source: 'The drought  ruined   the harvest.', link: true },
  { n: '6', name: '대소문자만 다른 중복', body: 'Resist! The crowd answered.\n\nresist!', source: 'Resist!', link: false },
  { n: '7', name: '약어 Dr.', body: 'The lab was quiet. Dr. Smith announced the results. Everyone cheered.', source: 'Dr. Smith announced the results.', link: true },
  { n: '8', name: '소수점 3.5', body: 'Markets moved fast. The price rose by 3.5 percent. Traders waited.', source: 'The price rose by 3.5 percent.', link: true },
  { n: '9', name: '인용부호', body: 'She paused. “We will stay,” she said. They agreed.', source: '“We will stay,” she said.', link: true },
  { n: '10', name: '두 Reader 단위에 걸친 출처', body: 'The drought ruined the harvest. Later, flooding came.', source: 'The drought ruined the harvest. Later, flooding came.', link: false },
  { n: '11', name: 'Reader 병합 단위의 일부', body: 'We waited.\nThe rain stopped.\n\nIt ended.', source: 'The rain stopped.', link: false },
  { n: '12', name: '약어 e.g.(Codex 5차 사례)', body: 'They tried many fruits. They used e.g. apples in the recipe. It worked.', source: 'They used e.g. apples in the recipe.', link: true },
  { n: '13', name: '약어 i.e.', body: 'One rule mattered. Use the short form, i.e. the first one. Then stop.', source: 'Use the short form, i.e. the first one.', link: true },
  { n: '14', name: 'U.S. — Reader 가 한 단위로 볼 때', body: 'He was tired. He moved to the U.S. last year. Life changed.', source: 'He moved to the U.S. last year.', link: true },
  { n: '15', name: 'U.S. 뒤 대문자 — 지금 Reader 도 한 단위로 본다(공식 충족)', body: 'Votes were counted. The U.S. Senate voted. It passed.', source: 'The U.S. Senate voted.', link: true },
  { n: '16', name: '줄바꿈을 보존한 Reader 단위 전체', body: 'We waited.\nThe rain stopped.\n\nIt ended.', source: 'We waited. The rain stopped.', link: true },
  { n: '17', name: '인용 안에도 같은 문장(더 긴 표현 안 — 보수적 생략)', body: 'She wrote, “We waited.” Days passed. We waited.', source: 'We waited.', link: false },
  { n: '18', name: '본문 불일치(출처가 본문에 없음)', body: 'They marched on. The end came.', source: 'Resist!', link: false },
]

const ws = (s: string) => s.replace(/\s+/g, ' ').trim()

describe('경계 결정 Rev1.0 왕복 — 실제 생성 → 앵커 → 실제 Reader 소비자', () => {
  for (const row of TABLE) {
    it(`#${row.n} ${row.name}: ${row.link ? '링크 · 도착 단위 = 출처' : '링크 없음'}`, async () => {
      const reader = await readerOf(row.body, [{ word: 'w', source_sentence: row.source }])
      if (!row.link) {
        expect(reader?.anchors.w).toBeUndefined()
        return
      }
      expect(reader?.anchors.w).toBeDefined()
      const landed = readerLands(row.body, reader!, 'w')
      expect(landed).not.toBeNull()
      expect(ws(landed!)).toBe(ws(row.source))
    })
  }
  it('링크가 생긴 모든 낱말은 Reader 에서 출처와 같은 단위로 풀린다(불일치 0)', async () => {
    const body = 'They marched on. Resist! They resist oppression. We waited. We waited. Dr. Smith announced the results.'
    const rows = [
      { word: 'resist', source_sentence: 'Resist!' },
      { word: 'wait', source_sentence: 'We waited.' },
      { word: 'announce', source_sentence: 'Dr. Smith announced the results.' },
      { word: 'march', source_sentence: 'They marched on.' },
    ]
    const reader = await readerOf(body, rows)
    expect(Object.keys(reader?.anchors ?? {}).sort()).toEqual(['announce', 'march', 'resist'])
    for (const w of Object.keys(reader!.anchors)) expect(ws(readerLands(body, reader!, w)!)).toBe(ws(rows.find((r) => r.word === w)!.source_sentence))
  })
})
