// apps/web/src/components/csat/diagnosis/map/GoalBar.tsx
//
// 목표 점수 — 상단 줄이 아니라 「최종 목표」 자리에서 정한다(2026-10-07 사용자 지시).
//   useGoal: 저장 · 되돌리기 상태(연속 클릭의 PUT 이 역순으로 끝나 마지막 선택이 덮이지 않게 잠근다)
//   GoalEditor: 프리셋 칩 · 직접 입력 · 적용
//   GoalPopover: PC는 공통 모달, 작은 화면은 기존 팝오버 — 목표 카드와 최종 목표 노드가 함께 쓴다
// 목표를 바꾸면 라인 목표율만 다시 계산된다. 핵심 지도의 우선 확인 후보는 관찰값 기준이라 바뀌지 않는다.
// 목표 점수는 능력 목표가 아니라 시험 수행 전략 계산의 입력이다(GOAL_STRATEGY_NOTE).

'use client'

import { Target, Info, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { useEffect, useId, useRef, useState, useTransition, type ReactNode } from 'react'

import { track } from '@/lib/analytics/client'
import { GOAL_STRATEGY_NOTE } from '@/lib/csat/map/core'
import type { MapPageData } from '@/lib/csat/map/load'
import { GOAL_EXAM_LABEL, GOAL_EXAMS, type GoalExam } from '@/lib/csat/map/v62/target-goal'
import { DEFAULT_UNIT_MINUTES, type GoalBudget } from '@/lib/csat/map/v62/goal-budget'

import s from './map.module.css'
import { MapDialog } from './MapDialog'
import p from './popup.module.css'
import d from './detail.module.css'

/** 점수 외 목표(LM-G1.3a) — 저장된 최신 목표 이력에서만 채운다(입력 중 값은 저장 성공 전까지 「저장된 목표」가 아니다) */
export interface GoalExtra { exam: GoalExam | null; grade: number | null; date: string | null; budget?: GoalBudget | null }
const extraOf = (data: MapPageData): GoalExtra => {
  const g = data.v4?.target?.goal ?? null
  return { exam: g?.exam ?? null, grade: g?.grade ?? null, date: g?.date ?? null, ...(g?.budget ? { budget: g.budget } : {}) }
}

export function useGoal(data: MapPageData) {
  const router = useRouter()
  const { model } = data
  // Display and recommendation input always share the server's immutable snapshot.
  // Draft/request values must not combine with an older scope or PLAN goal id.
  const goal = model.goal
  const [extra, setExtra] = useState<GoalExtra>(() => extraOf(data))
  const savedExtra = extraOf(data)
  const savedBudgetKey = JSON.stringify(savedExtra.budget ?? null)
  const [draft, setDraft] = useState(String(model.goal))
  const [err, setErr] = useState<string | null>(null)
  const [refreshing, startTransition] = useTransition()
  const [saving, setSaving] = useState(false)
  /** 이번 화면에서 목표 저장이 성공했는가 — 「목표를 정했다」는 저장 성공으로만 판정한다(낙관적 선택값으로 하지 않는다) */
  const saved = model.goalSet
  const pending = saving || refreshing

  // 서버가 목표를 다시 계산해 내려오면 입력을 맞춘다
  useEffect(() => {
    setDraft(String(model.goal))
  }, [model.goal])
  // 서버가 저장된 목표 이력을 다시 내려주면 점수 외 입력도 저장 값으로 맞춘다
  useEffect(() => {
    setExtra(savedExtra)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedExtra.exam, savedExtra.grade, savedExtra.date, savedBudgetKey])

  // 같은 목표 값의 재시도는 같은 요청 키 — 응답을 못 받고 다시 눌러도 목표 이력이 두 줄 생기지 않는다(독립 리뷰 P2)
  const attempt = useRef<{ value: string; key: string } | null>(null)
  /** 점수 + 점수 외 목표를 한 번에 저장(한 요청 · 한 이력 줄). 같은 값의 재시도는 같은 요청 키 */
  const apply = async (next: number, more: GoalExtra = extra) => {
    if (pending) return
    setErr(null)
    if (!Number.isInteger(next) || next < 0 || next > 100) {
      setErr('0~100 사이 정수로 적어 주세요')
      return
    }
    setDraft(String(next))
    setExtra(more)
    setSaving(true)
    const expectedGoalVersion = data.v4?.target?.goal?.id ?? null
    const sig = JSON.stringify([next, more.exam, more.grade, more.date, more.budget ?? null, expectedGoalVersion])
    if (attempt.current?.value !== sig) attempt.current = { value: sig, key: crypto.randomUUID() }
    try {
      const res = await fetch('/api/csat/diagnosis/map/goal', { method: 'PUT', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ target: next, exam: more.exam, grade: more.grade, date: more.date, budget: more.budget ?? null, expectedGoalVersion, clientKey: attempt.current.key }) })
      if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error ?? '저장하지 못했어요')
      attempt.current = null
      track({ name: 'csat_map_goal_set', props: { goal: next } })
      startTransition(() => router.refresh())
    } catch (e) {
      // A response may be lost after commit. Preserve the editor and request key
      // so Apply retries that exact request, rather than restoring an older goal.
      // The displayed goal and recommendations still use the server snapshot.
      setErr(e instanceof Error ? e.message : '저장하지 못했어요')
    } finally {
      setSaving(false)
    }
  }
  return { goal, draft, setDraft, err, pending, apply, saved, extra, setExtra, savedExtra }
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
      {/* 목표 버전의 시험 · 목표일 · 시간 예산을 함께 저장한다. 미설치 예산은 성공으로 표시하지 않는다. */}
      <details className={s.goalMore} data-testid="goal-more">
        <summary>시험 · 목표일 · 학습 시간 정하기</summary>
        <label className={s.inputWrap}>
          <span className={s.inputLabel}>목표 시험</span>
          <select className={s.input} value={g.extra.exam ?? ''} onChange={(e) => g.setExtra({ ...g.extra, exam: (e.target.value || null) as GoalExam | null })} data-testid="goal-exam">
            <option value="">정하지 않음(평가원 최근 시험 기준)</option>
            {GOAL_EXAMS.map((x) => <option key={x} value={x}>{GOAL_EXAM_LABEL[x]}</option>)}
          </select>
        </label>
        <label className={s.inputWrap}>
          <span className={s.inputLabel}>목표 등급(선택)</span>
          <select className={s.input} value={g.extra.grade ?? ''} onChange={(e) => g.setExtra({ ...g.extra, grade: e.target.value ? Number(e.target.value) : null })} data-testid="goal-grade">
            <option value="">정하지 않음</option>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((x) => <option key={x} value={x}>{x}등급</option>)}
          </select>
        </label>
        <label className={s.inputWrap}>
          <span className={s.inputLabel}>목표일{g.extra.budget ? '(기간 계획 필수)' : '(선택)'}</span>
          <input type="date" className={s.input} value={g.extra.date ?? ''} onChange={(e) => g.setExtra({ ...g.extra, date: e.target.value || null })} data-testid="goal-date" />
        </label>
        <label className={`${s.inputWrap} ${s.goalToggle}`}>
          <input type="checkbox" checked={!!g.extra.budget} onChange={(e) => g.setExtra({ ...g.extra, budget: e.target.checked ? { weeklyMinutes: 300, dailyMinutes: null, minutesPerUnit: DEFAULT_UNIT_MINUTES, priorities: [] } : null })} data-testid="goal-budget-enable" />
          <span>가능한 시간 안에서 기간 계획 만들기</span>
        </label>
        {g.extra.budget && <GoalBudgetEditor budget={g.extra.budget} onChange={budget => g.setExtra({ ...g.extra, budget })} />}
        <button type="button" className={s.applyBtn} disabled={g.pending} onClick={() => g.apply(Number(g.draft))} data-testid="goal-apply-all">이 목표로 저장</button>
        <p className={s.goalNote}>시간을 저장하면 새 목표 버전으로 계획을 다시 확인해요. 등급은 점수로 바꿔 채우지 않아요.</p>
      </details>
      {g.err && <span className={s.err} role="alert">{g.err}</span>}
      <details className={d.fold}><summary><Info size={14} aria-hidden="true" />목표 점수는 어떻게 쓰이나요?</summary><p className="break-keep">{GOAL_STRATEGY_NOTE}</p></details>
    </div>
  )
}

