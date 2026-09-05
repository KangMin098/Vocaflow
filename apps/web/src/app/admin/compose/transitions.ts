// apps/web/src/app/admin/compose/transitions.ts
//
// 발주·취재 묶음의 상태 전이표 — **화면과 서버가 같은 표를 본다**.
//
// 왜 한 곳인가: 화면이 버튼을 그리는 조건(`status === 'pending'`)과 서버가 거는 조건
// (`.eq('status','pending')`)을 따로 적어 두면 둘이 조용히 갈린다. 실제로 갈려 있었다 —
// 스키마는 `drafted`·`failed` 를 허용하는데 화면에는 그 두 상태에서 누를 것이 하나도 없었고,
// 실패한 발주는 사유(last_error)만 보인 채 영원히 큐에 남았다(2026-09-06 발견).
//
// 이 파일은 서버 액션 파일('use server')이 아니다 — 'use server' 파일은 async 함수만
// 내보낼 수 있어서 표를 담을 수 없다. 그래서 표는 여기, 실행은 actions.ts.

/** 발주(article_compose_jobs)에서 사람이 누를 수 있는 동작. */
export type JobActionKey = 'cancel' | 'release' | 'retry' | 'discard'

export interface TransitionSpec<K extends string> {
  key: K
  /** 버튼 라벨 */
  label: string
  /** 이 동작이 허용되는 출발 상태 — 서버가 그대로 WHERE 절에 쓴다 */
  from: readonly string[]
  /** 도착 상태. null 이면 행을 지운다. */
  to: string | null
  /**
   * 확인창 문구. 없으면 묻지 않는다(되돌릴 수 있는 동작만).
   * 문구에는 **무엇이 바뀌고 되돌릴 수 있는지**를 적는다 — "정말입니까?" 는 아무 말도 안 한다.
   */
  confirm?: string
  /** 되돌릴 수 없는 동작인가 — 화면이 다르게 그린다. */
  destructive: boolean
}

export type JobActionSpec = TransitionSpec<JobActionKey>

/**
 * 발주 상태 전이표.
 *
 * 스키마 CHECK: pending · claimed · drafted · failed · done.
 *   done  — 아티클이 붙은 종착 상태라 여기서 되돌릴 것이 없다(고치려면 아티클을 고친다).
 *   drafted — 드레인이 초안까지 쓰고 마감하지 못한 상태. 되돌릴 길이 없으면 영영 큐에 남는다.
 */
export const JOB_ACTIONS: Record<JobActionKey, JobActionSpec> = {
  cancel: {
    key: 'cancel',
    label: '취소',
    from: ['pending'],
    to: null,
    confirm:
      '대기 중인 발주를 지웁니다.\n\n아직 아무도 집어가지 않은 발주만 지워집니다. 되돌리려면 같은 조건으로 다시 발주해야 합니다.',
    destructive: true,
  },
  release: {
    key: 'release',
    label: '회수',
    from: ['claimed'],
    to: 'pending',
    confirm:
      '진행 중인 발주를 대기로 되돌립니다.\n\n아직 살아 있는 세션이 이 발주를 쓰고 있으면 같은 글을 둘이 쓰게 됩니다. 30분이 지나면 저절로 회수되니 급하지 않으면 기다리세요.',
    destructive: false,
  },
  retry: {
    key: 'retry',
    label: '재시도',
    from: ['failed', 'drafted'],
    to: 'pending',
    confirm:
      '이 발주를 대기로 되돌려 드레인이 다시 잡게 합니다.\n\n시도 횟수와 지난 실패 사유는 지우지 않습니다 — 몇 번째 시도인지 알아야 언제 그만둘지 판단할 수 있습니다. 같은 사유로 또 막힐 것 같으면 ④ 원장을 먼저 고치세요.',
    destructive: false,
  },
  discard: {
    key: 'discard',
    label: '삭제',
    from: ['failed'],
    to: null,
    confirm:
      '실패한 발주를 지웁니다.\n\n되돌릴 수 없고 시도 기록과 실패 사유도 함께 사라집니다. 왜 실패했는지 남겨야 한다면 지우지 말고 그대로 두세요.',
    destructive: true,
  },
}

/** 이 상태에서 누를 수 있는 것 — 화면은 이 목록만 그리고, 서버는 같은 표로 검사한다. */
export function jobActionsFor(status: string): JobActionSpec[] {
  return Object.values(JOB_ACTIONS).filter((a) => a.from.includes(status))
}

// ── 취재 묶음 ────────────────────────────────────────────────────────

/** 취재 묶음(article_compose_batches)에서 사람이 누를 수 있는 동작. */
export type BatchActionKey = 'abandon' | 'restore' | 'purge'

export type BatchActionSpec = TransitionSpec<BatchActionKey>

const BATCH_LIVE = ['collecting', 'ledger_ready', 'composing'] as const

/**
 * 취재 묶음 전이표.
 *
 * 묶음은 만들기만 하고 치우는 길이 없어 목록이 늘기만 했다. 스키마에는 이미 `abandoned`
 * 가 있었는데 화면이 쓰지 않았다 — 폐기는 되돌릴 수 있고(복구), 완전 삭제는 이 묶음에서
 * 나온 지문이 하나도 없을 때만 된다(지문이 있으면 서버가 거부한다).
 */
export const BATCH_ACTIONS: Record<BatchActionKey, BatchActionSpec> = {
  abandon: {
    key: 'abandon',
    label: '폐기',
    from: [...BATCH_LIVE],
    to: 'abandoned',
    confirm:
      '이 취재 묶음을 폐기로 표시합니다.\n\n소스와 사실 카드는 그대로 남고 새 발주 선택지에서만 빠집니다. 언제든 복구할 수 있습니다.',
    destructive: false,
  },
  restore: {
    key: 'restore',
    label: '복구',
    from: ['abandoned'],
    to: 'collecting',
    destructive: false,
  },
  purge: {
    key: 'purge',
    label: '삭제',
    from: [...BATCH_LIVE, 'abandoned', 'done'],
    to: null,
    confirm:
      '취재 묶음을 소스·사실 카드·발주까지 함께 지웁니다.\n\n되돌릴 수 없습니다. 소스 본문은 어디에도 보관하지 않으므로 원장을 다시 만들려면 취재를 처음부터 다시 해야 합니다. 이 묶음에서 나온 지문이 하나라도 있으면 지워지지 않습니다.',
    destructive: true,
  },
}

export function batchActionsFor(status: string): BatchActionSpec[] {
  return Object.values(BATCH_ACTIONS).filter((a) => a.from.includes(status))
}

/** 새 발주를 받을 수 있는 묶음인가 — 폐기된 묶음에 발주하면 아무도 쓰지 않는다. */
export function batchAcceptsJobs(status: string): boolean {
  return (BATCH_LIVE as readonly string[]).includes(status)
}
