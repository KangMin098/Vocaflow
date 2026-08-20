// packages/library-pipeline/src/textbook/explain.test.ts
//
// 해설 생성 회귀. **여기서 지키려는 것은 "커버리지" 가 아니라 "거짓말을 안 하는 것"** 이다.
// 근거가 없으면 body 는 null 이어야 하고, 근거가 있으면 그 근거는 지문에 실제로 있어야 한다.

import { describe, expect, it } from 'vitest'
import { toCsatInsert, toCsatOrder } from './csat-format'
import {
  contentWords,
  evidenceFor,
  explainInsert,
  explainOrder,
  findConnective,
  findDemonstrative,
  findFirstMention,
  findPronoun,
  hasFinalConsonant,
  insertEvidenceBySlot,
  measureExplainCoverage,
  orderEvidenceByChoice,
} from './explain'

describe('단서 찾기', () => {
  it('연결어를 관계와 함께 찾는다', () => {
    expect(findConnective('However, the plan failed.')).toEqual({ cue: 'However', relation: 'contrast' })
    expect(findConnective('Therefore we stopped.')).toEqual({ cue: 'Therefore', relation: 'result' })
    expect(findConnective('Then the rain came.')).toEqual({ cue: 'Then', relation: 'sequence' })
    expect(findConnective('For example, birds migrate.')).toEqual({ cue: 'For example', relation: 'example' })
  })

  it('낱말 경계를 지킨다 — and 가 android 를 잡으면 안 된다', () => {
    expect(findConnective('Android phones outsold the rest.')).toBeNull()
    expect(findConnective('Sold out by noon.')).toBeNull()
  })

  it('여러 낱말짜리를 한 낱말짜리보다 먼저 본다', () => {
    // `in addition` 이 걸려야 한다. 목록 순서가 뒤집히면 여기서 잡힌다.
    expect(findConnective('In addition, costs rose.')?.cue).toBe('In addition')
  })

  it('따옴표로 시작해도 찾고, 원문 대소문자를 돌려준다', () => {
    expect(findConnective('"But nobody moved," he said.')).toEqual({ cue: 'But', relation: 'contrast' })
  })

  it('지시어와 그 뒤 명사를 묶는다', () => {
    expect(findDemonstrative('This finding changed the field.')).toEqual({ cue: 'This', noun: 'finding' })
    // 뒤가 기능어면 명사를 특정하지 않는다.
    expect(findDemonstrative('This is important.')).toEqual({ cue: 'This', noun: null })
  })

  it('대명사를 찾는다', () => {
    expect(findPronoun('It grew quickly.')).toBe('It')
    expect(findPronoun("They're gone.")).toBe('They')
    expect(findPronoun('Itemized bills arrived.')).toBeNull()
  })

  it('한정사 전환은 a → the 방향으로만 잡는다', () => {
    const found = findFirstMention('Engineers built a satellite last year.', 'The satellite now orbits Mars.')
    // 인용은 지문에 있는 그대로 — 대문자 `The` 를 소문자로 바꿔 내보내지 않는다.
    expect(found).toEqual({ cue: 'The satellite', antecedent: 'a satellite' })
    // 반대 방향은 근거가 아니다.
    expect(findFirstMention('The satellite now orbits Mars.', 'Engineers built a satellite.')).toBeNull()
  })

  it('내용어에서 기능어를 뺀다', () => {
    const w = contentWords('The rockets were launched from a coastal facility.')
    expect(w.has('rockets')).toBe(true)
    expect(w.has('rocket')).toBe(true) // 단복수 동일시
    expect(w.has('coastal')).toBe(true)
    expect(w.has('were')).toBe(false)
    expect(w.has('the')).toBe(false)
  })
})

