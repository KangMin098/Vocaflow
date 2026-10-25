// apps/web/src/lib/csat/lecture/disclosure-copy.ts
//
// 강의 공개 경로 안내 문구 — 정지 지점 앞 구간의 위험 수준(cue 공개 수준 검수)을 그대로 말한다.
// 어느 경우에도 「단서 없음」 을 약속하지 않는다(경계는 「정답 번호를 직접 말하기 직전」 일 뿐이다).

export type PreStopRiskCode = 'decisive_confirmed' | 'decisive_possible' | 'hint' | 'none'

export function preStopNotice(risk: PreStopRiskCode | undefined): string {
  if (risk === 'decisive_confirmed') return '멈추기 전 구간에서 이미 정답을 사실상 정할 수 있는 단서가 나와요. 정답을 스스로 찾고 싶다면 원문부터 보세요.'
  if (risk === 'decisive_possible') return '멈추기 전 구간에도 정답을 좁히는 단서가 있고, 그 단서로 정답이 정해지는지 아직 다 확인하지 못했어요.'
  if (risk === 'hint') return '멈추기 전 구간에도 정답을 좁히는 단서가 있어요. 정답 번호를 직접 말하기 직전에 멈춰요.'
  return '정답 번호를 직접 말하기 직전에 멈춰요.'
}
