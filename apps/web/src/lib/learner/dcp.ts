// apps/web/src/lib/learner/dcp.ts
//
// CTP DCP(구문 연습) 공용 타입 + error_cause 정적 매핑 (client·server 공용, 'use server' 아님).
// 문항 계약은 packages/library-pipeline generate-items.ts 와 DB grade_dcp_item 에 정합:
//   order  : payload.presented(셔플 문장) · 제출 {order:[배열한 presented 인덱스]} (각 presented[k]를 원래 위치로)
//   insert : payload.{remaining, insert_sentence, gap_count} · 제출 {position:슬롯 0..remaining.length}

export type DcpItemType = 'order' | 'insert'

export interface DcpOrderPayload {
  presented: string[]
}
export interface DcpInsertPayload {
  remaining: string[]
  insert_sentence: string
  gap_count: number
}

export interface DcpItem {
  id: string
  type: DcpItemType
  paragraphIdx: number
  payload: DcpOrderPayload | DcpInsertPayload
}

/** grade_dcp_item 반환. 오답이면 answerKey 동봉(정답 공개용). */
export interface DcpGradeResult {
  correct: boolean
  attemptId: string | null
  /** order: {source_order:number[]} / insert: {position:number} / 정답이면 null */
  answerKey: Record<string, unknown> | null
}

// ── error_cause 정적 5원인 (오답 자기보고 → 격려 tip + 존재 라우트만 링크) ──
export type DcpErrorCause = 'vocab' | 'parsing' | 'structure' | 'inference' | 'timing'

export interface ErrorCauseDef {
  cause: DcpErrorCause
  /** 1-tap 칩 라벨(학습자 관점 원인) */
  label: string
  /** 격려형 처방 tip (Empathetic Feedback) */
  tip: string
  /** 존재하는 라우트만 — 없으면 tip 만(허위 링크 금지) */
  href: string | null
}

export const ERROR_CAUSES: readonly ErrorCauseDef[] = [
  { cause: 'vocab', label: '단어를 몰랐어요', tip: '흐려진 단어부터 가볍게 복습해요.', href: '/flashcard/play' },
  { cause: 'parsing', label: '문장 해석이 어려웠어요', tip: '문장을 끊어 천천히 다시 읽어보면 도움이 돼요.', href: null },
  { cause: 'structure', label: '글 구조가 헷갈렸어요', tip: '문단을 잇는 연결어(however·so 등)를 따라가 보세요.', href: null },
  { cause: 'inference', label: '논리 추론이 안 됐어요', tip: '결론의 근거가 되는 문장을 짚어보면 흐름이 보여요.', href: null },
  { cause: 'timing', label: '시간이 부족했어요', tip: '실전처럼 시간을 재며 반복하면 감각이 붙어요.', href: null },
] as const

/**
 * order 정답 순서 복원 — answerKey.source_order[k] = presented[k]의 원래 위치.
 * 정답 배열(presented 인덱스, 원래 순서대로) = 각 pos 에 대해 source_order[k]==pos 인 k.
 */
export function correctOrderFromKey(sourceOrder: number[]): number[] {
  const n = sourceOrder.length
  const result: number[] = new Array(n).fill(0)
  for (let k = 0; k < n; k++) {
    const pos = sourceOrder[k]
    if (pos >= 0 && pos < n) result[pos] = k
  }
  return result
}
