// apps/web/src/lib/csat/lecture/targets.ts
//
// **해설 화면에 실제로 그려지는 블록 id 목록 — 강의가 가리킬 수 있는 곳은 여기뿐이다.**
//
// 화면(`/csat/item/[slug]`)과 드레인(export·import)이 **같은 함수**를 부른다. 두 벌로 적으면
// 한쪽만 바뀌어, 대본은 `reject:3` 을 가리키는데 화면에는 그 블록이 없는 일이 생긴다 —
// 재생은 멀쩡히 도는데 하이라이트만 허공을 가리킨다(이 저장소가 여러 번 겪은 «조용한 어긋남»).
//
// 규칙은 해설 화면의 렌더 조건을 그대로 옮겼다:
//   · 지도(`PassageMap`)는 골격이 있고 그 골격이 앵커를 하나 이상 품을 때만 그려진다
//   · 지도가 그려지면 정답 블록은 **지도 칩**이고, 아니면 「답이 왜 이것인가」 절이다
//   · 오답은 모두 어딘가에 그려진다 — 지도에 든 것은 칩, 안 든 것은 아래 목록(offMap)

export interface TargetInput {
  answer: number | null
  answer_unknown: boolean
  has_ability: boolean
  has_intent: boolean
  /** 오답 선지 번호들(choice_analysis 의 distractor) */
  distractors: number[]
  procedure_len: number
  vocab_len: number
  /** 구워 둔 골격 — 없으면 null */
  skeleton: { sentences: number; placedAnchorIds: string[] } | null
}

export interface TargetSet {
  /** 분석 블록 id */
  analysis: string[]
  /** 원문 자리 id (`sentence:k`) */
  anchor: string[]
  /** 지도가 그려지는가 */
  useMap: boolean
}

export function lectureTargets(t: TargetInput): TargetSet {
  const answerKnown = t.answer != null && !t.answer_unknown
  const mapAnchorIds = [...(answerKnown ? ['answer'] : []), ...t.distractors.map((n) => `reject:${n}`)]
  const shown = t.skeleton ? mapAnchorIds.filter((id) => t.skeleton!.placedAnchorIds.includes(id)) : []
  const useMap = t.skeleton != null && shown.length > 0

  const analysis = ['head']
  if (t.has_ability) analysis.push('ability')
  if (t.has_intent) analysis.push('intent')
  if (useMap) analysis.push('map')
  // 정답: 지도에 들었으면 칩, 지도가 없으면 절. 지도가 있는데 정답만 못 들었으면 **어디에도 없다**
  // (해설 화면이 그 경우 절을 그리지 않는다 — `useMap ? null : <section>`).
  if (answerKnown && (!useMap || shown.includes('answer'))) analysis.push('answer')
  for (const n of t.distractors) analysis.push(`reject:${n}`)
  if (t.procedure_len > 0) analysis.push('procedure')
  if (t.vocab_len > 0) analysis.push('vocab')

  const anchor = useMap ? Array.from({ length: t.skeleton!.sentences }, (_, k) => `sentence:${k}`) : []
  return { analysis, anchor, useMap }
}

export function isValidTarget(set: TargetSet, target: { kind: string; id: string }): boolean {
  if (target.kind === 'analysis') return set.analysis.includes(target.id)
  if (target.kind === 'anchor') return set.anchor.includes(target.id)
  return false
}

/** DOM 에 박히는 속성 값 — 화면과 엔진이 같은 문자열로 만난다 */
export function targetKey(target: { kind: string; id: string }): string {
  return `${target.kind}:${target.id}`
}
