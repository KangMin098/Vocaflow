// apps/web/src/components/workspace/ShadowReadAlong.tsx
//
// 따라읽기(shadow) 인라인 패널 — 본문 페이지 상단에서 동작 (별도 페이지 이동 없음).
//
// UX (CLAUDE.md Calm UI · Empathetic Feedback · Progressive Disclosure):
//   - 문장 단위로 듣고 → 따라 말하고 → 자동으로 다음. 학습자는 클릭 없이 흐름만 따라가면 됨.
//   - 말하는 동안 맞춘 단어를 부드럽게(초록) 하이라이트 — "대략 인식" 시각 피드백.
//   - 비난·압박 없음. 못 따라와도 "괜찮아요, 다음 문장으로".
//   - 모든 컨트롤 44px+ · hover/active/focus/disabled 4상태 · 토큰 기반(다크 대응).

'use client'

import {
  AudioLines,
  Check,
  Ear,
  Mic,
  MicOff,
  Pause,
  Play,
  RotateCcw,
  SkipForward,
  X,
} from 'lucide-react'
import { useMemo } from 'react'

import { normalizeWord } from '@/lib/workspace/shadow-match'
import type { SentenceItem } from '@/lib/workspace/tts-controller'
import type { ShadowControls, ShadowState } from '@/lib/workspace/use-shadow-session'

interface ShadowReadAlongProps {
  sentences: SentenceItem[]
  state: ShadowState
  controls: ShadowControls
  /** "본문으로" / "종료" 시 호출 — 페이지가 mode 를 read 로 전환 */
  onExit: () => void
}

const RATES: { value: number; label: string }[] = [
  { value: 0.75, label: '0.75×' },
  { value: 1, label: '1.0×' },
]

