// apps/web/src/lib/csat/__tests__/theater.test.ts
//
// 해설 극장이 조용히 틀리는 곳은 둘이다.
//   ① **왼쪽 차례와 오른쪽 블록이 갈라진다** — 큐가 가리키는 곳에 블록이 없으면 재생은
//      멀쩡히 도는데 화면은 아무 데도 켜지지 않는다(이 저장소가 여러 번 겪은 «조용한 어긋남»).
//   ② **없는 것을 있는 척한다** — 근거가 비었는데 「근거」 블록을 그리면 학습자가 빈 칸을 읽는다.
// 아래 검사는 그 둘을 잠근다.

import { describe, expect, it } from 'vitest'

import { examAxis } from '../browse-model'
import type { LectureStep } from '../lecture/types'
import {
  BLOCK_TINT,
  blockKeyForTarget,
  stepName,
  theaterBlocks,
  theaterClock,
  theaterMinutes,
  theaterSteps,
  theaterTimeline,
  type TheaterSource,
} from '../theater'

const cue = (order: number, role: LectureStep['role'], kind: 'analysis' | 'anchor', id: string, sec = 15): LectureStep => ({
  id: `X#1:${order}`,
  order,
  role,
  target: { kind, id },
  est_sec: sec,
})

const OUTLINE: LectureStep[] = [
  cue(1, 'intro', 'analysis', 'head'),
  cue(2, 'strategy', 'anchor', 'sentence:6'),
  cue(3, 'structure', 'analysis', 'map'),
  cue(4, 'evidence', 'analysis', 'answer'),
  cue(5, 'eliminate', 'analysis', 'reject:1'),
  cue(6, 'trap', 'anchor', 'sentence:6'),
  cue(7, 'vocab', 'analysis', 'vocab'),
  cue(8, 'wrapup', 'analysis', 'procedure'),
]

const FULL: TheaterSource = {
  exam_label: '2026학년도 수능',
  no: 34,
  type_name: '빈칸 추론',
  points: 3,
  time_budget_sec: 120,
  answer: 3,
  answer_unknown: false,
  measured_ability: '부정문 빈칸에서 완성문의 참·거짓을 판정하는 능력',
  design_intent: '지문의 센 낱말을 선지에 심어 두고 부정문임을 잊게 만든다',
  why_correct: '법은 합리적 존재가 스스로 고를 것을 금지하지 않는다',
  evidence_quote: 'would freely choose',
  evidence_reasoning: '여섯 번째 문장이 그 조건을 세운다',
  distractors: [
    { n: 1, trap: '반대 진술', why_tempting: '합리적이라는 낱말이 같다', how_to_reject: '제한은 인정하고 합리성만 부정한다' },
    { n: 2, trap: '주체 역전', why_tempting: null, how_to_reject: '수호자의 주어가 칸트다' },
  ],
  procedure: [{ step: '빈칸 문장의 부정어에 표시한다', on_fail: '문장을 끊어 읽는다' }, { step: '앞 원리 문장에 비춰 참·거짓을 본다' }],
  required_vocab: ['binding', 'benevolence'],
}

describe('theaterSteps — 왼쪽 차례', () => {
  it('큐 하나가 단계 하나다', () => {
    const steps = theaterSteps(OUTLINE)
    expect(steps).toHaveLength(OUTLINE.length)
    expect(steps.map((s) => s.index)).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
  })

  it('이름은 타깃에서만 짓는다 — 문장은 사람이 세는 번호(1부터), 오답은 동그라미 숫자', () => {
    expect(stepName({ kind: 'anchor', id: 'sentence:6' })).toBe('7번째 문장')
    expect(stepName({ kind: 'analysis', id: 'reject:1' })).toBe('오답 ① 지우기')
    expect(stepName({ kind: 'analysis', id: 'map' })).toBe('지문의 뼈대')
  })

  it('모르는 타깃은 지어내지 않고 키를 그대로 보여 준다', () => {
    expect(stepName({ kind: 'analysis', id: 'unknown-block' })).toBe('unknown-block')
  })

  it('소리는 역할에서 온다 — 근거는 긋고, 배제·함정은 짚고, 정리는 찍는다', () => {
    const sfx = Object.fromEntries(theaterSteps(OUTLINE).map((s) => [s.id, s.sfx]))
    expect(sfx['X#1:4']).toBe('mark')
    expect(sfx['X#1:5']).toBe('trap')
    expect(sfx['X#1:6']).toBe('trap')
    expect(sfx['X#1:8']).toBe('seal')
    expect(sfx['X#1:1']).toBe('step')
  })

  it('강의가 없으면 단계도 없다 — 빈 차례를 지어내지 않는다', () => {
    expect(theaterSteps([])).toEqual([])
  })

  it('길이는 분으로 올림하되 0분은 없다', () => {
    expect(theaterMinutes(OUTLINE)).toBe(2)
    expect(theaterMinutes([cue(1, 'intro', 'analysis', 'head', 5)])).toBe(1)
  })
})

describe('blockKeyForTarget — 차례와 블록을 잇는다', () => {
  const keys = theaterBlocks(FULL).map((b) => b.key)

  it('모든 analysis 큐가 실제로 있는 블록을 가리킨다', () => {
    for (const c of OUTLINE.filter((c) => c.target.kind === 'analysis')) {
      expect(blockKeyForTarget(`analysis:${c.target.id}`, keys), `큐 ${c.id}`).not.toBeNull()
    }
  })

  it('문장 앵커는 지도로 보낸다 — 블록이 없다고 차례가 끊기면 안 된다', () => {
    expect(blockKeyForTarget('anchor:sentence:6', keys)).toBe('analysis:map')
  })

  it('없는 블록을 가리키면 null 이다(화면이 그때는 아무것도 켜지 않는다)', () => {
    expect(blockKeyForTarget('analysis:reject:9', keys)).toBeNull()
  })
})

