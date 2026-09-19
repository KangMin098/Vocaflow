// apps/web/src/components/csat/session/SessionHome.tsx
'use client'

import { ArrowRight, Headphones } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useState } from 'react'
import { track } from '@/lib/analytics/client'
import { composeDissection, emptyDissectionRecord, type DissectionCatalog, type DissectionItem, type DissectionRecord } from '@/lib/csat/dissect'
import { patternGroups, recommendationReason } from '@/lib/csat/learning-home'
import { REFLOW_VERSION } from '@/lib/csat/reflow/reflow'
import { cachedExamIds, loadDissectionRecord, saveDissectionRecord } from '@/lib/csat/session/store'
import { toItemSlug } from '@/lib/csat/item-slug'
import { PaperDrop } from './PaperDrop'
import { PatternComparison } from './PatternComparison'
import { PatternMap } from './PatternMap'
import styles from './session.module.css'
import home from './learning-home.module.css'

export const PRIMARY = styles.primary
export function dissectionHref(items: DissectionItem[]) {
  return `/csat/dissect?set=${encodeURIComponent(items.map(i => toItemSlug(i.id)).join(','))}`
}
const itemHref = (item: DissectionItem, section?: string) => `/csat/dissect?item=${toItemSlug(item.id)}${section ? `#analysis-${section}` : ''}`
export function SessionHome({ catalog }: { catalog: DissectionCatalog }) {
  const router = useRouter()
  const [state, setState] = useState<{ record: DissectionRecord; cached: string[]; plan: DissectionItem[]; now: number } | null>(null)
  const [busy, setBusy] = useState(false)
  const [pattern, setPattern] = useState(0)
  const [filter, setFilter] = useState('all')
  const groups = patternGroups(catalog.items)
  const selected = groups[pattern] ?? groups[0]
  useEffect(() => {
    let alive = true
    void Promise.all([loadDissectionRecord(), cachedExamIds(REFLOW_VERSION)]).then(([record, cached]) => {
      const now = Date.now()
      if (alive) setState({ record, cached, plan: composeDissection(catalog, record, now, cached), now })
    })
    return () => { alive = false }
  }, [catalog])
  // Real comparison survives SSR; private progress arrives after hydration.
  const record = state?.record ?? emptyDissectionRecord(0)
  const plan = state?.plan ?? []
  const needed = [...new Set(plan.map(i => i.exam_id))].filter(e => !state?.cached.includes(e))
  const type = catalog.types.find(t => t.id === plan[0]?.type_id)?.name ?? '기출 분석'
  const active = record.active && record.active.index < record.active.items.length ? record.active : null
  const start = async () => {
    if (busy || !state || plan.length !== 3) return
    setBusy(true)
    await saveDissectionRecord({ ...record, onboarded: true })
    track({ name: 'csat_session_started', props: { size: plan.length, review: record.queue.some(q => q.due <= state.now), needed: new Set(plan.map(i => i.exam_id)).size, cached: new Set(plan.map(i => i.exam_id).filter(e => state.cached.includes(e))).size } })
    router.push(dissectionHref(plan))
  }
  const filtered = catalog.items.filter(i => filter === 'all' || i.formulaTag === filter || filter === 'seen' && (record.inspected?.includes(i.id) || record.predictions.some(p => p.item === i.id)))
  return <div className={home.home} data-csat-home>
    <header className={home.masthead}><span>CSAT <span className={home.kicker}>출제자의 설계 읽기</span></span><Link className={styles.textButton} href="/csat/formulas">내 공식 <ArrowRight size={15} aria-hidden /></Link></header>
    {active && <Link className={home.resume} href="/csat/dissect?resume=1"><span>하던 학습 이어가기</span><strong>{active.items[active.index].replace('#', ' · ')}번부터 <ArrowRight size={16} aria-hidden /></strong></Link>}
    <div className={home.opening}>
      <section className={home.proof} aria-labelledby="home-title" data-testid="pattern-proof">
        <p className={home.kicker}>소재 너머의 공통점</p>
        <h1 id="home-title">다른 지문, 같은 설계.</h1>
        <p className={home.intro}>정답을 알고, 근거와 오답을 만든 설계를 읽어요.</p>
        {selected ? <>
          <div className={home.patternControls} role="group" aria-label="비교할 출제 패턴">{groups.map((group, index) => <button key={group.tag} aria-pressed={pattern === index} onClick={() => setPattern(index)}>{group.format}</button>)}</div>
          <PatternComparison key={selected.tag} items={selected.items} />
          <Link className={styles.textButton} href={itemHref(selected.items[0], 'evidence')}>실제 근거에서 확인하기 <ArrowRight size={16} aria-hidden /></Link>
        </> : <p className={styles.quiet}>비교할 기출 분석을 준비하고 있어요.</p>}
      </section>
      <section className={home.today} data-testid="today-card" aria-labelledby="today-title" aria-busy={!state}>
        <p className={home.kicker}>오늘의 해부</p><h2 id="today-title">{type}</h2>
        {plan.length === 3 ? <>
          <p className={home.sessionKind}>{plan[0].formulaTag === plan[1].formulaTag ? '같은 설계, 다른 소재' : '같은 유형, 다른 설계'}</p>
          <p className={home.reason} data-testid="recommendation-reason">{recommendationReason(catalog, plan, record, state!.now)}</p>
          <div className={home.sessionMeta}><span>{plan.length}문항 · 예측 → 대조 → 전이</span><span>예상 {plan.length * 4}분</span></div>
          <button className={`${PRIMARY} ${home.start}`} onClick={() => void start()} disabled={busy} data-testid="start">{busy ? '여는 중…' : '시작'}<ArrowRight size={18} aria-hidden /></button>
          <ol className={home.itinerary}>{plan.map((item, index) => <li key={item.id}><span className={home.step}>{String(index + 1).padStart(2, '0')}</span><div><span className={home.reference}>{index === 2 ? '다른 문항에서 전이' : index === 0 ? '먼저 예측하기' : '설계 대조하기'} · {item.exam_id} {item.no}번</span><p>{item.format}</p></div></li>)}</ol>
          {needed.length > 0 ? <details className={home.paper}><summary>PDF {needed.length}개 필요 · 미리 준비하기</summary><PaperDrop catalog={catalog} needed={needed} onLoaded={p => setState(s => s ? { ...s, cached: [...new Set([...s.cached, p.exam_id])] } : s)} /></details> : <p className={home.localNote}>이 기기의 문제지로 바로 시작할 수 있어요.</p>}
        </> : <p className={styles.quiet}>{state ? '추천할 분석을 준비하고 있어요.' : '기기 기록을 확인하고 있어요…'}{state && <button className={styles.textButton} onClick={() => router.refresh()}>다시 확인</button>}</p>}
      </section>
    </div>
    <section className={home.learningPath} aria-labelledby="path-title">
      <div><p className={home.kicker}>한 문항에서 다음 문항으로</p><h2 id="path-title">정답 다음에 남는 것</h2></div>
      <ol>{[{ name: '예측', detail: '근거는 어디에 있을까', href: plan.length ? dissectionHref(plan) : '#explore-title' }, { name: '설계 읽기', detail: '근거 → 함정 → 의도', href: selected ? itemHref(selected.items[0], 'evidence') : '#explore-title' }, { name: '전이', detail: '소재가 바뀌어도 통할까', href: plan.length ? dissectionHref(plan) : '#explore-title' }, { name: '패턴 축적', detail: '내 언어로 남긴 공식', href: '/csat/formulas' }].map(step => <li key={step.name}><Link href={step.href}><strong>{step.name}</strong><span>{step.detail}</span></Link></li>)}</ol>
    </section>
    <section className={home.patternMap} aria-labelledby="map-title">
      <div className={home.sectionHead}><div><p className={home.kicker}>나의 탐색 지도</p><h2 id="map-title">어디까지 읽었나요?</h2></div><p>정답률 대신, 살펴본 원리의 흔적을 남겨요.</p></div>
      <PatternMap items={catalog.items} record={record} />
      <div className={home.mapFoot}><Link className={styles.textButton} href="/csat/formulas">내 공식에서 이어가기 →</Link>{record.queue.length > 0 && <span>{record.queue.length}개 원리를 다시 확인하려고 남겼어요.</span>}</div>
    </section>
    <section className={home.exploration} aria-labelledby="explore-title">
      <div className={home.sectionHead}><div><p className={home.kicker}>자유롭게 읽기</p><h2 id="explore-title">궁금한 문항부터</h2></div><p><Headphones size={16} aria-hidden /> 분석을 읽고, 같은 설명을 들을 수 있어요.</p></div>
      <label className={home.filter}>살펴볼 원리 <select value={filter} onChange={e => setFilter(e.target.value)}><option value="all">전체 문항</option><option value="seen">내가 살펴본 문항</option>{groups.map(group => <option key={group.tag} value={group.tag}>{group.format}</option>)}</select></label>
      {filtered.length ? <ul className={home.index}>{filtered.map(item => <li key={item.id}><Link href={itemHref(item)}><span className={home.reference}>{item.exam_id} · {item.no}번</span><strong>{item.topic}</strong><span className={home.itemFormat}>{item.format}</span><ArrowRight size={16} aria-hidden /></Link></li>)}</ul> : <p className={home.empty}>아직 살펴본 문항이 없어요. <button className={styles.textButton} onClick={() => setFilter('all')}>전체 문항 보기</button></p>}
    </section>
  </div>
}
