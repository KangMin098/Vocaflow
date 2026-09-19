// apps/web/src/lib/scriptquiz/grade-actions.ts
//
// ScriptQuiz 서버 채점 — **정답은 브라우저에 미리 가지 않는다.**
//
// ⚠️ 이 파일이 생긴 이유: `select_book_chapter_quiz` 가 `correct_index` · `source_snippet` 을
//    함께 돌려주고, 서버 페이지가 그것을 그대로 `'use client'` 컴포넌트 prop 으로 넘겨
//    **RSC 페이로드에 정답표가 실려 나갔다.** 채점도 브라우저가 했다
//    (`idx === currentQ.correctIndex`). 문항 재고 전체를 한 번의 Ctrl+U 로 버리는 구조였다.
//
//    같은 저장소의 DCP 는 이미 반대로 하고 있다 — `lib/learner/dcp-actions.ts` 의
//    "문항 테이블은 **열어서도 안 된다**". 그 모양에 맞춘다:
//      ① 화면에 내려가는 문항에는 정답이 없다(`QuizQuestion` 타입에서 제거).
//      ② 답을 받은 뒤 **그 문항 하나의** 정답·근거만 서버가 다시 읽어 판정해 돌려준다.
//
// ⚠️ **마이그레이션·RPC 변경 없이** 한다. RPC 응답은 서버가 받으므로 앱 계층에서 자르면 된다.
//    그래서 여기서는 같은 RPC 를 다시 부르되 **문항 하나만 골라** 내보낸다.
//
// ⚠️ 실패를 「오답」으로 번역하지 않는다(DCP `DcpGradeFailed` 와 같은 규칙) —
//    맞힌 학습자에게 틀렸다고 말하는 것이 조용한 오류보다 나쁘다.

'use server'

import type { SupabaseClient } from '@supabase/supabase-js'

import type { QuizSource } from '@/components/game/scriptquiz/types'
import { createClient } from '@/lib/supabase/server'

import { SAMPLE_ANSWERS } from './sample-answers'

export type ScriptQuizGrade =
  | {
      ok: true
      correct: boolean
      /** 정답 선지 인덱스 — 답한 뒤에야 내려간다 */
      correctIndex: number
      /** 스크립트 근거 문장. 없으면 빈 문자열 */
      sourceSnippet: string
    }
  | { ok: false; error: string }

/** `library_books.id` 는 uuid 다. 모양이 아니면 RPC 가 `invalid input syntax` 로 터진다. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

interface AnswerRow {
  id: string
  correct_index: number
  source_snippet: string | null
}

/**
 * 답 하나를 서버에서 채점한다.
 *
 * @param selectedIndex 학습자가 고른 선지. **시간 초과는 `-1`** — 그래도 정답·근거는 돌려준다
 *                      (틀린 채로 넘어가면서 정답을 못 보는 것이 이 화면의 원래 결함이었다).
 */
export async function gradeScriptQuizAnswer(
  source: QuizSource,
  questionId: string,
  selectedIndex: number,
): Promise<ScriptQuizGrade> {
  if (typeof questionId !== 'string' || !questionId) return { ok: false, error: '문항을 알 수 없어요.' }
  if (!Number.isInteger(selectedIndex)) return { ok: false, error: '선택을 읽지 못했어요.' }

  if (source.kind === 'sample') {
    const a = SAMPLE_ANSWERS[questionId]
    if (!a) return { ok: false, error: '샘플 문항을 찾지 못했어요.' }
    return {
      ok: true,
      correct: selectedIndex === a.correctIndex,
      correctIndex: a.correctIndex,
      sourceSnippet: a.sourceSnippet,
    }
  }

  const client = await createClient()

  if (source.kind === 'book') {
    if (!UUID.test(source.bookId) || !Number.isFinite(source.chapterIdx)) {
      return { ok: false, error: '이 챕터를 알 수 없어요.' }
    }
    // client.rpc 를 변수로 떼어내면 this 바인딩이 풀려 호출 시 throw — bind 필수
    const rpc = client.rpc.bind(client) as unknown as (
      fn: string,
      args?: Record<string, unknown>,
    ) => Promise<{ data: unknown; error: { message: string } | null }>
    const { data, error } = await rpc('select_book_chapter_quiz', {
      p_book_id: source.bookId,
      p_chapter_idx: source.chapterIdx,
    })
    if (error) return { ok: false, error: error.message }
    const row = (Array.isArray(data) ? (data as unknown as AnswerRow[]) : []).find((r) => r.id === questionId)
    if (!row) return { ok: false, error: '이 문항을 찾지 못했어요.' }
    return toGrade(row, selectedIndex)
  }

  // 개인 퀴즈 — `quiz_questions` 는 RLS 로 본인 행만 열린다. 그래도 user_id 를 명시해
  // "누구의 문항인가" 를 코드에도 남긴다(정책이 느슨해져도 남의 정답이 안 나가게).
  const {
    data: { user },
  } = await client.auth.getUser()
  if (!user) return { ok: false, error: '로그인이 풀렸어요.' }

  const loose = client as unknown as SupabaseClient
  const { data, error } = await loose
    .from('quiz_questions')
    .select('id, correct_index, source_snippet')
    .eq('user_id', user.id)
    .eq('text_id', source.textId)
    .eq('id', questionId)
    .maybeSingle()
  if (error) return { ok: false, error: error.message }
  if (!data) return { ok: false, error: '이 문항을 찾지 못했어요.' }
  return toGrade(data as unknown as AnswerRow, selectedIndex)
}

function toGrade(row: AnswerRow, selectedIndex: number): ScriptQuizGrade {
  if (typeof row.correct_index !== 'number') return { ok: false, error: '이 문항에는 정답이 등록돼 있지 않아요.' }
  return {
    ok: true,
    correct: selectedIndex === row.correct_index,
    correctIndex: row.correct_index,
    sourceSnippet: row.source_snippet ?? '',
  }
}
