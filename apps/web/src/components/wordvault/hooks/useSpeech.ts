// apps/web/src/components/wordvault/hooks/useSpeech.ts
// Web Speech API 래퍼

'use client'

import { useCallback } from 'react'

export interface SpeakOptions {
  rate?: number
  lang?: string
  onEnd?: () => void
}

export function useSpeech() {
  const speak = useCallback((text: string, options: SpeakOptions = {}) => {
    if (typeof window === 'undefined') return
    if (!('speechSynthesis' in window)) return

    window.speechSynthesis.cancel()

    const utter = new SpeechSynthesisUtterance(text)
    utter.lang = options.lang ?? 'en-US'
    utter.rate = options.rate ?? 1.0

    if (options.onEnd) {
      utter.onend = options.onEnd
    }

    window.speechSynthesis.speak(utter)
  }, [])

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

  return { speak, cancel, pause, resume }
}
