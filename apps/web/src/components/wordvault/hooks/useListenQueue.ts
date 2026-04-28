// apps/web/src/components/wordvault/hooks/useListenQueue.ts
// 단어 리스트 자동 재생 큐 관리

'use client'

import { useCallback, useRef, useState } from 'react'
import type { ListenSettings, WordItem } from '../types'
import { useSpeech } from './useSpeech'

export interface UseListenQueueReturn {
  isPlaying: boolean
  isPaused: boolean
  currentIndex: number
  currentWord: WordItem | null
  queueLength: number
  startQueue: (queue: WordItem[]) => void
  stopQueue: () => void
  togglePause: () => void
  next: () => void
  prev: () => void
}

export function useListenQueue(settings: ListenSettings): UseListenQueueReturn {
  const [isPlaying, setIsPlaying] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [currentIndex, setCurrentIndex] = useState(0)
  const queueRef = useRef<WordItem[]>([])
  const playingRef = useRef(false)
  const pausedRef = useRef(false)
  const indexRef = useRef(0)
  const settingsRef = useRef(settings)

  // settings를 ref로 동기화 (재생 중 변경 가능)
  settingsRef.current = settings

  const { speak, cancel } = useSpeech()

  const playWordContent = useCallback(
    (w: WordItem, onComplete: () => void) => {
      const c = settingsRef.current.content
      const r = settingsRef.current.speed

      if (c === 'word') {
        speak(w.word, { rate: r, onEnd: onComplete })
      } else if (c === 'word-example') {
        speak(w.word, {
          rate: r,
          onEnd: () => {
            setTimeout(() => {
              speak(w.exampleEn, { rate: r * 0.95, onEnd: onComplete })
            }, 400)
          },
        })
      }
    },
    [speak]
  )

  const playNext = useCallback(() => {
    if (!playingRef.current || pausedRef.current) return
    if (indexRef.current >= queueRef.current.length) {
      stopQueue()
      return
    }

    const w = queueRef.current[indexRef.current]
    if (!w) return

    setCurrentIndex(indexRef.current)

    playWordContent(w, () => {
      setTimeout(() => {
        if (playingRef.current && !pausedRef.current) {
          indexRef.current += 1
          playNext()
        }
      }, settingsRef.current.gap * 1000)
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playWordContent])

  const startQueue = useCallback(
    (queue: WordItem[]) => {
      const finalQueue = settingsRef.current.shuffle
        ? [...queue].sort(() => Math.random() - 0.5)
        : queue

      queueRef.current = finalQueue
      indexRef.current = 0
      playingRef.current = true
      pausedRef.current = false
      setIsPlaying(true)
      setIsPaused(false)
      setCurrentIndex(0)
      playNext()
    },
    [playNext]
  )

  const stopQueue = useCallback(() => {
    playingRef.current = false
    pausedRef.current = false
    cancel()
    setIsPlaying(false)
    setIsPaused(false)
    queueRef.current = []
  }, [cancel])

  const togglePause = useCallback(() => {
    if (pausedRef.current) {
      pausedRef.current = false
      setIsPaused(false)
      if ('speechSynthesis' in window) window.speechSynthesis.resume()
      playNext()
    } else {
      pausedRef.current = true
      setIsPaused(true)
      if ('speechSynthesis' in window) window.speechSynthesis.pause()
    }
  }, [playNext])

  const next = useCallback(() => {
    if (!playingRef.current) return
    cancel()
    indexRef.current += 1
    if (indexRef.current >= queueRef.current.length) {
      stopQueue()
    } else {
      playNext()
    }
  }, [cancel, stopQueue, playNext])

  const prev = useCallback(() => {
    if (!playingRef.current) return
    cancel()
    indexRef.current = Math.max(0, indexRef.current - 1)
    playNext()
  }, [cancel, playNext])

  const currentWord =
    isPlaying && queueRef.current[currentIndex] ? queueRef.current[currentIndex] : null

  return {
    isPlaying,
    isPaused,
    currentIndex,
    currentWord,
    queueLength: queueRef.current.length,
    startQueue,
    stopQueue,
    togglePause,
    next,
    prev,
  }
}
