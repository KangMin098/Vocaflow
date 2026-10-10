// apps/web/src/lib/csat/map/lifecycle-evidence.ts
// 생애주기 수행 근거(2026-10-10 · MC-07 · MC-08b) — 바로잡기(REPAIR) · 다른 글에 적용(TRANSFER)을 **실제 수행 기록**으로만 판정한다(순수 · 저장 안 함).
// 새 기록 종류를 만들지 않는다 — 기존 G2 원장(learning_task_attempts)의 시도만 읽는다(DB 변경 없음).
//
//   REPAIR   직접 확인 뒤, 확정에 쓴(막혔던) 확인 문항을 다시 처리해 **맞힌** 시도. 도움 · 해설을 본 뒤여도 된다(바로잡기는 안내받는 단계다).
//            틀린 재시도는 「바로잡는 중」 이고 완료가 아니다. 다시 확인에서 막히면 그 뒤에 막힌 문항을 다시 맞혀야 한다(회차 안 재바로잡기).
//   TRANSFER 직접 확인 뒤, 같은 원리(과제 키)를 **확인 묶음 밖** 문항에 적용한 시도, 또는 Practice 전이 단계(phase=transfer) 시도.
//            정오는 따지지 않는다(적용 경험 · 결과는 CHECK 가 판정한다). 합성 · 독립성 조건도 따지지 않는다 — 진단 근거가 아니라 수행 기록이다.
//   CHECK    skill-diagnosis 가 판정한다(미노출 확인 문항 · 독립 첫 시도). 여기서는 다루지 않는다.
// 회차: 직접 확인 시각(verifiedAt) 뒤의 기록만 센다 — 이전 회차의 바로잡기는 새 회차에 넘어오지 않는다.

export interface ActivityRow {
  itemRef: string | null
  taskKey: string
  phase: string
  isCorrect: boolean | null
  answeredAt: string | null
}

export interface LifecycleEvidence {
  /** 바로잡기 완료 시각(막혔던 문항을 다시 맞힌 첫 시각) */
  repairAt: string | null
  /** 바로잡기 시도는 있지만 아직 못 맞힘 */
  repairTried: boolean
  /** 다른 글에 적용한 첫 시각 */
  transferAt: string | null
}

export const NO_EVIDENCE: LifecycleEvidence = { repairAt: null, repairTried: false, transferAt: null }

export function lifecycleEvidence(
  skill: { status?: string; verifiedAt: string | null; verifiedItems: readonly string[]; check?: { wrongItems?: readonly string[]; lastWrongAt?: string | null } } | null,
  targets: readonly { itemRef: string; taskKey: string }[],
  activity: readonly ActivityRow[],
): LifecycleEvidence {
  if (!skill?.verifiedAt) return NO_EVIDENCE
  const since = skill.verifiedAt
  const keys = new Set(targets.map((t) => t.taskKey))
  const inBundle = new Set(targets.map((t) => t.itemRef))
  const blocked = new Set([...skill.verifiedItems, ...(skill.check?.wrongItems ?? [])])
  // 다시 확인에서 막혔으면 그 뒤의 바로잡기만 센다 — 「한 번 더 바로잡기」 가 새로 필요하다(안내 문구와 4칸이 어긋나지 않게)
  // 해소된 회차는 그 회차 안의 바로잡기 기록을 그대로 보인다(통과 뒤에 「다시 바로잡기」 를 요구하지 않는다)
  const repairSince = skill.status !== 'resolved' && skill.check?.lastWrongAt && skill.check.lastWrongAt > since ? skill.check.lastWrongAt : since
  const after = activity
    .filter((a) => a.answeredAt && a.answeredAt > since && keys.has(a.taskKey))
    .sort((x, y) => (x.answeredAt as string).localeCompare(y.answeredAt as string))
  const repair = after.filter((a) => a.itemRef && blocked.has(a.itemRef) && (a.answeredAt as string) > repairSince)
  const repairAt = repair.find((a) => a.isCorrect === true)?.answeredAt ?? null
  const transferAt = after.find((a) => a.phase === 'transfer' || (a.itemRef !== null && !inBundle.has(a.itemRef)))?.answeredAt ?? null
  return { repairAt, repairTried: repair.length > 0, transferAt }
}

/** 지금 할 일 하나 — 생애주기 순서(바로잡기 → 적용 → 다시 확인). 처방이 열린 상태(verified · still_needed)에서만 */
export type LifecycleNext = 'repair' | 'transfer' | 'check' | null

export function nextLifecycleAction(status: string | null | undefined, ev: LifecycleEvidence): LifecycleNext {
  if (status !== 'verified' && status !== 'still_needed') return null
  if (!ev.repairAt) return 'repair'
  if (!ev.transferAt) return 'transfer'
  return 'check'
}
