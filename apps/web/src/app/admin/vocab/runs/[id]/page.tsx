import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, ChevronRight, FileText, Sparkles } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { VcbRunStatusBadge } from '@/components/admin/vcb/VcbRunStatusBadge'
import { VcbStepTriggerCard } from '@/components/admin/vcb/VcbStepTriggerCard'
import { VcbStep4LookupCard } from '@/components/admin/vcb/VcbStep4LookupCard'
import { VcbStep5EnrichCard } from '@/components/admin/vcb/VcbStep5EnrichCard'
import { fetchRunDetail } from '@/lib/vcb/server/runs'
import { precheckRun } from '@/lib/vcb/server/precheck'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function VcbRunDetailPage({ params }: PageProps) {
  const { id } = await params
  const runId = parseInt(id, 10)
  if (Number.isNaN(runId)) {
    notFound()
  }

  const run = await fetchRunDetail(runId)
  if (!run) {
    notFound()
  }

  const precheck = await precheckRun(runId)

  const showSeedEntry =
    run.status === 'created' || run.status === 'ingesting' || run.config.seed_spec_file
  const canEnrich = run.status === 'looked_up' || run.status === 'enriching'
  const canQa = run.status === 'enriching' || run.status === 'qa'
  const canCurate = run.status === 'qa' || run.status === 'curating'
  const canPublish = precheck.ok && (run.status === 'curating' || run.status === 'publishing')

  return (
    <div>
      <AdminPageHeader
        icon={Sparkles}
        title={`${run.config.cover_emoji ?? ''} ${run.collection_title}`.trim()}
        description={`${run.collection_slug} · ${run.status}`}
        actions={
          <Link
            href="/admin/vocab/runs"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-[var(--r-md)] font-display text-sm border"
            style={{
              color: 'var(--t2)',
              borderColor: 'var(--bd)',
              background: 'var(--bg)',
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            목록으로
          </Link>
        }
      />

      <div className="flex items-center gap-3 mb-8">
        <VcbRunStatusBadge status={run.status} size="md" />
      </div>

      <section className="mb-10">
        <h3
          className="font-display font-semibold text-sm uppercase tracking-wider mb-4"
          style={{ color: 'var(--t2)' }}
        >
          파이프라인 진행
        </h3>
        <dl
          className="grid grid-cols-6 gap-4 p-4 rounded-[var(--r-lg)]"
          style={{ background: 'var(--bg2)' }}
        >
          {[
            { label: '총 시드', value: run.seed_count, color: 'var(--t1)' },
            { label: '대기 중', value: run.pending_count, color: 'var(--t2)' },
            { label: '보강 완료', value: run.enriched_count, color: 'var(--success)' },
            {
              label: '플래그',
              value: run.flagged_count,
              color: run.flagged_count > 0 ? 'var(--warning)' : 'var(--t3)',
            },
            {
              label: '실패',
              value: run.failed_count,
              color: run.failed_count > 0 ? 'var(--error)' : 'var(--t3)',
            },
            { label: '승인', value: run.approved_count, color: 'var(--p)' },
          ].map((s) => (
            <div key={s.label}>
              <dt
                className="text-[11px] uppercase tracking-wider mb-1"
                style={{ color: 'var(--t3)' }}
              >
                {s.label}
              </dt>
              <dd
                className="font-display font-semibold text-xl m-0"
                style={{ color: s.color }}
              >
                {s.value.toLocaleString()}
              </dd>
            </div>
          ))}
        </dl>
      </section>

      {showSeedEntry ? (
        <section className="mb-10">
          <h3
            className="font-display font-semibold text-sm uppercase tracking-wider mb-4"
            style={{ color: 'var(--t2)' }}
          >
            시드 등록 (Step 1)
          </h3>
          <Link
            href={`/admin/vocab/runs/${runId}/seed`}
            className="group flex items-center gap-4 p-4 rounded-[var(--r-lg)] border transition-colors"
            style={{
              background: 'var(--bg)',
              borderColor: 'var(--bd)',
            }}
          >
            <div
              className="w-10 h-10 rounded-[var(--r-md)] flex items-center justify-center shrink-0"
              style={{ background: 'var(--p-light)', color: 'var(--p)' }}
            >
              <FileText className="w-5 h-5" />
            </div>
            <div className="flex-1 min-w-0">
              <div
                className="font-display font-semibold text-base"
                style={{ color: 'var(--t1)' }}
              >
                Method B — AI 시드 생성
              </div>
              <div className="text-xs mt-1" style={{ color: 'var(--t3)' }}>
                seed-spec.json 생성 → /vcb-seed-list 실행 → DB import (3 단계)
              </div>
            </div>
            <ChevronRight
              className="w-5 h-5 shrink-0"
              style={{ color: 'var(--t3)' }}
            />
          </Link>
        </section>
      ) : null}

      {(run.status === 'extracted' || run.status === 'looked_up' ||
        run.status === 'enriching' || run.status === 'qa' ||
        run.status === 'curating' || run.status === 'publishing' ||
        run.status === 'published') && (
        <section className="mb-10">
          <h3
            className="font-display font-semibold text-sm uppercase tracking-wider mb-4"
            style={{ color: 'var(--t2)' }}
          >
            사전 매칭 (Step 4)
          </h3>
          <VcbStep4LookupCard
            runId={runId}
            runStatus={run.status}
            seedCount={run.seed_count}
          />
        </section>
      )}

      {(run.status === 'looked_up' || run.status === 'enriching' ||
        run.status === 'qa' || run.status === 'curating' ||
        run.status === 'publishing' || run.status === 'published') && (
        <section className="mb-10">
          <h3
            className="font-display font-semibold text-sm uppercase tracking-wider mb-4"
            style={{ color: 'var(--t2)' }}
          >
            AI Enrichment (Step 5)
          </h3>
          <VcbStep5EnrichCard
            runId={runId}
            runStatus={run.status}
            pendingCount={run.pending_count}
          />
        </section>
      )}

      <section>
        <h3
          className="font-display font-semibold text-sm uppercase tracking-wider mb-4"
          style={{ color: 'var(--t2)' }}
        >
          나머지 단계 (CLI)
        </h3>
        <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
          <VcbStepTriggerCard
            step={6}
            icon="shieldCheck"
            title="QA Gate"
            description="R1~R8 룰 적용"
            enabled={canQa}
            primaryAction={{
              label: 'Run QA',
              command: `pnpm vcb:qa --run-id ${runId}`,
            }}
            stats={[
              { label: 'enriched', value: run.enriched_count },
              { label: 'flagged', value: run.flagged_count },
            ]}
          />
          <VcbStepTriggerCard
            step={7}
            icon="sparkles"
            title="Curation"
            description="flagged 검토 + Approve/Reject"
            enabled={canCurate}
            primaryAction={{
              label: '큐레이션 시작',
              href: `/admin/vocab/curate/${runId}`,
            }}
            stats={[
              { label: 'flagged', value: run.flagged_count },
              { label: 'approved', value: run.approved_count },
            ]}
          />
          <VcbStepTriggerCard
            step={8}
            icon="rocket"
            title="Publish"
            description="shared_word_sets 발행"
            enabled={canPublish}
            primaryAction={{
              label: 'Publish',
              command: `pnpm vcb:publish --run-id ${runId}`,
            }}
            stats={[
              { label: 'publishable', value: precheck.stats.publishable_count },
              { label: 'min', value: 50 },
            ]}
            blockers={precheck.blockers}
          />
        </div>
      </section>
    </div>
  )
}
