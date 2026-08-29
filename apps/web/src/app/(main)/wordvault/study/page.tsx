// apps/web/src/app/(main)/wordvault/study/page.tsx
// WordVault Study 풀스크린 세션 (실 데이터 · A2).
//
// browse RSC 패턴 미러: 사용자 vocabularies 를 due 우선으로 fetch → StudyMode.
// 평가 결과는 StudyMode → sessionStorage 큐 → 세션 종료 시 flush (A1.1 경로).

import { redirect } from 'next/navigation'

import { WordVaultStudyClient } from '@/components/wordvault/WordVaultStudyClient'
import { createClient } from '@/lib/supabase/server'
import { vocabRowToWord, type BrowseWord } from '@/lib/wordvault/browse-queries'
import { parseStateFilter } from '@/lib/wordvault/state-filter'
import { fetchStudyVocabularies } from '@/lib/wordvault/study-queries'

export const metadata = {
  title: 'WordVault — 학습 · Vocaflow',
}

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: {
    /** `state:new` 등 — browse 의 "이 단어로 학습 시작" 이 현재 필터를 그대로 넘긴다 */
    filter?: string
  }
}

export default async function WordVaultStudyPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // 로그인 후에도 같은 묶음으로 돌아오게 — 필터를 잃으면 전체 세션이 열린다.
    const next = searchParams.filter
      ? `/wordvault/study?filter=${encodeURIComponent(searchParams.filter)}`
      : '/wordvault/study'
    redirect(`/login?next=${encodeURIComponent(next)}`)
  }

  const rows = await fetchStudyVocabularies(supabase, user.id, parseStateFilter(searchParams.filter))
  const words: BrowseWord[] = rows.map((r, i) => vocabRowToWord(r, i))

  return <WordVaultStudyClient words={words} />
}
