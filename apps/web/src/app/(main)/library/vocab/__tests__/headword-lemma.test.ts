// apps/web/src/app/(main)/library/vocab/__tests__/headword-lemma.test.ts
//
// **단어장을 담을 때 굴절형이 아니라 원형이 학습자 단어장에 들어가는지 고정한다.**
//
// ── 왜 (실측 2026-08-22) ─────────────────────────────────────────────
// 공용 단어장의 표제어는 글에 나온 **표면형**이다 — `abated` · `flushed` · `abounding`.
// 원형은 `shared_words.lemma` 에 이미 기록돼 있고(81,409행 중 4,620행이 표면형과 다름),
// 우리말 뜻도 **원형 기준으로** 적혀 있다(`abated` 의 뜻이 "약해졌다" 가 아니라 "약해지다").
//
// 그런데 담기 코드가 `lemma` 를 읽지도 않고 `word` 를 그대로 넣고 있었다. 결과는 조용하다:
//   · 학습자가 `abated` 를 별개 낱말로 외운다
//   · `vocabularies` 의 UNIQUE(user_id, word) 때문에 나중에 `abate` 가 또 들어와 두 번 외운다
//   · 사전 조회가 표면형으로 나가 v_level 이 null 이 되고, "어려운 단어" 표시가 사라진다
//     (실측: 표면형 적중 94.3% → 원형 적중 100%)
//
// ⚠️ 굴절형처럼 보이지만 **원형이 자기 자신인 낱말**을 건드리면 안 된다:
//   `burning`(타는) · `ragged`(누덕누덕한) · `puzzling`(당혹스러운) · `species` · `shed`.
//   이들은 `lemma` 가 자기 자신으로 기록돼 있어, 원형을 따르면 자동으로 보존된다 —
//   **정규식으로 어미를 떼는 방식이었다면 전부 망가졌다**(그렇게 만들려다 실측에서 기각했다).

import { describe, expect, it } from 'vitest'

/** `actions.ts` 의 규칙과 같다 — 원형이 있으면 원형, 없으면 표면형. */
const headword = (w: { word: string; lemma: string | null }) => w.lemma?.trim() || w.word

/** 같은 배치 안의 표제어 중복을 접는다 (`actions.ts` 와 같은 규칙: 먼저 나온 것을 남긴다). */
function dedupe<T extends { word: string; lemma: string | null }>(rows: T[]): T[] {
  const seen = new Set<string>()
  return rows.filter((w) => {
    const k = headword(w).toLowerCase()
    if (seen.has(k)) return false
    seen.add(k)
    return true
  })
}

describe('담기 표제어 — 굴절형이 아니라 원형이 들어간다', () => {
  it.each([
    ['abated', 'abate', 'abate'],
    ['flushed', 'flush', 'flush'],
    ['abounding', 'abound', 'abound'],
    ['dying', 'die', 'die'],
  ])('%s(원형 %s) → %s', (word, lemma, expected) => {
    expect(headword({ word, lemma })).toBe(expected)
  })

  it.each([
    ['burning', 'burning'],
    ['ragged', 'ragged'],
    ['puzzling', 'puzzling'],
    ['species', 'species'],
    ['shed', 'shed'],
  ])('원형이 자기 자신인 %s 는 그대로 남는다 — 뜻이 갈라진 낱말이다', (word, lemma) => {
    expect(headword({ word, lemma })).toBe(word)
  })

  it('원형이 없으면 표면형을 쓴다 — 전체의 20%가 이 경우다', () => {
    expect(headword({ word: 'chatbots', lemma: null })).toBe('chatbots')
    expect(headword({ word: 'soybean', lemma: '   ' })).toBe('soybean')
  })
})

describe('원형으로 모으면 한 세트 안에서 겹친다', () => {
  it('같은 원형으로 모이는 표면형은 하나만 남는다', () => {
    // 실측 21건이 이 경우다 — `hunting` 과 `hunted` 가 둘 다 `hunt` 가 된다.
    const rows = [
      { word: 'hunting', lemma: 'hunt' },
      { word: 'hunted', lemma: 'hunt' },
      { word: 'fish', lemma: 'fish' },
    ]
    expect(dedupe(rows).map(headword)).toEqual(['hunt', 'fish'])
  })

  it('먼저 나온 것을 남긴다 — 세트가 정한 sort_order 를 따른다', () => {
    const rows = [
      { word: 'answered', lemma: 'answer' },
      { word: 'answering', lemma: 'answer' },
    ]
    expect(dedupe(rows)[0]!.word).toBe('answered')
  })

  it('대소문자가 달라도 같은 표제어로 본다', () => {
    const rows = [
      { word: 'Flushed', lemma: 'flush' },
      { word: 'flushing', lemma: 'Flush' },
    ]
    expect(dedupe(rows)).toHaveLength(1)
  })

  it('중복을 안 접으면 DB 가 배치를 통째로 거절한다 — 그래서 접는 것이지 취향이 아니다', () => {
    // Postgres: "ON CONFLICT DO UPDATE command cannot affect row a second time".
    // `ignoreDuplicates` 는 DB 안의 기존 행과의 충돌만 무시하고, 보내는 배열 안의 중복은 못 막는다.
    const rows = [
      { word: 'hunting', lemma: 'hunt' },
      { word: 'hunted', lemma: 'hunt' },
    ]
    const keys = rows.map((r) => headword(r).toLowerCase())
    expect(new Set(keys).size).toBeLessThan(keys.length) // 접기 전에는 중복이 있다
    expect(new Set(dedupe(rows).map((r) => headword(r).toLowerCase())).size).toBe(dedupe(rows).length)
  })
})
