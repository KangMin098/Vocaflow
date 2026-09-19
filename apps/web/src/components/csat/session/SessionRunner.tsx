// apps/web/src/components/csat/session/SessionRunner.tsx
'use client'

import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { track } from '@/lib/analytics/client'
import { composeDissection, recordDecision, type DissectionCatalog, type DissectionItem, type DissectionRecord, type Prediction } from '@/lib/csat/dissect'
import { cropOf } from '@/lib/csat/reflow/read-paper'
import { REFLOW_VERSION } from '@/lib/csat/reflow/reflow'
import type { CachedPaper } from '@/lib/csat/reflow/types'
import { cachedExamIds, loadDissectionRecord, saveDissectionRecord, loadPaper } from '@/lib/csat/session/store'
import { PaperDrop } from './PaperDrop'
import { ItemScreen } from './ItemScreen'
import { AnalysisReading } from './AnalysisReading'
import { toItemSlug } from '@/lib/csat/item-slug'
import styles from './session.module.css'

export function SessionRunner({ catalog, initial, formulaTag, explore, resume }: { catalog: DissectionCatalog; initial: string[]; formulaTag?: string; explore?: string; resume?: boolean }) {
  const [reading, setReading] = useState(Boolean(explore))
  const [record, setRecord] = useState<DissectionRecord | null>(null)
  const recordRef = useRef<DissectionRecord | null>(null)
  const [slots, setSlots] = useState<DissectionItem[]>([])
  const [index, setIndex] = useState(0)
  const [pairSeen, setPairSeen] = useState(false)
  const [loci, setLoci] = useState<Record<string, string>>({})
  const [paper, setPaper] = useState<CachedPaper | null | 'missing'>(null)
  const [memoryOnly, setMemoryOnly] = useState(false)
  const startCounts = useRef({ predictions: 0, formulas: 0, families: new Set<string>() })
  const saves = useRef(Promise.resolve())
  useEffect(() => {
    let alive = true
    void Promise.all([loadDissectionRecord(), cachedExamIds(REFLOW_VERSION)]).then(([rec, cached]) => {
      if (!alive) return
      recordRef.current = rec; setRecord(rec)
      startCounts.current = { predictions: rec.predictions.length, formulas: rec.formulas.length, families: new Set(rec.predictions.flatMap(p => p.family ? [p.family] : [])) }
      if (explore) { const siblings = catalog.items.filter(i => i.type_id === catalog.items.find(i => i.id === explore)?.type_id); setSlots(siblings); setIndex(Math.max(0, siblings.findIndex(i => i.id === explore))); const inspected = { ...rec, inspected: [...new Set([...(rec.inspected ?? []), explore])] }; recordRef.current = inspected; setRecord(inspected); saves.current = saves.current.then(async () => { if (!await saveDissectionRecord(inspected)) setMemoryOnly(true) }); return }
      const fromUrl = (resume && rec.active ? rec.active.items : initial).map(id => catalog.items.find(i => i.id === id)).filter((i): i is DissectionItem => Boolean(i))
      const valid = fromUrl.length === 3 && new Set(fromUrl.map(i => i.id)).size === 3 && new Set(fromUrl.map(i => i.type_id)).size === 1 && fromUrl[0].topic !== fromUrl[1].topic
      setSlots(valid ? fromUrl : composeDissection(catalog, rec, Date.now(), cached, formulaTag))
      if (resume && rec.active && valid) { setIndex(rec.active.index); setPairSeen(rec.active.pairSeen); setLoci(rec.active.loci) }
    })
    return () => { alive = false }
  }, [catalog, initial, formulaTag, explore, resume])
  const current = slots[index]
  useEffect(() => {
    if (!current) return
    let alive = true; setPaper(null)
    void loadPaper(current.exam_id, REFLOW_VERSION).then(p => { if (alive) setPaper(p ?? 'missing') })
    return () => { alive = false }
  }, [current])
  const persist = (next: DissectionRecord) => {
    recordRef.current = next; setRecord(next)
    saves.current = saves.current.then(async () => { if (!await saveDissectionRecord(next)) setMemoryOnly(true) })
  }
  const predict = (p: Prediction) => {
    if (!recordRef.current || recordRef.current.inspected?.includes(p.item)) return
    persist({ ...recordRef.current, predictions: [...recordRef.current.predictions, p] })
    track({ name: 'csat_session_explained', props: { kind: p.step === 1 ? 'evidence' : p.step === 2 ? 'reject' : 'more' } })
  }
  useEffect(() => {
    if (!recordRef.current || !slots.length || explore) return
    const next = { ...recordRef.current, active: index < slots.length ? { items: slots.map(i => i.id), index, pairSeen, loci } : undefined }
    recordRef.current = next
    saves.current = saves.current.then(async () => { if (!await saveDissectionRecord(next)) setMemoryOnly(true) })
  }, [index, slots, pairSeen, loci, explore])
  if (!record) return <p aria-busy="true" className={styles.quiet}>해부할 문항을 여는 중…</p>
  if (!slots.length) return <section className={styles.empty}><p>이 공식으로 대조할 문항을 준비하고 있어요.</p><Link className={styles.primary} href="/csat">홈으로</Link></section>
  if (!explore && !reading && index === 2 && !pairSeen) return <section className={styles.pair} data-testid="pair-comparison"><p className={styles.eyebrow}>두 문항을 나란히 기억해 봅니다</p><h1>같은 유형,<br />어디가 달랐나요?</h1><dl><dt>같았던 것</dt><dd>{slots[0].formula === slots[1].formula ? slots[0].formula : '같은 유형에서도 근거를 연결하는 방식은 달랐어요.'}</dd><dt>달랐던 것</dt><dd>{slots[0].topic} / {slots[1].topic}<br />{slots[0].format} / {slots[1].format}<br />근거 자리 · {loci[slots[0].id]} / {loci[slots[1].id]}</dd></dl><p className={styles.quiet}>마지막 한 문항에서 직접 확인해 보세요.</p><button className={styles.primary} onClick={() => { setPairSeen(true); window.scrollTo(0, 0) }}>다른 지문에서 확인하기</button></section>
  if (!current) {
    const predictions = record.predictions.slice(startCounts.current.predictions)
    const families = [...new Set(predictions.flatMap(p => p.family ? [p.family] : []))].filter(f => !startCounts.current.families.has(f))
    return <section className={styles.finish} data-testid="finish"><p className={styles.eyebrow}>오늘의 해부</p><h1>출제자의 수를<br />한 번 더 읽었어요.</h1><p>예측 {predictions.filter(p => p.hit).length}/{predictions.length} 적중 · 공식 +{record.formulas.length - startCounts.current.formulas} · 새 계열 {families.length}</p>{memoryOnly && <p role="status">기기 저장이 막혀 이번 창을 닫으면 기록이 사라져요.</p>}<Link href="/csat" className={styles.primary}>홈으로</Link><Link href="/csat/dissect" className={styles.textButton} onClick={() => window.location.assign('/csat/dissect')}>한 유형 더</Link></section>
  }
  const reflow = paper && paper !== 'missing' ? paper.items.find(i => i.no === current.no) : null
  const transferSource = record.queue.find(q => q.due <= Date.now() && q.tag === current.formulaTag && q.source !== current.id)
  const transferFormula = transferSource ? catalog.items.find(i => i.id === transferSource.source)?.formula : slots[0].formula
  return <>
    <nav className={styles.contextNav} aria-label="기출 학습 위치">
      <Link className={styles.textButton} href="/csat">학습 허브</Link>
      <span>{catalog.types.find(t => t.id === current.type_id)?.name} · {current.exam_id} {current.no}번</span>
      <details className={styles.typeGroup}><summary>다른 문항 보기</summary>{catalog.items.map(other => <Link key={other.id} className={styles.exploreRow} aria-current={other.id === current.id ? 'page' : undefined} href={`/csat/dissect?item=${toItemSlug(other.id)}`}>{other.exam_id} · {other.no}번 · {other.topic}</Link>)}</details>
      {index > 0 && <Link className={styles.textButton} href={`/csat/dissect?item=${toItemSlug(slots[index - 1].id)}`}>이전 문항</Link>}
      {index + 1 < slots.length && <Link className={styles.textButton} href={`/csat/dissect?item=${toItemSlug(slots[index + 1].id)}`}>다음 문항</Link>}
      {!reading && <button className={styles.textButton} onClick={() => { if (recordRef.current) persist({ ...recordRef.current, inspected: [...new Set([...(recordRef.current.inspected ?? []), current.id])] }); setReading(true) }}>분석 바로 읽고 듣기</button>}
      {reading && !explore && <button className={styles.textButton} onClick={() => setReading(false)}>예측 학습으로 돌아가기</button>}
    </nav>
    {!reading && record.inspected?.includes(current.id) && <p className={styles.quiet}>분석을 먼저 읽은 문항이에요. 다시 예측할 수 있지만 적중 통계에는 넣지 않아요.</p>}
    {memoryOnly && <p className={styles.quiet} role="status">기기 저장이 막혀 이번 창에서만 기록을 보관해요.</p>}
    {paper === null ? <p aria-busy="true" className={styles.quiet}>문제지를 여는 중…</p> : !reflow ? <section className={styles.empty}><h1>{catalog.exams[current.exam_id]?.label} · {current.no}번</h1><PaperDrop catalog={catalog} needed={[current.exam_id]} compact onLoaded={p => { if (p.exam_id === current.exam_id) setPaper(p) }} /></section> : reading ? <AnalysisReading key={current.id} item={current} paper={reflow} onReadAgain={() => setPaper('missing')} /> : <ItemScreen key={current.id} draft={recordRef.current?.drafts?.[current.id]} onDraft={draft => { if (recordRef.current) persist({ ...recordRef.current, drafts: { ...recordRef.current.drafts, [current.id]: draft } }) }} item={current} seq={index + 1} paper={reflow} crop={cropOf(current.exam_id, current.no)} seed={record.seed} typeName={catalog.types.find(t => t.id === current.type_id)?.name ?? '기출'} transferFormula={transferFormula} onReadAgain={() => setPaper('missing')} onPrediction={predict} onDone={async (decision, evidenceLocus) => {
      if (!recordRef.current) return
      const next = recordDecision(recordRef.current, current, decision, Date.now(), catalog.items)
      if (next.drafts) { next.drafts = { ...next.drafts }; delete next.drafts[current.id] }
      setLoci(previous => ({ ...previous, [current.id]: evidenceLocus })); persist(next); await saves.current
      setIndex(i => i + 1); window.scrollTo(0, 0)
    }} />}
  </>
}
