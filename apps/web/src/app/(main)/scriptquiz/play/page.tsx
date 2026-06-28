// apps/web/src/app/(main)/scriptquiz/play/page.tsx
// ScriptQuiz 학습 세션 — hub(/scriptquiz)에서 진입
// query: ?ko=1 → 한국어 번역 보조 표시 · ?text={texts.id} → 그 스크립트의 실 퀴즈(quiz_questions)
// 문제 미생성/미지정 시 MOCK_SESSION 폴백(데모).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@vocaflow/types'

import { ScriptQuiz } from '@/components/game/scriptquiz/ScriptQuiz'
import type { QuizSession } from '@/components/game/scriptquiz/types'
import { ResourceContext } from '@/components/layout/ResourceContext'
import { fetchQuizSession } from '@/lib/scriptquiz/questions'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'ScriptQuiz · Vocaflow',
}

export default async function ScriptQuizPlayPage({
  searchParams,
}: {
  searchParams?: { ko?: string; text?: string }
}) {
  const showKorean = searchParams?.ko === '1'
  const textId = searchParams?.text

  let session: QuizSession | null = null
  if (textId) {
    const client = (await createClient()) as unknown as SupabaseClient<Database>
    const {
      data: { user },
    } = await client.auth.getUser()
    if (user) {
      session = await fetchQuizSession(client, user.id, textId)
    }
  }

  return (
    <>
      <ResourceContext
        resource={{
          type: 'script',
          label: session?.textTitle ?? 'The Great Gatsby (데모)',
          position: session ? `${session.questions.length}문제` : 'Chapter 1 · 5문제 (샘플)',
          href: '/text',
        }}
      />
      <ScriptQuiz showKorean={showKorean} textId={textId} session={session ?? undefined} />
    </>
  )
}
