// apps/web/src/app/(main)/wordvault/review/page.tsx
// WordVault Review 풀스크린 세션 (실 데이터 · A2b).
//
// study 라우트 미러 — 복습 대상 = due+new(next_review_at ≤ now 또는 NULL),
// fetchStudyVocabularies(due 우선 정렬)로 fetch → StudyMode(복습 프레이밍).
// 평가 결과는 study 와 동일 flush 경로(A1.1)로 vocabularies/learning_records 영속화.

import { redirect } from 'next/navigation'

import { WordVaultStudyClient } from '@/components/wordvault/WordVaultStudyClient'
import { createClient } from '@/lib/supabase/server'
import { vocabRowToWord, type BrowseWord } from '@/lib/wordvault/browse-queries'
import { fetchStudyVocabularies } from '@/lib/wordvault/study-queries'

export const metadata = {
  title: 'WordVault — 복습 · Vocaflow',
}

export const dynamic = 'force-dynamic'

export default async function WordVaultReviewPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/wordvault/review')
  }

  const rows = await fetchStudyVocabularies(supabase, user.id)
  const words: BrowseWord[] = rows.map((r, i) => vocabRowToWord(r, i))

  return <WordVaultStudyClient words={words} mode="review" />
}
