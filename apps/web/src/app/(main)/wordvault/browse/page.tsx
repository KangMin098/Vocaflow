// apps/web/src/app/(main)/wordvault/browse/page.tsx
// WordVault Browse 풀스크린 세션 (실 데이터 · Phase 2)
//
// v06.34 — book/chapter query 지원:
//   /wordvault/browse?filter=set:{id}&book={bookId}&chapter={idx}
//   → 그 도서의 chapter sets list 와 현재 chapter 정보를 BrowseClient 에 전달
//   → ResourceContext 동적 (book title › Chapter N) + chapter prev/next nav

import { redirect } from 'next/navigation'

import { StoryVaultReturnBar, type StoryVaultReturnState } from '@/components/library/story/StoryVaultReturn'
import { WordVaultBrowseClient, WordVaultViewerGate } from '@/components/wordvault/WordVaultBrowseClient'
import { loginUrlWithReturn } from '@/lib/auth/redirect'
import { loadStoryReturnTarget, type StoryLearnerClient } from '@/lib/library/story/learner'
import { resolveVaultReturnContexts, vaultPathWithStoryContext } from '@/lib/library/story/return-context'
import { MapReturnBar } from '@/components/wordvault/WordVaultStudyClient'
import { vocabMapLink } from '@/lib/csat/map-return'
import { createClient } from '@/lib/supabase/server'
import { resolveBookChapter } from '@/lib/wordvault/book-context'
import {
  fetchUserSetChips,
  fetchUserTextChips,
  fetchUserVocabularies,
  vocabRowToWord,
  type BrowseWord,
} from '@/lib/wordvault/browse-queries'

export const metadata = {
  title: 'WordVault — 둘러보기',
}

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: {
    filter?: string
    book?: string
    chapter?: string
    [key: string]: string | string[] | undefined
  }
}

