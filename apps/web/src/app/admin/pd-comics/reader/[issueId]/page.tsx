// apps/web/src/app/admin/pd-comics/reader/[issueId]/page.tsx — /admin/pd-comics/reader/[issueId]
//
// 모던 리더 preview (dev·admin) — 구성 보존 현대화 결과(page-modern MAX + 모던 말풍선)를
// 학습자 리더 컴포넌트 그대로 렌더해 발행 전 검증. 발행(학습자 /comics/restored)은 PD 게이트 통과 후.

import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'

import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { requireAdmin } from '@/lib/auth/require-admin'
import PdModernReader from '@/components/comic/PdModernReader'

export const dynamic = 'force-dynamic'
export const metadata = { title: '모던 리더 preview · Admin' }

export default async function PdModernReaderPreview({ params }: { params: { issueId: string } }) {
  await requireAdmin()
  if (process.env.NODE_ENV === 'production') notFound()

  return (
    <div className="min-h-screen bg-[var(--bg2)]">
      <div className="mx-auto w-full max-w-[820px] px-3 pt-3 md:px-4">
        <Link
          href="/admin/pd-comics"
          className="inline-flex min-h-[44px] items-center gap-2 font-body text-[12px] font-[500] text-[var(--t2)] transition-colors hover:text-[var(--p)]"
        >
          <ArrowLeft size={14} aria-hidden /> pd-comics
        </Link>
        <AdminScreenHelp screen="pd-comics-reader" />
      </div>
      <PdModernReader issueId={params.issueId} />
    </div>
  )
}
