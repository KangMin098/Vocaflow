// apps/web/src/lib/scriptquiz/questions.ts
//
// ScriptQuiz play 진입 → quiz_questions(per user+text)에서 실 퀴즈 세션 fetch.
// 문제가 없으면 null → 호출부가 MOCK_SESSION 폴백(데모/미생성 스크립트).
//
// 문제 생성은 런타임 AI 미사용(앱에 LLM 인프라 없음) — Claude Code(MCP) 사전 생성 또는
// 별도 생성 파이프라인이 quiz_questions 를 채운다. 본 모듈은 read + 매핑만.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@vocaflow/types'

import { contentRefFromBook, contentRefFromText } from '@/lib/content/content-ref'
import { pagedSelect } from '@/lib/supabase/paged-select'
import type {
  ChapterQuizCatalogBook,
  QuizOption,
  QuizQuestion,
  QuizSession,
} from '@/components/game/scriptquiz/types'

export type {
  ChapterQuizCatalogBook,
  ChapterQuizCatalogChapter,
} from '@/components/game/scriptquiz/types'

/**
 * 화면용으로 읽는 열만. **`correct_index`·`source_snippet` 은 일부러 없다** —
 * RPC 는 그 열까지 돌려주지만(시그니처 고정) 여기서 받지 않으면 다음 사람이
 * "있으니까 쓰자" 로 다시 실어 보내는 일이 안 생긴다.
 */
interface QuizQuestionRow {
  id: string
  type: string
  question: string
  question_ko: string | null
  options: QuizOption[] | null
}

/**
 * DB 행 → 화면에 내려보낼 문항.
 *
 * ⚠️ **`correct_index` · `source_snippet` 을 여기서 버린다.** 이 값들이 살아 있던 동안
 *   `ScriptQuiz`(`'use client'`)의 prop 으로 직렬화돼 **시작하기를 누르기 전에** 페이지
 *   소스에 정답표가 다 보였다(`Ctrl+U` 로 재현). RPC 는 그대로 두고(마이그레이션 불필요)
 *   **앱 계층에서 자른다** — 자르는 자리가 한 곳이어야 다시 새지 않는다.
 *   답한 뒤의 정답·근거는 `gradeScriptQuizAnswer` 가 그 문항 하나만 돌려준다.
 */
function rowToQuestion(r: QuizQuestionRow): QuizQuestion {
  const type: QuizQuestion['type'] =
    r.type === 'truefalse' || r.type === 'blank' ? r.type : 'multiple'
  return {
    id: r.id,
    type,
    question: r.question,
    ...(r.question_ko ? { questionKo: r.question_ko } : {}),
    options: Array.isArray(r.options) ? r.options : [],
  }
}

/**
 * 큐레이션 챕터 퀴즈 세션 (공유 · library_book_id + chapter_idx 키).
 * select_book_chapter_quiz RPC(SECURITY DEFINER) 로 read — RLS 우회, 학습자 공유 콘텐츠.
 * 제목은 list_book_chapter_quiz_catalog 에서 매칭(library_books RLS 비의존).
 * 문제 0개면 null(→ 호출부 폴백/빈 상태).
 */
export async function fetchChapterQuizSession(
  client: SupabaseClient<Database>,
  libraryBookId: string,
  chapterIdx: number,
): Promise<QuizSession | null> {
  // client.rpc 를 변수로 떼어내면 this 바인딩이 풀려 호출 시 throw — bind 필수
  const rpc = client.rpc.bind(client) as unknown as (
    fn: string,
    args?: Record<string, unknown>,
  ) => Promise<{ data: unknown; error: { message: string } | null }>

  const [{ data: qData, error: qErr }, { data: catData }] = await Promise.all([
    rpc('select_book_chapter_quiz', {
      p_book_id: libraryBookId,
      p_chapter_idx: chapterIdx,
    }),
    rpc('list_book_chapter_quiz_catalog'),
  ])
  if (qErr) throw new Error(qErr.message)

  const rows = (Array.isArray(qData) ? qData : []) as unknown as QuizQuestionRow[]
  if (rows.length === 0) return null

  const catalog = (Array.isArray(catData) ? catData : []) as Array<{
    book_id: string
    book_title: string
    chapter_idx: number
    chapter_title: string | null
  }>
  const entry = catalog.find(
    (c) => c.book_id === libraryBookId && c.chapter_idx === chapterIdx,
  )
  const bookTitle = entry?.book_title ?? '스크립트'
  const chapterLabel = entry?.chapter_title ?? `Chapter ${chapterIdx}`

  return {
    textTitle: bookTitle,
    textChapter: chapterLabel,
    // 큐레이션 챕터는 texts 행이 없다 — 도서 자체로 귀속시켜야 챕터를 가로질러 합쳐진다.
    content: contentRefFromBook(libraryBookId, chapterIdx),
    // 정답표가 어디 있는지만 들려 보낸다 — 값이 아니라 **주소**다.
    source: { kind: 'book', bookId: libraryBookId, chapterIdx },
    questions: rows.map(rowToQuestion),
  }
}

