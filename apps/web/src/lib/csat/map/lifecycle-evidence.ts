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
  /** Exact learning_task_attempts.id; used only for evidence lineage, not stage policy. */
  attemptId?: string
  sessionId?: string | null
  /** Server-derived exact passage identity; null means identity unavailable, undefined is legacy input. */
  passageKey?: string | null
  itemRef: string | null
  taskKey: string
  phase: string
  isCorrect: boolean | null
  answeredAt: string | null
  /** LM-G1.4 증거 계보(원장 그대로 · 없으면 undefined = 옛 입력) — 주석 해시 · 화면 · 도움 · 합성 · 서버 수신 */
  contentHash?: string | null
  activity?: string | null
  helpLevel?: string | null
  synthetic?: boolean | null
  receivedAt?: string | null
  /**
   * FI-011 — 이 시도가 결속된 **바로잡기 납품의 역할**(서버 loader 가 workspace_delivery_attempt 의 정확한 attempt_id ↔ 본인 · 지금 유효한
   * guided_practice 납품 결속을 확인했을 때만 채운다). 클라이언트 값 · 추측으로 채우지 않는다 — 없으면 바로잡기 성공 근거가 아니다.
   */
  repairRole?: 'guided_practice'
  /**
   * 2E — 여러 단계로 된 교수 활동(원문 안내 연습)의 **첫 단계 시작 시각**(원장 그대로). 주어지면 그 활동 전체가 이번 회차 안에서 시작했을 때만
   * 바로잡기를 진전시킨다(회차 앞에서 시작해 회차 안에서 끝난 활동은 새 회차의 완료가 아니다). 없으면 행 하나 = 활동 하나(기존).
   */
  lessonStartedAt?: string | null
}

/** 기출 바로잡기 분기 대상 — 창작 자료(authored:*)가 아닌 문항. 창작 평가 자료를 다시 푼 기록은 바로잡기가 아니다(FI-011 · 평가 자료 재사용 없음) */
export const isKiceRepairTarget = (a: Pick<ActivityRow, 'itemRef'>): boolean => !!a.itemRef && !a.itemRef.startsWith('authored:')

/** 교수 자료(안내 연습 등 창작 practice) 수행 — 바로잡기에만 센다. 결속을 못 읽었어도(repairRole 없음) 적용 · 다시 확인 수에는 넣지 않는다(fail-closed) */
export function isInstructional(a: Pick<ActivityRow, 'itemRef' | 'activity' | 'repairRole'>): boolean {
  return a.repairRole !== undefined || (!!a.itemRef && a.itemRef.startsWith('authored:') && a.activity === 'practice')
}

/**
 * 이번 회차의 안내 연습 시도(시각 순 · LM-G1.1 · PLAN · lifecycle 공용) — 정확한 납품 결속(repairRole) · 같은 과제 키 ·
 * 판단 시각과 **서버 수신 시각 둘 다** 회차 시작 뒤. 서버 수신이 없거나(옛 입력 · 미확인) 회차 앞이면 이번 회차를 진전시키지 않는다.
 */
export function guidedRepairAttempts<A extends Pick<ActivityRow, 'itemRef' | 'taskKey' | 'answeredAt' | 'receivedAt' | 'repairRole'> & { lessonStartedAt?: string | null }>(skill: SkillLike, taskKeys: ReadonlySet<string>, activity: readonly A[]): A[] {
  const w = repairWindow(skill)
  if (!w) return []
  const t0 = new Date(w.since).getTime()
  const after = (x: string | null | undefined) => !!x && new Date(x).getTime() > t0
  return activity
    .filter((a) => a.repairRole === 'guided_practice' && a.itemRef !== null && taskKeys.has(a.taskKey) && after(a.answeredAt) && after(a.receivedAt) && (a.lessonStartedAt === undefined || after(a.lessonStartedAt)))
    .sort((x, y) => (x.answeredAt as string).localeCompare(y.answeredAt as string))
}

/**
 * 바로잡기 성공(LM-G1.1 · PLAN repairGate · lifecycle repairAt 의 단일 판정) — 이번 회차의 막힌 기출 문항 재시도 정답, 또는 결속된 안내 연습 정답.
 * 원리 설명 보기 · 납품 · 틀린 시도 · 정오 없는 시도는 성공이 아니다. at = 첫 성공 판단 시각.
 */
