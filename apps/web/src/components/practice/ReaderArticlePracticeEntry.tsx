// apps/web/src/components/practice/ReaderArticlePracticeEntry.tsx
// R0 — Reader 본문 아래 「발췌문으로 제목 · 주제 골라 보기」 진입. 세 상태(T-0204):
//   available → 연습 링크 · none → 아무것도 그리지 않음(예전과 같다) · failed → 「연습 정보를 확인하지 못했어요」 + 다시 시도(같은 단일 호출 1회).
// 다시 시도는 기록 · 이벤트 · 채점을 만들지 않는다. 결과가 오기 전 버튼은 사라지지 않는다(포커스가 body 로 떨어지지 않게).

'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'

import type { ReaderArticlePractice } from '@/lib/learner/reader-article-practice'

const BOX = 'inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-4 font-display text-[13px] font-[700] text-[var(--t1)] transition-colors hover:bg-[var(--bg2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--p)]'

export function ReaderArticlePracticeEntry({
  initial,
  recheck,
}: {
  initial: ReaderArticlePractice
  /** 같은 단일 조회를 한 번 더 — 서버 action(recheckReaderArticlePractice) 을 호출부가 넘긴다 */
  recheck: (articleId: string) => Promise<ReaderArticlePractice>
}) {
  const [state, setState] = useState<ReaderArticlePractice>(initial)
  const [pending, setPending] = useState(false)
  const linkRef = useRef<HTMLAnchorElement>(null)
  const retried = useRef(false)
  useEffect(() => setState(initial), [initial])
  // 다시 시도로 링크가 생기면 포커스를 그 링크로 — 버튼이 사라져 body 로 떨어지지 않게
  useEffect(() => {
    if (retried.current && state.state === 'available') linkRef.current?.focus()
  }, [state])

  if (state.state === 'none') return null
  return (
    <div className="mx-auto max-w-[680px] px-6 pb-6 md:px-8" data-testid="reader-article-practice-entry" data-state={state.state}>
      {state.state === 'available' ? (
        <Link ref={linkRef} href={state.href} data-testid="reader-article-practice" className={BOX}>
          다 읽었다면 · 발췌문으로 제목 · 주제 골라 보기
        </Link>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          <p role="status" className="break-keep font-body text-[13px] text-[var(--t2)]" data-testid="reader-article-practice-failed">
            연습 정보를 확인하지 못했어요
          </p>
          <button
            type="button"
            aria-disabled={pending || undefined}
            data-testid="reader-article-practice-retry"
            onClick={async () => {
              if (pending || state.state !== 'failed') return
              setPending(true)
              retried.current = true
              try {
                setState(await recheck(state.articleId))
              } catch {
                setState({ state: 'failed', articleId: state.articleId })
              } finally {
                setPending(false)
              }
            }}
            className={BOX}
          >
            {pending ? '확인하는 중…' : '다시 시도'}
          </button>
        </div>
      )}
    </div>
  )
}
