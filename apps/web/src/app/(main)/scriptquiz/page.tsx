// apps/web/src/app/(main)/scriptquiz/page.tsx
// ScriptQuiz Hub (server) — 큐레이션 챕터 퀴즈 카탈로그 fetch → 클라이언트 선택 UI
// 문제 생성은 런타임 AI 미사용 — LCP 큐레이션 드레인(Claude Code)이 library_chapter_quiz 를 채운다.
// 본 페이지는 read + 선택만. 세부 인터랙션은 ScriptQuizHub(client).

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@vocaflow/types'

import { ScriptQuizHub } from '@/components/game/scriptquiz/ScriptQuizHub'
import { fetchChapterQuizCatalog, type ChapterQuizCatalogBook } from '@/lib/scriptquiz/questions'
import { createClient } from '@/lib/supabase/server'

export const metadata = {
  title: 'ScriptQuiz · Vocaflow',
}

export default async function ScriptQuizHubPage() {
  const client = (await createClient()) as unknown as SupabaseClient<Database>

  let catalog: ChapterQuizCatalogBook[] = []
  try {
    catalog = await fetchChapterQuizCatalog(client)
  } catch (e) {
    // 카탈로그 조회 실패 — 빈 상태 폴백하되 원인은 로그로 남김 (침묵 삼킴 금지)
    console.warn('[scriptquiz] catalog fetch failed:', e instanceof Error ? e.message : e)
    catalog = []
  }

  return <ScriptQuizHub catalog={catalog} />
}
