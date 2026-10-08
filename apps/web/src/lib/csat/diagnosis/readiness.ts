// apps/web/src/lib/csat/diagnosis/readiness.ts
//
// 진단 반영(csat_exams.diagnosis_ready) 판정 — 순수 함수(DB · 시계 없음). 관리자 목록 · 켜기 액션이 같은 규칙을 쓴다(2026-10-07).
//
// 「진단 반영」의 뜻: 이 시험의 문항별 진단 입력(역량 9개 가중치 · 선지 함정)이 사람 검수를 마쳐, 학생 기록을 학습 지도 · 유형 진단 계산에
// 써도 된다. 특정 태그(A1) 하나가 전 문항에 있다는 뜻이 아니다.
//
// 진단 엔진이 시험에서 읽는 입력(server.ts loadExams · itemMetas)과 검수 대상:
//   정답표 45 · 배점     필수 · 검수 대상 아님(적재 스크립트가 원본 대조) — 없으면 채점 불가 → 구조 문제
//   문항 정답            필수 — 없으면 검수 저장(RPC)이 거부한다 → 구조 문제
//   역량 9개 가중치      필수 · 문항마다 사람 검수. 0 = 「이 문항엔 해당 없음(not_applicable)」도 검수된 판정이다
//   선지 함정            검수 저장에서 역량과 한 트랜잭션으로 함께 확정된다(별도 표지 없음)
//   공식 오답률 · EBS    선택(없으면 보정 생략)
// 문항 「검수 완료」 = 9개 역량 행이 모두 있고 모두 reviewed_at 이 찍힘. 검수 저장 RPC(csat_dx_save_item_tagging)가 9개를 정확히 받아
// 0 포함 전부 쓰므로 검수한 문항은 늘 9행이다. 유형 기본값 시드(source=type_default)는 0 이 아닌 역량만 · 검수 표지 없이 들어 있어
// 「미검수(unreviewed)」다 — 「행이 없다」를 「해당 없음」으로 세지 않는다(해당 없음은 검수자가 0 으로 정한 행뿐).
// 이전 판정은 A1 행 하나를 문항 검수 표지로 썼다(같은 결과지만 뜻이 숨어 있어 「A1 이 모든 문항에 필요하다」로 읽혔다) — 이 함수로 바꾼다.

import { ATTRIBUTE_CODES } from './engine/types'

export interface ReadinessItem {
  id: string
  /** 정답(복수 정답 포함) — 비면 구조 문제 */
  hasAnswer: boolean
  /** 이 문항의 역량 행(검수 표지 포함) */
  attrs: readonly { code: string; reviewed: boolean }[]
}

export type ItemReview = 'reviewed' | 'unreviewed'

/** 문항 검수 상태 — 9개 역량이 모두 검수된 행으로 있을 때만 reviewed */
export function itemReview(item: Pick<ReadinessItem, 'attrs'>): ItemReview {
  const reviewed = new Set(item.attrs.filter((a) => a.reviewed).map((a) => a.code))
  return ATTRIBUTE_CODES.every((c) => reviewed.has(c)) ? 'reviewed' : 'unreviewed'
}

export interface ExamReadiness {
  /** 사람 검수가 필요한 문항 수(= 이 시험의 문항 수) */
  required: number
  reviewed: number
  remaining: number
  /** 구조 문제 — 검수로는 풀리지 않는다 */
  structural: string[]
  /** 지금 켤 수 있는가 */
  canEnable: boolean
  /** 관리자에게 보일 한 줄 */
  reason: string
}

/** keyCount = 이 시험 정답표 행 수(45 여야 채점 가능) */
export function examReadiness(keyCount: number, items: readonly ReadinessItem[]): ExamReadiness {
  const structural: string[] = []
  if (keyCount !== 45) structural.push(`정답표 ${keyCount}/45`)
  if (items.length === 0) structural.push('문항 없음')
  const noAnswer = items.filter((i) => !i.hasAnswer).length
  if (noAnswer > 0) structural.push(`정답 없는 문항 ${noAnswer}`)
  const required = items.length
  const reviewed = items.filter((i) => itemReview(i) === 'reviewed').length
  const remaining = required - reviewed
  const canEnable = structural.length === 0 && required > 0 && remaining === 0
  const reason = structural.length
    ? `진단 반영 불가 — ${structural.join(' · ')}`
    : remaining > 0
      ? `검수 완료 후 가능 — 남은 문항 ${remaining}`
      : '진단 반영 가능'
  return { required, reviewed, remaining, structural, canEnable, reason }
}
