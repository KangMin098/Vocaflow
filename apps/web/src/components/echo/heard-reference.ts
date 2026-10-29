// apps/web/src/components/echo/heard-reference.ts
//
// T-0227 ECHO-REF-01 — 「기기가 인식한 참고문장」: 이번 단어 비율(computeShadowMatch)을 계산할 때 **실제로 쓴 바로 그 문자열**을
// 결과 화면에 보여 줘 목표 문장과 직접 견주게 한다. 인식 오류일 수 있음을 알리고, 발음 · 대화 능력 판정으로 말하지 않는다.
// - 스냅숏은 stopRecording 이 비율 계산에 넘긴 문자열 그대로(trim 후)이며, 그 뒤 늦게 온 인식 결과로 바꾸지 않는다.
// - 시도 세대(runGen) · 문장 자료(materialKey) · 계정 경계 세대(authToken)에 묶는다 — 렌더 때도 셋이 지금과 같을 때만 보인다.
// - 인식 미지원 · 빈 값 · 실패는 「참고문장을 확인하지 못함」(사유만) — 침묵 · 발음 실패로 단정하지 않는다.
// - 화면 메모리뿐(React text) — 저장소 · 주소 · 로그 · 분석 · DB 에 싣지 않는다.

export type HeardReason = 'unsupported' | 'empty' | 'failed'

export type HeardSnapshot =
  | { kind: 'text'; text: string; gen: number; materialKey: string; authToken: number }
  | { kind: 'unconfirmed'; reason: HeardReason; gen: number; materialKey: string; authToken: number }

/** stopRecording 안에서 — 비율 계산에 넘긴 문자열(없으면 사유)과 이 시도의 결속을 묶는다. */
export function snapshotHeard(
  input: { supported: boolean; failed: boolean; usedTranscript: string | null },
  bind: { gen: number; materialKey: string; authToken: number },
): HeardSnapshot {
  if (input.usedTranscript) return { kind: 'text', text: input.usedTranscript, ...bind }
  const reason: HeardReason = !input.supported ? 'unsupported' : input.failed ? 'failed' : 'empty'
  return { kind: 'unconfirmed', reason, ...bind }
}

/** 지금 화면에 보일 것 — 결과 화면이고 시도 · 자료 · 계정 경계가 모두 그대로일 때만. */
export function visibleHeard(
  snap: HeardSnapshot | null,
  now: { scored: boolean; gen: number; materialKey: string | null; authCurrent: (token: number) => boolean },
): Extract<HeardSnapshot, { kind: 'text' }> | Extract<HeardSnapshot, { kind: 'unconfirmed' }> | null {
  if (!snap || !now.scored) return null
  if (snap.gen !== now.gen || snap.materialKey !== now.materialKey || !now.authCurrent(snap.authToken)) return null
  return snap
}

export const HEARD_REASON_TEXT: Record<HeardReason, string> = {
  unsupported: '이 브라우저는 음성 인식을 지원하지 않아 참고문장을 확인하지 못했어요.',
  empty: '기기가 알아들은 말이 없어 참고문장을 확인하지 못했어요.',
  failed: '음성 인식이 중간에 실패해 참고문장을 확인하지 못했어요.',
}
