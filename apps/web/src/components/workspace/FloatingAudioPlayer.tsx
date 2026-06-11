// apps/web/src/components/workspace/FloatingAudioPlayer.tsx
//
// v06.35 — 풀 재설계: 하단 dock + glass + 정제된 typography + Step Hero.
//
// 디자인 원칙:
//   · 항상 하단 (fixed bottom-0 — 가장자리에 anchored, 떠 있지 X)
//   · max-w 880px center · backdrop-blur-2xl 글라스 · 1px 상단 경계
//   · Underline 탭 (pill 제거) · Lora 영문 hero · tabular-nums 시간
//   · Step 모드: 문장 텍스트가 hero, play button 주변 countdown ring
//   · 회색/--p 액센트만 (이모지 최소화)
//
// 듀얼 소스 구조 보존:
//   ● 브라우저 음성 (TTS): 문장/단락/전체/따라하기
//   ● 원어민 보이스 (LibriVox): 챕터 스트림 — 문장 단위 X

'use client'

import {
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  Mic,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Square,
  StepForward,
  Volume2,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'

import { useTTS, type PlayMode, type SentenceItem } from '@/lib/workspace/tts-controller'
import {
  formatAudioTime,
  type ChapterAudio,
  type ChapterAudioPart,
} from '@/lib/workspace/chapter-audio'

import { VoicePickerPopover } from './VoicePickerPopover'

export type AudioSource = 'browser' | 'librivox'

interface Props {
  /** 챕터 전체 sentence 큐 (브라우저 TTS) */
  sentences: SentenceItem[]
  /** 닫기 (player 숨김) */
  onClose: () => void
  /** 항상 보임 여부 */
  isVisible: boolean
  /** 현재 챕터의 LibriVox 보이스 — null 이면 브라우저 전용 */
  chapterAudio?: ChapterAudio | null
  /** 활성 소스 (page.tsx 보유) */
  source: AudioSource
  /** 소스 토글 (사용자 명시 선택 — LS 저장) */
  onSourceChange: (s: AudioSource) => void
}

const MODE_OPTIONS: { mode: PlayMode; label: string; tooltip: string }[] = [
  { mode: 'sentence', label: '문장', tooltip: '한 문장만 듣기' },
  { mode: 'paragraph', label: '단락', tooltip: '현재 단락만 듣기' },
  { mode: 'all', label: '전체', tooltip: '챕터 전체 듣기' },
  { mode: 'step', label: '따라하기', tooltip: '문장 한 개씩 듣고 따라 말하기' },
]

const SPEED_OPTIONS = [0.75, 1.0, 1.25, 1.5] as const

export function FloatingAudioPlayer({
  sentences,
  onClose,
  isVisible,
  chapterAudio,
  source,
  onSourceChange,
}: Props) {
  const tts = useTTS()
  const audioRef = useRef<HTMLAudioElement>(null)
  const hasVoice = !!chapterAudio

  // 현재 챕터의 오디오 파트들 (다권=여러 파트, flat=1파트). 순차 재생.
  const parts: ChapterAudioPart[] =
    chapterAudio?.parts && chapterAudio.parts.length > 0
      ? chapterAudio.parts
      : chapterAudio
        ? [
            {
              url: chapterAudio.url,
              title: chapterAudio.title,
              reader: chapterAudio.reader,
              secs: chapterAudio.secs,
            },
          ]
        : []
  const [partIdx, setPartIdx] = useState(0)
  const chapterKey = chapterAudio?.url ?? null
  useEffect(() => {
    setPartIdx(0)
  }, [chapterKey])
  const currentPart = parts[partIdx] ?? parts[0] ?? null

  // 소스 전환 부수효과 — 상호 배타 재생.
  useEffect(() => {
    if (!hasVoice) return
    if (source === 'librivox') {
      tts.stop()
    } else {
      audioRef.current?.pause()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, hasVoice])

  return (
    <div
      role="region"
      aria-label="오디오 플레이어"
      className={`fixed inset-x-0 bottom-0 z-[70] border-t border-[var(--bd)] bg-[var(--t1)]/95 backdrop-blur-2xl shadow-[0_-12px_32px_-8px_rgba(0,0,0,0.18)] transition-transform duration-[var(--dur-slow)] ease-[var(--ease-spring)] ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
    >
      <div className="mx-auto flex w-full max-w-[920px] flex-col gap-2 px-4 py-3 text-white sm:px-6 sm:py-3.5">
        {/* 소스 토글 (보이스 연결된 챕터만) */}
        {hasVoice && (
          <SourceToggleRow source={source} onSourceChange={onSourceChange} onClose={onClose} />
        )}

        {/* 영구 오디오 엘리먼트 */}
        {chapterAudio && currentPart && (
          <audio ref={audioRef} src={currentPart.url} preload="none" className="hidden" />
        )}

        {/* 브라우저 음성 body */}
        <div className={source === 'browser' || !hasVoice ? '' : 'hidden'}>
          <BrowserBody sentences={sentences} onClose={onClose} hideClose={hasVoice} />
        </div>

        {/* 원어민 보이스 body */}
        {chapterAudio && (
          <div className={source === 'librivox' ? '' : 'hidden'}>
            <LibriVoxBody
              audio={chapterAudio}
              audioRef={audioRef}
              parts={parts}
              partIdx={partIdx}
              setPartIdx={setPartIdx}
            />
          </div>
        )}
      </div>
    </div>
  )
}

// ─── 소스 토글 row ───────────────────────────────────────
function SourceToggleRow({
  source,
  onSourceChange,
  onClose,
}: {
  source: AudioSource
  onSourceChange: (s: AudioSource) => void
  onClose: () => void
}) {
  const TABS: { key: AudioSource; label: string; icon: React.ReactNode }[] = [
    { key: 'browser', label: '브라우저 음성', icon: <Volume2 size={11} aria-hidden /> },
    { key: 'librivox', label: '원어민 성우', icon: <Mic size={11} aria-hidden /> },
  ]
  return (
    <div className="flex items-center justify-between gap-2">
      <div
        role="tablist"
        aria-label="듣기 소스"
        className="flex items-center gap-0.5 rounded-[var(--r-full)] bg-white/[0.08] p-0.5"
      >
        {TABS.map((t) => {
          const active = source === t.key
          return (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => onSourceChange(t.key)}
              className={`inline-flex items-center gap-1 rounded-[var(--r-full)] px-2.5 py-1 font-display text-[10.5px] font-[700] transition-colors ${
                active ? 'bg-white text-[var(--t1)]' : 'text-white/65 hover:text-white'
              }`}
            >
              {t.icon}
              {t.label}
            </button>
          )
        })}
      </div>
      <button
        type="button"
        onClick={onClose}
        aria-label="닫기"
        className="flex h-7 w-7 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white"
      >
        <X size={13} aria-hidden />
      </button>
    </div>
  )
}

// ─── 브라우저 음성 body — v06.35 재설계 ────────────────────
function BrowserBody({
  sentences,
  onClose,
  hideClose,
}: {
  sentences: SentenceItem[]
  onClose: () => void
  hideClose: boolean
}) {
  const tts = useTTS()
  const { state, mode } = { state: tts.state.state, mode: tts.state.mode }
  const isPlaying = state === 'playing'
  const isPaused = state === 'paused'
  const isAwaitingRepeat = state === 'awaiting_repeat'
  const isIdle = state === 'idle'
  const isStepMode = mode === 'step'
  const isStepActive = isStepMode && !isIdle

  const currentIdx = tts.state.currentSentenceIdx ?? 0
  const total = tts.state.totalSentences || sentences.length

  function handlePlayPause() {
    if (isPlaying) {
      tts.pause()
      return
    }
    if (isPaused) {
      tts.resume()
      return
    }
    if (sentences.length > 0) {
      const m = mode === 'step' ? 'step' : 'all'
      tts.playFromMode(m, sentences, 0)
    }
  }

  function handleSpeedChange() {
    const i = SPEED_OPTIONS.indexOf(tts.state.rate as (typeof SPEED_OPTIONS)[number])
    const next = SPEED_OPTIONS[(i + 1) % SPEED_OPTIONS.length]!
    tts.setRate(next)
  }

  // countdown ring 비율 (0~1) — awaiting_repeat 일 때만 의미.
  const countdownRatio =
    isAwaitingRepeat && tts.state.repeatTotalSec > 0
      ? Math.max(0, Math.min(1, (tts.state.repeatCountdown ?? 0) / tts.state.repeatTotalSec))
      : 1

  return (
    <div className="flex flex-col gap-3">
      {/* ── Row 1: Mode tabs (underline) + meta + voice/close ── */}
      <div className="flex items-center justify-between gap-3">
        <ModeTabs mode={mode} onChange={(m) => tts.setMode(m)} />

        <div className="flex items-center gap-3">
          {!isStepMode && total > 0 && (
            <span className="hidden font-mono text-[10.5px] tabular-nums text-white/55 sm:inline">
              {currentIdx + 1}
              <span className="mx-1 text-white/30">/</span>
              {total}
            </span>
          )}
          <VoicePickerPopover />
          {!hideClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="flex h-7 w-7 items-center justify-center rounded-full text-white/55 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X size={13} aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* ── Step Hero — Lora 문장 텍스트 (step mode 활성 시) ── */}
      {isStepActive && tts.state.currentText && (
        <StepHero
          stepNumber={currentIdx + 1}
          totalSteps={total}
          text={tts.state.currentText}
          isAwaitingRepeat={isAwaitingRepeat}
          countdown={tts.state.repeatCountdown}
        />
      )}

      {/* ── Transport row ── */}
      <div className="flex items-center gap-2">
        {/* 좌측 — 이전 단락 / 이전 문장 (or 다시 듣기 in step mode) */}
        {isStepActive ? (
          <button
            type="button"
            onClick={() => tts.stepReplay()}
            aria-label="이 문장 다시 듣기"
            title="다시 듣기"
            className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-all hover:bg-white/10 hover:text-white active:scale-95"
          >
            <RotateCcw size={15} aria-hidden />
          </button>
        ) : (
          <>
            <TransportButton
              onClick={() => !isIdle && tts.prevParagraph()}
              disabled={isIdle}
              label="이전 단락"
              icon={<ChevronsLeft size={16} aria-hidden />}
            />
            <TransportButton
              onClick={() => !isIdle && tts.prevSentence()}
              disabled={isIdle}
              label="이전 문장"
              icon={<SkipBack size={14} aria-hidden />}
            />
          </>
        )}

        {/* 중앙 — Play button (with countdown ring in step+awaiting_repeat) */}
        <div className="relative mx-auto sm:mx-0 sm:ml-2">
          {/* Countdown ring */}
          {isAwaitingRepeat && (
            <svg
              className="pointer-events-none absolute inset-0 -m-1.5"
              width="52"
              height="52"
              viewBox="0 0 52 52"
              aria-hidden
            >
              <circle
                cx="26"
                cy="26"
                r="23"
                fill="none"
                stroke="rgba(255,255,255,0.08)"
                strokeWidth="2"
              />
              <circle
                cx="26"
                cy="26"
                r="23"
                fill="none"
                stroke="var(--success)"
                strokeWidth="2"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 23}`}
                strokeDashoffset={`${2 * Math.PI * 23 * (1 - countdownRatio)}`}
                style={{
                  transform: 'rotate(-90deg)',
                  transformOrigin: '26px 26px',
                  transition: 'stroke-dashoffset 1000ms linear',
                }}
              />
            </svg>
          )}
          <button
            type="button"
            onClick={handlePlayPause}
            aria-label={isPlaying ? '일시정지' : '재생'}
            className="relative flex h-11 w-11 items-center justify-center rounded-full bg-white text-[var(--t1)] shadow-[0_4px_12px_rgba(0,0,0,0.25)] transition-transform hover:scale-105 active:scale-95"
          >
            {isPlaying ? (
              <Pause size={18} aria-hidden />
            ) : (
              <Play size={18} className="ml-0.5" aria-hidden />
            )}
          </button>
        </div>

        {/* Stop (모든 모드 공통, hidden when idle) */}
        {!isIdle && !isStepActive && (
          <TransportButton
            onClick={() => tts.stop()}
            label="정지"
            icon={<Square size={11} fill="currentColor" aria-hidden />}
          />
        )}

        {/* 우측 — 다음 문장 / 다음 단락 (or 즉시 다음 in step mode) */}
        {isStepActive ? (
          <button
            type="button"
            onClick={() => tts.stepAdvance()}
            aria-label="다음 문장"
            title="다음 문장"
            disabled={currentIdx + 1 >= total && !isAwaitingRepeat}
            className="flex h-9 items-center gap-1 rounded-[var(--r-full)] bg-[var(--p)] px-3.5 font-display text-[12px] font-[600] text-white shadow-[0_2px_8px_rgba(59,130,246,0.35)] transition-all hover:bg-[var(--p-hover)] active:scale-95 disabled:cursor-not-allowed disabled:opacity-40"
          >
            다음
            <StepForward size={12} aria-hidden />
          </button>
        ) : (
          <>
            <TransportButton
              onClick={() => !isIdle && tts.nextSentence()}
              disabled={isIdle}
              label="다음 문장"
              icon={<SkipForward size={14} aria-hidden />}
            />
            <TransportButton
              onClick={() => !isIdle && tts.nextParagraph()}
              disabled={isIdle}
              label="다음 단락"
              icon={<ChevronsRight size={16} aria-hidden />}
            />
          </>
        )}

        {/* Progress bar — non-step mode */}
        {!isStepMode && (
          <div className="relative mx-2 flex-1 hidden sm:block">
            <div className="h-[3px] overflow-hidden rounded-full bg-white/[0.10]">
              <div
                className="h-full bg-white transition-[width] duration-[var(--dur-slow)]"
                style={{
                  width: `${total > 0 ? Math.round(((currentIdx + 1) / total) * 100) : 0}%`,
                }}
                aria-hidden
              />
            </div>
          </div>
        )}

        {/* 속도 */}
        <button
          type="button"
          onClick={handleSpeedChange}
          aria-label={`재생 속도 ${tts.state.rate}x`}
          title="재생 속도"
          className="inline-flex h-8 min-w-[42px] items-center justify-center rounded-[var(--r-full)] border border-white/15 px-2 font-mono text-[10.5px] font-[700] tabular-nums text-white/85 transition-colors hover:bg-white/10 hover:text-white"
        >
          {tts.state.rate}x
        </button>
      </div>
    </div>
  )
}

