// apps/web/src/components/csat/theater/useMeaningNarration.ts
'use client'
//
// **원문 이해 읽어 주기 — 큐 묶음 하나를 재생 · 멈춤 · 그만.** 기존 분석 듣기(AnalysisReading)와 같은 어댑터 · 플레이어를 쓴다.
// 한국어 목소리가 없는 기기는 무음 어댑터로 강조만 넘긴다(silent=true 로 화면이 알린다).
// 다른 묶음을 재생하거나 화면이 사라지면 이전 재생을 끊는다 — 말과 화면이 어긋난 채 남지 않게.

import { useEffect, useRef, useState } from 'react'

import { LecturePlayer, type PlayerState } from '@/lib/csat/lecture/player'
import { loadVoices, pickVoice, SilentAdapter, WebSpeechAdapter } from '@/lib/csat/lecture/tts'
import { asLecture, type NarrationCue } from '@/lib/csat/meaning-support/narration'

export function useMeaningNarration(itemId: string) {
  const player = useRef<LecturePlayer | null>(null)
  const ticket = useRef(0)
  const [group, setGroup] = useState<string | null>(null)
  const [cues, setCues] = useState<NarrationCue[]>([])
  const [state, setState] = useState<PlayerState | null>(null)
  const [loading, setLoading] = useState(false)
  const [silent, setSilent] = useState(false)
  const [error, setError] = useState(false)

  const stop = () => {
    ticket.current++
    player.current?.destroy()
    player.current = null
    setState(null)
    setGroup(null)
    setLoading(false)
  }
  useEffect(() => () => { ticket.current++; player.current?.destroy(); player.current = null }, [])

  const play = async (name: string, next: NarrationCue[]) => {
    // 같은 묶음이 재생 중이면 멈춤 · 이어서
    if (group === name && player.current && state && state.status !== 'ended') { player.current.toggle(); return }
    stop()
    const my = ++ticket.current
    setGroup(name)
    setCues(next)
    setLoading(true)
    setError(false)
    try {
      const voices = await loadVoices()
      if (my !== ticket.current) return
      const ko = pickVoice(voices, 'ko-KR')
      setSilent(!ko)
      const adapter = ko ? new WebSpeechAdapter({ ko, en: pickVoice(voices, 'en-US') }) : new SilentAdapter()
      adapter.onCueEnd = (_c, outcome) => { if (outcome.errors.length) setError(true) }
      player.current = new LecturePlayer(asLecture(itemId, next), adapter, (s) => { if (my === ticket.current) setState(s) })
      setLoading(false)
      await player.current.play(0)
    } catch {
      if (my === ticket.current) setError(true)
    } finally {
      if (my === ticket.current) setLoading(false)
    }
  }

  const live = state && (state.status === 'playing' || state.status === 'paused')
  const current = live ? cues[state.index] ?? null : null
  return {
    play,
    stop,
    group: live || loading ? group : null,
    status: loading ? ('loading' as const) : state?.status ?? 'idle',
    currentKey: current?.key ?? null,
    currentSentences: current?.sentences ?? [],
    silent,
    error,
  }
}
