// apps/web/src/components/csat/diagnosis/map/PlanSection.tsx
//
// 학습 지도 rev4.0 — Workspace 학습계획(TASK 별) · 저장(4차). NeedPanel 안에서 열린다(관리 도구처럼 따로 떼지 않는다).
//   추천 이유 · 중심/보조 TASK · TASK 학습목표 · 계획량(출처 · 규칙) · 수행/남음(계획보다 더 한 것도 숨기지 않음) · 성취 조건 · 확인 상태 ·
//   다음 활동 · 조정(순서 · 계획량) · 확정/변경 저장(사유 · 메모) · 이력 · 되돌리기 · 재계획 제안.
// 정량(계획 진행)과 정성(확인된 성취)은 다른 줄 · 다른 말 — 진행을 퍼센트 · 막대로 그리지 않는다.
// 「저장됨 · 버전 N」은 서버가 저장을 확인했고 화면이 그 저장본과 같을 때만. 저장 구조가 없으면(승인 전) 이 기기 초안 모드.
// 조정 · 저장은 계획 칸만 바꾼다 — 근거 · 직접 확인 · 요구 칸은 읽기만 한다.

'use client'

import { ArrowDown, ArrowUp, CircleCheck, History, Minus, Plus, RotateCcw, Save, TriangleAlert } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useEffect, useMemo, useState, useTransition } from 'react'

import { CANON_VERSION, taskOf, templateOf } from '@/lib/csat/map/v4/definition'
import { ACHIEVEMENT_LABEL, RULE_LABEL, applyDraft, type PlanDraft, type TaskPlan, type WorkspacePlanView } from '@/lib/csat/map/v4/plan'
import { REASON_LABEL, applySaved, keyFor, planDrift, requestSignature, type PlanReason } from '@/lib/csat/map/v4/plan-commit'
import type { SavedPlans } from '@/lib/csat/map/v4/plan-store'
import { NEED_LABEL } from '@/lib/csat/map/v4/to-be'
import { STAGE_LABEL } from '@/lib/csat/map/v4/workspace'

import n from './needs.module.css'

const UNRESOLVED_LABEL: Record<TaskPlan['unresolved'][number], string> = {
  no_content: '확인 콘텐츠를 준비하고 있어요',
  stage_locked: '앞 단계를 마치면 열려요',
  canon_hold: '측정 방법을 정하는 중이에요',
  needs_direct_check: '아직 직접 확인 전 — 기출 기록으로만 보였어요',
  not_goal_related: '지금 목표 점수와 이어진 문항이 없어요',
}

/** 이 기기 초안의 열쇠 — 학습자 · 정의 버전 · 목표 · 저장 버전이 다르면 다른 초안(낡은 초안을 쓰지 않는다) */
export const draftKey = (viewer: string, ws: string, goal: number, savedVersion: number) => `map-v4-plan-draft:v2:${viewer}:${CANON_VERSION}:g${goal}:${ws}:v${savedVersion}`

function readDraft(key: string): PlanDraft | null {
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const d = JSON.parse(raw) as PlanDraft
    return Array.isArray(d.order) && d.planned && typeof d.planned === 'object' ? d : null
  } catch {
    return null
  }
}
function writeDraft(key: string, d: PlanDraft | null) {
  try {
    if (d) window.localStorage.setItem(key, JSON.stringify(d))
    else window.localStorage.removeItem(key)
  } catch {
    // 저장소를 못 쓰면 이 화면에서만 유지된다(초안이라 잃어도 근거 · 기록은 그대로)
  }
}

/** 저장 시각을 서울 시각으로(서버 · 브라우저가 같은 글자 — UTC 로 자르면 오전 저장이 전날로 보였다) */
const seoul = (iso: string, withTime: boolean) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  return `${p.year}.${p.month}.${p.day}${withTime ? ` ${p.hour}:${p.minute}` : ''}`
}

