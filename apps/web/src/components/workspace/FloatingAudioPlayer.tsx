// apps/web/src/components/workspace/FloatingAudioPlayer.tsx

'use client'

import { Pause, Play, SkipBack, SkipForward, X } from 'lucide-react'

interface FloatingAudioPlayerProps {
  isVisible: boolean
  isPlaying: boolean
  currentSentence: number
  totalSentences: number
  currentTime: string
  totalTime: string
  progress: number // 0~100
  speed: number
  onPlayPause: () => void
  onPrev: () => void
  onNext: () => void
  onClose: () => void
  onSpeedChange: () => void
}

export function FloatingAudioPlayer({
  isVisible,
  isPlaying,
  currentSentence,
  totalSentences,
  currentTime,
  totalTime,
  progress,
  speed,
  onPlayPause,
  onPrev,
  onNext,
  onClose,
  onSpeedChange,
}: FloatingAudioPlayerProps) {
  return (
    <div
      role="region"
      aria-label="오디오 플레이어"
      className={`fixed bottom-6 left-1/2 z-[70] flex min-w-[480px] items-center gap-4 rounded-[var(--r-full)] bg-[var(--t1)] px-5 py-3 text-white shadow-[var(--sh-xl)] transition-transform duration-[var(--dur-slow)] ease-[var(--ease-spring)] ${
        isVisible
          ? '-translate-x-1/2 translate-y-0'
          : '-translate-x-1/2 translate-y-[calc(100%+24px)]'
      } `}
    >
      {/* Controls */}
      <div className="flex items-center gap-1">
        <button
          onClick={onPrev}
          aria-label="이전 문장"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 transition-colors duration-[var(--dur-normal)] hover:bg-white/20"
        >
          <SkipBack size={14} fill="currentColor" strokeWidth={1.5} aria-hidden="true" />
        </button>
        <button
          onClick={onPlayPause}
          aria-label={isPlaying ? '일시정지' : '재생'}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[var(--t1)] transition-colors duration-[var(--dur-normal)] hover:bg-white/90"
        >
          {isPlaying ? (
            <Pause size={14} fill="currentColor" strokeWidth={0} aria-hidden="true" />
          ) : (
            <Play
              size={14}
              fill="currentColor"
              strokeWidth={0}
              className="ml-0.5"
              aria-hidden="true"
            />
          )}
        </button>
        <button
          onClick={onNext}
          aria-label="다음 문장"
          className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 transition-colors duration-[var(--dur-normal)] hover:bg-white/20"
        >
          <SkipForward size={14} fill="currentColor" strokeWidth={1.5} aria-hidden="true" />
        </button>
      </div>

      {/* Info */}
      <div className="flex flex-1 items-center gap-3">
        <span className="min-w-[60px] font-mono text-[11px] opacity-85">
          문장 {currentSentence}/{totalSentences}
        </span>
        <div className="h-1 flex-1 cursor-pointer overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-white transition-[width] duration-[var(--dur-fast)]"
            style={{ width: `${progress}%` }}
          />
        </div>
        <span className="min-w-[80px] text-right font-mono text-[11px] opacity-85">
          {currentTime} / {totalTime}
        </span>
      </div>

      {/* Speed */}
      <button
        onClick={onSpeedChange}
        className="rounded-full bg-white/10 px-2.5 py-1 font-mono text-[11px] font-[700] transition-colors duration-[var(--dur-normal)] hover:bg-white/20"
      >
        {speed}x
      </button>

      {/* Close */}
      <button
        onClick={onClose}
        aria-label="플레이어 닫기"
        className="flex h-7 w-7 items-center justify-center rounded-full text-white/60 transition-all duration-[var(--dur-normal)] hover:bg-white/10 hover:text-white"
      >
        <X size={14} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  )
}
