// apps/web/src/lib/dictation/__tests__/audio-control.test.ts
//
// **정지한 뒤에도 다시 재생되는가.**
//
// 사용자 신고 2026-08-16 "재생 버튼 안됨" 의 실체가 여기 있었다:
//   `cancel()` 이 `cancelled = true` 를 세우는데 `speak()` 는 그것을 **리셋하기 전에 검사**했다.
//   그래서 한 번 정지하면 이후 모든 발화가 조용히 즉시 반환됐다.
//   제출·다음·건너뛰기·Esc 가 전부 `stop()` 을 부르므로 **첫 문항을 넘기는 순간
//   받아쓰기에 소리가 영영 안 났다** — 그런데 화면은 멀쩡하고 버튼도 눌린다.
//
// 이 계약은 브라우저 없이도 잴 수 있다(speechSynthesis 를 가짜로 세운다).
// e2e 는 헤드리스에 음성이 없어 "소리가 났는가" 를 못 재므로, 여기서 재는 것이 맞다.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { AudioController } from '../audio-control'

/** 발화를 즉시 끝내는 최소 speechSynthesis 대역. 실제로 speak 된 텍스트를 기록한다. */
function installFakeSpeech() {
  const spoken: string[] = []
  const synth = {
    getVoices: () => [{ lang: 'en-US', voiceURI: 'fake', default: true, name: 'Fake' }],
    speak: (u: { text: string; onend?: () => void }) => {
      spoken.push(u.text)
      // 실제 브라우저처럼 비동기로 끝낸다
      setTimeout(() => u.onend?.(), 0)
    },
    cancel: () => {},
    pause: () => {},
    resume: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    speaking: false,
    paused: false,
  }
  vi.stubGlobal('window', { speechSynthesis: synth })
  vi.stubGlobal('speechSynthesis', synth)
  // 라이브러리가 SpeechSynthesisUtterance 를 new 로 만든다 — 최소 형태만 흉내
  vi.stubGlobal(
    'SpeechSynthesisUtterance',
    class {
      text: string
      lang = ''
      rate = 1
      pitch = 1
      volume = 1
      voice: unknown = null
      onstart?: () => void
      onend?: () => void
      onerror?: (e: unknown) => void
      constructor(text: string) {
        this.text = text
      }
    },
  )
  return spoken
}

describe('AudioController — 정지가 다음 재생을 죽이지 않는다', () => {
  let spoken: string[]

  beforeEach(() => {
    spoken = installFakeSpeech()
  })
  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('정지한 뒤에도 다시 재생된다 (신고된 결함의 핵심)', async () => {
    const c = new AudioController()
    await c.speak({ text: 'first' })
    expect(spoken, '첫 재생이 안 됐다').toEqual(['first'])

    c.cancel() // 제출·다음·건너뛰기·Esc 가 전부 이걸 부른다

    await c.speak({ text: 'second' })
    expect(spoken, '정지 뒤 재생이 조용히 무시됐다 — 학습자에겐 "재생 버튼 안됨"').toEqual([
      'first',
      'second',
    ])
  })

  it('여러 번 정지해도 계속 재생된다 (상태가 눌어붙지 않는다)', async () => {
    const c = new AudioController()
    for (let i = 0; i < 3; i += 1) {
      c.cancel()
      await c.speak({ text: `t${i}` })
    }
    expect(spoken).toEqual(['t0', 't1', 't2'])
  })

  it('반복 재생도 정지 뒤에 다시 시작된다', async () => {
    const c = new AudioController()
    await c.repeat('rep', 2, 1, 0)
    expect(spoken.length, '반복 2회가 안 났다').toBe(2)

    c.cancel()
    spoken.length = 0
    await c.repeat('again', 2, 1, 0)
    expect(spoken.length, '정지 뒤 반복이 죽었다').toBe(2)
  })

  it('발화 Promise 는 반드시 끝난다 — 안 끝나면 재생 버튼이 갇힌다', async () => {
    const c = new AudioController()
    // onend 를 절대 안 부르는 브라우저를 흉내 (알려진 동작)
    const synth = (globalThis as unknown as { speechSynthesis: { speak: unknown } }).speechSynthesis
    ;(synth as { speak: (u: unknown) => void }).speak = () => {
      /* 조용히 흘린다 */
    }
    vi.useFakeTimers()
    const p = c.speak({ text: 'dropped' })
    await vi.advanceTimersByTimeAsync(5_000)
    vi.useRealTimers()
    await expect(p).resolves.toBeUndefined()
  })
})
