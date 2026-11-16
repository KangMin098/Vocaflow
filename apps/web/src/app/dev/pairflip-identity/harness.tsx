// apps/web/src/app/dev/pairflip-identity/harness.tsx
// 합성 자료 — 개인 데이터 아님 · 서버 기록 없음. 짝 단어를 A(합성 uid)가 읽었다고 두고 브라우저 신원을 버튼으로 바꾼다.
// 신원을 바꿀 때 실제 앱의 flush-session 처럼 전역 대기열 주인(setSrsQueueOwner)도 함께 바꾼다.
// 점수는 대역이 「누구 몫으로 · 몇 쌍」 보내려 했는지만 적는다. 대기열 표시는 합성 주인(A/B) · 합성 단어로 한정한다.
'use client'

import { useEffect, useMemo, useState } from 'react'
import { PairFlipGameScreen } from '@/components/pairflip/PairFlipGameScreen'
import type { StoryAuthChange, StoryAuthSource } from '@/components/library/story/use-story-auth-guard'
import { getSrsQueueOwner, setSrsQueueOwner } from '@/lib/srs/session-storage'
import type { recordGameScore } from '@/lib/scores/record-score'
import type { PairFlipMockWord } from '@/components/pairflip/mock-data'

const A = 'harness-pf-a'
const B = 'harness-pf-b'
// 합성 짝 5쌍(normal 레벨 pairCount) — 실 페어 경로(usingReal)를 탄다
const PAIRS: PairFlipMockWord[] = [
  { pairId: 'p1', word: 'harvest', meaning: '수확' },
  { pairId: 'p2', word: 'drought', meaning: '가뭄' },
  { pairId: 'p3', word: 'flooding', meaning: '홍수' },
  { pairId: 'p4', word: 'satellite', meaning: '위성' },
  { pairId: 'p5', word: 'glacier', meaning: '빙하' },
]
const WORDS = new Set(PAIRS.map((p) => p.word))

function makeSource(start: string | null, slowMs: number) {
  let calls = 0
  let uid: string | null = start
  const listeners = new Set<(c: StoryAuthChange) => void>()
  const source: StoryAuthSource = {
    subscribe(l) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    // 첫 기준선은 바로, 재확인(BFCache 복원 등)은 slowMs 뒤 — 확인 중 동안의 입력을 시험한다
    currentUserId: () => {
      const at = uid
      calls += 1
      return new Promise((r) => setTimeout(() => r(at), calls > 1 ? slowMs : 0))
    },
  }
  const emit = (event: string, next: string | null) => {
    uid = next
    for (const l of listeners) l({ event, userId: next })
  }
  return { source, emit, current: () => uid }
}

function readQueue(): string {
  try {
    return (JSON.parse(localStorage.getItem('srs_pending') ?? '[]') as { owner?: string; word: string }[])
      .filter((p) => WORDS.has(p.word) && (p.owner === A || p.owner === B))
      .map((p) => `${p.owner}:${p.word}`)
      .join(',')
  } catch {
    return ''
  }
}

export function PairFlipIdentityHarness({ browserB, slowMs }: { browserB: boolean; slowMs: number }) {
  const { source, emit, current } = useMemo(() => makeSource(browserB ? B : A, slowMs), [browserB, slowMs])
  const [mounted, setMounted] = useState(true)
  const [scores, setScores] = useState<string[]>([])
  const [queue, setQueue] = useState('')

  useEffect(() => {
    // 실제 주인 해석기는 진짜 브라우저 세션(여기선 로그인 없음 → null)을 따른다 — 하네스는 주입 신원을 따르게 맞춘다
    const t = window.setInterval(() => {
      if (getSrsQueueOwner() !== current()) setSrsQueueOwner(current())
      setQueue(readQueue())
    }, 150)
    return () => window.clearInterval(t)
  }, [current])

  const recordScoreImpl = (async (input) => {
    setScores((s) => [...s, `score:${input.expectedUserId ?? 'null'}:${input.correctCount}${input.metadata?.partial ? ':partial' : ''}`])
  }) as typeof recordGameScore

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--bd)] bg-[var(--bg)] px-6 py-3 font-display text-[13px] text-[var(--t2)]">
        <span>합성 자료 · 개인 데이터 아님 · 서버 기록 없음(대역)</span>
        <span>
          점수 <span data-testid="pf-scores">{scores.join(',')}</span> · 대기열 <span data-testid="pf-queue">{queue}</span>
        </span>
        <button type="button" data-testid="pf-to-b" className="min-h-[44px] rounded border border-[var(--bd)] px-3" onClick={() => emit('SIGNED_IN', B)}>
          다른 탭에서 B 로그인
        </button>
        <button type="button" data-testid="pf-to-a" className="min-h-[44px] rounded border border-[var(--bd)] px-3" onClick={() => emit('SIGNED_IN', A)}>
          A 로 다시 로그인
        </button>
        <button type="button" data-testid="pf-refresh-a" className="min-h-[44px] rounded border border-[var(--bd)] px-3" onClick={() => emit('TOKEN_REFRESHED', A)}>
          A 토큰 갱신
        </button>
        <button type="button" data-testid="pf-leave" className="min-h-[44px] rounded border border-[var(--bd)] px-3" onClick={() => setMounted(false)}>
          판 떠나기(언마운트)
        </button>
      </div>
      {mounted && (
        <PairFlipGameScreen
          config={{ level: 'normal', mode: 'word_meaning' }}
          pairs={PAIRS}
          viewerId={A}
          authSource={source}
          recordScoreImpl={recordScoreImpl}
        />
      )}
    </div>
  )
}
