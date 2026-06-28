// apps/web/src/lib/recommend/use-next-action.ts
//
// 추천 client hook — 세션 종료 화면 등에서 mock 대신 실 추천 사용.
// 초기값은 cold-start 기본(서버 fetch 전 깜빡임 방지) → 마운트 시 server action 으로 실 추천 교체.
// getMockNextAction(useMemo) 1줄 대체용.

'use client'

import { useEffect, useState } from 'react'

import { decideNextAction } from './decide'
import { getNextActionForUser } from './get-next-action'
import type { RecommendedAction } from './types'

const INITIAL: RecommendedAction = decideNextAction({ masteryLevel: 'cold', urgentWordCount: 0 })

/** 실 사용자 추천 — 초기 cold 기본 후 server action 결과로 1회 교체. */
export function useNextAction(): RecommendedAction {
  const [action, setAction] = useState<RecommendedAction>(INITIAL)
  useEffect(() => {
    let active = true
    void getNextActionForUser()
      .then((a) => {
        if (active) setAction(a)
      })
      .catch(() => {
        /* 실패 시 cold 기본 유지 */
      })
    return () => {
      active = false
    }
  }, [])
  return action
}
