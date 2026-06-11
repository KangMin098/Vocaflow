// apps/web/src/components/workspace/FloatingAudioPlayer.tsx
//
// v06.x — 듀얼 소스 audio player.
//   ● 브라우저 음성 (TTS): 문장 / 단락 / 전체 — 문장 하이라이트 동기, 외부 의존 0.
//   ● 원어민 보이스 (LibriVox): 현재 챕터 전체 오디오 스트림 (archive.org).
//       └ 큐레이터가 "챕터 일치" 확인 후 연결한 도서에서만 노출 (chapterAudio non-null).
//       └ ⚠ 챕터 전체 스트림 — 문장/단락 단위 듣기 불가 (타임스탬프 없음).
//          그래서 소스 토글로 둘을 분리: 정밀 학습=브라우저 / 자연스러운 청취=원어민.
//
// 소스 상태(source)는 page.tsx 가 보유 — 문장 클릭 시 자동으로 브라우저로 전환되기 때문.
// chapterAudio 가 null 이면 기존 브라우저 전용 player 와 동일하게 동작 (회귀 없음).

'use client'

import { useEffect, useRef, useState } from 'react'
import {
  ChevronsLeft,
  ChevronsRight,
  ExternalLink,
  Mic,
  Pause,
  Play,
  SkipBack,
  SkipForward,
  Square,
  Volume2,
  X,
} from 'lucide-react'

import { RotateCcw, StepForward } from 'lucide-react'

