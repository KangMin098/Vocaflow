import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  ExternalLink,
  FileText,
  Sparkles,
} from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { VcbRunStatusBadge, STATUS_LABELS } from '@/components/admin/vcb/VcbRunStatusBadge'
import { VcbRunProgress } from '@/components/admin/vcb/VcbRunProgress'
import { VcbStepTriggerCard } from '@/components/admin/vcb/VcbStepTriggerCard'
import { VcbStep4LookupCard } from '@/components/admin/vcb/VcbStep4LookupCard'
import { VcbStep5EnrichCard } from '@/components/admin/vcb/VcbStep5EnrichCard'
import { VcbStep6QaCard } from '@/components/admin/vcb/VcbStep6QaCard'
import { VcbStep8PublishCard } from '@/components/admin/vcb/VcbStep8PublishCard'
import { VcbMethodACard } from '@/components/admin/vcb/VcbMethodACard'
import { fetchRunDetail, fetchPublishedSetsForRun } from '@/lib/vcb/server/runs'
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
  const publishedSets =
    run.status === 'published' ? await fetchPublishedSetsForRun(runId) : []

  // 🔴 Fix: published / publishing 단계에선 시드 등록 카드 숨김
  //         (legacy run 들이 seed_spec_file 메타를 들고 있어 무한 노출되던 결함 차단)
  const isTerminal = run.status === 'published' || run.status === 'publishing'
  const showSeedEntry =
    !isTerminal &&
    (run.status === 'created' ||
      run.status === 'ingesting' ||
      Boolean(run.config.seed_spec_file))
  const canCurate = run.status === 'qa' || run.status === 'curating'

  // 무결성 점검 — approved 단어 수 vs 발행 단어 수 미스매치 검출
  const totalPublishedWords = publishedSets.reduce(
    (sum, s) => sum + s.actual_word_count,
    0,
  )
  const hasIntegrityMismatch =
    run.status === 'published' &&
    totalPublishedWords > 0 &&
    totalPublishedWords !== run.approved_count

  return (
    <div>
      <AdminPageHeader
        icon={Sparkles}
        title={`${run.config.cover_emoji ?? ''} ${run.collection_title}`.trim()}
        description={`${run.collection_slug} · ${STATUS_LABELS[run.status]}`}
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

      <div className="flex items-center gap-3 mb-8 flex-wrap">
        <VcbRunStatusBadge status={run.status} size="md" />
        {hasIntegrityMismatch && (
          <div
            className="flex items-center gap-2 px-3 py-1.5 rounded-[var(--r-md)] border text-sm"
            style={{
              background: 'var(--warning-light)',
              borderColor: 'var(--warning)',
              color: 'var(--warning)',
            }}
          >
            <AlertTriangle className="w-4 h-4 flex-shrink-0" />
            <span className="font-display font-medium">
              무결성 미스매치 — approved {run.approved_count.toLocaleString()}건 vs 발행 {totalPublishedWords.toLocaleString()}건
            </span>
          </div>
        )}
      </div>

      <VcbRunProgress status={run.status} />

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

      {(run.status === 'created' || run.status === 'ingesting' ||
        run.status === 'normalized' || run.status === 'extracted') && (
        <section className="mb-10">
          <h3
            className="font-display font-semibold text-sm uppercase tracking-wider mb-4"
            style={{ color: 'var(--t2)' }}
          >
            시드 확보 · 방식 A — 소스 파일에서 추출 (택1)
          </h3>
          <VcbMethodACard runId={runId} runStatus={run.status} />
        </section>
      )}

      {showSeedEntry ? (
        <section className="mb-10">
          <h3
            className="font-display font-semibold text-sm uppercase tracking-wider mb-4"
            style={{ color: 'var(--t2)' }}
          >
            시드 확보 · 방식 B — AI 생성 (택1)
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
                스펙 작성 → AI 시드 생성 → 검토 후 등록 (3단계)
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

      {(run.status === 'enriching' || run.status === 'qa' ||
        run.status === 'curating' || run.status === 'publishing' ||
        run.status === 'published') && (
        <section className="mb-10">
          <h3
            className="font-display font-semibold text-sm uppercase tracking-wider mb-4"
            style={{ color: 'var(--t2)' }}
          >
            QA Gate (Step 6)
          </h3>
          <VcbStep6QaCard
            runId={runId}
            runStatus={run.status}
            enrichedCount={run.enriched_count}
          />
        </section>
      )}

      <section className="mb-10">
        <h3
          className="font-display font-semibold text-sm uppercase tracking-wider mb-4"
          style={{ color: 'var(--t2)' }}
        >
          Curation (Step 7)
        </h3>
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
      </section>

      {(run.status === 'curating' || run.status === 'publishing' ||
        run.status === 'published') && (
        <section className="mb-10">
          <h3
            className="font-display font-semibold text-sm uppercase tracking-wider mb-4"
            style={{ color: 'var(--t2)' }}
          >
            Publish (Step 8)
          </h3>
          <VcbStep8PublishCard
            runId={runId}
            runStatus={run.status}
            precheck={precheck}
          />
        </section>
      )}

      {run.status === 'published' && publishedSets.length > 0 && (
        <section>
          <h3
            className="font-display font-semibold text-sm uppercase tracking-wider mb-4"
            style={{ color: 'var(--t2)' }}
          >
            발행 결과
          </h3>
          <div className="flex flex-col gap-3">
            {publishedSets.map((set) => {
              const setMismatch = set.actual_word_count !== set.word_count
              return (
                <div
                  key={set.set_id}
                  className="flex items-start gap-4 p-4 rounded-[var(--r-lg)] border"
                  style={{ background: 'var(--bg)', borderColor: 'var(--bd)' }}
                >
                  <div
                    className="w-10 h-10 rounded-[var(--r-md)] flex items-center justify-center shrink-0"
                    style={{ background: 'var(--success-light)', color: 'var(--success)' }}
                  >
                    <CheckCircle2 className="w-5 h-5" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span
                        className="font-display font-semibold text-base"
                        style={{ color: 'var(--t1)' }}
                      >
                        {set.title}
                      </span>
                      <span
                        className="text-[11px] font-mono px-2 py-0.5 rounded-[var(--r-full)]"
                        style={{ background: 'var(--bg3)', color: 'var(--t3)' }}
                      >
                        {set.category}
                      </span>
                      {set.is_published && (
                        <span
                          className="text-[11px] font-display font-medium px-2 py-0.5 rounded-[var(--r-full)]"
                          style={{
                            background: 'var(--success-light)',
                            color: 'var(--success)',
                          }}
                        >
                          published
                        </span>
                      )}
                    </div>
                    <div className="mt-1 flex items-center gap-3 text-xs" style={{ color: 'var(--t3)' }}>
                      <span className="font-mono">{set.slug}</span>
                      <span>·</span>
                      <span>
                        <b style={{ color: 'var(--t1)' }}>
                          {set.actual_word_count.toLocaleString()}
                        </b>
                        {' '}단어
                      </span>
                      {setMismatch && (
                        <span
                          className="inline-flex items-center gap-1 font-display"
                          style={{ color: 'var(--warning)' }}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          캐시 {set.word_count.toLocaleString()} 불일치
                        </span>
                      )}
                    </div>
                  </div>
                  <Link
                    href={`/library/vocab#set-${set.set_id}`}
                    target="_blank"
                    className="inline-flex items-center gap-2 px-3 py-2 rounded-[var(--r-md)] border font-display text-sm shrink-0 transition-colors"
                    style={{
                      borderColor: 'var(--bd)',
                      color: 'var(--p)',
                      background: 'var(--bg)',
                    }}
                  >
                    라이브러리에서 보기
                    <ExternalLink className="w-4 h-4" />
                  </Link>
                </div>
              )
            })}
          </div>
        </section>
      )}
    </div>
  )
}