export function repairSuccess<A extends Pick<ActivityRow, 'itemRef' | 'taskKey' | 'answeredAt' | 'isCorrect' | 'receivedAt' | 'repairRole' | 'activity'>>(skill: SkillLike, taskKeys: ReadonlySet<string>, activity: readonly A[]): { at: string | null; tried: boolean; retried: A[]; guided: A[] } {
  // 기출 분기 = 기출(비창작) 막힌 문항 재시도만. 창작 평가의 반복 기록(이력은 그대로 둔다)은 성공 · 수행량에 넣지 않는다
  const retried = repairAttempts(skill, taskKeys, activity.filter((a) => !isInstructional(a) && isKiceRepairTarget(a)))
  const guided = guidedRepairAttempts(skill, taskKeys, activity)
  const firsts = [...retried, ...guided].filter((a) => a.isCorrect === true).map((a) => a.answeredAt as string).sort()
  return { at: firsts[0] ?? null, tried: retried.length + guided.length > 0, retried, guided }
}

export interface LifecycleEvidence {
  /** 바로잡기 완료 시각(막혔던 문항을 다시 맞힌 첫 시각) */
  repairAt: string | null
  /** 바로잡기 시도는 있지만 아직 못 맞힘 */
  repairTried: boolean
  /** 다른 글에 적용한 첫 시각 */
  transferAt: string | null
  /** 기록이 남는 적용 대상이 있는가 — 없으면 적용 칸은 「준비 중」 이고 지금 할 일에서 건너뛴다(기본 true) */
  transferReady?: boolean
  /**
   * LM-G1.2 적용 운영 진행 — 서로 다른 적용 문항 수 / 계획량(transferContract). 주어지면 「적용 마침」은 done ≥ planned 일 때만이다
   * (1회 경험 ≠ 2지문 계획 완료). 주지 않으면 예전처럼 첫 경험(transferAt)으로 본다(호환).
   */
  transferDone?: number
  transferPlanned?: number | null
}

export const NO_EVIDENCE: LifecycleEvidence = { repairAt: null, repairTried: false, transferAt: null }

type SkillLike = { status?: string; verifiedAt: string | null; verifiedItems: readonly string[]; check?: { wrongItems?: readonly string[]; lastWrongAt?: string | null } }

/**
 * 이번 회차의 바로잡기 창(LM-G1.1 — lifecycle · 계획이 같이 쓴다) — 바로잡을(막힌) 문항과 기록을 세기 시작하는 시각.
 *   다시 확인에서 막혔으면 바로잡을 문항은 그 막힌 문항들이고 그 뒤의 시도만 센다 — 예전 확정 문항 · 이전 성공은 승계하지 않는다(Codex P2).
 *   해소된 회차는 그 회차 안의 바로잡기 기록을 그대로 보인다(통과 뒤에 「다시 바로잡기」 를 요구하지 않는다).
 */
export function repairWindow(skill: SkillLike): { blocked: string[]; since: string } | null {
  if (!skill.verifiedAt) return null
  const recheck = skill.status !== 'resolved' && !!skill.check?.lastWrongAt && skill.check.lastWrongAt > skill.verifiedAt
  const blocked = recheck ? [...(skill.check?.wrongItems ?? [])] : [...new Set([...skill.verifiedItems, ...(skill.check?.wrongItems ?? [])])]
  return { blocked, since: recheck ? (skill.check!.lastWrongAt as string) : skill.verifiedAt }
}

/** 이번 회차 바로잡기 시도(시각 순) — 같은 과제 키 · 막힌 문항 · 창 시작 뒤. 정오는 그대로 둔다(성공은 호출부가 `=== true` 로만) */
export function repairAttempts<A extends Pick<ActivityRow, 'itemRef' | 'taskKey' | 'answeredAt'>>(skill: SkillLike, taskKeys: ReadonlySet<string>, activity: readonly A[]): A[] {
  const w = repairWindow(skill)
  if (!w) return []
  const blocked = new Set(w.blocked)
  return activity
    .filter((a) => a.answeredAt && a.answeredAt > w.since && taskKeys.has(a.taskKey) && a.itemRef !== null && blocked.has(a.itemRef))
    .sort((x, y) => (x.answeredAt as string).localeCompare(y.answeredAt as string))
}

