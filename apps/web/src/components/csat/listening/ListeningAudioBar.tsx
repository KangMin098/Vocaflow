// apps/web/src/components/csat/listening/ListeningAudioBar.tsx
//
// 재생 · 일시정지 · 구간 반복 · 속도(I8). 원음이 없으면 「원음 없음」을 분명히 보이고 조작을 막는다(이유를 글로).
// 합성 테스트 음원은 「테스트용 합성 음원」 표지를 붙인다 — 공식 음원으로 보이지 않게.
'use client'

import { AlertTriangle, Pause, Play, Repeat, VolumeX } from 'lucide-react'

import type { ListeningAudioSource } from '@/lib/csat/listening/types'

import { PLAYBACK_RATES, type ListeningAudio } from './useListeningAudio'

export const BTN =
  'inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-1.5 rounded-[var(--r-md)] border px-3 text-[14px] break-keep focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--ju)] disabled:cursor-not-allowed disabled:opacity-50'
export const ON = 'border-[var(--t1)] bg-[var(--bg3)] font-semibold text-[var(--t1)]'
export const OFF = 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t2)]'

export interface ListeningAudioBarProps {
  source: ListeningAudioSource
  audio: ListeningAudio
  /** 선택한 발화의 구간(시각이 있을 때만) */
  segment: { startMs: number; endMs: number; label: string } | null
}

export function ListeningAudioBar({ source, audio, segment }: ListeningAudioBarProps) {
  const noSource = audio.status === 'no-source'
  const failed = audio.status === 'error'
  const off = noSource || failed
  return (
    <section aria-label="음성 재생" className="flex flex-wrap items-center gap-2 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
      {noSource ? (
        <p role="status" data-testid="audio-none" className="flex min-h-[44px] items-center gap-2 text-[14px] font-semibold text-[var(--t1)] break-keep">
          <VolumeX size={18} aria-hidden="true" />
          원음 없음 — 공식 음원이 확보되지 않았다. 합성 음성(TTS)으로 대신하지 않는다. 대본으로 판단한다.
        </p>
      ) : null}
      {failed ? (
        <p role="alert" data-testid="audio-error" className="flex min-h-[44px] items-center gap-2 text-[14px] font-semibold text-[var(--t1)] break-keep">
          <AlertTriangle size={18} aria-hidden="true" />
          재생 실패 — 음원을 불러오지 못했다.
        </p>
      ) : null}
      {source.kind === 'synthetic-test-fixture' ? (
        <span className="rounded-[var(--r-md)] border border-dashed border-[var(--t2)] px-2 py-1 text-[12px] text-[var(--t1)] break-keep">테스트용 합성 음원 · 공식 아님</span>
      ) : null}
      <div className="ml-auto flex flex-wrap items-center gap-2">
        <button
          type="button"
          className={`${BTN} ${OFF}`}
          onClick={audio.toggle}
          disabled={off}
          aria-label={audio.status === 'playing' ? '일시정지' : '재생'}
          title={off ? '재생할 음원이 없다' : undefined}
        >
          {audio.status === 'playing' ? <Pause size={16} aria-hidden="true" /> : <Play size={16} aria-hidden="true" />}
          {audio.status === 'playing' ? '일시정지' : '재생'}
        </button>
        <button
          type="button"
          className={`${BTN} ${OFF}`}
          onClick={() => segment && audio.playSegment(segment.startMs, segment.endMs)}
          disabled={off || !segment}
          aria-label={segment ? `${segment.label} 구간 다시 듣기` : '구간 다시 듣기 — 시각 정보가 있는 발화를 고르면 열린다'}
        >
          <Repeat size={16} aria-hidden="true" />
          구간 반복
        </button>
        <div role="group" aria-label="재생 속도" className="flex gap-1">
          {PLAYBACK_RATES.map((r) => (
            <button key={r} type="button" className={`${BTN} ${audio.rate === r ? ON : OFF}`} aria-pressed={audio.rate === r} disabled={off} onClick={() => audio.setRate(r)}>
              {r}×
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