const sameAsSaved = (a: WorkspacePlanView, b: WorkspacePlanView) =>
  [...a.tasks].sort((x, y) => x.task.localeCompare(y.task)).map((t) => `${t.task}:${t.quantity.planned ?? '-'}`).join('|') === [...b.tasks].sort((x, y) => x.task.localeCompare(y.task)).map((t) => `${t.task}:${t.quantity.planned ?? '-'}`).join('|')

type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'error'; code: string; detail?: string } | { kind: 'conflict' }

export function PlanSection({ view, reason, past, saved, viewer, goal }: { view: WorkspacePlanView; reason: string | null; past: boolean; saved: SavedPlans | null; viewer: string; goal: number }) {
  const t = templateOf(view.workspace)
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const store = saved?.status === 'installed' && !saved.error
  const sw = store ? saved?.byTemplate[view.workspace] ?? null : null
  const savedVersion = sw?.latest.version ?? 0
  const base = useMemo(() => applySaved(view, sw?.latest ?? null), [view, sw])
  const drift = useMemo(() => planDrift(sw?.latest ?? null, view), [sw, view])
  const key = draftKey(viewer, view.workspace, goal, savedVersion)
  const [draft, setDraft] = useState<PlanDraft | null>(null)
  useEffect(() => setDraft(readDraft(key)), [key])
  const shown = useMemo(() => applyDraft(base, draft), [base, draft])
  // 바뀐 내용 = 초안이 있고, 계획량이나 순서가 저장본(없으면 추천 계획)과 다르다
  const dirty = draft !== null && (!sameAsSaved(shown, base) || shown.tasks.map((x) => x.task).join() !== base.tasks.map((x) => x.task).join())
  const [save, setSave] = useState<SaveState>({ kind: 'idle' })
  const [pending, setPending] = useState<{ key: string; sig: string } | null>(null)
  const [note, setNote] = useState('')
  const defaultReason: PlanReason = !sw ? 'initial' : drift?.definition ? 'definition_change' : drift && drift.content.length ? 'content_change' : 'learner_adjust'
  const [why, setWhy] = useState<PlanReason>(defaultReason)
  useEffect(() => setWhy(defaultReason), [defaultReason])

  const update = (next: PlanDraft | null) => {
    setDraft(next)
    writeDraft(key, next)
    if (save.kind !== 'idle') setSave({ kind: 'idle' })
  }
  const baseDraft = (): PlanDraft => draft ?? { order: shown.tasks.map((p) => p.task), planned: {} }
  const move = (id: string, dir: -1 | 1) => {
    const order = shown.tasks.map((p) => p.task)
    const i = order.indexOf(id)
    const j = i + dir
    if (j < 0 || j >= order.length) return
    ;[order[i], order[j]] = [order[j], order[i]]
    update({ ...baseDraft(), order })
  }
  const setPlanned = (p: TaskPlan, v: number) => update({ ...baseDraft(), order: shown.tasks.map((x) => x.task), planned: { ...baseDraft().planned, [p.task]: v } })

  const submit = async (reasonCode: PlanReason, restoreOf?: number) => {
    const src = restoreOf ? sw?.history.find((h) => h.version === restoreOf)?.plan : null
    const req = {
      template: view.workspace,
      order: src ? src.order : shown.tasks.map((p) => p.task),
      planned: Object.fromEntries((src ? src.tasks.map((x) => { const now = view.tasks.find((p) => p.task === x.task)?.quantity.available ?? null; return [x.task, x.planned === null || now === null ? (now === null ? null : x.planned) : Math.min(x.planned, now)] }) : shown.tasks.map((p) => [p.task, p.quantity.planned])) as [string, number | null][]),
      reason: reasonCode,
      note: note.trim() || null,
      expectedVersion: savedVersion,
      ...(restoreOf ? { restoreOf } : {}),
    }
    // 같은 논리적 요청의 재전송만 같은 키(네트워크 실패 뒤 다시 눌러도 두 번 저장되지 않는다) — 내용이 바뀌면 새 키
    const attempt = keyFor(pending, requestSignature(req), () => crypto.randomUUID())
    setPending(attempt)
    setSave({ kind: 'saving' })
    const body = { ...req, clientKey: attempt.key }
    try {
      const res = await fetch('/api/csat/diagnosis/map/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const j = (await res.json().catch(() => ({}))) as { code?: string; detail?: string }
      if (res.ok) {
        writeDraft(key, null)
        setDraft(null)
        setNote('')
        setPending(null)
        setSave({ kind: 'idle' })
        startRefresh(() => router.refresh())
        return
      }
      // 5xx · 게이트웨이 시간 초과는 저장됐을 수도 있다 — 네트워크 실패처럼 같은 키를 남겨 재시도가 중복 · 거짓 충돌을 만들지 않게(독립 리뷰 P2)
      if (res.status < 500) setPending(null)
      setSave(res.status === 409 ? { kind: 'conflict' } : { kind: 'error', code: j.code ?? String(res.status), detail: j.detail })
    } catch {
      // 네트워크 실패 — 저장됐는지 모른다. 같은 내용을 다시 보내면 같은 키라 서버가 같은 결과를 돌려준다(pending 유지)
      setSave({ kind: 'error', code: 'network' })
    }
  }

  const ERR: Record<string, string> = {
    network: '연결이 끊겨 저장됐는지 알 수 없어요. 다시 누르면 같은 요청으로 확인해요(두 번 저장되지 않아요).',
    planned_over_available: '그 사이 쓸 수 있는 문항 수가 바뀌었어요. 계획량을 줄이거나 화면을 새로 불러와 주세요.',
    not_installed: '계획 저장이 아직 열리지 않았어요. 조정은 이 기기에 남아 있어요.',
    canon_mismatch: '학습 기준이 바뀌었어요 — 사유를 「학습 기준이 바뀜」으로 골라 다시 저장해 주세요.',
  }

  return (
    <section className={n.plan} aria-labelledby="plan-h" data-testid="plan-section" data-ws={view.workspace} data-draft={dirty ? 'yes' : 'no'} data-store={store ? 'installed' : 'not_installed'} data-saved-version={savedVersion}>
      <div className={n.planHead}>
        <h3 id="plan-h" className={n.planTitle}>「{t?.name ?? view.workspace}」 학습계획</h3>
        {shown.progress ? (
          <p className={n.planProgress} data-testid="plan-progress">
            계획 진행 <strong>{shown.progress.done} / {shown.progress.planned}문항</strong> · 진행은 한 문항씩 센 양이고 실력 점수가 아니에요
          </p>
        ) : (
          <p className={n.planProgress} data-testid="plan-progress">지금 계획할 수 있는 문항이 없어요 — 아래에 이유가 있어요</p>
        )}
      </div>
      {/* 저장 상태 — 서버가 확인한 저장본과 화면이 같을 때만 「저장됨」 */}
      {store && (
        <p className={n.saveState} data-testid="plan-save-state" data-state={refreshing ? 'saving' : sw && !dirty ? 'saved' : dirty ? 'dirty' : 'none'}>
          {refreshing ? (
            <>저장 결과를 불러오는 중…</>
          ) : sw && !dirty ? (
            <><Save size={13} aria-hidden="true" /> 저장됨 · 버전 {sw.latest.version} · {seoul(sw.latest.createdAt, false)} · {REASON_LABEL[sw.latest.reason]}</>
          ) : dirty ? (
            <>바꾼 내용이 아직 저장되지 않았어요{sw ? ` · 저장본은 버전 ${sw.latest.version}` : ''}</>
          ) : (
            <>아직 이 계획을 확정하지 않았어요</>
          )}
        </p>
      )}
      {store && drift && (drift.content.length > 0 || drift.definition) && !past && (
        <p className={n.notice} data-testid="plan-drift">
          <TriangleAlert size={13} aria-hidden="true" /> 저장한 뒤 {drift.definition ? '학습 기준이' : '쓸 수 있는 문항 수가'} 바뀌었어요
          {drift.overAvailable.length ? ` — ${drift.overAvailable.length}개 항목의 계획량이 지금 문항 수보다 많아 줄여서 보여 드려요` : ''}. 계획을 확인하고 다시 저장해 주세요.
        </p>
      )}
      {reason && <p className={n.sub}>{reason}</p>}
      <ol className={n.planList}>
        {shown.tasks.map((p, i) => {
          const isCore = view.core.includes(p.task)
          const q = p.quantity
          const extra = q.planned !== null && q.done > q.planned ? q.done - q.planned : 0
          return (
            <li key={p.task} className={n.planItem} data-task={p.task} data-core={isCore} data-planned={q.planned ?? ''} data-done={q.done} data-achievement={p.achievement}>
              <div className={n.planMain}>
                <p className={n.planName}>
                  {p.name}
                  <span className={n.needType}>{isCore ? '중심' : '보조'}{p.need ? ` · ${NEED_LABEL[p.need]}` : ''}{p.stage ? ` · ${STAGE_LABEL[p.stage]}` : ''}</span>
                </p>
                <p className={n.planGoal}>{p.goal}</p>
                <p className={n.planQty} data-testid="plan-qty">
                  {q.planned !== null ? (
                    <>계획 <strong>{q.planned}문항</strong>(가능 {q.available}) · 수행 {q.done}{extra ? ` — 계획보다 ${extra}문항 더 했어요` : ` · 남음 ${q.remaining}`} — 기준: {q.rule ? RULE_LABEL[q.rule] : '—'}</>
                  ) : (
                    <>계획할 수 있는 문항 없음{q.done ? ` · 수행 ${q.done}` : ''} · {p.unresolved.filter((u) => u !== 'needs_direct_check').map((u) => UNRESOLVED_LABEL[u]).join(' · ') || (isCore ? '확인 결과를 기다려요' : '이 항목은 중심 묶음에서 계획해요')}</>
                  )}
                </p>
                <p className={n.planCriterion}>
                  <CircleCheck size={13} strokeWidth={1.9} aria-hidden="true" />
                  <span><strong>{ACHIEVEMENT_LABEL[p.achievement]}</strong> · 다 했다고 보는 기준: {p.criterion}</span>
                </p>
              </div>
              <div className={n.planSide}>
                {q.adjustable && !past && (
                  <div className={n.stepper} role="group" aria-label={`${p.name} 계획 문항 수`}>
                    <button type="button" className={n.stepBtn} aria-label={`${p.name} 계획 한 문항 줄이기`} disabled={(q.planned ?? 0) <= 0} onClick={() => setPlanned(p, (q.planned ?? 0) - 1)}>
                      <Minus size={14} aria-hidden="true" />
                    </button>
                    <span className={n.stepVal} aria-live="polite">{q.planned}</span>
                    <button type="button" className={n.stepBtn} aria-label={`${p.name} 계획 한 문항 늘리기`} disabled={(q.planned ?? 0) >= (q.available ?? 0)} onClick={() => setPlanned(p, (q.planned ?? 0) + 1)}>
                      <Plus size={14} aria-hidden="true" />
                    </button>
                  </div>
                )}
                {!past && (
                  <div className={n.orderBtns}>
                    <button type="button" className={n.stepBtn} aria-label={`${p.name} 위로`} disabled={i === 0} onClick={() => move(p.task, -1)}>
                      <ArrowUp size={14} aria-hidden="true" />
                    </button>
                    <button type="button" className={n.stepBtn} aria-label={`${p.name} 아래로`} disabled={i === shown.tasks.length - 1} onClick={() => move(p.task, 1)}>
                      <ArrowDown size={14} aria-hidden="true" />
                    </button>
                  </div>
                )}
                {p.next && !past && (
                  <Link href={p.next.href} className={n.go} data-testid="plan-go">
                    활동 시작
                  </Link>
                )}
              </div>
            </li>
          )
        })}
      </ol>

      {!past && store && (
        <div className={n.saveBox} data-testid="plan-save-box">
          <label className={n.saveField}>
            <span>바꾼 이유</span>
            <select value={why} onChange={(e) => setWhy(e.target.value as PlanReason)} data-testid="plan-reason" disabled={!sw}>
              {(sw ? (['learner_adjust', 'new_exam', 'check_result', 'goal_change', 'content_change', 'definition_change'] as PlanReason[]) : (['initial'] as PlanReason[])).map((r) => (
                <option key={r} value={r}>{REASON_LABEL[r]}</option>
              ))}
            </select>
          </label>
          <label className={n.saveField}>
            <span>메모(선택)</span>
            <input value={note} maxLength={500} onChange={(e) => setNote(e.target.value)} placeholder="예: 이번 주는 5문항만" data-testid="plan-note" />
          </label>
          <button type="button" className={n.cta} onClick={() => submit(sw ? why : 'initial')} disabled={save.kind === 'saving' || refreshing || (!!sw && !dirty && !(drift && (drift.content.length || drift.definition)))} data-testid="plan-save">
            <Save size={15} aria-hidden="true" />
            {save.kind === 'saving' || refreshing ? '저장하는 중…' : sw ? '변경 저장' : '이 계획으로 확정'}
          </button>
          {save.kind === 'conflict' && (
            <p className={n.saveErr} role="alert" data-testid="plan-conflict">
              다른 곳(다른 기기 · 다른 탭)에서 계획이 먼저 바뀌었어요. 내 화면은 저장하지 않았어요.{' '}
              <button type="button" className={n.taskLink} onClick={() => startRefresh(() => router.refresh())}>새로 불러오기</button>
            </p>
          )}
          {save.kind === 'error' && (
            <p className={n.saveErr} role="alert" data-testid="plan-error" data-code={save.code}>
              저장하지 못했어요 — {ERR[save.code] ?? `다시 시도해 주세요(${save.code})`}
            </p>
          )}
        </div>
      )}

      {store && sw && sw.history.length > 0 && (
        <details className={n.history} data-testid="plan-history">
          <summary><History size={13} aria-hidden="true" /> 이전 계획 {sw.history.length}개</summary>
          <ol>
            {sw.history.map((h) => (
              <li key={h.version} data-version={h.version}>
                <span><strong>버전 {h.version}</strong> · {seoul(h.createdAt, true)} · {REASON_LABEL[h.reason]}{h.restoredFrom ? `(버전 ${h.restoredFrom})` : ''}{h.note ? ` · 「${h.note}」` : ''}</span>
                <span className={n.historyPlan}>{h.plan.tasks.filter((x) => x.planned !== null).map((x) => `${taskOf(x.task).name} ${x.planned}문항`).join(' · ') || '계획량 없음'}</span>
                {!past && h.version !== sw.latest.version && (
                  <button type="button" className={n.ghost} onClick={() => submit('restore', h.version)} disabled={save.kind === 'saving'} data-testid="plan-restore">
                    <RotateCcw size={13} aria-hidden="true" /> 이 버전으로 되돌리기
                  </button>
                )}
              </li>
            ))}
          </ol>
          <p className={n.fine}>되돌려도 지난 기록은 지우지 않고 새 버전으로 남아요. 그때보다 쓸 수 있는 문항이 줄었으면 지금 문항 수에 맞춰 되돌려요.</p>
        </details>
      )}

      <div className={n.planFoot}>
        <p className={n.fine} data-testid="plan-not-saved">
          {store
            ? '계획은 저장 버전으로 남고 다른 기기에서도 같게 보여요. 조정해도 확인 결과와 근거는 바뀌지 않아요.'
            : saved?.error
              ? '저장된 계획을 불러오지 못했어요. 지금 조정은 이 기기에만 기억돼요.'
              : '순서 · 계획량 조정은 이 기기에만 기억돼요. 계획 확정 · 변경 기록 저장은 곧 열려요. 조정해도 확인 결과와 근거는 바뀌지 않아요.'}
        </p>
        {dirty && (
          <button type="button" className={n.ghost} onClick={() => update(null)} data-testid="plan-reset">
            <RotateCcw size={13} aria-hidden="true" />
            {sw ? '저장한 계획으로 되돌리기' : '추천 계획으로 되돌리기'}
          </button>
        )}
      </div>
    </section>
  )
}
