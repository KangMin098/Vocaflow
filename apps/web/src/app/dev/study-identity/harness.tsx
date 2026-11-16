// apps/web/src/app/dev/study-identity/harness.tsx
// 합성 자료 — 개인 데이터 아님 · 서버 기록 없음. 서버가 A(합성 uid) 의 단어로 그렸다고 두고 브라우저 신원을 버튼으로 바꾼다.
// 신원을 바꿀 때 실제 앱의 flush-session 처럼 전역 대기열 주인(setSrsQueueOwner)도 함께 바꾼다. 대기열 표시는 합성 주인 · 합성 단어로 한정한다.
'use client'

import { useEffect, useMemo, useState } from 'react'
import { WordVaultViewerGate } from '@/components/wordvault/WordVaultBrowseClient'
import { StudyMode } from '@/components/wordvault/StudyMode'
import type { StoryAuthChange, StoryAuthSource } from '@/components/library/story/use-story-auth-guard'
import { getSrsQueueOwner, setSrsQueueOwner } from '@/lib/srs/session-storage'
import type { WordItem } from '@/components/wordvault/types'

const A = 'harness-study-a'
const B = 'harness-study-b'
function word(id: number, w: string, meaning: string): WordItem {
  return { id, word: w, pos: 'n.', meaning, exampleEn: `The ${w} was large.`, level: 'B1', levelClass: 'b', mastery: 1, lastDays: 0, nextDays: 0 }
}
const WORDS = [word(1, 'harvest', '수확'), word(2, 'drought', '가뭄'), word(3, 'flooding', '홍수')]
const NAMES = new Set(WORDS.map((w) => w.word))

function makeSource(start: string | null, slowMs: number) {
  let uid: string | null = start
  // 재확인(BFCache 복원 pageshow) 뒤의 기준선만 늦춘다 — 개발 모드 이중 마운트로 첫 확인 횟수가 달라져도 흔들리지 않게
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
  return { source, emit, current: () => uid }
}

function readQueue(): string {
  try {
    return (JSON.parse(localStorage.getItem('srs_pending') ?? '[]') as { owner?: string; word: string }[])
      .filter((p) => NAMES.has(p.word) && (p.owner === A || p.owner === B))
      .map((p) => `${p.owner}:${p.word}`)
      .join(',')
  } catch {
    return ''
  }
}

export function StudyIdentityHarness({ browserB, slowMs }: { browserB: boolean; slowMs: number }) {
  const { source, emit, current } = useMemo(() => makeSource(browserB ? B : A, slowMs), [browserB, slowMs])
  const [queue, setQueue] = useState('')
  const [exited, setExited] = useState('')
  useEffect(() => {
    const t = window.setInterval(() => {
      if (getSrsQueueOwner() !== current()) setSrsQueueOwner(current())
      setQueue(readQueue())
    }, 150)
    return () => window.clearInterval(t)
  }, [current])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--bd)] bg-[var(--bg)] px-6 py-3 font-display text-[13px] text-[var(--t2)]">
        <span>합성 자료 · 개인 데이터 아님 · 서버 기록 없음</span>
        <span>
          대기열 <span data-testid="st-queue">{queue}</span> · 종료 <span data-testid="st-exit">{exited}</span>
        </span>
        <button type="button" data-testid="st-to-b" className="min-h-[44px] rounded border border-[var(--bd)] px-3" onClick={() => emit('SIGNED_IN', B)}>
          다른 탭에서 B 로그인
        </button>
        <button type="button" data-testid="st-signout" className="min-h-[44px] rounded border border-[var(--bd)] px-3" onClick={() => emit('SIGNED_OUT', null)}>
          로그아웃
        </button>
        <button type="button" data-testid="st-to-a" className="min-h-[44px] rounded border border-[var(--bd)] px-3" onClick={() => emit('SIGNED_IN', A)}>
          A 로 다시 로그인
        </button>
        <button type="button" data-testid="st-refresh-a" className="min-h-[44px] rounded border border-[var(--bd)] px-3" onClick={() => emit('TOKEN_REFRESHED', A)}>
          A 토큰 갱신
        </button>
      </div>
      <WordVaultViewerGate viewerId={A} reopenHref="/dev/study-identity" authSource={source}>
        <StudyMode words={WORDS} viewerId={A} authSource={source} onExit={(r) => setExited(r)} />
      </WordVaultViewerGate>
    </div>
  )
}
