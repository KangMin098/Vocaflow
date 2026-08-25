// apps/web/src/app/admin/vrl/page.tsx
// 사전DB 종합 모니터링 v3 — 8 sections 통합 (Step 10 마무리).
//
// 구성:
//   StickyNav (sticky top, IntersectionObserver)
//   Section 1 — HeroSection (overall + 4 책임 + 핵심 차원)
//   Section 2 — ResponsibilitiesSection (R1-R4 카드, R3 본질 페인)
//   Section 3 — DimensionsGrid (9 차원)
//   Section 4 — CriticalDefectsSection (P0/P1/P2 그룹)
//   Section 5 — PipelineImpactMatrix (4×15 매트릭스)
//   Section 6 — SchemaEvolutionSection (Tier 1-5)
//   Section 7 — DistributionAnalysisSection + RoundHistorySection
//   Section 8 — BacklogSection + QuickActionsSection
//
// 데이터:
//   fetchDictSnapshotRaw → composeOverallHealth(raw, defects, evolution)
//   defects = detectCriticalDefects(raw)
//   evolution = generateSchemaEvolutionPlan(raw.schemaPresence)

import { Suspense } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { AlertTriangle, Brain } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'

import { fetchDictSnapshotRaw } from '@/lib/admin/dict/queries'
import { composeOverallHealth } from '@/lib/admin/dict/health-score-v2'
import { detectCriticalDefects } from '@/lib/admin/dict/critical-defects-detector'
import { generateSchemaEvolutionPlan } from '@/lib/admin/dict/schema-evolution-suggestions'

import { StickyNav } from './_components/StickyNav'
import { HeroSection } from './_components/HeroSection'
import { ResponsibilitiesSection } from './_components/ResponsibilitiesSection'
import { DimensionsGrid } from './_components/DimensionsGrid'
import { CriticalDefectsSection } from './_components/CriticalDefectsSection'
import { PipelineImpactMatrix } from './_components/PipelineImpactMatrix'
import { SchemaEvolutionSection } from './_components/SchemaEvolutionSection'
import { DistributionAnalysisSection } from './_components/DistributionAnalysisSection'
import { RoundHistorySection } from './_components/RoundHistorySection'
import { BacklogSection } from './_components/BacklogSection'
import { QuickActionsSection } from './_components/QuickActionsSection'

export const metadata = {
  title: 'Dictionary DB Health — Vocaflow Admin',
  description: '사전DB 종합 모니터링 v3 — 9 차원 × 4 책임 × Critical Defects × Schema Evolution',
}

export const revalidate = 60

export default async function VrlDashboardPage() {
  await requireAdmin('/admin/vrl')

  return (
    <div className="flex flex-col gap-6 p-6">
      <AdminPageHeader
        icon={Brain}
        title="Dictionary DB Health"
        description="사전DB 종합 모니터링 v3 — 플랫폼 4 파이프라인 (R1-R4) 의 기초 자산 점검"
      />
      <Suspense fallback={<DashboardFallback />}>
        <DashboardContent />
      </Suspense>
    </div>
  )
}

async function DashboardContent() {
  const client = (await createClient()) as unknown as SupabaseClient
  const raw = await fetchDictSnapshotRaw(client)
  const defects = detectCriticalDefects(raw)
  const evolution = generateSchemaEvolutionPlan(raw.schemaPresence)
  const snapshot = composeOverallHealth(raw, defects, evolution)
  const fetchErrors = raw._errors ?? []

  return (
    <div className="flex flex-col gap-8">
      {/* sticky nav (8 jump links) */}
      <StickyNav />

      {/* fetch errors banner (silent failure 가시화) */}
      {fetchErrors.length > 0 && (
        <div
          className="flex items-start gap-3 rounded-[var(--r-md)] border border-[var(--active)]/30 bg-[var(--warning-light)] p-3"
          role="alert"
        >
          <AlertTriangle
            size={15}
            strokeWidth={2}
            className="mt-0.5 shrink-0 text-[var(--active)]"
            aria-hidden
          />
          <div className="min-w-0">
            <p className="font-display text-[11px] font-[700] text-[var(--active)]">
              일부 fetch 실패 ({fetchErrors.length}건) — fallback 기본값으로 진행
            </p>
            <ul className="mt-1 list-disc pl-4 font-mono text-[10px] text-[var(--t2)]">
              {fetchErrors.slice(0, 4).map((e, i) => (
                <li key={i}>{e}</li>
              ))}
              {fetchErrors.length > 4 && (
                <li className="text-[var(--t2)]">...외 {fetchErrors.length - 4}건</li>
              )}
            </ul>
          </div>
        </div>
      )}

      {/* ── Section 1 — Hero ── */}
      <section id="s1-hero" className="scroll-mt-16">
        <HeroSection snapshot={snapshot} />
      </section>

      {/* ── Section 2 — Responsibilities (R3 본질 페인) ── */}
      <section id="s2-responsibilities" className="scroll-mt-16">
        <ResponsibilitiesSection snapshot={snapshot} />
      </section>

      {/* ── Section 3 — 9 Dimensions ── */}
      <section id="s3-dimensions" className="scroll-mt-16">
        <DimensionsGrid dimensions={snapshot.dimensions} />
      </section>

      {/* ── Section 4 — Critical Defects ── */}
      <section id="s4-defects" className="scroll-mt-16">
        <CriticalDefectsSection defects={snapshot.defects} />
      </section>

      {/* ── Section 5 — Pipeline Impact Matrix ── */}
      <section id="s5-impact" className="scroll-mt-16">
        <PipelineImpactMatrix snapshot={snapshot} />
      </section>

      {/* ── Section 6 — Schema Evolution ── */}
      <section id="s6-schema" className="scroll-mt-16">
        <SchemaEvolutionSection snapshot={snapshot} />
      </section>

      {/* ── Section 7 — Distribution + Round History ── */}
      <section id="s7-distribution" className="flex flex-col gap-8 scroll-mt-16">
        <DistributionAnalysisSection snapshot={snapshot} />
        <RoundHistorySection snapshot={snapshot} />
      </section>

      {/* ── Section 8 — Backlog + Quick Actions ── */}
      <section id="s8-backlog" className="flex flex-col gap-8 scroll-mt-16">
        <BacklogSection />
        <QuickActionsSection />
      </section>

      {/* footer — v3 진행 표시 */}
      <footer className="border-t border-[var(--bd)] pt-4 text-center font-mono text-[10px] text-[var(--t2)]">
        Dictionary DB Health v3 · 8 sections · Overall {snapshot.overallScore} /
        100 · revalidate 60s
      </footer>
    </div>
  )
}

function DashboardFallback() {
  return (
    <div className="flex flex-col gap-6">
      <div className="h-40 animate-pulse rounded-[var(--r-xl)] bg-[var(--bg2)]" />
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-64 animate-pulse rounded-[var(--r-xl)] bg-[var(--bg2)]" />
        ))}
      </div>
    </div>
  )
}
