// apps/web/src/lib/csat/lecture/player.ts
//
// **강의 재생 엔진 — 큐를 차례로 읽고, 지금 가리킬 곳을 알린다.**
//
// React 를 모른다. 어댑터(`tts.ts`)를 받아 큐를 하나씩 넘기고, 상태가 바뀔 때마다
// `onState` 를 부른다. 화면은 그 상태의 `target` 만 보고 하이라이트를 옮긴다.
//
// 규칙:
//   · 큐가 끝나면 `pause_after_ms` 동안 **하이라이트를 붙들고** 있다가 다음으로 간다
//   · 건너뛰기(이전·다음·특정 큐)는 **지금 발화를 끝까지 취소한 뒤** 시작한다 — 겹치면
//     새 큐의 첫 문장이 옛 큐의 취소에 함께 휩쓸려 사라진다
//   · 탭을 떠나면 멈추고, 돌아오면 이어서 읽는다(멈춤을 사람이 걸었으면 그대로 둔다)
//   · 기록(`log`)을 남긴다 — Gate 0·2 의 자동 검사가 이것으로 유실·지연·어긋남을 잰다

import type { CueOutcome, TtsAdapter } from './tts'
import type { Lecture, LectureCue, LectureTarget } from './types'

export type PlayerStatus = 'idle' | 'playing' | 'paused' | 'ended'

export interface PlayerState {
  status: PlayerStatus
  index: number
  target: LectureTarget | null
  /** 큐는 끝났고 다음으로 넘어가기 전 붙들고 있는 중 */
  holding: boolean
  rate: number
}

export interface PlayerLogEntry {
  t: number
  type: 'cue-start' | 'cue-end' | 'hold-end' | 'pause' | 'resume' | 'jump' | 'ended'
  cue?: string
  index?: number
  outcome?: CueOutcome
  /** 이 큐 뒤에 붙들기로 한 시간(ms) — 앞당김을 뺀 값. 검사는 이것과 실제를 견준다 */
  holdMs?: number
}

export const RATES = [0.9, 1, 1.15] as const

export class LecturePlayer {
  readonly log: PlayerLogEntry[] = []
  private state: PlayerState
  private run = 0
  private current: Promise<unknown> | null = null
  private holdTimer: ReturnType<typeof setTimeout> | null = null
  private holdResolve: (() => void) | null = null
  private pausedByUser = false
  private pausedByHidden = false
  private onVis = () => this.visibility()

