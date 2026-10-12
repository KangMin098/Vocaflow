// apps/web/src/lib/csat/lecture/__tests__/schema-v3.test.ts
//
// 강의 schema3(v3 일곱 장면) — schemaVersion 없음은 legacy · 3 은 v3 · 그 밖은 거부. v3 는 장면 순서 · 장면별 역할 · 주대상을 본다.
// legacy 규칙(ROLE_ORDER 등)은 그대로다 — 의미(vocab) 큐를 앞으로 옮긴 legacy 대본은 여전히 거부된다.
import { describe, expect, it } from 'vitest'

import { lectureTargets, v3Targets } from '../targets'
import type { Lecture, LectureCueV3, LectureV3 } from '../types'
import { validateLecture, type ValidateContext } from '../validate'

const v3data = {
  meanings: [{ id: 'm1' }, { id: 'm2' }],
  choices: [1, 2, 3, 4, 5].map((n) => ({ n })),
  design: { claims: [{}, {}] },
}
const base = lectureTargets({ answer: 3, answer_unknown: false, has_ability: true, has_intent: true, distractors: [1, 2, 4, 5], procedure_len: 1, vocab_len: 1, skeleton: { sentences: 7, placedAnchorIds: ['answer'] } })
const ctx: ValidateContext = {
  targets: { ...base, v3: v3Targets(v3data) },
  answer: 3,
  wrongChoices: [1, 2, 4, 5],
  hasTrapLabels: false,
  hasVocab: true,
  analysisTexts: [],
  sourceTexts: [],
}

const ko = (text: string) => [{ lang: 'ko-KR' as const, text }]
const cue = (order: number, scene: LectureCueV3['scene'], role: LectureCueV3['role'], id: string, kind: 'v3' | 'anchor' | 'analysis' = 'v3'): LectureCueV3 => ({
  id: `c${order}`,
  order,
  scene,
  role,
  target: { kind, id },
  segments: ko('여러분, 여기 이 표현을 보세요. 이 조건이 판단을 가릅니다. 천천히 다시 확인해 봅시다. 근거가 어디에 있는지 짚어 봅시다.'),
  est_sec: 0,
  pause_after_ms: 500,
})
const goodCues = (): LectureCueV3[] => [
  cue(1, 'task', 'task', 'task'),
  cue(2, 'meaning', 'vocab', 'meaning:m1'),
  cue(3, 'meaning', 'meaning', 'meaning:m2'),
  cue(4, 'judgment', 'judgment', 'choice:3'),
  cue(5, 'judgment', 'judgment', 'choice:2'),
  cue(6, 'judgment', 'judgment', 'choice:4'),
  cue(7, 'design', 'design', 'claim:0'),
  cue(8, 'explain', 'explain', 'explain'),
]
const lec = (cues: LectureCueV3[], extra: Partial<LectureV3> = {}): LectureV3 => ({
  item_id: '2026#34',
  schemaVersion: 3,
  version: 1,
  binding: { analysis_version: 5, units_hash: 'abc' },
  total_sec_est: 0,
  generated_by: 'test',
  rubric_score: 0,
  cues,
  ...extra,
})
const codes = (l: Lecture | LectureV3) => validateLecture(l, ctx).issues.map((i) => i.code)

describe('강의 schema 분기', () => {
  it('모르는 schemaVersion 은 거부한다', () => {
    const r = validateLecture({ ...lec(goodCues()), schemaVersion: 7 } as unknown as LectureV3, ctx)
    expect(r.ok).toBe(false)
    expect(r.issues.map((i) => i.code)).toEqual(['schema'])
  })

  it('schemaVersion 없는 강의는 legacy 규칙 — 의미(vocab) 큐를 앞으로 옮기면 ROLE_ORDER 가 거부한다', () => {
    const legacy = {
      item_id: '2026#34',
      version: 1,
      total_sec_est: 0,
      generated_by: 't',
      rubric_score: 0,
      cues: [
        { id: 'a', order: 1, role: 'intro', target: { kind: 'analysis', id: 'head' }, segments: ko('여러분 여기 보세요.'), est_sec: 0, pause_after_ms: 500 },
        { id: 'b', order: 2, role: 'vocab', target: { kind: 'analysis', id: 'vocab' }, segments: ko('여기 보세요.'), est_sec: 0, pause_after_ms: 500 },
        { id: 'c', order: 3, role: 'structure', target: { kind: 'analysis', id: 'map' }, segments: ko('여기 보세요.'), est_sec: 0, pause_after_ms: 500 },
      ],
    } as Lecture
    expect(codes(legacy)).toContain('role-order')
  })
})

describe('schema3 구조 검사', () => {
  it('구조 오류가 없다(길이 · 인용 등 낭독 검사는 legacy 와 같은 함수)', () => {
    const structural = ['schema', 'binding', 'order', 'dup-id', 'scene', 'scene-order', 'scene-role', 'target', 'scene-target', 'related', 'missing-scene']
    expect(codes(lec(goodCues())).filter((c) => structural.includes(c))).toEqual([])
  })

  it('장면 순서가 거꾸로면 거부(데이터 없는 장면 생략은 허용)', () => {
    const cs = goodCues()
    ;[cs[3], cs[6]] = [cs[6], cs[3]]
    cs.forEach((c, i) => (c.order = i + 1))
    expect(codes(lec(cs))).toContain('scene-order')
  })

  it('장면에 허용되지 않은 역할 · 장면에 맞지 않는 주대상 · 없는 타깃을 거부', () => {
    const a = goodCues()
    a[3] = { ...a[3], role: 'design' }
    expect(codes(lec(a))).toContain('scene-role')
    const b = goodCues()
    b[3] = { ...b[3], target: { kind: 'v3', id: 'meaning:m1' } }
    expect(codes(lec(b))).toContain('scene-target')
    const c = goodCues()
    c[3] = { ...c[3], target: { kind: 'v3', id: 'choice:9' } }
    expect(codes(lec(c))).toContain('target')
  })

  it('평가 과제 · 원문 의미 · 문항 성립 장면이 없으면 ready 아님 · 결속이 없으면 거부', () => {
    expect(codes(lec(goodCues().filter((c) => c.scene !== 'meaning')))).toContain('missing-scene')
    expect(codes(lec(goodCues(), { binding: undefined as unknown as LectureV3['binding'] }))).toContain('binding')
  })

  it('비교 · 원리 데이터가 없으면 그 타깃도 없다 — 가짜 비교 큐를 막는다', () => {
    const cs = goodCues()
    cs[7] = { ...cs[7], scene: 'compare', role: 'compare', target: { kind: 'v3', id: 'compare' } }
    expect(codes(lec(cs))).toContain('target')
  })
})
