// apps/web/src/app/dev/textbook-practice-scope/dev.tsx
'use client'

import { useEffect, useState } from 'react'

import { TextbookPracticeScope } from '@/components/practice/TextbookPracticeScope'
import type { DcpGradeResult, DcpItem } from '@/lib/learner/dcp'
import type { VolumePracticePath } from '@/lib/textbook/practice-rpc'

const PASSAGE =
  'Every summer the president left the busy city for a small house on a quiet hill. There he could think, write and make hard decisions away from crowds.'

const ITEMS: DcpItem[] = [
  { id: 'tb-title', type: 'title', paragraphIdx: 0, payload: { passage: PASSAGE, choices: ['A Quiet Place to Think', 'How to Ride a Horse', 'Life in a Busy City', 'The History of Hills', 'A Summer Holiday Abroad'], stemKo: '다음 글의 제목으로 가장 적절한 것은?', underline: null, summarySentence: null } },
]


export function TextbookPracticeScopeDev() {
  // 쿼리는 마운트 뒤에 읽는다(서버 렌더와 첫 화면을 맞춘다). 읽기 전에는 문항을 그리지 않는다.
  const [scope, setScope] = useState<VolumePracticePath | null | 'pending'>('pending')
  useEffect(() => {
    const q = new URLSearchParams(window.location.search).get('scope')
    setScope(q === 'volume' || q === 'legacy_v_level' ? q : null)
  }, [])
  // 합성 채점 호출 수 — 안내 · 선택이 채점을 부르지 않는지 PC 실측이 읽는다(dev 전용 표시)
  const [calls, setCalls] = useState(0)
  const grade = async (_itemId: string, answer: Record<string, unknown>): Promise<DcpGradeResult> => {
    setCalls((c) => c + 1)
    const correct = Number(answer.choice) === 1
    return { ok: true, correct, attemptId: 'dev-attempt', answerKey: correct ? { explanation_ko: '조용한 곳에서 생각했다는 내용이 중심이다.' } : { answer: 1, explanation_ko: '조용한 곳에서 생각했다는 내용이 중심이다.' } }
  }
  return (
    <div className="flex flex-col gap-3">
      <p className="font-display text-[12px] text-[var(--t2)]" data-testid="dev-grade-calls">
        scope {scope ?? 'unknown'} · 채점 호출 {calls}
      </p>
      {scope !== 'pending' && <TextbookPracticeScope items={ITEMS} scope={scope} backHref="/library/textbooks" backCta="이 교재로 돌아가기" grade={grade} />}
    </div>
  )
}
