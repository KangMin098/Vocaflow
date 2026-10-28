// apps/web/src/lib/wordvault/__tests__/set-reader-roundtrip.test.ts
// T-0214 Codex P2 2차 — 생성(loadArticleSetMembership) → 저장(rememberEvidenceAnchor) → Reader 표(buildParagraphsFromContent ·
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

describe('생성 → 저장 → Reader 표 → 이동 왕복', () => {
  it('짧은 유일 문장: 링크가 생기고 Reader 가 바로 그 문장으로 간다', async () => {
    const body = 'They marched on. Resist! The end came.'
    const reader = await readerOf(body, [{ word: 'resist', source_sentence: 'Resist!' }])
    expect(reader?.anchors.resist).toBeDefined()
    expect(readerLands(body, reader!, 'resist')).toBe('Resist!')
  })
  it('다른 문장 안에 부분으로 들어 있는 짧은 문장(Codex 사례): 전체 일치가 먼저 — 링크 · 이동 모두 그 문장', async () => {
    const body = 'They marched on. Resist! They resist oppression.'
    const reader = await readerOf(body, [{ word: 'resist', source_sentence: 'Resist!' }])
    expect(reader?.anchors.resist).toBeDefined()
    expect(readerLands(body, reader!, 'resist')).toBe('Resist!')
  })
  it('중복 문장: 링크 없음', async () => {
    const body = 'We waited. Then rain came. We waited.'
    expect(await readerOf(body, [{ word: 'wait', source_sentence: 'We waited.' }])).toBeNull()
  })
  it('공백 차이(문맥 문장에 겹공백): 같은 문장으로 링크 · 이동', async () => {
    const body = 'The drought ruined the harvest. Later, flooding came.'
    const reader = await readerOf(body, [{ word: 'drought', source_sentence: 'The drought  ruined   the harvest.' }])
    expect(reader?.anchors.drought).toBeDefined()
    expect(readerLands(body, reader!, 'drought')).toBe('The drought ruined the harvest.')
  })
  it('대소문자만 다른 문장이 따로 있으면 Reader 가 하나로 못 푼다 — 링크도 만들지 않는다', async () => {
    // 단락을 나눠 Reader 도 세 문장으로 본다(Reader 문장 나눔은 다음 글자가 대문자일 때만 끊는다). 생성 쪽 splitSentences 는 대소문자를 구분해 「Resist!」 를 유일로 보지만
    // Reader 표(normalizeForMatch 는 대소문자 무시)는 두 문장에 맞아 -1 — 그래서 링크를 만들지 않는다(누르고 이동 안 하는 링크 금지)
    const body = 'Resist! The crowd answered.\n\nresist!'
    expect(await readerOf(body, [{ word: 'resist', source_sentence: 'Resist!' }])).toBeNull()
  })
  it('링크가 생긴 모든 낱말은 Reader 에서 null 이 아닌 문장으로 풀린다(불일치 0)', async () => {
    const body = 'They marched on. Resist! They resist oppression. We waited. We waited. The drought ruined the harvest.'
    const rows = [
      { word: 'resist', source_sentence: 'Resist!' },
      { word: 'wait', source_sentence: 'We waited.' },
      { word: 'drought', source_sentence: 'The drought ruined the harvest.' },
      { word: 'march', source_sentence: 'They marched on.' },
    ]
    const reader = await readerOf(body, rows)
    expect(Object.keys(reader?.anchors ?? {}).sort()).toEqual(['drought', 'march', 'resist'])
    for (const w of Object.keys(reader!.anchors)) expect(readerLands(body, reader!, w)).not.toBeNull()
  })
})

describe('약어 · 소수점 · 인용부호(Codex P2 3차 회귀) — Reader 가 한 문장으로 보면 그 문장으로', () => {
  it('약어 「Dr.」 가 든 문장', async () => {
    const body = 'The lab was quiet. Dr. Smith announced the results. Everyone cheered.'
    const reader = await readerOf(body, [{ word: 'announce', source_sentence: 'Dr. Smith announced the results.' }])
    expect(reader?.anchors.announce).toBeDefined()
    expect(readerLands(body, reader!, 'announce')).toBe('Dr. Smith announced the results.')
  })
  it('소수점 「3.5」 가 든 문장', async () => {
    const body = 'Markets moved fast. The price rose by 3.5 percent. Traders waited.'
    const reader = await readerOf(body, [{ word: 'rise', source_sentence: 'The price rose by 3.5 percent.' }])
    expect(reader?.anchors.rise).toBeDefined()
    expect(readerLands(body, reader!, 'rise')).toBe('The price rose by 3.5 percent.')
  })
  it('인용부호로 끝나는 문장', async () => {
    const body = 'She paused. “We will stay,” she said. They agreed.'
    const reader = await readerOf(body, [{ word: 'stay', source_sentence: '“We will stay,” she said.' }])
    expect(reader?.anchors.stay).toBeDefined()
    expect(readerLands(body, reader!, 'stay')).toBe('“We will stay,” she said.')
  })
})
