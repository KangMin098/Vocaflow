// apps/web/src/components/csat/session/ProgressView.tsx
//
// 내 공식 — 기출분석공간(3B) 판면: 수치 줄(공식 수 · 예측 적중률 · 함정 계열) → 유형별 공식 목록 → 출처 문항.
// 2026-10-10 1440 통합: 일반 앱 셸의 Tines 히어로 · 파스텔 수치 카드 · 삽화를 걷고 「내 기록」과 같은 3B 부품(meters · list)으로.
// 기록은 다른 화면과 같이 서버 사본과 합쳐 읽는다(G1). 다음 행동은 하나 — 공식이 있으면 그 공식으로 해부, 없으면 첫 해부.
'use client'

import { ArrowUpRight } from 'lucide-react'
import Link from 'next/link'
import { useEffect, useState } from 'react'

import { predictionStats, type DissectionCatalog, type DissectionRecord } from '@/lib/csat/dissect'
import { loadSyncedDissectionRecord } from '@/lib/csat/session/store'
import { toItemSlug } from '@/lib/csat/item-slug'
import home from '../home/home.module.css'

export function ProgressView({ catalog }: { catalog: DissectionCatalog }) {
  const [record, setRecord] = useState<DissectionRecord | null>(null)
  useEffect(() => { let alive = true; void loadSyncedDissectionRecord().then(r => { if (alive) setRecord(r.record) }); return () => { alive = false } }, [])
  if (!record) return <p className={home.empty} aria-busy="true">공식을 펼치는 중…</p>
  const stats = predictionStats(record, catalog.families)
  const types = [...new Set(record.formulas.map(x => x.type))]
  const source = (id: string) => { const [exam, no] = id.split('#'); return `${catalog.exams[exam]?.label ?? exam} ${no}번` }
  const pct = stats.total ? Math.round((100 * stats.seen) / stats.total) : 0
  return <div data-csat-formulas>
    <section className={home.section}>
      <h2 className={home.sectionHead}>내 공식 <small>직접 대조해 남긴 출제 공식 — 유형 → 공식 → 출처</small></h2>
      <dl className={home.meters} data-testid="formula-metrics">
        <div className={home.meter}><dt>공식 수</dt><dd>{stats.formulas}</dd></div>
        <div className={home.meter}><dt>예측 적중률 <small>최근 30수</small></dt><dd>{stats.hit === null ? '—' : `${stats.hit}%`}</dd></div>
        <div className={home.meter}>
          <dt>만난 함정 계열</dt>
          <dd>{stats.seen} <small>/ {stats.total}</small></dd>
          <span className={home.bar} aria-hidden="true"><span style={{ width: `${pct}%` }} /></span>
        </div>
      </dl>
    </section>

    {!types.length ? (
      <section className={home.section}>
        <p className={home.empty}>아직 남긴 공식이 없어요. 해부에서 예측하고 대조한 뒤 「내 공식으로 저장」을 고르면 여기에 쌓여요.</p>
        <p className={home.daysLegend}><Link href="/csat/dissect" className="underline underline-offset-4">첫 해부 시작하기</Link></p>
      </section>
    ) : types.map(type => {
      const list = record.formulas.filter(x => x.type === type)
      return <section className={home.section} key={type}>
        <h2 className={home.sectionHead}>{catalog.types.find(t => t.id === type)?.name ?? type} <small>공식 {list.length}</small></h2>
        <ul className={home.list}>{list.map(x => <li key={x.tag}>
          <Link href={`/csat/dissect?formula=${encodeURIComponent(x.tag)}`}>
            <span className={home.grow}>{x.text}</span>
            <small>이 공식으로 해부</small>
            <ArrowUpRight size={13} aria-hidden="true" />
          </Link>
        </li>)}</ul>
        <p className={home.daysLegend}>출처 {list.flatMap(x => x.sources).filter((v, i, a) => a.indexOf(v) === i).map((id, i) => <span key={id}>{i ? ' · ' : ''}<Link href={`/csat/item/${toItemSlug(id)}`} className="underline underline-offset-4">{source(id)}</Link></span>)}</p>
      </section>
    })}
  </div>
}
