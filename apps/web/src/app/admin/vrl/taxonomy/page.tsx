// apps/web/src/app/admin/vrl/taxonomy/page.tsx
// VRL Pipeline · Taxonomy read-only — Levels(12) / Tracks(6) / Domains(8) / Skills(5)

import { Suspense } from 'react'
import type { SupabaseClient } from '@supabase/supabase-js'
import { Network } from 'lucide-react'

import { createClient } from '@/lib/supabase/server'
import { requireAdmin } from '@/lib/auth/require-admin'
import { AdminPageHeader } from '@/components/admin/AdminPageHeader'
import { fetchVrlTaxonomy, type VrlTaxonomyData } from '@/lib/admin/vrl/queries'
import { VrlTaxonomyClient } from './VrlTaxonomyClient'

export const metadata = {
  title: 'VRL Taxonomy — Vocaflow Admin',
  description: 'VRL 분류 체계 (Levels/Tracks/Domains/Skills) read-only',
}

export const revalidate = 300

export default async function VrlTaxonomyPage() {
  await requireAdmin('/admin/vrl/taxonomy')

  return (
    <div className="flex flex-col gap-6 p-6">
      <AdminPageHeader
        icon={Network}
        title="VRL Taxonomy"
        description="vocaflow_levels (12) · vocaflow_tracks (6) · vocaflow_domains (8) · vocaflow_skills (5) — read-only"
      />
      <Suspense fallback={<TaxonomyFallback />}>
        <Content />
      </Suspense>
    </div>
  )
}

async function Content() {
  const client = (await createClient()) as unknown as SupabaseClient
  const data: VrlTaxonomyData = await fetchVrlTaxonomy(client)
  return <VrlTaxonomyClient data={data} />
}

function TaxonomyFallback() {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-10 w-96 animate-pulse rounded-[var(--r-md)] bg-[var(--bg2)]" />
      <div className="h-[600px] animate-pulse rounded-[var(--r-xl)] bg-[var(--bg2)]" />
    </div>
  )
}