import { useTTS, type PlayMode, type SentenceItem } from '@/lib/workspace/tts-controller'
import { formatAudioTime, type ChapterAudio, type ChapterAudioPart } from '@/lib/workspace/chapter-audio'

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
  { mode: 'step', label: '따라하기', tooltip: '문장 한 개씩 듣고 따라 말하기 (Step)' },
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
  // 챕터 변경 시 파트 인덱스 초기화 (parts[0].url 이 챕터마다 바뀜)
  const chapterKey = chapterAudio?.url ?? null
  useEffect(() => {
    setPartIdx(0)
  }, [chapterKey])
  const currentPart = parts[partIdx] ?? parts[0] ?? null

  // 소스 전환 부수효과 — 상호 배타 재생.
  useEffect(() => {
    if (!hasVoice) return
    if (source === 'librivox') {
      tts.stop() // 원어민 진입 시 브라우저 TTS 정지
    } else {
      audioRef.current?.pause() // 브라우저 진입 시 오디오 일시정지 (position 유지)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [source, hasVoice])

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
      {/* 소스 토글 (보이스 연결된 챕터만) */}
      {hasVoice && (
        <SourceToggleRow source={source} onSourceChange={onSourceChange} onClose={onClose} />
      )}

      {/* 영구 오디오 엘리먼트 — 현재 파트 src. 소스 토글로 숨겨도 mount 유지 (재생 위치 보존) */}
      {chapterAudio && currentPart && (
        <audio ref={audioRef} src={currentPart.url} preload="none" className="hidden" />
      )}

      {/* 브라우저 음성 body — librivox 활성 시 숨김(언마운트 X, 위치/voice state 보존) */}
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
    { key: 'browser', label: '브라우저 음성', icon: <Volume2 size={12} aria-hidden /> },
    { key: 'librivox', label: '원어민 성우', icon: <Mic size={12} aria-hidden /> },
  ]
  return (
    <div className="flex items-center justify-between gap-2">
      <div
        role="tablist"
        aria-label="듣기 소스"
        className="flex items-center gap-0.5 rounded-[var(--r-full)] bg-white/10 p-0.5"
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
                active ? 'bg-white text-[var(--t1)]' : 'text-white/75 hover:text-white'
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
        className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
      >
        <X size={13} aria-hidden />
      </button>
    </div>
  )
}

// ─── 원어민 보이스 body (LibriVox 챕터 스트림 — 다권 멀티파트 순차 재생) ───────────────
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

  // 최신값 ref (이벤트 리스너 stale closure 방지)
  const partIdxRef = useRef(partIdx)
  partIdxRef.current = partIdx
  const partsLenRef = useRef(parts.length)
  partsLenRef.current = parts.length
  const rateRef = useRef(rate)
  rateRef.current = rate
  // 다음 파트로 자동/수동 전환 시 src 변경 후 자동 재생할지
  const autoPlayNextRef = useRef(false)

  // 오디오 엘리먼트 이벤트 → state 동기
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
      // 다음 파트가 있으면 자동 연결 재생, 없으면 종료
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
    // 초기 동기
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

  // 파트 전환 — src(부모) 갱신 후 진행도 초기화 + 필요 시 자동 재생
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

  const total = dur && Number.isFinite(dur) && dur > 0 ? dur : (currentPart?.secs ?? 0)

  function goPart(next: number) {
    if (next < 0 || next >= parts.length || next === partIdx) return
    autoPlayNextRef.current = playing // 재생 중이면 이어서 재생
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
    <div className="flex flex-col gap-1.5">
      {/* 챕터 정보 + 성우 */}
      <div className="flex items-center justify-between gap-2 px-0.5">
        <span className="inline-flex min-w-0 items-center gap-1.5 font-body text-[11px] text-white/80">
          <Mic size={11} className="shrink-0 text-white/60" aria-hidden />
          <span className="truncate">
            {currentPart?.reader
              ? `🎙 ${currentPart.reader}`
              : audio.reader
                ? `🎙 ${audio.reader}`
                : '원어민 낭독'}
          </span>
          {multiPart && (
            <span className="shrink-0 rounded-[var(--r-full)] bg-white/15 px-1.5 font-mono text-[9.5px] font-[700] text-white/85">
              파트 {partIdx + 1}/{parts.length}
            </span>
          )}
          {!multiPart && audio.consistency === 'multi' && (
            <span className="shrink-0 text-white/45">· 챕터마다 성우 바뀜</span>
          )}
        </span>
        {audio.librivoxUrl && (
          <a
            href={audio.librivoxUrl}
            target="_blank"
            rel="noreferrer"
            className="inline-flex shrink-0 items-center gap-0.5 font-mono text-[9.5px] text-white/45 transition-colors hover:text-white/80"
            aria-label="LibriVox 출처 보기"
          >
            LibriVox <ExternalLink size={8} aria-hidden />
          </a>
        )}
      </div>

      {/* 트랜스포트 */}
      <div className="flex items-center gap-2">
        {/* 이전 파트 (다권 멀티파트) */}
        {multiPart && (
          <button
            type="button"
            onClick={() => goPart(partIdx - 1)}
            disabled={partIdx === 0}
            aria-label="이전 파트"
            title="이전 파트"
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <SkipBack size={14} aria-hidden />
          </button>
        )}

        {/* -10s */}
        <button
          type="button"
          onClick={() => skip(-10)}
          aria-label="10초 뒤로"
          title="10초 뒤로"
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ChevronsLeft size={15} aria-hidden />
        </button>

        {/* play / pause */}
        <button
          type="button"
          onClick={toggle}
          aria-label={playing ? '일시정지' : '재생'}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[var(--t1)] shadow-[0_2px_6px_rgba(0,0,0,0.3)] transition-transform hover:scale-105 active:scale-95"
        >
          {playing ? <Pause size={17} aria-hidden /> : <Play size={17} className="ml-0.5" aria-hidden />}
        </button>

        {/* +10s */}
        <button
          type="button"
          onClick={() => skip(10)}
          aria-label="10초 앞으로"
          title="10초 앞으로"
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white"
        >
          <ChevronsRight size={15} aria-hidden />
        </button>

        {/* 다음 파트 (다권 멀티파트) */}
        {multiPart && (
          <button
            type="button"
            onClick={() => goPart(partIdx + 1)}
            disabled={partIdx >= parts.length - 1}
            aria-label="다음 파트"
            title="다음 파트"
            className="flex h-8 w-8 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <SkipForward size={14} aria-hidden />
          </button>
        )}

        {/* 시간 */}
        <span className="ml-1 shrink-0 font-mono text-[10px] text-white/75 tabular-nums">
          {formatAudioTime(cur)} / {formatAudioTime(total)}
        </span>

        {/* seek */}
        <input
          type="range"
          min={0}
          max={total || 0}
          step={1}
          value={Math.min(cur, total || cur)}
          onChange={(e) => seek(Number(e.target.value))}
          aria-label="재생 위치"
          className="audio-seek mx-1 flex-1 accent-white"
        />

        {/* 속도 */}
        <button
          type="button"
          onClick={cycleRate}
          aria-label={`재생 속도 ${rate}x`}
          title="재생 속도"
          className="inline-flex h-7 min-w-[42px] items-center justify-center rounded-[var(--r-full)] bg-white/10 px-2 font-mono text-[10.5px] font-[700] text-white transition-colors hover:bg-white/20"
        >
          {rate}x
        </button>
      </div>

      {/* 차이점 안내 — 문장/단락은 브라우저에서 */}
      <p className="px-0.5 font-body text-[9.5px] text-white/40">
        문장·단락 단위 듣기는 ‘브라우저 음성’ 에서 가능해요
      </p>
    </div>
  )
}

