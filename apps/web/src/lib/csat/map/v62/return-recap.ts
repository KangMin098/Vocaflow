// apps/web/src/lib/csat/map/v62/return-recap.ts
//
// T-0062 — 학습 후 같은 지도로 돌아왔을 때의 짧은 정리. 새 판정을 하지 않고 서버가 이미 본인 · TASK · 납품으로 검증한 기록만 읽는다.
//   latest   — 이 TASK 의 가장 최근 수행 기록 하나와, 그것이 독립 근거로 셌는지(As-Is 와 같은 자격 isEligible · 확인 과제 · 화면 종류)
//   transfer — 처음 보는 지문 적용: 0편 · 일부(n/m) · 계획만큼 · 확인 불가(근거를 못 읽음)를 섞지 않는다
//   plan     — 이 묶음의 저장 계획 최신 · 직전 버전과 바꾼 이유 · 지금 재계산이 저장본과 다른지(다르면 제안이지 저장이 아니다)
// 기록을 못 읽었으면 「확인할 수 없어요」 — 0 이나 「없음」 으로 바꾸지 않는다. 과거 상태를 추정해 전후 수치를 만들지 않는다.

import type { FindAttemptRow } from '@/lib/knowledge/find-outcome'
import { isEligible } from '@/lib/knowledge/effect-signals'

import { isInstructional, type ActivityRow } from '../lifecycle-evidence'
import type { PlanReason, SavedPlanVersion } from '../v4/plan-commit'

export type LatestKind = 'independent_counted' | 'not_counted_synthetic' | 'not_counted_help_unknown' | 'not_counted_helped' | 'not_counted_timing' | 'not_counted_unbound' | 'guided' | 'transfer' | 'other'

export interface ReturnRecap {
  /** 이번 활동 — 복귀 문맥의 자료 id 와 본인 · 이 TASK 기록이 맞을 때만. 문맥이 없거나 맞는 기록이 없으면 unidentified(누적과 섞지 않는다) */
  latest: { state: 'unknown' } | { state: 'unidentified' } | { state: 'found'; kind: LatestKind; isCorrect: boolean | null; at: string }
  transfer: { state: 'unknown' } | { state: 'none' | 'partial' | 'complete'; done: number; planned: number | null }
  plan: null | { version: number; reason: PlanReason; goalVersionId: number | null; prev: { version: number; reason: PlanReason; goalVersionId: number | null } | null; proposalDiffers: boolean }
}

export function returnRecap(input: {
  keys: readonly string[]
  /** 복귀 문맥의 「이번에 연 자료」 ref(authored:<id>) — 서버 학습 화면이 붙인 값. 없으면 이번 활동을 특정하지 않는다 */
  activityRef: string | null
  /** 그 화면에서 실제로 저장된 제출의 수행 id(서버 응답) — 없으면(새 답 없는 재열기 · 옛 URL) 이번 활동을 특정하지 않는다(자료의 최신 답을 이번 활동이라 부르지 않는다) */
  activityAttempt?: string | null
  /** As-Is 판정과 같은 첫 시도 기록 — undefined = 조회 실패 */
  attempts: readonly FindAttemptRow[] | undefined
  /** 생애주기 수행 기록(안내 연습 · 적용 포함) — undefined = 조회 실패 */
  activity: readonly ActivityRow[] | undefined
  /** evidence-claims 의 instructionPath — undefined 또는 ledger 'unknown'(수행 원장을 못 읽음) = 확인 불가(0편으로 읽지 않는다) */
  transfer: { transferDone: number; transferPlanned: number | null } | undefined
  ledger?: 'complete' | 'unknown'
  /** 이 묶음 저장 이력(최신 먼저) — 없으면 [] */
  history: readonly SavedPlanVersion[]
  /** 지금 재계산이 저장본과 어긋남(next-action 의 planDrift 판정 그대로) */
  proposalDiffers: boolean
}): ReturnRecap {
  const keys = new Set(input.keys)
  let latest: ReturnRecap['latest']
  if (!input.attempts || !input.activity) latest = { state: 'unknown' }
  else if (!input.activityRef || !input.activityAttempt) latest = { state: 'unidentified' }
  else {
    const rows = [
      ...input.attempts.filter((a) => keys.has(a.taskKey) && a.itemRef === input.activityRef && a.attemptId === input.activityAttempt && a.answeredAt).map((a) => ({ at: a.answeredAt!, isCorrect: a.isCorrect, kind: independentKind(a) })),
      ...input.activity.filter((a) => keys.has(a.taskKey) && a.itemRef === input.activityRef && a.attemptId === input.activityAttempt && a.answeredAt && !input.attempts!.some((f) => f.attemptId && f.attemptId === a.attemptId)).map((a) => ({ at: a.answeredAt!, isCorrect: a.isCorrect, kind: activityKind(a) })),
    ].sort((x, y) => (x.at < y.at ? 1 : x.at > y.at ? -1 : 0))
    latest = rows[0] ? { state: 'found', kind: rows[0].kind, isCorrect: rows[0].isCorrect, at: rows[0].at } : { state: 'unidentified' }
  }
  const t = input.transfer
  const transfer: ReturnRecap['transfer'] = !t || input.ledger === 'unknown' ? { state: 'unknown' }
    : { state: t.transferDone <= 0 ? 'none' : t.transferPlanned !== null && t.transferDone >= t.transferPlanned ? 'complete' : 'partial', done: t.transferDone, planned: t.transferPlanned }
  const [cur, prev] = input.history
  const plan: ReturnRecap['plan'] = cur ? { version: cur.version, reason: cur.reason, goalVersionId: cur.goalVersionId ?? null, prev: prev ? { version: prev.version, reason: prev.reason, goalVersionId: prev.goalVersionId ?? null } : null, proposalDiffers: input.proposalDiffers } : null
  return { latest, transfer, plan }
}

