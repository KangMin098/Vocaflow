// apps/web/src/components/csat/session/PatternComparison.tsx
'use client'

import { useState } from 'react'
import Link from 'next/link'
import type { DissectionItem } from '@/lib/csat/dissect'
import { toItemSlug } from '@/lib/csat/item-slug'
import { track } from '@/lib/analytics/client'
import { QuestionArchitecture, type AnalysisFocus } from './QuestionArchitecture'
import visual from './visual-analysis.module.css'

export function PatternComparison({ items }: { items: DissectionItem[] }) {
  const [focus, setFocus] = useState<AnalysisFocus>('evidence')
  const [detail, setDetail] = useState(false)
  const pair = items.slice(0, 2)
  const select = (next: AnalysisFocus) => { setFocus(next); setDetail(true); track({ name: 'csat_session_explained', props: { kind: next === 'distractor' ? 'reject' : 'evidence' } }) }
  return <div className={visual.comparison} data-testid="visual-comparison">
    <div className={visual.comparisonTop}><span>문장은 달라도, 연결 방식은?</span><span>정답·오답 노드를 눌러 비교</span></div>
    <div className={visual.pair}>{pair.map((item, index) => <section key={item.id}>
      <header><span className={visual.plate}>{index === 0 ? 'A' : 'B'}</span><div><p className={visual.meta}>{item.exam_id} · {item.no}번</p><h2>{item.topic}</h2></div></header>
      <QuestionArchitecture item={item} focus={focus} onSelect={select} />
    </section>)}</div>
    <div className={visual.convergence} aria-hidden><span /><span /><i>=</i></div>
    <div className={visual.common} data-testid="shared-rule"><span className={visual.meta}>두 문항을 잇는 출제 공식</span><p>{pair[0]?.formula}</p></div>
    {detail && <div className={visual.comparisonDetails} aria-live="polite"><h3>{focus === 'distractor' ? '같은 공식에서도, 함정은 달라져요' : '근거가 정답을 지지하는 방식'}</h3><div className={visual.pair}>{pair.map(item => <div key={item.id}><p className={visual.meta}>{item.exam_id} · {item.no}번</p><p>{focus === 'distractor' ? item.distractor.line : item.evidence}</p><Link href={`/csat/dissect?item=${toItemSlug(item.id)}#analysis-${focus}`}>원문과 함께 확인 →</Link></div>)}</div></div>}
    <p className={visual.legend}><span>━━ 정답을 지지</span><span>┄→ 오답 유인 / ┄⊣ 오답 배제</span><span>막대 길이 = 실제 문장 길이</span></p>
  </div>
}
