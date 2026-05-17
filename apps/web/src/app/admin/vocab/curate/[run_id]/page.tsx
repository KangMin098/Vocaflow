import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { VcbCurationView } from '@/components/admin/vcb/VcbCurationView'
import { fetchRunDetail } from '@/lib/vcb/server/runs'
import { fetchQueueItems, fetchQueueDetail } from '@/lib/vcb/server/queue'
import type { QueueDetail } from '@/lib/vcb/types'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ run_id: string }>
}

export default async function VcbCuratePage({ params }: PageProps) {
  const { run_id } = await params
  const runId = parseInt(run_id, 10)
  if (Number.isNaN(runId)) {
    notFound()
  }

  // 병렬 fetch: run + items
  const [run, items] = await Promise.all([
    fetchRunDetail(runId),
    fetchQueueItems(runId),
  ])

  if (!run) {
    notFound()
  }

  // Q2 채택: 첫 진입 즉시 우측 패널 표시 위해 첫 item detail prefetch
  let initialDetail: QueueDetail | null = null
  const firstItem = items[0]
  if (firstItem) {
    initialDetail = await fetchQueueDetail(firstItem.queue_id)
  }

  return (
    <div>
      <header className="flex items-center gap-4 mb-6">
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
          Run 상세
        </Link>
        <h1
          className="font-display font-semibold text-xl m-0"
          style={{ color: 'var(--t1)' }}
        >
          🔍 큐레이션 · {run.collection_title}
        </h1>
      </header>

      <VcbCurationView
        runId={runId}
        initialItems={items}
        initialDetail={initialDetail}
      />
    </div>
  )
}
