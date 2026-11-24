// apps/web/src/components/game/GameViewerGate.tsx
'use client'

/**
 * 연습 화면의 계정 경계(서버 컴포넌트에서 감싸 쓰는 판) — 서버가 단어를 읽은 사람(`viewerId` · 로그인 없음 = null)과
 * 브라우저 신원이 긍정 확인(same)으로 같을 때만 children(개인 단어 · 자료 제목 · 입력)을 그린다. 아니면 GameIdentityNotice.
 * 화면 경계일 뿐이다 — 내려간 뒤 남은 옛 콜백은 각 컴포넌트가 실행 시점에 다시 본다(예: SpellForge ownsSession).
 */
import type { ReactNode } from 'react'

import { GameIdentityNotice } from '@/components/game/GameIdentityNotice'
import { useStoryAuthGuard, type StoryAuthSource } from '@/components/library/story/use-story-auth-guard'

export function GameViewerGate({
  viewerId,
  reopenHref,
  authSource,
  children,
}: {
  viewerId: string | null
  reopenHref?: string
  /** 시험 · 하네스 주입(없으면 StoryAuthSourceContext → 실제 브라우저 세션) */
  authSource?: StoryAuthSource
  children: ReactNode
}) {
  const { status } = useStoryAuthGuard(viewerId, authSource)
  if (status !== 'same') return <GameIdentityNotice status={status} reopenHref={reopenHref} />
  return <>{children}</>
}
