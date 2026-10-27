// apps/web/src/app/dev/spellforge-identity/harness.tsx
// 합성 자료 — 개인 데이터 아님 · 서버 기록 없음. 서버가 A(합성 uid) 의 단어로 그렸다고 두고 브라우저 신원을 버튼으로 바꾼다.
// 신원을 바꿀 때 실제 앱의 flush-session 처럼 전역 대기열 주인(setSrsQueueOwner)도 함께 바꾼다. 대기열 표시는 합성 주인 · 합성 단어로 한정한다.
'use client'

import { useEffect, useMemo, useState } from 'react'
import { GameViewerGate } from '@/components/game/GameViewerGate'
import { SpellForge } from '@/components/spellforge/SpellForge'
import type { StoryAuthChange, StoryAuthSource } from '@/components/library/story/use-story-auth-guard'
import { getSrsQueueOwner, setSrsQueueOwner } from '@/lib/srs/session-storage'
import type { SpellForgeWord } from '@/types/spellforge'

const A = 'harness-sf-a'
const B = 'harness-sf-b'
function word(id: string, text: string, meaning: string): SpellForgeWord {
  return { id, text, meaning, pronunciation: '', pos: 'n.', status: 'new', exampleSentence: `The ${text} was large.` } as SpellForgeWord
}
const WORDS = [word('sf1', 'harvest', '수확'), word('sf2', 'drought', '가뭄'), word('sf3', 'flooding', '홍수')]
const NAMES = new Set(WORDS.map((w) => w.text))

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

export function SpellForgeIdentityHarness({ browserB, slowMs, ownerDelayMs = 0 }: { browserB: boolean; slowMs: number; ownerDelayMs?: number }) {
  const { source, emit, current } = useMemo(() => makeSource(browserB ? B : A, slowMs), [browserB, slowMs])
  const [queue, setQueue] = useState('')
  useEffect(() => {
    // ownerDelayMs — 대기열 주인 해석이 늦는 경우(첫 평가 때 아직 null)를 흉내 낸다
    const since = Date.now()
    const t = window.setInterval(() => {
      if (Date.now() - since < ownerDelayMs) {
        if (getSrsQueueOwner() !== null) setSrsQueueOwner(null)
      } else if (getSrsQueueOwner() !== current()) setSrsQueueOwner(current())
      setQueue(readQueue())
    }, 150)
    return () => window.clearInterval(t)
  }, [current, ownerDelayMs])

  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--bd)] bg-[var(--bg)] px-6 py-3 font-display text-[13px] text-[var(--t2)]">
        <span>합성 자료 · 개인 데이터 아님 · 서버 기록 없음</span>
        <span>
          대기열 <span data-testid="sf-queue">{queue}</span>
        </span>
        <button type="button" data-testid="sf-to-b" className="min-h-[44px] rounded border border-[var(--bd)] px-3" onClick={() => emit('SIGNED_IN', B)}>
          다른 탭에서 B 로그인
        </button>
        <button type="button" data-testid="sf-signout" className="min-h-[44px] rounded border border-[var(--bd)] px-3" onClick={() => emit('SIGNED_OUT', null)}>
          로그아웃
        </button>
        <button type="button" data-testid="sf-to-a" className="min-h-[44px] rounded border border-[var(--bd)] px-3" onClick={() => emit('SIGNED_IN', A)}>
          A 로 다시 로그인
        </button>
        <button type="button" data-testid="sf-refresh-a" className="min-h-[44px] rounded border border-[var(--bd)] px-3" onClick={() => emit('TOKEN_REFRESHED', A)}>
          A 토큰 갱신
        </button>
      </div>
      <GameViewerGate viewerId={A} reopenHref="/dev/spellforge-identity" authSource={source}>
        <SpellForge textId="harness" textTitle="합성 자료" words={WORDS} backHref="/dev/spellforge-identity" viewerId={A} authSource={source} />
      </GameViewerGate>
    </div>
  )
}
