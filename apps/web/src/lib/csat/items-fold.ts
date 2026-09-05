// apps/web/src/lib/csat/items-fold.ts
//
// 문항 분석 하나를 **감사 한 줄**로 접는 순수 함수.
//
// 왜 관리자 화면에 문항 목록이 필요한가: 콘솔은 지금까지 「몇 문항 됐나」만 셌다. 그런데
// 802문항이 전부 검수를 통과했다는 것이 **전부 잘 쓰였다는 뜻은 아니다** — 3인 검수는 사람이
// 읽고 도장을 찍는 일이라, 근거 인용이 빠졌거나 오답 4지 중 둘만 설명된 문항이 통과할 수 있다.
// 그런 문항은 학습자 화면에서 「준비 중」도 아니고 「설명 있음」도 아닌 **반쯤 빈 화면**이 된다.
//
// 그래서 여기서 재는 것은 통과 여부가 아니라 **서술이 실제로 채워졌는가**다.
//
// ⚠️ 평가원 지문 원문은 이 파일에 들어오지 않는다. 접는 것은 분석(우리 저작물)과
//    그 안의 짧은 인용까지다.

/** 선지 하나에 대한 분석 (DB jsonb) */
export interface RawChoice {
  n: number
  verdict?: string
  trap?: string | null
  why_correct?: string | null
  why_tempting?: string | null
  how_to_reject?: string | null
}

export interface RawAnalysis {
  item_id: string
  version: number
  answer_unknown: boolean | null
  measured_ability: string | null
  design_intent: string | null
  answer_locus: { quote?: string; reasoning?: string } | null
  choice_analysis: RawChoice[] | null
  solve_procedure: { step: string; on_fail?: string }[] | null
  required_vocab: string[] | null
  time_budget_sec: number | null
  difficulty: { predicted?: number; drivers?: string[] } | null
}

/** 근거 서술이 「있다」고 치는 최소 길이 — 이보다 짧으면 한 문장도 안 된다 */
export const MIN_WHY = 40

export interface CsatItemAudit {
  item_id: string
  exam_id: string
  exam_label: string
  no: number
  type_id: string | null
  type_name: string | null
  points: number | null
  answer: number | null
  version: number
  /** 평가원 정답표가 없는 문항 — 정답 근거를 쓸 수 없으므로 부실로 세면 안 된다 */
  answer_unknown: boolean
  /** 정답 선지의 「왜 이것인가」 길이 (0이면 없다) */
  why_correct_len: number
  /** 지문에서 그대로 옮긴 근거 인용이 있나 */
  has_quote: boolean
  /** 배제 근거가 적힌 오답 수 / 오답 총수 */
  distractors_explained: number
  distractors_total: number
  procedure_steps: number
  vocab: number
  time_budget_sec: number | null
  /** 위 항목 중 비어 있는 것들의 이름 — 비어 있으면 완전하다 */
  gaps: string[]
}

/**
 * 한 문항의 분석이 학습자에게 내보낼 만큼 채워졌는지 판정한다.
 *
 * 정답표가 없는 문항(`answer_unknown`)에는 **정답 근거를 요구하지 않는다.** 추정 정답을 적으면
 * 학습자를 반대로 훈련시키므로, 그 문항은 능력·절차·어휘만 쓰기로 한 것이 이 파이프라인의 규칙이다.
 * 그것을 부실로 세면 고칠 수 없는 것을 고치라고 시키게 된다.
 */
export function auditAnalysis(
  meta: {
    item_id: string
    exam_id: string
    exam_label: string
    no: number
    type_id: string | null
    type_name: string | null
    points: number | null
    answer: number | null
  },
  a: RawAnalysis | null,
): CsatItemAudit {
  const choices = a?.choice_analysis ?? []
  const answerUnknown = Boolean(a?.answer_unknown)

  // 정답 선지는 답 번호로 찾되, 답을 모르면 why_correct 가 적힌 선지를 정답으로 본다
  const correct = meta.answer != null ? choices.find((c) => c.n === meta.answer) : choices.find((c) => c.why_correct)
  const whyLen = (correct?.why_correct ?? '').trim().length

  const distractors = choices.filter((c) => c !== correct)
  const explained = distractors.filter((c) => (c.how_to_reject ?? '').trim().length >= MIN_WHY).length

  const steps = a?.solve_procedure?.length ?? 0
  const vocab = a?.required_vocab?.length ?? 0
  const hasQuote = Boolean((a?.answer_locus?.quote ?? '').trim())

  const gaps: string[] = []
  if (!a) gaps.push('분석 없음')
  else {
    if (!answerUnknown && whyLen < MIN_WHY) gaps.push('정답 근거')
    if (!answerUnknown && !hasQuote) gaps.push('근거 인용')
    if (distractors.length > 0 && explained < distractors.length) gaps.push('오답 배제')
    if (steps === 0) gaps.push('풀이 절차')
    if (vocab === 0) gaps.push('필수 어휘')
    if (!a.time_budget_sec) gaps.push('시간 예산')
  }

  return {
    ...meta,
    version: a?.version ?? 0,
    answer_unknown: answerUnknown,
    why_correct_len: whyLen,
    has_quote: hasQuote,
    distractors_explained: explained,
    distractors_total: distractors.length,
    procedure_steps: steps,
    vocab,
    time_budget_sec: a?.time_budget_sec ?? null,
    gaps,
  }
}

/** 감사 결과 한 벌의 요약 — 화면 상단 눈금이 읽는다 */
export function summarizeAudit(rows: CsatItemAudit[]) {
  const complete = rows.filter((r) => r.gaps.length === 0).length
  const byGap = new Map<string, number>()
  for (const r of rows) for (const g of r.gaps) byGap.set(g, (byGap.get(g) ?? 0) + 1)
  return {
    items: rows.length,
    complete,
    answerUnknown: rows.filter((r) => r.answer_unknown).length,
    /** 빈 항목 이름 → 그런 문항 수 (많은 것 먼저) */
    gaps: [...byGap.entries()].sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, n })),
  }
}
