// apps/web/src/app/admin/comic/[bookId]/page.tsx
// CCP 검수 상세 — 도서별 컷 검수 + 파이프라인 단계 제어(앞/뒤·게시·보관·삭제·보완).

import { notFound } from 'next/navigation'
import type { SupabaseClient } from '@supabase/supabase-js'
import { requireAdmin } from '@/lib/auth/require-admin'
import { createClient } from '@/lib/supabase/server'
import { fetchBookComicDetail, fetchComicStyles } from '@/lib/comic/admin-queries'
import { fetchComicVocabIntegrity } from '@/lib/comic/vocab-integrity'
import { ComicReviewClient } from './ComicReviewClient'

export const dynamic = 'force-dynamic'
export const metadata = { title: '만화 검수 · Admin' }

export default async function ComicReviewPage({ params }: { params: { bookId: string } }) {
  await requireAdmin('/admin/comic')
  const client = (await createClient()) as unknown as SupabaseClient
  const [detail, styles] = await Promise.all([
    fetchBookComicDetail(client, params.bookId),
    fetchComicStyles(client),
  ])
  if (!detail) notFound()

  // 단어장 정합 — 만화가 표면화하는 정본 vocab 이 챕터 단어장에 실재하는지(설계서 §7.4).
  // 컷을 이미 들고 있으므로 target_vocab 만 추려 넘긴다(추가 컷 조회 없음).
  const targetVocab = detail.pages.flatMap((p) => p.target_vocab ?? [])
  const vocabIntegrity = await fetchComicVocabIntegrity(client, params.bookId, targetVocab)

  return <ComicReviewClient detail={detail} styles={styles} vocabIntegrity={vocabIntegrity} />
}
