// apps/web/src/app/dev/shadow-echo/dev.tsx
'use client'

import { useState } from 'react'

import { ShadowReadAlong } from '@/components/workspace/ShadowReadAlong'
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
    <ShadowReadAlong
      sentences={[]}
      state={done ? { ...BASE, phase: 'done' } : BASE}
      controls={controls}
      onExit={() => setDone(false)}
      echoHref="/text/dev-text/echo"
    />
  )
}
