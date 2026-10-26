// apps/web/src/components/library/story/story-reader-session.ts
//
// 독서 화면의 저장 흐름(위치 기록 · 단위 완료) — 프레임워크 없는 상태 기계. 화면은 useSyncExternalStore 로 읽는다.
// 계약: docs/LCP_STORY.md §12(위치 ≠ 완료) · §17(성공한 저장만 이벤트).
//
// - **보내기 전 문**: 브라우저 인증 경계가 「지금 브라우저 사용자 = 서버가 그린 viewerId」를 긍정 확인(same)했을 때만 액션을 부른다.
//   확인 전(checking) · 바뀜(changed) · 서버 거부 뒤(denied)에는 시작 · 이동 · 완료 · 다시 시도 모두 액션을 0번 부른다.
//   모든 입력에 expectedViewerId(= 서버 viewerId)를 싣는다 — 서버가 지금 쿠키 세션과 다르면 viewer_changed 로 거부한다.
// - 위치는 명시적 시작 · 이어 읽기 · 이동 클릭에서만 기록한다. 기록이 성공해야 이동한다. 위치 요청은 한 번에 하나다.
// - 완료는 「이 단위 읽음 표시」 버튼으로만. 단위마다 한 번에 하나(같은 단위 연타는 무시) · 다른 단위는 동시에 가능.
// - 결과는 (인증 세대 · 결과 주인 = 화면 주인 · 요청 순번 · 발행 키 · 단위 번호)가 모두 맞을 때만 반영한다. 아니면 버린다.
//   버린 결과는 이벤트 · 이동 · 성공 문구를 만들지 않는다.
// - **서버 거부**(계정 차단 · 판본 닫힘 · 단위 없음 · 사용자 바뀜 · 로그인 필요): 이미 읽은 화면이라도 개인 내용을 즉시 지우도록
//   denied 로 고정하고 refresh 를 불러 서버가 맞는 상태(blocked · unavailable · signed_out)를 다시 그리게 한다.
// - 그 밖의 실패는 사실대로 남기고, 다시 시도는 같은 요청 내용을 다시 보낸다.
// - 완료 수는 단조 증가라 순서가 뒤바뀐 응답도 큰 값을 남긴다(낡은 작은 값이 덮지 않는다).

import type { PublicEvent } from '@/lib/analytics/events'
import type {
  StoryCompleteInput,
  StoryCompletionLabel,
  StoryCoverage,
  StoryKind,
  StoryLearnerFailure,
  StoryLearnerFailureCode,
  StoryLearnerResult,
  StoryPositionInput,
  StoryPositionReason,
  StoryPositionResult,
  StoryUnitCompletionResult,
} from '@/lib/library/story/learner-types'

import { completionWording, readerHref, unitLabel } from './story-view'

export type { StoryCompleteInput, StoryPositionInput }

export interface StoryReaderActions {
  recordPosition(input: StoryPositionInput): Promise<StoryLearnerResult<StoryPositionResult>>
  completeUnit(input: StoryCompleteInput): Promise<StoryLearnerResult<StoryUnitCompletionResult>>
}

/** 세션이 쓰는 인증 경계의 부분(StoryAuthGuard 가 만족한다). */
export interface StoryReaderAuth {
  token(): number
  /** 긍정 확인(same) 상태이고 세대가 같은가 — checking 은 거짓이다. */
  isCurrent(token: number): boolean
  accepts(token: number, resultOwner: string): boolean
  invalidate(): void
}

export type StoryReaderRetry = { kind: 'position'; input: StoryPositionInput } | { kind: 'complete'; input: StoryCompleteInput }

export type StoryReaderStatus =
  | { tone: 'pending'; message: string }
  | { tone: 'done'; message: string }
  | { tone: 'error'; message: string; detail: string | null; retry: StoryReaderRetry | null }

/** 서버가 신뢰할 수 있게 거부한 이유 — 개인 내용을 지우고 다시 불러온다. */
export type StoryReaderDenialCode = Extract<
  StoryLearnerFailureCode,
  'account_blocked' | 'release_unavailable' | 'unit_not_found' | 'viewer_changed' | 'auth_required'
>

export const DENIAL_CODES: readonly StoryReaderDenialCode[] = [
  'account_blocked',
  'release_unavailable',
  'unit_not_found',
  'viewer_changed',
  'auth_required',
]

