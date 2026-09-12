// apps/web/src/lib/scriptquiz/queue.ts
//
// ScriptQuiz 진입면의 데이터 — **카탈로그가 아니라 "읽은 것의 확인 대기열"**.
//
// ── 왜 바꿨나 (실측 2026-08-16) ─────────────────────────────────────────────
// 이전 진입면은 퀴즈가 있는 챕터 **129개를 전부 동일하게 나열**했다(5.57 화면 높이).
// 그런데 같은 시점 DB 를 보면 학습자의 Pride and Prejudice 는 이랬다:
//     Ch1–19 `extracted`(읽음) · Ch20 `in_progress` · **Ch21–61 `not_started`**
// 즉 화면은 **아직 읽지도 않은 41개 챕터의 독해 퀴즈를 팔고 있었다.** 그건 쓸모없는 정도가
// 아니라 **줄거리를 미리 알려주는 것**이다(Pride and Prejudice 41챕터 분량의 스포일러).
// 고를 근거도 없었다 — 어느 챕터를 읽었는지, 무엇을 이미 확인했는지 화면이 말하지 않았다.
// 필요한 정보는 전부 이미 DB 에 있었고 화면이 쓰지 않았을 뿐이다.
//
// ── 근거 ────────────────────────────────────────────────────────────────────
// · Accelerated Reader(Renaissance · 26,000+ 퀴즈, 학교 표준) — **책을 읽은 뒤** 푸는 퀴즈이고,
//   오답은 "읽지 않은 사람에게 그럴듯한" 것으로 설계된다. 즉 이해도 검증인 **동시에
//   실제로 읽었는지를 판별하는 장치**다. 안 읽은 챕터에 이걸 내주면 장치가 무의미해진다.
// · BookPal 'Spoiler Shield' — 동반 AI 가 **읽은 데까지만** 안다. 같은 계약.
// · Roediger & Karpicke — 인출이 재독을 이긴다. 단 **즉시·집중 인출은 효과가 작고
//   간격을 둔 인출이 강하다** → 다음 한 걸음은 "방금 읽은 챕터" 가 아니라
//   **읽은 지 가장 오래됐고 아직 확인 안 한 챕터**로 고른다.
// · `docs/LEARNING_FRAMEWORK.md` §4④ 한 번에 한 걸음만 · §4① 막지 않고 권한다
//   (안 읽은 챕터는 **잠그는 게 아니라** 목록에서 빼고 "읽으러 가기" 를 준다).

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@vocaflow/types'

import { pagedSelectIn } from '@/lib/supabase/paged-select'

import { fetchChapterQuizCatalog, type ChapterQuizCatalogBook } from './questions'

/**
 * "읽었다" 의 정의 — `v_user_book_progress.done_chapters` 와 **같은 집합**을 쓴다.
 * 여기서 따로 정하면 같은 학습자가 화면마다 다른 진도를 갖는다.
 */
const READ_STATUSES = ['completed', 'conquered', 'extracted'] as const

export interface QueueChapter {
  chapterIdx: number
  chapterTitle: string
  questionCount: number
  /** 이 챕터를 읽은(=상태가 바뀐) 시각 */
  readAt: string
  /** 확인한 적 있으면 마지막 시각 */
  attemptedAt: string | null
  /** 마지막 결과 — 없으면 null. accuracy 는 0~100 계약(`lib/scores/record-score.ts`) */
  lastAccuracy: number | null
}

export interface QueueBook {
  bookId: string
  bookTitle: string
  bookVLevel: number | null
  /** **읽은 챕터만.** 안 읽은 챕터는 여기 오지 않는다(스포일러) */
  readChapters: QueueChapter[]
  /** 그중 확인 완료 수 */
  confirmed: number
  /** 다음에 읽을 챕터 — 퀴즈가 아니라 **읽기**로 보낸다. 없으면 null */
  nextToRead: { chapterIdx: number; chapterTitle: string } | null
  /** 이 책에서 아직 읽지 않아 목록에 넣지 않은 챕터 수 (숨긴 것을 숨기지 않기 위해 표기) */
  unreadHidden: number
}

export interface QuizQueue {
  books: QueueBook[]
  /** 다음 한 걸음 — 읽은 지 가장 오래됐고 아직 확인 안 한 챕터. 없으면 null */
  next: { bookId: string; bookTitle: string; chapter: QueueChapter } | null
  /** 읽었지만 아직 확인 안 한 챕터 총수 */
  unconfirmed: number
  /** 읽은 챕터 총수 */
  readTotal: number
}

interface TextRow {
  library_book_id: string | null
  chapter_idx: number | null
  status: string | null
  updated_at: string | null
}

interface ScoreRow {
  content_id: string | null
  content_chapter: number | null
  accuracy: number | null
  created_at: string | null
}

/**
 * 순수 조립 — 쿼리와 분리해 규칙을 테스트할 수 있게 한다.
 * (이 함수가 지키는 계약이 곧 화면의 약속이라, 쿼리 없이 단언 가능해야 한다.)
 */
