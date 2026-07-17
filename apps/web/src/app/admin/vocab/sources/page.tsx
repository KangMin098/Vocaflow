import Link from 'next/link'
import { Database, Plus, ArrowLeft } from 'lucide-react'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { VcbSourceCard } from '@/components/admin/vcb/VcbSourceCard'
import { fetchSources } from '@/lib/vcb/server/sources'

export const dynamic = 'force-dynamic'

export default async function VcbSourcesPage() {
  const sources = await fetchSources()

  return (
    <div>
      <AdminPageHeader
        icon={Database}
        title="VCB Sources"
        description="공용 단어장 빌드에 사용되는 시드 출처 (frequency_list / corpus / dictionary / curated_list / ai_generated)"
        actions={
          <div className="flex gap-2">
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
              Runs
            </Link>
            <Link
              href="/admin/vocab/sources/new"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--r-md)] font-display text-sm font-medium text-white"
              style={{ background: 'var(--admin-strong)' }}
            >
              <Plus className="w-4 h-4" />
              New Source
            </Link>
          </div>
        }
      />

      {sources.length === 0 ? (
        <div
          className="text-center py-16 rounded-[var(--r-lg)] border"
          style={{
            color: 'var(--t3)',
            borderColor: 'var(--bd)',
            background: 'var(--bg)',
          }}
        >
          <p className="font-display text-base m-0 mb-2">등록된 Source 가 없습니다</p>
          <p className="text-sm m-0 mb-4">첫 Source 를 등록해 VCB 빌드를 시작하세요</p>
          <Link
            href="/admin/vocab/sources/new"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-[var(--r-md)] font-display text-sm font-medium text-white"
            style={{ background: 'var(--admin-strong)' }}
          >
            <Plus className="w-4 h-4" />첫 Source 등록
          </Link>
        </div>
      ) : (
        <section
          className="grid gap-4"
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))',
          }}
        >
          {sources.map((source) => (
            <VcbSourceCard key={source.id} source={source} />
          ))}
        </section>
      )}
    </div>
  )
}
