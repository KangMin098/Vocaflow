// apps/web/src/components/csat/diagnosis/map/CoreSummary.tsx
//
// 핵심 지도 요약(첫 화면) — Core V/S/R/E/L + 별도 X 실전 실행 · 우선 확인 후보(≤2) · 지금 필요한 진단(≤1) · 전체 지도 보기.
// 원칙: 현재 데이터가 증명하지 못하는 것을 숙달도처럼 표현하지 않는다 — 관찰값을 %로 내지 않고 상태 글자만,
// 카드마다 근거 수준(규칙 기반 · 정밀 진단 미실시)을 적는다. 학습 Route 는 고르지 않고 진단을 처방한다.

import { ArrowRight, Stethoscope } from 'lucide-react'
import Link from 'next/link'

import { CORE_STATUS_LABEL, coreSummary, type CoreAxisView, type CoreStatus } from '@/lib/csat/map/core'
import type { MapPageData } from '@/lib/csat/map/load'

import c from './core.module.css'

const TONE: Record<CoreStatus, string> = {
  // 관찰 수준은 판정이 아니라 색으로 좋고 나쁨을 말하지 않는다 — 모두 같은 잉크
  obs_low: c.tObs,
  obs_mid: c.tObs,
  obs_high: c.tObs,
  insufficient: c.tMuted,
  no_data: c.tMuted,
}

const BASIS_TEXT = { rule_proxy: '근거: 현재 규칙 기반\n정밀 진단: 미실시', item_tagged: '근거: 문항 태깅\n정밀 진단: 미실시', verified_diagnosis: '근거: 정밀 진단' } as const

export function CoreSummary({ data, fullHref }: { data: MapPageData; fullHref: string }) {
  const sum = coreSummary(data.model, data.settings)
  const core = sum.axes.filter((a) => a.group === 'core')
  const perf = sum.axes.filter((a) => a.group === 'performance')
  const cand = sum.axes.filter((a) => sum.candidates.includes(a.code))

  return (
    <div className={c.wrap} data-testid="csat-core-map" data-basis={sum.basis}>
      <div className={c.notice}>
        지금 보이는 상태는 기출 문항유형에서 이어 받은 <strong>규칙 기반 관찰</strong>이에요. 실제 어휘 · 문장해석 실력을 잰 값이 아니라서, 숫자 대신 잠정 상태로만 보여 줘요.
      </div>

      <section aria-labelledby="core-h">
        <h3 id="core-h" className={c.h}>핵심 지도</h3>
        <div className={c.grid}>
          {core.map((a) => (
            <AxisCard key={a.code} a={a} />
          ))}
        </div>
      </section>

      <section aria-labelledby="perf-h">
        <h3 id="perf-h" className={c.h}>실전 실행 <span className={c.hNote}>핵심 실력과 따로 봐요</span></h3>
        <div className={c.gridPerf}>
          {perf.map((a) => (
            <AxisCard key={a.code} a={a} />
          ))}
        </div>
      </section>

      <div className={c.row2}>
        <section className={c.panel} aria-labelledby="cand-h">
          <h3 id="cand-h" className={c.h}>우선 확인 후보 <span className={c.hNote}>관찰이 낮은 순 — 진단 결론이 아니에요</span></h3>
          {cand.length === 0 ? (
            <p className={c.muted}>지금 근거로 고를 후보가 없어요.</p>
          ) : (
            <ol className={c.candList}>
              {cand.map((a, i) => (
                <li key={a.code} className={c.cand}>
                  <span className={c.tile} aria-hidden="true">{i + 1}</span>
                  <span>
                    <strong>{a.name}</strong>
                    <span className={c.muted}> — 실제 원인은 아직 확인 전이에요.</span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </section>
        <section className={c.panel} aria-labelledby="dx-h">
          <h3 id="dx-h" className={c.h}>지금 필요한 진단</h3>
          <p className={c.dx}>
            <Stethoscope size={16} strokeWidth={1.8} aria-hidden="true" />
            {sum.nextDiagnosis}
          </p>
          <p className={c.muted}>학습 경로는 {sum.route.note.replace('Route 미정 — ', '')}해요.</p>
        </section>
      </div>

      <Link href={fullHref} className={c.fullLink} data-testid="map-full-link">
        전체 지도 보기 <span className={c.muted}>영역 · 학습 라인 {data.nodes.filter((n) => n.kind === 'line').length}개</span>
        <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" />
      </Link>
    </div>
  )
}

function AxisCard({ a }: { a: CoreAxisView }) {
  // 카드는 관찰값만 — 후보 표시는 아래 「우선 확인 후보」 영역에만 둔다(관찰과 진단 결론 분리)
  return (
    <article className={c.card} data-core={a.code} data-status={a.status}>
      <div className={c.cardHead}>
        <span className={c.tile} aria-hidden="true">{a.code}</span>
        <span className={c.name}>{a.name}</span>
      </div>
      <p className={c.q}>{a.question}</p>
      <p className={`${c.status} ${TONE[a.status]}`}>{CORE_STATUS_LABEL[a.status]}</p>
      <p className={c.meta}>
        {a.status === 'no_data' ? '문항 태그 없음' : `라인별 기여 건수 ${a.contributions}(중복 포함)`} · 기존 {a.lines.join('+')}
      </p>
      <p className={c.basis}>{BASIS_TEXT[a.basis]}</p>
    </article>
  )
}
