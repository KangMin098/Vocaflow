// apps/web/src/components/library/browse/SeriesDetail.tsx
//
// 시리즈 상세 (v06.238) — /library/scripts 진입면에서 시리즈를 고른 뒤 나타나는 "구체화" 계층.
// Progressive Disclosure: 능력·학습과학(why)·학습법 같은 깊이는 여기서만 노출(진입면은 조용하게).
// 학습 심리: 학습자가 스스로 고른 뒤라 인지 부하가 정당화되고, 맥락과 함께 몰입이 준비됨.

'use client'

import { ArrowLeft, ArrowRight, Clock, Volume2 } from 'lucide-react'

import { TRACK_FIT_META, type TrackStat } from '@/lib/articles/source-map'

import { ArticleCard } from './ArticleCard'

export function SeriesDetail({
  stat,
  userV,
  onBack,
}: {
  stat: TrackStat
  userV: number
  onBack: () => void
}) {
  const { track, count, cefrLabel, hasAudio, fit } = stat
  const fitMeta = TRACK_FIT_META[fit]

  return (
    <div className="flex flex-col gap-6">
      {/* 뒤로 — 진입면(시리즈 목록)으로 */}
      <button
        type="button"
        onClick={onBack}
        className="inline-flex w-fit items-center gap-1.5 rounded-[var(--r-md)] px-1 py-1 font-display text-[13px] font-[600] text-[var(--t2)] transition-colors hover:text-[var(--t1)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
      >
        <ArrowLeft size={15} aria-hidden /> 시리즈 목록
      </button>

      {/* 정체성 헤더 */}
      <header className="flex flex-col gap-3">
        <div className="flex items-start gap-3">
          <span
            aria-hidden
            className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-[var(--r-lg)] text-[24px]"
            style={{ backgroundColor: `color-mix(in srgb, ${track.accent} 14%, transparent)` }}
          >
            {track.icon}
          </span>
          <div className="flex min-w-0 flex-1 flex-col gap-1">
            <h1 className="font-editorial text-[26px] font-[500] leading-[1.1] tracking-[-0.01em] text-[var(--t1)] md:text-[30px]">
              {track.title}
            </h1>
            <p className="font-body text-[13.5px] leading-[1.5] text-[var(--t2)]">{track.oneLine}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 pl-[3.75rem]">
          <span
            className="inline-flex items-center rounded-[var(--r-full)] px-2 py-0.5 font-display text-[11px] font-[800]"
            style={{ color: fitMeta.color, backgroundColor: `color-mix(in srgb, ${fitMeta.color} 14%, transparent)` }}
          >
            {fitMeta.label}
          </span>
          <span
            className="inline-flex items-center rounded-[var(--r-sm)] px-1.5 py-0.5 font-mono text-[11px] font-[700]"
            style={{ color: track.accent, backgroundColor: `color-mix(in srgb, ${track.accent} 12%, transparent)` }}
          >
            {cefrLabel}
          </span>
          <span className="font-mono text-[11.5px] font-[600] text-[var(--t3)]">{count}편</span>
          {hasAudio && (
            <span className="inline-flex items-center gap-1 font-mono text-[11.5px] font-[600] text-[var(--t3)]" title="원어민 음성 포함">
              <Volume2 size={12} aria-hidden /> 음성
            </span>
          )}
        </div>
      </header>

      {/* 깊이 — 능력 · 학습과학 · 학습법 (선택 후에만) */}
      <section className="flex flex-col gap-5 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-5">
        <div className="flex flex-col gap-2">
          <span className="font-display text-[11px] font-[800] uppercase tracking-[0.08em] text-[var(--t3)]">
            이 시리즈로 기르는 것
          </span>
          <div className="flex flex-wrap gap-1.5">
            {track.skills.map((sk) => (
              <span
                key={sk}
                className="inline-flex items-center rounded-[var(--r-full)] bg-[var(--bg)] px-2.5 py-1 font-display text-[12px] font-[600] text-[var(--t2)] shadow-[var(--sh-xs)]"
              >
                {sk}
              </span>
            ))}
          </div>
        </div>

        {/* 왜 효과적인가 — Lora italic "사람의 말투" (Empathetic Feedback) */}
        <p className="border-l-2 pl-3 font-english text-[13.5px] italic leading-[1.55] text-[var(--t2)]" style={{ borderColor: `color-mix(in srgb, ${track.accent} 45%, transparent)` }}>
          {track.why}
        </p>

        <div className="flex flex-col gap-2">
          <span className="font-display text-[11px] font-[800] uppercase tracking-[0.08em] text-[var(--t3)]">
            어떻게 공부하나요
          </span>
          <ol className="flex flex-wrap items-center gap-x-1 gap-y-2">
            {track.method.map((step, i) => (
              <li key={step} className="inline-flex items-center gap-1">
                <span className="inline-flex items-center gap-1.5 rounded-[var(--r-full)] bg-[var(--bg)] py-1 pl-1.5 pr-2.5 font-display text-[12px] font-[600] text-[var(--t2)] shadow-[var(--sh-xs)]">
                  <span
                    aria-hidden
                    className="inline-flex h-[18px] w-[18px] items-center justify-center rounded-[var(--r-full)] bg-[var(--p)] font-mono text-[9.5px] font-[800] text-[var(--ti)]"
                  >
                    {i + 1}
                  </span>
                  {step}
                </span>
                {i < track.method.length - 1 && (
                  <ArrowRight size={12} aria-hidden className="text-[var(--t4)]" />
                )}
              </li>
            ))}
          </ol>
        </div>

        {track.note && (
          <p className="font-body text-[11.5px] leading-[1.45] text-[var(--t3)]">※ {track.note}</p>
        )}
      </section>

      {/* 글 목록 */}
      <section aria-label="글 목록" className="flex flex-col gap-3">
        <div className="flex items-center gap-1.5 px-0.5">
          <span className="font-display text-[13px] font-[800] text-[var(--t1)]">글 고르기</span>
          <span className="inline-flex items-center gap-1 font-mono text-[11px] font-[600] text-[var(--t3)]">
            <Clock size={11} aria-hidden /> 짧은 글부터
          </span>
        </div>
        <div role="list" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {stat.items.map((a) => (
            <div role="listitem" key={a.id}>
              <ArticleCard article={a} userVLevel={userV} />
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}
