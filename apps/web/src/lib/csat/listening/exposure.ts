// apps/web/src/lib/csat/listening/exposure.ts
//
// 듣기 분석 노출 단계 계약(I7). 순수 함수 — 시계·DB 를 읽지 않는다.
//
// ── Reveal Gate(P6) 재사용 ─────────────────────────────────────────────
// 정답 민감 산출물(정답 · 선지 근거 · 근거-선지 연결)의 보류 판정은 `../embargo-gate.ts` 가 유일한 관문이다.
// 이 파일은 그 판정을 **다시 하지 않는다**. 서버 로더가 `examRevealDecision(examId)` 또는
// `itemRevealDecision([itemId])` 를 불러 얻은 `RevealDecision`('open' | 'embargo' | 'failure')을
// 입력으로 받고, 'open' 이 아니면 L4·L5 를 닫는다(fail-closed: 'failure' 도 닫는다).
// embargo-gate 는 server-only 라 여기서는 타입만 가져온다(런타임 import 없음).

import type { RevealDecision } from '../embargo-gate'

export const EXPOSURE_LEVELS = ['L0', 'L1', 'L2', 'L3', 'L4', 'L5'] as const
export type ExposureLevel = (typeof EXPOSURE_LEVELS)[number]

export const EXPOSURE_LABELS: Readonly<Record<ExposureLevel, string>> = {
  L0: '음성만',
  L1: '대본(강조 없음)',
  L2: '화자·구간 구조',
  L3: '근거 강조(선지 연결 없음)',
  L4: '선지 소거와 근거',
  L5: '정답 공개',
}

export interface ExposureContext {
  /** 학습자가 선지를 골라 제출했는가 */
  submitted: boolean
  /** embargo-gate 의 판정. 판정 전이면 null(= 닫힘) */
  reveal: RevealDecision | null
}

export interface ExposureView {
  audio: boolean
  transcript: boolean
  speakerStructure: boolean
  timing: boolean
  evidenceHighlights: boolean
  /** 근거 role 표시(decisive/supporting/contrast) */
  evidenceRoles: boolean
  choiceLinks: boolean
  rationales: boolean
  answer: boolean
}

const rank = (l: ExposureLevel): number => EXPOSURE_LEVELS.indexOf(l)

/** 정답 민감 단계(L4 이상)를 열 수 있는가 — 제출 + Reveal Gate 'open' 둘 다 */
export function answerSensitiveOpen(ctx: ExposureContext): boolean {
  return ctx.submitted && ctx.reveal === 'open'
}

/** 현재 맥락에서 허용되는 가장 높은 단계 */
export function maxAllowedLevel(ctx: ExposureContext): ExposureLevel {
  return answerSensitiveOpen(ctx) ? 'L5' : 'L3'
}

/** 요청 단계를 허용 범위로 깎는다 */
export function effectiveLevel(requested: ExposureLevel, ctx: ExposureContext): ExposureLevel {
  const max = maxAllowedLevel(ctx)
  return rank(requested) > rank(max) ? max : requested
}

/** 단계별로 각 UI 층이 보여도 되는 것. 요청 단계는 먼저 effectiveLevel 로 깎인다 */
export function exposureView(requested: ExposureLevel, ctx: ExposureContext): ExposureView {
  const r = rank(effectiveLevel(requested, ctx))
  return {
    audio: true,
    transcript: r >= 1,
    speakerStructure: r >= 2,
    timing: r >= 2,
    evidenceHighlights: r >= 3,
    evidenceRoles: r >= 3,
    choiceLinks: r >= 4,
    rationales: r >= 4,
    answer: r >= 5,
  }
}

export type TransitionResult = { ok: true; to: ExposureLevel } | { ok: false; reason: 'not-submitted' | 'reveal-held' | 'skip' | 'same' }

/**
 * 단계 전이. 앞으로는 한 단계씩만(L0→L1→…), 뒤로는 자유. L4 이상으로 가려면 제출 + Reveal Gate 'open'.
 * 이미 L4 이상에 있다가 보류가 시작되면 effectiveLevel/exposureView 가 L3 으로 깎는다.
 */
export function canTransition(from: ExposureLevel, to: ExposureLevel, ctx: ExposureContext): TransitionResult {
  const a = rank(from)
  const b = rank(to)
  if (a === b) return { ok: false, reason: 'same' }
  if (b < a) return { ok: true, to }
  if (b - a > 1) return { ok: false, reason: 'skip' }
  if (b >= rank('L4')) {
    if (!ctx.submitted) return { ok: false, reason: 'not-submitted' }
    if (ctx.reveal !== 'open') return { ok: false, reason: 'reveal-held' }
  }
  return { ok: true, to }
}