describe('근거 인정 규칙', () => {
  it('단서만 있고 받을 것이 앞에 없으면 지시어를 근거로 삼지 않는다', () => {
    const ev = evidenceFor('This telescope is enormous.', 'Rain fell all week.', '앞', '뒤')
    expect(ev.some((e) => e.kind === 'demonstrative')).toBe(false)
  })

  it('받을 말이 앞에 있으면 지시어가 근거가 된다', () => {
    const ev = evidenceFor('This telescope is enormous.', 'They installed a telescope.', '앞', '뒤')
    const dem = ev.find((e) => e.kind === 'demonstrative')
    expect(dem?.antecedent).toBe('telescope')
  })

  it('강한 근거가 있으면 어휘 반복은 쓰지 않는다', () => {
    const ev = evidenceFor('However, the telescope failed.', 'They installed a telescope.', '앞', '뒤')
    expect(ev.some((e) => e.kind === 'lexical_repeat')).toBe(false)
    expect(ev[0]?.kind).toBe('first_mention')
  })

  it('아무 단서도 없으면 근거가 비어 있다 — 지어내지 않는다', () => {
    expect(evidenceFor('Wolves howled.', 'Bicycles rusted.', '앞', '뒤')).toEqual([])
  })

  it('근거의 cue 는 지문에 그대로 있는 문자열이다', () => {
    const sentence = 'However, the telescope failed.'
    const before = 'They installed a telescope.'
    for (const e of evidenceFor(sentence, before, '앞', '뒤')) {
      expect(`${sentence} ${before}`.toLowerCase()).toContain(e.cue.toLowerCase())
    }
  })
})

describe('순서 문항 해설', () => {
  // 이음매마다 **앞 덩어리에서만** 받을 수 있는 사슬을 심었다. 배열이 바뀌면 앞 단위가
  // 바뀌므로 근거도 무너진다 — 그게 인접 규칙이 하는 일이다.
  const original = [
    'Two students rented a workshop over a bicycle repair shop.',
    'The workshop had no heating during their first winter.',
    'They welded a gyroscope out of scrap aluminium and fishing line.',
    'The gyroscope steadied every photograph taken from the balloon.',
    'Later they mounted a shutter beside it.',
    'The shutter opened for exactly eleven seconds.',
  ]
  const sourceOrder = [3, 0, 5, 1, 4, 2]
  // presented[k] = original[sourceOrder[k]] — DCP 의 저장 계약.
  const presented = sourceOrder.map((i) => original[i]!)

  it('정답 배열의 이음매를 지문 근거로 설명한다', () => {
    const item = toCsatOrder(presented, sourceOrder)
    expect(item).not.toBeNull()
    const ex = explainOrder(item!)
    expect(ex.answer).toBe(item!.answer)
    expect(ex.evidence.length).toBeGreaterThan(0)
    // 해설이 말하는 배열은 정답 답지와 같아야 한다.
    const seq = item!.choices[item!.answer - 1]!.map((l) => `(${l})`).join('-')
    expect(ex.body).toContain(seq)
  })

  it('오답 답지보다 근거가 많을 때만 해설을 쓴다', () => {
    const item = toCsatOrder(presented, sourceOrder)!
    const byChoice = orderEvidenceByChoice(item)
    const mine = byChoice[item.answer - 1]!.length
    for (let i = 0; i < byChoice.length; i++) {
      if (i === item.answer - 1) continue
      expect(byChoice[i]!.length).toBeLessThan(mine)
    }
  })

  it('멱등하다 — 같은 문항이면 같은 해설', () => {
    const item = toCsatOrder(presented, sourceOrder)!
    expect(explainOrder(item)).toEqual(explainOrder(item))
  })

  it('근거를 하나도 못 찾으면 body 가 null 이다', () => {
    const unrelated = [
      'Wolves howled.',
      'Bicycles rusted.',
      'Kettles whistled.',
      'Lanterns flickered.',
      'Pumpkins ripened.',
      'Anchors dragged.',
    ]
    const so = [0, 1, 2, 3, 4, 5]
    const item = toCsatOrder(so.map((i) => unrelated[i]!), so)!
    const ex = explainOrder(item)
    expect(ex.evidence).toEqual([])
    expect(ex.body).toBeNull()
  })

  it('오답과 동점이면 해설을 쓰지 않는다 — 가리지 못한 것이다', () => {
    // 모든 덩어리가 같은 낱말을 반복해 어느 배열에서나 어휘 사슬이 걸린다.
    const flat = [
      'The harbor filled with fishing boats before dawn.',
      'The harbor smelled of diesel and salt.',
      'The harbor emptied again by midmorning.',
      'The harbor kept its lights on through the fog.',
      'The harbor charged nothing for the first hour.',
      'The harbor closed for repairs in November.',
    ]
    const so = [0, 1, 2, 3, 4, 5]
    const item = toCsatOrder(so.map((i) => flat[i]!), so)!
    expect(explainOrder(item).body).toBeNull()
  })
})

