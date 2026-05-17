// apps/web/src/app/(main)/wordvault/browse/page.tsx
// WordVault Browse 풀스크린 세션 (실 데이터 · Phase 2)
//
// Server Component: 사용자 단어 + 스크립트/구독 세트 chip 데이터 fetch.
// 비로그인 시 mock fallback (개발 진입점 보존).
// SessionFrame 셸이 자동 주입 (isFullScreenRoute 등록).

import { redirect } from 'next/navigation'

import { WordVaultBrowseClient } from '@/components/wordvault/WordVaultBrowseClient'
import { createClient } from '@/lib/supabase/server'
import {
  fetchUserSetChips,
  fetchUserTextChips,
  fetchUserVocabularies,
  vocabRowToWord,
  type BrowseWord,
} from '@/lib/wordvault/browse-queries'

export const metadata = {
  title: 'WordVault — 둘러보기 · Vocaflow',
}

export const dynamic = 'force-dynamic'

export default async function WordVaultBrowsePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login?next=/wordvault/browse')
  }

  const rows = await fetchUserVocabularies(supabase, user.id)
  const [textChips, setChips] = await Promise.all([
    fetchUserTextChips(supabase, user.id, rows),
    fetchUserSetChips(supabase, rows),
  ])

  const words: BrowseWord[] = rows.map((r, i) => vocabRowToWord(r, i))

  return <WordVaultBrowseClient words={words} textChips={textChips} setChips={setChips} />
}
