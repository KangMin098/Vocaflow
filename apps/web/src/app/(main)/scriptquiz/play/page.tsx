// apps/web/src/app/(main)/scriptquiz/play/page.tsx
// ScriptQuiz 학습 세션 — hub(/scriptquiz)에서 진입
// query:
//   ?ko=1                         → 한국어 번역 보조 표시
//   ?book={library_books.id}&ch=N → 큐레이션 챕터 퀴즈(공유 · library_chapter_quiz) — 기본 경로
//   ?text={texts.id}              → 그 스크립트의 개인 퀴즈(quiz_questions) — 개인 생성분
// 문제 미생성/미지정 시 MOCK_SESSION 폴백(데모).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@vocaflow/types'

import { ScriptQuiz } from '@/components/game/scriptquiz/ScriptQuiz'
import type { QuizSession } from '@/components/game/scriptquiz/types'
import { ResourceContext } from '@/components/layout/ResourceContext'
import { fetchChapterQuizSession, fetchQuizSession } from '@/lib/scriptquiz/questions'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'ScriptQuiz 진행',
}

export default async function ScriptQuizPlayPage({
  searchParams,
}: {
  searchParams?: { ko?: string; text?: string; book?: string; ch?: string }
}) {
  const showKorean = searchParams?.ko === '1'
  const textId = searchParams?.text
  const bookId = searchParams?.book
  const chapterIdx = searchParams?.ch ? Number.parseInt(searchParams.ch, 10) : NaN

  let session: QuizSession | null = null

  if (bookId && Number.isFinite(chapterIdx)) {
    // 큐레이션 챕터 퀴즈 — 공유(비로그인 게이트는 미들웨어). RPC 는 SECURITY DEFINER.
    const client = (await createClient()) as unknown as SupabaseClient<Database>
    session = await fetchChapterQuizSession(client, bookId, chapterIdx)
  } else if (textId) {
    // 개인 스크립트 퀴즈 (quiz_questions · per user+text)
    const client = (await createClient()) as unknown as SupabaseClient<Database>
    const {
      data: { user },
    } = await client.auth.getUser()
    if (user) {
      session = await fetchQuizSession(client, user.id, textId)
    }
  }

  // 도서 챕터 퀴즈의 "본문으로"는 library_books.id → 도서 리더(enroll 시 자동 resume, 미enroll 시 미리보기).
  //   기존 `/text/${bookId}` 는 texts.id 가 아니라 book id 를 넘겨 조회 실패→mock 폴백이던 버그(v06.215).
  const chapterHref =
    bookId && Number.isFinite(chapterIdx) ? `/library/books/${bookId}` : '/text'

  return (
    <>
      <ResourceContext
        resource={{
          type: 'script',
          label: session
            ? session.textChapter
              ? `${session.textTitle} · ${session.textChapter}`
              : session.textTitle
            : 'The Great Gatsby (데모)',
          position: session ? `${session.questions.length}문제` : 'Chapter 1 · 5문제 (샘플)',
          href: chapterHref,
        }}
      />
      <ScriptQuiz showKorean={showKorean} textId={textId} session={session ?? undefined} />
    </>
  )
}
