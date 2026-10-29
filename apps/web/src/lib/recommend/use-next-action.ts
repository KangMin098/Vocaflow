// apps/web/src/lib/recommend/use-next-action.ts
//
// 추천 client hook — 세션 종료 화면 등에서 mock 대신 실 추천 사용.
// 초기값은 cold-start 기본(서버 fetch 전 깜빡임 방지) → 마운트 시 server action 으로 실 추천 교체.
// getMockNextAction(useMemo) 1줄 대체용.
//
// ⚠️ 개인 글(P2 — 제목 · textId)은 **그 추천을 만든 계정과 지금 브라우저 신원이 같다고 확인된 때만** 그린다(useStoryAuthGuard).
//   확인 중 · 바뀜 · 로그아웃 · 계정이 바뀐 뒤 도착한 앞 계정의 응답이면 개인 글 없이 결정한 추천(fallback)을 쓴다.

'use client'

import { useEffect, useState } from 'react'

import { useStoryAuthGuard, type StoryAuthStatus } from '@/components/library/story/use-story-auth-guard'

import { decideNextAction } from './decide'
import { getNextActionForUser } from './get-next-action'
import type { OwnedNextAction, RecommendedAction } from './types'

// 서버 응답 전 · 응답 실패 — 기존 cold 결정(같은 목적지 · 라벨)이되 근거는 확인 전이다
const INITIAL: RecommendedAction = { ...decideNextAction({ masteryLevel: 'cold', urgentWordCount: 0 }), reason: 'unconfirmed' }

/** 화면에 그릴 추천 — 개인 글은 신원이 같을 때만(순수 · 테스트가 잠근다). */
export function visibleNextAction(res: OwnedNextAction | null, identity: StoryAuthStatus): RecommendedAction {
  if (!res) return INITIAL
  if (!res.personal) return res.action
  return identity === 'same' && res.ownerId ? res.action : res.fallback
}

/** 실 사용자 추천 — 초기 cold 기본 후 server action 결과로 1회 교체. `load` 는 개발 확인 화면만 바꾼다(기본 = 실제 server action). */
export function useNextAction(load: () => Promise<OwnedNextAction> = getNextActionForUser): RecommendedAction {
  const [res, setRes] = useState<OwnedNextAction | null>(null)
  useEffect(() => {
    let active = true
    void load()
      .then((a) => {
        if (active) setRes(a)
      })
      .catch(() => {
        /* 실패 시 cold 기본 유지 */
      })
    return () => {
      active = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 마운트 때 한 번만(예전과 같다)
  }, [])
  const { status } = useStoryAuthGuard(res?.ownerId ?? null)
  return visibleNextAction(res, status)
}
