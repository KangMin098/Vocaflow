// apps/web/src/components/csat/diagnosis/map/CoreSummary.tsx
//
// 핵심 지도 요약(첫 화면) — 최종 목표 카드(목표 점수는 여기서 정한다) · Core V/S/R/E/L + 별도 X 실전 수행 · 성장 경로 ·
// 우선 확인 후보(≤2) · 지금 필요한 진단(≤1) · 기존 상세 지도 보기.
// 원칙: 현재 데이터가 증명하지 못하는 것을 숙달도처럼 표현하지 않는다 — 관찰값을 %로 내지 않고 상태 글자만,
// 카드마다 근거 수준(규칙 기반 · 정밀 진단 미실시)을 적는다. 학습 Route 는 고르지 않고 진단을 처방한다.
// 2026-10-07: 제목마다 아이콘 · 긴 안내 문장은 화면에 나열하지 않고 안내 팁(아이콘 + 짧은 라벨, 마우스 · 포커스에 전문)으로.

'use client'

import {
  ArrowRight, BookA, ChevronRight, Compass, FlaskConical, Gauge, Headphones, ListOrdered, Map as MapIcon, Pencil, Scale, ScanText, Stethoscope, Target, Timer, TrendingUp,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import Link from 'next/link'

import { CAUSE_NOTE, CORE_AXES, CORE_STATUS_LABEL, LEARNING_PROGRESSION, LEGACY_DETAIL_NOTE, LEGACY_PROXY_LABEL, THRESHOLD_NOTE, coreSummary, type CoreAxisView, type CoreCode, type CoreStatus } from '@/lib/csat/map/core'
import type { MapPageData } from '@/lib/csat/map/load'

import c from './core.module.css'
import { GoalPopover, scoreLine, useGoal } from './GoalBar'
import { InfoTip } from './PopupParts'

const TONE: Record<CoreStatus, string> = {
  // 관찰 수준은 판정이 아니라 색으로 좋고 나쁨을 말하지 않는다 — 모두 같은 잉크
  obs_low: c.tObs,
  obs_mid: c.tObs,
  obs_high: c.tObs,
  insufficient: c.tMuted,
  no_data: c.tMuted,
}

/** 핵심 축 아이콘 — 문구 앞 아이콘은 필수(2026-10-07) */
export const AXIS_ICON: Record<CoreCode, LucideIcon> = {
  V: BookA,
  S: ScanText,
  R: MapIcon,
  E: Scale,
  L: Headphones,
  X: Timer,
}

const BASIS_TEXT = { rule_proxy: '규칙 기반', item_tagged: '문항 태깅', verified_diagnosis: '정밀 진단' } as const

export function CoreSummary({ data, fullHref }: { data: MapPageData; fullHref: string }) {
  const sum = coreSummary(data.model, data.settings)
  const core = sum.axes.filter((a) => a.group === 'core')
  const perf = sum.axes.filter((a) => a.group === 'performance')
  const cand = sum.axes.filter((a) => sum.candidates.includes(a.code))
  const g = useGoal(data)

  return (
    <div className={c.wrap} data-testid="csat-core-map" data-basis={sum.basis}>
      {/* 최종 목표 — 목표 점수는 상단 줄이 아니라 여기서 정한다 */}
      <section className={c.goalCard} aria-labelledby="goal-h" data-testid="map-goal-card">
        <span className={c.goalIcon} aria-hidden="true">
          <Target size={20} strokeWidth={1.8} />
        </span>
        <div className={c.goalText}>
          <span id="goal-h" className={c.goalLabel}>최종 목표</span>
          <span className={c.goalValue}>
            수능 영어 <strong>{g.goal}점</strong>
          </span>
          <span className={c.goalSub} data-testid="map-score">{scoreLine(data)}</span>
        </div>
        <span className={c.goalTips}>
          <InfoTip label="규칙 기반 관찰" icon={<FlaskConical size={13} strokeWidth={1.9} aria-hidden="true" />} align="end">
            지금 보이는 상태는 기출 문항유형에서 이어 받은 규칙 기반 관찰이에요. 실제 어휘 · 표현이나 문장 이해 실력을 잰 값이 아니라서, 숫자 대신 잠정 상태로만 보여 줘요.
          </InfoTip>
        </span>
        <GoalPopover
          data={data}
          g={g}
          align="end"
          trigger={({ open, toggle, id }) => (
            <button type="button" className={c.goalBtn} onClick={toggle} aria-expanded={open} aria-controls={id} data-testid="map-goal-edit">
              <Pencil size={14} strokeWidth={1.8} aria-hidden="true" />
              목표 바꾸기
            </button>
          )}
        />
      </section>

      <section aria-labelledby="core-h">
        <div className={c.hRow}>
          <h3 id="core-h" className={c.h}>
            <Compass size={15} strokeWidth={1.9} aria-hidden="true" />
            핵심 지도
          </h3>
          <InfoTip label="관찰 구분 기준" align="end">{THRESHOLD_NOTE}</InfoTip>
        </div>
        <div className={c.grid}>
          {core.map((a) => (
            <AxisCard key={a.code} a={a} />
          ))}
        </div>
      </section>

      <section aria-labelledby="prog-h" data-testid="core-progression">
        <div className={c.hRow}>
          <h3 id="prog-h" className={c.h}>
            <TrendingUp size={15} strokeWidth={1.9} aria-hidden="true" />
            성장 경로
          </h3>
          <InfoTip label="점수가 아닌 순서" align="end">따로 매기는 점수가 아니라 카드들을 꿰는 순서예요. 단계별 값은 아직 재지 않아요.</InfoTip>
        </div>
        <ol className={c.track}>
          {LEARNING_PROGRESSION.map((p, i) => {
            const Icon = AXIS_ICON[p.axes[0]]
            return (
              <li key={p.step} className={c.trackStep} data-axis={p.axes[0]}>
                <span className={c.trackDot} aria-hidden="true">
                  <Icon size={14} strokeWidth={1.9} aria-hidden={true} />
                </span>
                <span className={c.trackName}>{p.step}</span>
                <span className={c.trackAxes}>{p.axes.map((x) => CORE_AXES.find((a) => a.code === x)?.name ?? x).join(' · ')}</span>
                {i < LEARNING_PROGRESSION.length - 1 && <ChevronRight className={c.trackArrow} size={14} aria-hidden="true" />}
              </li>
            )
          })}
        </ol>
      </section>

      <section aria-labelledby="perf-h">
        <div className={c.hRow}>
          <h3 id="perf-h" className={c.h}>
            <Timer size={15} strokeWidth={1.9} aria-hidden="true" />
            실전 수행
          </h3>
          <InfoTip label="핵심 실력과 따로" align="end">시간 배분 · 풀이 순서 · 집중 같은 실행은 핵심 실력 카드와 따로 봐요.</InfoTip>
        </div>
        <div className={c.gridPerf}>
          {perf.map((a) => (
            <AxisCard key={a.code} a={a} />
          ))}
        </div>
      </section>

      <div className={c.row2}>
        <section className={c.panel} aria-labelledby="cand-h">
          <div className={c.hRow}>
            <h3 id="cand-h" className={c.h}>
              <ListOrdered size={15} strokeWidth={1.9} aria-hidden="true" />
              우선 확인 후보
            </h3>
            <InfoTip label="결론 아님" align="end">관찰이 낮은 순으로 최대 2개예요. 진단 결론이 아니고, 실제 원인은 아직 확인 전이에요.</InfoTip>
          </div>
          {cand.length === 0 ? (
            <p className={c.emptyRow}>
              <Gauge size={16} strokeWidth={1.8} aria-hidden="true" />
              지금 근거로 고를 후보가 없어요
            </p>
          ) : (
            <ol className={c.candList}>
              {cand.map((a, i) => {
                const Icon = AXIS_ICON[a.code]
                return (
                  <li key={a.code} className={c.cand}>
                    <span className={c.rank} aria-hidden="true">{i + 1}</span>
                    <Icon size={16} strokeWidth={1.8} aria-hidden={true} />
                    <strong>{a.name}</strong>
                  </li>
                )
              })}
            </ol>
          )}
        </section>
        <section className={c.panel} aria-labelledby="dx-h">
          <div className={c.hRow}>
            <h3 id="dx-h" className={c.h}>
              <Stethoscope size={15} strokeWidth={1.9} aria-hidden="true" />
              지금 필요한 진단
            </h3>
            <InfoTip label="오답 원인과 카드" align="end">{CAUSE_NOTE}</InfoTip>
          </div>
          <p className={c.dx}>{sum.nextDiagnosis}</p>
          <p className={c.routeChip}>
            <ArrowRight size={13} strokeWidth={1.9} aria-hidden="true" />
            학습 경로는 {sum.route.note.replace('Route 미정 — ', '')}
          </p>
        </section>
      </div>

      <div className={c.footRow}>
        <Link href={fullHref} className={c.fullLink} data-testid="map-full-link">
          <MapIcon size={15} strokeWidth={1.8} aria-hidden="true" />
          기존 상세 지도 보기 <span className={c.linkMeta}>영역 · 기존 라인 {data.nodes.filter((n) => n.kind === 'line').length}개</span>
          <ArrowRight size={14} strokeWidth={1.8} aria-hidden="true" />
        </Link>
        <InfoTip label="기존 54라인이란">{LEGACY_DETAIL_NOTE}</InfoTip>
      </div>
    </div>
  )
}

function AxisCard({ a }: { a: CoreAxisView }) {
  // 카드는 관찰값만 — 후보 표시는 아래 「우선 확인 후보」 영역에만 둔다(관찰과 진단 결론 분리)
  const Icon = AXIS_ICON[a.code]
  return (
    <article className={c.card} data-core={a.code} data-status={a.status}>
      <div className={c.cardHead}>
        <span className={c.tile} aria-hidden="true">
          <Icon size={16} strokeWidth={1.8} aria-hidden={true} />
        </span>
        <span className={c.name}>{a.name}</span>
        {a.legacyNote && <span className={c.legacyTag}>임시 계산</span>}
        <span className={c.code} aria-hidden="true">{a.code}</span>
      </div>
      <p className={c.q}>{a.question}</p>
      <p className={`${c.status} ${TONE[a.status]}`}>
        <span className={c.statusDot} data-s={a.status} aria-hidden="true" />
        {CORE_STATUS_LABEL[a.status]}
      </p>
      <div className={c.cardFoot}>
        <span className={c.basisChip}>
          {BASIS_TEXT[a.basis]}
          {a.basis !== 'verified_diagnosis' && <span className={c.basisSub}> · 정밀 진단 미실시</span>}
        </span>
        <InfoTip label={a.legacyNote ? '임시 계산 — 자세히' : '계산 근거'} align="end" compact>
          {a.status === 'no_data' ? '문항 태그 없음' : `라인별 기여 건수 ${a.contributions}(중복 포함)`} · {LEGACY_PROXY_LABEL} {a.lines.join('+')}
          {a.legacyNote ? ` — ${a.legacyNote}` : ''}
        </InfoTip>
      </div>
    </article>
  )
}
