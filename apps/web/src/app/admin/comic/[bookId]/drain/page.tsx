// apps/web/src/app/admin/comic/[bookId]/drain/page.tsx
// CCP 드레인 관측(observability) — 생성 블랙박스 투명화.

import { notFound } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createClient } from '@/lib/supabase/server'
import { fetchBookComicDetail, fetchDrainObservability } from '@/lib/comic/admin-queries'
import { DrainConsole } from './DrainConsole'

export const dynamic = 'force-dynamic'
export const metadata = { title: '드레인 관측 · Admin' }

export default async function DrainObservabilityPage({ params }: { params: { bookId: string } }) {
  await requireAdmin('/admin/comic')
  const client = (await createClient()) as unknown as SupabaseClient
  const [detail, obs] = await Promise.all([
    fetchBookComicDetail(client, params.bookId),
    fetchDrainObservability(client, params.bookId),
  ])
  if (!detail) notFound()
  return <DrainConsole detail={detail} runs={obs.runs} events={obs.events} />
}
