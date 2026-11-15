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
import { conditionParts, parseStudyFilter, scopeSourceStudyWords, sourceStudyReturnHref, studyReopenHref } from '@/lib/wordvault/source-study'
import { stateFilterLabel, toStateFilterValue } from '@/lib/wordvault/state-filter'
import { fetchAllStudyVocabulariesOrdered, fetchStudyVocabularies, scopeStateStudyRows, STUDY_SESSION_CAP } from '@/lib/wordvault/study-queries'

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
  const reopenHref = studyReopenHref(parsed, searchParams.filter, searchParams.level, safeFrom)

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
    const conditions = ['이 목록', ...conditionParts(parsed)].join(' · ')
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

  // 목록(MemoryFilterBar)에서 온 기억 상태 세션 — 검색 · 난이도 그대로, 끝 · 빈 상태 · 실패에서 그 목록으로.
  //   목록 주소 없는 예전 state: 링크는 아래 기존 경로 그대로(같은 판정 · 상한 — 이 분기도 판정 · 상한은 같다).
  if (parsed.kind === 'state-scoped' || (parsed.kind === 'state' && safeFrom)) {
    const stateScope = parsed.kind === 'state-scoped' ? parsed : { kind: 'state-scoped' as const, key: parsed.key, query: '', level: null }
    // 상태는 이 요청의 한 시각으로 다시 계산한다(목록을 본 시점과 다를 수 있다).
    const now = new Date()
    const backHref = sourceStudyReturnHref(safeFrom, toStateFilterValue(stateScope.key))
    const conditions = [`지금 기준 ${stateFilterLabel(stateScope.key)}`, ...conditionParts(stateScope)].join(' · ')
    let words: BrowseWord[] = []
    let total = 0
    let error: 'load' | undefined
    try {
      const scoped = scopeStateStudyRows(await fetchAllStudyVocabulariesOrdered(supabase, user.id), stateScope.key, stateScope, STUDY_SESSION_CAP, now)
      words = scoped.words
      total = scoped.total
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
