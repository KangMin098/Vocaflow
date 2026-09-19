// apps/web/src/app/(main)/wordvault/review/page.tsx
// @form: 망각 — 평가에 손을 얹으면 이 단어의 다음 곡선과 다음 만남 눈금이 선다 · 모션 0 (StudyMode · ForgettingCurve · DD-28)
// WordVault Review 풀스크린 세션 (실 데이터 · A2b).
//
// 2026-09-19(DD-28) — 복습 대상 = **다시 볼 낱말(흐릿해요 + 익숙해요, `attention`)**. 이전엔 주석만 "due+new" 이고
//   실제로는 필터 없이 study 와 같은 쿼리라 두 라우트가 픽셀까지 같았다(감사). 상단 리본의 "다시 볼" 칸과 같은 집합이다.
// 평가 결과는 study 와 동일 flush 경로(A1.1)로 vocabularies/learning_records 영속화.

import { redirect } from 'next/navigation'

import { WordVaultStudyClient } from '@/components/wordvault/WordVaultStudyClient'
import { createClient } from '@/lib/supabase/server'
import { vocabRowToWord, type BrowseWord } from '@/lib/wordvault/browse-queries'
import { fetchStudyVocabularies } from '@/lib/wordvault/study-queries'

export const metadata = {
  title: 'WordVault — 복습',
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

  const rows = await fetchStudyVocabularies(supabase, user.id, 'attention')
  const words: BrowseWord[] = rows.map((r, i) => vocabRowToWord(r, i))

  return <WordVaultStudyClient words={words} mode="review" />
}
