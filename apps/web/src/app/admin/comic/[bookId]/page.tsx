// apps/web/src/app/admin/comic/[bookId]/page.tsx
// CCP 검수 상세 — 도서별 컷 검수 + 파이프라인 단계 제어(앞/뒤·게시·보관·삭제·보완).

import { notFound } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createClient } from '@/lib/supabase/server'
import { fetchBookComicDetail } from '@/lib/comic/admin-queries'
import { ComicReviewClient } from './ComicReviewClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: '만화 검수 · Admin' }

export default async function ComicReviewPage({ params }: { params: { bookId: string } }) {
  await requireAdmin('/admin/comic')
  const client = (await createClient()) as unknown as SupabaseClient
  const detail = await fetchBookComicDetail(client, params.bookId)
  if (!detail) notFound()
  return <ComicReviewClient detail={detail} />
}
