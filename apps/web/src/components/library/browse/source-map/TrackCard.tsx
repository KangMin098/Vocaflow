// apps/web/src/components/library/browse/source-map/TrackCard.tsx
//
// 트랙 카드 — 기본 접힘(이름·한줄·난이도·효과칩), 펼침(왜·방법·편수·CTA).
// Progressive Disclosure: 첫 진입엔 가장 적합한(fit) 트랙 1개만 펼침(SourceMap 제어).
// 난이도 배지/CTA 활성은 입력→계산 (count=0 → "준비 중", CTA 비활성).

'use client'

import { forwardRef } from 'react'
import { ChevronDown, Lock } from 'lucide-react'

import {
  MODE_CTA,
  TRACK_FIT_META,
  judgeTrackFit,
  type SourceTrack,
} from '@/lib/articles/source-map'

export const TrackCard = forwardRef<
  HTMLDivElement,
  {
    track: SourceTrack
    userV: number
    count: number
    expanded: boolean
    highlighted: boolean
    onToggle: () => void
    onPick: (track: SourceTrack) => void
  }
>(function TrackCard({ track, userV, count, expanded, highlighted, onToggle, onPick }, ref) {
  const fit = judgeTrackFit(track, userV)
  const meta = TRACK_FIT_META[fit]
  const ready = count > 0

  return (
    <div
      ref={ref}
      className="flex flex-col gap-2.5 rounded-[var(--r-lg)] border bg-[var(--bg)] p-4 transition-all duration-[var(--dur-normal)] scroll-mt-24"
      style={{
        borderColor: highlighted ? track.accent : 'var(--bd)',
        boxShadow: highlighted ? `0 0 0 2px color-mix(in srgb, ${track.accent} 30%, transparent)` : 'var(--sh-xs)',
      }}
    >
      {/* 헤더 */}
      <div className="flex items-start gap-3">
        <span
          aria-hidden
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-md)] text-[18px]"
          style={{ backgroundColor: `color-mix(in srgb, ${track.accent} 12%, transparent)` }}
        >
          {track.icon}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-1.5">
            <h3 className="font-display text-[14.5px] font-[700] text-[var(--t1)]">{track.title}</h3>
            {/* 난이도 배지 (색+텍스트 — 색만 금지) */}
            <span
              className="inline-flex items-center rounded-[var(--r-full)] px-1.5 py-0.5 font-display text-[9.5px] font-[700]"
              style={{
                color: meta.color,
                backgroundColor: `color-mix(in srgb, ${meta.color} 14%, transparent)`,
              }}
            >
              {meta.label}
            </span>
            {/* 편수 (실집계) */}
            <span
              className="inline-flex items-center rounded-[var(--r-full)] bg-[var(--bg2)] px-1.5 py-0.5 font-mono text-[9.5px] font-[700] text-[var(--t2)]"
              title={ready ? `발행된 글 ${count}편` : '아직 발행된 글이 없어요'}
            >
              {ready ? `${count}편` : '준비 중'}
            </span>
          </div>
          <p className="font-body text-[12px] leading-[1.5] text-[var(--t2)]">{track.oneLine}</p>
        </div>
      </div>

      {/* 효과 칩 (always) */}
      <div className="flex flex-wrap gap-1">
        {track.skills.map((s) => (
          <span
            key={s}
            className="inline-flex items-center rounded-[var(--r-full)] px-2 py-0.5 font-mono text-[10px] font-[600] text-[var(--t2)]"
            style={{ backgroundColor: `color-mix(in srgb, ${track.accent} 9%, transparent)` }}
          >
            {s}
          </span>
        ))}
      </div>

      {/* 펼침 영역 */}
      {expanded && (
        <div className="flex flex-col gap-3 border-t border-[var(--bd)] pt-3">
          {/* 왜 (Empathetic — 사람의 말투, 한글이라 sans italic) */}
          <p className="font-body text-[12px] italic leading-[1.55] text-[var(--t2)]">{track.why}</p>

          {/* 어떻게 (method 단계) */}
          <div className="flex flex-col gap-1.5">
            <span className="font-display text-[10.5px] font-[700] uppercase tracking-wide text-[var(--t3)]">
              이렇게 배워요
            </span>
            <ol className="flex flex-col gap-1">
              {track.method.map((m, i) => (
                <li key={m} className="flex items-center gap-2 font-body text-[12px] text-[var(--t1)]">
                  <span
                    aria-hidden
                    className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[var(--r-full)] font-mono text-[9px] font-[700] text-[var(--ti)]"
                    style={{ backgroundColor: track.accent }}
                  >
                    {i + 1}
                  </span>
                  {m}
                </li>
              ))}
            </ol>
          </div>

          {/* note (ND 등) */}
          {track.note && (
            <p className="inline-flex items-center gap-1.5 rounded-[var(--r-md)] bg-[var(--bg2)] px-2.5 py-1.5 font-body text-[11px] text-[var(--t3)]">
              <Lock size={11} aria-hidden /> {track.note}
            </p>
          )}

          {/* CTA (mode별) */}
          <button
            type="button"
            disabled={!ready}
            onClick={() => onPick(track)}
            className="inline-flex h-10 items-center justify-center gap-1.5 rounded-[var(--r-md)] px-4 font-display text-[12.5px] font-[700] text-[var(--ti)] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
            style={{ backgroundColor: ready ? track.accent : 'var(--t3)' }}
          >
            {ready ? MODE_CTA[track.mode] : '곧 추가돼요'}
          </button>
        </div>
      )}

      {/* 접힘/펼침 토글 */}
      <button
        type="button"
        onClick={onToggle}
        aria-expanded={expanded}
        className="inline-flex items-center justify-center gap-1 rounded-[var(--r-sm)] py-1 font-display text-[11px] font-[600] text-[var(--t3)] transition-colors hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
      >
        {expanded ? '접기' : '어떻게 배워요'}
        <ChevronDown
          size={13}
          aria-hidden
          className="transition-transform"
          style={{ transform: expanded ? 'rotate(180deg)' : 'none' }}
        />
      </button>
    </div>
  )
})
