import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { VcbSeedFlow } from '@/components/admin/vcb/VcbSeedFlow'
import { fetchRunDetail } from '@/lib/vcb/server/runs'
import { checkSeedJobStatus } from '@/lib/vcb/server/seed'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function VcbRunSeedPage({ params }: PageProps) {
  const { id } = await params
  const runId = parseInt(id, 10)
  if (Number.isNaN(runId)) {
    notFound()
  }

  const run = await fetchRunDetail(runId)
  if (!run) {
    notFound()
  }

  const statusResult = await checkSeedJobStatus(runId)
  const initialStatus = statusResult.ok && statusResult.data
    ? statusResult.data
    : {
        spec_file: null,
        spec_exists: false,
        seed_list_file: null,
        seed_list_exists: false,
        seed_list_line_count: 0,
        validation_file: null,
        validation_exists: false,
        validation_ok: null,
        validation_summary: null,
        error_file: null,
        error_exists: false,
        error_summary: null,
        jobs_dir: '',
      }

  const config = run.config ?? {}
  const initialConfig = {
    target_count: typeof config.target_count === 'number' ? config.target_count : undefined,
    domain_hints: Array.isArray(config.domain_hints) ? (config.domain_hints as string[]) : [],
    must_include_keywords: Array.isArray(config.must_include_keywords)
      ? (config.must_include_keywords as string[])
      : [],
    must_exclude_keywords: Array.isArray(config.must_exclude_keywords)
      ? (config.must_exclude_keywords as string[])
      : [],
    reference_seeds: typeof config.reference_seeds === 'string' ? config.reference_seeds : '',
  }

  return (
    <div>
      <AdminPageHeader
        icon={Sparkles}
        title="Seed 등록 (Method B)"
        description={`${run.collection_title} · ${run.collection_slug}`}
        actions={
          <Link
            href={`/admin/vocab/runs/${runId}`}
            className="inline-flex items-center gap-2 px-3 py-2 rounded-[var(--r-md)] font-display text-sm border"
            style={{
              color: 'var(--t2)',
              borderColor: 'var(--bd)',
              background: 'var(--bg)',
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            Run 상세로
          </Link>
        }
      />

      <VcbSeedFlow
        runId={runId}
        collectionSlug={run.collection_slug}
        collectionTitle={run.collection_title}
        runStatus={run.status}
        initialStatus={initialStatus}
        initialConfig={initialConfig}
      />
    </div>
  )
}
