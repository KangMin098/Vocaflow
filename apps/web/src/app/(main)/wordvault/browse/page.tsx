// apps/web/src/app/(main)/wordvault/browse/page.tsx
// WordVault Browse 풀스크린 세션 (실 데이터 · Phase 2)
//
// v06.34 — book/chapter query 지원:
//   /wordvault/browse?filter=set:{id}&book={bookId}&chapter={idx}
//   → 그 도서의 chapter sets list 와 현재 chapter 정보를 BrowseClient 에 전달
//   → ResourceContext 동적 (book title › Chapter N) + chapter prev/next nav

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
  title: 'WordVault — 둘러보기',
}

export const dynamic = 'force-dynamic'

interface PageProps {
  searchParams: {
    filter?: string
    book?: string
    chapter?: string
  }
}

export default async function WordVaultBrowsePage({ searchParams }: PageProps) {
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

      const currentIdx = searchParams.chapter
        ? parseInt(searchParams.chapter, 10)
        : (sortedChapters[0]?.chapterIdx ?? 0)

      // 사용자 enrolled book 이면 현재 chapter 의 textId fetch — ResourceContext 본문 복귀용
      const { data: textRow } = await supabase
        .from('texts')
        .select('id')
        .eq('user_id', user.id)
        .eq('library_book_id', searchParams.book)
        .eq('chapter_idx', currentIdx)
        .maybeSingle()

      bookContext = {
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
    <WordVaultBrowseClient
      words={words}
      textChips={textChips}
      setChips={setChips}
      bookContext={bookContext}
    />
  )
}
