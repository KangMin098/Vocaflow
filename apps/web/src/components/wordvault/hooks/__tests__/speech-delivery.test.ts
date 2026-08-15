// apps/web/src/components/wordvault/hooks/__tests__/speech-delivery.test.ts
//
// 브라우저 TTS 가 오디오 단어장(D26)의 **전달 방식으로 확정**됐으므로, 재생 경로의 두 결정을
// 계약으로 고정한다. 둘 다 틀려도 화면에는 아무 표시가 없다 — 그래서 테스트로만 잡힌다.
//
//   ① 어떤 음성으로 읽나 — 한국어 시스템에서 영단어를 한국어 음성이 읽으면
//      발음 학습에는 침묵보다 나쁘다.
//   ② 실패했을 때 큐가 넘어가나 — `onEnd` 를 안 부르면 흘려듣기가 그 자리에 멈춘다.

import { describe, expect, it, vi } from 'vitest'
import { attachCompletion, pickEnglishVoice } from '../useSpeech'

const voice = (lang: string) => ({ lang })

describe('영어 음성 고르기', () => {
  it('en-US 를 최우선으로 고른다', () => {
    expect(pickEnglishVoice([voice('ko-KR'), voice('en-GB'), voice('en-US')])?.lang).toBe('en-US')
  })

  it('en-US 가 없으면 다른 영어 변종을 쓴다', () => {
    expect(pickEnglishVoice([voice('ko-KR'), voice('en-AU')])?.lang).toBe('en-AU')
  })

  it('밑줄 표기(en_US)도 같은 것으로 본다 — 표기 차이로 놓치면 한국어 음성이 읽는다', () => {
    expect(pickEnglishVoice([voice('en_US')])?.lang).toBe('en_US')
  })

  it('영어 음성이 하나도 없으면 null — 아무 음성이나 물리지 않는다', () => {
    expect(pickEnglishVoice([voice('ko-KR'), voice('ja-JP')])).toBeNull()
    expect(pickEnglishVoice([])).toBeNull()
  })
})

describe('재생 완료 통지', () => {
  it('정상 종료에 한 번 부른다', () => {
    const done = vi.fn()
    const u = {} as { onend?: (() => void) | null; onerror?: (() => void) | null }
    attachCompletion(u as never, done)
    u.onend?.()
    expect(done).toHaveBeenCalledTimes(1)
  })

  it('오류에도 부른다 — 안 부르면 흘려듣기가 그 자리에서 멈춘다', () => {
    const done = vi.fn()
    const u = {} as { onend?: (() => void) | null; onerror?: (() => void) | null }
    attachCompletion(u as never, done)
    u.onerror?.()
    expect(done).toHaveBeenCalledTimes(1)
  })

  it('둘 다 발생해도 한 번만 부른다 — 두 번 부르면 단어 하나를 건너뛴다', () => {
    const done = vi.fn()
    const u = {} as { onend?: (() => void) | null; onerror?: (() => void) | null }
    attachCompletion(u as never, done)
    u.onerror?.()
    u.onend?.()
    expect(done).toHaveBeenCalledTimes(1)
  })
})
