// apps/web/src/app/admin/articles/GetGuidePanel.tsx
// ACP §18 — 큐레이션 가이드 패널 (소스 GET 결정 지원).
//
// "관리자가 학습자에게 무엇을 GET 해야 하는지" 를 보여준다:
//   학습자 타깃(레벨) 선택 → 지금 부족한 빈칸(커버리지) → 그 빈칸을 채우는 추천 소스(이유 + GET).
// 소스 하드코딩 없음 — source-guide(SOURCE_SPECS + 소스→register 파생) 경유.

'use client'

import { useMemo } from 'react'
import { ArrowRight, Compass } from 'lucide-react'

import type { ArticleAdminRow, SourceFeedHealth } from '@/lib/articles/types'
import type { LearnerLevel } from '@vocaflow/library-pipeline/curation-spec'
import {
  computeCoverageGaps,
  recommendSources,
  FIT_LABEL,
  REGISTERS,
  REGISTER_LABEL,
  SOURCE_LABEL,
  type LevelFit,
  type SourceRecommendation,
} from '@/lib/articles/source-guide'

const LEVELS: Array<{ key: LearnerLevel; label: string }> = [
  { key: 'beginner', label: '입문 A1–A2' },
  { key: 'intermediate', label: '중급 B1–B2' },
  { key: 'advanced', label: '고급 C1+' },
]

const FIT_TONE: Record<LevelFit, { bg: string; fg: string }> = {
  fit: { bg: 'var(--learn-known-light)', fg: 'var(--learn-known)' },
  easy: { bg: 'var(--learn-fresh-light)', fg: 'var(--learn-fresh)' },
  hard: { bg: 'var(--learn-review-light)', fg: 'var(--learn-review)' },
}

interface Props {
  articles: ArticleAdminRow[]
  feedHealth: SourceFeedHealth[]
  level: LearnerLevel
  onLevel: (l: LearnerLevel) => void
  /** 추천 카드의 "이 소스 GET" → 단일 모드로 해당 소스 선택. */
  onPickSource: (source: string) => void
}

export function GetGuidePanel({ articles, feedHealth, level, onLevel, onPickSource }: Props) {
  const gaps = useMemo(() => computeCoverageGaps(articles), [articles])
  const recs = useMemo(() => recommendSources(gaps, level, feedHealth), [gaps, level, feedHealth])
  const gapByReg = useMemo(() => {
    const m = new Map<string, number>()
    for (const g of gaps) m.set(g.register, (m.get(g.register) ?? 0) + 1)
    return m
  }, [gaps])

  return (
    <details
      open
      className="rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] open:shadow-[var(--sh-sm)]"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-display text-[13px] font-[700] text-[var(--t1)] marker:hidden">
        <Compass size={15} className="text-[var(--p)]" aria-hidden />
        큐레이션 가이드 — 학습자에게 무엇을 GET 할까
        <span className="ml-auto font-mono text-[10px] font-[600] text-[var(--t3)]">
          빈칸 {gaps.length}칸
        </span>
      </summary>

      <div className="flex flex-col gap-4 border-t border-[var(--bd)] p-4">
        {/* 학습자 타깃 레벨 */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--t3)]">학습자 타깃</span>
          <div role="radiogroup" aria-label="학습자 레벨" className="flex gap-1">
            {LEVELS.map((lv) => {
              const active = level === lv.key
              return (
                <button
                  key={lv.key}
                  type="button"
                  role="radio"
                  aria-checked={active}
                  onClick={() => onLevel(lv.key)}
                  className={[
                    'inline-flex min-h-[36px] items-center rounded-[var(--r-full)] px-3 font-display text-[11px] font-[600]',
                    'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]',
                    active
                      ? 'bg-[var(--p)] text-[var(--ti)]'
                      : 'border border-[var(--bd)] bg-[var(--bg)] text-[var(--t2)] hover:bg-[var(--bg2)]',
                  ].join(' ')}
                >
                  {lv.label}
                </button>
              )
            })}
          </div>
        </div>

        {/* 부족한 빈칸 요약 (register별) */}
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--t3)]">부족한 글</span>
          {REGISTERS.map((r) => {
            const n = gapByReg.get(r.key) ?? 0
            return (
              <span
                key={r.key}
                className="inline-flex items-center gap-1 rounded-[var(--r-full)] border border-[var(--bd)] px-2 py-0.5 font-mono text-[10px]"
                style={
                  n > 0
                    ? { backgroundColor: 'var(--learn-error-light)', color: 'var(--learn-error)' }
                    : { color: 'var(--t4)' }
                }
              >
                {r.label} {n}
              </span>
            )
          })}
        </div>

        {/* 추천 소스 */}
        <div className="flex flex-col gap-1.5">
          <span className="font-mono text-[10px] uppercase tracking-wider text-[var(--t3)]">
            추천 GET (빈칸 × 학습자 레벨)
          </span>
          {recs.length === 0 ? (
            <p className="rounded-[var(--r-sm)] border border-dashed border-[var(--bd)] bg-[var(--bg2)] px-3 py-4 text-center font-body text-[12px] text-[var(--t3)]">
              이 레벨에 채울 큰 빈칸이 없어요 — 커버리지가 균형 잡혀 있습니다.
            </p>
          ) : (
            recs.slice(0, 4).map((rec) => <RecCard key={rec.source} rec={rec} onPick={onPickSource} />)
          )}
        </div>
      </div>
    </details>
  )
}

function RecCard({
  rec,
  onPick,
}: {
  rec: SourceRecommendation
  onPick: (source: string) => void
}) {
  const regs = Array.from(new Set(rec.filledGaps.map((g) => g.register)))
  const tone = FIT_TONE[rec.fit]
  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-1.5 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg2)] px-3 py-2.5">
      <span className="font-display text-[13px] font-[700] text-[var(--t1)]">{SOURCE_LABEL[rec.source]}</span>
      <span
        className="rounded-[var(--r-full)] px-2 py-0.5 font-mono text-[9px] font-[700]"
        style={{ backgroundColor: tone.bg, color: tone.fg }}
      >
        {FIT_LABEL[rec.fit]}
      </span>
      <span className="font-body text-[11px] text-[var(--t3)]">
        {regs.map((r) => REGISTER_LABEL[r] ?? r).join('·')} 빈칸 {rec.filledGaps.length}칸
        {rec.pending > 0 ? ` · 후보 ${rec.pending}건` : ' · 후보 0 (수집 필요)'}
      </span>
      <button
        type="button"
        onClick={() => onPick(rec.source)}
        className="ml-auto inline-flex min-h-[36px] items-center gap-1 rounded-[var(--r-sm)] bg-[var(--p)] px-3 font-display text-[11px] font-[600] text-[var(--ti)] transition-colors hover:bg-[var(--p-hover)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)] focus-visible:ring-offset-2"
      >
        이 소스 GET
        <ArrowRight size={12} aria-hidden />
      </button>
    </div>
  )
}
