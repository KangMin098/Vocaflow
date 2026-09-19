// apps/web/src/components/csat/session/AnalysisWorkbench.tsx
'use client'

import Link from 'next/link'
import type { DissectionItem } from '@/lib/csat/dissect'
import { analysisSections } from '@/lib/csat/analysis-sections'
import { toItemSlug } from '@/lib/csat/item-slug'
import type { ReflowItem } from '@/lib/csat/reflow/types'
import { segmentsOf, type PassageModel, type PassageSentence } from '@/lib/csat/session/passage-model'
import { QuestionArchitecture, type AnalysisFocus } from './QuestionArchitecture'
import visual from './visual-analysis.module.css'
import styles from './session.module.css'

export function AnalysisWorkbench({ item, paper, model, focus, active, onSelect, onPlay, loading }: {
  item: DissectionItem; paper: ReflowItem; model: PassageModel; focus: AnalysisFocus; active: string | null
  onSelect: (focus: AnalysisFocus) => void; onPlay: (index: number) => void; loading: boolean
}) {
  const sections = analysisSections(item)
  const origin = item.skeleton.anchors.find(a => a.id === `reject:${item.distractor.n}`)?.from
  const trapLabel = origin === 'tempt' ? '오답 유인 표현' : origin === 'reject' ? '오답 배제 근거' : '오답 관련 문장'
  const relevant = (s: PassageSentence) => s.marks.some(m => m.anchorId === 'answer' || m.anchorId === `reject:${item.distractor.n}`)
  const sentence = (s: PassageSentence) => {
    const answer = s.marks.some(m => m.anchorId === 'answer')
    const reject = s.marks.some(m => m.anchorId === `reject:${item.distractor.n}`)
    const selected = focus === 'evidence' && answer || focus === 'distractor' && reject
    const anchor = focus === 'distractor' ? `reject:${item.distractor.n}` : 'answer'
    const focused = { ...s, marks: s.marks.filter(m => m.anchorId === anchor) }
    const exact = focused.marks.some(m => m.ranges.length > 0)
    return <button key={s.i} className={visual.sourceSentence} data-testid="visual-source-sentence" data-reject={focus === 'distractor' && reject} aria-pressed={selected} onClick={() => onSelect(answer && !(reject && focus === 'distractor') ? 'evidence' : reject ? 'distractor' : 'context')}>
      <span>{String(s.i + 1).padStart(2, '0')}</span><span lang="en">{segmentsOf(focused, selected ? ['evidence', 'reject', 'tempt'] : []).map((part, i) => part.marked ? <mark key={i}>{part.text}</mark> : <span key={i}>{part.text}</span>)}</span>
      <small>{answer ? '━━ 정답 근거' : ''}{answer && reject ? ' · ' : ''}{reject ? `┄┄ ${trapLabel}` : ''}{selected ? ` · ${exact ? '인용 구절' : '문장 단위'} 연결` : ''}</small>
    </button>
  }
  return <div className={visual.workbench} data-testid="analysis-workbench" data-focus={focus}>
    <section className={visual.source} aria-labelledby="source-heading">
      <div className={visual.sourceHead}><h2 id="source-heading">원문에서 확인</h2><span>문장을 누르면 구조도와 연결돼요</span></div>
      {model.sentences.filter(relevant).map(sentence)}
      <details className={styles.typeGroup}><summary>나머지 문장도 함께 읽기</summary>{model.sentences.filter(s => !relevant(s)).map(sentence)}</details>
    </section>
    <div className={visual.inspector}>
      <div className={visual.sourceHead}><h2>출제 구조</h2><span>{active ? '음성과 같은 관계를 따라가요' : '노드를 눌러 원문과 대조'}</span></div>
      <QuestionArchitecture item={item} focus={focus} onSelect={onSelect} speaking={Boolean(active)} />
      <div className={visual.focusNav} role="group" aria-label="분석 관계 선택">{sections.map(section => <button key={section.id} aria-pressed={focus === section.id} onClick={() => onSelect(section.id as AnalysisFocus)}>{({ context: '소재', evidence: '정답 연결', distractor: '오답 변형', intent: '출제 의도', pattern: '공통 공식' })[section.id]}</button>)}</div>
      {sections.map((section, index) => <section hidden={focus !== section.id} key={section.id} id={`analysis-${section.id}`} data-analysis={section.id} data-current={active === section.id} data-kind={section.id} className={visual.relationDetail}>
        {active === section.id && <span className={visual.focusLabel}>현재 설명 · {section.title}</span>}
        <h2>{section.title}</h2>
        {section.id === 'evidence' && <><p className={visual.meta}>근거 문장 ━━ {item.format} → 정답 {item.answer}번</p><blockquote lang="en">{paper.choices[item.answer - 1]}</blockquote></>}
        {section.id === 'distractor' && <><p className={visual.meta}>{trapLabel} ┄┄ {item.distractor.family} {origin === 'tempt' ? '→' : '⊣'} 오답 {item.distractor.n}번</p><blockquote lang="en">{paper.choices[item.distractor.n - 1]}</blockquote></>}
        <p>{section.text}</p>
        <button disabled={loading} onClick={() => onPlay(index)} aria-label={`${section.title}부터 듣기`}>이 관계부터 듣기 →</button>
        {section.id === 'pattern' && <><p>다른 소재에서도 같은 공식이 이어지는지 비교해 보세요.</p>{item.history.map(other => <Link key={other.id} className={styles.exploreRow} href={`/csat/dissect?item=${toItemSlug(other.id)}`}><span>{other.id.replace('#', ' · ')}번</span><strong>{other.topic}</strong><span>같은 공식 비교 →</span></Link>)}<Link href="/csat/formulas" className={styles.textButton}>내 공식 보기</Link></>}
      </section>)}
    </div>
  </div>
}
