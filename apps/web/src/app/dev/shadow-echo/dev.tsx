// apps/web/src/app/dev/shadow-echo/dev.tsx
'use client'

import { useEffect, useRef, useState } from 'react'

import { ShadowReadAlong } from '@/components/workspace/ShadowReadAlong'
import { ReplayPanel } from '@/components/echo/ReplayPanel'
import { EchoReplay, IDLE_REPLAY, type ReplayState } from '@/lib/echo/replay-controller'
import type { ShadowControls, ShadowState } from '@/lib/workspace/use-shadow-session'

const BASE: ShadowState = {
  running: false,
  paused: false,
  phase: 'idle',
  index: 0,
  total: 3,
  sentenceIdx: null,
  transcript: '',
  matchedKeys: new Set<string>(),
  tone: null,
  rate: 1,
  autoAdvance: true,
  recognitionSupported: false,
  micDenied: false,
}

/** 시작 → 곧바로 완료 상태로 바꾼다(음성 없이 화면만). */
export function ShadowEchoDev() {
  const [done, setDone] = useState(false)
  const controls = {
    start: () => setDone(true),
    pause: () => {},
    resume: () => {},
    stop: () => {},
  } as unknown as ShadowControls
  return (
    <>
      <ShadowReadAlong
        sentences={[]}
        state={done ? { ...BASE, phase: 'done' } : BASE}
        controls={controls}
        onExit={() => setDone(false)}
        echoHref="/text/dev-text/echo"
      />
      <EchoReplayDev />
    </>
  )
}

/**
 * EchoMatch 결과 화면의 다시 듣기 — 실제 ReplayPanel · EchoReplay 에 합성 버퍼와 모의 재생(소리 없음 · 1.5초 타이머)만 준다.
 * 마이크 · 음성 합성 · 인식 · 저장 없음. ?replay=fail 이면 재생이 실패하고, ?replay=noself 면 내 발화 버퍼가 없다.
 */
function EchoReplayDev() {
  const [state, setState] = useState<ReplayState>(IDLE_REPLAY)
  const [mode, setMode] = useState<'ok' | 'fail' | 'noself'>('ok')
  const ref = useRef<EchoReplay | null>(null)
  useEffect(() => {
    const m = new URLSearchParams(window.location.search).get('replay')
    const md = m === 'fail' || m === 'noself' ? m : 'ok'
    setMode(md)
    const r = new EchoReplay(
      (_buffer, { signal }) =>
        new Promise<void>((resolve, reject) => {
          const t = window.setTimeout(() => (md === 'fail' ? reject(new Error('mock')) : resolve()), 1500)
          signal.addEventListener('abort', () => {
            window.clearTimeout(t)
            resolve()
          })
        }),
      setState,
    )
    ref.current = r
    return () => r.dispose()
  }, [])
  const synthetic = {} as AudioBuffer
  return (
    <section className="mt-8">
      <p className="mb-2 font-display text-[12px] text-[var(--t2)]">EchoMatch 결과 · 다시 듣기(합성 버퍼 · 모의 재생)</p>
      <ReplayPanel
        referenceReady
        selfReady={mode !== 'noself'}
        state={state}
        onPlay={(t) => ref.current?.start(t, synthetic)}
        onStop={() => ref.current?.stop()}
      />
    </section>
  )
}
