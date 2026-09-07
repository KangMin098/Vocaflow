// apps/web/src/app/admin/comic/[bookId]/drain/page.tsx
// CCP 드레인 관측(observability) — 생성 블랙박스 투명화.

import { notFound } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createClient } from '@/lib/supabase/server'
import { fetchComicDrainSubject, fetchDrainObservability } from '@/lib/comic/admin-queries'
import { DrainConsole } from './DrainConsole'

export const dynamic = 'force-dynamic'
export const metadata = { title: '드레인 관측 · Admin' }

export default async function DrainObservabilityPage({ params }: { params: { bookId: string } }) {
  await requireAdmin('/admin/comic')
  const client = (await createClient()) as unknown as SupabaseClient
  // 컷 전량(bubbles · image_url · target_vocab)이 아니라 제목·QC 게이트·단계만 받는다 —
  // 이 화면은 컷을 렌더하지 않고, 컷은 도서 한 권에 수백 장이다.
  const [subject, obs] = await Promise.all([
    fetchComicDrainSubject(client, params.bookId),
    fetchDrainObservability(client, params.bookId),
  ])
  if (!subject) notFound()
  return <DrainConsole subject={subject} runs={obs.runs} events={obs.events} />
}
