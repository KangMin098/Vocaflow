// apps/web/src/components/csat/diagnosis/map/FinalAssessment.tsx
//
// 최종 평가 — 학습자가 「어느 날 응시하는 목표 시험을 최종 평가로 볼지」 직접 정하고(목표 버전마다 한 번 · 바꾸려면 목표를 새로 저장),
// 그날의 첫 풀이 live 기록 하나만 목표 기준과 나란히 비교한다. 판정은 finalAttainment(goalOutcome 재사용) 결과를 그리기만 한다.
// 정하기 전에는 「판정에 들어가는 기록 | 들어가지 않는 기록」을 대조해 보여 주고 고르게 한다. 퍼센트 · 예측 · 학습 효과 주장 없음.

'use client'

import { useRouter } from 'next/navigation'
import { useRef, useState } from 'react'
import { CalendarCheck } from 'lucide-react'

import { FINAL_MET_LIMIT, FINAL_STATUS_LABEL, type FinalAttainment } from '@/lib/csat/map/v62/final-assessment'
import { SCORE_STATUS_LABEL } from '@/lib/csat/map/v62/goal-outcome'
import { GOAL_EXAM_LABEL, type GoalVersion } from '@/lib/csat/map/v62/target-goal'

import f from './FinalAssessment.module.css'
import u from './unified.module.css'

export function FinalAssessment({ goal, final: a }: { goal: GoalVersion; final: FinalAttainment }) {
  const router = useRouter()
  const [date, setDate] = useState(a.window ? (goal.date ?? a.window.max) : '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const attempt = useRef<{ key: string; body: string } | null>(null)
  const exam = goal.exam ? GOAL_EXAM_LABEL[goal.exam] : '목표 시험'
  const j = a.judged
  const rec = j?.latest ?? null

  async function bind() {
    if (!a.window || busy) return
    const body = JSON.stringify({ goalVersionId: goal.id, date })
    // Same request body → same key (safe resend); a changed choice is a new request.
    if (attempt.current?.body !== body) attempt.current = { key: crypto.randomUUID(), body }
    setBusy(true)
    setError(null)
    try {
      const res = await fetch('/api/csat/diagnosis/map/goal/final-assessment', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ goalVersionId: goal.id, date, clientKey: attempt.current.key }) })
      if (!res.ok) {
        setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? '최종 평가를 저장하지 못했어요')
        return
      }
      router.refresh()
    } catch {
      setError('연결이 끊겨 저장 여부를 확인하지 못했어요 — 같은 선택으로 다시 눌러 주세요')
    } finally {
      setBusy(false)
    }
  }

  return (
    <details className={u.gp} data-testid="final-assessment" data-status={a.status} open={a.status === 'unbound' || a.status === 'met' || a.status === 'not_met'}>
      <summary className={u.gpSum}>
        <CalendarCheck size={16} aria-hidden="true" />
        <span className={u.gpSumText}>
          최종 평가
          <span className={u.gpSumNote}>{a.binding ? `${a.binding.date} ${exam} · ` : ''}{FINAL_STATUS_LABEL[a.status]}</span>
        </span>
        <span className={u.gpOpen}>펼치기</span>
      </summary>

      {a.status === 'unbound' && a.window && (
        <div className={f.body}>
          <div className={f.contrast} role="group" aria-label="최종 평가에 들어가는 기록과 들어가지 않는 기록">
            <div className={f.col} data-testid="final-counts">
              <h3 className={f.colH}>판정에 쓰는 기록</h3>
              <ul className={f.list}>
                <li>고른 날 응시한 {exam} 기록 하나</li>
                <li>처음 푸는 시험지 · 실제 응시(live)</li>
                <li>앱에서 문항 · 지문을 본 적 없음</li>
                <li>등급은 적어 둔 값만 비교</li>
              </ul>
            </div>
            <div className={f.col} data-testid="final-excluded">
              <h3 className={f.colH}>판정에 쓰지 않는 기록</h3>
              <ul className={f.list}>
                <li>다른 날 · 다른 종류 시험</li>
                <li>재풀이 · 앱 연습 · 진단</li>
                <li>노출 여부를 확인 못 한 기록</li>
                <li>TASK 활동 · 계획 수행량</li>
              </ul>
            </div>
          </div>
          <div className={f.pick}>
            <label className={f.label} htmlFor="final-date">{exam} 응시일</label>
            <input id="final-date" className={f.date} type="date" min={a.window.min} max={a.window.max} value={date} onChange={(e) => setDate(e.target.value)} data-testid="final-date" />
            <button type="button" className={u.ghost} onClick={bind} disabled={busy || !date || date < a.window.min || date > a.window.max} data-testid="final-bind">
              {busy ? '저장 중…' : '이 날을 최종 평가로 정하기'}
            </button>
          </div>
          <p className={u.gpNote}>목표 버전마다 한 번 정해요. 바꾸려면 목표를 새로 저장해요 — 앞서 정한 기록은 지우지 않아요.</p>
          {error && <p className={f.error} role="alert" data-testid="final-error">{error}</p>}
        </div>
      )}

      {(a.status === 'met' || a.status === 'not_met' || a.status === 'not_judgeable') && j && rec && (
        <div className={f.body}>
          <div className={f.contrast} role="group" aria-label="목표 기준과 최종 평가 기록 비교">
            <div className={f.col}>
              <h3 className={f.colH}>목표 기준</h3>
              <p className={f.big}>{goal.score}점{goal.grade !== null ? ` · ${goal.grade}등급` : ''}</p>
            </div>
            <div className={f.col} data-testid="final-record">
              <h3 className={f.colH}>{rec.examLabel} ({rec.takenAt})</h3>
              <p className={f.big}>{rec.raw ?? '점수 없음'}{rec.raw !== null ? '점' : ''}{goal.grade !== null ? ` · ${rec.grade ?? '등급 미기록'}${rec.grade ? '등급' : ''}` : ''}</p>
            </div>
          </div>
          {a.status === 'not_judgeable' && <p className={u.gpNote} data-testid="final-reason">{j.score.status === 'reached' ? '점수 기준은 충족했지만 기록에 등급이 없어 목표 등급과 비교하지 못했어요' : SCORE_STATUS_LABEL[j.score.status]}</p>}
          {a.status === 'met' && <p className={u.gpNote} data-testid="final-limit">{FINAL_MET_LIMIT}</p>}
          {a.status === 'not_judgeable' && j.grade.status === 'no_record_grade' && <p className={u.gpNote}>다음: 이 기록의 등급을 함께 적으면 목표 등급과 비교해요 — 점수로 등급을 만들지 않아요</p>}
          {a.status === 'not_met' && <p className={u.gpNote}>다음: 목표를 새로 정하거나 기록과 TASK 근거로 계획을 다시 세워요</p>}
        </div>
      )}

      {(a.status === 'scheduled' || a.status === 'awaiting_record') && a.binding && (
        <p className={u.gpNote} data-testid="final-wait">
          {a.status === 'scheduled' ? `${a.binding.date} ${exam} 응시 뒤 그날 기록을 입력하면 목표 기준과 비교해요` : `${a.binding.date} ${exam} 응시 기록을 입력하면 판정해요 — 다른 날 기록으로 대신하지 않아요`}
        </p>
      )}
    </details>
  )
}
