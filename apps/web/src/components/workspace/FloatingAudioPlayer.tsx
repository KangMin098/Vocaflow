// apps/web/src/components/workspace/FloatingAudioPlayer.tsx
//
// v06.42 — 하단 고정형 바 재설계 (theme-aware frosted paper-glass).
//
// 표면은 `--mat-glass-*`(테마별 종이/먹 글라스), 글자는 ink 토큰(--t1/t2/t3),
// 액센트는 --p(비텍스트만) + ink-flip(--t1/--bg, 텍스트 동반 버튼). 라이트·다크 모두 대비 충분.
//   (이전 `bg-[var(--t1)]/95 + text-white` 는 --t1=텍스트 토큰이라 다크모드 흰-위-흰 가독성 0 버그였음.)
//
// 디자인 원칙:
//   · 하단 고정 바 — fixed bottom-0 가장자리 flush(여백·radius 없음) + 상단 hairline + 위로 향한 soft shadow
//     + 콘텐츠 중앙 정렬(max-w 920) + 모바일 safe-area-inset 하단 패딩 · translate-y-full 로 숨김
//   · iOS 세그먼트 컨트롤(소스·모드) · Lora 영문 Step Hero · tabular-nums 시간
//   · 모든 인터랙티브: hover/active/focus-visible/disabled 4상태 · 터치타겟 ≥40px
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

// 공용 인터랙션 토큰 — focus-visible 링 (모든 버튼 일관)
const RING =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--bg)]'

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
      className={`fixed bottom-0 left-0 right-0 z-[70] border-t border-[var(--bd)] text-[var(--t1)] shadow-[0_-8px_32px_-12px_rgba(0,0,0,0.28)] transition-transform duration-[var(--dur-slow)] ease-[var(--ease-ios-spring)] md:left-[var(--sidebar-w,240px)] ${
        isVisible ? 'translate-y-0' : 'translate-y-full'
      }`}
      style={{
        background: 'var(--mat-glass-bg-thick)',
        backdropFilter: 'blur(24px) saturate(1.6)',
        WebkitBackdropFilter: 'blur(24px) saturate(1.6)',
      }}
    >
      {/* 하단 고정 바 — 가장자리 flush · 상단 hairline + 위로 향한 soft shadow · 콘텐츠는 중앙 정렬 · 최소 높이 */}
      <div className="mx-auto flex w-full max-w-[920px] flex-col gap-1 px-3 pt-1 pb-[max(0.4rem,env(safe-area-inset-bottom))] sm:px-5 sm:pt-1.5">
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

// ─── iOS 세그먼트 컨트롤 (소스·모드 공용) ─────────────────
function Segmented<T extends string>({
  options,
  value,
  onChange,
  ariaLabel,
  size = 'md',
}: {
  options: { key: T; label: string; icon?: React.ReactNode; tooltip?: string }[]
  value: T
  onChange: (v: T) => void
  ariaLabel: string
  size?: 'sm' | 'md'
}) {
  const pad = size === 'sm' ? 'px-2 py-0.5 text-[10.5px]' : 'px-3 py-1 text-[12px]'
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className="inline-flex items-center gap-0.5 rounded-[var(--r-ios-pill)] bg-[var(--bg2)] p-0.5"
    >
      {options.map((o) => {
        const active = value === o.key
        return (
          <button
            key={o.key}
            type="button"
            role="tab"
            aria-selected={active}
            title={o.tooltip}
            onClick={() => onChange(o.key)}
            className={`inline-flex items-center gap-1 rounded-[var(--r-ios-pill)] font-display font-[700] transition-all duration-[var(--dur-ios-fast)] ${pad} ${RING} ${
              active
                ? 'bg-[var(--t1)] text-[var(--bg)] shadow-[var(--sh-ios-1)]'
                : 'text-[var(--t2)] hover:bg-[var(--bg3)] hover:text-[var(--t1)]'
            }`}
          >
            {o.icon}
            {o.label}
          </button>
        )
      })}
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
  return (
    <div className="flex items-center justify-between gap-2">
      <Segmented<AudioSource>
        ariaLabel="듣기 소스"
        size="sm"
        value={source}
        onChange={onSourceChange}
        options={[
          { key: 'browser', label: '브라우저 음성', icon: <Volume2 size={11} aria-hidden /> },
          { key: 'librivox', label: '원어민 성우', icon: <Mic size={11} aria-hidden /> },
        ]}
      />
      <CloseButton onClose={onClose} />
    </div>
  )
}

