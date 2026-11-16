// apps/web/src/app/dev/game-identity/harness.tsx
// 합성 자료 — 개인 데이터 아님 · 서버 기록 없음. 판을 A(합성 uid)가 시작했다고 두고 브라우저 신원을 버튼으로 바꾼다.
// 기록 대역은 실제 함수 대신 「무엇을 · 누구 몫으로(expectedUserId)」 보내려 했는지만 적는다.
'use client'

import { useEffect, useMemo, useState } from 'react'
import type { StoryAuthChange, StoryAuthSource } from '@/components/library/story/use-story-auth-guard'
import type { WordScope } from '@/lib/game/use-word-scope'
import { useGameSessionRecorder } from '@/lib/game/use-session-recorder'
import { GameIdentityNotice } from '@/components/game/GameIdentityNotice'
import type { recordGameResult } from '@/lib/game/record-result'
import type { recordGameScore } from '@/lib/scores/record-score'

const A = 'harness-player-a'
const B = 'harness-player-b'
// 판의 주인 = 단어를 읽은 사람(A) — 실제 useGameWordScope 의 viewerId 와 같은 자리
const SCOPE: WordScope = { loading: false, kind: 'explicit', insufficient: false, demo: false, words: undefined, title: '합성', subtitle: '', chapter: null, viewerId: A }

function makeSource(slowOwnerMs: number, browserStartsAs: string | null) {
  let uid: string | null = browserStartsAs
  const listeners = new Set<(c: StoryAuthChange) => void>()
  const source: StoryAuthSource = {
    subscribe(l) {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    // 판 시작 때의 신원 — slow 면 늦게 온다(그 사이 바뀜을 관찰해야 한다)
    currentUserId: () => {
      const at = uid
      return new Promise((r) => setTimeout(() => r(at), slowOwnerMs))
    },
  }
  const emit = (event: string, next: string | null) => {
    uid = next
    for (const l of listeners) l({ event, userId: next })
  }
  return { source, emit }
}

function Game({ source, log }: { source: StoryAuthSource; log: (s: string) => void }) {
  const recordScoreImpl = (async (input) => {
    log(`score:${input.expectedUserId ?? 'null'}:${input.correctCount}/${input.totalQuestions}`)
  }) as typeof recordGameScore
  const recordResultImpl = (async (input) => {
    log(`result:${input.expectedUserId ?? 'null'}:${input.word}`)
    return { ok: true, updated: true } as const
  }) as typeof recordGameResult
  const session = useGameSessionRecorder({ module: 'wordblitz', scope: SCOPE, authSource: source, recordScoreImpl, recordResultImpl })
  const answer = (correct: boolean) => {
    if (correct) session.countCorrect()
    else session.countWrong()
    void session.result({ word: correct ? 'harvest' : 'drought', isCorrect: correct, module: 'wordblitz' }).then((r) => {
      if (!r.ok) log(`blocked:${r.error}`)
    })
  }
  // 시험 전용 — 화면이 내려간 뒤에도 남은 옛 콜백(이미 잡힌 타이머 · 이벤트)을 흉내 내려고 마지막 answer 를 붙잡아 둔다
  useEffect(() => {
    if (session.status === 'same') (window as unknown as { __harnessLateAnswer?: (c: boolean) => void }).__harnessLateAnswer = answer
  })
  // 실제 화면(play-scaffold · WordBlitz)과 같은 경계 — same 이 아니면 게임 대신 안내
  if (session.status !== 'same') return <GameIdentityNotice status={session.status} reopenHref="/dev/game-identity" />
  return (
    <div className="flex gap-3 p-6" data-testid="game">
      <button type="button" data-testid="answer-correct" className="min-h-[44px] rounded border border-[var(--bd)] px-4" onClick={() => answer(true)}>
        정답
      </button>
      <button type="button" data-testid="answer-wrong" className="min-h-[44px] rounded border border-[var(--bd)] px-4" onClick={() => answer(false)}>
        오답
      </button>
    </div>
  )
}

export function GameIdentityHarness({ slowOwnerMs, browserB }: { slowOwnerMs: number; browserB: boolean }) {
  const { source, emit } = useMemo(() => makeSource(slowOwnerMs, browserB ? B : A), [slowOwnerMs, browserB])
  const [mounted, setMounted] = useState(true)
  const [entries, setEntries] = useState<string[]>([])
  const log = (s: string) => setEntries((e) => [...e, s])
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--bd)] bg-[var(--bg)] px-6 py-3 font-display text-[13px] text-[var(--t2)]">
        <span>합성 자료 · 개인 데이터 아님 · 서버 기록 없음(대역) · slow={slowOwnerMs} · browser={browserB ? 'B' : 'A'}</span>
        <span>
          기록 <span data-testid="harness-log">{entries.join(',')}</span>
        </span>
        <button type="button" data-testid="to-b" className="min-h-[44px] rounded border border-[var(--bd)] px-3" onClick={() => emit('SIGNED_IN', B)}>
          다른 탭에서 B 로그인
        </button>
        <button type="button" data-testid="signout" className="min-h-[44px] rounded border border-[var(--bd)] px-3" onClick={() => emit('SIGNED_OUT', null)}>
          로그아웃
        </button>
        <button type="button" data-testid="to-a" className="min-h-[44px] rounded border border-[var(--bd)] px-3" onClick={() => emit('SIGNED_IN', A)}>
          A 로 다시 로그인
        </button>
        <button type="button" data-testid="refresh-a" className="min-h-[44px] rounded border border-[var(--bd)] px-3" onClick={() => emit('TOKEN_REFRESHED', A)}>
          A 토큰 갱신
        </button>
        <button type="button" data-testid="leave" className="min-h-[44px] rounded border border-[var(--bd)] px-3" onClick={() => setMounted(false)}>
          세션 떠나기(언마운트)
        </button>
      </div>
      {mounted && <Game source={source} log={log} />}
    </div>
  )
}
