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

import type { QuizOption, QuizQuestion, QuizSession } from '@/components/game/scriptquiz/types'

interface QuizQuestionRow {
  id: string
  type: string
  question: string
  question_ko: string | null
  options: QuizOption[] | null
  correct_index: number
  source_snippet: string | null
  source_sentence_idx: number | null
}

function rowToQuestion(r: QuizQuestionRow): QuizQuestion {
  const type: QuizQuestion['type'] =
    r.type === 'truefalse' || r.type === 'blank' ? r.type : 'multiple'
  return {
    id: r.id,
    type,
    question: r.question,
    ...(r.question_ko ? { questionKo: r.question_ko } : {}),
    options: Array.isArray(r.options) ? r.options : [],
    correctIndex: r.correct_index,
    sourceSnippet: r.source_snippet ?? '',
    ...(r.source_sentence_idx != null ? { sourceSentenceIdx: r.source_sentence_idx } : {}),
  }
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
      .select('id, type, question, question_ko, options, correct_index, source_snippet, source_sentence_idx')
      .eq('user_id', userId)
      .eq('text_id', textId)
      .order('created_at', { ascending: true }),
    client.from('texts').select('title').eq('id', textId).maybeSingle(),
  ])
  if (qErr) throw qErr

  // question_ko 는 신규 컬럼(20260628140000) — 생성 타입 미반영이라 unknown 경유 캐스팅.
  const rows = (qRows ?? []) as unknown as QuizQuestionRow[]
  if (rows.length === 0) return null

  return {
    textTitle: (textRow?.title as string | undefined) ?? '스크립트',
    questions: rows.map(rowToQuestion),
  }
}
