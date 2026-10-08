// apps/web/src/components/csat/diagnosis/map/GoalBar.tsx
//
// 목표 점수 — 상단 줄이 아니라 「최종 목표」 자리에서 정한다(2026-10-07 사용자 지시).
//   useGoal: 저장 · 되돌리기 상태(연속 클릭의 PUT 이 역순으로 끝나 마지막 선택이 덮이지 않게 잠근다)
//   GoalEditor: 프리셋 칩 · 직접 입력 · 적용(팝오버 안)
//   GoalPopover: 트리거 버튼 + 떠 있는 편집 패널 — 핵심 요약의 목표 카드와 상세 지도의 최종 목표 노드가 함께 쓴다
// 목표를 바꾸면 라인 목표율만 다시 계산된다. 핵심 지도의 우선 확인 후보는 관찰값 기준이라 바뀌지 않는다.
// 목표 점수는 능력 목표가 아니라 시험 수행 전략 계산의 입력이다(GOAL_STRATEGY_NOTE).

'use client'

import { Target, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from 'react'

import { track } from '@/lib/analytics/client'
import { GOAL_STRATEGY_NOTE } from '@/lib/csat/map/core'
import type { MapPageData } from '@/lib/csat/map/load'

import s from './map.module.css'

export function useGoal(data: MapPageData) {
  const router = useRouter()
  const { model } = data
  const [goal, setGoal] = useState(model.goal)
  const [draft, setDraft] = useState(String(model.goal))
  const [err, setErr] = useState<string | null>(null)
  const [refreshing, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  /** 이번 화면에서 목표 저장이 성공했는가 — 「목표를 정했다」는 저장 성공으로만 판정한다(낙관적 선택값으로 하지 않는다) */
  const [saved, setSaved] = useState(false)
  const pending = saving || refreshing

  // 서버가 목표를 다시 계산해 내려오면 입력을 맞춘다
  useEffect(() => {
    setGoal(model.goal)
    setDraft(String(model.goal))
  }, [model.goal])

  const apply = async (next: number) => {
    if (pending) return
    setErr(null)
    if (!Number.isInteger(next) || next < 0 || next > 100) {
      setErr('0~100 사이 정수로 적어 주세요')
      return
    }
    const before = goal
    setGoal(next)
    setDraft(String(next))
    setSaving(true)
    try {
      const res = await fetch('/api/csat/diagnosis/map/goal', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ target: next }) })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? '저장하지 못했어요')
      setSaved(true)
      track({ name: 'csat_map_goal_set', props: { goal: next } })
      startTransition(() => router.refresh())
    } catch (e) {
      setGoal(before)
      setDraft(String(before))
      setErr(e instanceof Error ? e.message : '저장하지 못했어요')
    } finally {
      setSaving(false)
    }
  }
  return { goal, draft, setDraft, err, pending, apply, saved }
}

export type GoalState = ReturnType<typeof useGoal>

/** 현재 점수 · 기준 시험 — 숫자는 목표 자리 한 곳에만 */
export function scoreLine(data: MapPageData): string {
  const { model } = data
  return `현재 ${model.currentScore !== null ? `${model.currentScore}점` : '—'} · 기준 시험 ${model.reference.exams.length}회${model.reference.shortfall > 0 ? ` (적격 부족 — 원하는 ${model.reference.wanted}회)` : ''}`
}

export function GoalEditor({ data, g }: { data: MapPageData; g: GoalState }) {
  return (
    <div className={s.goalEditor} role="group" aria-label="목표 점수 정하기">
      <div className={s.presets}>
        {data.settings.goal_presets.map((p) => (
          <button key={p} type="button" className={`${s.chip} ${p === g.goal ? s.chipOn : ''}`} aria-pressed={p === g.goal} onClick={() => g.apply(p)} disabled={g.pending}>
            {p}
          </button>
        ))}
      </div>
      <form
        className={s.goalForm}
        onSubmit={(e) => {
          e.preventDefault()
          g.apply(Number(g.draft))
        }}
      >
        <label className={s.inputWrap} htmlFor="map-goal-input">
          <span className={s.inputLabel}>직접 입력</span>
          <input id="map-goal-input" className={s.input} inputMode="numeric" value={g.draft} onChange={(e) => g.setDraft(e.target.value)} />
        </label>
        <button type="submit" className={s.applyBtn} disabled={g.pending}>
          적용
        </button>
      </form>
      {g.err && <span className={s.err} role="alert">{g.err}</span>}
      <p className={s.goalNote}>{GOAL_STRATEGY_NOTE}</p>
    </div>
  )
}

/** 트리거 + 떠 있는 편집 패널. 바깥을 누르거나 Esc 로 닫힌다 */
export function GoalPopover({ data, g, trigger, align = 'start' }: { data: MapPageData; g: GoalState; trigger: (p: { open: boolean; toggle: () => void; id: string }) => ReactNode; align?: 'start' | 'end' }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('mousedown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])
  return (
    <div ref={box} className={s.popAnchor}>
      {trigger({ open, toggle: () => setOpen((v) => !v), id })}
      {open && (
        <div id={id} className={`${s.pop} ${align === 'end' ? s.popEnd : ''}`} role="dialog" aria-label="목표 점수 정하기">
          <div className={s.popHead}>
            <Target size={15} strokeWidth={1.8} aria-hidden="true" />
            <span>목표 점수</span>
            <button type="button" className={s.popClose} onClick={() => setOpen(false)} aria-label="닫기">
              <X size={14} aria-hidden="true" />
            </button>
          </div>
          <GoalEditor data={data} g={g} />
          <p className={s.popScore}>{scoreLine(data)}</p>
        </div>
      )}
    </div>
  )
}