function GoalBudgetEditor({ budget, onChange }: { budget: GoalBudget; onChange: (budget: GoalBudget) => void }) {
  const weekdays = ['월', '화', '수', '목', '금', '토', '일']
  return <fieldset className={`${s.goalMore} ${s.budgetFields}`} data-testid="goal-budget-editor">
    <legend>학습 시간 배분</legend>
    <label className={s.inputWrap}><span className={s.inputLabel}>주간 학습 가능 시간(분)</span><input className={s.input} type="number" min={1} max={10080} value={budget.weeklyMinutes} onChange={e => onChange({ ...budget, weeklyMinutes: Number(e.target.value) })} data-testid="goal-weekly-minutes" /></label>
    <label className={s.inputWrap}><span className={s.inputLabel}>문항·지문 1개에 배분할 시간(분)</span><input className={s.input} type="number" min={1} max={240} value={budget.minutesPerUnit} onChange={e => onChange({ ...budget, minutesPerUnit: Number(e.target.value) })} data-testid="goal-unit-minutes" /></label>
    <p className={s.goalNote}>직접 조정하는 잠정 시간이에요. 학습 효과나 목표 달성까지 걸리는 시간을 예측한 값은 아니에요.</p>
    <label className={`${s.inputWrap} ${s.goalToggle}`}><input type="checkbox" checked={!!budget.dailyMinutes} onChange={e => onChange({ ...budget, dailyMinutes: e.target.checked ? Array.from({ length: 7 }, (_, i) => Math.floor(budget.weeklyMinutes / 7) + (i < budget.weeklyMinutes % 7 ? 1 : 0)) : null })} /><span>요일별 시간 직접 정하기</span></label>
    {budget.dailyMinutes && <div className={s.budgetDays}>{weekdays.map((day, i) => <label key={day} className={s.inputWrap}><span className={s.inputLabel}>{day}(분)</span><input className={s.input} type="number" min={0} max={1440} value={budget.dailyMinutes![i]} onChange={e => onChange({ ...budget, dailyMinutes: budget.dailyMinutes!.map((n, j) => i === j ? Number(e.target.value) : n) })} /></label>)}</div>}
  </fieldset>
}

