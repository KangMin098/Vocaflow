// apps/web/src/lib/echo/replay-controller.ts
//
// EchoMatch 결과 화면의 「다시 듣기」 — 이미 만든 예시(Piper 캐시)와 이번 녹음 버퍼를 다시 재생한다.
// 이 화면이 소유한 재생은 한 번에 하나다. 새 재생 · 정지 · 문장/계정 전환 · 이탈은 앞선 재생을 끊고,
// 세대를 올려 그 전에 출발한 재생의 늦은 완료 · 실패를 버린다.
// 재생은 학습 도움일 뿐 — 녹음 · 인식 · 저장 · 점수 · SRS 를 부르지 않는다(호출 대상은 주입된 play 하나).

export type ReplayTarget = 'reference' | 'self'

export interface ReplayState {
  /** 지금 재생 중인 것 */
  playing: ReplayTarget | null
  /** 마지막 재생이 실패한 것 — 재생 오류일 뿐 당시 결과를 바꾸지 않는다 */
  failed: ReplayTarget | null
}

export type ReplayPlay = (buffer: AudioBuffer, opts: { signal: AbortSignal }) => Promise<void>

export const IDLE_REPLAY: ReplayState = { playing: null, failed: null }

export class EchoReplay {
  private abort: AbortController | null = null
  private gen = 0
  private disposed = false

  constructor(
    private readonly play: ReplayPlay,
    private readonly onChange: (s: ReplayState) => void,
  ) {}

  start(target: ReplayTarget, buffer: AudioBuffer): void {
    if (this.disposed) return
    this.cut()
    const g = this.gen
    const ac = new AbortController()
    this.abort = ac
    this.onChange({ playing: target, failed: null })
    let p: Promise<void>
    try {
      p = this.play(buffer, { signal: ac.signal })
    } catch (e) {
      p = Promise.reject(e)
    }
    p.then(
      () => {
        if (g !== this.gen || this.disposed) return
        this.abort = null
        this.onChange(IDLE_REPLAY)
      },
      () => {
        if (g !== this.gen || this.disposed) return
        this.abort = null
        this.onChange({ playing: null, failed: target })
      },
    )
  }

  /** 정지 · 재시도 · 문장 이동 · 숨김 — 재생을 끊고 상태를 비운다. */
  stop(): void {
    if (this.disposed) return
    this.cut()
    this.onChange(IDLE_REPLAY)
  }

  /** 이탈 · 계정 경계 해제 — 끊기만 하고 더는 알리지 않는다. */
  dispose(): void {
    this.cut()
    this.disposed = true
  }

  private cut(): void {
    this.gen += 1
    this.abort?.abort()
    this.abort = null
  }
}

/** 문장 자료 결속 키 — 같은 문장 id 라도 내용이 바뀌면 다른 문장이다(캐시 · 녹음 · 점수를 넘기지 않는다). */
export function sentenceMaterialKey(s: { id: string; text: string }): string {
  return `${s.id}\u0000${s.text}`
}

export interface ReplayTake {
  materialKey: string
  buffer: AudioBuffer
  /** 녹음을 붙잡을 때의 계정 경계 세대(StoryAuthGuard.token) */
  authToken: number
}

/**
 * 다시 듣기 시작 시점 판정 — 이미 잡힌 콜백이 늦게 불려도 여기서 막는다.
 * 결과 화면 · 보이는 탭 · 계정 경계 same(녹음은 붙잡은 세대 그대로) · 지금 문장 자료와 같은 버퍼일 때만 버퍼를 준다.
 */
export function replayBufferAt(input: {
  target: ReplayTarget
  scored: boolean
  hidden: boolean
  materialKey: string | null
  reference: { materialKey: string; buffer: AudioBuffer } | undefined
  take: ReplayTake | null
  guard: { getStatus(): string; isCurrent(token: number): boolean }
}): AudioBuffer | null {
  const { target, scored, hidden, materialKey, reference, take, guard } = input
  if (!scored || hidden || materialKey === null) return null
  if (guard.getStatus() !== 'same') return null
  if (target === 'reference') return reference?.materialKey === materialKey ? reference.buffer : null
  if (!take || take.materialKey !== materialKey || !guard.isCurrent(take.authToken)) return null
  return take.buffer
}
