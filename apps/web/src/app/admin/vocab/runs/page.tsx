// apps/web/src/app/admin/vocab/runs/page.tsx

import Link from 'next/link'
import { Sparkles, Activity, CheckCircle2, AlertTriangle, Plus } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminKpiGrid } from '@/components/admin/AdminKpiGrid'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { VcbRunCard } from '@/components/admin/vcb/VcbRunCard'
import { VcbMarketPanel } from '@/components/admin/vcb/VcbMarketPanel'
import { readVcbMarketStatus } from '@/lib/vcb/server/market-status'
import { fetchRuns } from '@/lib/vcb/server/runs'
import type { RunStatus } from '@/lib/vcb/types'

export const dynamic = 'force-dynamic'

const ACTIVE_STATUSES: RunStatus[] = ['enriching', 'qa', 'curating']

export default async function VcbRunsPage() {
  const runs = await fetchRuns()
  // 시중 대비 지수 — 리포트를 읽기만 한다(계산은 스크립트가 한다).
  const market = readVcbMarketStatus()

  const counts = {
    total: runs.length,
    active: runs.filter((r) => ACTIVE_STATUSES.includes(r.status)).length,
    published: runs.filter((r) => r.status === 'published').length,
    failed: runs.filter((r) => r.status === 'failed').length,
  }

  return (
    <div>
      <AdminPageHeader
        icon={Sparkles}
        title="VCB Pipeline Runs"
        description="공용 단어장 빌드 파이프라인 실행 단위"
        actions={
          <Link
            href="/admin/vocab/runs/new"
            className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2 rounded-[var(--r-md)] font-display text-sm font-medium text-white"
            style={{ background: 'var(--admin-strong)' }}
          >
            <Plus className="w-4 h-4" />
            New Run
          </Link>
        }
      />

      <AdminScreenHelp screen="vocab-runs" className="mb-6" />

      <VcbMarketPanel status={market} />

      <AdminKpiGrid
        cols={4}
        kpis={[
          {
            label: 'Total Runs',
            value: counts.total,
            icon: Sparkles,
            accent: 'var(--t1)',
            bg: 'var(--bg2)',
            hint: 'all time',
          },
          {
            label: 'Active',
            value: counts.active,
            icon: Activity,
            accent: 'var(--p)',
            bg: 'var(--p-light)',
            hint: 'enriching · qa · curating',
          },
          {
            label: 'Published',
            value: counts.published,
            icon: CheckCircle2,
            accent: 'var(--success)',
            bg: 'var(--success-light)',
            hint: 'live collections',
          },
          {
            label: 'Failed',
            value: counts.failed,
            icon: AlertTriangle,
            accent: counts.failed > 0 ? 'var(--error)' : 'var(--t3)',
            bg: counts.failed > 0 ? 'var(--error-light)' : 'var(--bg2)',
            hint: counts.failed > 0 ? 'requires attention' : 'none',
          },
        ]}
      />

      {runs.length > 0 ? (
        <section
          className="grid gap-4 mt-8"
          style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}
        >
          {runs.map((run) => (
            <VcbRunCard key={run.id} run={run} />
          ))}
        </section>
      ) : (
        <div
          className="mt-8 rounded-[var(--r-lg)] border p-12 text-center"
          style={{
            background: 'var(--bg)',
            borderColor: 'var(--bd)',
          }}
        >
          <p
            className="font-display text-base font-semibold m-0 mb-2"
            style={{ color: 'var(--t1)' }}
          >
            아직 생성된 run 이 없습니다
          </p>
          <p className="font-body text-sm m-0" style={{ color: 'var(--t3)' }}>
            우측 상단{' '}
            <span className="font-display font-semibold" style={{ color: 'var(--p)' }}>
              New Run
            </span>{' '}
            으로 새 공용 단어장 빌드를 시작하세요.
          </p>
        </div>
      )}
    </div>
  )
}
