// apps/web/src/components/wordvault/hooks/useSpeech.ts
// Web Speech API 래퍼 — 단어·예문 읽어 주기 + 흘려듣기 큐의 재생 엔진.
//
// 이 훅이 오디오 단어장(D26)의 **전달 경로 그 자체**다 (녹음 자산 0 · 브라우저 TTS 확정).
// 그래서 "대충 재생되면 된다" 로 둘 수 없고, 아래 두 가지를 반드시 처리한다.
//
//   ① 영어 음성 고르기 — `utter.lang='en-US'` 만 주면 브라우저는 **설치된 아무 음성**으로
//      읽을 수 있다. 한국어 시스템에서 영단어를 한국어 음성이 읽으면 발음 학습에는
//      침묵보다 나쁘다. 그래서 en 음성을 직접 찾아 물린다.
//      (`getVoices()` 는 첫 호출에 빈 배열을 주는 브라우저가 있어 `voiceschanged` 를 함께 듣는다.)
//
//   ② 끝나지 않는 재생 막기 — 실패해도 `onEnd` 를 반드시 부른다. 부르지 않으면
//      `useListenQueue` 가 다음 단어로 넘어가지 못해 **흘려듣기가 그 자리에 멈춘다**
//      (미지원 브라우저·음성 없음·합성 오류 전부 같은 증상이고, 화면에는 아무 표시도 없다).

'use client'

import { useCallback, useEffect, useState } from 'react'

export interface SpeakOptions {
  rate?: number
  lang?: string
  onEnd?: () => void
}

/**
 * 영어 음성 후보 중 하나 고르기 — en-US 우선, 없으면 아무 en-*.
 *
 * 브라우저마다 `lang` 표기가 다르다(`en-US` · `en_US` · `en-GB`). 표기 차이로 못 찾으면
 * 한국어 음성이 영단어를 읽게 되므로 정규화해서 비교한다.
 */
export function pickEnglishVoice(
  voices: Pick<SpeechSynthesisVoice, 'lang'>[],
): Pick<SpeechSynthesisVoice, 'lang'> | null {
  if (voices.length === 0) return null
  const norm = (l: string) => l.replace('_', '-').toLowerCase()
  return (
    voices.find((v) => norm(v.lang) === 'en-us') ??
    voices.find((v) => norm(v.lang).startsWith('en')) ??
    null
  )
}

/**
 * 완료 통지를 건다 — 정상 종료든 오류든 **정확히 한 번**.
 *
 * 흘려듣기 큐는 `onEnd` 로만 다음 단어로 넘어간다. 오류에서 부르지 않으면 그 자리에 멈추고,
 * 두 번 부르면 단어 하나를 건너뛴다. 둘 다 화면에 아무 표시가 없어 알아채기 어렵다.
 */
export function attachCompletion(
  utter: Pick<SpeechSynthesisUtterance, 'onend' | 'onerror'>,
  done: () => void,
): void {
  let settled = false
  const finish = () => {
    if (settled) return
    settled = true
    done()
  }
  utter.onend = finish as SpeechSynthesisUtterance['onend']
  utter.onerror = finish as unknown as SpeechSynthesisUtterance['onerror']
}

export interface UseSpeechReturn {
  speak: (text: string, options?: SpeakOptions) => void
  cancel: () => void
  pause: () => void
  resume: () => void
  /** 이 브라우저가 음성 합성을 지원하는가 */
  supported: boolean
  /**
   * **영어 음성이 실제로 설치돼 있는가.** false 면 재생은 되더라도 영어를 영어로 읽지
   * 않을 수 있다 — 듣기 중심 화면은 이 값으로 안내를 띄우라고 노출한다.
   */
  englishVoice: boolean
}

export function useSpeech(): UseSpeechReturn {
  const [voice, setVoice] = useState<SpeechSynthesisVoice | null>(null)
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) return
    setSupported(true)

    const sync = () =>
      setVoice(pickEnglishVoice(window.speechSynthesis.getVoices()) as SpeechSynthesisVoice | null)
    sync() // 이미 로드돼 있으면 여기서 끝난다
    window.speechSynthesis.addEventListener('voiceschanged', sync)
    return () => window.speechSynthesis.removeEventListener('voiceschanged', sync)
  }, [])

  const speak = useCallback(
    (text: string, options: SpeakOptions = {}) => {
      const done = options.onEnd
      if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
        // 큐가 멈추지 않도록 즉시 완료로 넘긴다 — 조용히 return 하면 그 자리에서 멈춘다.
        done?.()
        return
      }

      window.speechSynthesis.cancel()

      const utter = new SpeechSynthesisUtterance(text)
      utter.lang = options.lang ?? 'en-US'
      utter.rate = options.rate ?? 1.0
      // 음성 목록이 아직 안 왔으면 그때 다시 찾아본다(첫 재생이 로드 완료보다 빠를 수 있다).
      const v = voice ?? (pickEnglishVoice(window.speechSynthesis.getVoices()) as SpeechSynthesisVoice | null)
      if (v) utter.voice = v

      // 합성 오류·중단도 완료로 취급한다. 재생이 안 된 것과 큐가 멈추는 것은 다른 문제이고,
      // 뒤엣것이 훨씬 나쁘다(학습자는 왜 멈췄는지 알 방법이 없다).
      if (done) attachCompletion(utter, done)

      window.speechSynthesis.speak(utter)
    },
    [voice],
  )

  const cancel = useCallback(() => {
    if (typeof window === 'undefined') return
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.cancel()
  }, [])

  const pause = useCallback(() => {
    if (typeof window === 'undefined') return
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.pause()
  }, [])

  const resume = useCallback(() => {
    if (typeof window === 'undefined') return
    if (!('speechSynthesis' in window)) return
    window.speechSynthesis.resume()
  }, [])

  return { speak, cancel, pause, resume, supported, englishVoice: voice !== null }
}
