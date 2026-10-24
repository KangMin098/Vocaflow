// apps/web/src/lib/csat/judgment/__tests__/r-mood.test.ts
// R-MOOD 판단 모델 — 실제 픽스처 2문항(H2609G2#19 · H2609G1#19)으로 칸 나누기·신호 합계·선지 두 칸 비교·공개 뒤 전환점 대조를 본다.
import { describe, expect, it } from 'vitest'
import { leakedAnswerKeys } from '../evidence'
import { itemsOf, revealOf } from '../fixtures'
import { compareChoices, contrastTurn, initialMood, parseChoice, revealTurnUnits, segment, summarize, warningsOf, type MoodState, type Signal } from '../r-mood'

const [g2, g1] = itemsOf('R-MOOD')
const sig = (polarity: '+' | '-', kind: Signal['kind'] = 'body', strength: 1 | 2 = 2): Signal => ({ kind, polarity, strength })

/** G2: 4·6·7 부정(신체·행동), 9 전환, 13 감정어 + 15 신체 긍정 */
const g2State = (): MoodState => ({
  turn: 'u9',
  signals: { u4: sig('-', 'action', 1), u6: sig('-'), u7: sig('-'), u13: sig('+', 'word'), u15: sig('+') },
  wordPolarity: {},
})

describe('R-MOOD 실제 픽스처', () => {
  it('두 문항이 있고 선지는 모두 A → B 두 칸으로 갈린다', () => {
    expect(g2.id).toBe('H2609G2#19')
    expect(g1.id).toBe('H2609G1#19')
    for (const it of [g2, g1]) for (const [i, c] of it.choices.entries()) {
      const p = parseChoice(c, i + 1)
      expect(p.shape).toBe('change')
    }
    expect(parseChoice(g2.choices[0], 1)).toMatchObject({ before: 'disappointed', after: 'delighted' })
  })

  it('화살표 없는 선지는 칸을 지어내지 않고 단일형으로 둔다', () => {
    expect(parseChoice('mysterious and frightening', 5)).toMatchObject({ shape: 'single', word: 'mysterious and frightening' })
  })

  it('전환점이 칸을 가르고 전환점 문장은 어느 칸에도 들지 않는다', () => {
    const seg = segment(g2.units, 'u9')
    expect(seg.turnN).toBe(9)
    expect(seg.before).toEqual(['u1', 'u2', 'u3', 'u4', 'u5', 'u6', 'u7', 'u8'])
    expect(seg.after).toEqual(['u10', 'u11', 'u12', 'u13', 'u14', 'u15'])
    expect(segment(g2.units, null).turnN).toBeNull()
    expect(segment(g2.units, 'u999').turnN).toBeNull()
  })

  it('칸 합계는 학습자 신호만 모은다', () => {
    const st = g2State()
    const seg = segment(g2.units, st.turn)
    expect(summarize(st, seg.before)).toMatchObject({ plus: 0, minus: 5, tone: '-' })
    expect(summarize(st, seg.after)).toMatchObject({ plus: 4, minus: 0, tone: '+' })
  })

  it('선지 두 칸 비교 — 어느 칸이 어긋나는지 칸 단위로 가린다(④ bored→thrilled 는 앞 칸만 어긋남)', () => {
    const st = { ...g2State(), wordPolarity: { '1:before': '-', '1:after': '+', '4:before': '+', '4:after': '+', '5:before': '+', '5:after': '-' } as MoodState['wordPolarity'] }
    const cmp = compareChoices(g2.units, g2.choices, st)
    expect(cmp[0].conflicts).toEqual([])
    expect(cmp[3].conflicts).toEqual(['before'])
    expect(cmp[4].conflicts).toEqual(['before', 'after'])
    expect(cmp[1].before).toBe('unlabelled')
  })

  it('전환점 없이는 비교하지 않는다(모든 신호를 한 칸으로 섞지 않음)', () => {
    const st = { ...g2State(), turn: null, wordPolarity: { '1:before': '-' } as MoodState['wordPolarity'] }
    expect(compareChoices(g2.units, g2.choices, st)[0].before).toBe('no-turn')
    expect(warningsOf(g2.units, st)).toEqual([{ code: 'no-turn' }])
  })

  it('실패 조건: 감정어 하나만으로 칸을 받치면 경고, 신체 신호가 더해지면 해제', () => {
    const only: MoodState = { turn: 'u9', signals: { u7: sig('-'), u13: sig('+', 'word') }, wordPolarity: {} }
    expect(warningsOf(g2.units, only)).toContainEqual({ code: 'single-word', side: 'after' })
    const more = { ...only, signals: { ...only.signals, u15: sig('+') } }
    expect(warningsOf(g2.units, more).some((w) => w.code === 'single-word')).toBe(false)
  })

  it('실패 조건: 전환점을 너무 뒤에 두면 앞 신호가 뒤 칸에 섞이지 않고 앞 칸이 +·− 혼합으로 드러난다', () => {
    const late = { ...g2State(), turn: 'u14' }
    const w = warningsOf(g2.units, late)
    expect(w).toContainEqual({ code: 'mixed', side: 'before' })
    // 전환점 문장에 찍은 신호는 비교에서 빠진다고 알린다
    expect(warningsOf(g2.units, { ...g2State(), signals: { ...g2State().signals, u9: sig('+', 'action') } })).toContainEqual({ code: 'turn-signal', unitId: 'u9' })
  })

  it('G1(감정어 없이 신체 묘사만)도 같은 구조로 비교된다 — ⑤ thrilled→upset 은 두 칸 모두 어긋남', () => {
    const st: MoodState = { turn: 'u5', signals: { u2: sig('-'), u3: sig('-'), u8: sig('+', 'action', 1), u9: sig('+'), u10: sig('+') }, wordPolarity: { '5:before': '+', '5:after': '-', '1:before': '-', '1:after': '+' } }
    const cmp = compareChoices(g1.units, g1.choices, st)
    expect(cmp[0].conflicts).toEqual([])
    expect(cmp[4].conflicts).toEqual(['before', 'after'])
    expect(warningsOf(g1.units, st)).toEqual([])
  })

  it('공개 전 모델 출력에는 정답·판정이 없다', () => {
    const out = { cmp: compareChoices(g2.units, g2.choices, g2State()), w: warningsOf(g2.units, g2State()), init: initialMood() }
    expect(leakedAnswerKeys(out)).toEqual([])
    expect(JSON.stringify(out)).not.toMatch(/correct|distractor/)
  })

  it('공개 뒤: 해설 전환 표지와 학습자 전환점 대조(G2 → 9번, G1 → 5·6번)', async () => {
    const r2 = await revealOf('R-MOOD', g2.id)
    expect(revealTurnUnits(r2, g2.units)).toEqual(['u9'])
    const c = contrastTurn(g2.units, g2State(), r2)
    expect(c).toMatchObject({ learnerN: 9, revealTurnN: [9], agree: true, evidenceAtTurn: [9] })
    expect(c.evidenceBefore).toEqual([4, 6, 7])
    expect(c.evidenceAfter).toEqual([13, 15])
    expect(contrastTurn(g2.units, { ...g2State(), turn: 'u3' }, r2).agree).toBe(false)
    expect(contrastTurn(g2.units, initialMood(), r2)).toMatchObject({ learnerN: null, agree: null, evidenceBefore: [] })

    const r1 = await revealOf('R-MOOD', g1.id)
    expect(revealTurnUnits(r1, g1.units)).toEqual(['u5', 'u6'])
    expect(contrastTurn(g1.units, { ...initialMood(), turn: 'u6' }, r1).agree).toBe(true)
  })

  it('자료 없음: 빈 원문이면 칸도 경고 외 결과도 없다', () => {
    expect(segment([], 'u1').turnN).toBeNull()
    expect(compareChoices([], ['a → b'], initialMood())[0].before).toBe('no-turn')
  })
})
