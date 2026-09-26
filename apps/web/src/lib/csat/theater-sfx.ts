// apps/web/src/lib/csat/theater-sfx.ts
//
// **해설 극장의 효과음 — 큐 경계에서만, 말 위에 겹치지 않게.**
//
// 소리가 넷뿐인 이유: 뜻이 넷이다. 단계가 얹힌다 · 근거를 긋는다 · 함정을 짚는다 · 정리를 찍는다.
// 다섯 번째 소리를 더하려면 다섯 번째 뜻을 먼저 찾아야 한다.
//
// ── 자산을 새로 받지 않았다 ────────────────────────────────────────────
// `public/audio/sfx/` 의 **실녹음 샘플**을 배속과 음량으로 다시 쓴다. 게임이 v07.6 에서
// 합성음(대역제한·모노·스펙트럴 평탄도 0)을 걷어내고 넣은 것들이라 이미 검증돼 있다:
//   click.wav = 타자기 · correct.wav = 벨 · complete.ogg = 금관 합주.
// 새 파일을 받아 오면 출처·라이선스를 한 벌 더 관리해야 하는데, 지금 필요한 네 소리는
// 이 셋의 **음높이를 옮긴 것**으로 정확히 만들어진다. (내려서 마른 «탁», 살짝 낮춘 벨.)
//
// ⚠️ 게임의 `wrong.wav` 는 **쓰지 않는다.** 이 화면은 정답률을 세지 않는다 —
//    「틀림」 소리가 나면 학습자가 채점당하고 있다고 느낀다.
// ⚠️ 말(TTS)이 주(主)다. 효과음은 전부 −12 dB 아래로 깔고, 같은 소리를 잇달아 내지 않는다.

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

import type { TheaterSfx } from './theater'

const STORAGE_KEY = 'csat.theater.sound'

/** 소리 이름 → 실녹음 샘플 · 배속 · 음량. 배속이 뜻을 바꾼다(타자기 0.6 = 마른 탁). */
const VOICE: Record<TheaterSfx, { src: string; rate: number; gain: number }> = {
  step: { src: '/audio/sfx/click.wav', rate: 1, gain: 0.18 },
  mark: { src: '/audio/sfx/correct.wav', rate: 0.92, gain: 0.2 },
  trap: { src: '/audio/sfx/click.wav', rate: 0.6, gain: 0.3 },
  seal: { src: '/audio/sfx/complete.ogg', rate: 0.88, gain: 0.24 },
}

function readStored(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === 'on'
  } catch {
    return false
  }
}

/**
 * 소리 켬/끔과 재생 한 벌.
 *
 * **기본은 끔이다.** 브라우저가 사람의 제스처 전에는 오디오를 못 내게 막으므로, 켜 두면
 * 첫 상영에서 소리가 안 나고 「고장」처럼 보인다. 학습자가 켜면 그 선택을 기기에 남긴다.
 */
export function useTheaterSfx() {
  const [on, setOn] = useState(false)
  const onRef = useRef(false)
  onRef.current = on
  const ctxRef = useRef<AudioContext | null>(null)
  const bufRef = useRef<Partial<Record<string, AudioBuffer>>>({})
  const lastRef = useRef<{ name: TheaterSfx | null; at: number }>({ name: null, at: 0 })

  useEffect(() => {
    setOn(readStored())
  }, [])

  const context = useCallback(() => {
    if (typeof window === 'undefined') return null
    const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) return null
    if (!ctxRef.current) ctxRef.current = new AC()
    if (ctxRef.current.state === 'suspended') void ctxRef.current.resume()
    return ctxRef.current
  }, [])

  const load = useCallback((src: string, c: AudioContext) => {
    if (bufRef.current[src]) return
    bufRef.current[src] = undefined
    void fetch(src)
      .then((r) => r.arrayBuffer())
      .then((ab) => c.decodeAudioData(ab))
      .then((buf) => {
        bufRef.current[src] = buf
      })
      // 샘플을 못 받으면 **소리 없이 간다**. 합성음으로 때우지 않는다 — 이 화면의 소리 기준이 실녹음이다.
      .catch(() => {})
  }, [])

  const play = useCallback(
    (name: TheaterSfx) => {
      if (!onRef.current) return
      const c = context()
      if (!c) return
      const voice = VOICE[name]
      load(voice.src, c)
      const buf = bufRef.current[voice.src]
      if (!buf) return
      // 같은 소리가 잇달아 나면 귀가 곧 지운다 — 200ms 안의 재탕은 여리게 낸다
      const repeat = lastRef.current.name === name && c.currentTime * 1000 - lastRef.current.at < 200
      lastRef.current = { name, at: c.currentTime * 1000 }
      const source = c.createBufferSource()
      const gain = c.createGain()
      source.buffer = buf
      source.playbackRate.value = voice.rate
      if (source.detune) source.detune.value = (Math.random() * 2 - 1) * 45
      gain.gain.value = voice.gain * (repeat ? 0.5 : 1) * (0.92 + Math.random() * 0.16)
      source.connect(gain)
      gain.connect(c.destination)
      source.start()
    },
    [context, load],
  )

  const toggle = useCallback(() => {
    setOn((prev) => {
      const next = !prev
      try {
        window.localStorage.setItem(STORAGE_KEY, next ? 'on' : 'off')
      } catch {
        // 저장이 막힌 기기에서도 이번 창에서는 켜진 채로 돈다
      }
      if (next) {
        const c = context()
        if (c) for (const voice of Object.values(VOICE)) load(voice.src, c)
      }
      return next
    })
  }, [context, load])

  useEffect(
    () => () => {
      void ctxRef.current?.close().catch(() => {})
      ctxRef.current = null
    },
    [],
  )

  return { on, toggle, play }
}
