// apps/web/src/app/(main)/library/stories/[releaseKey]/page.tsx
//
// LCP Story S5 — 판본 하나의 독서 화면. `?unit=N` 이 없으면 작품 입구(목차 · 내 진도 · 다음 행동 하나), 있으면 그 단위 본문.
// 계약: docs/LCP_STORY.md §12 · §13 · §15.
//
// ⚠️ 미들웨어는 `/library` 를 공개 접두사로 먼저 통과시킨다 — 이 화면의 보호는 상속되지 않는다. 그래서 loader 가 이 요청의
//   쿠키 세션 getUser + 계정 상태(suspended · deleted 차단 · 프로필 없음 허용)를 직접 확인한 뒤에만 학습자 RPC 를 부르고,
//   로그인 전에는 본문 · 목차 · 원문 앵커를 싣지 않는다. DB(story.require_learner)가 마지막 문으로 같은 판정을 다시 한다.
// - 이 화면의 렌더(GET · 새로 고침 · 프리페치)는 위치 · 완료를 기록하지 않는다. 기록은 화면 안 명시적 행동의 서버 액션뿐이다.
// - 원본 `/text/[id]` 레이아웃(원본 texts · 독서 · 어휘를 자동 활성화)을 쓰지 않는다.

import {
  recordStoryPositionAction,
  completeStoryUnitAction,
  saveStoryWordAction,
  loadStoryActivityAction,
  submitStoryActivityAction,
} from '../actions'
import { StoryReader } from '@/components/library/story/StoryReader'
import { Screen } from '@/components/ui/ios'
import { loadStoryReaderPage, type StoryLearnerClient } from '@/lib/library/story/learner'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export const metadata = {
  title: 'Stories',
  robots: { index: false },
}

/** 로그인 복귀 경로 — 형식이 맞는 값만 싣는다(나머지는 loader 가 거부하고 복귀도 서가 입구로). */
function returnPathOf(releaseKey: string, unit: string | string[] | undefined): string {
  if (!/^lsr_[0-9a-f]{32}$/.test(releaseKey)) return '/library/stories'
  const base = `/library/stories/${releaseKey}`
  return typeof unit === 'string' && /^(0|[1-9][0-9]{0,3})$/.test(unit) ? `${base}?unit=${unit}` : base
}

export default async function LibraryStoryReaderPage({
  params,
  searchParams,
}: {
  params: { releaseKey: string }
  searchParams?: { unit?: string | string[] }
}) {
  const releaseKey = params.releaseKey
  const unitParam = searchParams?.unit
  const client = (await createClient()) as unknown as StoryLearnerClient
  const state = await loadStoryReaderPage(
    { client },
    { releaseKey, unitParam, returnPath: returnPathOf(releaseKey, unitParam) },
  )

  return (
    <Screen width="wide" background="bg2" padX="md">
      {/* 발행본이 바뀌면 화면 상태(진행 중 요청 · 결과)를 이어 쓰지 않는다 — 판본마다 진도가 따로다. */}
      <StoryReader
        key={releaseKey}
        state={state}
        releaseKey={releaseKey}
        actions={{
          recordPosition: recordStoryPositionAction,
          completeUnit: completeStoryUnitAction,
          saveWord: saveStoryWordAction,
          loadActivity: loadStoryActivityAction,
          submitActivity: submitStoryActivityAction,
        }}
      />
    </Screen>
  )
}
