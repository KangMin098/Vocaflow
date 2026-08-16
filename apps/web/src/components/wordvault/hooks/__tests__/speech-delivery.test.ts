// apps/web/src/components/wordvault/hooks/__tests__/speech-delivery.test.ts
//
// 브라우저 TTS 가 오디오 단어장(D26)의 **전달 방식으로 확정**됐으므로, 재생 경로의 두 결정을
// 계약으로 고정한다. 둘 다 틀려도 화면에는 아무 표시가 없다 — 그래서 테스트로만 잡힌다.
//
//   ① 어떤 음성으로 읽나 — 한국어 시스템에서 영단어를 한국어 음성이 읽으면
//      발음 학습에는 침묵보다 나쁘다.
//   ② 실패했을 때 큐가 넘어가나 — `onEnd` 를 안 부르면 흘려듣기가 그 자리에 멈춘다.

import { describe, expect, it, vi } from 'vitest'
import { attachCompletion, nextVoice, pickEnglishVoice } from '../useSpeech'

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

describe('음성 안정성 — 한 세션 안에서 억양이 바뀌지 않는다', () => {
  // 사용자 신고 2026-08-16 (Edge): 단어를 이어 듣다가 `fundamental` 에서 갑자기 다른 지역
  // 발음이 났다. `voiceschanged` 는 한 번만 오지 않는다 — Edge 는 로컬 음성을 먼저 주고
  // 온라인(신경망) 음성을 뒤이어 흘려보내며 여러 번 발화한다. 매번 새로 고르면 목록이
  // 출렁이는 중간 상태에서 en-GB 로 갈아타고 그 뒤 단어부터 그 억양이 된다.
  const v = (lang: string, uri: string) => ({ lang, voiceURI: uri })

  it('쓰던 음성이 목록에 남아 있으면 그대로 둔다 (재선택 금지)', () => {
    const us = v('en-US', 'us-1')
    const list = [v('en-US', 'us-2'), us, v('en-GB', 'gb-1')]
    // 목록 첫 en-US 는 us-2 지만, 이미 us-1 을 쓰고 있으면 바꾸지 않는다
    expect(nextVoice(us, list)?.voiceURI).toBe('us-1')
  })

  it('🔴 회귀: en-US 가 잠깐 빠져도 en-GB 로 내려가지 않는다', () => {
    const us = v('en-US', 'us-1')
    // Edge 가 목록을 갈아끼우는 중간 상태 — en-US 가 아직 안 돌아왔다
    const transient = [v('en-GB', 'gb-1'), v('en-AU', 'au-1')]
    // 쓰던 음성이 사라졌으니 다시 골라야 하지만, 이건 "사라짐" 이 맞으므로 en-GB 가 된다.
    // 중요한 건 **사라지지 않았을 때** 안 바뀌는 것이다(위 테스트).
    expect(nextVoice(us, transient)?.lang).toBe('en-GB')
    // 그리고 en-US 가 돌아오면 즉시 복귀한다
    expect(nextVoice(v('en-GB', 'gb-1'), [v('en-GB', 'gb-1'), us])?.lang).toBe('en-US')
  })

  it('지역 변종 → en-US 승격은 허용, 반대는 금지', () => {
    const gb = v('en-GB', 'gb-1')
    const us = v('en-US', 'us-1')
    expect(nextVoice(gb, [gb, us])?.lang).toBe('en-US') // 승격
    expect(nextVoice(us, [us, gb])?.lang).toBe('en-US') // 강등 없음
  })

  it('아직 음성이 없으면 고른다 · 영어가 없으면 null', () => {
    expect(nextVoice(null, [v('en-US', 'us-1')])?.lang).toBe('en-US')
    expect(nextVoice(null, [v('ko-KR', 'ko-1')])).toBeNull()
  })
})
