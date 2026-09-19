// apps/web/src/app/(main)/scriptquiz/page.tsx
// @form: 망각 — 읽은 챕터 장부: 읽고 오래된 챕터부터, 확인 안 한 챕터에 권점
//
// ScriptQuiz 진입면 (server) — **읽은 것의 확인 대기열**.
// 이전에는 퀴즈가 있는 챕터 129개를 전부 나열했고, 그중 41개는 학습자가 아직 읽지 않은
// 챕터라 풀면 줄거리가 새어 나갔다. 근거와 재설계 내역은 `lib/scriptquiz/queue.ts` 머리말.
//
// 문제 생성은 런타임 AI 미사용 — LCP 큐레이션 드레인(Claude Code)이 library_chapter_quiz 를 채운다.

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@vocaflow/types'

import { ScriptQuizQueue, type CatalogSample } from '@/components/game/scriptquiz/ScriptQuizQueue'
import { Screen } from '@/components/ui/ios'
import { fetchChapterQuizCatalog } from '@/lib/scriptquiz/questions'
import { fetchScriptQuizQueue, type QuizQueue } from '@/lib/scriptquiz/queue'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'ScriptQuiz — 읽은 것 확인하기',
  description: '읽은 챕터의 이해를 확인하세요',
}

const EMPTY: QuizQueue = { books: [], next: null, unconfirmed: 0, readTotal: 0 }

export default async function ScriptQuizHubPage() {
  const client = (await createClient()) as unknown as SupabaseClient<Database>
  const {
    data: { user },
  } = await client.auth.getUser()

  let queue: QuizQueue = EMPTY
  let hasCatalog = false
  /** 퀴즈가 준비된 책 몇 권 — 아직 읽은 챕터가 없을 때 "무엇을 읽으면 여기에 쌓이나" 를 실제 목록으로(수정 1회차) */
  let catalogSample: CatalogSample[] = []
  try {
    // 카탈로그 유무는 빈 상태 문구를 가른다 — "내가 안 읽었다" 와 "아직 안 만들어졌다" 는
    // 학습자가 해야 할 일이 정반대다(읽으러 가기 vs 기다리기).
    const [q, catalog] = await Promise.all([
      fetchScriptQuizQueue(client, user?.id ?? null),
      fetchChapterQuizCatalog(client),
    ])
    queue = q
    hasCatalog = catalog.length > 0
    catalogSample = catalog.slice(0, 5).map((b) => ({
      bookId: b.bookId,
      bookTitle: b.bookTitle,
      chapters: b.chapters.length,
      questions: b.questionTotal,
    }))
  } catch (e) {
    // 조회 실패 — 빈 상태로 degrade 하되 원인은 남긴다(침묵 삼킴 금지)
    console.warn('[scriptquiz] queue fetch failed:', e instanceof Error ? e.message : e)
  }

  return (
    <Screen width="content" background="bg" padX="md">
      <ScriptQuizQueue queue={queue} hasCatalog={hasCatalog} catalogSample={catalogSample} />
    </Screen>
  )
}
