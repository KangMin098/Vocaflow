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

  private disposed = false

  /**
   * @param allow 실행 시점 허용 판정 — toggle 이 불릴 때마다 동기로 다시 묻는다(렌더 때 판정을 믿지 않는다).
   */
  constructor(
    private readonly speaker: RelistenSpeaker,
    private readonly allow: () => boolean = () => true,
  ) {}

  /** 화면에 붙을 때 활성화(폐기 해제). */
  activate(): void {
    this.disposed = false
  }

  /** 허용 신호가 바뀌었을 때 — 지금 허용되지 않으면 진행 중 발화를 끊는다. */
  revalidate(): void {
    if (this.disposed) return
    if (!this.allow()) this.stopOwn()
  }

  /** snapshot 폐기 · 화면 이탈 — 진행 중 발화를 끊고 이후 toggle 은 영구히 발화하지 않는다. */
  dispose(): void {
    // 자기 발화가 있을 때만 끊는다 — 음성 엔진 취소는 기기 전역이라 다른 view 의 발화를 끊을 수 있다.
    this.stopOwn()
    this.disposed = true
  }

  /** 이 플레이어가 재생 중일 때만 정지(공용 cancel 을 남의 발화에 쓰지 않는다). */
  private stopOwn(): void {
    if (this.playing !== null) this.stop()
    else this.token++
  }

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
    // 폐기됐거나 지금 허용되지 않으면(다른 계정 · 확인 중 · 다른 요청 결과) 발화 0, 진행 중 발화도 끊는다.
    // 폐기된 view 의 콜백은 완전한 no-op — stop/cancel 도 하지 않는다(다른 view 의 발화를 끊지 않게).
    if (this.disposed) return
    // 지금 허용되지 않으면(다른 계정 · 확인 중 · 다른 요청 결과) 발화 0, 자기 발화만 끊는다.
    if (!this.allow()) {
      this.stopOwn()
      return
    }
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
    if (this.disposed) return
    this.token++
    this.speaker.cancel()
    this.set(null)
  }
}