/**
 * 허브 discovery — 퀴즈가 있는 도서/챕터 카탈로그.
 * list_book_chapter_quiz_catalog RPC(SECURITY DEFINER) → 도서별로 그룹핑.
 */
export async function fetchChapterQuizCatalog(
  client: SupabaseClient<Database>,
): Promise<ChapterQuizCatalogBook[]> {
  // client.rpc 를 변수로 떼어내면 this 바인딩이 풀려 호출 시 throw — bind 필수
  const rpc = client.rpc.bind(client) as unknown as (
    fn: string,
    args?: Record<string, unknown>,
  ) => {
    range: (
      from: number,
      to: number,
    ) => PromiseLike<{ data: unknown; error: { message: string } | null }>
  }

  // RPC 도 PostgREST 의 1,000행 상한을 받는다. 이 RPC 는 **퀴즈가 있는 챕터마다 한 행**이라
  // 드레인이 진행될수록 행이 늘고, 상한을 넘는 순간 뒤쪽 도서가 카탈로그에서 조용히 사라진다
  // (오류 없음 → "아직 안 만들어졌다" 빈 상태로 오인). 2026-08-30 실측 189행 / 대상 3,373행.
  const rows = await pagedSelect<{
    book_id: string
    book_title: string
    book_v_level: number | null
    chapter_idx: number
    chapter_title: string | null
    question_count: number
  }>(
    (from, to) => rpc('list_book_chapter_quiz_catalog').range(from, to),
    'ScriptQuiz 챕터 퀴즈 카탈로그',
  )

  const byBook = new Map<string, ChapterQuizCatalogBook>()
  for (const r of rows) {
    let book = byBook.get(r.book_id)
    if (!book) {
      book = {
        bookId: r.book_id,
        bookTitle: r.book_title,
        bookVLevel: r.book_v_level,
        chapters: [],
        questionTotal: 0,
      }
      byBook.set(r.book_id, book)
    }
    book.chapters.push({
      chapterIdx: r.chapter_idx,
      chapterTitle: r.chapter_title ?? `Chapter ${r.chapter_idx}`,
      questionCount: r.question_count,
    })
    book.questionTotal += r.question_count
  }
  return Array.from(byBook.values())
}

/**
 * (user, text) 의 실 퀴즈 세션. 문제 0개면 null(→ MOCK 폴백).
 * textTitle 은 texts.title 사용.
 */
export async function fetchQuizSession(
  client: SupabaseClient<Database>,
  userId: string,
  textId: string,
): Promise<QuizSession | null> {
  const [{ data: qRows, error: qErr }, { data: textRow }] = await Promise.all([
    client
      .from('quiz_questions')
      // ⚠️ 정답·근거 열은 **받지도 않는다.** 받아 두면 다음 사람이 "있으니까" 실어 보낸다.
      .select('id, type, question, question_ko, options')
      .eq('user_id', userId)
      .eq('text_id', textId)
      .order('created_at', { ascending: true }),
    // library_book_id/chapter_idx 도 읽는다 — enroll 한 도서 챕터면 텍스트가 아니라
    // **도서로** 귀속시켜야 챕터를 가로질러 "이 도서로 얼마나 했나" 가 합쳐진다.
    client
      .from('texts')
      .select('id, title, library_book_id, chapter_idx')
      .eq('id', textId)
      .maybeSingle(),
  ])
  if (qErr) throw qErr

  // question_ko 는 신규 컬럼(20260628140000) — 생성 타입 미반영이라 unknown 경유 캐스팅.
  const rows = (qRows ?? []) as unknown as QuizQuestionRow[]
  if (rows.length === 0) return null

  const text = textRow as {
    id: string
    title: string | null
    library_book_id: string | null
    chapter_idx: number | null
  } | null

  return {
    textTitle: text?.title ?? '스크립트',
    content: text ? contentRefFromText(text) : { type: 'text', id: textId },
    source: { kind: 'text', textId },
    questions: rows.map(rowToQuestion),
  }
}
