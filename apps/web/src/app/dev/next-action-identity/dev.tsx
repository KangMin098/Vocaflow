// apps/web/src/app/dev/next-action-identity/dev.tsx
'use client'

import { useMemo, useState } from 'react'

import { NextActionCard } from '@/components/recommend/NextActionCard'
import { StoryAuthSourceContext, type StoryAuthChange, type StoryAuthSource } from '@/components/library/story/use-story-auth-guard'
import { useNextAction } from '@/lib/recommend/use-next-action'
import type { OwnedNextAction } from '@/lib/recommend/types'

const A = 'dev-user-a'
const B = 'dev-user-b'

/** 합성 서버 응답 — 계정 A 의 개인 글 추천(개인 글이 없을 때의 추천을 함께 싣는다). */
const A_RESULT: OwnedNextAction = {
  action: { module: 'workspace', label: 'My Garden Essay 이어 보기', textId: 'dev-text-a', reason: 'resume_text' },
  fallback: { module: 'spellforge', strategy: 'hybrid', label: '단어를 정확하게 — 철자로 다지기', reason: 'practice_flow' },
  personal: true,
  ownerId: A,
}

/** 조작 가능한 브라우저 신원 — 구독자에게 계정 전환 · 로그아웃을 보낸다. */
function controllableSource(initial: string | null) {
  let uid = initial
  const listeners = new Set<(c: StoryAuthChange) => void>()
  const source: StoryAuthSource = {
    subscribe: (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    currentUserId: async () => uid,
  }
  const set = (next: string | null) => {
    uid = next
    for (const l of listeners) l({ event: next ? 'SIGNED_IN' : 'SIGNED_OUT', userId: next })
  }
  return { source, set }
}

function Card({ delayMs }: { delayMs: number }) {
  const rec = useNextAction(() => new Promise((r) => setTimeout(() => r(A_RESULT), delayMs)))
  return <NextActionCard recommendation={rec} />
}

export function NextActionIdentityDev() {
  // ?start=b 면 처음부터 B 로 시작 — A 의 응답이 B 화면에 도착하는 경우 · ?delay=ms 로 응답 지연
  const params = typeof window === 'undefined' ? new URLSearchParams() : new URLSearchParams(window.location.search)
  const start = params.get('start') === 'b' ? B : A
  const delayMs = Number(params.get('delay') ?? 50)
  const ctl = useMemo(() => controllableSource(start), [start])
  const [, force] = useState(0)
  return (
    <StoryAuthSourceContext.Provider value={ctl.source}>
      <div className="mb-4 flex gap-2">
        <button type="button" data-testid="as-b" className="min-h-[44px] rounded-[var(--r-md)] border border-[var(--bd)] px-3 font-display text-[12.5px]" onClick={() => { ctl.set(B); force((n) => n + 1) }}>
          다른 계정(B)으로 전환
        </button>
        <button type="button" data-testid="sign-out" className="min-h-[44px] rounded-[var(--r-md)] border border-[var(--bd)] px-3 font-display text-[12.5px]" onClick={() => { ctl.set(null); force((n) => n + 1) }}>
          로그아웃
        </button>
      </div>
      <Card delayMs={Number.isFinite(delayMs) ? delayMs : 50} />
    </StoryAuthSourceContext.Provider>
  )
}
