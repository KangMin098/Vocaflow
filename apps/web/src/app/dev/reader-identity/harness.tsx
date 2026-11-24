// apps/web/src/app/dev/reader-identity/harness.tsx
// 합성 지문 — 개인 데이터 아님 · 서버 기록 없음. 글의 주인을 A(합성 uid)로 두고 브라우저 신원을 버튼으로 바꾼다.
'use client'

import { useMemo } from 'react'
import { ReaderViewerGate } from '@/app/(main)/text/[id]/reader-viewer-gate'
import type { StoryAuthChange, StoryAuthSource } from '@/components/library/story/use-story-auth-guard'
import { useTTS } from '@/lib/workspace/tts-controller'

const A = 'harness-reader-a'
const B = 'harness-reader-b'
const SENTENCES = [
  { paragraphId: 'p1', sentenceIdx: 0, text: 'My private diary sentence one.' },
  { paragraphId: 'p1', sentenceIdx: 1, text: 'My private diary sentence two.' },
]

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

function PrivateText() {
  const tts = useTTS()
  return (
    <article className="p-6" data-testid="reader-body">
      <h1 className="font-editorial text-[20px]">합성 개인 글 제목 prv-title</h1>
      {SENTENCES.map((s) => (
        <p key={s.sentenceIdx}>{s.text}</p>
      ))}
      <button type="button" data-testid="reader-play" className="mt-4 min-h-[44px] rounded border border-[var(--bd)] px-3" onClick={() => tts.playFromMode('all', SENTENCES)}>
        읽어 주기
      </button>
    </article>
  )
}

export function ReaderIdentityHarness({ browserB, slowMs }: { browserB: boolean; slowMs: number }) {
  const { source, emit } = useMemo(() => makeSource(browserB ? B : A, slowMs), [browserB, slowMs])
  return (
    <div>
      <div className="flex flex-wrap items-center gap-3 border-b border-[var(--bd)] bg-[var(--bg)] px-6 py-3 font-display text-[13px] text-[var(--t2)]">
        <span>합성 지문 · 개인 데이터 아님 · 서버 기록 없음</span>
        <button type="button" data-testid="rd-to-b" className="min-h-[44px] rounded border border-[var(--bd)] px-3" onClick={() => emit('SIGNED_IN', B)}>
          다른 탭에서 B 로그인
        </button>
        <button type="button" data-testid="rd-signout" className="min-h-[44px] rounded border border-[var(--bd)] px-3" onClick={() => emit('SIGNED_OUT', null)}>
          로그아웃
        </button>
        <button type="button" data-testid="rd-to-a" className="min-h-[44px] rounded border border-[var(--bd)] px-3" onClick={() => emit('SIGNED_IN', A)}>
          A 로 다시 로그인
        </button>
        <button type="button" data-testid="rd-refresh-a" className="min-h-[44px] rounded border border-[var(--bd)] px-3" onClick={() => emit('TOKEN_REFRESHED', A)}>
          A 토큰 갱신
        </button>
      </div>
      <ReaderViewerGate ownerId={A} textId="harness-text" authSource={source}>
        <PrivateText />
      </ReaderViewerGate>
    </div>
  )
}
