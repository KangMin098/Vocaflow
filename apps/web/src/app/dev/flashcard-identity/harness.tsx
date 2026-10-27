// apps/web/src/app/dev/flashcard-identity/harness.tsx
// 합성 자료 — 개인 데이터 아님 · 서버 기록 없음. 서버가 A(합성 uid) 의 카드로 그렸다고 두고, 브라우저 신원을 버튼으로 바꾼다.
// 신원을 바꿀 때 실제 앱의 flush-session 처럼 전역 대기열 주인(setSrsQueueOwner)도 함께 바꾼다 — 옛 화면의 새 평가가 어느 주인으로
// 들어가는지 실제 pushPendingResult 로 본다. gate=0 은 경계 없는 반례(고치기 전 구조).
'use client'

import { useEffect, useMemo, useState } from 'react'
import { FlashcardSession } from '@/components/flashcard/FlashcardSession'
import { FlashcardViewerGate } from '@/components/flashcard/FlashcardViewerGate'
import type { StoryAuthChange, StoryAuthSource } from '@/components/library/story/use-story-auth-guard'
import { createNewCard } from '@/lib/srs'
import { createInitialSRS } from '@/lib/srs/sm2'
import { getSrsQueueOwner, setSrsQueueOwner } from '@/lib/srs/session-storage'
import type { FlashcardWord } from '@/types/flashcard'

const A = 'harness-viewer-a'
const B = 'harness-viewer-b'

function word(id: string, text: string, meaning: string): FlashcardWord {
  return { id, text, meaning, pronunciation: '', pos: 'n.', exampleSentence: '', exampleSentenceWithBlank: '', textId: 'harness-text', textTitle: '합성 자료', textChapter: '', srs: createInitialSRS(), srsV2: createNewCard(id) }
}
const WORDS = [word('h1', 'harvest', '수확'), word('h2', 'drought', '가뭄'), word('h3', 'flooding', '홍수')]

/** 주입 신원 원천 — 구독 먼저, 기준선은 지금 값 */
function makeSource() {
  let uid: string | null = A
  const listeners = new Set<(c: StoryAuthChange) => void>()
  const source: StoryAuthSource = {
    subscribe(l) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    currentUserId: async () => uid,
  }
  const emit = (event: string, next: string | null) => {
    uid = next
    setSrsQueueOwner(next) // 실제 앱: flush-session 이 계정 전환을 구독해 주인을 지금 값으로 둔다
    for (const l of listeners) l({ event, userId: next })
  }
  return { source, emit, current: () => uid }
}

const SYNTHETIC_WORDS = new Set(WORDS.map((w) => w.text))

/** 합성 단어만 보인다 — 이 브라우저에 다른 계정의 대기 평가가 있어도 그 uid · 단어를 화면에 옮기지 않는다(읽기만 · 지우지 않음) */
function readQueue(): { owner: string | null; word: string }[] {
  try {
    return (JSON.parse(localStorage.getItem('srs_pending') ?? '[]') as { owner?: string; word: string }[])
      .filter((p) => SYNTHETIC_WORDS.has(p.word) && (p.owner === undefined || p.owner === A || p.owner === B))
      .map((p) => ({ owner: p.owner ?? null, word: p.word }))
  } catch {
    return []
  }
}

export function FlashcardIdentityHarness({ gated }: { gated: boolean }) {
  const { source, emit, current } = useMemo(makeSource, [])
  const [queue, setQueue] = useState<{ owner: string | null; word: string }[]>([])
  const [owner, setOwner] = useState<string | null>(null)

  useEffect(() => {
    // 이 브라우저의 기존 대기열을 비우지 않는다 — 시험은 새 격리 문맥에서 돈다. 서버 flush(useSrsFlushOnLeave)는 시험이 전송 전에 막는다.
    // 실제 주인 해석기는 이 브라우저의 진짜 세션(하네스는 로그인 없음 → null)을 따른다 — 하네스에서는 주입 신원을 따르게 다시 맞춘다
    setSrsQueueOwner(current())
    const t = window.setInterval(() => {
      if (getSrsQueueOwner() !== current()) setSrsQueueOwner(current())
      setQueue(readQueue())
      setOwner(getSrsQueueOwner())
    }, 200)
    return () => window.clearInterval(t)
  }, [current])

  const session = <FlashcardSession initialWords={WORDS} backHref="/flashcard" />
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--bd)] bg-[var(--bg)] px-6 py-3 font-display text-[13px] text-[var(--t2)]">
        <span>합성 자료 · 개인 데이터 아님 · 서버 기록 없음 · gate={gated ? 'on' : 'off'}</span>
        <span>
          대기열 주인 <span data-testid="harness-owner">{owner ?? '-'}</span> · 대기열{' '}
          <span data-testid="harness-queue">{queue.map((q) => `${q.owner ?? '?'}:${q.word}`).join(',')}</span>
        </span>
        <button type="button" data-testid="harness-to-b" className="min-h-[44px] rounded border border-[var(--bd)] px-3" onClick={() => emit('SIGNED_IN', B)}>
          다른 탭에서 B 로그인
        </button>
        <button type="button" data-testid="harness-signout" className="min-h-[44px] rounded border border-[var(--bd)] px-3" onClick={() => emit('SIGNED_OUT', null)}>
          로그아웃
        </button>
        <button type="button" data-testid="harness-to-a" className="min-h-[44px] rounded border border-[var(--bd)] px-3" onClick={() => emit('SIGNED_IN', A)}>
          A 로 다시 로그인
        </button>
        <button type="button" data-testid="harness-refresh-a" className="min-h-[44px] rounded border border-[var(--bd)] px-3" onClick={() => emit('TOKEN_REFRESHED', A)}>
          A 토큰 갱신
        </button>
      </div>
      {gated ? (
        <FlashcardViewerGate viewerId={A} reopenHref="/dev/flashcard-identity" authSource={source}>
          {session}
        </FlashcardViewerGate>
      ) : (
        session
      )}
    </div>
  )
}