describe('삽입 문항 해설', () => {
  const body = [
    'Researchers tracked a herd of elk across the valley for three winters.',
    'The animals moved higher as the snow retreated each spring.',
    'Warm air arrived earlier and created a mismatch with the plants.',
    'The mismatch left calves without enough food at birth.',
    'Managers are now testing new grazing rules in two counties.',
  ]

  it('앞과 뒤 두 이음매를 본다', () => {
    // 넣을 문장이 3번째 문장의 "mismatch" 를 받고, 4번째 문장이 넣을 문장을 다시 받는다.
    const item = toCsatInsert(body, 'This mismatch between warmth and plants widened each season.', 3)
    expect(item).not.toBeNull()
    const ex = explainInsert(item!)
    expect(ex.answer).toBe(item!.answer)
    expect(ex.evidence.length).toBeGreaterThan(0)
    expect(ex.body).toContain('정답')
    // 정답 자리가 유일 최다여야 한다.
    const bySlot = insertEvidenceBySlot(item!)
    const mine = bySlot[item!.answer - 1]!.length
    for (let i = 0; i < bySlot.length; i++) {
      if (i !== item!.answer - 1) expect(bySlot[i]!.length).toBeLessThan(mine)
    }
  })

  it('해설의 정답 번호는 문항의 정답과 같다', () => {
    for (let pos = 1; pos <= body.length; pos++) {
      const item = toCsatInsert(body, 'The herd then split into two groups.', pos)
      if (!item) continue
      expect(explainInsert(item).answer).toBe(item.answer)
    }
  })

  it('근거가 없으면 body 가 null 이다', () => {
    const flat = ['Wolves howled.', 'Bicycles rusted.', 'Kettles whistled.', 'Lanterns flickered.', 'Pumpkins ripened.']
    const item = toCsatInsert(flat, 'Anchors dragged.', 2)!
    expect(explainInsert(item).body).toBeNull()
  })
})

describe('조사 — 교재에 그대로 인쇄된다', () => {
  it('한국어로 옮겼을 때 받침으로 끝나는 낱말을 가린다', () => {
    for (const w of ['animal', 'chicken', 'system', 'book', 'building', 'music']) {
      expect(hasFinalConsonant(w), w).toBe(true)
    }
    for (const w of ['mother', 'study', 'device', 'department', 'data', 'chess']) {
      expect(hasFinalConsonant(w), w).toBe(false)
    }
  })

  it('해설 문장에 "낱말 를" 같은 어긋난 조사가 없다', () => {
    const before = 'They welded a gyroscope beside the animal enclosure.'
    const ev = evidenceFor('The animal enclosure held two gyroscope mounts.', before, '앞', '뒤')
    expect(ev.length).toBeGreaterThan(0)
    for (const e of ev) {
      expect(e.ko).not.toMatch(/[a-zA-Z]"\s*(를|는|가)\b/)
      expect(e.ko).not.toMatch(/(animal|chicken|system|book)"(를|는|가)/)
    }
  })
})

describe('커버리지 계산', () => {
  it('분모는 문항 전체다 — 못 쓴 것을 빼지 않는다', () => {
    const c = measureExplainCoverage([
      { answer: 1, evidence: [{ kind: 'connective', cue: 'But', antecedent: null, from: 'a', at: 'b', ko: 'x' }], body: 'x' },
      { answer: 2, evidence: [], body: null },
    ])
    expect(c.total).toBe(2)
    expect(c.explained).toBe(1)
    expect(c.ratio).toBe(0.5)
    expect(c.byKind.connective).toBe(1)
  })

  it('빈 입력에서 나누기 0 이 나지 않는다', () => {
    expect(measureExplainCoverage([]).ratio).toBe(0)
  })
})
