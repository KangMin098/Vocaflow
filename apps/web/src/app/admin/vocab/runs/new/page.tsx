import Link from 'next/link'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { AdminScreenHelp } from '@/components/admin/AdminScreenHelp'
import { VcbRunCreateForm } from '@/components/admin/vcb/VcbRunCreateForm'

export const dynamic = 'force-dynamic'

export default function VcbRunCreatePage() {
  return (
    <div>
      <AdminPageHeader
        icon={Sparkles}
        title="New VCB Run"
        description="공용 단어장 빌드 파이프라인 실행 단위 생성"
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

      <AdminScreenHelp screen="vocab-runs-new" className="mb-6" />

      <VcbRunCreateForm />
    </div>
  )
}
