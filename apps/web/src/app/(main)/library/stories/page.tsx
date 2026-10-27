// apps/web/src/app/(main)/library/stories/page.tsx
//
// LCP Story S5 — 이야기 서가(공개). 작품 단위로 묶고 HOOK(스포일러 없는 진입 장면)을 먼저 보인 뒤 판본을 고르게 한다.
// 계약: docs/LCP_STORY.md §12 · §15 · §17. 원본 Books 라인과 별개다(원본 표 · texts · 등록 경로를 쓰지 않는다).
//
// - 서가 메타는 `story_catalog`(anon 실행 가능) — 본문이 없다. 로그인 학습자는 자기 진도(`story_my_progress`)를 함께 받는다.
// - 판정 · RPC · 응답 검사는 lib/library/story/learner.ts 가 한다. 이 파일은 쿠키 클라이언트를 넘기는 얇은 배선이다.
// - 조회 실패는 빈 서가로 바꾸지 않는다(loader 가 status 'error' 를 준다).
// - 사용자별 진도가 섞이므로 캐시하지 않는다.

import { StoryCatalog } from '@/components/library/story/StoryCatalog'
import { LibraryBrowseFrame } from '@/components/library/LibraryBrowseFrame'
import { loadStoryCatalogPage, type StoryLearnerClient } from '@/lib/library/story/learner'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Stories',
  description: '작품 단위로 고르는 이야기 판본',
}

export default async function LibraryStoriesPage() {
  const client = (await createClient()) as unknown as StoryLearnerClient
  const state = await loadStoryCatalogPage({ client })

  return (
    <LibraryBrowseFrame>
      {/* 로그인 복귀는 판본마다 그 판본 입구로(StoryCatalog 가 loginUrlWithReturn 으로 만든다 — D4-UX01). */}
      <StoryCatalog state={state} />
    </LibraryBrowseFrame>
  )
}
