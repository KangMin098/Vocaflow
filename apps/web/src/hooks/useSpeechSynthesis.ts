// apps/web/src/hooks/useSpeechSynthesis.ts

'use client'

import { useCallback, useEffect, useState } from 'react'

interface UseSpeechSynthesisParams {
  lang?: string // default 'en-US'
  rate?: number // 0.1 ~ 10 (default 0.9)
}

export function useSpeechSynthesis({ lang = 'en-US', rate = 0.9 }: UseSpeechSynthesisParams = {}) {
  const [isPlaying, setIsPlaying] = useState(false)
  const [supported, setSupported] = useState(false)

  useEffect(() => {
    setSupported(typeof window !== 'undefined' && 'speechSynthesis' in window)
  }, [])

  const speak = useCallback(
    (text: string, customRate?: number) => {
      if (!supported) {
        // Fallback: 1.5초 후 자동 종료
        setIsPlaying(true)
        setTimeout(() => setIsPlaying(false), 1500)
        return
      }

      if (window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel()
      }

      const utterance = new SpeechSynthesisUtterance(text)
      utterance.lang = lang
      utterance.rate = customRate ?? rate

      utterance.onstart = () => setIsPlaying(true)
      utterance.onend = () => setIsPlaying(false)
      utterance.onerror = () => setIsPlaying(false)

      window.speechSynthesis.speak(utterance)
    },
    [supported, lang, rate]
  )

  const cancel = useCallback(() => {
    if (supported && window.speechSynthesis.speaking) {
      window.speechSynthesis.cancel()
    }
    setIsPlaying(false)
  }, [supported])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (supported && window.speechSynthesis.speaking) {
        window.speechSynthesis.cancel()
      }
    }
  }, [supported])

  return { speak, cancel, isPlaying, supported }
}