// ─── 브라우저 음성 body (기존 TTS player) ───────────────────
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
  const isStepActive = mode === 'step' && !isIdle

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
    if (sentences.length > 0) {
      // 중앙 재생 — 모드별 적합 동작:
      //   step → 따라하기 시작 (문장 1부터 카운트다운 자동 진행)
      //   그 외 → 전체 연속 재생
      const m = mode === 'step' ? 'step' : 'all'
      tts.playFromMode(m, sentences, 0)
    }
  }

  function handleSpeedChange() {
    const i = SPEED_OPTIONS.indexOf(tts.state.rate as (typeof SPEED_OPTIONS)[number])
    const next = SPEED_OPTIONS[(i + 1) % SPEED_OPTIONS.length]!
    tts.setRate(next)
  }

  return (
    <div className="flex flex-col gap-2">
      {/* Row 1 — Mode toggle + 진행 + Voice + 닫기 */}
      <div className="flex items-center justify-between gap-2">
        <div
          role="tablist"
          aria-label="듣기 모드"
          className="flex items-center gap-0.5 rounded-[var(--r-full)] bg-white/10 p-0.5"
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
                onClick={() => tts.setMode(opt.mode)}
                className={`rounded-[var(--r-full)] px-2.5 py-0.5 font-display text-[10.5px] font-[700] transition-colors ${
                  active ? 'bg-white text-[var(--t1)]' : 'text-white/80 hover:text-white'
                }`}
              >
                {opt.label}
              </button>
            )
          })}
        </div>

        <span className="hidden font-mono text-[10px] text-white/75 tabular-nums sm:inline">
          {mode === 'step' && isStepActive
            ? `STEP ${currentIdx + 1} / ${total}`
            : total > 0
              ? `${currentIdx + 1} / ${total}`
              : '0 / 0'}
        </span>

        <div className="flex items-center gap-1.5">
          <VoicePickerPopover />
          {!hideClose && (
            <button
              type="button"
              onClick={onClose}
              aria-label="닫기"
              className="flex h-7 w-7 items-center justify-center rounded-full text-white/70 transition-colors hover:bg-white/10 hover:text-white"
            >
              <X size={13} aria-hidden />
            </button>
          )}
        </div>
      </div>

      {/* v06.35 — Step mode 활성 시 — 현재 문장 카드 + 따라하기 카운트다운 + Replay/Next */}
      {isStepActive && tts.state.currentText && (
        <StepCard
          stepNumber={currentIdx + 1}
          totalSteps={total}
          text={tts.state.currentText}
          isAwaitingRepeat={isAwaitingRepeat}
          countdown={tts.state.repeatCountdown}
          totalCountdown={tts.state.repeatTotalSec}
          onReplay={() => tts.stepReplay()}
          onAdvance={() => tts.stepAdvance()}
          isLastStep={currentIdx + 1 >= total}
        />
      )}

      {/* Row 2 — Controls + Progress */}
      <div className="flex items-center gap-2">
        <button
          type="button"
          onClick={() => !isIdle && tts.prevParagraph()}
          disabled={isIdle}
          aria-label="이전 단락"
          title="이전 단락"
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronsLeft size={15} aria-hidden />
        </button>

        <button
          type="button"
          onClick={() => !isIdle && tts.prevSentence()}
          disabled={isIdle}
          aria-label="이전 문장"
          title="이전 문장"
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <SkipBack size={14} aria-hidden />
        </button>

        <button
          type="button"
          onClick={handlePlayPause}
          aria-label={isPlaying ? '일시정지' : '재생'}
          className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-[var(--t1)] shadow-[0_2px_6px_rgba(0,0,0,0.3)] transition-transform hover:scale-105 active:scale-95"
        >
          {isPlaying ? <Pause size={17} aria-hidden /> : <Play size={17} className="ml-0.5" aria-hidden />}
        </button>

        <button
          type="button"
          onClick={() => tts.stop()}
          disabled={isIdle}
          aria-label="정지"
          title="정지"
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <Square size={11} fill="currentColor" aria-hidden />
        </button>

        <button
          type="button"
          onClick={() => !isIdle && tts.nextSentence()}
          disabled={isIdle}
          aria-label="다음 문장"
          title="다음 문장"
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <SkipForward size={14} aria-hidden />
        </button>

        <button
          type="button"
          onClick={() => !isIdle && tts.nextParagraph()}
          disabled={isIdle}
          aria-label="다음 단락"
          title="다음 단락"
          className="flex h-8 w-8 items-center justify-center rounded-full text-white/85 transition-colors hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ChevronsRight size={15} aria-hidden />
        </button>

        <div className="relative mx-2 flex-1">
          <div className="h-1 overflow-hidden rounded-full bg-white/15">
            <div
              className="h-full bg-white transition-[width] duration-[var(--dur-slow)]"
              style={{ width: `${progress}%` }}
              aria-hidden
            />
          </div>
        </div>

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

