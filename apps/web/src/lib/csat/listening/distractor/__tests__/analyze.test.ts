// apps/web/src/lib/csat/listening/distractor/__tests__/analyze.test.ts
import { describe, expect, it } from 'vitest'

import { validateListeningItem } from '../../validate'
import { analyzeChoice, analyzeItem, expectedPatterns, pedagogyTypeOf } from '../analyze'
import { choiceWords, compareJudgment, judgmentComplete, segmentsFromCuts } from '../judgment'
import { normalizeWord, tokenize } from '../normalize'
import { loadRaw, todoItem } from './fixture'

describe('normalize', () => {
  it('굴절·따옴표·수 낱말·숫자 토큰을 같은 키로', () => {
    expect(normalizeWord('messages')).toBe(normalizeWord('message'))
    expect(normalizeWord('wrapping')).toBe('wrapp')
    expect(normalizeWord('three')).toBe('3')
    expect(normalizeWord('17th')).toBe('17')
    expect(normalizeWord('3일')).toBe('3')
    expect(normalizeWord('Expo’s')).toBe('expo')
    expect(tokenize('I’ll do it').map((t) => t.raw)).toEqual(['I’ll', 'do', 'it'])
  })
})

describe('analyze — 2023#5 실제 대본 + 테스트용 합성 선택지', () => {
  const item = todoItem()

  it('픽스처는 계약 검증기를 통과한다', () => {
    expect(validateListeningItem(item)).toEqual([])
  })

  it('들은 구와 발화 자리를 찾는다', () => {
    const a = analyzeChoice(item, 2)
    expect(a.phrases.map((p) => p.text)).toContain('contact the band')
    const p = a.phrases.find((x) => x.text === 'contact the band')!
    const u = item.utterances.find((x) => x.id === p.at.utteranceId)!
    expect(u.text.slice(p.at.charStart, p.at.charEnd)).toBe('contact the band')
    expect(a.heardRatio).toBe(1)
  })

  it('들리지 않은 낱말을 남긴다', () => {
    const a = analyzeChoice(item, 1)
    expect(a.unheardWords).toEqual(['send']) // 대본은 sent — 글자 겹침은 시제 차이를 들리지 않음으로 남긴다
    const e = analyzeChoice(item, 5)
    expect(e.unheardWords).toEqual(['hire']) // new · chef 는 대본에 있다
    expect(e.heardRatio).toBeGreaterThan(0) // chef 는 들렸다
  })

  it('함정 유형을 분류한다', () => {
    const [c1, c2, c3, c4, c5] = analyzeItem(item)
    expect(c1.pattern).toBe('timing-trap') // already sent
    expect(c1.conflicts[0].text).toBe('I already sent text messages.')
    expect(c2.pattern).toBe('role-reversal')
    expect(c3.pattern).toBeNull()
    expect(c3.isAnswer).toBe(true)
    expect(c4.pattern).toBe('partial-match')
    expect(c5.pattern).toBe('mentioned-not-asked')
    expect(c5.unasked).toBe('mentioned-not-asked')
  })

  it('pedagogy distractorPatterns 와 결속한다', () => {
    expect(pedagogyTypeOf(item)).toBe('L-TODO')
    expect(expectedPatterns(item)).toEqual(['role-reversal', 'timing-trap', 'mentioned-not-asked'])
    expect(analyzeChoice(item, 2).patternExpected).toBe(true)
    expect(analyzeChoice(item, 4).patternExpected).toBe(false)
    expect(pedagogyTypeOf({ typeId: 'L-RESPONSE', itemNo: 13 })).toBe('L-RESPONSE-LONG')
  })

  it('수치 함정 — 2023#9 실제 대본(three days)과 합성 선지', () => {
    const raw = loadRaw('2023', 9)
    const t = raw.turns[0].text
    const needle = 'the expo will run for three days'
    const s = t.indexOf(needle)
    const base = todoItem()
    const it2 = {
      ...base,
      itemNo: 9,
      typeId: 'L-ANNOUNCE' as const,
      utterances: [{ id: 'u1', speaker: 'W', text: t }],
      choices: ['5일 동안 진행된다.', 'a', 'b', 'c', 'd'],
      evidence: [{ id: 'e1', utteranceId: 'u1', charStart: s, charEnd: s + needle.length, role: 'contrast' as const, refutesChoices: [1 as const] }],
      rationales: [{ choice: 1 as const, verdict: 'contradicted' as const, evidenceIds: ['e1'] }],
    }
    const a = analyzeChoice(it2, 1)
    expect(a.pattern).toBe('numeric-calc-trap')
  })

  it('결정적이다', () => {
    expect(JSON.stringify(analyzeItem(item))).toBe(JSON.stringify(analyzeItem(todoItem())))
  })
})

describe('judgment', () => {
  const item = todoItem()

  it('자르기 → 조각 → 비교', () => {
    const words = choiceWords('hire a new chef')
    expect(words).toHaveLength(4)
    let segs = segmentsFromCuts(4, [1])
    expect(segs.map((s) => [s.wordStart, s.wordEnd])).toEqual([[0, 1], [2, 3]])
    segs = segs.map((s, i) => (i === 0 ? { ...s, label: 'unheard' } : { ...s, label: 'heard', utteranceId: 'u6' }))
    const j = { choice: 5 as const, segments: segs }
    expect(judgmentComplete(j)).toBe(true)
    const cmp = compareJudgment(j, analyzeChoice(item, 5))
    expect(cmp[0].labelAgrees).toBe(true)
    expect(cmp[1].text).toBe('new chef')
    expect(cmp[1].labelAgrees).toBe(true)
    expect(cmp[1].linkAgrees).toBe(true)
  })

  it('들은 조각에 발화가 없으면 미완성', () => {
    const segs = segmentsFromCuts(3, []).map((s) => ({ ...s, label: 'heard' as const }))
    expect(judgmentComplete({ choice: 3, segments: segs })).toBe(false)
  })

  it('다시 잘라도 같은 조각의 표시는 유지', () => {
    const a = segmentsFromCuts(4, [1]).map((s) => ({ ...s, label: 'heard' as const }))
    const b = segmentsFromCuts(4, [1, 2], a)
    expect(b[0].label).toBe('heard')
    expect(b[1].label).toBeNull()
  })
})
