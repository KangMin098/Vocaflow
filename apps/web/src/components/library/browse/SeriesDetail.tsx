// apps/web/src/components/library/browse/SeriesDetail.tsx
//
// 시리즈 상세 = "선택 후 화면" (v06.240 에디토리얼 재설계). 나열식 그리드 → 큐레이션된 읽기 리스트.
//   ① 정체성 헤더 ② 먼저 읽어볼 글(featured lead) ③ 적응형 분류 리스트
//      — 다중 출처면 출처(소주제)별 · 단일 출처면 읽기 시간(빠르게/찬찬히/깊이)별.
//        V-Level 무관하게 항상 의미 있는 분류(고급 학습자도 나열식 X).
//   ④ 이 시리즈에 대해(footer) — 출처(신뢰) + 능력·why·학습법.
// 콘텐츠 우선(먼저 보이는 건 글) · Progressive Disclosure(오리엔테이션은 아래) · iOS 그룹 리스트식 모던·가독.

'use client'

import { ArrowLeft, ArrowRight, Volume2 } from 'lucide-react'

import { TRACK_FIT_META, type TrackStat } from '@/lib/articles/source-map'
import type { PublishedArticle } from '@/lib/articles/types'

import { ArticleCard } from './ArticleCard'

/** 대략 읽기 시간(분) — reading_minutes 우선, 없으면 word_count/200. */
function readMinutes(a: PublishedArticle): number | null {
  if (a.reading_minutes != null) return a.reading_minutes
  if (a.word_count != null) return Math.max(1, Math.round(a.word_count / 200))
  return null
}

interface Group {
  key: string
  label: string
  hint?: string
  color?: string
  items: PublishedArticle[]
}

const TIME_BUCKETS: Array<{ key: string; label: string; hint: string; test: (m: number | null) => boolean }> = [
  { key: 'quick', label: '빠르게 읽기', hint: '4분 이내', test: (m) => m != null && m <= 4 },
  { key: 'medium', label: '찬찬히 읽기', hint: '5~9분', test: (m) => m == null || (m >= 5 && m <= 9) },
  { key: 'deep', label: '깊이 읽기', hint: '10분 이상', test: (m) => m != null && m >= 10 },
]

/** 나머지 글을 의미 있는 축으로 분류 — 다중 출처면 출처별, 아니면 읽기 시간별. */
function classify(rest: PublishedArticle[], sources: TrackStat['sources']): Group[] {
  if (sources.length >= 2) {
    return sources
      .map((s) => ({ key: s.key, label: s.label, color: s.color, items: rest.filter((a) => a.source === s.key) }))
      .filter((g) => g.items.length > 0)
  }
  return TIME_BUCKETS.map((b) => ({
    key: b.key,
    label: b.label,
    hint: b.hint,
    items: rest.filter((a) => b.test(readMinutes(a))),
  })).filter((g) => g.items.length > 0)
}

export function SeriesDetail({
  stat,
  userV,
  onBack,
}: {
  stat: TrackStat
  userV: number
  onBack: () => void
}) {
  const { track, count, cefrLabel, hasAudio, fit, sources } = stat
  const fitMeta = TRACK_FIT_META[fit]

  const [lead, ...rest] = stat.items // items = 추천순 정렬됨
  const groups = classify(rest, sources)
  const grouped = groups.length > 1

  return (
    <div className="flex flex-col gap-7">
      {/* 뒤로 */}
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
        <div className="flex flex-wrap items-center gap-2 md:pl-[3.75rem]">
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

      {/* 글 목록 — featured lead + 적응형 분류 (콘텐츠 우선) */}
      <section aria-label="글 목록" className="flex flex-col gap-6">
        {/* featured lead */}
        {lead && (
          <div role="list">
            <div role="listitem">
              <ArticleCard article={lead} userVLevel={userV} featured />
            </div>
          </div>
        )}

        {/* 나머지 — 분류 or 평면 */}
        {rest.length > 0 && (
          <div className="flex flex-col gap-6">
            <div className="flex items-baseline gap-2 px-0.5">
              <h2 className="font-display text-[14px] font-[800] text-[var(--t1)]">
                {grouped ? '주제별로 둘러보기' : '이어서 읽기'}
              </h2>
              <span className="font-mono text-[11px] font-[600] text-[var(--t3)]">{rest.length}편</span>
            </div>

            {grouped ? (
              groups.map((g) => (
                <div key={g.key} className="flex flex-col gap-3">
                  <div className="flex items-center gap-2 px-0.5">
                    {g.color && <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: g.color }} />}
                    <h3 className="font-display text-[13px] font-[800] text-[var(--t1)]">{g.label}</h3>
                    <span className="font-mono text-[10.5px] font-[600] text-[var(--t3)]">{g.items.length}편</span>
                    {g.hint && <span className="font-body text-[11px] text-[var(--t3)]">· {g.hint}</span>}
                  </div>
                  <div role="list" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {g.items.map((a) => (
                      <div role="listitem" key={a.id}>
                        <ArticleCard article={a} userVLevel={userV} />
                      </div>
                    ))}
                  </div>
                </div>
              ))
            ) : (
              <div role="list" className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((a) => (
                  <div role="listitem" key={a.id}>
                    <ArticleCard article={a} userVLevel={userV} />
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </section>

      {/* 이 시리즈에 대해 (footer) — 출처(신뢰) + 능력·why·학습법 */}
      <section
        aria-label="시리즈 정보"
        className="flex flex-col gap-5 rounded-[var(--r-lg)] border border-[var(--bd)] bg-[var(--bg2)] p-5"
      >
        <span className="font-display text-[13px] font-[800] text-[var(--t1)]">이 시리즈에 대해</span>

        {sources.length > 0 && (
          <div className="flex flex-col gap-2">
            <span className="font-display text-[11px] font-[800] uppercase tracking-[0.08em] text-[var(--t3)]">출처</span>
            <div className="flex flex-wrap gap-1.5">
              {sources.map((s) => (
                <span
                  key={s.key}
                  className="inline-flex items-center gap-1.5 rounded-[var(--r-full)] border px-2.5 py-1 font-display text-[11.5px] font-[600] text-[var(--t1)]"
                  style={{ borderColor: `color-mix(in srgb, ${s.color} 35%, transparent)` }}
                  title={`${s.label} · ${s.count}편`}
                >
                  <span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: s.color }} />
                  {s.label}
                  <span className="font-mono text-[10px] font-[700] text-[var(--t3)]">{s.count}</span>
                </span>
              ))}
            </div>
            <p className="font-body text-[11px] leading-[1.4] text-[var(--t3)]">
              신뢰할 수 있는 원문에서 큐레이션했어요 · 원문은 각 글에서 열 수 있어요.
            </p>
          </div>
        )}

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
                {i < track.method.length - 1 && <ArrowRight size={12} aria-hidden className="text-[var(--t4)]" />}
              </li>
            ))}
          </ol>
        </div>

        {track.note && <p className="font-body text-[11.5px] leading-[1.45] text-[var(--t3)]">※ {track.note}</p>}
      </section>
    </div>
  )
}
