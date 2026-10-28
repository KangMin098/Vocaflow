// apps/web/src/app/dev/textbook-practice-scope/dev.tsx
'use client'

import { useEffect, useMemo, useState } from 'react'

import { TextbookPracticeBridge } from '@/components/practice/TextbookPracticeBridge'
import { StoryAuthSourceContext, type StoryAuthChange, type StoryAuthSource } from '@/components/library/story/use-story-auth-guard'
import type { DcpGradeResult, DcpItem } from '@/lib/learner/dcp'
import type { VolumePracticePath } from '@/lib/textbook/practice-rpc'

const A = 'dev-user-a'
const B = 'dev-user-b'

const PASSAGE =
  'Every summer the president left the busy city for a small house on a quiet hill. There he could think, write and make hard decisions away from crowds.'

const ITEMS: DcpItem[] = [
  { id: 'tb-title', type: 'title', paragraphIdx: 0, payload: { passage: PASSAGE, choices: ['A Quiet Place to Think', 'How to Ride a Horse', 'Life in a Busy City', 'The History of Hills', 'A Summer Holiday Abroad'], stemKo: '다음 글의 제목으로 가장 적절한 것은?', underline: null, summarySentence: null } },
  { id: 'tb-topic', type: 'topic', paragraphIdx: 0, payload: { passage: PASSAGE, choices: ['a calm place for hard decisions', 'ways to travel', 'crowds in a city', 'building houses', 'summer weather'], stemKo: '다음 글의 주제로 가장 적절한 것은?', underline: null, summarySentence: null } },
]
const EXPLAIN = '조용한 곳에서 생각하고 결정했다는 내용이 중심이다.'

/** 조작 가능한 브라우저 신원 — ?baseline=hold 면 기준선을 「확인」 버튼까지 미룬다(checking → same 실측). */
function controllableSource(initial: string, hold: boolean) {
  let uid: string | null = initial
  let releaseBaseline: () => void = () => {}
  const listeners = new Set<(c: StoryAuthChange) => void>()
  const source: StoryAuthSource = {
    subscribe: (l) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    currentUserId: () => (hold ? new Promise((r) => (releaseBaseline = () => r(uid))) : Promise.resolve(uid)),
  }
  const set = (next: string | null) => {
    uid = next
    for (const l of listeners) l({ event: next ? 'SIGNED_IN' : 'SIGNED_OUT', userId: next })
  }
  return { source, set, release: () => releaseBaseline() }
}

export function TextbookPracticeScopeDev() {
  // 쿼리는 마운트 뒤에 읽는다(서버 렌더와 첫 화면을 맞춘다). 읽기 전에는 문항을 그리지 않는다.
  const [q, setQ] = useState<{ scope: VolumePracticePath | null; delay: number; hold: boolean } | null>(null)
  useEffect(() => {
    const p = new URLSearchParams(window.location.search)
    const s = p.get('scope')
    setQ({ scope: s === 'volume' || s === 'legacy_v_level' ? s : null, delay: Number(p.get('delay') ?? 50) || 50, hold: p.get('baseline') === 'hold' })
  }, [])
  const ctl = useMemo(() => (q ? controllableSource(A, q.hold) : null), [q])
  // 합성 채점 호출 수 — 안내 · 선택 · 다시 보기가 채점을 부르지 않는지 PC 실측이 읽는다(dev 전용 표시)
  const [calls, setCalls] = useState(0)
  const submit = (expectedOwner: string, itemId: string, answer: Record<string, unknown>) =>
    new Promise<DcpGradeResult>((resolve) =>
      setTimeout(() => {
        setCalls((c) => c + 1)
        // 서버 래퍼와 같은 규칙 — 지금 신원이 예상 주인과 다르면 채점하지 않는다
        if (expectedOwner !== A) return resolve({ ok: false, error: '로그인 상태가 바뀌었어요. 연습을 다시 열어 주세요.' })
        const correct = Number(answer.choice) === 1
        resolve({ ok: true, correct, attemptId: `${itemId}-attempt`, answerKey: correct ? { explanation_ko: EXPLAIN } : { answer: 1, explanation_ko: EXPLAIN } })
      }, q?.delay ?? 50),
    )
  if (!q || !ctl) return null
  return (
    <StoryAuthSourceContext.Provider value={ctl.source}>
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <button type="button" data-testid="as-same" className="min-h-[44px] rounded-[var(--r-md)] border border-[var(--bd)] px-3 font-display text-[12.5px]" onClick={ctl.release}>
          신원 확인 완료(같은 계정)
        </button>
        <button type="button" data-testid="as-b" className="min-h-[44px] rounded-[var(--r-md)] border border-[var(--bd)] px-3 font-display text-[12.5px]" onClick={() => ctl.set(B)}>
          다른 계정(B)으로 전환
        </button>
        <button type="button" data-testid="as-out" className="min-h-[44px] rounded-[var(--r-md)] border border-[var(--bd)] px-3 font-display text-[12.5px]" onClick={() => ctl.set(null)}>
          로그아웃
        </button>
        <span className="font-mono text-[12px] text-[var(--t2)]" data-testid="dev-grade-calls">
          scope {q.scope ?? 'unknown'} · 채점 호출 {calls}
        </span>
      </div>
      <TextbookPracticeBridge
        items={ITEMS}
        scope={q.scope}
        ownerId={A}
        backHref="/library/textbooks"
        backCta="이 교재로 돌아가기"
        reopenHref="/dev/textbook-practice-scope"
        submit={submit}
      />
    </StoryAuthSourceContext.Provider>
  )
}
