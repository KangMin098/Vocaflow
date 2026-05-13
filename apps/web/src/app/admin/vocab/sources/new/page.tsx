import Link from 'next/link'
import { ArrowLeft, Database } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { VcbSourceCreateForm } from '@/components/admin/vcb/VcbSourceCreateForm'

export const dynamic = 'force-dynamic'

export default function VcbSourceCreatePage() {
  return (
    <div>
      <AdminPageHeader
        icon={Database}
        title="New VCB Source"
        description="시드 출처 등록 (frequency_list · corpus · dictionary · curated_list · ai_generated)"
        actions={
          <Link
            href="/admin/vocab/sources"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-[var(--r-md)] font-display text-sm border"
            style={{
              color: 'var(--t2)',
              borderColor: 'var(--bd)',
              background: 'var(--bg)',
            }}
          >
            <ArrowLeft className="w-4 h-4" />
            Sources
          </Link>
        }
      />

      <VcbSourceCreateForm />
    </div>
  )
}
