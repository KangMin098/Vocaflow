// apps/web/src/components/csat/session/ProgressView.tsx
//
// 내 공식 — 참조(Tines) 사례 상세 골격(DD-68 · tines-mapping 「기출 홈」): 히어로 + 소품 → 강조 수치 3칸(면마다 다른 색) →
// 계보 카드(유형 → 공식 → 출처로 접히는 이력). 기록은 이 기기에만 있다.
'use client'

import { ArrowLeft, ArrowRight } from 'lucide-react'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { SpotState } from '@/components/ui/SpotState'
import { BTN } from '@/components/ui/tines-kit'
import { predictionStats, type DissectionCatalog, type DissectionRecord } from '@/lib/csat/dissect'
import { loadDissectionRecord } from '@/lib/csat/session/store'
import { TINT_CLASS } from '@/lib/design/tone'
import styles from './session.module.css'
import f from './formulas.module.css'

export function ProgressView({ catalog }: { catalog: DissectionCatalog }) {
  const [record, setRecord] = useState<DissectionRecord | null>(null)
  useEffect(() => { let alive = true; void loadDissectionRecord().then(r => { if (alive) setRecord(r) }); return () => { alive = false } }, [])
  if (!record) return <p className={styles.quiet} aria-busy="true">공식을 펼치는 중…</p>
  const stats = predictionStats(record, catalog.families)
  const types = [...new Set(record.formulas.map(x => x.type))]
  const source = (id: string) => { const [exam, no] = id.split('#'); return `${catalog.exams[exam]?.label ?? exam} ${no}번` }
  return <div className={f.page} data-csat-formulas>
    <header className={f.hero}>
      <div>
        <Link href="/csat" className={BTN.text}><ArrowLeft size={15} aria-hidden /> 오늘의 해부</Link>
        <p className={f.chip}>CSAT · 계보</p>
        <h1>내 공식</h1>
        <p className={f.intro}>직접 대조해 남긴 출제 공식이 유형 → 공식 → 출처로 쌓여요. 기록은 이 기기에만 있어요.</p>
      </div>
      <Image className={f.spot} src="/illustrations/tines/spot-vault.webp" alt="" width={1328} height={1328} priority />
    </header>

    <dl className={f.metrics} data-testid="formula-metrics">
      <div className={TINT_CLASS.lavender}><dt>공식 수</dt><dd>{stats.formulas}</dd></div>
      <div className={TINT_CLASS.green}><dt>예측 적중률 <small>최근 30수</small></dt><dd>{stats.hit === null ? '—' : `${stats.hit}%`}</dd></div>
      <div className={TINT_CLASS.peach}><dt>함정 계열 커버리지</dt><dd>{stats.seen}<small>/{stats.total}</small></dd>
        <span className={f.meter} aria-hidden><span style={{ width: `${stats.total ? Math.round(100 * stats.seen / stats.total) : 0}%` }} /></span></div>
    </dl>

    {!types.length
      ? <div className={f.emptyCard}><SpotState art="empty-vault" title="아직 남긴 공식이 없어요" body="예측하고 대조한 뒤 내 언어로 적은 출제 공식이 여기에 쌓여요." primary={{ label: '첫 공식 만나기', href: '/csat' }} /></div>
      : <div className={f.lineage}>{types.map(type => {
        const list = record.formulas.filter(x => x.type === type)
        return <details className={f.typeCard} key={type} open>
          <summary><strong>{catalog.types.find(t => t.id === type)?.name ?? type}</strong><span>공식 {list.length}개</span></summary>
          <ul>{list.map(x => <li key={x.tag}><details className={f.formula}>
            <summary>{x.text}</summary>
            <div className={f.formulaBody}>
              <p className={f.sources}>{x.sources.map(id => <span key={id}>{source(id)}</span>)}</p>
              <Link href={`/csat/dissect?formula=${encodeURIComponent(x.tag)}`} className={BTN.text}>이 공식으로 해부하기 <ArrowRight size={15} aria-hidden /></Link>
            </div>
          </details></li>)}</ul>
        </details>
      })}</div>}
  </div>
}