export const DENIAL_TITLE: Record<StoryReaderDenialCode, string> = {
  account_blocked: '이 계정으로는 지금 읽을 수 없어요',
  release_unavailable: '이 판본은 지금 열 수 없어요',
  unit_not_found: '이 단위를 찾을 수 없어요',
  viewer_changed: '로그인한 계정이 바뀌었어요',
  auth_required: '로그인이 필요해요',
}

export interface StoryReaderSnapshot {
  /** 진행 중인 위치 요청(있으면 다른 위치 행동은 잠긴다). */
  navPending: { unitIndex: number; reason: StoryPositionReason } | null
  /** 완료 요청이 진행 중인 단위들. */
  completing: readonly number[]
  /** 이 화면에서 완료 성공을 받은 단위들(서버 목차 표시와 합쳐 그린다). */
  completedLocal: readonly number[]
  /** 성공 응답이 말한 완료 수 중 가장 큰 값. */
  counts: { completedUnitCount: number; completed: boolean } | null
  status: StoryReaderStatus | null
  /** 서버 거부 — 있으면 화면은 개인 내용을 그리지 않는다. */
  denied: { code: StoryReaderDenialCode; message: string } | null
}

export interface StoryReaderSessionOptions {
  releaseKey: string
  /** 서버가 그린 화면의 본인 uid — 입력의 expectedViewerId 로만 싣는다(DOM · 이벤트 · 저장소에 싣지 않는다). */
  viewerId: string
  unitCount: number
  kind: StoryKind
  coverage: StoryCoverage
  completionLabel: StoryCompletionLabel
  unitTitles: ReadonlyArray<string | null>
  actions: StoryReaderActions
  auth: StoryReaderAuth
  navigate: (href: string) => void
  emit: (event: PublicEvent) => void
  /** 서버 거부 뒤 서버 상태를 다시 받는다(화면 기본 router.refresh). */
  refresh: () => void
}

const EMPTY: StoryReaderSnapshot = { navPending: null, completing: [], completedLocal: [], counts: null, status: null, denied: null }

export const POSITION_FAILED = '위치를 저장하지 못했어요 — 다시 시도해 주세요'
export const COMPLETE_FAILED = '읽음 표시를 저장하지 못했어요 — 다시 시도해 주세요'

function temporaryFailure(): StoryLearnerFailure {
  return { ok: false, code: 'temporary', message: '서버에 연결하지 못했어요.', retryable: true }
}

function isDenial(code: StoryLearnerFailureCode): code is StoryReaderDenialCode {
  return (DENIAL_CODES as readonly string[]).includes(code)
}

export class StoryReaderSession {
  private snap: StoryReaderSnapshot = EMPTY
  private readonly listeners = new Set<() => void>()
  private navSeq = 0
  private readonly completeSeq = new Map<number, number>()
  private seq = 0
  /** 화면이 떠나면(언마운트 · 발행본 교체) 올린다 — 그 전에 출발한 결과는 버린다. */
  private epoch = 0

  constructor(private readonly opts: StoryReaderSessionOptions) {}

  get releaseKey(): string {
    return this.opts.releaseKey
  }

  readonly getSnapshot = (): StoryReaderSnapshot => this.snap

  readonly subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /** 지금 액션을 보낼 수 있는가 — 인증 긍정 확인 · 서버 거부 없음. */
  canSend(): boolean {
    return this.snap.denied === null && this.opts.auth.isCurrent(this.opts.auth.token())
  }

  /** 진행 중 결과를 모두 낡게 만든다(상태는 비운다). 세션은 계속 쓸 수 있다. */
  detach(): void {
    this.epoch += 1
    this.navSeq += 1
    this.completeSeq.clear()
    this.update(EMPTY)
  }

  /** 서버가 새 상태를 다시 그렸을 때(같은 사람 · 같은 판본) 거부 표시를 거둔다. */
  clearDenial(): void {
    if (this.snap.denied) this.update({ ...this.snap, denied: null, status: null })
  }

  /** 시작 · 이어 읽기 · 이동 — 위치 기록이 성공하면 이벤트를 보내고 그 단위로 이동한다. */
  async go(unitIndex: number, reason: StoryPositionReason): Promise<void> {
    if (this.snap.navPending || !this.canSend()) return
    if (!Number.isInteger(unitIndex) || unitIndex < 0 || unitIndex >= this.opts.unitCount) return
    await this.sendPosition({ releaseKey: this.opts.releaseKey, unitIndex, reason, expectedViewerId: this.opts.viewerId })
  }

