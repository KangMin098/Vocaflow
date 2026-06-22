// apps/web/src/app/(main)/wordvault/study/page.tsx
// WordVault Study 풀스크린 세션 (실 데이터 · A2).
//
// browse RSC 패턴 미러: 사용자 vocabularies 를 due 우선으로 fetch → StudyMode.
// 평가 결과는 StudyMode → sessionStorage 큐 → 세션 종료 시 flush (A1.1 경로).

import { redirect } from 'next/navigation'

import { WordVaultStudyClient } from '@/components/wordvault/WordVaultStudyClient'
import { createClient } from '@/lib/supabase/server'
import { vocabRowToWord, type BrowseWord } from '@/lib/wordvault/browse-queries'
import { fetchStudyVocabularies } from '@/lib/wordvault/study-queries'

export const metadata = {
  title: 'WordVault — 학습 · Vocaflow',
}

export const dynamic = 'force-dynamic'

export default async function WordVaultStudyPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/wordvault/study')
  }

  const rows = await fetchStudyVocabularies(supabase, user.id)
  const words: BrowseWord[] = rows.map((r, i) => vocabRowToWord(r, i))

  return <WordVaultStudyClient words={words} />
}