describe('theaterBlocks — 오른쪽 부가 정보', () => {
  it('있는 것만 그린다', () => {
    const kinds = theaterBlocks(FULL).map((b) => b.kind)
    expect(kinds).toEqual(['head', 'ability', 'intent', 'answer', 'reject', 'reject', 'procedure', 'vocab'])
  })

  it('비어 있는 층은 블록 자체가 없다 — 「준비 중」을 그리지 않는다', () => {
    const bare: TheaterSource = {
      ...FULL,
      measured_ability: null,
      design_intent: '   ',
      why_correct: null,
      evidence_reasoning: null,
      evidence_quote: null,
      distractors: [],
      procedure: [],
      required_vocab: [],
    }
    expect(theaterBlocks(bare).map((b) => b.kind)).toEqual(['head'])
  })

  it('정답표가 없는 회차는 답을 지목하지 않고 그 사실을 말한다', () => {
    const unknown = theaterBlocks({ ...FULL, answer: null, answer_unknown: true })
    const head = unknown[0]
    expect(head.chips.some((c) => c.text === '정답표 없음')).toBe(true)
    expect(head.chips.some((c) => c.text.startsWith('정답 '))).toBe(false)
    expect(head.body[0]).toContain('답을 지목하지 않습니다')
  })

  it('오답은 선지마다 한 블록이고, 함정 이름이 칩으로 나온다', () => {
    const rejects = theaterBlocks(FULL).filter((b) => b.kind === 'reject')
    expect(rejects.map((b) => b.key)).toEqual(['analysis:reject:1', 'analysis:reject:2'])
    expect(rejects[0].chips.map((c) => c.text)).toContain('반대 진술')
  })

  it('절차는 번호가 붙고 실패 갈래가 같은 줄에 남는다', () => {
    const procedure = theaterBlocks(FULL).find((b) => b.kind === 'procedure')!
    expect(procedure.body[0]).toBe('1. 빈칸 문장의 부정어에 표시한다 — 막히면 문장을 끊어 읽는다')
    expect(procedure.body[1]).toBe('2. 앞 원리 문장에 비춰 참·거짓을 본다')
  })

  it('본문은 분석 자료의 글자 그대로다 — 요약하거나 고쳐 쓰지 않는다', () => {
    const answer = theaterBlocks(FULL).find((b) => b.kind === 'answer')!
    expect(answer.body).toEqual([FULL.why_correct, FULL.evidence_reasoning])
    expect(answer.quote).toBe(FULL.evidence_quote)
  })
})

describe('examAxis — 회차 id 에서 종류와 학년도', () => {
  it('수능과 모의평가를 가른다', () => {
    expect(examAxis('2026')).toEqual({ kind: 'suneung', year: 2026, month: null })
    expect(examAxis('2014A')).toEqual({ kind: 'suneung', year: 2014, month: null })
    expect(examAxis('M2606')).toEqual({ kind: 'mock', year: 2026, month: 6 })
    expect(examAxis('M2709')).toEqual({ kind: 'mock', year: 2027, month: 9 })
  })
})

describe('theaterTimeline — 진행 띠', () => {
  it('구간 폭의 합이 100% 다 — 막대가 트랙을 정확히 채운다', () => {
    const line = theaterTimeline(theaterSteps(OUTLINE))
    expect(line.segments).toHaveLength(OUTLINE.length)
    expect(line.segments.reduce((sum, s) => sum + s.pct, 0)).toBeCloseTo(100, 6)
  })

  it('시작 초가 누적된다 — 앞 구간의 끝이 다음 구간의 시작이다', () => {
    const line = theaterTimeline(theaterSteps(OUTLINE))
    expect(line.segments[0].start).toBe(0)
    expect(line.segments[3].start).toBe(OUTLINE.slice(0, 3).reduce((sum, c) => sum + c.est_sec, 0))
    expect(line.total).toBe(OUTLINE.reduce((sum, c) => sum + c.est_sec, 0))
  })

  it('눈금은 처음과 끝을 포함해 다섯이다', () => {
    const line = theaterTimeline(theaterSteps(OUTLINE))
    expect(line.marks).toHaveLength(5)
    expect(line.marks[0]).toBe(0)
    expect(line.marks[4]).toBe(Math.round(line.total))
  })

  it('길이가 0초여도 막대가 사라지지 않는다 — 0 으로 나누지 않는다', () => {
    const line = theaterTimeline(theaterSteps([cue(1, 'intro', 'analysis', 'head', 0), cue(2, 'vocab', 'analysis', 'vocab', 0)]))
    expect(line.total).toBe(0)
    expect(line.segments.map((s) => s.pct)).toEqual([50, 50])
    expect(line.marks).toEqual([])
  })

  it('차례가 없으면 띠도 없다', () => {
    expect(theaterTimeline([])).toEqual({ total: 0, segments: [], marks: [] })
  })
})

describe('theaterClock — 길이 표기', () => {
  it('분과 초를 우리말로', () => {
    expect(theaterClock(0)).toBe('0초')
    expect(theaterClock(59.4)).toBe('59초')
    expect(theaterClock(120)).toBe('2분')
    expect(theaterClock(224)).toBe('3분 44초')
  })
})

describe('BLOCK_TINT — 블록 종류마다 고정 면 색', () => {
  it('모든 종류에 색이 있다 — 색 없는 카드가 생기지 않는다', () => {
    const kinds = theaterBlocks(FULL).map((b) => b.kind)
    for (const kind of new Set(kinds)) expect(BLOCK_TINT[kind], kind).toBeTruthy()
  })
})
