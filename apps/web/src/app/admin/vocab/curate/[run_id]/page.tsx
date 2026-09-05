import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { VcbCurationView } from '@/components/admin/vcb/VcbCurationView'
import { fetchRunDetail } from '@/lib/vcb/server/runs'
import { fetchQueueItems, fetchQueueDetail } from '@/lib/vcb/server/queue'
import { beginCuration } from '@/lib/vcb/server/curation'
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

  // 큐레이션 워크스페이스 진입 = 큐레이션 시작 → qa→curating 전이(idempotent).
  // 이 전이가 없으면 Publish 게이트(precheck)가 통과 못해 UI 만으로 발행 불가(dead-end).
  await beginCuration(runId)

  const run = await fetchRunDetail(runId)
  if (!run) {
    notFound()
  }

  // 전량 로드(500-cap 제거) — 필터/정렬이 client-side 라 절단 시 나머지 단어가
  // 큐레이션 UI 에서 도달 불가해진다(예: 2,000단어 run 중 1,500 누락).
  const items = await fetchQueueItems(runId, {
    limit: Math.max(run.seed_count, 500),
  })

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
          className="min-h-[44px] inline-flex items-center gap-2 px-3 py-2 rounded-[var(--r-md)] font-display text-sm border"
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

      <AdminScreenHelp screen="vocab-curate" className="mb-6" />

      <VcbCurationView
        runId={runId}
        initialItems={items}
        initialDetail={initialDetail}
      />
    </div>
  )
}
