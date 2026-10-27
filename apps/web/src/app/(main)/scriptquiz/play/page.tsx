// apps/web/src/app/(main)/scriptquiz/play/page.tsx
// ScriptQuiz 학습 세션 — hub(/scriptquiz)에서 진입
// query:
//   ?ko=1                         → 한국어 번역 보조 표시
//   ?book={library_books.id}&ch=N → 큐레이션 챕터 퀴즈(공유 · library_chapter_quiz) — 기본 경로
//   ?text={texts.id}              → 그 스크립트의 개인 퀴즈(quiz_questions) — 개인 생성분
//   ?book=&ch=&text={texts.id}   → 챕터 퀴즈 + 본인이 읽던 그 챕터 본문(근거 문장 짚기, T-0193)
// 범위(book·ch 또는 text)를 주었는데 문항이 없으면 데모 대신 빈 상태. 아무 범위도 없으면 MOCK_SESSION(데모).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@vocaflow/types'

import { ScriptQuiz } from '@/components/game/scriptquiz/ScriptQuiz'
import type { QuizSession } from '@/components/game/scriptquiz/types'
import Link from 'next/link'

import { ResourceContext } from '@/components/layout/ResourceContext'
import { getChapterContent } from '@/lib/library/content-storage'
import { parseQuizScope, quizPageMode, readOwnPassage, type OwnPassageDeps } from '@/lib/scriptquiz/own-passage'
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
  const scope = parseQuizScope({ book: searchParams?.book, ch: searchParams?.ch, text: searchParams?.text })
  const textId = scope.kind === 'text' ? scope.textId : scope.kind === 'book' ? scope.textId : undefined
  const bookId = scope.kind === 'book' ? scope.bookId : undefined
  const chapterIdx = scope.kind === 'book' ? scope.chapterIdx : NaN

  let session: QuizSession | null = null
  let passageText: string | undefined
  const isBookPath = scope.kind === 'book'

  if (scope.kind === 'book') {
    // 큐레이션 챕터 퀴즈 — 공유(비로그인 게이트는 미들웨어). RPC 는 SECURITY DEFINER.
    const client = (await createClient()) as unknown as SupabaseClient<Database>
    session = await fetchChapterQuizSession(client, scope.bookId, scope.chapterIdx)
    if (session && scope.textId)
      passageText = await readOwnPassage(ownPassageDeps(client), scope.textId, { bookId: scope.bookId, chapterIdx: scope.chapterIdx })
  } else if (scope.kind === 'text') {
    // 개인 스크립트 퀴즈 (quiz_questions · per user+text)
    const client = (await createClient()) as unknown as SupabaseClient<Database>
    const {
      data: { user },
    } = await client.auth.getUser()
    if (user) {
      session = await fetchQuizSession(client, user.id, scope.textId)
      if (session) passageText = await readOwnPassage(ownPassageDeps(client), scope.textId, null)
    }
  }

  const scoped = scope.kind !== 'none'
  const invalidScope = scope.kind === 'invalid'
  const backHref = textId ? `/text/${textId}` : isBookPath ? `/library/books/${bookId}` : '/scriptquiz'
  if (quizPageMode(scoped, session !== null) === 'empty') {
    return (
      <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-start justify-center gap-4 px-6 py-16">
        <h1 className="break-keep font-display text-[20px] font-[700] text-[var(--t1)]">
          {invalidScope ? '어느 글의 퀴즈인지 확인할 수 없어요' : '이 글에는 아직 퀴즈가 없어요'}
        </h1>
        <p className="break-keep font-body text-[14px] leading-relaxed text-[var(--t2)]">
          {invalidScope
            ? '주소의 글·장 정보가 올바르지 않아요. 다른 글이나 다른 장으로 바꿔 보여 주지 않아요.'
            : '만들어진 문항이 없어서 문제를 보여 줄 수 없어요. 다른 글로 바꿔 보여 주지 않아요.'}
        </p>
        <div className="flex gap-3">
          {backHref !== '/scriptquiz' && (
            <Link href={backHref} className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] bg-[var(--p)] px-4 font-display text-[13px] font-[600] text-[var(--on-p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]">
              읽던 곳으로
            </Link>
          )}
          <Link href="/scriptquiz" className="inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border border-[var(--bd)] px-4 font-display text-[13px] font-[600] text-[var(--t1)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]">
            다른 퀴즈 고르기
          </Link>
        </div>
      </main>
    )
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
      {/* textId 는 점수 기록의 texts FK 로도 쓰인다 — 도서 챕터 경로는 예전처럼 비워 둔다(content_ref 로 귀속). */}
      <ScriptQuiz
        showKorean={showKorean}
        textId={isBookPath ? undefined : textId}
        session={session ?? undefined}
        passageText={passageText}
      />
    </>
  )
}

function ownPassageDeps(client: SupabaseClient<Database>): OwnPassageDeps {
  const loose = client as unknown as SupabaseClient
  return {
    currentUserId: async () => (await client.auth.getUser()).data.user?.id ?? null,
    findOwnText: async (textId, userId) => {
      const { data, error } = await loose
        .from('texts')
        .select('library_book_id, chapter_idx')
        .eq('id', textId)
        .eq('user_id', userId)
        .maybeSingle()
      if (error) throw error
      return (data as { library_book_id: string | null; chapter_idx: number | null } | null) ?? null
    },
    readContent: (textId) => getChapterContent(loose, textId),
  }
}
