// apps/web/src/lib/dictation/catalog.ts
//
// 허브가 보여줄 "내 학습 자산" 목록 — 받아쓸 수 있는 것만.
//
// 기존 허브는 localStorage 시드 3개를 "라이브러리"라 부르고 있었다. 실제로 학습자가
// 가진 것은 enroll 한 도서의 챕터(texts), 직접 넣은 스크립트(texts), 구독한 공용
// 단어장(user_word_set_subscriptions)이다. 이 세 가지만 보여준다 — 받아쓸 수 없는
// 자료를 목록에 올리면 눌러본 뒤에야 빈 화면을 만나게 된다.

import type { SupabaseClient } from '@supabase/supabase-js'

export interface BookCatalogItem {
  bookId: string
  title: string
  author: string | null
  coverImageUrl: string | null
  cefr: string | null
  /** enroll 된 챕터 수 */
  chapterCount: number
  /** 바로 시작할 챕터 (가장 최근 연 것 → 없으면 첫 챕터) */
  resumeTextId: string
  resumeChapterIdx: number
  resumeChapterTitle: string | null
}

export interface ScriptCatalogItem {
  textId: string
  title: string
  cefr: string | null
  wordCount: number
  lastOpened: string | null
}

export interface SetCatalogItem {
  setId: string
  title: string
  coverEmoji: string | null
  cefr: string | null
  wordCount: number
  category: string | null
}

interface TextRow {
  id: string
  title: string | null
  cefr_level: string | null
  library_book_id: string | null
  chapter_idx: number | null
  chapter_title: string | null
  last_opened: string | null
}

/**
 * enroll 한 도서 — 챕터 texts 를 도서 단위로 접는다.
 * "이어서 받아쓰기" 지점은 가장 최근 연 챕터. 한 번도 안 열었으면 1챕터.
 *
 * ⚠️ content 로 거르지 않는다 — 도서 챕터의 `texts.content` 는 항상 NULL 이고 본문은
 * content_chunks 에 있다(lib/dictation/source.loadTextContent 참조). 여기서 content 를
 * 요구하면 모든 도서가 목록에서 사라진다.
 */
export async function fetchDictationBooks(
  client: SupabaseClient,
  userId: string,
  limit = 8,
): Promise<BookCatalogItem[]> {
  const { data } = await client
    .from('texts')
    .select('id, title, cefr_level, library_book_id, chapter_idx, chapter_title, last_opened')
    .eq('user_id', userId)
    .not('library_book_id', 'is', null)
    .order('chapter_idx', { ascending: true })
    .limit(600)

  const rows = (data ?? []) as TextRow[]
  if (rows.length === 0) return []

  const byBook = new Map<string, TextRow[]>()
  for (const r of rows) {
    if (!r.library_book_id) continue
    const list = byBook.get(r.library_book_id) ?? []
    list.push(r)
    byBook.set(r.library_book_id, list)
  }
  if (byBook.size === 0) return []

  const { data: bookData } = await client
    .from('library_books')
    .select('id, title, author, cover_image_url, cefr_level')
    .in('id', [...byBook.keys()])
  const books = new Map(
    ((bookData ?? []) as Array<{
      id: string
      title: string
      author: string | null
      cover_image_url: string | null
      cefr_level: string | null
    }>).map((b) => [b.id, b]),
  )

  const items: BookCatalogItem[] = []
  for (const [bookId, chapters] of byBook) {
    const book = books.get(bookId)
    // 최근 연 챕터 → 없으면 첫 챕터
    const opened = chapters
      .filter((c) => c.last_opened)
      .sort((a, b) => (b.last_opened ?? '').localeCompare(a.last_opened ?? ''))
    const resume = opened[0] ?? chapters[0]
    items.push({
      bookId,
      title: book?.title ?? resume.title ?? '도서',
      author: book?.author ?? null,
      coverImageUrl: book?.cover_image_url ?? null,
      cefr: book?.cefr_level ?? resume.cefr_level ?? null,
      chapterCount: chapters.length,
      resumeTextId: resume.id,
      resumeChapterIdx: resume.chapter_idx ?? 1,
      resumeChapterTitle: resume.chapter_title,
    })
  }

  // 최근 연 도서 우선
  items.sort((a, b) => b.chapterCount - a.chapterCount)
  return items.slice(0, limit)
}

