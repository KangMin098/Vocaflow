// apps/web/src/app/admin/articles/SourceFeedList.tsx
// ACP §18 P2 — 소스/feed 별 후보 현황 (① 뷰 우측).
//
// 커버리지 매트릭스가 "무엇이 부족한가"라면, 이건 "어디서 채울 수 있나" — 소스별 후보 풀.
// 소스 헤더는 SourcePolicy 배지(supply/derivation/attribution)로 분기 — source 하드코딩 X.
// 데이터는 실측(library_article_seed_catalog 집계). register/zone 등 ingest 후 산출 필드는
// 후보 단계에 없으므로 표시하지 않음(추측 금지).

'use client'

import { Volume2 } from 'lucide-react'

import type { SourceFeedHealth } from '@/lib/articles/types'
import {
  useSourcePolicy,
  SUPPLY_LABEL,
  DERIVATION_LABEL,
  ATTRIBUTION_LABEL,
} from '@/lib/articles/use-source-policy'
import { SOURCE_LABEL } from '@/lib/articles/source-guide'
import { getSourceSpec, isSourceKey } from '@vocaflow/library-pipeline/curation-spec'

interface Props {
  feedHealth: SourceFeedHealth[]
  /** 소스 헤더 클릭 → 소스GET stage 로 이동(해당 소스 선택). */
  onPickSource?: (source: string) => void
}

export function SourceFeedList({ feedHealth, onPickSource }: Props) {
  const bySource = new Map<string, SourceFeedHealth[]>()
  for (const f of feedHealth) {
    const arr = bySource.get(f.source) ?? []
    arr.push(f)
    bySource.set(f.source, arr)
  }
  const sources = Array.from(bySource.keys()).sort()

  return (
    <section
      aria-label="소스 피드 현황"
      className="flex flex-col gap-3 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] p-4"
    >
      <header className="flex items-baseline justify-between gap-2">
        <h2 className="font-display text-[13px] font-[700] text-[var(--t1)]">소스 피드 현황</h2>
        <span className="font-mono text-[10px] text-[var(--t3)]">
          {feedHealth.reduce((n, f) => n + f.candidates, 0)} 후보 · {sources.length} 소스
        </span>
      </header>

      {sources.length === 0 ? (
        <p className="rounded-[var(--r-sm)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] px-3 py-6 text-center font-body text-[12px] text-[var(--t3)]">
          수집된 후보가 없어요. 소스 GET 에서 대량 수집을 먼저 실행하세요.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
          {sources.map((source) => (
            <SourceBlock
              key={source}
              source={source}
              feeds={bySource.get(source) ?? []}
              onPickSource={onPickSource}
            />
          ))}
        </div>
      )}
    </section>
  )
}

function SourceBlock({
  source,
  feeds,
  onPickSource,
}: {
  source: string
  feeds: SourceFeedHealth[]
  onPickSource?: (source: string) => void
}) {
  const policy = useSourcePolicy(source)
  const cefr = isSourceKey(source) ? getSourceSpec(source).targetCefr : null
  const label = SOURCE_LABEL[source] ?? source
  const totalPending = feeds.reduce((n, f) => n + f.pending, 0)

  return (
    <div className="rounded-[var(--r-sm)] border border-[var(--bd)] bg-[var(--bg2)] p-3">
      <div className="mb-2 flex flex-wrap items-center gap-2">
        {onPickSource ? (
          <button
            type="button"
            onClick={() => onPickSource(source)}
            className="font-display text-[13px] font-[700] text-[var(--t1)] hover:text-[var(--p)] hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]"
          >
            {label}
          </button>
        ) : (
          <span className="font-display text-[13px] font-[700] text-[var(--t1)]">{label}</span>
        )}
        {cefr && (
          <span className="font-mono text-[10px] text-[var(--t3)]">
            {cefr.min}–{cefr.max}
          </span>
        )}
        {/* 정책 배지 — supply/derivation/attribution (media 는 feed 행 audio 로 표시) */}
        <PolicyTag label={SUPPLY_LABEL[policy.supply]} tone={policy.supply === 'static' ? 'info' : 'neutral'} />
        {policy.derivation === 'display_only' && (
          <PolicyTag label={DERIVATION_LABEL.display_only} tone="review" />
        )}
        {policy.attribution === 'required' && (
          <PolicyTag label={ATTRIBUTION_LABEL.required} tone="review" />
        )}
        <span className="ml-auto font-mono text-[10px] text-[var(--t5)]">{totalPending} 대기</span>
      </div>

      <ul role="list" className="flex flex-col gap-1">
        {feeds.map((f) => (
          <li
            key={`${f.source}|${f.feedId}`}
            className="flex items-center gap-2 rounded-[var(--r-sm)] bg-[var(--bg)] px-2.5 py-1.5"
          >
            <span className="min-w-0 flex-1 truncate font-body text-[12px] text-[var(--t2)]">
              {f.feedLabel}
            </span>
            {f.audioN > 0 && (
              <span
                className="inline-flex items-center gap-0.5 font-mono text-[10px] text-[var(--learn-known)]"
                title={`${f.audioN}건 audio`}
              >
                <Volume2 size={11} aria-hidden />
                {f.audioN}
              </span>
            )}
            <ScoreBar value={f.avgScore} />
            <span className="w-[58px] text-right font-mono text-[10px] tabular-nums text-[var(--t3)]">
              {f.pending}/{f.candidates}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}

type Tone = 'neutral' | 'info' | 'review'
const TAG_COLORS: Record<Tone, { bg: string; fg: string }> = {
  neutral: { bg: 'var(--bg)', fg: 'var(--t3)' },
  info: { bg: 'var(--learn-fresh-light)', fg: 'var(--learn-fresh)' },
  review: { bg: 'var(--learn-review-light)', fg: 'var(--learn-review)' },
}

function PolicyTag({ label, tone }: { label: string; tone: Tone }) {
  const c = TAG_COLORS[tone]
  return (
    <span
      className="rounded-[var(--r-full)] border border-[var(--bd)] px-2 py-0.5 font-mono text-[9px] font-[600]"
      style={{ backgroundColor: c.bg, color: c.fg }}
    >
      {label}
    </span>
  )
}

function ScoreBar({ value }: { value: number }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100)
  // score 0.40 floor(소스 minScore) 미만이면 risk, 0.70+ stable, 그 사이 shaky 색.
  const color =
    value >= 0.7 ? 'var(--learn-known)' : value >= 0.4 ? 'var(--learn-review)' : 'var(--learn-error)'
  return (
    <span className="flex items-center gap-1" title={`평균 score ${value.toFixed(2)}`}>
      <span className="block h-1.5 w-[44px] overflow-hidden rounded-[var(--r-full)] bg-[var(--bg2)]">
        <span className="block h-full rounded-[var(--r-full)]" style={{ width: `${pct}%`, backgroundColor: color }} />
      </span>
      <span className="w-[26px] font-mono text-[9px] tabular-nums text-[var(--t4)]">
        {value.toFixed(2)}
      </span>
    </span>
  )
}