export function lifecycleEvidence(
  skill: SkillLike | null,
  targets: readonly { itemRef: string; taskKey: string }[],
  activity: readonly ActivityRow[],
): LifecycleEvidence {
  if (!skill?.verifiedAt) return NO_EVIDENCE
  const since = skill.verifiedAt
  const keys = new Set(targets.map((t) => t.taskKey))
  const inBundle = new Set(targets.map((t) => t.itemRef))
  const after = activity
    .filter((a) => a.answeredAt && a.answeredAt > since && keys.has(a.taskKey))
    .sort((x, y) => (x.answeredAt as string).localeCompare(y.answeredAt as string))
  // 성공 = 정답(true) 만 — PLAN 과 같은 판정(repairSuccess). 틀림 · 정오 없음(null) 은 「바로잡는 중」 이다
  const repair = repairSuccess(skill, keys, activity)
  // 적용 = 확인 묶음 밖 문항 · 전이 단계. 교수 자료(안내 연습) 수행은 바로잡기라 적용 경험이 아니다(FI-011)
  const transferAt = after.find((a) => !isInstructional(a) && (a.phase === 'transfer' || (a.itemRef !== null && !inBundle.has(a.itemRef))))?.answeredAt ?? null
  return { repairAt: repair.at, repairTried: repair.tried, transferAt }
}

/** 지금 할 일 하나 — 생애주기 순서(바로잡기 → 적용 → 다시 확인). 처방이 열린 상태(verified · still_needed)에서만 */
export type LifecycleNext = 'repair' | 'transfer' | 'check' | null

export function nextLifecycleAction(status: string | null | undefined, ev: LifecycleEvidence): LifecycleNext {
  if (status !== 'verified' && status !== 'still_needed') return null
  if (!ev.repairAt) return 'repair'
  if (!transferFinished(ev) && ev.transferReady !== false) return 'transfer'
  return 'check'
}

/** 적용 단계를 마쳤는가 — 운영 진행이 주어지면 진행 ≥ 계획량, 아니면 예전대로 첫 경험(호환) */
export function transferFinished(ev: Pick<LifecycleEvidence, 'transferAt' | 'transferDone' | 'transferPlanned'>): boolean {
  if (ev.transferPlanned !== undefined) return ev.transferPlanned !== null && (ev.transferDone ?? 0) >= ev.transferPlanned
  return !!ev.transferAt
}

/**
 * LM-G1.2 — 다른 글에 적용(TRANSFER) 계약. 네 값을 섞지 않는다(정본 workspaces.json ws.central-meaning:
 * quantity_policy 「… + 전이 2지문 + …」 · criterion 「독립 확인(skill-diagnosis)」).
 *   experience 적용을 한 번이라도 했는가(기존 transferAt — 보존)
 *   progress   서로 다른 적용 문항 수 / 운영 계획량(정본 2지문 · 학습자가 저장한 계획량이 있으면 그것 · 자료 부족과 구분)
 *   ready      다음 교수 단계(다시 확인)로 넘어갈 운영 조건 — progress.done ≥ progress.planned 일 때만. 자료가 없으면 null(건너뜀 · 완료 아님)
 *   evidence   능력 주장은 하지 않는다 — 적용은 「경험」까지만 말하고, 독립 적용 능력은 CHECK(skill-diagnosis)가 판정한다
 * 같은 문항 반복 · 다른 TASK 키의 시도는 진행에 넣지 않는다(호출부 doneOf 와 같은 범위). 계획량 조정은 운영량만 바꾸고 숙달 기준을 바꾸지 않는다.
 */
export interface TransferContract {
  experience: boolean
  progress: { done: number; planned: number | null }
  ready: boolean | null
  evidence: 'none' | 'experience_only'
}

/** 운영 계획량 — 저장된 적용 계획량(1 이상)이 있으면 그것, 없으면 정본 기본(passages). 저장된 운영량도 자료 부족으로 자동 축소하지 않는다. 기본 운영량은 자료 부족으로 자동 축소하지 않는다. 가용 0 이면 null */
export function transferTarget(available: number | null | undefined, savedPlanned: number | null | undefined, passages: number): number | null {
  const cap = available ?? 0
  if (cap <= 0) return null
  const want = savedPlanned !== null && savedPlanned !== undefined && Number.isInteger(savedPlanned) && savedPlanned >= 1 ? savedPlanned : passages
  return want
}

export function transferContract(experienceAt: string | null, done: number, planned: number | null): TransferContract {
  return {
    experience: !!experienceAt || done > 0,
    progress: { done, planned },
    ready: planned === null ? null : done >= planned,
    evidence: done > 0 || experienceAt ? 'experience_only' : 'none',
  }
}

/** Exact source passage binding. Missing metadata in a current loader is not proof of a distinct passage. */
export function passageIdentity(item: string | null, key: string | null | undefined): string | null {
  return key === undefined ? item : key
}
