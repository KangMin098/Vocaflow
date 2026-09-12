// apps/web/src/app/admin/vrl/_components/ResponsibilitiesSection.tsx
//
// 사전DB 모니터링 v3 Section 2 — 4 Responsibilities (R1-R4) ⭐ 핵심 섹션.
//
// 역할:
//   - DictHealthSnapshot 입력 → R1/R2/R3/R4 카드 4개 렌더
//   - R3 critical 시각적 부각 (본질 페인 — VCB-VRL 미통합)
//   - Pipeline Fitness 차원 점수 강조 (가중 20%, R3 부스트 1.3)
//   - Server Component (props 만 받음)

import { Workflow, Sparkles } from 'lucide-react'
import type { DictHealthSnapshot } from '@/lib/admin/dict/types'
import { ResponsibilityCard } from './ResponsibilityCard'

interface ResponsibilitiesSectionProps {
  snapshot: DictHealthSnapshot
}

export function ResponsibilitiesSection({ snapshot }: ResponsibilitiesSectionProps) {
  const { responsibilities, defects, dimensions } = snapshot
  const pipelineFitness = dimensions.find((d) => d.id === 'pipeline_fitness')

  // R3 가장 낮은지 확인 (본질 페인 가설 시각화)
  const r3 = responsibilities.find((r) => r.id === 'R3')
  const minScore = responsibilities.reduce((m, r) => Math.min(m, r.score), 100)
  const r3IsLowest = r3 && r3.score === minScore

  return (
    <section aria-label="4 Responsibilities (R1-R4)" className="flex flex-col gap-4">
      {/* ── Section Header ── */}
      <header className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex h-9 w-9 items-center justify-center rounded-[var(--r-md)]"
            style={{ backgroundColor: '#8B5CF61A', color: '#8B5CF6' }}
            aria-hidden
          >
            <Workflow size={17} strokeWidth={1.75} />
          </span>
          <div>
            <h2 className="font-display text-[18px] font-[800] leading-tight text-[var(--t1)]">
              4 Pipeline Responsibilities
            </h2>
            <p className="font-body text-[12px] text-[var(--t2)]">
              Pipeline Fitness 차원 (가중 20%) — 각 책임이 사전DB 자산을 얼마나 잘 활용 중인지
            </p>
          </div>
        </div>
        {pipelineFitness && (
          <div className="text-right">
            <p className="font-mono text-[10px] font-[600] uppercase tracking-[0.08em] text-[var(--t2)]">
              Pipeline Fitness
            </p>
            <p
              className="font-display text-[24px] font-[800] leading-none"
              style={{
                color:
                  pipelineFitness.status === 'critical'
                    ? 'var(--error)'
                    : pipelineFitness.status === 'warning'
                      ? 'var(--active)'
                      : 'var(--success)',
              }}
            >
              {pipelineFitness.score}
              <span className="ml-0.5 font-body text-[12px] font-[500] text-[var(--t2)]">
                /100
              </span>
            </p>
          </div>
        )}
      </header>

      {/* ── R3 본질 페인 부각 띠 (R3 critical일 때만) ── */}
      {r3IsLowest && r3 && r3.status === 'critical' && (
        <div
          className="flex items-start gap-3 rounded-[var(--r-md)] border border-[var(--error)]/30 bg-[var(--error-light)] p-3"
          role="alert"
        >
          <Sparkles
            size={15}
            strokeWidth={2}
            className="mt-0.5 shrink-0 text-[var(--error-ink)]"
            aria-hidden
          />
          <p className="font-body text-[12px] leading-snug text-[var(--t1)]">
            <span className="font-display font-[700] text-[var(--error-ink)]">
              본질 페인 — R3 Wordset Publishing
            </span>{' '}
            점수 {r3.score} (critical). VCB Pipeline 이 V-Level/register 활용 불가 →
            아래 카드의 Primary Action (B1/D2) 참고.
          </p>
        </div>
      )}

      {/* ── 카드 4개 grid ── */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {responsibilities.map((r) => (
          <ResponsibilityCard key={r.id} readiness={r} defects={defects} />
        ))}
      </div>
    </section>
  )
}
