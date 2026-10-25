// apps/web/src/components/csat/listening/useListeningAudio.ts
//
// HTMLAudio 감싸개(I8). 재생 가능 판정은 계약 `isAudioPlayable` 에만 묻는다 — kind 'none' 이나 권리 미검증
// official 은 'no-source' 로 남고 오디오 요소를 만들지 않는다. TTS 를 공식 음원처럼 대신 틀지 않는다.
// 재생 실패(네트워크 · 디코드 · 자동재생 거부)는 'error' 로 드러낸다.
// 로직은 DOM 없이 시험할 수 있게 `createAudioController` 에 두고, 훅은 구독만 한다.

import { useEffect, useMemo, useState } from 'react'

import { isAudioPlayable } from '@/lib/csat/listening/validate'
import type { ListeningAudioSource } from '@/lib/csat/listening/types'

export type AudioStatus = 'no-source' | 'idle' | 'playing' | 'paused' | 'error'
export const PLAYBACK_RATES = [0.75, 1, 1.25] as const
export type PlaybackRate = (typeof PLAYBACK_RATES)[number]

export interface AudioLike {
  play(): Promise<void> | void
  pause(): void
  currentTime: number
  playbackRate: number
  addEventListener(type: string, fn: () => void): void
  removeEventListener(type: string, fn: () => void): void
}

export type AudioFactory = (url: string) => AudioLike

const defaultFactory: AudioFactory = (url) => new Audio(url)

export interface AudioSnapshot {
  status: AudioStatus
  rate: PlaybackRate
  /** 구간 반복 중이면 그 끝(ms) */
  segmentEndMs: number | null
}

export interface AudioController {
  get(): AudioSnapshot
  subscribe(fn: (s: AudioSnapshot) => void): () => void
  toggle(): void
  pause(): void
  setRate(r: PlaybackRate): void
  playSegment(startMs: number, endMs: number): void
  dispose(): void
}

export function createAudioController(source: ListeningAudioSource, factory: AudioFactory = defaultFactory): AudioController {
  let snap: AudioSnapshot = { status: 'no-source', rate: 1, segmentEndMs: null }
  const subs = new Set<(s: AudioSnapshot) => void>()
  const set = (p: Partial<AudioSnapshot>) => {
    snap = { ...snap, ...p }
    subs.forEach((f) => f(snap))
  }

  let el: AudioLike | null = null
  const listeners: [string, () => void][] = []
  if (isAudioPlayable(source) && source.url) {
    try {
      el = factory(source.url)
      snap = { ...snap, status: 'idle' }
    } catch {
      snap = { ...snap, status: 'error' }
    }
  }
  if (el) {
    const a = el
    const on = (t: string, f: () => void) => {
      a.addEventListener(t, f)
      listeners.push([t, f])
    }
    on('play', () => set({ status: 'playing' }))
    on('pause', () => snap.status !== 'error' && set({ status: 'paused' }))
    on('ended', () => set({ status: 'paused', segmentEndMs: null }))
    on('error', () => set({ status: 'error' }))
    on('timeupdate', () => {
      if (snap.segmentEndMs !== null && a.currentTime * 1000 >= snap.segmentEndMs) {
        set({ segmentEndMs: null })
        a.pause()
      }
    })
  }

  const start = () => {
    if (!el) return
    try {
      const p = el.play()
      if (p && typeof (p as Promise<void>).catch === 'function') (p as Promise<void>).catch(() => set({ status: 'error' }))
    } catch {
      set({ status: 'error' })
    }
  }

  return {
    get: () => snap,
    subscribe(fn) {
      subs.add(fn)
      return () => subs.delete(fn)
    },
    toggle() {
      if (snap.status === 'playing') el?.pause()
      else start()
    },
    pause: () => el?.pause(),
    setRate(r) {
      if (el) el.playbackRate = r
      set({ rate: r })
    },
    playSegment(startMs, endMs) {
      if (!el || endMs <= startMs) return
      el.currentTime = startMs / 1000
      set({ segmentEndMs: endMs })
      start()
    },
    dispose() {
      if (el) {
        for (const [t, f] of listeners) el.removeEventListener(t, f)
        try {
          el.pause()
        } catch {
          // 이미 해제됨
        }
      }
      subs.clear()
      el = null
    },
  }
}

export interface ListeningAudio extends AudioSnapshot {
  toggle: () => void
  pause: () => void
  setRate: (r: PlaybackRate) => void
  playSegment: (startMs: number, endMs: number) => void
}

const NO_SOURCE: AudioSnapshot = { status: 'no-source', rate: 1, segmentEndMs: null }

export function useListeningAudio(source: ListeningAudioSource, factory: AudioFactory = defaultFactory): ListeningAudio {
  const [ctl, setCtl] = useState<AudioController | null>(null)
  const [snap, setSnap] = useState<AudioSnapshot>(() => (isAudioPlayable(source) ? { ...NO_SOURCE, status: 'idle' } : NO_SOURCE))
  const { kind, url, rights } = source
  useEffect(() => {
    // 오디오 요소는 브라우저에서만 만든다(서버 렌더는 no-source)
    const c = createAudioController({ kind, url, rights }, factory)
    setCtl(c)
    setSnap(c.get())
    const off = c.subscribe(setSnap)
    return () => {
      off()
      c.dispose()
    }
  }, [kind, url, rights, factory])
  return useMemo(
    () => ({
      ...snap,
      toggle: () => ctl?.toggle(),
      pause: () => ctl?.pause(),
      setRate: (r: PlaybackRate) => ctl?.setRate(r),
      playSegment: (s: number, e: number) => ctl?.playSegment(s, e),
    }),
    [snap, ctl],
  )
}
