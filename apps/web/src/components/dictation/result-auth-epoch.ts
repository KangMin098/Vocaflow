// apps/web/src/components/dictation/result-auth-epoch.ts
//
// T-0254 리뷰 P1 — 받아쓰기 결과 조회를 「요청을 시작할 때의 브라우저 인증 세대」에 묶는다.
// 세대는 단조 증가한다: 관측한 신원이 바뀔 때마다 +1(A→B→A 는 +2 — 같은 계정으로 돌아와도 다른 세대다).
// 응답은 반영 직전에 세대가 시작 때와 정확히 같을 때만 받는다(처음 조회 · 다시 불러오기 모두). 같은 사람의 토큰 갱신은 세대를 바꾸지 않는다.

'use client'

import { useContext, useEffect, useRef, useState } from 'react'

import { StoryAuthSourceContext, browserStoryAuthSource, type StoryAuthChange, type StoryAuthSource } from '@/components/library/story/use-story-auth-guard'

/** 관측한 신원의 변화를 세는 세대(순수) — 첫 관측은 기준선일 뿐 세대를 올리지 않는다. */
export class ResultAuthEpoch {
  gen = 0
  private last: string | null | undefined = undefined
  observe(change: StoryAuthChange): boolean {
    const userId = change.event === 'SIGNED_OUT' ? null : change.userId
    const changed = this.last !== undefined && userId !== this.last
    this.last = userId
    if (changed) this.gen += 1
    return changed
  }
}

/** 시작 때 잡은 세대의 응답을 지금 받아도 되는가 — 정확히 같을 때만. */
export function acceptsAtEpoch(startedGen: number, epoch: Pick<ResultAuthEpoch, 'gen'>): boolean {
  return startedGen === epoch.gen
}

/** 결과 화면이 쓰는 인증 세대 — ref(응답 반영 직전 동기 확인용)와 세대 값(바뀌면 조회를 새로 시작하는 effect 의존성). */
export function useResultAuthEpoch(source?: StoryAuthSource): { epochRef: { current: ResultAuthEpoch }; gen: number } {
  const fromContext = useContext(StoryAuthSourceContext)
  const injected = source ?? fromContext
  const epochRef = useRef(new ResultAuthEpoch())
  const [gen, setGen] = useState(0)
  useEffect(() => {
    const src = injected ?? browserStoryAuthSource()
    const epoch = epochRef.current
    const off = src.subscribe((change) => {
      if (epoch.observe(change)) setGen(epoch.gen)
    })
    void src.currentUserId().then(
      (userId) => {
        if (epoch.observe({ event: 'BASELINE', userId })) setGen(epoch.gen)
      },
      () => {},
    )
    return off
  }, [injected])
  return { epochRef, gen }
}
