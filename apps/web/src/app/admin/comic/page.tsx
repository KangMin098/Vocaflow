// apps/web/src/app/admin/comic/page.tsx
// CCP admin 콘솔 — Comic Pipeline. 만화화 대상 도서 → 큐 적재 → QC → 발행.

import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createClient } from '@/lib/supabase/server'
import { fetchComicModels, fetchComicStyles, fetchComicTests, listComicCatalog, summarize } from '@/lib/comic/admin-queries'
import { AdminComicClient } from './AdminComicClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: 'Comic Pipeline · Admin' }

export default async function AdminComicPage() {
  await requireAdmin('/admin/comic')
  const client = (await createClient()) as unknown as SupabaseClient
  const [rows, tests, models, styles] = await Promise.all([
    listComicCatalog(client),
    fetchComicTests(client),
    fetchComicModels(client),
    fetchComicStyles(client),
  ])
  const stats = summarize(rows)
  return <AdminComicClient rows={rows} stats={stats} tests={tests} models={models} styles={styles} />
}
