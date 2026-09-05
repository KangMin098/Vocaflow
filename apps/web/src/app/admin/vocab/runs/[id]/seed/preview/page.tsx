import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Eye } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { VcbSeedPreviewClient } from '@/components/admin/vcb/preview/VcbSeedPreviewClient'
import { loadSeedPreview } from '@/lib/vcb/server/seed'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: Promise<{ id: string }>
}

export default async function VcbSeedPreviewPage({ params }: PageProps) {
  const { id } = await params
  const runId = parseInt(id, 10)
  if (Number.isNaN(runId)) notFound()

  const result = await loadSeedPreview(runId)
  if (!result.ok || !result.data) {
    return (
      <div>
        <AdminPageHeader
          icon={Eye}
          title="미리보기 불가"
          description={result.error ?? 'seed list 가 아직 생성되지 않았습니다'}
          actions={
            <Link
              href={`/admin/vocab/runs/${runId}/seed`}
              className="min-h-[44px] inline-flex items-center gap-2 px-3 py-2 rounded-[var(--r-md)] font-display text-sm border"
              style={{
                color: 'var(--t2)',
                borderColor: 'var(--bd)',
                background: 'var(--bg)',
              }}
            >
              <ArrowLeft className="w-4 h-4" />
              시드 페이지로
            </Link>
          }
        />
        <div
          className="p-6 rounded-[var(--r-lg)] border"
          style={{ background: 'var(--bg)', borderColor: 'var(--bd)' }}
        >
          <p style={{ color: 'var(--t2)' }}>
            {result.error ?? 'seed-list.jsonl 이 없습니다. 시드 페이지에서 먼저 생성해주세요.'}
          </p>
        </div>
      </div>
    )
  }

  return (
    <VcbSeedPreviewClient runId={runId} initial={result.data} />
  )
}
