// apps/web/src/components/csat/diagnosis/map/GoalRecordBar.tsx
//
// 학습지도 v6.2 §9.2 ① 상단 목표 · 기록 — 저장된 목표(점수)만 「내 목표」로, 기록은 「전체 N / 진단 활용 M / 제외 사유」로 나눠 보인다.
// 기록 2 · 활용 0 을 「기록 없음」으로 보이지 않는다. 서로 다른 시험의 원점수를 합치거나 평균하지 않는다(최근 기록 하나만 보인다).

'use client'

import { ClipboardList, Pencil, Target } from 'lucide-react'
import Link from 'next/link'

import { goalSummary } from '@/lib/csat/map/goal-view'
import type { MapPageData } from '@/lib/csat/map/load'
import type { AsIsMap } from '@/lib/csat/map/v4/as-is'

import { GoalPopover, type useGoal } from './GoalBar'
import u from './unified.module.css'

const EXCLUDED_LABEL: Record<'after_as_of' | 'not_diagnosable' | 'exam_not_ready', string> = {
  after_as_of: '기준일 뒤',
  not_diagnosable: '입력 확인 필요',
  exam_not_ready: '분석 준비 중인 시험',
}

export function GoalRecordBar({ data, g, goalSet, asIs, recordHref }: { data: MapPageData; g: ReturnType<typeof useGoal>; goalSet: boolean; asIs: AsIsMap; recordHref: string }) {
  const gs = goalSummary({ goal: g.goal, goalSet }, data.records)
  const total = asIs.sessions.length
  const used = asIs.sessions.filter((s) => s.used).length
  const excluded = (['after_as_of', 'not_diagnosable', 'exam_not_ready'] as const)
    .map((k) => ({ k, n: asIs.sessions.filter((s) => s.excluded === k).length }))
    .filter((x) => x.n > 0)
  return (
    <section className={u.top} aria-label="목표와 기록" data-testid="umap-top">
      <div className={u.topCell}>
        <h2 className={u.topLabel}><Target size={13} strokeWidth={1.9} aria-hidden="true" />내 목표</h2>
        {goalSet ? <p className={u.topBig} data-testid="goal-value">수능 영어 <strong>{gs.goal}점</strong></p> : <p className={u.topBig} data-testid="goal-value">아직 정하지 않았어요</p>}
        <p className={u.topSub}>{goalSet ? `${gs.goalGrade}등급 구간 · 저장된 목표 점수` : '목표 없이도 지도와 TASK 를 둘러볼 수 있어요'}</p>
        <GoalPopover
          data={data}
          g={g}
          trigger={({ open, toggle, id }) => (
            <button type="button" className={u.ghost} onClick={toggle} aria-expanded={open} aria-controls={id} data-testid="map-goal-edit">
              <Pencil size={13} strokeWidth={1.9} aria-hidden="true" />
              {goalSet ? '목표 바꾸기' : '목표 정하기'}
            </button>
          )}
        />
      </div>
      <div className={u.topCell} data-testid="umap-records" data-total={total} data-used={used}>
        <h3 className={u.topLabel}><ClipboardList size={13} strokeWidth={1.9} aria-hidden="true" />시험 기록</h3>
        <p className={u.topBig}>전체 <strong>{total}</strong> · 진단에 쓴 기록 <strong>{used}</strong></p>
        <p className={u.topSub}>
          {total === 0 ? '아직 기록이 없어요' : excluded.length > 0 ? `빠진 기록: ${excluded.map((x) => `${EXCLUDED_LABEL[x.k]} ${x.n}`).join(' · ')}` : '모든 기록을 진단에 썼어요'}
        </p>
        <Link href={recordHref} className={u.ghost} data-testid="umap-record-add">기출 시험 기록하기</Link>
      </div>
      <div className={u.topCell}>
        <h3 className={u.topLabel}>최근 시험</h3>
        {gs.latest ? (
          <>
            <p className={u.topBig}><strong>{gs.latest.raw}점</strong> · {gs.latest.grade}등급</p>
            <p className={u.topSub}>{gs.latest.label} · {gs.latest.takenAt.slice(0, 10)}{goalSet && gs.gap !== null ? ` · 목표까지 ${gs.gap}점` : ''}</p>
          </>
        ) : (
          <p className={u.topSub}>기록하면 실제 점수로 보여 드려요. 다른 시험 점수는 합치지 않아요.</p>
        )}
      </div>
    </section>
  )
}