/** As-Is(as-is.ts independent)와 같은 자격 — 확인 과제 화면 · 첫 시도 자격 · 정오 있음 */
function independentKind(a: FindAttemptRow): LatestKind {
  if (a.phase === 'transfer') return 'transfer'
  if (a.activity === 'practice') return 'guided'
  if (a.phase === 'practice' && isEligible(a) && a.isCorrect !== null) return 'independent_counted'
  // 세지 않은 이유는 기록 표지 그대로(추측하지 않는다) — 제외 사유와 「도움을 봤다」는 사실을 섞지 않는다(T-0062 F4)
  if (a.synthetic) return 'not_counted_synthetic'
  if ((a as FindAttemptRow & { authoredBinding?: 'missing' | 'mismatch' }).authoredBinding) return 'not_counted_unbound'
  if (a.helpLevel === null || a.helpLevel === undefined) return 'not_counted_help_unknown'
  if (a.helpLevel !== 'independent' || a.afterViewedFirst || a.afterExplanation) return 'not_counted_helped'
  if (a.timingUncertain) return 'not_counted_timing'
  return 'not_counted_unbound'
}

function activityKind(a: ActivityRow): LatestKind {
  if (a.phase === 'transfer') return 'transfer'
  if (isInstructional(a)) return 'guided'
  return 'other'
}

export const LATEST_LABEL: Record<LatestKind, string> = {
  independent_counted: '처음 보는 문항을 혼자 푼 기록 — 독립 근거로 셌어요',
  not_counted_synthetic: '확인 문항 풀이 — 시험 · 합성 계정 기록이라 독립 근거로 세지 않아요(학습 효과 근거 아님)',
  not_counted_help_unknown: '확인 문항 풀이 — 도움 여부가 기록되지 않아 독립 근거로 세지 않았어요',
  not_counted_helped: '확인 문항 풀이 — 도움 · 해설을 본 뒤라 독립 근거로 세지 않았어요',
  not_counted_timing: '확인 문항 풀이 — 제출 시각을 확인하지 못해 아직 독립 근거로 세지 않았어요',
  not_counted_unbound: '확인 문항 풀이 — 이 문항 · 납품과의 연결을 확인하지 못해 독립 근거로 세지 않았어요',
  guided: '안내 연습 — 바로잡기 기록이에요(독립 근거로 세지 않아요)',
  transfer: '처음 보는 지문에 적용한 기록',
  other: '학습 기록 — 독립 근거는 아니에요',
}

export function transferLine(t: ReturnRecap['transfer']): string {
  if (t.state === 'unknown') return '처음 보는 지문 적용 기록을 지금 확인할 수 없어요.'
  if (t.state === 'none') return '처음 보는 지문에 적용한 기록은 아직 없어요.'
  if (t.state === 'partial') return `처음 보는 지문 적용 ${t.done}${t.planned !== null ? ` / ${t.planned}` : ''}편 — 아직 계획만큼 하지 않았어요(일부 수행은 완료가 아니에요).`
  return `처음 보는 지문 적용 ${t.done}${t.planned !== null ? ` / ${t.planned}` : ''}편 — 계획만큼 했어요(적용 경험은 실력 판정이 아니에요).`
}
