// apps/web/src/app/dev/pairflip-results/harness.tsx
// 합성 결과 — 개인 데이터 아님. owner=a|none(로그인 없이 한 판)|legacy(주인 미상) · browser=a|b 로 저장 주인과 브라우저 신원을 고른다.
'use client'

import { useMemo } from 'react'
import { PairFlipResultsGate, type StoredResult } from '@/components/pairflip/PairFlipResultsGate'
import type { StoryAuthChange, StoryAuthSource } from '@/components/library/story/use-story-auth-guard'

const A = 'harness-pfr-a'
const B = 'harness-pfr-b'

const BASE: StoredResult = {
  level: 'normal',
  mode: 'word_meaning',
  totalPairs: 1,
  matchedPairs: 1,
  totalAttempts: 1,
  maxCombo: 1,
  hintsUsed: 0,
  score: 100,
  durationMs: 30000,
  phase: 'won',
  pairResults: [{ pairId: 'p1', word: 'priorownerprivateword', meaning: '이전 주인 단어', matchedAt: 0, attempts: 1, fsrsRating: 3 }],
} as unknown as StoredResult

function makeSource(start: string | null, slowMs: number) {
  let uid: string | null = start
  let armed = false
  if (typeof window !== 'undefined')
    window.addEventListener('pageshow', (e) => {
      if (e.persisted) armed = true
    })
  const listeners = new Set<(c: StoryAuthChange) => void>()
  const source: StoryAuthSource = {
    subscribe(l) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    currentUserId: () => {
      const at = uid
      return new Promise((r) => setTimeout(() => r(at), armed ? slowMs : 0))
    },
  }
  const emit = (event: string, next: string | null) => {
    uid = next
    for (const l of listeners) l({ event, userId: next })
  }
  return { source, emit }
}

export function PairFlipResultsHarness({ owner, browser, slowMs }: { owner: string; browser: string; slowMs: number }) {
  const { source, emit } = useMemo(() => makeSource(browser === 'b' ? B : browser === 'none' ? null : A, slowMs), [browser, slowMs])
  const stored = useMemo<StoredResult>(() => (owner === 'legacy' ? BASE : { ...BASE, owner: owner === 'none' ? null : A }), [owner])
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--bd)] bg-[var(--bg)] px-6 py-3 font-display text-[13px] text-[var(--t2)]">
        <span>
          합성 결과 · 개인 데이터 아님 · owner={owner} browser={browser}
        </span>
        <button type="button" data-testid="pfr-to-b" className="min-h-[44px] rounded border border-[var(--bd)] px-3" onClick={() => emit('SIGNED_IN', B)}>
          다른 탭에서 B 로그인
        </button>
        <button type="button" data-testid="pfr-signout" className="min-h-[44px] rounded border border-[var(--bd)] px-3" onClick={() => emit('SIGNED_OUT', null)}>
          로그아웃
        </button>
        <button type="button" data-testid="pfr-to-a" className="min-h-[44px] rounded border border-[var(--bd)] px-3" onClick={() => emit('SIGNED_IN', A)}>
          A 로 다시 로그인
        </button>
      </div>
      <PairFlipResultsGate stored={stored} authSource={source} />
    </div>
  )
}