function CloseButton({ onClose }: { onClose: () => void }) {
  return (
    <button
      type="button"
      onClick={onClose}
      aria-label="닫기"
      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--t3)] transition-colors duration-[var(--dur-ios-fast)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] ${RING}`}
    >
      <X size={14} aria-hidden />
    </button>
  )
}

// ─── 브라우저 음성 body ───────────────────────────────────
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

  // 재생/일시정지 버튼 (step·non-step 공용 — focal, ink-flip)
  const playBtn = (
    <button
      type="button"
      onClick={handlePlayPause}
      aria-label={isPlaying ? '일시정지' : '재생'}
      className={`relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--t1)] text-[var(--bg)] shadow-[var(--sh-ios-2)] transition-transform duration-[var(--dur-ios-fast)] hover:scale-105 active:scale-95 ${RING}`}
    >
      {isPlaying ? <Pause size={17} aria-hidden /> : <Play size={17} className="ml-0.5" aria-hidden />}
    </button>
  )

  return (
    <div className="flex flex-col gap-2">
      {/* Step Hero — 따라하기 모드 활성 시만 (문장 텍스트 노출 필요) */}
      {isStepActive && tts.state.currentText && (
        <StepHero
          stepNumber={currentIdx + 1}
          totalSteps={total}
          text={tts.state.currentText}
          isAwaitingRepeat={isAwaitingRepeat}
          countdown={tts.state.repeatCountdown}
        />
      )}

      {/* ── 단일 컨트롤 행 (최소 높이) ── */}
      <div className="flex flex-wrap items-center gap-x-1.5 gap-y-1">
        {/* 모드 (compact) */}
        <Segmented<PlayMode>
          ariaLabel="듣기 모드"
          size="sm"
          value={mode}
          onChange={(m) => tts.setMode(m)}
          options={MODE_OPTIONS.map((o) => ({ key: o.mode, label: o.label, tooltip: o.tooltip }))}
        />

        {/* 트랜스포트 — 문장 단위 (단락은 모드로, 정지는 닫기/일시정지로) */}
        {isStepActive ? (
          <div className="flex items-center gap-1">
            <TransportButton
              onClick={() => tts.stepReplay()}
              label="이 문장 다시 듣기"
              icon={<RotateCcw size={15} aria-hidden />}
            />
            <div className="relative">
              {isAwaitingRepeat && (
                <svg className="pointer-events-none absolute inset-0 -m-1" width="52" height="52" viewBox="0 0 52 52" aria-hidden>
                  <circle cx="26" cy="26" r="23" fill="none" stroke="var(--bd)" strokeWidth="2.5" />
                  <circle
                    cx="26" cy="26" r="23" fill="none" stroke="var(--success)" strokeWidth="2.5" strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 23}`}
                    strokeDashoffset={`${2 * Math.PI * 23 * (1 - countdownRatio)}`}
                    style={{ transform: 'rotate(-90deg)', transformOrigin: '26px 26px', transition: 'stroke-dashoffset 1000ms linear' }}
                  />
                </svg>
              )}
              {playBtn}
            </div>
            <button
              type="button"
              onClick={() => tts.stepAdvance()}
              aria-label="다음 문장"
              title="다음 문장"
              disabled={currentIdx + 1 >= total && !isAwaitingRepeat}
              className={`flex h-9 items-center gap-1 rounded-[var(--r-ios-pill)] bg-[var(--t1)] px-3 font-display text-[12px] font-[700] text-[var(--bg)] transition-all duration-[var(--dur-ios-fast)] hover:opacity-90 active:scale-95 disabled:cursor-not-allowed disabled:opacity-40 ${RING}`}
            >
              다음
              <StepForward size={12} aria-hidden />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1">
            <TransportButton
              onClick={() => !isIdle && tts.prevSentence()}
              disabled={isIdle}
              label="이전 문장"
              icon={<SkipBack size={15} aria-hidden />}
            />
            {playBtn}
            <TransportButton
              onClick={() => !isIdle && tts.nextSentence()}
              disabled={isIdle}
              label="다음 문장"
              icon={<SkipForward size={15} aria-hidden />}
            />
          </div>
        )}

        {/* 진행바 + 위치 (non-step · ≥sm) */}
        {!isStepMode && (
          <div className="hidden min-w-0 flex-1 items-center gap-2 sm:flex">
            <div className="h-[3px] flex-1 overflow-hidden rounded-full bg-[var(--bd)]">
              <div
                className="h-full rounded-full bg-[var(--p)] transition-[width] duration-[var(--dur-slow)]"
                style={{ width: `${total > 0 ? Math.round(((currentIdx + 1) / total) * 100) : 0}%` }}
                aria-hidden
              />
            </div>
            <span className="shrink-0 font-mono text-[10.5px] tabular-nums text-[var(--t3)]">
              <span className="text-[var(--t1)]">{currentIdx + 1}</span>
              <span className="mx-0.5 text-[var(--t4)]">/</span>
              {total}
            </span>
          </div>
        )}

        {/* 우측 — 속도 · voice · 닫기 */}
        <div className="ml-auto flex items-center gap-1.5">
          <SpeedButton rate={tts.state.rate} onClick={handleSpeedChange} />
          <VoicePickerPopover />
          {!hideClose && <CloseButton onClose={onClose} />}
        </div>
      </div>
    </div>
  )
}

