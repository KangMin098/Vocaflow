// apps/web/src/lib/dictation/results-relisten.ts
//
// 결과 화면 「다시 듣기」 — 저장된 정답 문장을 **현재 기기 음성으로** 다시 읽는다.
// 당시 원음·속도를 재현하지 않는다. 재생 횟수·힌트·정답률·FSRS 등 어떤 기록도 쓰지 않는다.
//
// 행 전환·정지·화면 이탈·계정 변경 때 기존 AudioController.cancel() 을 쓴다.
// 취소 뒤 늦게 끝난 발화 Promise 가 새 재생 상태를 지우지 않도록 토큰으로 최신 여부만 본다.

export interface RelistenSpeaker {
  speak: (text: string) => Promise<void>
  cancel: () => void
}

export class ResultsRelisten {
  private token = 0
  private playing: number | null = null
  private readonly listeners = new Set<() => void>()

  constructor(private readonly speaker: RelistenSpeaker) {}

  get playingIdx(): number | null {
    return this.playing
  }

  subscribe = (fn: () => void): (() => void) => {
    this.listeners.add(fn)
    return () => {
      this.listeners.delete(fn)
    }
  }

  getPlaying = (): number | null => this.playing

  private set(next: number | null) {
    if (this.playing === next) return
    this.playing = next
    for (const fn of this.listeners) fn()
  }

  /** 같은 행이면 정지, 다른 행이면 이전 발화를 끊고 그 문장을 읽는다. */
  toggle(idx: number, text: string): void {
    if (this.playing === idx) {
      this.stop()
      return
    }
    const mine = ++this.token
    this.speaker.cancel()
    this.set(idx)
    void this.speaker.speak(text).then(
      () => {
        if (mine === this.token) this.set(null)
      },
      () => {
        if (mine === this.token) this.set(null)
      },
    )
  }

  stop(): void {
    this.token++
    this.speaker.cancel()
    this.set(null)
  }
}
