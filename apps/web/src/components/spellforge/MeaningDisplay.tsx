// apps/web/src/components/spellforge/MeaningDisplay.tsx

'use client'

import { Volume2 } from 'lucide-react'

interface MeaningDisplayProps {
  meaning: string
  pos: string
  pronunciation: string
  source: string
  onPlayAudio: () => void
  isPlaying: boolean
}

export function MeaningDisplay({
  meaning,
  pos,
  pronunciation,
  source,
  onPlayAudio,
  isPlaying,
}: MeaningDisplayProps) {
  return (
    <>
      {/* Source Tag */}
      <div className="mb-6 inline-flex items-center gap-1.5 rounded-[var(--r-full)] border border-[var(--bd)] bg-[var(--bg)] px-2.5 py-1 font-body text-[11px] italic text-[var(--t3)]">
        <svg
          width="11"
          height="11"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.75"
          aria-hidden="true"
        >
          <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
          <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
        </svg>
        {source}
      </div>

      {/* Meaning */}
      <div className="group mb-2 text-center">
        <span className="mb-3 inline-block rounded-[var(--r-full)] bg-[var(--p-light)] px-2.5 py-0.5 font-display text-[10px] font-[700] uppercase tracking-[0.08em] text-[var(--p)]">
          {pos}
        </span>
        <h2 className="mb-2 font-english text-[36px] font-[600] leading-tight text-[var(--t1)]">
          {meaning}
        </h2>
        {/* 발음 표기는 hover 시만 노출 (Layered Disclosure) */}
        <p className="mb-6 h-0 overflow-hidden font-mono text-[14px] text-[var(--t3)] opacity-0 transition-all duration-[var(--dur-normal)] group-hover:h-6 group-hover:opacity-100">
          {pronunciation}
        </p>
      </div>

      {/* Audio Button */}
      <button
        onClick={onPlayAudio}
        className={`mb-8 inline-flex items-center gap-2 rounded-[var(--r-full)] border px-4 py-2 font-display text-[12px] font-[600] transition-all duration-[var(--dur-normal)] ${
          isPlaying
            ? 'border-[var(--p)] bg-[var(--p)] text-white'
            : 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t2)] hover:-translate-y-0.5 hover:border-[var(--p)] hover:bg-[var(--bg2)] hover:text-[var(--p)] hover:shadow-[0_2px_8px_rgba(59,130,246,0.15)]'
        } `}
        aria-label="발음 듣기"
      >
        <Volume2
          size={14}
          strokeWidth={2}
          className={isPlaying ? 'animate-pulse' : ''}
          aria-hidden="true"
        />
        <span>발음 듣기</span>
      </button>
    </>
  )
}