// ─── ModeTabs (underline style) ──────────────────────────
function ModeTabs({
  mode,
  onChange,
}: {
  mode: PlayMode
  onChange: (m: PlayMode) => void
}) {
  return (
    <div
      role="tablist"
      aria-label="듣기 모드"
      className="relative flex items-center gap-1"
    >
      {MODE_OPTIONS.map((opt) => {
        const active = mode === opt.mode
        return (
          <button
            key={opt.mode}
            type="button"
            role="tab"
            aria-selected={active}
            title={opt.tooltip}
            onClick={() => onChange(opt.mode)}
            className={`relative px-2 py-1 font-display text-[12px] font-[600] transition-colors ${
              active ? 'text-white' : 'text-white/45 hover:text-white/85'
            }`}
          >
            {opt.label}
            {active && (
              <span
                aria-hidden
                className="absolute inset-x-1.5 -bottom-0.5 h-[2px] rounded-full bg-white"
              />
            )}
          </button>
        )
      })}
    </div>
  )
}

// ─── Transport button (정제된 ghost button) ──────────────
function TransportButton({
  onClick,
  disabled,
  label,
  icon,
}: {
  onClick: () => void
  disabled?: boolean
  label: string
  icon: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      title={label}
      className="flex h-9 w-9 items-center justify-center rounded-full text-white/70 transition-all hover:bg-white/10 hover:text-white active:scale-95 disabled:opacity-30 disabled:hover:bg-transparent"
    >
      {icon}
    </button>
  )
}