  constructor(
    private lecture: Lecture,
    private adapter: TtsAdapter,
    private onState: (s: PlayerState) => void,
    private now: () => number = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()),
  ) {
    this.state = { status: 'idle', index: 0, target: null, holding: false, rate: 1 }
    if (typeof document !== 'undefined') document.addEventListener('visibilitychange', this.onVis)
  }

  get cues(): LectureCue[] {
    return this.lecture.cues
  }

  getState(): PlayerState {
    return this.state
  }

  private set(p: Partial<PlayerState>) {
    this.state = { ...this.state, ...p }
    this.onState(this.state)
  }

  private note(e: Omit<PlayerLogEntry, 't'>) {
    this.log.push({ t: Math.round(this.now()), ...e })
  }

  setRate(rate: number) {
    this.adapter.setRate(rate)
    this.set({ rate })
  }

  /** i번째 큐부터 읽는다. 읽고 있던 것은 끝까지 취소하고 시작한다. */
  async play(from = this.state.index) {
    const index = Math.max(0, Math.min(this.cues.length - 1, from))
    const my = ++this.run
    this.pausedByUser = false
    this.pausedByHidden = false
    await this.stopCurrent()
    if (my !== this.run) return
    this.adapter.resume()
    this.note({ type: 'jump', index })
    this.set({ status: 'playing', index, target: this.cues[index]?.target ?? null, holding: false })
    this.current = this.loop(my, index)
  }

  private async stopCurrent() {
    this.adapter.cancel()
    this.releaseHold()
    if (this.current) await this.current.catch(() => {})
    this.current = null
  }

  private async loop(my: number, start: number) {
    for (let i = start; i < this.cues.length; i += 1) {
      if (my !== this.run) return
      const cue = this.cues[i]
      this.set({ index: i, target: cue.target, holding: false })
      this.note({ type: 'cue-start', cue: cue.id, index: i })
      const outcome = await this.adapter.speak(cue)
      if (my !== this.run || outcome.cancelled) return
      // 다음 큐의 발화 준비 시간만큼 먼저 출발한다 — 들리는 쉼 = 대본의 쉼.
      // 앞당김은 이동평균이라 강의 중에 바뀐다 → 그때 쓴 값을 기록에 남긴다(검사가 마지막 값으로 재면 틀린다)
      const isLast = i === this.cues.length - 1
      const holdMs = isLast ? cue.pause_after_ms : Math.max(0, cue.pause_after_ms - this.adapter.leadMs)
      this.note({ type: 'cue-end', cue: cue.id, index: i, outcome, holdMs })
      // 끝난 큐의 하이라이트를 붙든다 — 들은 것을 눈으로 한 번 더 확인할 틈
      this.set({ holding: true })
      await this.hold(holdMs)
      if (my !== this.run) return
      this.note({ type: 'hold-end', cue: cue.id, index: i })
    }
    if (my !== this.run) return
    this.note({ type: 'ended' })
    this.set({ status: 'ended', holding: false })
  }

  /**
   * 붙들기 — **타이머 하나로 정확히.** 처음에는 100ms 틱으로 셌는데, 틱이 남은 시간을 올림해
   * 쉼이 최대 100ms + 지터만큼 길어졌다(Gate 2 실측 +157ms). 멈추면 남은 시간을 떼어 두고,
   * 재개하면 그만큼만 다시 건다.
   */
  private holdRemaining = 0
  private holdStartedAt = 0

  private hold(ms: number): Promise<void> {
    return new Promise((resolve) => {
      this.holdResolve = resolve
      if (ms <= 0) return this.releaseHold()
      this.holdRemaining = ms
      if (this.state.status !== 'paused') this.armHold()
    })
  }

  private armHold() {
    if (!this.holdResolve || this.holdTimer != null) return
    this.holdStartedAt = this.now()
    this.holdTimer = setTimeout(() => {
      this.holdTimer = null
      this.releaseHold()
    }, this.holdRemaining)
  }

  private suspendHold() {
    if (this.holdTimer == null) return
    clearTimeout(this.holdTimer)
    this.holdTimer = null
    this.holdRemaining = Math.max(0, this.holdRemaining - (this.now() - this.holdStartedAt))
  }

  private releaseHold() {
    if (this.holdTimer != null) clearTimeout(this.holdTimer)
    this.holdTimer = null
    this.holdRemaining = 0
    const r = this.holdResolve
    this.holdResolve = null
    r?.()
  }

  pause() {
    if (this.state.status !== 'playing') return
    this.pausedByUser = true
    this.suspendHold()
    this.adapter.pause()
    this.note({ type: 'pause', index: this.state.index })
    this.set({ status: 'paused' })
  }

  resume() {
    if (this.state.status === 'ended' || this.state.status === 'idle') return void this.play(this.state.status === 'ended' ? 0 : this.state.index)
    if (this.state.status !== 'paused') return
    this.pausedByUser = false
    this.pausedByHidden = false
    this.adapter.resume()
    this.note({ type: 'resume', index: this.state.index })
    this.set({ status: 'playing' })
    this.armHold()
  }

  toggle() {
    if (this.state.status === 'playing') this.pause()
    else this.resume()
  }

  next() {
    return this.play(Math.min(this.cues.length - 1, this.state.index + 1))
  }

  prev() {
    return this.play(Math.max(0, this.state.index - 1))
  }

  /** 특정 큐부터 — 진행바 눈금을 누른 경우 */
  jump(index: number) {
    return this.play(index)
  }

  private visibility() {
    if (typeof document === 'undefined') return
    if (document.hidden && this.state.status === 'playing') {
      this.pausedByHidden = true
      this.suspendHold()
      this.adapter.pause()
      this.note({ type: 'pause', index: this.state.index })
      this.set({ status: 'paused' })
    } else if (!document.hidden && this.pausedByHidden && !this.pausedByUser) {
      this.pausedByHidden = false
      this.adapter.resume()
      this.note({ type: 'resume', index: this.state.index })
      this.set({ status: 'playing' })
      this.armHold()
    }
  }

  destroy() {
    this.run += 1
    this.adapter.cancel()
    this.releaseHold()
    if (typeof document !== 'undefined') document.removeEventListener('visibilitychange', this.onVis)
  }
}