  /** 이 단위 읽음 표시 — 같은 단위의 요청이 진행 중이면 무시한다. */
  async complete(unitIndex: number): Promise<void> {
    if (this.snap.completing.includes(unitIndex) || !this.canSend()) return
    if (!Number.isInteger(unitIndex) || unitIndex < 0 || unitIndex >= this.opts.unitCount) return
    await this.sendComplete({ releaseKey: this.opts.releaseKey, unitIndex, expectedViewerId: this.opts.viewerId })
  }

  /** 마지막 실패를 같은 내용으로 다시 보낸다. */
  async retry(): Promise<void> {
    const status = this.snap.status
    if (!status || status.tone !== 'error' || !status.retry || !this.canSend()) return
    const retry = status.retry
    if (retry.kind === 'position') {
      if (this.snap.navPending) return
      await this.sendPosition(retry.input)
    } else {
      if (this.snap.completing.includes(retry.input.unitIndex)) return
      await this.sendComplete(retry.input)
    }
  }

  dismissStatus(): void {
    if (this.snap.status && !this.snap.denied) this.update({ ...this.snap, status: null })
  }

  /**
   * 서버 거부 — 개인 내용 폐기 · 이유 표시 · 서버 상태 다시 받기. 거부 뒤에는 어떤 액션도 보내지 않는다(canSend).
   * 인증 경계는 건드리지 않는다 — 이유(차단 · 닫힘 · 로그인 · 계정 바뀜)를 그대로 보여 주고, 서버가 다시 그린 상태가 다음 판정을 한다.
   */
  private deny(failure: StoryLearnerFailure & { code: StoryReaderDenialCode }): void {
    this.epoch += 1
    this.navSeq += 1
    this.completeSeq.clear()
    this.update({
      ...EMPTY,
      denied: { code: failure.code, message: failure.message || DENIAL_TITLE[failure.code] },
    })
    this.opts.refresh()
  }

  private async sendPosition(input: StoryPositionInput): Promise<void> {
    const seq = ++this.seq
    this.navSeq = seq
    const epoch = this.epoch
    const token = this.opts.auth.token()
    this.update({
      ...this.snap,
      navPending: { unitIndex: input.unitIndex, reason: input.reason },
      status: { tone: 'pending', message: '위치를 저장하는 중…' },
    })

    let result: StoryLearnerResult<StoryPositionResult>
    try {
      result = await this.opts.actions.recordPosition({ ...input })
    } catch {
      result = temporaryFailure()
    }

    // 낡은 결과: 화면이 떠났거나 · 더 새 위치 요청이 있거나 · 인증이 바뀌었다.
    if (epoch !== this.epoch || seq !== this.navSeq || !this.opts.auth.isCurrent(token)) return

    if (!result.ok) {
      if (isDenial(result.code)) {
        this.deny({ ...result, code: result.code })
        return
      }
      this.update({
        ...this.snap,
        navPending: null,
        status: { tone: 'error', message: POSITION_FAILED, detail: result.message || null, retry: result.retryable ? { kind: 'position', input } : null },
      })
      return
    }

    const data = result.data
    if (!this.opts.auth.accepts(token, data.viewerId)) {
      // 다른 주인의 응답 — 이 화면의 개인 내용을 더 보이지 않는다.
      this.opts.auth.invalidate()
      return
    }
    if (data.releaseKey !== input.releaseKey || data.unitCount !== this.opts.unitCount) {
      this.update({
        ...this.snap,
        navPending: null,
        status: { tone: 'error', message: POSITION_FAILED, detail: '저장 결과를 확인하지 못했어요.', retry: { kind: 'position', input } },
      })
      return
    }

    this.update({
      ...this.snap,
      navPending: null,
      counts: mergeCounts(this.snap.counts, data.completedUnitCount, data.completed),
      status: null,
    })
    this.opts.emit({
      name: 'story_reader_action',
      props: {
        action: input.reason,
        kind: this.opts.kind,
        coverage: this.opts.coverage,
        unit_index: input.unitIndex,
        completed: data.completed,
      },
    })
    this.opts.navigate(readerHref(input.releaseKey, input.unitIndex))
  }

