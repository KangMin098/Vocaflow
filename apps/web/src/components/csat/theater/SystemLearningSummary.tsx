// apps/web/src/components/csat/theater/SystemLearningSummary.tsx
'use client'

import { useEffect, useState, type ReactNode } from 'react'
import { ArrowRight, BookOpen, GitBranch, MousePointer2, ScanLine } from 'lucide-react'

import { track } from '@/lib/analytics/client'
import type { LearningSummary } from '@/lib/csat/system-learning'
import type { SceneId } from '@/lib/csat/inquiry/scenes'
import styles from './theater.module.css'

const CIRCLED = ['', '①', '②', '③', '④', '⑤']
const STAGES = ['근거 추적', '조건 비교', '다음 활동'] as const

/** 검수 자료를 선택·연결·비교하는 탐색면. 탐색 상태는 채점·숙달·학습기록으로 저장하지 않는다. */
export function SystemLearningSummary({
  summary, canKeep, kept, onKeep, onGo, onLecture, history, historyState,
  onShowEvidence, initialEvidenceKey,
}: {
  summary: LearningSummary
  canKeep: boolean
  kept: boolean
  onKeep: () => void
  onGo: (scene: SceneId) => void
  onLecture?: () => void
  history: ReactNode | null
  historyState: 'loading' | 'ready'
  onShowEvidence?: (sentences: number[], key: string) => void
  initialEvidenceKey?: string
}) {
  const { relation, units, principle, evidence, checks, next } = summary
  const [stage, setStage] = useState(0)
  const [pick, setPick] = useState<string | null>(() => evidence.find((e) => `summary:${e.key}` === initialEvidenceKey)?.key ?? null)
  const [condition, setCondition] = useState<{ kind: 'applies' | 'limit'; index: number } | null>(null)
  const selected = evidence.find((e) => e.key === pick)
  const conditionCount = (principle?.when_applies.length ?? 0) + (principle?.when_not.length ?? 0)
  useEffect(() => { track({ name: 'csat_summary_opened', props: { evidence_count: evidence.length, conditions_count: conditionCount } }) }, [evidence.length, conditionCount])
  const changeStage = (index: number) => {
    setStage(index)
    track({ name: 'csat_summary_explored', props: { action: 'stage', index } })
  }
  const chooseEvidence = (key: string) => {
    const e = evidence.find((v) => v.key === key)
    if (!e) return
    setPick(key)
    onShowEvidence?.(e.sentences, `summary:${e.key}`)
    track({ name: 'csat_summary_explored', props: { action: 'evidence', index: evidence.indexOf(e) } })
  }
  const chooseCondition = (kind: 'applies' | 'limit', index: number) => {
    setCondition({ kind, index })
    track({ name: 'csat_summary_explored', props: { action: 'condition', index: kind === 'applies' ? index : (principle?.when_applies.length ?? 0) + index } })
  }
  return (
    <section className={styles.learningSummary} aria-labelledby="summary-title" data-testid="learning-summary" data-checks={checks.readiness}>
      <header className={styles.summaryHeading}>
        <div><span className={styles.summaryEyebrow}>살펴보고 연결하기</span><h2 id="summary-title">학습 정리</h2></div>
        <span className={styles.summaryMode}>탐색 · 채점 없음</span>
      </header>
      <nav className={styles.summaryStages} aria-label="학습 정리 탐색">
        {STAGES.map((label, i) => (
          <button key={label} type="button" aria-current={stage === i ? 'step' : undefined} aria-controls="summary-workbench" onClick={() => changeStage(i)} data-testid={`summary-stage-${i}`}>
            <span aria-hidden="true">{i + 1}</span>{label}
          </button>
        ))}
      </nav>
      <div className={styles.summaryRelation} data-testid="summary-relation">
        <GitBranch size={20} aria-hidden="true" />
        <div><span className={styles.summaryEyebrow}>이번 문항의 핵심 관계</span><p>{relation ?? '이 유형의 핵심 관계 정리를 준비 중이에요.'}</p>
          {units.length ? <small>근거 단위: {units.join(' · ')}</small> : null}</div>
      </div>
      <div id="summary-workbench" className={styles.summaryWorkbench}>
        {stage === 0 ? (
          <div data-testid="summary-evidence">
            <h3>어느 선택지가 눈에 걸렸나요?</h3>
            <p className={styles.summaryHint}>하나를 짚고, 본문 근거와 배제 이유를 연결해 보세요.</p>
            {evidence.length ? (
              <>
                <div className={styles.summaryChoices} role="group" aria-label="추적할 선택지">
                  {evidence.map((e) => <button key={e.key} type="button" aria-pressed={pick === e.key} onClick={() => chooseEvidence(e.key)} data-testid="summary-evidence-choice">{e.choice != null ? `${CIRCLED[e.choice] ?? e.choice} 선택지` : e.title}</button>)}
                </div>
                <div className={styles.summaryTrace} data-active={Boolean(selected)}>
                  <div className={styles.summaryTraceOrigin}><ScanLine size={22} aria-hidden="true" /><b>본문 근거</b>
                    {selected ? <span data-testid="summary-evidence-location">{selected.sentences.length ? `${selected.sentences.join(' · ')}번 문장` : '연결 정보 준비 중'}</span> : <span>선택한 근거가 여기에 연결돼요</span>}
                  </div>
                  <ArrowRight className={styles.summaryTraceArrow} size={24} aria-label="근거에서 판단으로 연결" />
                  <div className={styles.summaryTraceReason} aria-live="polite">
                    {selected ? <><span className={styles.summaryEyebrow}>제공된 배제 이유</span><p data-testid="summary-evidence-item">{selected.body}</p></> : <><MousePointer2 size={24} aria-hidden="true" /><p>위에서 선택지를 골라 연결을 시작하세요.</p></>}
                  </div>
                </div>
                {selected?.sentences.length && onShowEvidence ? <p className={styles.summaryHint}>근거 판에서도 같은 문장을 짚었어요. 다른 선택지와 번갈아 살펴보세요.</p> : null}
              </>
            ) : <p className={styles.summaryEmpty}>이 문항의 검수된 오답 설명을 준비 중이에요. 준비된 원리는 조건 비교에서 살펴볼 수 있어요.</p>}
            <button type="button" className={styles.summaryContinue} onClick={() => changeStage(1)}>이번에는 원리의 경계 보기 <ArrowRight size={16} aria-hidden="true" /></button>
          </div>
        ) : stage === 1 ? (
          <div data-testid="summary-principle">
            <h3>같은 원리, 어디까지 통할까요?</h3>
            <p className={styles.summaryHint}>조건을 번갈아 짚어 보세요. 적용하는 쪽과 멈추는 쪽의 경로가 달라져요.</p>
            {principle ? (
              <>
                <div className={styles.summaryPrincipleNode}><GitBranch size={22} aria-hidden="true" /><p>{principle.statement}</p></div>
                <div className={styles.summaryBranches} data-branch={condition?.kind ?? 'none'}>
                  {(['applies', 'limit'] as const).map((kind) => {
                    const items = kind === 'applies' ? principle.when_applies : principle.when_not
                    return <div key={kind} className={styles.summaryBranch} data-active={condition?.kind === kind}>
                      <span className={styles.summaryBranchLine} aria-hidden="true" />
                      <h4>{kind === 'applies' ? '통하는 조건' : '쓰면 안 되는 조건(반례)'}</h4>
                      {items.length ? items.map((text, index) => <button key={`${kind}-${index}`} type="button" aria-pressed={condition?.kind === kind && condition.index === index} onClick={() => chooseCondition(kind, index)} data-testid={`summary-condition-${kind}`}>{text}</button>) : <p className={styles.summaryHint}>검수된 조건을 준비 중이에요.</p>}
                    </div>
                  })}
                </div>
                <div className={styles.summaryBoundary} data-boundary={condition?.kind ?? 'none'} role="status" data-testid="summary-boundary">
                  <b>{condition ? condition.kind === 'applies' ? '이 조건에서는 원리를 적용' : '이 조건에서는 같은 원리 적용을 멈춤' : '적용 조건과 반례를 비교해 보세요'}</b>
                  <span>{condition ? '검수된 조건의 구분을 살펴보는 탐색이에요. 정오나 숙달을 판정하지 않아요.' : '한쪽을 짚은 뒤 반대쪽도 살펴보면 원리의 경계가 드러나요.'}</span>
                </div>
              </>
            ) : <p className={styles.summaryEmpty}>이 문항의 검수된 원리는 준비 중이에요.</p>}
            <div className={styles.summaryFooter}>
              {canKeep ? <button type="button" onClick={onKeep} disabled={kept} data-testid="summary-keep"><BookOpen size={16} aria-hidden="true" />{kept ? '내 원리에 보관됨' : '이 원리 보관'}</button> : null}
              <button type="button" className={styles.summaryContinue} onClick={() => changeStage(2)}>준비된 활동으로 이어가기 <ArrowRight size={16} aria-hidden="true" /></button>
            </div>
          </div>
        ) : (
          <div data-testid="summary-next">
            <h3>살펴본 관계를 직접 확인해 볼까요?</h3>
            <div className={styles.summaryReadiness} data-testid="summary-checks" data-readiness={checks.readiness}>
              {checks.readiness === 'prepared' ? <><b>준비된 확인 과제 {checks.count}개</b><p>정답 · 근거 · 피드백이 갖춰진 과제로 이어가요.</p></> : <p role="status" data-testid="summary-checks-preparing">확인 과제 준비 중 — 아직 정답과 피드백이 갖춰진 확인 과제가 없어요.</p>}
              <small>해설 뒤 연습과 정리 탐색 · 보관을 숙달 · 목표 달성으로 세지 않아요.</small>
            </div>
            {next.length ? <div className={styles.summaryActivities}>{next.map((a) => a.scene || onLecture ? <button key={a.id} type="button" onClick={() => a.scene ? onGo(a.scene) : onLecture?.()} data-testid={`summary-next-${a.id}`}><span>{a.label}</span><ArrowRight size={17} aria-hidden="true" /></button> : null)}</div> : <p className={styles.summaryEmpty}>이 문항에서 이어 갈 준비된 활동이 아직 없어요.</p>}
          </div>
        )}
      </div>
      {historyState === 'loading' ? <p className={styles.summaryHint} role="status" data-testid="summary-history-loading">이 기기의 과거 기록을 읽는 중이에요…</p> : history ? (
        <details className={styles.summaryHistory} data-testid="summary-history">
          <summary>과거 작성 기록 · 읽기 전용</summary>
          <p>예전에 쓴 설명과 노트는 그대로 보관해요. 수정하거나 채점하지 않아요.</p>{history}
        </details>
      ) : null}
    </section>
  )
}
