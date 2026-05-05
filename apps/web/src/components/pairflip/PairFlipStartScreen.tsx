// apps/web/src/components/pairflip/PairFlipStartScreen.tsx
// 시작 화면 통합 — Env + Logo + Mascot + LevelSelector + ModeSelector + StartButton

'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { STORAGE_KEYS } from './constants'
import { PairFlipEnv } from './PairFlipEnv'
import { PairFlipLevelSelector } from './PairFlipLevelSelector'
import { PairFlipLogo } from './PairFlipLogo'
import { PairFlipMascot } from './PairFlipMascot'
import { PairFlipModeSelector } from './PairFlipModeSelector'
import type { PairFlipConfig, PairFlipLevel, PairFlipMode } from './types'

export function PairFlipStartScreen() {
  const router = useRouter()
  const [level, setLevel] = useState<PairFlipLevel>('normal')
  const [mode, setMode] = useState<PairFlipMode>('word_meaning')

  const handleStart = () => {
    const config: PairFlipConfig = { level, mode }
    try {
      sessionStorage.setItem(STORAGE_KEYS.config, JSON.stringify(config))
    } catch {
      /* sessionStorage 사용 불가 — fallback: query string 으로 확장 가능 */
    }
    router.push('/pairflip/play')
  }

  return (
    <div className="relative min-h-[80vh] overflow-hidden">
      <PairFlipEnv />

      {/* 우하단 마스코트 (idle) */}
      <div className="pointer-events-none fixed bottom-20 right-4 z-10 md:bottom-24 md:right-8">
        <PairFlipMascot mood="idle" size={80} className="md:[&>svg]:h-[100px] md:[&>svg]:w-[100px]" />
      </div>

      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center gap-8 px-4 py-10 md:py-16">
        {/* Logo */}
        <PairFlipLogo />

        {/* Level selector */}
        <section className="w-full" aria-labelledby="pf-level-heading">
          <h2
            id="pf-level-heading"
            className="mb-3 text-center font-display text-[12px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]"
          >
            난이도 선택
          </h2>
          <PairFlipLevelSelector selected={level} onChange={setLevel} />
        </section>

        {/* Mode selector */}
        <section className="flex flex-col items-center gap-2" aria-labelledby="pf-mode-heading">
          <h2
            id="pf-mode-heading"
            className="font-display text-[12px] font-[700] uppercase tracking-[0.08em] text-[var(--t2)]"
          >
            매칭 모드
          </h2>
          <PairFlipModeSelector selected={mode} onChange={setMode} />
        </section>

        {/* Start button — editorial 골드/네이비 */}
        <button
          type="button"
          onClick={handleStart}
          aria-label="게임 시작"
          className="group mt-2 w-full max-w-[340px] rounded-[14px] py-5 font-display text-[18px] font-[800] tracking-[0.02em] transition-transform duration-[var(--dur-normal)] ease-[var(--ease-spring)] hover:-translate-y-0.5 active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#F59E0B] focus-visible:ring-offset-2"
          style={{
            background: 'linear-gradient(135deg, #1E3A8A 0%, #1E1B4B 60%, #0F172A 100%)',
            color: '#FCD34D',
            boxShadow:
              '0 0 0 1px rgba(245, 158, 11, 0.5), 0 5px 0 #0F172A, 0 14px 32px rgba(15, 23, 42, 0.3)',
          }}
        >
          시작하기
          <span className="ml-2 inline-block transition-transform group-hover:translate-x-0.5">
            →
          </span>
        </button>
      </div>
    </div>
  )
}
