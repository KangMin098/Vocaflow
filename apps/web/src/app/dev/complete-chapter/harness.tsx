// apps/web/src/app/dev/complete-chapter/harness.tsx
'use client'

import { useRef, useState } from 'react'
import { CompleteChapterButton } from '@/components/workspace/CompleteChapterButton'
import type { CompleteChapterResult } from '@/lib/library/complete-chapter'

const OK: CompleteChapterResult = { ok: true, alreadyCompleted: false, nextChapterTextId: 'harness-next', bookCompleted: false }

export function CompleteChapterHarness({ mode, delayMs }: { mode: string; delayMs: number }) {
  const [textId, setTextId] = useState('harness-a')
  const calls = useRef(0)
  const [count, setCount] = useState(0)

  async function complete(): Promise<CompleteChapterResult> {
    calls.current += 1
    setCount(calls.current)
    const n = calls.current
    await new Promise((r) => setTimeout(r, delayMs))
    if (mode === 'reject' || (mode === 'flaky' && n === 1)) throw new Error('harness network')
    if (mode === 'fail') return { ...OK, ok: false, nextChapterTextId: null }
    if (mode === 'book') return { ...OK, nextChapterTextId: null, bookCompleted: true }
    if (mode === 'already') return { ...OK, alreadyCompleted: true }
    return OK
  }

  return (
    <main className="min-h-screen bg-[var(--bg)] p-8">
      <p className="mb-4 font-display text-[13px] text-[var(--t2)]">
        하네스 mode={mode} · textId=<span data-testid="harness-text">{textId}</span> · 호출 <span data-testid="harness-calls">{count}</span>
      </p>
      <div className="flex items-center gap-3 border-b border-[var(--bd)] pb-3">
        <CompleteChapterButton textId={textId} currentStatus="in_progress" complete={complete} />
      </div>
      <button type="button" data-testid="harness-switch" className="mt-6 min-h-[44px] rounded border border-[var(--bd)] px-3" onClick={() => setTextId((t) => (t === 'harness-a' ? 'harness-b' : 'harness-a'))}>
        장 바꾸기
      </button>
    </main>
  )
}
