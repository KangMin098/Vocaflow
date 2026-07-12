// apps/web/src/components/library/browse/TrackOrientationCard.tsx
//
// 시리즈(트랙) 오리엔테이션 카드 (v06.221) — /library/scripts.
// "이 시리즈가 내게 맞나? 뭘 길러주나? 어떻게 공부하나?"에 한 카드로 답한다.
// source-map.ts 의 그동안 미사용이던 데이터(skills·why·method·note)를 전부 노출.
//   · fit 배지 = 실데이터 판정(딱 맞아요/수월/도전) — 색 + 텍스트 (§10).
//   · why = Lora italic "사람의 말투" (Empathetic Feedback 철학).
//   · 대표글 = 추천순 1편 미리보기 · CTA = 시리즈 전체 드릴다운.

'use client'

import { ArrowRight, Sparkles, Volume2 } from 'lucide-react'

import { TRACK_FIT_META, type TrackKey, type TrackStat } from '@/lib/articles/source-map'

export function TrackOrientationCard({
  stat,
  recommended,
  onOpen,
}: {
  stat: TrackStat
  recommended: boolean
  onOpen: (key: TrackKey) => void
}) {
  const { track, count, cefrLabel, hasAudio, fit } = stat
  const fitMeta = TRACK_FIT_META[fit]
  const sample = stat.items[0] ?? null

  return (
    <article
      className={[
        'flex flex-col gap-3 rounded-[var(--r-lg)] border bg-[var(--bg)] p-4',
        'transition-all duration-[var(--dur-normal)] ease-[var(--ease)] hover:shadow-[var(--sh-sm)]',
        recommended ? 'border-[var(--p)] shadow-[var(--sh-xs)] ring-1 ring-[var(--p)]' : 'border-[var(--bd)]',
      ].join(' ')}
    >
      {/* 헤더 — 아이콘 + 제목 + fit 배지 */}
      <header className="flex items-start gap-2.5">
        <span
          aria-hidden
          className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-[var(--r-md)] text-[18px]"
          style={{ backgroundColor: `color-mix(in srgb, ${track.accent} 14%, transparent)` }}
        >
          {track.icon}
        </span>
        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <h3 className="font-display text-[15px] font-[800] text-[var(--t1)]">{track.title}</h3>
            {recommended && (
              <span className="inline-flex items-center gap-0.5 rounded-[var(--r-full)] bg-[var(--p)] px-1.5 py-0.5 font-display text-[9.5px] font-[800] text-[var(--ti)]">
                <Sparkles size={9} aria-hidden /> 먼저 추천
              </span>
            )}
          </div>
          <p className="font-body text-[12px] leading-[1.45] text-[var(--t2)]">{track.oneLine}</p>
        </div>
        <span
          className="inline-flex shrink-0 items-center rounded-[var(--r-full)] px-2 py-0.5 font-display text-[10px] font-[800]"
          style={{ color: fitMeta.color, backgroundColor: `color-mix(in srgb, ${fitMeta.color} 14%, transparent)` }}
        >
          {fitMeta.label}
        </span>
      </header>

      {/* 메타 — 레벨 범위 · 편수 · 음성 */}
      <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-mono text-[10.5px] font-[600] text-[var(--t3)]">
        <span
          className="inline-flex items-center rounded-[var(--r-sm)] px-1.5 py-0.5 font-[700]"
          style={{ color: track.accent, backgroundColor: `color-mix(in srgb, ${track.accent} 12%, transparent)` }}
        >
          {cefrLabel}
        </span>
        <span className="tabular-nums">{count}편</span>
        {hasAudio && (
          <span className="inline-flex items-center gap-1" title="원어민 음성 포함">
            <Volume2 size={11} aria-hidden /> 음성
          </span>
        )}
      </div>

      {/* 능력 칩 — 이 시리즈가 길러주는 것 */}
      <div className="flex flex-wrap gap-1">
        {track.skills.map((sk) => (
          <span
            key={sk}
            className="inline-flex items-center rounded-[var(--r-full)] bg-[var(--bg2)] px-2 py-0.5 font-display text-[10.5px] font-[600] text-[var(--t2)]"
          >
            {sk}
          </span>
        ))}
      </div>

      {/* 왜 효과적인가 — 학습 과학 (Lora italic "사람의 말투") */}
      <p className="flex gap-1.5 border-l-2 border-[var(--bd)] pl-2.5 font-english text-[12px] italic leading-[1.5] text-[var(--t2)]">
        {track.why}
      </p>

      {/* 학습법 단계 */}
      <div className="flex flex-col gap-1">
        <span className="font-display text-[10px] font-[800] uppercase tracking-[0.08em] text-[var(--t3)]">
          학습법
        </span>
        <ol className="flex flex-wrap items-center gap-x-1 gap-y-1.5">
          {track.method.map((step, i) => (
            <li key={step} className="inline-flex items-center gap-1">
              <span className="inline-flex items-center gap-1 rounded-[var(--r-full)] bg-[var(--bg2)] py-0.5 pl-1.5 pr-2 font-display text-[11px] font-[600] text-[var(--t2)]">
                <span
                  aria-hidden
                  className="inline-flex h-4 w-4 items-center justify-center rounded-[var(--r-full)] bg-[var(--p)] font-mono text-[9px] font-[800] text-[var(--ti)]"
                >
                  {i + 1}
                </span>
                {step}
              </span>
              {i < track.method.length - 1 && (
                <ArrowRight size={11} aria-hidden className="text-[var(--t4)]" />
              )}
            </li>
          ))}
        </ol>
      </div>

      {/* 특이사항 (ND 저작권 등) */}
      {track.note && (
        <p className="font-body text-[10.5px] leading-[1.4] text-[var(--t3)]">※ {track.note}</p>
      )}

      {/* 대표글 미리보기 */}
      {sample && (
        <p className="line-clamp-1 rounded-[var(--r-sm)] bg-[var(--bg2)] px-2.5 py-1.5 font-english text-[11.5px] text-[var(--t3)]">
          <span className="font-body font-[700] not-italic text-[var(--t3)]">예 · </span>
          {sample.title}
        </p>
      )}

      {/* CTA — 시리즈 전체 드릴다운 */}
      <button
        type="button"
        onClick={() => onOpen(track.key)}
        className="mt-auto inline-flex min-h-[44px] items-center justify-center gap-1.5 rounded-[var(--r-md)] bg-[var(--p)] px-3 py-2 font-display text-[12.5px] font-[700] text-[var(--ti)] transition-colors hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2 active:opacity-90"
      >
        이 시리즈 {count}편 골라보기
        <ArrowRight size={13} aria-hidden />
      </button>
    </article>
  )
}
