// apps/web/src/lib/csat/authored/binding-feedback.ts
//
// T-0075 — 풀이 뒤 「자료 연결」 결과를 화면 문구로 옮긴다. 판정은 하지 않는다 — 서버(DB)가 정한 evidence · non_evidence_reason 을 닫힌 표로만 읽는다.
//   연결됨(bound) ≠ 근거로 셈(evidence===true) ≠ 정답. 모르는 사유 · 누락은 「확인하지 못함」이고, 도움을 받았다고 추정하지 않는다.

/** DB CHECK(workspace_delivery_attempt.non_evidence_reason)의 닫힌 값 — 알려진 사실만 말한다 */
export const NON_EVIDENCE_LABEL: Record<string, string> = {
  role_not_evidence: '연습 자료의 풀이라 혼자 해낸 근거로는 세지 않아요.',
  help_state_mismatch: '도움 상태가 이 자료의 역할과 맞지 않아 혼자 해낸 근거로는 세지 않아요.',
  not_first_exposure: '이 글을 이미 본 뒤의 풀이라 혼자 해낸 근거로는 세지 않아요.',
  exposure_unverifiable: '처음 본 글인지 확인할 수 없어 혼자 해낸 근거로는 세지 않아요.',
  approval_revoked: '이 자료의 승인이 철회돼 혼자 해낸 근거로는 세지 않아요.',
  qualification_superseded: '이 자료의 자격이 바뀌어 혼자 해낸 근거로는 세지 않아요.',
  delivery_invalid: '받은 자료가 더 이상 유효하지 않아 혼자 해낸 근거로는 세지 않아요.',
}

export type BindingFeedback =
  | { kind: 'evidence'; text: string }
  | { kind: 'not_evidence'; reason: string; text: string }
  | { kind: 'unknown'; text: string }
  | { kind: 'unbound'; status: string }

/** 서버 결속 결과(모양이 이상하면 unknown) → 화면 상태 */
export function bindingFeedback(b: { status?: unknown; evidence?: unknown; reason?: unknown } | null | undefined): BindingFeedback {
  if (!b || typeof b.status !== 'string') return { kind: 'unknown', text: '받은 자료와 연결됐는지 확인하지 못했어요.' }
  if (b.status !== 'bound') return { kind: 'unbound', status: b.status }
  if (b.evidence === true) return { kind: 'evidence', text: '이 풀이는 받은 자료에 연결돼 학습 지도에 「혼자 해낸 근거」로 반영돼요.' }
  if (b.evidence === false && typeof b.reason === 'string' && NON_EVIDENCE_LABEL[b.reason]) {
    return { kind: 'not_evidence', reason: b.reason, text: `이 풀이는 받은 자료에 연결돼 기록으로 남아요. ${NON_EVIDENCE_LABEL[b.reason]}` }
  }
  return { kind: 'unknown', text: '이 풀이는 받은 자료에 연결됐지만, 근거로 셌는지는 확인하지 못했어요.' }
}

/** 서버가 돌려준 수행 id — 양의 정수 문자열만(그 밖은 특정 불가 = null) */
export function attemptIdOf(v: unknown): string | null {
  return typeof v === 'string' && /^[1-9][0-9]{0,18}$/.test(v) ? v : null
}
