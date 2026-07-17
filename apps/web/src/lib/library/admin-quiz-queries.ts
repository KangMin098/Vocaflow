// apps/web/src/lib/library/admin-quiz-queries.ts
//
// /admin/curation/preview/[bookId] 도서 검수 페이지의 챕터 퀴즈 검수 데이터 fetch.
// - library_chapter_quiz(RLS admin-only)를 authed admin 서버 클라이언트로 직접 read
//   → 학습자용 select_book_chapter_quiz RPC(SECURITY DEFINER)와 달리 correct_index /
//     question_ko / source_snippet 전 필드를 검수용으로 전량 노출.
// - book_quiz_jobs 로 생성 진행 상태(done/running·chapters_done/questions_created·note) 동반.
// - 챕터 제목은 library_chapters_master 에서 매핑.
//
// 서버 전용(authed admin) — 클라이언트에서 호출 금지(RLS 로 빈 결과).

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

export interface AdminQuizOption {
  text: string
  textKo?: string
}

export interface AdminQuizQuestion {
  id: string
  qOrder: number
  type: string
  question: string
  questionKo: string | null
  options: AdminQuizOption[]
  correctIndex: number
  sourceSnippet: string | null
}

export interface AdminChapterQuiz {
  chapterIdx: number
  chapterTitle: string
  bookVLevel: number | null
  questions: AdminQuizQuestion[]
}

export interface AdminQuizJob {
  status: string
  chaptersDone: number
  chaptersTotal: number
  questionsCreated: number
  note: string | null
  updatedAt: string | null
}

export interface AdminBookQuizReview {
  chapters: AdminChapterQuiz[]
  job: AdminQuizJob | null
}

interface QuizRow {
  id: string
  chapter_idx: number
  q_order: number
  type: string
  question: string
  question_ko: string | null
  options: AdminQuizOption[] | null
  correct_index: number
  source_snippet: string | null
  book_v_level: number | null
}

/**
 * 도서의 큐레이션 챕터 퀴즈 전량 + 생성 잡 상태 (검수용).
 * authed admin 서버 클라이언트 필요 — library_chapter_quiz / book_quiz_jobs 는 RLS admin-only.
 * 퀴즈가 하나도 없으면 chapters=[] (섹션이 빈 상태 안내).
 */
export async function fetchBookChapterQuizzes(
  client: SupabaseClient,
  bookId: string,
): Promise<AdminBookQuizReview> {
  const [quizRes, titleRes, jobRes] = await Promise.all([
    client
      .from('library_chapter_quiz')
      .select(
        'id, chapter_idx, q_order, type, question, question_ko, options, correct_index, source_snippet, book_v_level',
      )
      .eq('library_book_id', bookId)
      .order('chapter_idx', { ascending: true })
      .order('q_order', { ascending: true }),
    client
      .from('library_chapters_master')
      .select('chapter_idx, chapter_title')
      .eq('library_book_id', bookId),
    client
      .from('book_curation_jobs')
      .select('status, chapters_done, chapters_total, questions_created, note, updated_at')
      .eq('book_id', bookId)
      .eq('task_type', 'quiz_gen') // 퀴즈 통합(v06.x) — book_curation_jobs 로 흡수
      .maybeSingle(),
  ])

  if (quizRes.error) throw new Error(`fetchBookChapterQuizzes(quiz): ${quizRes.error.message}`)

  const titles = new Map<number, string>()
  for (const row of (titleRes.data ?? []) as { chapter_idx: number; chapter_title: string | null }[]) {
    titles.set(row.chapter_idx, row.chapter_title ?? `Chapter ${row.chapter_idx}`)
  }

  const rows = (quizRes.data ?? []) as unknown as QuizRow[]
  const byChapter = new Map<number, AdminChapterQuiz>()
  for (const r of rows) {
    let ch = byChapter.get(r.chapter_idx)
    if (!ch) {
      ch = {
        chapterIdx: r.chapter_idx,
        chapterTitle: titles.get(r.chapter_idx) ?? `Chapter ${r.chapter_idx}`,
        bookVLevel: r.book_v_level,
        questions: [],
      }
      byChapter.set(r.chapter_idx, ch)
    }
    ch.questions.push({
      id: r.id,
      qOrder: r.q_order,
      type: r.type,
      question: r.question,
      questionKo: r.question_ko,
      options: Array.isArray(r.options) ? r.options : [],
      correctIndex: r.correct_index,
      sourceSnippet: r.source_snippet,
    })
  }

  const chapters = Array.from(byChapter.values()).sort((a, b) => a.chapterIdx - b.chapterIdx)

  const jd = jobRes.data as
    | {
        status: string
        chapters_done: number
        chapters_total: number
        questions_created: number
        note: string | null
        updated_at: string | null
      }
    | null
  const job: AdminQuizJob | null = jd
    ? {
        status: jd.status,
        chaptersDone: jd.chapters_done,
        chaptersTotal: jd.chapters_total,
        questionsCreated: jd.questions_created,
        note: jd.note,
        updatedAt: jd.updated_at,
      }
    : null

  return { chapters, job }
}