// ─── Step Hero — 문장 텍스트 hero 카드 ──────────────────
function StepHero({
  stepNumber,
  totalSteps,
  text,
  isAwaitingRepeat,
  countdown,
}: {
  stepNumber: number
  totalSteps: number
  text: string
  isAwaitingRepeat: boolean
  countdown: number | null
}) {
  return (
    <div className="flex flex-col gap-2 border-t border-white/[0.08] pt-3">
      {/* meta: step number + status */}
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-white/55">
          STEP{' '}
          <span className="font-display tabular-nums text-white/85">{stepNumber}</span>
          <span className="mx-1 text-white/30">/</span>
          <span className="font-display tabular-nums text-white/55">{totalSteps}</span>
        </span>
        <span
          className={`inline-flex items-center gap-1.5 font-display text-[11px] font-[700] transition-colors ${
            isAwaitingRepeat ? 'text-[var(--success)]' : 'text-white/65'
          }`}
        >
          <span
            aria-hidden
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              isAwaitingRepeat ? 'animate-pulse bg-[var(--success)]' : 'bg-white/40'
            }`}
          />
          {isAwaitingRepeat
            ? countdown != null
              ? `따라 말해 보세요 · ${countdown}s`
              : '따라 말해 보세요'
            : '듣는 중'}
        </span>
      </div>

      {/* sentence — Lora hero */}
      <p className="font-english text-[17px] leading-relaxed text-white sm:text-[19px]">
        {text}
      </p>
    </div>
  )
}

// ─── 원어민 보이스 body (LibriVox — 변경 없음, 색만 정제) ──
function LibriVoxBody({
  audio,
  audioRef,
  parts,
  partIdx,
  setPartIdx,
}: {
  audio: ChapterAudio
  audioRef: React.RefObject<HTMLAudioElement>
  parts: ChapterAudioPart[]
  partIdx: number
  setPartIdx: (i: number) => void
}) {
  const [playing, setPlaying] = useState(false)
  const [cur, setCur] = useState(0)
  const [dur, setDur] = useState(parts[partIdx]?.secs ?? audio.secs ?? 0)
  const [rate, setRate] = useState(1.0)

  const multiPart = parts.length > 1
  const currentPart = parts[partIdx] ?? parts[0] ?? null

  const partIdxRef = useRef(partIdx)
  partIdxRef.current = partIdx
  const partsLenRef = useRef(parts.length)
  partsLenRef.current = parts.length
  const rateRef = useRef(rate)
  rateRef.current = rate
  const autoPlayNextRef = useRef(false)

  useEffect(() => {
    const el = audioRef.current
    if (!el) return
    const onTime = () => setCur(el.currentTime)
    const onMeta = () => {
      if (Number.isFinite(el.duration) && el.duration > 0) setDur(el.duration)
    }
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onEnded = () => {
      if (partIdxRef.current < partsLenRef.current - 1) {
        autoPlayNextRef.current = true
        setPartIdx(partIdxRef.current + 1)
      } else {
        setPlaying(false)
        setCur(0)
      }
    }
    el.addEventListener('timeupdate', onTime)
    el.addEventListener('loadedmetadata', onMeta)
    el.addEventListener('play', onPlay)
    el.addEventListener('pause', onPause)
    el.addEventListener('ended', onEnded)
    setPlaying(!el.paused)
    setCur(el.currentTime)
    if (Number.isFinite(el.duration) && el.duration > 0) setDur(el.duration)
    return () => {
      el.removeEventListener('timeupdate', onTime)
      el.removeEventListener('loadedmetadata', onMeta)
      el.removeEventListener('play', onPlay)
      el.removeEventListener('pause', onPause)
      el.removeEventListener('ended', onEnded)
    }
  }, [audioRef, setPartIdx])

  useEffect(() => {
    setCur(0)
    setDur(parts[partIdx]?.secs ?? 0)
    const el = audioRef.current
    if (!el) return
    if (autoPlayNextRef.current) {
      autoPlayNextRef.current = false
      el.playbackRate = rateRef.current
      const p = el.play()
      if (p && typeof p.catch === 'function') p.catch(() => {})
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [partIdx])

  const total = dur && Number.isFinite(dur) && dur > 0 ? dur : currentPart?.secs ?? 0

  function goPart(next: number) {
    if (next < 0 || next >= parts.length || next === partIdx) return
    autoPlayNextRef.current = playing
    setPartIdx(next)
  }

  function toggle() {
    const el = audioRef.current
    if (!el) return
    if (el.paused) {
      el.playbackRate = rate
      void el.play()
    } else {
      el.pause()
    }
  }

  function skip(deltaSec: number) {
    const el = audioRef.current
    if (!el) return
    const target = el.currentTime + deltaSec
    const upper = total > 0 ? total : target
    const next = Math.max(0, Math.min(target, upper))
    el.currentTime = next
    setCur(next)
  }

  function seek(v: number) {
    const el = audioRef.current
    if (!el) return
    el.currentTime = v
    setCur(v)
  }

  function cycleRate() {
    const i = SPEED_OPTIONS.indexOf(rate as (typeof SPEED_OPTIONS)[number])
    const next = SPEED_OPTIONS[(i + 1) % SPEED_OPTIONS.length]!
    setRate(next)
    const el = audioRef.current
    if (el) el.playbackRate = next
  }

  return (
    <div className="flex flex-col gap-2">
      {/* 챕터 정보 + 성우 */}
      <div className="flex items-center justify-between gap-2 px-0.5">
        <span className="inline-flex min-w-0 items-center gap-1.5 font-body text-[11px] text-white/65">
          <Mic size={11} className="shrink-0 text-white/45" aria-hidden />
          <span className="truncate">
            {currentPart?.reader
              ? currentPart.reader
              : audio.reader
                ? audio.reader
                : '원어민 낭독'}
          </span>
          {multiPart && (
            <span className="shrink-0 rounded-[var(--r-full)] bg-white/10 px-1.5 font-mono text-[9.5px] font-[700] tabular-nums text-white/75">
              파트 {partIdx + 1}/{parts.length}
            </span>
          )}
          {!multiPart && audio.consistency === 'multi' && (
            <span className="shrink-0 text-white/35">· 챕터마다 성우 바뀜</span>
          )}
        </span>
        {audio.librivoxUrl && (
          <a
            href={audio.librivoxUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-0.5 font-mono text-[9.5px] text-white/35 transition-colors hover:text-white/75"
            aria-label="LibriVox 출처 보기"
          >
            LibriVox <ExternalLink size={8} aria-hidden />
          </a>
        )}
      </div>

      {/* 트랜스포트 */}
      <div className="flex items-center gap-2">
        {multiPart && (
          <TransportButton
            onClick={() => goPart(partIdx - 1)}
            disabled={partIdx === 0}
            label="이전 파트"
            icon={<SkipBack size={14} aria-hidden />}
          />
        )}

        <TransportButton
          onClick={() => skip(-10)}
          label="10초 뒤로"
          icon={<ChevronsLeft size={16} aria-hidden />}
        />

        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? '일시정지' : '재생'}
          className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-[var(--t1)] shadow-[0_4px_12px_rgba(0,0,0,0.25)] transition-transform hover:scale-105 active:scale-95"
        >
          {playing ? (
            <Pause size={18} aria-hidden />
          ) : (
            <Play size={18} className="ml-0.5" aria-hidden />
          )}
        </button>

        <TransportButton
          onClick={() => skip(10)}
          label="10초 앞으로"
          icon={<ChevronsRight size={16} aria-hidden />}
        />

        {multiPart && (
          <TransportButton
            onClick={() => goPart(partIdx + 1)}
            disabled={partIdx >= parts.length - 1}
            label="다음 파트"
            icon={<SkipForward size={14} aria-hidden />}
          />
        )}

        <span className="ml-2 shrink-0 font-mono text-[10.5px] tabular-nums text-white/65">
          {formatAudioTime(cur)} <span className="text-white/35">/</span> {formatAudioTime(total)}
        </span>

        <input
          type="range"
          min={0}
          max={total || 0}
          step={1}
          value={Math.min(cur, total || cur)}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="재생 위치"
          className="audio-seek mx-2 flex-1 accent-white"
        />

        <button
          type="button"
          onClick={cycleRate}
          aria-label={`재생 속도 ${rate}x`}
          title="재생 속도"
          className="inline-flex h-8 min-w-[42px] items-center justify-center rounded-[var(--r-full)] border border-white/15 px-2 font-mono text-[10.5px] font-[700] tabular-nums text-white/85 transition-colors hover:bg-white/10 hover:text-white"
        >
          {rate}x
        </button>
      </div>

      <p className="px-0.5 font-body text-[9.5px] text-white/35">
        문장 · 단락 단위 듣기는 ‘브라우저 음성’ 에서 가능해요
      </p>
    </div>
  )
}