// ─── Transport button (정제된 ghost button, 터치타겟 40px) ──
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
      className={`flex h-9 w-9 items-center justify-center rounded-full text-[var(--t2)] transition-all duration-[var(--dur-ios-fast)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] active:scale-95 disabled:opacity-30 disabled:hover:bg-transparent ${RING}`}
    >
      {icon}
    </button>
  )
}

// ─── 속도 토글 버튼 (브라우저·LibriVox 공용 룩) ──────────
function SpeedButton({ rate, onClick }: { rate: number; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`재생 속도 ${rate}x`}
      title="재생 속도"
      className={`inline-flex h-8 min-w-[40px] shrink-0 items-center justify-center rounded-[var(--r-ios-pill)] border border-[var(--bd)] px-2 font-mono text-[10.5px] font-[700] tabular-nums text-[var(--t2)] transition-colors duration-[var(--dur-ios-fast)] hover:border-[var(--p)] hover:bg-[var(--bg2)] hover:text-[var(--t1)] ${RING}`}
    >
      {rate}x
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
    <div className="flex flex-col gap-2 rounded-[var(--r-ios-lg)] border border-[var(--bd)] bg-[var(--bg2)] px-4 py-3">
      {/* meta: step number + status */}
      <div className="flex items-center justify-between gap-3">
        <span className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--t3)]">
          STEP <span className="font-display tabular-nums text-[var(--t1)]">{stepNumber}</span>
          <span className="mx-1 text-[var(--t4)]">/</span>
          <span className="font-display tabular-nums text-[var(--t3)]">{totalSteps}</span>
        </span>
        <span
          className={`inline-flex items-center gap-1.5 font-display text-[11px] font-[700] transition-colors ${
            isAwaitingRepeat ? 'text-[var(--success)]' : 'text-[var(--t2)]'
          }`}
        >
          <span
            aria-hidden
            className={`inline-block h-1.5 w-1.5 rounded-full ${
              isAwaitingRepeat ? 'animate-pulse bg-[var(--success)]' : 'bg-[var(--t4)]'
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
      <p className="font-english text-[18px] leading-relaxed text-[var(--t1)] sm:text-[20px]">
        {text}
      </p>
    </div>
  )
}

// ─── 원어민 보이스 body (LibriVox — 로직 보존, 색만 재설계) ──
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
    <div className="flex items-center gap-1.5">
      {/* 성우 — 최소화 (작게·truncate·모바일 숨김. 전체 이름은 title) */}
      <span
        className="hidden min-w-0 max-w-[100px] items-center gap-1 font-body text-[10.5px] text-[var(--t3)] sm:inline-flex"
        title={currentPart?.reader ?? audio.reader ?? '원어민 낭독'}
      >
        <Mic size={11} className="shrink-0 text-[var(--t4)]" aria-hidden />
        <span className="truncate">{currentPart?.reader ?? audio.reader ?? '원어민'}</span>
        {multiPart && (
          <span className="shrink-0 font-mono text-[9px] tabular-nums text-[var(--t4)]">
            {partIdx + 1}/{parts.length}
          </span>
        )}
      </span>

      {/* 트랜스포트 */}
      {multiPart && (
        <TransportButton
          onClick={() => goPart(partIdx - 1)}
          disabled={partIdx === 0}
          label="이전 파트"
          icon={<SkipBack size={15} aria-hidden />}
        />
      )}
      <TransportButton onClick={() => skip(-10)} label="10초 뒤로" icon={<ChevronsLeft size={17} aria-hidden />} />
      <button
        type="button"
        onClick={toggle}
        aria-label={playing ? '일시정지' : '재생'}
        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[var(--t1)] text-[var(--bg)] shadow-[var(--sh-ios-2)] transition-transform duration-[var(--dur-ios-fast)] hover:scale-105 active:scale-95 ${RING}`}
      >
        {playing ? <Pause size={17} aria-hidden /> : <Play size={17} className="ml-0.5" aria-hidden />}
      </button>
      <TransportButton onClick={() => skip(10)} label="10초 앞으로" icon={<ChevronsRight size={17} aria-hidden />} />
      {multiPart && (
        <TransportButton
          onClick={() => goPart(partIdx + 1)}
          disabled={partIdx >= parts.length - 1}
          label="다음 파트"
          icon={<SkipForward size={15} aria-hidden />}
        />
      )}

      {/* 시간 + seek */}
      <span className="ml-1 shrink-0 font-mono text-[10px] tabular-nums text-[var(--t3)]">
        {formatAudioTime(cur)}
        <span className="mx-0.5 text-[var(--t4)]">/</span>
        {formatAudioTime(total)}
      </span>
      <input
        type="range"
        min={0}
        max={total || 0}
        step={1}
        value={Math.min(cur, total || cur)}
        onChange={(e) => seek(Number(e.target.value))}
        aria-label="재생 위치"
        className={`audio-seek mx-1 min-w-0 flex-1 accent-[var(--p)] ${RING} rounded-full`}
      />

      {/* 속도 + LibriVox 출처 (아이콘만 — 최소화) */}
      <SpeedButton rate={rate} onClick={cycleRate} />
      {audio.librivoxUrl && (
        <a
          href={audio.librivoxUrl}
          target="_blank"
          rel="noreferrer"
          title="LibriVox 출처"
          aria-label="LibriVox 출처 보기"
          className={`inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-[var(--t4)] transition-colors hover:bg-[var(--bg2)] hover:text-[var(--p)] ${RING}`}
        >
          <ExternalLink size={13} aria-hidden />
        </a>
      )}
    </div>
  )
}
