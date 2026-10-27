// apps/web/src/app/dev/article-practice/dev.tsx
'use client'

import { useMemo } from 'react'

import { ArticlePracticeBridge } from '@/components/practice/ArticlePracticeBridge'
import { StoryAuthSourceContext, type StoryAuthChange, type StoryAuthSource } from '@/components/library/story/use-story-auth-guard'
import type { DcpGradeResult, DcpItem } from '@/lib/learner/dcp'
import type { ArticlePracticeContext } from '@/lib/learner/article-practice-actions'

const A = 'dev-user-a'
const B = 'dev-user-b'

const PASSAGE =
  'Every summer the president left the busy city for a small house on a quiet hill. There he could think, write and make hard decisions away from crowds. He rode a horse to work each morning.\nHistorians say the calm grounds helped him plan his most important work.'

const ITEMS: DcpItem[] = [
  { id: 'ap-title', type: 'title', paragraphIdx: 0, payload: { passage: PASSAGE, choices: ['A Quiet Place to Think and Decide', 'How to Ride a Horse', 'Life in a Busy City', 'The History of Hills', 'A Summer Holiday Abroad'], stemKo: '다음 글의 제목으로 가장 적절한 것은?', underline: null, summarySentence: null } },
  { id: 'ap-topic', type: 'topic', paragraphIdx: 0, payload: { passage: PASSAGE, choices: ['a calm retreat that supported important work', 'ways to travel to work', 'crowds in a city', 'building houses on hills', 'summer weather'], stemKo: '다음 글의 주제로 가장 적절한 것은?', underline: null, summarySentence: null } },
]
const KEY: Record<string, number> = { 'ap-title': 1, 'ap-topic': 1 }
const EXPLAIN: Record<string, string> = {
  'ap-title': '조용한 집에서 생각하고 결정을 내렸다는 내용이 글 전체를 묶는다.',
  'ap-topic': '도시를 떠난 조용한 곳이 중요한 일을 도왔다는 것이 중심이다.',
}

function controllableSource(initial: string) {
  let uid: string | null = initial
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

export function ArticlePracticeDev() {
  // ?delay=ms — 합성 채점 응답 지연(늦은 결과 확인용)
  const delayMs = typeof window === 'undefined' ? 50 : Number(new URLSearchParams(window.location.search).get('delay') ?? 50)
  const ctl = useMemo(() => controllableSource(A), [])
  const submit = (ctx: ArticlePracticeContext, itemId: string, answer: { choice?: unknown }) =>
    new Promise<DcpGradeResult>((resolve) =>
      setTimeout(() => {
        const correct = Number(answer.choice) === KEY[itemId]
        // 실제 서버와 같은 모양 — 맞혀도 해설만 돌려준다
        resolve({ ok: true, correct, attemptId: `${ctx.textId}-attempt`, answerKey: correct ? { explanation_ko: EXPLAIN[itemId] } : { answer: KEY[itemId], explanation_ko: EXPLAIN[itemId] } })
      }, Number.isFinite(delayMs) ? delayMs : 50),
    )
  return (
    <StoryAuthSourceContext.Provider value={ctl.source}>
      <div className="mb-4 flex gap-2">
        <button type="button" data-testid="as-b" className="min-h-[44px] rounded-[var(--r-md)] border border-[var(--bd)] px-3 font-display text-[12.5px]" onClick={() => ctl.set(B)}>
          다른 계정(B)으로 전환
        </button>
      </div>
      <ArticlePracticeBridge articleId="dev-article" textId="dev-text-a" ownerId={A} items={ITEMS} submit={submit} />
    </StoryAuthSourceContext.Provider>
  )
}
