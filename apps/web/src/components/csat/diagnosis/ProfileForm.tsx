// apps/web/src/components/csat/diagnosis/ProfileForm.tsx
//
// 진단 시작 ① 프로필(1분) → ② 진단 방식 선택. 저장은 덮어쓰지 않고 이력으로 쌓인다.

'use client'

import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useState } from 'react'

import { track } from '@/lib/analytics/client'
import { BACKGROUND_QUESTIONS, GOAL_LABEL, GRADE_LEVEL_LABEL } from '@/lib/csat/diagnosis/labels'

const chip =
  'inline-flex min-h-[44px] items-center rounded-[var(--r-md)] border px-3 font-body text-[14px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-[var(--p)]'
const on = 'border-[var(--p)] bg-[var(--p)] text-[var(--on-p)]'
const off = 'border-[var(--bd)] bg-[var(--bg)] text-[var(--t1)]'
const h3 = 'text-[15px] font-[800] text-[var(--t1)]'

type Goal = 'susi_min' | 'jeongsi' | 'naesin' | 'keep'

export interface ProfileInitial {
  gradeLevel: string
  goalType: string
  minRule: string
  targetGrade: number | null
  background: Record<string, string>
  weeklyHours: number | null
}

function Chips<T extends string>({ name, value, options, onChange }: { name: string; value: T | null; options: { value: T; label: string }[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={name} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value} className={`${chip} ${value === o.value ? on : off}`} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

export function ProfileForm({ initial, hasRecords }: { initial: ProfileInitial | null; hasRecords: boolean }) {
  const [grade, setGrade] = useState<string | null>(initial?.gradeLevel ?? null)
  const [goal, setGoal] = useState<Goal | null>((initial?.goalType as Goal) ?? null)
  const [minRule, setMinRule] = useState(initial?.minRule ?? '')
  const [target, setTarget] = useState<number | null>(initial?.targetGrade ?? null)
  const [bg, setBg] = useState<Record<string, string>>(initial?.background ?? {})
  const [hours, setHours] = useState(initial?.weeklyHours === null || initial?.weeklyHours === undefined ? '' : String(initial.weeklyHours))
  const router = useRouter()
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const save = async () => {
    if (!grade || !goal) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/csat/diagnosis/profile', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gradeLevel: grade,
          goalType: goal,
          goalDetail: { ...(minRule.trim() ? { min_rule: minRule.trim() } : {}), ...(target ? { target_grade: target } : {}) },
          background: bg,
          weeklyHours: hours.trim() === '' ? null : Math.max(0, Math.min(80, Math.round(Number(hours)))),
        }),
      })
      const json = await res.json()
      if (!res.ok) throw new Error(json.error ?? '저장하지 못했어요')
      setSaved(true)
      router.refresh() // 다시 계산된 리포트를 캐시가 아니라 새로 읽게
      track({ name: 'csat_dx_profile_saved', props: { goal } })
    } catch (e) {
      setError(e instanceof Error ? e.message : '저장하지 못했어요')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <section className="flex flex-col gap-4">
        <h2 className="text-[18px] font-[800] text-[var(--t1)]">① 프로필 (1분)</h2>
        <div className="flex flex-col gap-2">
          <h3 className={h3}>학년·시기</h3>
          <Chips name="학년" value={grade} options={Object.entries(GRADE_LEVEL_LABEL).map(([value, label]) => ({ value, label }))} onChange={setGrade} />
        </div>
        <div className="flex flex-col gap-2">
          <h3 className={h3}>목표</h3>
          <Chips name="목표" value={goal} options={(Object.keys(GOAL_LABEL) as Goal[]).map((value) => ({ value, label: GOAL_LABEL[value] }))} onChange={setGoal} />
        </div>
        <div className="flex flex-wrap gap-4">
          <label className="flex flex-col gap-1 font-body text-[14px] text-[var(--t1)]">
            최저 조건 (선택)
            <input className="min-h-[44px] w-[160px] rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]" placeholder="예: 3합 6" maxLength={20} value={minRule} onChange={(e) => setMinRule(e.target.value)} />
          </label>
          <label className="flex flex-col gap-1 font-body text-[14px] text-[var(--t1)]">
            영어 목표 등급 (선택)
            <select className="min-h-[44px] w-[160px] rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]" value={target ?? ''} onChange={(e) => setTarget(e.target.value ? Number(e.target.value) : null)}>
              <option value="">정하지 않음</option>
              {[1, 2, 3, 4, 5].map((g) => <option key={g} value={g}>{g}등급</option>)}
            </select>
          </label>
          <label className="flex flex-col gap-1 font-body text-[14px] text-[var(--t1)]">
            주당 영어 시간
            <input type="number" min={0} max={80} inputMode="numeric" className="min-h-[44px] w-[120px] rounded-[var(--r-md)] border border-[var(--bd)] bg-[var(--bg)] px-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]" value={hours} onChange={(e) => setHours(e.target.value)} />
          </label>
        </div>
        <div className="flex flex-col gap-3">
          <h3 className={h3}>영어 학습 배경</h3>
          {BACKGROUND_QUESTIONS.map((q) => (
            <div key={q.key} className="flex flex-col gap-1">
              <p className="break-keep font-body text-[14px] text-[var(--t1)]">{q.q}</p>
              <Chips name={q.q} value={bg[q.key] ?? null} options={q.options} onChange={(v) => setBg({ ...bg, [q.key]: v })} />
            </div>
          ))}
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            disabled={!grade || !goal || saving}
            onClick={save}
            className="inline-flex min-h-[48px] items-center rounded-[var(--r-md)] bg-[var(--p)] px-5 font-display text-[15px] font-[800] text-[var(--on-p)] disabled:opacity-50 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--p)]"
          >
            {saving ? '저장하는 중…' : '프로필 저장'}
          </button>
          {!grade || !goal ? <span className="font-body text-[13px] text-[var(--t2)]">학년과 목표를 골라 주세요</span> : null}
          <span aria-live="polite" className="font-body text-[13px] text-[var(--t2)]">{saved ? '저장했어요' : ''}</span>
          {error && <span role="alert" className="font-body text-[13px] text-[var(--error-ink)]">{error}</span>}
        </div>
      </section>

      {(saved || initial) && (
        <section className="flex flex-col gap-3">
          <h2 className="text-[18px] font-[800] text-[var(--t1)]">② 진단 방식</h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <Link href="/csat/diagnosis/attempts/new" className="flex min-h-[44px] flex-col gap-1 rounded-[var(--r-lg)] border border-[var(--bd)] p-4 hover:border-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]">
              <span className="font-display text-[15px] font-[800] text-[var(--t1)]">최근 모의고사 결과가 있어요</span>
              <span className="break-keep font-body text-[13px] text-[var(--t2)]">시험 기록 입력 — 가장 정확해요</span>
            </Link>
            <Link href="/csat/diagnosis/test" className="flex min-h-[44px] flex-col gap-1 rounded-[var(--r-lg)] border border-[var(--bd)] p-4 hover:border-[var(--p)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p)]">
              <span className="font-display text-[15px] font-[800] text-[var(--t1)]">기록이 없어요</span>
              <span className="break-keep font-body text-[13px] text-[var(--t2)]">진단 테스트로 시작 — 대략적인 진단이에요</span>
            </Link>
          </div>
          {hasRecords && <Link href="/csat/diagnosis" className="font-body text-[13px] text-[var(--t1)] underline">지금 리포트 보기</Link>}
        </section>
      )}
    </div>
  )
}
