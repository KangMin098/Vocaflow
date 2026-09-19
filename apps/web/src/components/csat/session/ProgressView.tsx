// apps/web/src/components/csat/session/ProgressView.tsx
'use client'

import Link from 'next/link'
import { useEffect, useState } from 'react'
import { predictionStats, type DissectionCatalog, type DissectionRecord } from '@/lib/csat/dissect'
import { loadDissectionRecord } from '@/lib/csat/session/store'
import styles from './session.module.css'

export function ProgressView({ catalog }: { catalog: DissectionCatalog }) {
  const [record, setRecord] = useState<DissectionRecord | null>(null)
  useEffect(() => { let alive = true; void loadDissectionRecord().then(r => { if (alive) setRecord(r) }); return () => { alive = false } }, [])
  if (!record) return <p className={styles.quiet} aria-busy="true">공식을 펼치는 중…</p>
  const stats = predictionStats(record, catalog.families)
  const types = [...new Set(record.formulas.map(f => f.type))]
  return <div className={styles.formulasPage}>
    <Link href="/csat" className={styles.textButton}>← 오늘의 해부</Link><h1>내 공식</h1>
    <dl className={styles.metrics} data-testid="formula-metrics"><div><dt>공식 수</dt><dd>{stats.formulas}</dd></div><div><dt>예측 적중률<small>최근 30수</small></dt><dd>{stats.hit === null ? '—' : `${stats.hit}%`}</dd></div><div><dt>계열 커버리지</dt><dd>{stats.seen}/{stats.total}</dd></div></dl>
    {!types.length ? <section className={styles.empty}><p>직접 대조한 출제 공식이 여기에 남아요.</p><Link className={styles.primary} href="/csat">첫 공식 만나기</Link></section> : types.map(type => <details className={styles.typeGroup} key={type}><summary>{catalog.types.find(t => t.id === type)?.name ?? type}</summary>{record.formulas.filter(f => f.type === type).map(f => <details className={styles.formulaRow} key={f.tag}><summary>{f.text}</summary><p className={styles.quiet}>{f.sources.map(id => { const [exam, no] = id.split('#'); return `${catalog.exams[exam]?.label ?? exam} ${no}번` }).join(' · ')}</p><Link href={`/csat/dissect?formula=${encodeURIComponent(f.tag)}`} className={styles.textButton}>이 공식으로 해부하기 →</Link></details>)}</details>)}
  </div>
}