export function ShadowReadAlong({ sentences, state, controls, onExit }: ShadowReadAlongProps) {
  const { running, paused, phase, index, total, sentenceIdx, transcript, matchedKeys, tone } = state

  const currentText = useMemo(() => {
    if (sentenceIdx == null) return ''
    return sentences.find((s) => s.sentenceIdx === sentenceIdx)?.text ?? ''
  }, [sentences, sentenceIdx])

  // 현재 문장을 단어 토큰으로 — 말하는 동안 맞춘 단어 하이라이트
  const tokens = useMemo(() => {
    return currentText.split(/(\s+)/).map((chunk, i) => {
      if (/^\s+$/.test(chunk) || chunk.length === 0) {
        return { key: i, text: chunk, matched: false, space: true }
      }
      return { key: i, text: chunk, matched: matchedKeys.has(normalizeWord(chunk)), space: false }
    })
  }, [currentText, matchedKeys])

  // ── 완료 ────────────────────────────────────────────
  if (phase === 'done') {
    return (
      <PanelShell>
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <span className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-[var(--p-light)] text-[var(--p)]">
            <Check size={22} strokeWidth={2.5} aria-hidden />
          </span>
          <div>
            <p className="font-display text-[15px] font-[700] text-[var(--t1)]">
              {total}개 문장을 모두 따라 읽었어요
            </p>
            <p className="mt-1 font-body text-[12.5px] italic text-[var(--t2)]">
              소리 내어 읽은 만큼 더 또렷하게 남아요 · 잠깐 쉬어도 좋아요
            </p>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <button
              type="button"
              onClick={() => controls.start(0)}
              className="inline-flex h-11 items-center gap-1.5 rounded-[var(--r-full)] bg-[var(--p)] px-5 font-display text-[13px] font-[700] text-white shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
            >
              <RotateCcw size={15} aria-hidden /> 처음부터 다시
            </button>
            <button
              type="button"
              onClick={onExit}
              className="inline-flex h-11 items-center rounded-[var(--r-full)] px-4 font-display text-[13px] font-[700] text-[var(--t2)] transition-all duration-[var(--dur-normal)] hover:bg-[var(--bg2)] active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
            >
              본문으로
            </button>
          </div>
        </div>
      </PanelShell>
    )
  }

  // ── 시작 전 ──────────────────────────────────────────
  if (!running) {
    return (
      <PanelShell>
        <div className="flex flex-col items-center gap-3 py-2 text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-[var(--p-light)] text-[var(--p)]">
            <Ear size={24} strokeWidth={2} aria-hidden />
          </span>
          <div>
            <h2 className="font-display text-[16px] font-[700] text-[var(--t1)]">따라읽기</h2>
            <p className="mx-auto mt-1 max-w-[420px] font-body text-[12.5px] leading-relaxed text-[var(--t2)]">
              문장을 듣고 그대로 따라 말해요. 한 문장이 끝나면 자동으로 다음 문장으로 이어집니다.
            </p>
          </div>
          <button
            type="button"
            onClick={() => controls.start(0)}
            className="mt-1 inline-flex h-12 items-center gap-2 rounded-[var(--r-full)] bg-[var(--p)] px-6 font-display text-[14px] font-[700] text-white shadow-[var(--sh-sm)] transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:brightness-110 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
          >
            <Play size={17} fill="currentColor" aria-hidden /> 시작하기
          </button>
          <p className="flex items-center gap-1.5 font-body text-[11px] text-[var(--t2)]">
            {state.recognitionSupported ? (
              <>
                <Mic size={12} aria-hidden /> 마이크로 발화를 부드럽게 인식해요 (정확한 채점은
                아니에요)
              </>
            ) : (
              <>
                <MicOff size={12} aria-hidden /> 이 브라우저는 음성 인식을 지원하지 않아 듣기 중심으로
                진행돼요
              </>
            )}
          </p>
        </div>
      </PanelShell>
    )
  }

  // ── 진행 중 ──────────────────────────────────────────
  const progress = total > 0 ? Math.round(((index + 1) / total) * 100) : 0
  const status = statusFor(phase, paused, tone, state.recognitionSupported, state.micDenied)

  return (
    <PanelShell>
      {/* 진행 표시 */}
      <div className="mb-3 flex items-center justify-between gap-3">
        <span className="font-mono text-[11px] font-[600] text-[var(--t2)]">
          문장 {Math.min(index + 1, total)} / {total}
        </span>
        <div
          className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--bg3)]"
          role="progressbar"
          aria-valuenow={progress}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-full rounded-full bg-[var(--p)] transition-all duration-[var(--dur-slow)] ease-[var(--ease)]"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* 상태 표시 */}
      <div className="flex items-center justify-center gap-2" aria-live="polite">
        <span
          className={`inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors duration-[var(--dur-normal)] ${status.iconWrap}`}
        >
          {status.icon}
        </span>
        <span className="font-display text-[13px] font-[700]" style={{ color: status.color }}>
          {status.label}
        </span>
      </div>

      {/* 현재 문장 — 말하는 동안 맞춘 단어 하이라이트 */}
      <p className="mt-3 text-center font-english text-[19px] font-[500] leading-relaxed md:text-[21px]">
        {tokens.map((t) =>
          t.space ? (
            t.text
          ) : (
            <span
              key={t.key}
              className="transition-colors duration-[var(--dur-normal)]"
              style={{
                color: t.matched ? 'var(--success)' : 'var(--t1)',
                fontWeight: t.matched ? 650 : 500,
              }}
            >
              {t.text}
            </span>
          ),
        )}
      </p>

      {/* 들린 말 (Progressive Disclosure — 작게) */}
      <div className="mt-2 min-h-[18px] text-center">
        {(phase === 'speaking' || phase === 'feedback') && transcript && (
          <p className="font-body text-[12px] italic text-[var(--t2)]">
            들린 말: “{transcript}”
          </p>
        )}
      </div>

      {/* 컨트롤 — 44px+ */}
      <div className="mt-3 flex items-center justify-center gap-1.5">
        <CtrlButton
          onClick={paused ? controls.resume : controls.pause}
          label={paused ? '계속' : '잠깐 멈춤'}
          primary
        >
          {paused ? <Play size={18} fill="currentColor" aria-hidden /> : <Pause size={18} aria-hidden />}
        </CtrlButton>
        <CtrlButton onClick={controls.repeat} label="다시 듣기">
          <RotateCcw size={17} aria-hidden />
        </CtrlButton>
        <CtrlButton onClick={controls.next} label="다음 문장">
          <SkipForward size={17} aria-hidden />
        </CtrlButton>
        <CtrlButton
          onClick={() => {
            controls.stop()
            onExit()
          }}
          label="종료"
        >
          <X size={17} aria-hidden />
        </CtrlButton>
      </div>

      {/* 보조 옵션 — 속도 + 자동 진행 */}
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-2">
        <div className="flex items-center gap-1">
          <span className="font-body text-[11px] text-[var(--t2)]">속도</span>
          {RATES.map((r) => (
            <button
              key={r.value}
              type="button"
              onClick={() => controls.setRate(r.value)}
              aria-pressed={state.rate === r.value}
              className={`h-7 rounded-[var(--r-full)] px-2.5 font-mono text-[11px] font-[600] transition-all duration-[var(--dur-normal)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] ${
                state.rate === r.value
                  ? 'bg-[var(--p)] text-white'
                  : 'text-[var(--t2)] hover:bg-[var(--bg2)]'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          onClick={() => controls.setAutoAdvance(!state.autoAdvance)}
          aria-pressed={state.autoAdvance}
          className="inline-flex items-center gap-1.5 font-body text-[11.5px] text-[var(--t2)] transition-colors hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-1 rounded"
        >
          <span
            aria-hidden
            className="relative inline-flex h-4 w-7 items-center rounded-full transition-colors duration-[var(--dur-normal)]"
            style={{ backgroundColor: state.autoAdvance ? 'var(--p)' : 'var(--bd)' }}
          >
            <span
              className="absolute h-3 w-3 rounded-full bg-white shadow-[var(--sh-xs)] transition-transform duration-[var(--dur-normal)]"
              style={{ transform: state.autoAdvance ? 'translateX(13px)' : 'translateX(2px)' }}
            />
          </span>
          자동 진행
        </button>
      </div>

      <p className="mt-2.5 text-center font-body text-[11px] italic text-[var(--t2)]">
        천천히 해도 괜찮아요 · 편할 때 잠깐 멈춰도 좋아요
      </p>
    </PanelShell>
  )
}

// ── 보조 컴포넌트 ──────────────────────────────────────

function PanelShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky top-0 z-20 border-b border-[var(--bd)]/60 bg-[var(--reading-bg)]/95 backdrop-blur-[16px]">
      <div className="mx-auto max-w-[640px] px-5 py-4 md:px-8">{children}</div>
    </div>
  )
}

function CtrlButton({
  onClick,
  label,
  primary = false,
  children,
}: {
  onClick: () => void
  label: string
  primary?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      title={label}
      className={`inline-flex h-11 w-11 items-center justify-center rounded-full transition-all duration-[var(--dur-normal)] ease-[var(--ease)] active:scale-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 ${
        primary
          ? 'bg-[var(--p)] text-white shadow-[var(--sh-sm)] hover:brightness-110'
          : 'border border-[var(--bd)] bg-[var(--bg)] text-[var(--t2)] hover:border-[var(--p)] hover:text-[var(--p)]'
      }`}
    >
      {children}
    </button>
  )
}

interface StatusInfo {
  icon: React.ReactNode
  iconWrap: string
  color: string
  label: string
}

function statusFor(
  phase: ShadowState['phase'],
  paused: boolean,
  tone: ShadowState['tone'],
  recognitionSupported: boolean,
  micDenied: boolean,
): StatusInfo {
  if (paused) {
    return {
      icon: <Pause size={16} aria-hidden />,
      iconWrap: 'bg-[var(--bg2)] text-[var(--t2)]',
      color: 'var(--t3)',
      label: '잠깐 멈췄어요',
    }
  }
  if (phase === 'listening') {
    return {
      icon: <AudioLines size={16} aria-hidden className="animate-pulse" />,
      iconWrap: 'bg-[var(--p-light)] text-[var(--p)]',
      color: 'var(--p)',
      label: '듣고 있어요',
    }
  }
  if (phase === 'speaking') {
    const useMic = recognitionSupported && !micDenied
    return {
      icon: useMic ? (
        <Mic size={16} aria-hidden className="animate-pulse" />
      ) : (
        <MicOff size={16} aria-hidden />
      ),
      iconWrap: 'bg-[var(--p-light)] text-[var(--p)]',
      color: 'var(--p)',
      label: useMic ? '따라 말해보세요' : '소리 내어 따라 읽어요',
    }
  }
  // feedback
  const map: Record<NonNullable<ShadowState['tone']>, string> = {
    great: '좋아요, 자연스러워요!',
    good: '좋아요, 계속 가볼게요',
    gentle: '괜찮아요, 다음 문장으로',
  }
  return {
    icon: <Check size={16} aria-hidden />,
    iconWrap: 'bg-[var(--success-light)] text-[var(--success)]',
    color: 'var(--success)',
    label: tone ? map[tone] : '좋아요',
  }
}
