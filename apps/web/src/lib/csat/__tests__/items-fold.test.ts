// apps/web/src/lib/csat/__tests__/items-fold.test.ts
//
// 문항 감사 판정을 고정한다.
//
// 이 판정이 틀리면 두 방향으로 해롭다. 느슨하면 반쯤 빈 문항이 「완전」으로 세어져 학습자
// 화면에 그대로 나가고, 빡빡하면 **고칠 수 없는 것**(정답표가 없어 정답 근거를 못 쓰는 문항)을
// 고치라고 시킨다. 뒤쪽이 더 나쁘다 — 관리자가 목록을 믿지 않게 되기 때문이다.

import { describe, expect, it } from 'vitest'

import { MIN_WHY, auditAnalysis, summarizeAudit, type RawAnalysis } from '../items-fold'

const META = {
  item_id: '2026-31',
  exam_id: '2026',
  exam_label: '2026학년도 수능',
  no: 31,
  type_id: 'R-BLANK',
  type_name: '빈칸 추론',
  points: 2,
  answer: 3,
}

const long = (n: number) => '근'.repeat(n)

function analysis(over: Partial<RawAnalysis> = {}): RawAnalysis {
  return {
    item_id: META.item_id,
    version: 1,
    answer_unknown: false,
    measured_ability: '빈칸 문장의 구조 표지를 읽어 근거 위치를 정한다',
    design_intent: '재진술 표지로 근거를 뒤에 둔다',
    answer_locus: { quote: 'in other words, the market rewards', reasoning: '재진술이 답을 지정한다' },
    choice_analysis: [
      { n: 1, how_to_reject: long(MIN_WHY) },
      { n: 2, how_to_reject: long(MIN_WHY) },
      { n: 3, why_correct: long(MIN_WHY) },
      { n: 4, how_to_reject: long(MIN_WHY) },
      { n: 5, how_to_reject: long(MIN_WHY) },
    ],
    solve_procedure: [{ step: '빈칸 문장의 첫 두세 낱말을 읽는다' }],
    required_vocab: ['reward'],
    time_budget_sec: 115,
    difficulty: { predicted: 0.5 },
    ...over,
  }
}

describe('auditAnalysis', () => {
  it('다 채운 문항은 빈 항목이 없다', () => {
    const r = auditAnalysis(META, analysis())
    expect(r.gaps).toEqual([])
    expect(r.why_correct_len).toBe(MIN_WHY)
    expect(r.distractors_explained).toBe(4)
    expect(r.distractors_total).toBe(4)
    expect(r.has_quote).toBe(true)
  })

  it('정답 선지를 답 번호로 찾는다 — 오답 총수가 4가 되어야 한다', () => {
    const r = auditAnalysis(META, analysis())
    expect(r.distractors_total).toBe(4)
  })

  // **정답표가 없는 문항에 정답 근거를 요구하지 않는다.** 추정 정답을 적으면 학습자를 반대로
  // 훈련시키므로 그 문항은 능력·절차·어휘만 쓰기로 한 것이 이 파이프라인의 규칙이다.
  // 여기서 부실로 세면 고칠 수 없는 것을 고치라고 시키게 된다.
  it('정답 미상 문항은 정답 근거·인용이 없어도 부실이 아니다', () => {
    const r = auditAnalysis(
      { ...META, answer: null },
      analysis({
        answer_unknown: true,
        answer_locus: null,
        choice_analysis: [
          { n: 1, how_to_reject: long(MIN_WHY) },
          { n: 2, how_to_reject: long(MIN_WHY) },
        ],
      }),
    )
    expect(r.answer_unknown).toBe(true)
    expect(r.gaps).not.toContain('정답 근거')
    expect(r.gaps).not.toContain('근거 인용')
  })

  it('짧은 정답 근거는 없는 것으로 본다 — 한 문장도 안 된다', () => {
    const r = auditAnalysis(
      META,
      analysis({ choice_analysis: [{ n: 3, why_correct: long(MIN_WHY - 1) }] }),
    )
    expect(r.gaps).toContain('정답 근거')
  })

  it('오답 배제가 하나라도 비면 잡는다 — 회차 집계로는 안 보이는 자리다', () => {
    const r = auditAnalysis(
      META,
      analysis({
        choice_analysis: [
          { n: 1, how_to_reject: long(MIN_WHY) },
          { n: 2, how_to_reject: '짧다' },
          { n: 3, why_correct: long(MIN_WHY) },
          { n: 4, how_to_reject: long(MIN_WHY) },
          { n: 5, how_to_reject: long(MIN_WHY) },
        ],
      }),
    )
    expect(r.distractors_explained).toBe(3)
    expect(r.gaps).toContain('오답 배제')
  })

  it('절차·어휘·시간이 비면 각각 이름을 남긴다', () => {
    const r = auditAnalysis(META, analysis({ solve_procedure: [], required_vocab: [], time_budget_sec: null }))
    expect(r.gaps).toEqual(expect.arrayContaining(['풀이 절차', '필수 어휘', '시간 예산']))
  })

  it('분석이 아예 없으면 「분석 없음」 하나로 말한다 — 항목별로 늘어놓지 않는다', () => {
    const r = auditAnalysis(META, null)
    expect(r.gaps).toEqual(['분석 없음'])
    expect(r.version).toBe(0)
  })
})

describe('summarizeAudit', () => {
  it('완전한 문항 수와 빈 항목 순위를 낸다', () => {
    const rows = [
      auditAnalysis(META, analysis()),
      auditAnalysis({ ...META, item_id: 'a' }, analysis({ required_vocab: [] })),
      auditAnalysis({ ...META, item_id: 'b' }, analysis({ required_vocab: [], solve_procedure: [] })),
      auditAnalysis({ ...META, item_id: 'c', answer: null }, analysis({ answer_unknown: true })),
    ]
    const s = summarizeAudit(rows)
    expect(s.items).toBe(4)
    expect(s.complete).toBe(2) // 첫 줄과 정답 미상 줄
    expect(s.answerUnknown).toBe(1)
    expect(s.gaps[0]).toEqual({ name: '필수 어휘', n: 2 })
  })
})
