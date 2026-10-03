// apps/web/src/components/csat/diagnosis/map/GoalBar.tsx
//
// 목표 점수 줄 — 핵심 요약 · 전체 지도가 함께 쓴다(목표 · 현재 점수는 여기 한 곳에만 숫자로 보인다).
// 목표를 바꾸면 라인 목표율만 다시 계산된다. 핵심 지도의 우선 확인 후보는 관찰값 기준이라 바뀌지 않는다.

'use client'

import { useRouter } from 'next/navigation'
import { useEffect, useState, useTransition } from 'react'

import { track } from '@/lib/analytics/client'
import type { MapPageData } from '@/lib/csat/map/load'

import s from './map.module.css'

export function GoalBar({ data }: { data: MapPageData }) {
  const router = useRouter()
  const { model, settings } = data
  const [goal, setGoal] = useState(model.goal)
  const [draft, setDraft] = useState(String(model.goal))
  const [err, setErr] = useState<string | null>(null)
  const [refreshing, startTransition] = useTransition()
  /** 저장 요청 중 — 연속 클릭의 PUT 이 역순으로 끝나 마지막 선택이 덮이지 않게 잠근다 */
  const [saving, setSaving] = useState(false)
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

  return (
    <div className={s.toolbar}>
      <div className={s.goalBar} role="group" aria-label="목표 점수 정하기">
        <span className={s.goalBarLabel}>목표 점수</span>
        <div className={s.presets}>
          {settings.goal_presets.map((p) => (
            <button key={p} type="button" className={`${s.chip} ${p === goal ? s.chipOn : ''}`} aria-pressed={p === goal} onClick={() => apply(p)} disabled={pending}>
              {p}
            </button>
          ))}
        </div>
        <form
          className={s.goalForm}
          onSubmit={(e) => {
            e.preventDefault()
            apply(Number(draft))
          }}
        >
          <label className={s.inputWrap} htmlFor="map-goal-input">
            <span className={s.inputLabel}>직접 입력</span>
            <input id="map-goal-input" className={s.input} inputMode="numeric" value={draft} onChange={(e) => setDraft(e.target.value)} />
          </label>
          <button type="submit" className={s.applyBtn} disabled={pending}>
            적용
          </button>
        </form>
        {err && <span className={s.err} role="alert">{err}</span>}
      </div>
      <span className={s.toolbarNote} data-testid="map-score">
        현재 {model.currentScore !== null ? `${model.currentScore}점` : '— 시험을 기록하면 보여요'} · 기준 시험 {model.reference.exams.length}회
        {model.reference.shortfall > 0 ? ` (적격 시험 부족 — 원하는 ${model.reference.wanted}회)` : ''}
      </span>
    </div>
  )
}
