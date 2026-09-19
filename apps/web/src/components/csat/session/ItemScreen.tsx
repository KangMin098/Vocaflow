// apps/web/src/components/csat/session/ItemScreen.tsx
'use client'

import { Check } from 'lucide-react'
import { Fragment, useEffect, useMemo, useRef, useState } from 'react'
import { hashTag, shuffled, type DissectionItem, type Prediction, type DissectionDraft } from '@/lib/csat/dissect'
import type { ReflowItem } from '@/lib/csat/reflow/types'
import { segmentsOf } from '@/lib/csat/session/passage-model'
import { buildDissectionPassage } from '@/lib/csat/dissection-passage'
import { PlainPassage } from './ReflowPassage'
import styles from './session.module.css'

type Phase = 'scan' | 'predict1' | 'compare1' | 'predict2' | 'compare2' | 'predict3' | 'compare3' | 'blueprint' | 'formula'
const CIRC = ['', '①', '②', '③', '④', '⑤']
export function ItemScreen(props: { draft?: DissectionDraft; onDraft?: (draft: DissectionDraft) => void; item: DissectionItem; paper: ReflowItem; crop: string | null; seed: number; seq: number; typeName: string; transferFormula?: string; onReadAgain: () => void; onPrediction: (p: Prediction) => void; onDone: (decision: 'save' | 'unsure' | 'transfer', evidenceLocus: string) => Promise<void> }) {
  return <DissectionBody {...props} />
}
function DissectionBody({ draft, onDraft, item, paper, crop, seed, seq, typeName, transferFormula, onReadAgain, onPrediction, onDone }: Parameters<typeof ItemScreen>[0]) {
  const [phase, setPhase] = useState<Phase>(draft?.phase ?? (seq === 3 ? 'predict1' : 'scan'))
  const [selection, setSelection] = useState<string | null>(draft?.selection ?? null)
  const [answers, setAnswers] = useState<{ step: number; hit: boolean; selection: string }[]>(draft?.answers ?? [])
  const draftCallback = useRef(onDraft); draftCallback.current = onDraft
  useEffect(() => { draftCallback.current?.({ phase, selection, answers }) }, [phase, selection, answers])
  const [busy, setBusy] = useState(false)
  const [history, setHistory] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const model = useMemo(() => buildDissectionPassage(paper.passage, item.skeleton), [paper.passage, item.skeleton])

  const evidence = model.sentences.filter(s => s.marks.some(m => m.anchorId === 'answer')).map(s => s.i)
  const trapSentence = model.choiceSentence[item.distractor.n]
  const evidenceLabel = evidence.map(i => `${i + 1}번째 문장`).join(' · ')
  const step = phase.endsWith('1') ? 1 : phase.endsWith('2') ? 2 : 3
  const compared = answers.length
  const predict = phase.startsWith('predict')
  const compare = phase.startsWith('compare')
  const options = useMemo(() => shuffled(phase.endsWith('2') ? item.trapOptions : item.intentOptions, seed ^ parseInt(hashTag(item.id + step), 36)), [item, phase, seed, step])
  useEffect(() => {
    if (!compare) return
    const target = step === 1 ? evidence[0] : step === 2 ? trapSentence : undefined
    const el = target === undefined ? heading.current : document.querySelector<HTMLElement>(`[data-sentence="${target}"]`)
    el?.scrollIntoView({ block: 'center', behavior: 'auto' })
    heading.current?.focus({ preventScroll: true })
  // The submitted step changes the inline note and focus exactly once.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase])
  const move = (next: Phase) => { setSelection(null); setPhase(next); requestAnimationFrame(() => heading.current?.focus()) }
  const submit = () => {
    if (selection === null) return
    const hit = step === 1 ? evidence.includes(Number(selection)) : selection === (step === 2 ? item.distractor.family : item.intent)
    setAnswers(a => [...a, { step, hit, selection }])
    onPrediction({ item: item.id, type: item.type_id, step, hit, at: Date.now(), ...(step === 2 ? { family: item.distractor.family } : {}) })
    move(`compare${step}` as Phase)
  }
  const finish = async (decision: 'save' | 'unsure' | 'transfer') => {
    if (busy) return
    setBusy(true)
    try { await onDone(decision, evidenceLabel) } finally { setBusy(false) }
  }
  const question = step === 1 ? '정답 근거는 어느 문장에 심었을까요?' : step === 2 ? '이 오답은 어떤 제조법일까요?' : '출제 의도는 무엇일까요?'
  const summary = [ ['소재', item.topic], ['형식', item.format], ['근거 자리', evidenceLabel], ['함정 계열', item.distractor.family], ['의도', item.intent] ]
  if (!paper.ok || !evidence.length || trapSentence === undefined) return <section className={styles.empty}>
    {/* Local blob URL; Next image optimization would send learner material to a server. */}
    {/* eslint-disable-next-line @next/next/no-img-element */}
    {crop && <img src={crop} alt="이 기기에서 추출한 문항 영역" className={styles.crop} />}
    <p>문장 위치를 확인하지 못했어요. 문제지 텍스트를 다시 읽어 주세요.</p><button className={styles.primary} onClick={onReadAgain}>문제지 다시 놓기</button>
  </section>
  return <article className={styles.item} data-testid="item-screen" data-phase={phase}>
    <header className={styles.itemHeader}>
      <p className={styles.eyebrow}>{seq} / 3 · {typeName}{seq === 3 ? ' · 전이' : ''}</p>
      <h1 ref={heading} tabIndex={-1}>{phase === 'scan' ? '정답을 알고, 지문을 봅니다.' : predict || compare ? question : phase === 'blueprint' ? (seq === 3 ? '이 공식이 여기서도?' : '출제자의 설계도') : '다음 지문에 남길 한 줄'}</h1>
      <p className={styles.quiet}>{item.exam_id} · {item.no}번</p>
      <p className={styles.material} data-testid="source-context">{item.topic} <span> / </span> {item.format}</p>
    </header>
    {phase === 'scan' && <p className={styles.quiet}>훑기 · 약 30초, 서두르지 않아도 좋아요.</p>}
    {phase !== 'blueprint' && phase !== 'formula' && <>
    <p className={styles.stem}>{paper.stem}</p>
    {phase === 'scan' ? <PlainPassage passage={paper.passage} /> : <div className={styles.passage} data-testid="passage" data-lecture-target="analysis:map">
      {model.sentences.map(s => {
        const actual = compared >= 1 && evidence.includes(s.i)
        const trap = compared >= 2 && s.i === trapSentence
        const chosen = answers[0]?.selection === String(s.i) || phase === 'predict1' && selection === String(s.i)
        const body = <>{segmentsOf(s, trap ? ['reject', 'tempt'] : actual ? ['evidence'] : []).map((seg, k) => <span key={k} className={seg.marked ? styles.underline : undefined}>{seg.text}</span>)}</>
        return <Fragment key={s.i}>
          <div data-sentence={s.i} data-lecture-target={`anchor:sentence:${s.skeleton[0] ?? s.i}`} className={`${styles.sentence} ${actual ? styles.actual : ''} ${trap ? styles.target : ''}`}>
            {phase === 'predict1' ? <button className={styles.sentenceButton} onClick={() => setSelection(String(s.i))} aria-pressed={selection === String(s.i)} lang="en"><span aria-hidden className={styles.sentenceNo}>{s.i + 1}</span>{body}</button> : <p lang="en">{chosen && <span className={styles.selectedLabel} lang="ko">내 선택 </span>}{body}</p>}
          </div>
          {compared >= 1 && s.i === evidence[0] && <aside className={styles.note} data-testid="evidence-note"><strong>{answers[0].hit ? '적중' : '출제자는 여기를 봤다'} · {evidenceLabel}</strong><p>{item.evidence}</p></aside>}
          {compared >= 2 && trap && <aside className={styles.note} data-testid="trap-note" data-lecture-target={`analysis:reject:${item.distractor.n}`}><strong>{answers[1].hit ? '적중' : '출제자는 여기를 봤다'} · {item.distractor.family}</strong><p>{item.distractor.line}</p></aside>}
        </Fragment>
      })}
    </div>}
    {paper.notes.length > 0 && <p className={styles.quiet} lang="en">{paper.notes.join(' · ')}</p>}
    <ol className={styles.choices} aria-label="선지와 공개된 정답">
      {Array.from({ length: 5 }, (_, k) => k + 1).map(n => <li key={n} className={n === item.answer ? styles.answer : ''} data-answer={n === item.answer}>
        <span aria-hidden>{CIRC[n]}</span><span lang={paper.inline ? 'ko' : undefined}>{paper.choices[n - 1] || `지문 속 ${CIRC[n]}`}</span>{n === item.answer && <strong><Check size={15} aria-hidden /> 정답</strong>}
      </li>)}
    </ol></>}
    {(phase === 'predict2' || phase === 'compare2') && <p className={styles.promptTarget}>들여다볼 오답 <strong>{CIRC[item.distractor.n]}</strong> · {paper.choices[item.distractor.n - 1] || '지문 속 표시'}</p>}
    {predict && step > 1 && <fieldset className={styles.options}><legend>{step === 2 ? '함정 계열 하나를 고르세요' : '의도 하나를 고르세요'}</legend>{options.map(option => <label key={option} className={styles.option}><input type="radio" name={`prediction-${step}`} checked={selection === option} onChange={() => setSelection(option)} /><span>{option}</span></label>)}</fieldset>}
    {compared >= 3 && phase !== 'blueprint' && phase !== 'formula' && <aside className={styles.note} data-testid="intent-note" data-lecture-target="analysis:intent"><strong>{answers[2].hit ? '적중' : '출제자는 여기를 봤다'}</strong><p>{item.intent}</p></aside>}
    {phase === 'blueprint' && <section data-testid="blueprint" className={styles.blueprint}>
      {seq === 3 && <p className={styles.comparison}>{transferFormula === item.formula ? '같았음' : '달랐음'} · {transferFormula === item.formula ? '다른 소재에서도 같은 설계 규칙을 확인했어요.' : '근거를 연결하는 방식이 달랐어요.'}</p>}
      <dl>{summary.map(([label, value]) => <div key={label}><dt>{label}</dt><dd data-source={label}>{value}</dd></div>)}</dl>
      {seq !== 3 && <div className={styles.variant}><h2>같은 설계를 다르게 내면?</h2><p>소재가 ‘{item.history[0].topic}’로 바뀌어도 {item.format}의 관계를 근거로 찾을 수 있을까요?</p><button className={styles.textButton} aria-expanded={history} onClick={() => setHistory(v => !v)}>근거 보기</button>{history && <p className={styles.quiet}>같은 형식의 기출 {item.history.map(h => h.id.replace('#', ' · ') + '번').join(', ')}. 동일 원문을 변형했다는 뜻은 아니에요.</p>}</div>}
    </section>}
    {phase === 'formula' && <section className={styles.formula} data-testid="formula"><p className={styles.eyebrow}>내가 가져갈 출제 공식</p><h2>{item.formula}</h2></section>}
    <div className={`${styles.action} ${phase === 'blueprint' || phase === 'formula' ? styles.finalAction : ''}`}>
      {phase === 'scan' && <button className={styles.primary} onClick={() => move('predict1')}>출제자의 수 예측하기</button>}
      {predict && <button className={styles.primary} disabled={selection === null} onClick={submit}>{step === 1 ? '이 문장' : '이 예측으로 대조하기'}</button>}
      {compare && <button className={styles.primary} onClick={() => move(step === 1 ? 'predict2' : step === 2 ? 'predict3' : 'blueprint')}>{step === 3 ? '설계도 보기' : '다음 수 예측하기'}</button>}
      {phase === 'blueprint' && <button className={styles.primary} disabled={busy} onClick={() => seq === 3 ? void finish('transfer') : move('formula')}>{seq === 3 ? '오늘의 해부 마치기' : '공식 한 줄 남기기'}</button>}
      {phase === 'formula' && <><button className={styles.primary} disabled={busy} onClick={() => void finish('save')}>내 공식에 넣기</button><button className={styles.textButton} disabled={busy} onClick={() => void finish('unsure')}>아직 모르겠음</button></>}
    </div>
  </article>
}
