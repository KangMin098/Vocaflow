// apps/web/src/lib/dictation/neural-voice.ts
//
// 신경망 음성(Piper WASM) — 받아쓰기의 소리를 브라우저 복불복에서 꺼낸다.
//
// 왜 필요한가:
//   Web Speech API 는 **기기에 설치된 음성**에 전적으로 의존한다. 영어 음성이 없는
//   기기(설치 안 된 Windows·일부 안드로이드·리눅스)에서는 아무 소리도 나지 않는다.
//   기존 코드는 이 상황을 감지해 "음성이 없어요" 배너를 띄우는 데서 멈췄다 — 받아쓰기는
//   소리가 전부인 모듈인데 학습자에게 남는 건 안내문뿐이었다.
//
//   Piper 는 EchoMatch(v06.33)가 이미 쓰고 있는 자산이다(`lib/echo/piper-tts.ts`,
//   en_US-amy-medium). 첫 사용 시 모델을 내려받아 OPFS 에 캐시하므로 그 다음부터는
//   오프라인에서도 같은 목소리가 난다. 즉 **기기와 무관하게 일정한 듣기 환경**이 된다.
//
// 트레이드오프 (숨기지 않는다):
//   · 첫 사용 17MB 다운로드 — UI 가 진행률을 보여주고, 실패하면 Web Speech 로 되돌린다.
//   · 속도 조절은 AudioBufferSourceNode.playbackRate 라 **음높이도 함께 변한다**.
//     Web Speech 의 rate 는 음높이를 보존하므로, 시스템 음성이 있는 기기에서는 기본값을
//     Web Speech 로 둔다. 신경망 음성은 선택이거나, 시스템 음성이 없을 때의 구원책이다.
//
// 문장 캐시: autoRepeat 3회는 같은 문장을 세 번 읽는다. 합성은 한 번만 한다.

'use client'

import {
  DEFAULT_PIPER_VOICE,
  isPiperSupported,
  piperSynthesize,
} from '@/lib/echo/piper-tts'

const CACHE_LIMIT = 12
const cache = new Map<string, AudioBuffer>()

let audioCtx: AudioContext | null = null
function ctx(): AudioContext {
  if (!audioCtx) {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    audioCtx = new AC()
  }
  return audioCtx
}

export { isPiperSupported }

/** 합성 결과를 문장 단위로 재사용 (LRU — 가장 오래된 것부터 버린다). */
async function bufferFor(text: string): Promise<AudioBuffer> {
  const key = text.trim()
  const hit = cache.get(key)
  if (hit) {
    // 최근 사용으로 승격
    cache.delete(key)
    cache.set(key, hit)
    return hit
  }
  const { audioBuffer } = await piperSynthesize(key, DEFAULT_PIPER_VOICE)
  cache.set(key, audioBuffer)
  if (cache.size > CACHE_LIMIT) {
    const oldest = cache.keys().next().value
    if (oldest !== undefined) cache.delete(oldest)
  }
  return audioBuffer
}

/**
 * 신경망 음성 재생 컨트롤러 — AudioController(Web Speech)와 같은 표면을 갖는다.
 * 호출부(useAudioControl)가 엔진을 갈아끼우기만 하면 되도록.
 */
export class NeuralVoiceController {
  private source: AudioBufferSourceNode | null = null
  private cancelled = false

  /** 한 번 발화. 합성 실패 시 throw — 호출부가 Web Speech 로 되돌린다. */
  async speak(text: string, rate: number): Promise<void> {
    this.cancelled = false
    const buffer = await bufferFor(text)
    if (this.cancelled) return
    const c = ctx()
    if (c.state === 'suspended') await c.resume()

    return new Promise((resolve) => {
      const src = c.createBufferSource()
      src.buffer = buffer
      // playbackRate 는 음높이도 함께 바꾼다 — 파일 헤더의 트레이드오프 항목 참조.
      src.playbackRate.value = Math.max(0.5, Math.min(rate, 1.5))
      src.connect(c.destination)
      src.onended = () => {
        this.source = null
        resolve()
      }
      this.source = src
      src.start()
    })
  }

  /** 자동 반복 — 구간 사이 무음. 합성은 캐시 덕에 1회만 일어난다. */
  async repeat(
    text: string,
    times: number,
    rate: number,
    pauseMs: number,
    onIteration?: (current: number) => void,
  ): Promise<void> {
    for (let i = 0; i < times; i++) {
      if (this.cancelled) return
      onIteration?.(i + 1)
      await this.speak(text, rate)
      if (this.cancelled || i === times - 1) break
      await this.silence(pauseMs)
    }
  }

  cancel(): void {
    this.cancelled = true
    if (this.source) {
      try {
        this.source.stop()
      } catch {
        /* 이미 끝난 소스 — 무시 */
      }
      this.source = null
    }
  }

  private silence(ms: number): Promise<void> {
    return new Promise((resolve) => {
      const started = Date.now()
      const tick = setInterval(() => {
        if (this.cancelled || Date.now() - started >= ms) {
          clearInterval(tick)
          resolve()
        }
      }, 80)
    })
  }
}

/** 다음 문장을 미리 합성해 둔다 — 재생 버튼을 눌렀을 때의 침묵을 없앤다. */
export function prewarm(text: string): void {
  if (!text || !isPiperSupported()) return
  void bufferFor(text).catch(() => {
    /* 선합성 실패는 조용히 — 실제 재생 시 다시 시도한다 */
  })
}
