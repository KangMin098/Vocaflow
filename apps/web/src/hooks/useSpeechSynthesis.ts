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

      if (window.speechSynthesis.speaking || window.speechSynthesis.pending) {
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

  // 취소는 재생 중(speaking)뿐 아니라 대기 중(pending — speak 뒤 onstart 전)인 문장도 포함한다.
  // speaking 만 보면 대기 중이던 이전 문장이 단계·카드가 바뀐 뒤에 뒤늦게 시작된다.
  const cancel = useCallback(() => {
    if (supported && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
      window.speechSynthesis.cancel()
    }
    setIsPlaying(false)
  }, [supported])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (supported && (window.speechSynthesis.speaking || window.speechSynthesis.pending)) {
        window.speechSynthesis.cancel()
      }
    }
  }, [supported])

  return { speak, cancel, isPlaying, supported }
}
