// apps/web/src/components/workspace/FloatingAudioPlayer.tsx
//
// v06.32 — 풍부한 audio player.
// - 3 mode toggle: 한 문장씩 / 단락 / 전체
// - prev/play-pause/next + paragraph nav (skip 2)
// - speed (0.5-1.5)
// - voice picker popover (브라우저 음성)
// - 진행 카운터 (현재 / 총 문장)
//
// tts-controller (singleton) 와 직접 wire.
// page.tsx 는 sentences[] 전달만 — 재생은 player 내부에서 controller 호출.

'use client'

import { ChevronsLeft, ChevronsRight, Pause, Play, SkipBack, SkipForward, Square, X } from 'lucide-react'

import { useTTS, type PlayMode, type SentenceItem } from '@/lib/workspace/tts-controller'

import { VoicePickerPopover } from './VoicePickerPopover'

interface Props {
  /** 챕터 전체 sentence 큐 */
  sentences: SentenceItem[]
  /** 닫기 (player 숨김) */
  onClose: () => void
  /** 항상 보임 여부 */
  isVisible: boolean
}

const MODE_OPTIONS: { mode: PlayMode; label: string; tooltip: string }[] = [
  { mode: 'sentence', label: '문장', tooltip: '한 문장만 듣기' },
  { mode: 'paragraph', label: '단락', tooltip: '현재 단락만 듣기' },
  { mode: 'all', label: '전체', tooltip: '챕터 전체 듣기' },
]

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5] as const

export function FloatingAudioPlayer({ sentences, onClose, isVisible }: Props) {
  const tts = useTTS()
  const { state, mode } = { state: tts.state.state, mode: tts.state.mode }
  const isPlaying = state === 'playing'
  const isPaused = state === 'paused'
  const isIdle = state === 'idle'

  const currentIdx = tts.state.currentSentenceIdx ?? 0
  const total = tts.state.totalSentences || sentences.length
  const progress = total > 0 ? Math.round(((currentIdx + 1) / total) * 100) : 0

  function handlePlayPause() {
    if (isPlaying) {
      tts.pause()
      return
    }
    if (isPaused) {
      tts.resume()
      return
    }
    // idle → 현재 mode 로 처음부터 재생
    if (sentences.length > 0) {
      tts.playFromMode(mode, sentences, 0)
    }
  }

  function handlePrev() {
    if (isIdle) return
    tts.prevSentence()
  }

  function handleNext() {
    if (isIdle) return
    tts.nextSentence()
  }

  function handlePrevParagraph() {
    if (isIdle) return
    tts.prevParagraph()
  }

  function handleNextParagraph() {
    if (isIdle) return
    tts.nextParagraph()
  }

  function handleStop() {
    tts.stop()
  }

  function handleSpeedChange() {
    const i = SPEED_OPTIONS.indexOf(tts.state.rate as 0.75 | 1.0 | 1.25 | 1.5)
    const next = SPEED_OPTIONS[(i + 1) % SPEED_OPTIONS.length]!
    tts.setRate(next)
  }

  function handleModeChange(next: PlayMode) {
    tts.setMode(next)
  }

  return (
    <div
      role="region"
      aria-label="오디오 플레이어"
      className={`fixed bottom-5 left-1/2 z-[70] flex w-[min(640px,calc(100vw-2rem))] flex-col gap-2 rounded-[var(--r-xl)] bg-[var(--t1)] px-3 py-2.5 text-white shadow-[var(--sh-xl)] transition-transform duration-[var(--dur-slow)] ease-[var(--ease-spring)] sm:px-4 ${
        isVisible
          ? '-translate-x-1/2 translate-y-0'
          : '-translate-x-1/2 translate-y-[calc(100%+32px)]'
      } `}
    >
      {/* Row 1 — Mode toggle + 진행 + Voice + 닫기 */}
      <div className="flex items-center justify-between gap-2">
        {/* Mode toggle (segmented control) */}
        <div role="tablist" aria-label="듣기 모드" className="flex items-center gap-0.5 rounded-[var(--r-full)] bg-white/10 p-0.5">
          {MODE_OPTIONS.map((opt) => {
            const active = mode === opt.mode
            return (
              <button
                key={opt.mode}
                type="button"
                role="tab"
                aria-selected={active}
                title={opt.tooltip}
                onClick={() => handleModeChange(opt.mode)}
                className={`rounded-[var(--r-full)] px-2.5 py-0.5 font-display text-[10.5px] font-[700] transition-colors ${
                  active ? 'bg-white text-[var(--t1)]' : 'text-white/80 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>

        {/* 진행 카운터 */}
        <span className="hidden font-mono text-[10px] text-white/75 tabular-nums sm:inline">
          {total > 0 ? `${currentIdx + 1} / ${total}` : '0 / 0'}
        </span>

        {/* Right: Voice + Close */}
        <div className="flex items-center gap-1.5">
          <VoicePickerPopover />
          <button
            type="button"
            onClick={onClose}
            aria-label="닫기"
            className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            <X size={13} aria-hidden />
          </button>
        </div>
      </div>

      {/* Row 2 — Controls + Progress */}
      <div className="flex items-center gap-2">
        {/* Prev paragraph */}
        <button
          type="button"
          onClick={handlePrevParagraph}
          disabled={isIdle}
          aria-label="이전 단락"
          title="이전 단락"
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronsLeft size={15} aria-hidden />
        </button>

        {/* Prev sentence */}
        <button
          type="button"
          onClick={handlePrev}
          disabled={isIdle}
          aria-label="이전 문장"
          title="이전 문장"
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <SkipBack size={14} aria-hidden />
        </button>

        {/* Play / Pause */}
        <button
          type="button"
          onClick={handlePlayPause}
          aria-label={isPlaying ? '일시정지' : '재생'}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[var(--t1)] shadow-[0_2px_6px_rgba(0,0,0,0.3)] transition-transform hover:scale-105 active:scale-95"
        >
          {isPlaying ? <Pause size={17} aria-hidden /> : <Play size={17} className="ml-0.5" aria-hidden />}
        </button>

        {/* Stop (idle 아닐 때만 활성) */}
        <button
          type="button"
          onClick={handleStop}
          disabled={isIdle}
          aria-label="정지"
          title="정지"
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Square size={11} fill="currentColor" aria-hidden />
        </button>

        {/* Next sentence */}
        <button
          type="button"
          onClick={handleNext}
          disabled={isIdle}
          aria-label="다음 문장"
          title="다음 문장"
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <SkipForward size={14} aria-hidden />
        </button>

        {/* Next paragraph */}
        <button
          type="button"
          onClick={handleNextParagraph}
          disabled={isIdle}
          aria-label="다음 단락"
          title="다음 단락"
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronsRight size={15} aria-hidden />
        </button>

        {/* Progress bar */}
        <div className="relative mx-2 flex-1">
          <div className="h-1 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full bg-white transition-[width] duration-[var(--dur-slow)]"
              style={{ width: `${progress}%` }}
              aria-hidden
            />
          </div>
        </div>

        {/* Speed */}
        <button
          type="button"
          onClick={handleSpeedChange}
          aria-label={`재생 속도 ${tts.state.rate}x`}
          title="재생 속도"
          className="inline-flex h-7 min-w-[42px] items-center justify-center rounded-[var(--r-full)] bg-white/10 px-2 font-mono text-[10.5px] font-[700] text-white transition-colors hover:bg-white/20"
        >
          {tts.state.rate}x
        </button>
      </div>
    </div>
  )
}