/** 도서 한 권의 챕터 목록 — 챕터 선택 UI 용. */
export async function fetchBookChapters(
  client: SupabaseClient,
  userId: string,
  bookId: string,
): Promise<Array<{ textId: string; chapterIdx: number; chapterTitle: string | null }>> {
  const { data } = await client
    .from('texts')
    .select('id, chapter_idx, chapter_title')
    .eq('user_id', userId)
    .eq('library_book_id', bookId)
    .order('chapter_idx', { ascending: true })
  return ((data ?? []) as Array<{ id: string; chapter_idx: number | null; chapter_title: string | null }>).map(
    (r) => ({
      textId: r.id,
      chapterIdx: r.chapter_idx ?? 1,
      chapterTitle: r.chapter_title,
    }),
  )
}

/** 내가 넣은 스크립트 (도서 챕터 아닌 texts). */
export async function fetchDictationScripts(
  client: SupabaseClient,
  userId: string,
  limit = 8,
): Promise<ScriptCatalogItem[]> {
  const { data } = await client
    .from('texts')
    .select('id, title, content, cefr_level, last_opened')
    .eq('user_id', userId)
    .is('library_book_id', null)
    .not('content', 'is', null)
    .order('last_opened', { ascending: false, nullsFirst: false })
    .limit(limit)

  return ((data ?? []) as Array<{
    id: string
    title: string | null
    content: string | null
    cefr_level: string | null
    last_opened: string | null
  }>).map((r) => ({
    textId: r.id,
    title: r.title ?? '제목 없는 스크립트',
    cefr: r.cefr_level,
    wordCount: (r.content ?? '').split(/\s+/).filter(Boolean).length,
    lastOpened: r.last_opened,
  }))
}

/**
 * 구독한 공용 단어장.
 * 문장 없는 세트를 걸러내지 않는다 — 걸러내려면 세트마다 shared_words 를 훑어야 해
 * 허브가 느려진다. 대신 setup 이 문장 0개면 즉시 안내한다.
 */
export async function fetchDictationSets(
  client: SupabaseClient,
  userId: string,
  limit = 8,
): Promise<SetCatalogItem[]> {
  const { data: subs } = await client
    .from('user_word_set_subscriptions')
    .select('set_id, subscribed_at')
    .eq('user_id', userId)
    .order('subscribed_at', { ascending: false })
    .limit(limit * 2)

  const ids = ((subs ?? []) as Array<{ set_id: string }>).map((s) => s.set_id)
  if (ids.length === 0) return []

  const { data } = await client
    .from('shared_word_sets')
    .select('id, title, cover_emoji, cefr_level, word_count, category')
    .in('id', ids)
    .limit(limit)

  const order = new Map(ids.map((id, i) => [id, i]))
  return ((data ?? []) as Array<{
    id: string
    title: string
    cover_emoji: string | null
    cefr_level: string | null
    word_count: number | null
    category: string | null
  }>)
    .map((r) => ({
      setId: r.id,
      title: r.title,
      coverEmoji: r.cover_emoji,
      cefr: r.cefr_level,
      wordCount: r.word_count ?? 0,
      category: r.category,
    }))
    .sort((a, b) => (order.get(a.setId) ?? 0) - (order.get(b.setId) ?? 0))
}

export interface DictationCatalog {
  books: BookCatalogItem[]
  scripts: ScriptCatalogItem[]
  sets: SetCatalogItem[]
}

export async function fetchDictationCatalog(
  client: SupabaseClient,
  userId: string | null,
): Promise<DictationCatalog> {
  if (!userId) return { books: [], scripts: [], sets: [] }
  const [books, scripts, sets] = await Promise.all([
    fetchDictationBooks(client, userId),
    fetchDictationScripts(client, userId),
    fetchDictationSets(client, userId),
  ])
  return { books, scripts, sets }
}
