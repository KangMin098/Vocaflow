// apps/web/src/app/(main)/wordvault/review/page.tsx
// WordVault Review 풀스크린 세션 (실 데이터 · A2b).
//
// study 라우트 미러 — 복습 대상 = due+new(next_review_at ≤ now 또는 NULL),
// fetchStudyVocabularies(due 우선 정렬)로 fetch → StudyMode(복습 프레이밍).
// 평가 결과는 study 와 동일 flush 경로(A1.1)로 vocabularies/learning_records 영속화.

import { redirect } from 'next/navigation'

import { WordVaultStudyClient } from '@/components/wordvault/WordVaultStudyClient'
import { WordVaultViewerGate } from '@/components/wordvault/WordVaultBrowseClient'
import { vocabMapLink } from '@/lib/csat/map-return'
import { vocabMapReturnHref } from '@/lib/csat/map-return'
import { createClient } from '@/lib/supabase/server'
import { vocabRowToWord, type BrowseWord } from '@/lib/wordvault/browse-queries'
import { fetchStudyVocabularies } from '@/lib/wordvault/study-queries'

export const metadata = {
  title: 'WordVault — 복습',
}

export const dynamic = 'force-dynamic'

export default async function WordVaultReviewPage({ searchParams = {} }: { searchParams?: Record<string, string | string[] | undefined> }) {
  // T-0069 — 지도(V1 기본 의미)에서 왔으면 같은 TASK · Workspace 로 돌아갈 주소(검증한 문맥만). 아니면 null — 일반 진입은 그대로
  const mapBack = vocabMapReturnHref(searchParams)
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/wordvault/review')
  }

  // 조회 실패를 「복습할 단어 0」 으로 보이지 않게 — 지도에서 온 화면은 실패를 그대로 알리고 돌아갈 길을 둔다(일반 진입은 예전처럼 오류 경계)
  let rows: Awaited<ReturnType<typeof fetchStudyVocabularies>>
  try {
    rows = await fetchStudyVocabularies(supabase, user.id)
  } catch (e) {
    if (!mapBack) throw e
    return <WordVaultStudyClient words={[]} mode="review" mapBack={mapBack} loadFailed />
  }
  const words: BrowseWord[] = rows.map((r, i) => vocabRowToWord(r, i))

  // 개인 복습 단어 · 평가는 서버가 읽은 사람(user.id)의 것 — 브라우저 신원이 그 사람으로 긍정 확인될 때만 그린다(지도 문맥은 다시 열기에도 남긴다)
  return (
    <WordVaultViewerGate viewerId={user.id} reopenHref={mapBack ? vocabMapLink('/wordvault/review', mapBack) : '/wordvault/review'}>
      <WordVaultStudyClient words={words} mode="review" viewerId={user.id} {...(mapBack ? { mapBack, backHref: mapBack } : {})} />
    </WordVaultViewerGate>
  )
}
