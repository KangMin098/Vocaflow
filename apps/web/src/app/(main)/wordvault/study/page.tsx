// apps/web/src/app/(main)/wordvault/study/page.tsx
// WordVault Study 풀스크린 세션 (실 데이터 · A2).
//
// browse RSC 패턴 미러: 사용자 vocabularies 를 due 우선으로 fetch → StudyMode.
// 평가 결과는 StudyMode → sessionStorage 큐 → 세션 종료 시 flush (A1.1 경로).
//
// 2026-10-28 — 출처 목록(filter=text:/set:)에서 온 세션: 본인 단어 전량을 같은 순서로 받아
//   Browse 와 같은 범위(applySourceFilter · 기사 membership) → 검색 · 난이도 → 상한 50 순으로 고른다
//   (lib/wordvault/source-study). 잘못된 주소 · 조회 실패는 전체 단어로 바꾸지 않고 실패로 알린다.

import type { SupabaseClient } from '@supabase/supabase-js'
import { redirect } from 'next/navigation'

import { WordVaultStudyClient } from '@/components/wordvault/WordVaultStudyClient'
import { WordVaultViewerGate } from '@/components/wordvault/WordVaultBrowseClient'
import { sanitizeInternalPath, resolveSessionReturnHref } from '@/lib/layout/session-return'
import { createClient } from '@/lib/supabase/server'
import { vocabRowToWord, type BrowseWord } from '@/lib/wordvault/browse-queries'
import { loadArticleSetMembership } from '@/lib/wordvault/set-membership-query'
import type { SetMembership } from '@/lib/wordvault/source-filter'
import { parseStudyFilter, scopeSourceStudyWords, sourceStudyReturnHref } from '@/lib/wordvault/source-study'
import { fetchAllStudyVocabulariesOrdered, fetchStudyVocabularies, STUDY_SESSION_CAP } from '@/lib/wordvault/study-queries'

export const metadata = {
  title: 'WordVault — 학습',
}

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: {
    /** `state:new` 등 — browse 의 "이 단어로 학습 시작" 이 현재 필터를 그대로 넘긴다. `text:`/`set:` 는 출처 목록 세션 */
    filter?: string | string[]
    /** 출처 세션에서만 — 목록에 걸려 있던 검색어 · 난이도 */
    q?: string | string[]
    level?: string | string[]
    /** 어디서 들어왔나 — 끝내고 그 자리로 돌려보낸다(없으면 허브). */
    from?: string | string[]
  }
}

export default async function WordVaultStudyPage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const parsed = parseStudyFilter(searchParams.filter, searchParams.q, searchParams.level)
  const rawFrom = typeof searchParams.from === 'string' ? searchParams.from : undefined
  const safeFrom = sanitizeInternalPath(rawFrom)

  // 다시 열기 · 로그인 복귀 주소 — 검증한 값만 싣는다(uid 없음).
  const reopen = new URLSearchParams()
  if (parsed.kind === 'invalid') {
    // 잘못된 요청은 로그인 · 다시 열기 뒤에도 잘못된 채로 — 반복 값을 버려 전체/더 넓은 범위로 바꾸지 않는다(fail-closed 표식).
    reopen.set('filter', 'invalid')
  } else if (parsed.kind === 'source') {
    reopen.set('filter', parsed.filter)
    if (parsed.query) reopen.set('q', parsed.query)
    if (typeof searchParams.level === 'string' && parsed.level) reopen.set('level', searchParams.level.trim())
  } else if (typeof searchParams.filter === 'string' && searchParams.filter) {
    reopen.set('filter', searchParams.filter)
  }
  if (safeFrom) reopen.set('from', safeFrom)
  const reopenHref = reopen.size ? `/wordvault/study?${reopen.toString()}` : '/wordvault/study'

  if (!user) {
    // 로그인 후에도 같은 묶음으로 돌아오게 — 필터를 잃으면 전체 세션이 열린다.
    redirect(`/login?next=${encodeURIComponent(reopenHref)}`)
  }

  // 개인 단어 · 뜻 · 평가는 서버가 읽은 사람(user.id)의 것 — 브라우저 신원이 그 사람으로 긍정 확인될 때만 그린다.
  if (parsed.kind === 'invalid') {
    return (
      <WordVaultViewerGate viewerId={user.id} reopenHref={reopenHref}>
        <WordVaultStudyClient words={[]} viewerId={user.id} backHref={sourceStudyReturnHref(safeFrom, '')} source={{ total: 0, conditions: '', error: 'invalid' }} />
      </WordVaultViewerGate>
    )
  }

  if (parsed.kind === 'source') {
    const backHref = sourceStudyReturnHref(safeFrom, parsed.filter)
    const conditions = ['이 목록', parsed.level ? (parsed.level.kind === 'cefr' ? parsed.level.value : `${parsed.level.value.toUpperCase()} 등급`) : null, parsed.query ? `"${parsed.query}"` : null]
      .filter(Boolean)
      .join(' · ')
    let words: BrowseWord[] = []
    let total = 0
    let error: 'load' | 'membership' | undefined
    try {
      const [rows, payload] = await Promise.all([
        fetchAllStudyVocabulariesOrdered(supabase, user.id),
        loadArticleSetMembership(supabase as unknown as SupabaseClient, parsed.filter),
      ])
      const membership: SetMembership | null = !payload ? null : 'error' in payload ? { setId: payload.setId, error: true } : { setId: payload.setId, words: new Set(payload.words) }
      const scoped = scopeSourceStudyWords(rows.map((r, i) => vocabRowToWord(r, i)), parsed, membership, STUDY_SESSION_CAP)
      if (scoped.status === 'membership-error') error = 'membership'
      else {
        words = scoped.words
        total = scoped.total
      }
    } catch {
      error = 'load'
    }
    return (
      <WordVaultViewerGate viewerId={user.id} reopenHref={reopenHref}>
        <WordVaultStudyClient words={words} viewerId={user.id} backHref={backHref} source={{ total, conditions, error }} />
      </WordVaultViewerGate>
    )
  }

  const rows = await fetchStudyVocabularies(supabase, user.id, parsed.kind === 'state' ? parsed.key : null)
  const words: BrowseWord[] = rows.map((r, i) => vocabRowToWord(r, i))
  return (
    <WordVaultViewerGate viewerId={user.id} reopenHref={reopenHref}>
      <WordVaultStudyClient
        words={words}
        viewerId={user.id}
        backHref={resolveSessionReturnHref(rawFrom, null, '/wordvault')}
      />
    </WordVaultViewerGate>
  )
}