export function buildQuizQueue(
  catalog: ChapterQuizCatalogBook[],
  texts: TextRow[],
  scores: ScoreRow[],
): QuizQueue {
  // (book, chapter) → 읽은 시각. 읽지 않은 챕터는 아예 키가 없다.
  const readAt = new Map<string, string>()
  // (book, chapter) → 그 책에 존재하는 챕터인지 (읽음 여부와 무관 · nextToRead 계산용)
  const chapterStatus = new Map<string, string>()
  for (const t of texts) {
    if (!t.library_book_id || t.chapter_idx == null) continue
    const key = `${t.library_book_id}:${t.chapter_idx}`
    chapterStatus.set(key, t.status ?? '')
    if (READ_STATUSES.includes((t.status ?? '') as (typeof READ_STATUSES)[number])) {
      readAt.set(key, t.updated_at ?? '')
    }
  }

  // (book, chapter) → 마지막 시도. 여러 번 풀었으면 가장 최근 것.
  const lastAttempt = new Map<string, { at: string; accuracy: number | null }>()
  for (const s of scores) {
    if (!s.content_id || s.content_chapter == null) continue
    const key = `${s.content_id}:${s.content_chapter}`
    const at = s.created_at ?? ''
    const prev = lastAttempt.get(key)
    if (!prev || at > prev.at) lastAttempt.set(key, { at, accuracy: s.accuracy })
  }

  const books: QueueBook[] = []
  for (const b of catalog) {
    const readChapters: QueueChapter[] = []
    let unreadHidden = 0
    for (const ch of b.chapters) {
      const key = `${b.bookId}:${ch.chapterIdx}`
      const read = readAt.get(key)
      if (read === undefined) {
        unreadHidden++
        continue
      }
      const att = lastAttempt.get(key)
      readChapters.push({
        chapterIdx: ch.chapterIdx,
        chapterTitle: ch.chapterTitle,
        questionCount: ch.questionCount,
        readAt: read,
        attemptedAt: att?.at ?? null,
        lastAccuracy: att?.accuracy ?? null,
      })
    }
    if (readChapters.length === 0) continue // 한 챕터도 안 읽은 책은 이 화면의 대상이 아니다

    readChapters.sort((a, b2) => a.chapterIdx - b2.chapterIdx)

    // 다음에 읽을 챕터 — 읽지 않은 것 중 가장 앞선 것(이야기 순서).
    const nextUnread = b.chapters.find((c) => !readAt.has(`${b.bookId}:${c.chapterIdx}`))

    books.push({
      bookId: b.bookId,
      bookTitle: b.bookTitle,
      bookVLevel: b.bookVLevel,
      readChapters,
      confirmed: readChapters.filter((c) => c.attemptedAt !== null).length,
      nextToRead: nextUnread
        ? { chapterIdx: nextUnread.chapterIdx, chapterTitle: nextUnread.chapterTitle }
        : null,
      unreadHidden,
    })
  }

  // 최근에 읽은 책이 위로 — 지금 붙잡고 있는 이야기가 먼저다.
  books.sort((a, b2) => {
    const la = a.readChapters.reduce((m, c) => (c.readAt > m ? c.readAt : m), '')
    const lb = b2.readChapters.reduce((m, c) => (c.readAt > m ? c.readAt : m), '')
    return lb.localeCompare(la)
  })

  // 다음 한 걸음 — **읽은 지 가장 오래된** 미확인 챕터(간격 인출). 동률이면 이야기 순서.
  let next: QuizQueue['next'] = null
  for (const b of books) {
    for (const c of b.readChapters) {
      if (c.attemptedAt !== null) continue
      if (
        next === null ||
        c.readAt < next.chapter.readAt ||
        (c.readAt === next.chapter.readAt && c.chapterIdx < next.chapter.chapterIdx)
      ) {
        next = { bookId: b.bookId, bookTitle: b.bookTitle, chapter: c }
      }
    }
  }

  const readTotal = books.reduce((s, b) => s + b.readChapters.length, 0)
  const unconfirmed = books.reduce(
    (s, b) => s + b.readChapters.filter((c) => c.attemptedAt === null).length,
    0,
  )
  return { books, next, unconfirmed, readTotal }
}

/** 진입면 데이터 1회 조회. 비로그인이면 빈 큐(카탈로그는 여전히 공개 정보지만 대기열은 개인 것). */
export async function fetchScriptQuizQueue(
  client: SupabaseClient<Database>,
  userId: string | null,
): Promise<QuizQueue> {
  if (!userId) return { books: [], next: null, unconfirmed: 0, readTotal: 0 }

  const catalog = await fetchChapterQuizCatalog(client)
  if (catalog.length === 0) return { books: [], next: null, unconfirmed: 0, readTotal: 0 }

  const bookIds = catalog.map((b) => b.bookId)

  // 두 조회 모두 **전량이 필요하다** — 빠진 행은 오류가 아니라 "안 읽음 / 안 풀었음" 으로
  // 읽힌다. `texts` 가 잘리면 읽은 챕터가 대기열에서 사라지고, `scores` 가 잘리면
  // 이미 확인한 챕터를 다시 풀라고 내민다. 둘 다 화면만 조용히 틀린다.
  // (카탈로그 도서 수가 6 → 271 로 자라는 중이라 `.in()` 길이도 함께 위험하다.)
  const [textRows, scoreRows] = await Promise.all([
    pagedSelectIn<TextRow>(
      bookIds,
      (chunk, from, to) =>
        client
          .from('texts')
          .select('library_book_id, chapter_idx, status, updated_at')
          .eq('user_id', userId)
          .in('library_book_id', chunk)
          .range(from, to),
      'ScriptQuiz 대기열 texts',
    ),
    pagedSelectIn<ScoreRow>(
      bookIds,
      (chunk, from, to) =>
        client
          .from('scores')
          .select('content_id, content_chapter, accuracy, created_at')
          .eq('user_id', userId)
          .eq('module', 'scriptquiz')
          .in('content_id', chunk)
          .range(from, to),
      'ScriptQuiz 대기열 scores',
    ),
  ])

  return buildQuizQueue(catalog, textRows, scoreRows)
}