// ─── v06.35 — Step (따라하기) 카드 — 리틀팍스 스타일 ───────────────
function StepCard({
  stepNumber,
  totalSteps,
  text,
  isAwaitingRepeat,
  countdown,
  totalCountdown,
  onReplay,
  onAdvance,
  isLastStep,
}: {
  stepNumber: number
  totalSteps: number
  text: string
  isAwaitingRepeat: boolean
  countdown: number | null
  totalCountdown: number
  onReplay: () => void
  onAdvance: () => void
  isLastStep: boolean
}) {
  const countdownPct =
    isAwaitingRepeat && totalCountdown > 0
      ? Math.max(0, Math.min(100, ((countdown ?? 0) / totalCountdown) * 100))
      : 100

  return (
    <div className="flex flex-col gap-2 rounded-[var(--r-lg)] border border-white/15 bg-white/[0.06] px-3 py-2.5">
      {/* 상단 — Step 번호 + 상태 라벨 */}
      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex items-center gap-1.5">
          <span
            aria-hidden
            className="inline-flex h-6 min-w-[28px] items-center justify-center rounded-[var(--r-full)] bg-white px-2 font-mono text-[10.5px] font-[700] tabular-nums text-[var(--t1)]"
          >
            {stepNumber}
          </span>
          <span className="font-mono text-[9.5px] uppercase tracking-[0.18em] text-white/55">
            STEP · {stepNumber} / {totalSteps}
          </span>
        </div>
        <span
          className={`font-display text-[10.5px] font-[700] transition-colors ${
            isAwaitingRepeat ? 'text-[var(--success)]' : 'text-white/65'
          }`}
        >
          {isAwaitingRepeat ? '👤 따라 말해 보세요' : '🔊 듣는 중'}
        </span>
      </div>

      {/* 영어 문장 — Lora */}
      <p className="font-english text-[15px] leading-snug text-white">{text}</p>

      {/* 카운트다운 bar (따라하기 대기 중에만) */}
      <div
        className="h-[3px] w-full overflow-hidden rounded-full bg-white/12"
        aria-hidden
      >
        <div
          className="h-full rounded-full bg-[var(--success)] transition-[width] duration-[1000ms] ease-linear"
          style={{ width: `${countdownPct}%` }}
        />
      </div>

      {/* 액션 row — 다시 듣기 / 카운트다운 표시 / 다음 */}
      <div className="flex items-center justify-between gap-2 pt-0.5">
        <button
          type="button"
          onClick={onReplay}
          aria-label="이 문장 다시 듣기"
          title="다시 듣기"
          className="inline-flex items-center gap-1.5 rounded-[var(--r-full)] bg-white/10 px-2.5 py-1 font-display text-[10.5px] font-[700] text-white transition-colors hover:bg-white/20"
        >
          <RotateCcw size={11} aria-hidden />
          다시 듣기
        </button>

        {isAwaitingRepeat && countdown != null && (
          <span className="font-mono text-[10.5px] tabular-nums text-white/75">
            {countdown}s 후 다음
          </span>
        )}

        <button
          type="button"
          onClick={onAdvance}
          aria-label={isLastStep ? '학습 끝' : '다음 문장으로'}
          title={isLastStep ? '학습 끝' : '다음 문장'}
          disabled={isLastStep && !isAwaitingRepeat}
          className="inline-flex items-center gap-1.5 rounded-[var(--r-full)] bg-[var(--p)] px-3 py-1 font-display text-[10.5px] font-[700] text-white shadow-[0_2px_6px_rgba(0,0,0,0.25)] transition-all hover:bg-[var(--p-hover)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isLastStep ? '끝' : '다음'}
          {!isLastStep && <StepForward size={11} aria-hidden />}
        </button>
      </div>
    </div>
  )
}