  private async sendComplete(input: StoryCompleteInput): Promise<void> {
    const seq = ++this.seq
    this.completeSeq.set(input.unitIndex, seq)
    const epoch = this.epoch
    const token = this.opts.auth.token()
    this.update({
      ...this.snap,
      completing: [...this.snap.completing.filter((u) => u !== input.unitIndex), input.unitIndex],
      status: { tone: 'pending', message: '읽음 표시를 저장하는 중…' },
    })

    let result: StoryLearnerResult<StoryUnitCompletionResult>
    try {
      result = await this.opts.actions.completeUnit({ ...input })
    } catch {
      result = temporaryFailure()
    }

    if (epoch !== this.epoch || this.completeSeq.get(input.unitIndex) !== seq || !this.opts.auth.isCurrent(token)) return
    this.completeSeq.delete(input.unitIndex)
    const completing = this.snap.completing.filter((u) => u !== input.unitIndex)

    if (!result.ok) {
      if (isDenial(result.code)) {
        this.deny({ ...result, code: result.code })
        return
      }
      this.update({
        ...this.snap,
        completing,
        status: { tone: 'error', message: COMPLETE_FAILED, detail: result.message || null, retry: result.retryable ? { kind: 'complete', input } : null },
      })
      return
    }

    const data = result.data
    if (!this.opts.auth.accepts(token, data.viewerId)) {
      this.opts.auth.invalidate()
      return
    }
    if (data.releaseKey !== input.releaseKey || data.unitIndex !== input.unitIndex || data.unitCount !== this.opts.unitCount) {
      this.update({
        ...this.snap,
        completing,
        status: { tone: 'error', message: COMPLETE_FAILED, detail: '저장 결과를 확인하지 못했어요.', retry: { kind: 'complete', input } },
      })
      return
    }

    const completedLocal = this.snap.completedLocal.includes(input.unitIndex)
      ? this.snap.completedLocal
      : [...this.snap.completedLocal, input.unitIndex].sort((a, b) => a - b)
    const counts = mergeCounts(this.snap.counts, data.completedUnitCount, data.completed)
    const wording = completionWording(
      { completedUnitCount: counts.completedUnitCount, unitCount: this.opts.unitCount, completed: counts.completed },
      this.opts.completionLabel,
      this.opts.coverage,
    )
    const label = unitLabel(input.unitIndex, this.opts.unitTitles[input.unitIndex] ?? null)
    const message = wording ? `${label} — 읽음으로 표시했어요 · ${wording.text}` : `${label} — 읽음으로 표시했어요`
    this.update({ ...this.snap, completing, completedLocal, counts, status: { tone: 'done', message } })
    this.opts.emit({
      name: 'story_reader_action',
      props: {
        action: 'unit_complete',
        kind: this.opts.kind,
        coverage: this.opts.coverage,
        unit_index: input.unitIndex,
        completed: data.completed,
      },
    })
  }

  private update(next: StoryReaderSnapshot): void {
    this.snap = next
    for (const listener of [...this.listeners]) listener()
  }
}

function mergeCounts(
  previous: StoryReaderSnapshot['counts'],
  completedUnitCount: number,
  completed: boolean,
): { completedUnitCount: number; completed: boolean } {
  return {
    completedUnitCount: Math.max(previous?.completedUnitCount ?? 0, completedUnitCount),
    completed: (previous?.completed ?? false) || completed,
  }
}

/** 화면이 개인 내용을 그려도 되는가. denied · changed 면 아니다(checking 은 서버 첫 내용을 보이되 조작은 잠근다). */
export function readerVisibility(
  authStatus: 'checking' | 'same' | 'changed',
  denied: StoryReaderSnapshot['denied'],
): 'private' | 'denied' | 'auth_changed' {
  if (denied) return 'denied'
  if (authStatus === 'changed') return 'auth_changed'
  return 'private'
}

/**
 * 서버 판정 상태별 인증 바뀜 처리.
 * - ready(개인 내용이 있는 유일한 상태): 바뀌면 「로그인 상태가 바뀌었어요」 화면 + 서버 상태 다시 받기(경계마다 한 번).
 * - signed_out: 개인 내용이 없다 — 화면은 로그인 안내 그대로, 브라우저가 실제로 로그인돼 있으면 한 번만 다시 받는다.
 * - blocked · unavailable: 개인 내용이 없다 — 서버가 말한 실제 이유를 그대로 보인다. 바뀜 화면 · 자동 새로 고침 없음.
 */
export function readerAuthDecision(
  stateStatus: 'ready' | 'signed_out' | 'blocked' | 'unavailable',
  authStatus: 'checking' | 'same' | 'changed',
): { authChangedView: boolean; autoRefresh: boolean } {
  const changed = authStatus === 'changed'
  if (stateStatus === 'ready') return { authChangedView: changed, autoRefresh: changed }
  if (stateStatus === 'signed_out') return { authChangedView: false, autoRefresh: changed }
  return { authChangedView: false, autoRefresh: false }
}