/** PC는 참조 모달, 작은 화면은 기존 패널. 저장 동작은 GoalEditor 한 곳에서 처리한다. */
export function GoalPopover({ data, g, trigger, align = 'start' }: { data: MapPageData; g: GoalState; trigger: (p: { open: boolean; toggle: () => void; id: string }) => ReactNode; align?: 'start' | 'end' }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const [desktop, setDesktop] = useState(false)
  useEffect(() => {
    const media = window.matchMedia('(min-width: 900px)')
    const sync = () => setDesktop(media.matches)
    sync()
    media.addEventListener('change', sync)
    return () => media.removeEventListener('change', sync)
  }, [])
  if (!desktop) return <LegacyGoalPopover data={data} g={g} trigger={trigger} align={align} />
  return (
    <div className={s.popAnchor}>
      {trigger({ open, toggle: () => setOpen((v) => !v), id })}
      {open && (
        <div id={id}><MapDialog labelledBy={`${id}-title`} testId="goal-dialog" onClose={() => setOpen(false)}
          head={<><span className={p.headTile}><Target size={17} aria-hidden="true" /></span><h2 id={`${id}-title`} className={p.title}>목표 점수 정하기</h2></>}
          foot={<><span className={d.footNote}>{scoreLine(data)}</span><button type="button" className={p.pillBtn} onClick={() => setOpen(false)}>닫기</button></>}
        ><section className={p.card}><h3 className={`${p.cardTitle} ${d.sectionTitle}`}><Target size={18} aria-hidden="true" />목표 선택</h3><GoalEditor data={data} g={g} /></section></MapDialog></div>
      )}
    </div>
  )
}

function LegacyGoalPopover({ data, g, trigger, align = 'start' }: { data: MapPageData; g: GoalState; trigger: (p: { open: boolean; toggle: () => void; id: string }) => ReactNode; align?: 'start' | 'end' }) {
  const [open, setOpen] = useState(false)
  const id = useId()
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const onDown = (e: MouseEvent) => {
      if (box.current && !box.current.contains(e.target as Node)) setOpen(false)
    }
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.preventDefault()
      setOpen(false)
      box.current?.querySelector<HTMLElement>('button[aria-controls]')?.focus()
    }
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
            <button type="button" className={s.popClose} onClick={() => { setOpen(false); box.current?.querySelector<HTMLElement>('button[aria-controls]')?.focus() }} aria-label="닫기">
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
