// apps/web/src/components/echo/heard-reference.ts
//
// T-0227 ECHO-REF-01 — 「기기가 인식한 참고문장」: 이번 단어 비율(computeShadowMatch)을 계산할 때 **실제로 쓴 바로 그 문자열**을
// 결과 화면에 보여 줘 목표 문장과 직접 견주게 한다. 인식 오류일 수 있음을 알리고, 발음 · 대화 능력 판정으로 말하지 않는다.
// - 스냅숏은 stopRecording 이 비율 계산에 넘긴 문자열 그대로(trim 후)이며, 그 뒤 늦게 온 인식 결과로 바꾸지 않는다.
// - 시도 세대(runGen) · 문장 자료(materialKey) · 계정 경계 세대(authToken)에 묶는다 — 렌더 때도 셋이 지금과 같을 때만 보인다.
// - 인식 미지원 · 빈 값 · 실패는 「참고문장을 확인하지 못함」(사유만) — 침묵 · 발음 실패로 단정하지 않는다.
// - 화면 메모리뿐(React text) — 저장소 · 주소 · 로그 · 분석 · DB 에 싣지 않는다.

import type { ComparisonScore } from '@/lib/echo/dtw-comparator'
import { computeShadowMatch, type ShadowMatch } from '@/lib/workspace/shadow-match'

export type HeardReason = 'unsupported' | 'empty' | 'failed'

export type HeardSnapshot =
  | { kind: 'text'; text: string; gen: number; materialKey: string; authToken: number }
  | { kind: 'unconfirmed'; reason: HeardReason; gen: number; materialKey: string; authToken: number }

/** stopRecording 안에서 — 비율 계산에 넘긴 문자열(없으면 사유)과 이 시도의 결속을 묶는다. */
export function snapshotHeard(
  input: { supported: boolean; failed: boolean; usedTranscript: string | null },
  bind: { gen: number; materialKey: string; authToken: number },
): HeardSnapshot {
  // 미지원 · 실패를 문자열보다 먼저 본다 — 일부 인식 뒤 오류가 온 문자열은 참고문장으로 보이지 않는다(채점은 그대로)
  if (!input.supported) return { kind: 'unconfirmed', reason: 'unsupported', ...bind }
  if (input.failed) return { kind: 'unconfirmed', reason: 'failed', ...bind }
  if (input.usedTranscript) return { kind: 'text', text: input.usedTranscript, ...bind }
  return { kind: 'unconfirmed', reason: 'empty', ...bind }
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

// ── stopRecording 의 판정 · 상태 전이(순수) — Player 는 이 함수들을 그대로 부른다(T-0227 Codex P2) ──

/** 이번 시도 인식의 상태 — 시작 세대에 묶인 콜백만 채운다(다른 세대의 콜백 · 오류는 채우지 않는다). */
export interface RecogAttemptState {
  supported: boolean
  /** start() 가 false 를 돌려줬거나 던졌다 */
  startFailed: boolean
  /** 이 세대의 onError(마이크 거부 · 네트워크 등)가 왔다 */
  errored: boolean
  /** 정지 요청(stop())이 던졌다 — 기존처럼 비율을 재지 않는다(단어 정확도 미측정) */
  stopThrew?: boolean
  /** 이 세대의 마지막 onInterim 문자열(정지 전까지) */
  transcript: string
}

export interface MeasuredTranscript {
  /** 비율 계산에 넘긴 정확한 문자열(trim) — 없으면 null */
  used: string | null
  ratio: number | null
  matchedKeys: Set<string> | null
  failed: boolean
}

/** 정지 순간 한 번 — 인식 문자열을 비율 계산에 넘기고, 넘긴 그 문자열을 그대로 돌려준다. */
export function measureTranscript(
  target: string,
  recog: RecogAttemptState,
  match: (t: string, s: string) => ShadowMatch = computeShadowMatch,
): MeasuredTranscript {
  const failed = recog.supported && (recog.startFailed || recog.errored || !!recog.stopThrew)
  const used = recog.stopThrew ? '' : recog.transcript.trim()
  if (!used) return { used: null, ratio: null, matchedKeys: null, failed }
  const m = match(target, used)
  return { used, ratio: m.ratio, matchedKeys: m.matchedKeys, failed }
}

/** 이 콜백이 아직 이 시도의 것인가 — 인식 세대와 실행 세대가 모두 시작 세대와 같을 때만. */
export function isLiveRecog(
  startedGen: number,
  recogGen: number | null,
  runGen: number,
  bound?: { startedKey: string; currentKey: string | null; authCurrent: boolean },
): boolean {
  if (recogGen !== startedGen || startedGen !== runGen) return false
  // 시작 때의 문장 자료 · 계정 경계가 그대로일 때만 — 바뀐 뒤 정리 전에 온 이전 콜백은 버린다
  return !bound || (bound.startedKey === bound.currentKey && bound.authCurrent)
}

/** 녹음 정지(await) 뒤 — 그 사이 시도가 바뀌었으면 stale(버림), 같은 사람이 아니면 denied(닫음), 아니면 ok. */
export function gateAfterStop(input: {
  startedGen: number
  currentGen: number
  authCurrent: boolean
  expectedUserId: string | null | undefined
}): 'stale' | 'denied' | 'ok' {
  if (input.startedGen !== input.currentGen) return 'stale'
  if (!input.authCurrent || !input.expectedUserId) return 'denied'
  return 'ok'
}

export interface EchoSavePayload {
  textId: string
  libraryBookId: string | null
  sentenceId: string
  attemptNumber: number
  score: ComparisonScore
  durationMs: number
  expectedUserId: string
}

/** ok 인 시도의 결과 — 화면 스냅숏과 기존 저장 payload(모양 · 값 그대로). */
export function scoredOutcome(input: {
  measured: MeasuredTranscript
  supported: boolean
  bind: { gen: number; materialKey: string; authToken: number }
  textId: string
  libraryBookId: string | null | undefined
  sentenceId: string
  prevAttempts: number
  score: ComparisonScore
  durationMs: number
  expectedUserId: string
}): { heard: HeardSnapshot; save: EchoSavePayload; attemptNumber: number } {
  const attemptNumber = input.prevAttempts + 1
  return {
    heard: snapshotHeard({ supported: input.supported, failed: input.measured.failed, usedTranscript: input.measured.used }, input.bind),
    attemptNumber,
    save: {
      textId: input.textId,
      libraryBookId: input.libraryBookId ?? null,
      sentenceId: input.sentenceId,
      attemptNumber,
      score: input.score,
      durationMs: input.durationMs,
      expectedUserId: input.expectedUserId,
    },
  }
}