export default async function WordVaultBrowsePage({ searchParams }: PageProps) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // D5-I02 — Story 에서 명시 이동한 경우의 임시 복귀 문맥(엄격한 두 값만). 지도 복귀(from=…)와 섞이면 — Story 값 형식이
  // 틀렸거나 짝이 없어도 — 어느 쪽도 적용하지 않는다(resolveVaultReturnContexts 가 형식 검사보다 먼저 판정).
  // T-0086 — 지도에서 온 목록이면 검증된 복귀 주소(일반 진입은 null · 지도 안내 없음)
  const { story: storyParsed, mapBack } = resolveVaultReturnContexts(searchParams)

  if (!user) {
    // 로그인 뒤에도 검증된 Story 문맥은 그대로 돌아온다(공용 loginUrlWithReturn — 내부 경로만). 그 밖의 매개변수는 기존처럼 싣지 않는다.
    redirect(loginUrlWithReturn(vaultPathWithStoryContext(storyParsed.status === 'ok' ? storyParsed.context : null)))
  }

  let storyReturn: StoryVaultReturnState | null = null
  if (storyParsed.status === 'conflict') storyReturn = { status: 'conflict' }
  else if (storyParsed.status === 'ok') {
    storyReturn = await loadStoryReturnTarget({ client: supabase as unknown as StoryLearnerClient }, storyParsed.context)
  }
  const storyBar = storyReturn ? <StoryVaultReturnBar state={storyReturn} /> : null
  // T-0191 — 아래 개인 화면(목록 · 칩 · 듣기 · 복귀 줄 · 실패 화면의 복귀 줄)은 서버 getUser 의 주인(user.id)에 묶는다.
  // 브라우저 신원이 그 사람으로 긍정 확인될 때만 그린다(WordVaultViewerGate). 다시 열기 주소는 검증한 문맥만 싣는다(쿼리 uid 없음).
  const reopenHref =
    storyParsed.status === 'ok' ? vaultPathWithStoryContext(storyParsed.context) : mapBack ? vocabMapLink('/wordvault/browse', mapBack) : '/wordvault/browse'
  let rows: Awaited<ReturnType<typeof fetchUserVocabularies>>
  let textChips: Awaited<ReturnType<typeof fetchUserTextChips>>
  let setChips: Awaited<ReturnType<typeof fetchUserSetChips>>
  try {
    rows = await fetchUserVocabularies(supabase, user.id)
    ;[textChips, setChips] = await Promise.all([fetchUserTextChips(supabase, user.id, rows), fetchUserSetChips(supabase, rows)])
  } catch (e) {
    // 일반 진입은 기존 그대로(오류 경계). 지도에서 온 경우만 빈 목록으로 위장하지 않고 실패 + 돌아갈 길
    if (!mapBack && !storyBar) throw e
    return (
      <WordVaultViewerGate viewerId={user.id} reopenHref={reopenHref}>
        {mapBack ? <MapReturnBar href={mapBack} note="학습 지도 · 기본 의미(V1) 준비" /> : storyBar}
        <div className="mx-auto flex max-w-[480px] flex-col items-center px-s-4 py-s-16 text-center" data-testid="vocab-browse-load-failed">
          <h1 className="sr-only">내 단어장</h1>
          <h2 role="alert" className="mb-s-2 break-keep font-editorial text-[24px] font-[500] leading-snug tracking-[-0.015em] text-t1">단어를 불러오지 못했어요</h2>
          <p className="break-keep font-body text-sm text-t2">모은 단어가 없다는 뜻이 아니에요. 잠시 뒤 다시 열어 주세요.</p>
        </div>
      </WordVaultViewerGate>
    )
  }

  const words: BrowseWord[] = rows.map((r, i) => vocabRowToWord(r, i))

  // v06.34 — book/chapter query 가 있으면 그 도서의 chapter context fetch
  //   currentTextId: 사용자가 enroll 한 책이면 현재 chapter 의 texts.id (본문 복귀용)
  let bookContext: {
    bookId: string
    bookTitle: string
    chapterIdx: number
    currentTextId: string | null
    chapters: Array<{
      id: string
      chapterIdx: number
      title: string
      isCurrent: boolean
    }>
  } | null = null

  if (searchParams.book) {
    const { data: book } = await supabase
      .from('library_books')
      .select('id, title')
      .eq('id', searchParams.book)
      .maybeSingle()

    if (book) {
      const { data: sets } = await supabase
        .from('shared_word_sets')
        .select('id, title, curation_query')
        .eq('is_published', true)
        .eq('category', 'library_book')
        .eq('curation_query->>book_id', searchParams.book)

      const rows = (sets ?? []) as Array<{
        id: string
        title: string
        curation_query: Record<string, unknown> | null
      }>
      const sortedChapters = rows
        .map((r) => ({
          id: r.id,
          title: r.title,
          chapterIdx: Number(r.curation_query?.chapter_idx ?? 0),
        }))
        .sort((a, b) => a.chapterIdx - b.chapterIdx)

      // 보이는 단어(filter=set:)가 이 도서·장의 세트일 때만 안내한다 — 다른 세트·장 번호 형식 오류면 안내 없음.
      const currentIdx = resolveBookChapter(searchParams.filter, searchParams.chapter, sortedChapters)

      // 사용자 enrolled book 이면 현재 chapter 의 textId fetch — ResourceContext 본문 복귀용
      const { data: textRow } = currentIdx === null ? { data: null } : await supabase
        .from('texts')
        .select('id')
        .eq('user_id', user.id)
        .eq('library_book_id', searchParams.book)
        .eq('chapter_idx', currentIdx)
        .maybeSingle()

      if (currentIdx !== null) bookContext = {
        bookId: searchParams.book,
        bookTitle: (book as { title: string }).title,
        chapterIdx: currentIdx,
        currentTextId: (textRow as { id: string } | null)?.id ?? null,
        chapters: sortedChapters.map((c) => ({
          id: c.id,
          chapterIdx: c.chapterIdx,
          title: c.title,
          isCurrent: c.chapterIdx === currentIdx,
        })),
      }
    }
  }

  return (
    <WordVaultViewerGate viewerId={user.id} reopenHref={reopenHref}>
      <WordVaultBrowseClient
        words={words}
        textChips={textChips}
        setChips={setChips}
        bookContext={bookContext}
        mapBack={mapBack}
        storyReturn={storyBar}
      />
    </WordVaultViewerGate>
  )
}
