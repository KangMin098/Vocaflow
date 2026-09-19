// apps/web/src/components/csat/session/QuestionArchitecture.tsx
'use client'

import { useId } from 'react'
import type { DissectionItem } from '@/lib/csat/dissect'
import visual from './visual-analysis.module.css'

export type AnalysisFocus = 'context' | 'evidence' | 'distractor' | 'intent' | 'pattern'
export function QuestionArchitecture({ item, focus, onSelect, speaking = false }: {
  item: DissectionItem; focus: AnalysisFocus; onSelect: (focus: AnalysisFocus) => void; speaking?: boolean
}) {
  const uid = useId().replace(/:/g, '')
  const evidence = item.skeleton.anchors.find(a => a.id === 'answer')?.sentences ?? []
  const trapAnchor = item.skeleton.anchors.find(a => a.id === `reject:${item.distractor.n}`)
  const reject = trapAnchor?.sentences ?? []
  const tempting = trapAnchor?.from === 'tempt'
  const trapLabel = tempting ? '유인 표현' : trapAnchor?.from === 'reject' ? '배제 근거' : '관련 문장'
  const sizes = item.skeleton.sentences
  const step = Math.min(25, 174 / Math.max(1, sizes.length))
  const y = (indices: number[]) => 30 + (indices[0] ?? 0) * step
  const max = Math.max(1, ...sizes)
  return <div className={visual.architecture} data-testid="question-architecture" data-focus={focus} data-speaking={speaking}>
    <svg viewBox="0 0 480 240" preserveAspectRatio="none" aria-labelledby={`${uid}-title`} role="img">
      <title id={`${uid}-title`}>{`${item.exam_id} ${item.no}번 문장 구조. 근거 ${evidence.map(n => n + 1).join(', ')}번 문장에서 정답 ${item.answer}번으로. ${trapLabel} ${reject.map(n => n + 1).join(', ')}번 문장에서 오답 ${item.distractor.n}번으로.`}</title>
      <defs><marker id={`${uid}-arrow`} viewBox="0 0 8 8" refX="7" refY="4" markerWidth="5" markerHeight="5" orient="auto"><path d="M0 0L8 4L0 8" fill="none" stroke="currentColor" strokeWidth="1.5" /></marker></defs>
      <rect className={visual.paperShape} x="10" y="9" width="174" height="202" rx="2" />
      {sizes.map((size, i) => <g key={i} data-branch={evidence.includes(i) ? 'evidence' : reject.includes(i) ? 'distractor' : 'context'}>
        <text x="20" y={34 + i * step} className={visual.sentenceNumber}>{String(i + 1).padStart(2, '0')}</text>
        <rect x="44" y={26 + i * step} width={118 * size / max} height="7" rx="1" className={visual.sentenceBar} />
        {evidence.includes(i) && <path d={`M42 ${37 + i * step}h${118 * size / max + 3}`} className={visual.evidenceStroke} />}
        {reject.includes(i) && <path d={`M42 ${40 + i * step}h${118 * size / max + 3}`} className={visual.rejectStroke} />}
      </g>)}
      {evidence.map(sentence => <path key={`e${sentence}`} d={`M184 ${y([sentence])} C228 ${y([sentence])},230 61,284 61`} className={visual.evidenceEdge} markerEnd={`url(#${uid}-arrow)`} />)}
      {reject.map(sentence => <path key={`r${sentence}`} d={`M184 ${y([sentence])} C225 ${y([sentence])},234 174,275 174 ${tempting ? 'M269 168l8 6-8 6' : 'M279 168v12'}`} className={visual.rejectEdge} />)}
    </svg>
    <span className={visual.paperCaption}>지문 · {sizes.length}문장</span>
    <button className={visual.answerNode} aria-pressed={focus === 'evidence'} onClick={() => onSelect('evidence')}><span className={visual.nodeLabel}>실선 · 정답 근거</span><strong><span className={visual.choiceNumber}>{item.answer}</span> {item.format}</strong><span>관계 확인 ↗</span></button>
    <button className={visual.trapNode} aria-pressed={focus === 'distractor'} onClick={() => onSelect('distractor')}><span className={visual.nodeLabel}>점선 · {tempting ? '오답 유인' : trapAnchor?.from === 'reject' ? '오답 배제' : '오답 연결'}</span><strong><span className={visual.choiceNumber}>{item.distractor.n}</span> {item.distractor.family}</strong><span>어디서 어긋날까 ↗</span></button>
  </div>
}
