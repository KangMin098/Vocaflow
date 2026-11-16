// apps/web/src/components/echo/ReplayPanel.tsx
//
// 결과(scored) 화면의 「다시 듣기」 — 같은 문장의 예시와 이번 발화를 골라 다시 듣고 억양 곡선과 대 본다.
// 버퍼가 없으면 준비되지 않았다고만 말한다(다른 문장 · 지난 발화로 대신하지 않는다).
// 재생 실패는 재생 오류로만 알린다 — 점수 · 기록은 그대로다.
'use client'

import { Play, Square } from 'lucide-react'

import type { ReplayState, ReplayTarget } from '@/lib/echo/replay-controller'

interface Props {
  referenceReady: boolean
  selfReady: boolean
  state: ReplayState
  onPlay: (target: ReplayTarget) => void
  onStop: () => void
}

const LABEL: Record<ReplayTarget, string> = {
  reference: '예시 다시 듣기',
  self: '내 발화 다시 듣기',
}

const UNREADY: Record<ReplayTarget, string> = {
  reference: '이 문장의 예시 음성이 아직 준비되지 않았어요.',
  self: '이 문장에서 이번에 녹음한 발화가 없어요.',
}

export function ReplayPanel({ referenceReady, selfReady, state, onPlay, onStop }: Props) {
  const ready: Record<ReplayTarget, boolean> = { reference: referenceReady, self: selfReady }
  const missing = (['reference', 'self'] as const).filter((t) => !ready[t])
  return (
    <section
      aria-label="다시 듣고 비교하기"
      data-echo-replay
      className="flex flex-col gap-3 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg)] p-4"
    >
      <p className="break-keep font-body text-[12px] text-[var(--t2)]">
        곡선이 갈라진 곳을 귀로 확인해 보세요 — 예시와 내 발화를 번갈아 들을 수 있어요.
      </p>
      <div className="flex flex-wrap items-center gap-2">
        {(['reference', 'self'] as const).map((t) => {
          const playing = state.playing === t
          return (
            <button
              key={t}
              type="button"
              data-replay-target={t}
              aria-pressed={playing}
              disabled={!ready[t]}
              onClick={() => (playing ? onStop() : onPlay(t))}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 font-display text-[12px] font-[700] text-[var(--t1)] transition-colors hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-40 aria-pressed:border-[var(--p)] aria-pressed:text-[var(--p)]"
            >
              {playing ? <Square size={12} aria-hidden /> : <Play size={12} aria-hidden />}
              {playing ? `${t === 'reference' ? '예시' : '내 발화'} 정지` : LABEL[t]}
            </button>
          )
        })}
      </div>
      <p aria-live="polite" className="min-h-[1em] break-keep font-body text-[12px] text-[var(--t2)]">
        {state.failed
          ? `${state.failed === 'reference' ? '예시' : '내 발화'}를 재생하지 못했어요. 점수와 기록은 그대로예요 — 다시 눌러 보세요.`
          : state.playing
            ? `${state.playing === 'reference' ? '예시' : '내 발화'} 재생 중`
            : missing.map((t) => UNREADY[t]).join(' ')}
      </p>
    </section>
  )
}
