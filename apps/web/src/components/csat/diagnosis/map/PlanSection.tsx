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
import { useEffect, useMemo, useRef, useState, useTransition } from 'react'

import { CANON_VERSION, taskOf, templateOf, templates } from '@/lib/csat/map/v4/definition'
import { ACHIEVEMENT_LABEL, RULE_LABEL, applyDraft, type PlanDraft, type TaskPlan, type WorkspacePlanView } from '@/lib/csat/map/v4/plan'
import { acknowledgePlan, bindPlanDraft, listenPlanAck, sameStageDraft, type PlanAck } from '@/lib/csat/map/v4/plan-ack'
import { goalMismatch } from '@/lib/csat/map/v62/next-action'
import { quantityBasis } from '@/lib/csat/map/v62/saved-plan'
import { REASON_LABEL, applySaved, transferRestoreShortage, keyFor, planDrift, requestSignature, type PlanReason } from '@/lib/csat/map/v4/plan-commit'
import type { SavedPlans } from '@/lib/csat/map/v4/plan-store'
import { NEED_LABEL } from '@/lib/csat/map/v4/to-be'
import { STAGE_LABEL } from '@/lib/csat/map/v4/workspace'
import { planChange, previousOf, unitOf, type PlanSide } from '@/lib/csat/map/v62/plan-change'
import { GOAL_EXAM_LABEL } from '@/lib/csat/map/v62/target-goal'
import { withMapReturn } from '@/lib/csat/map-return'
import { outgoingCtx } from '@/lib/csat/map/v62/return-ctx'

import n from './needs.module.css'
import { PlanChangeSummary } from './PlanChangeSummary'

const UNRESOLVED_LABEL: Record<TaskPlan['unresolved'][number], string> = {
  transfer_shortage: '기본 적용 계획보다 자료가 부족해요',
  no_content: '확인 콘텐츠를 준비하고 있어요',
  stage_locked: '앞 단계를 마치면 열려요',
  repair_material_needed: '바로잡기 자료가 필요해요 — 학습 묶음에서 「자료 받기」로 설명 · 안내 연습을 받아요(틀린 평가 문항은 다시 풀지 않아요)',
  material_needed: '새 자료가 필요해요 — 학습 묶음에서 「자료 받기」를 눌러 주세요',
  canon_hold: '측정 방법을 정하는 중이에요',
  needs_direct_check: '아직 직접 확인 전 — 기출 기록으로만 보였어요',
  not_goal_related: '지금 목표 점수와 이어진 문항이 없어요',
}

/** 이 기기 초안의 열쇠 — 학습자 · 정의 버전 · 목표 · 저장 버전이 다르면 다른 초안(낡은 초안을 쓰지 않는다) */
export const draftKey = (viewer: string, ws: string, goal: number, savedVersion: number, goalVersion?: number | null) => `map-v4-plan-draft:v2:${viewer}:${CANON_VERSION}:g${goal}:${goalVersion === undefined ? '' : `gv${goalVersion ?? 'none'}:`}${ws}:v${savedVersion}`

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
    // null is an explicit reset marker; an older acknowledgement must not resurrect it.
    window.localStorage.setItem(key, JSON.stringify(d))
  } catch {
    // 저장소를 못 쓰면 이 화면에서만 유지된다(초안이라 잃어도 근거 · 기록은 그대로)
  }
}

function readNote(key: string): string {
  try { return (window.localStorage.getItem(key + ':note') ?? '').slice(0, 500) } catch { return '' }
}
function writeNote(key: string, value: string) {
  try { window.localStorage.setItem(key + ':note', value) } catch { /* device draft only */ }
}

function hasDraft(key: string): boolean {
  try { return window.localStorage.getItem(key) === 'null' || readDraft(key) !== null } catch { return false }
}
function hasNote(key: string): boolean {
  try { return window.localStorage.getItem(key + ':note') !== null } catch { return false }
}

/** Raw device values distinguish no edit from a reset; read failures stay unknown. */
function storedEditStamp(key: string): string | null {
  try { return JSON.stringify([window.localStorage.getItem(key), window.localStorage.getItem(key + ':note')]) } catch { return null }
}

/** The authenticated response may arrive while no editor is mounted. */
function carryPlanEdit(from: string, to: string) {
  if (!hasDraft(to)) writeDraft(to, readDraft(from))
  if (!hasNote(to)) writeNote(to, readNote(from))
}

/** 저장 시각을 서울 시각으로(서버 · 브라우저가 같은 글자 — UTC 로 자르면 오전 저장이 전날로 보였다) */
const seoul = (iso: string, withTime: boolean) => {
  const p = Object.fromEntries(new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Seoul', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).formatToParts(new Date(iso)).map((x) => [x.type, x.value]))
  return `${p.year}.${p.month}.${p.day}${withTime ? ` ${p.hour}:${p.minute}` : ''}`
}

const sameAsSaved = (a: WorkspacePlanView, b: WorkspacePlanView) =>
  [...a.tasks].sort((x, y) => x.task.localeCompare(y.task)).map((t) => `${t.task}:${t.quantity.planned ?? '-'}`).join('|') === [...b.tasks].sort((x, y) => x.task.localeCompare(y.task)).map((t) => `${t.task}:${t.quantity.planned ?? '-'}`).join('|')

type SaveState = { kind: 'idle' } | { kind: 'saving' } | { kind: 'error'; code: string; detail?: string } | { kind: 'conflict'; goalChanged?: boolean }

export function PlanSection({ view, reason, past, saved, viewer, goal }: { view: WorkspacePlanView; reason: string | null; past: boolean; saved: SavedPlans | null; viewer: string; goal: number }) {
  const t = templateOf(view.workspace)
  const router = useRouter()
  const [refreshing, startRefresh] = useTransition()
  const store = saved?.status === 'installed' && !saved.error
  const sw = store ? saved?.byTemplate[view.workspace] ?? null : null
  const savedVersion = sw?.latest.version ?? 0
  // 자료 없을 때 저장한 빈 행(계획량 · 가용량 null)으로 지금 계획량을 덮지 않는다(T-0061 · quantityBasis) — 재계획 판정은 원본으로
  const base = useMemo(() => applySaved(view, quantityBasis(sw?.latest ?? null)), [view, sw])
  const drift = useMemo(() => planDrift(sw?.latest ?? null, view), [sw, view])
  // T-0072 — 저장 PLAN 의 목표 버전 ≠ 지금 목표(상단 CTA · 요약과 같은 goalMismatch). 같은 목표면 저장 상태 · 수량 그대로
  const goalChanged = !past && !!store && !!sw && goalMismatch(view.workspace, saved)
  const needsReplan = !past && (goalChanged || (!!drift && (drift.content.length > 0 || drift.definition || drift.stages.length > 0)))
  const goalVersion = saved?.goalVersionId ?? null
  const key = draftKey(viewer, view.workspace, goal, savedVersion, goalVersion)
  const legacyKey = draftKey(viewer, view.workspace, goal, savedVersion)
  const [legacyDraft, setLegacyDraft] = useState(false)
  const [note, setNote] = useState('')
  const [draft, setDraft] = useState<PlanDraft | null>(null)
  const handoff = useRef<{ sourceKey: string; key: string; stages: PlanAck['stages'] } | null>(null)
  const stageSignature = view.tasks.map(p => p.task + ':' + p.stage).join('|')
  const currentStages = () => Object.fromEntries(view.tasks.map(p => [p.task, p.stage ?? null]))
  useEffect(() => {
    const carry = handoff.current
    const next = carry?.key === key ? sameStageDraft(readDraft(key), carry.stages, currentStages()) : bindPlanDraft(readDraft(key), currentStages())
    setDraft(next)
    if (carry?.key === key) writeDraft(key, next)
    setNote(readNote(key))
    setLegacyDraft(readDraft(legacyKey) !== null || readNote(legacyKey) !== '')
    if (carry && key !== carry.sourceKey) handoff.current = null
    // key includes viewer, template, goal and saved version; edits belong to that context.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, stageSignature])
  const shown = useMemo(() => applyDraft(base, draft), [base, draft])
  const contentBlocked = shown.tasks.some(p => (view.core.includes(p.task) || p.stage !== 'transfer') && p.quantity.planned !== null && p.quantity.available !== null && p.quantity.planned > p.quantity.available)
  // 바뀐 내용 = 초안이 있고, 계획량이나 순서가 저장본(없으면 추천 계획)과 다르다
  const dirty = (draft !== null && (!sameAsSaved(shown, base) || shown.tasks.map((x) => x.task).join() !== base.tasks.map((x) => x.task).join())) || note.trim().length > 0
  const [save, setSave] = useState<SaveState>({ kind: 'idle' })
  const [pending, setPending] = useState<{ key: string; sig: string } | null>(null)
  const defaultReason: PlanReason = !sw ? 'initial' : goalChanged ? 'goal_change' : drift?.definition ? 'definition_change' : drift && drift.content.length ? 'content_change' : drift && drift.stages.length ? 'check_result' : 'learner_adjust'
  const [why, setWhy] = useState<PlanReason>(defaultReason)
  const live = useRef({ key, mounted: true, request: 0, edit: 0 })
  // Ref changes synchronously, before an old response can arrive ahead of passive effects.
  if (live.current.key !== key) live.current = { key, mounted: live.current.mounted, request: live.current.request + 1, edit: 0 }
  useEffect(() => { live.current.mounted = true; return () => { live.current.mounted = false; live.current.request++ } }, [])
  useEffect(() => { setSave({ kind: 'idle' }); setPending(null);  }, [key])
  useEffect(() => {
    if (past) return
    return listenPlanAck(key, ack => {
      if (!live.current.mounted || live.current.key !== key) return false
      if (ack.version <= savedVersion || (sw && ack.workspaceId !== sw.workspaceId)) return false
      const nextKey = draftKey(viewer, view.workspace, goal, ack.version, goalVersion)
      const carry = sameStageDraft(readDraft(key), ack.stages, currentStages())
      // An already newer draft wins. Keep the old key as provenance; no automatic server save.
      if (!hasDraft(nextKey)) writeDraft(nextKey, carry)
      if (!hasNote(nextKey)) writeNote(nextKey, readNote(key))
      handoff.current = { sourceKey: key, key: nextKey, stages: ack.stages }
      setPending(null)
      setSave({ kind: 'idle' })
      startRefresh(() => router.refresh())
      return true
    })
    // Subscribe to the exact storage/server context, not each keystroke.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, past, sw?.workspaceId, stageSignature])
  const edited = () => { live.current.edit++; setSave({ kind: 'idle' }) }
  useEffect(() => setWhy(defaultReason), [defaultReason])

  const update = (next: PlanDraft | null) => {
    edited()
    const bound = next ? { ...next, stages: currentStages() } : null
    setDraft(bound)
    writeDraft(key, bound)
    if (next === null) { setNote(''); writeNote(key, ''); if (handoff.current?.sourceKey === key) writeNote(handoff.current.key, '') }
    if (handoff.current?.sourceKey === key) writeDraft(handoff.current.key, bindPlanDraft(bound, currentStages()))
    if (save.kind !== 'idle') setSave({ kind: 'idle' })
  }
  const baseDraft = (): PlanDraft => bindPlanDraft(draft, currentStages()) ?? { order: shown.tasks.map((p) => p.task), planned: {}, stages: currentStages() }
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
    const request = ++live.current.request
    const edit = live.current.edit
    const submittedStamp = storedEditStamp(key)
    const current = () => live.current.mounted && live.current.key === key && live.current.request === request && live.current.edit === edit
    const src = restoreOf ? sw?.history.find((h) => h.version === restoreOf)?.plan : null
    const req = {
      template: view.workspace,
      order: src ? src.order : shown.tasks.map((p) => p.task),
      planned: Object.fromEntries((src ? src.tasks.map((x) => { const current = view.tasks.find((p) => p.task === x.task); const now = current?.quantity.available ?? null; const restored = restoreOf ? view.restoreTransfer?.[restoreOf]?.[x.task] : undefined; if (current?.stage === 'transfer' && view.core.includes(x.task) && restored !== undefined) return [x.task, restored]; if (x.stage !== current?.stage) return [x.task, current?.quantity.planned ?? null]; return [x.task, x.planned === null || now === null ? (now === null ? null : x.planned) : x.stage === 'transfer' ? x.planned : Math.min(x.planned, now)] }) : shown.tasks.map((p) => [p.task, p.quantity.planned])) as [string, number | null][]),
      reason: reasonCode,
      note: note.trim() || null,
      expectedVersion: savedVersion,
      expectedGoalVersion: goalVersion,
      ...(restoreOf ? { restoreOf } : {}),
    }
    // Supporting TRANSFER amounts are a reference to the core workspace's policy.
    for (const p of view.tasks) if (p.stage === 'transfer' && !view.core.includes(p.task)) req.planned[p.task] = null
    // 같은 논리적 요청의 재전송만 같은 키(네트워크 실패 뒤 다시 눌러도 두 번 저장되지 않는다) — 내용이 바뀌면 새 키
    const attempt = keyFor(pending, requestSignature(req), () => crypto.randomUUID())
    setPending(attempt)
    setSave({ kind: 'saving' })
    const body = { ...req, clientKey: attempt.key }
    try {
      const res = await fetch('/api/csat/diagnosis/map/plan', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) })
      const j = (await res.json().catch(() => ({}))) as { code?: string; detail?: string; version?: number; workspaceId?: string }
      if (res.ok && Number.isSafeInteger(j.version) && j.version! > savedVersion && typeof j.workspaceId === 'string' && (!sw || sw.workspaceId === j.workspaceId)) {
        const active = current()
        if (active || (submittedStamp !== null && storedEditStamp(key) === submittedStamp)) {
          writeDraft(key, null)
          writeNote(key, '')
          if (active) { setDraft(null); setNote('') }
        }
        carryPlanEdit(key, draftKey(viewer, view.workspace, goal, j.version!, goalVersion))
        acknowledgePlan(key, { version: j.version!, workspaceId: j.workspaceId, stages: currentStages() })
        return
      }
      if (!current()) return
      if (res.ok) {
        writeDraft(key, null)
        writeNote(key, '')
        setDraft(null)
        setNote('')
        setPending(null)
        setSave({ kind: 'idle' })
        startRefresh(() => router.refresh())
        return
      }
      // 5xx · 게이트웨이 시간 초과는 저장됐을 수도 있다 — 네트워크 실패처럼 같은 키를 남겨 재시도가 중복 · 거짓 충돌을 만들지 않게(독립 리뷰 P2)
      if (res.status < 500) setPending(null)
      setSave(res.status === 409 ? { kind: 'conflict', goalChanged: j.code === 'goal_changed' } : { kind: 'error', code: j.code ?? String(res.status), detail: j.detail })
    } catch {
      if (!current()) return
      // 네트워크 실패 — 저장됐는지 모른다. 같은 내용을 다시 보내면 같은 키라 서버가 같은 결과를 돌려준다(pending 유지)
      setSave({ kind: 'error', code: 'network' })
    }
  }

  const ERR: Record<string, string> = {
    restore_transfer_policy: '복원할 적용 계획량과 달라요. 화면을 다시 불러와 주세요.',
    planned_min: '다른 글 적용 계획은 최소 1지문이에요.',
    transfer_restore_shortage: '복원할 적용 계획보다 현재 자료가 부족해요. 자료가 준비된 뒤 복원해 주세요.',
    planned_not_owned: '적용 계획량은 중심 Workspace에서 조정해 주세요.',
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
            계획 진행 <strong>{shown.progress.done} / {shown.progress.planned}</strong> · 진행은 항목별 단위로 센 양이고 실력 점수가 아니에요
          </p>
        ) : (
          <p className={n.planProgress} data-testid="plan-progress">지금 계획할 수 있는 문항이 없어요 — 아래에 이유가 있어요</p>
        )}
      </div>
      {/* 저장 상태 — 서버가 확인한 저장본과 화면이 같을 때만 「저장됨」 */}
      {store && (
        <p className={n.saveState} data-testid="plan-save-state" data-state={refreshing ? 'saving' : sw && !dirty && !needsReplan ? 'saved' : dirty || needsReplan ? 'dirty' : 'none'}>
          {refreshing ? (
            <>저장 결과를 불러오는 중…</>
          ) : sw && !dirty && !needsReplan ? (
            <><Save size={13} aria-hidden="true" /> 저장됨 · 버전 {sw.latest.version} · {seoul(sw.latest.createdAt, false)} · {REASON_LABEL[sw.latest.reason]}</>
          ) : dirty || needsReplan ? (
            <>현재 계획은 아직 저장하지 않았어요{sw ? ` · 저장본은 버전 ${sw.latest.version}` : ''}</>
          ) : (
            <>아직 이 계획을 확정하지 않았어요</>
          )}
        </p>
      )}
      {goalChanged && sw && (
        <p className={n.notice} data-testid="plan-goal-changed" data-saved-goal={sw.latest.goalVersionId ?? ''} data-current-goal={goalVersion ?? ''}>
          <TriangleAlert size={13} aria-hidden="true" /> 목표가 바뀌었어요 — 저장한 계획(버전 {sw.latest.version})은 {goalLabel(sw.latest.goalVersionId ?? null, saved)} 기준이에요. 지금 목표로 다시 확정해야 이 계획대로 학습해요(이전 기록 · 근거는 그대로 남아요).
        </p>
      )}
      {store && drift && needsReplan && (
        <p className={n.notice} data-testid="plan-drift">
          <TriangleAlert size={13} aria-hidden="true" /> 저장한 뒤 {drift.definition ? '학습 기준이' : drift.stages.length ? '학습 단계가' : '쓸 수 있는 문항 수가'} 바뀌었어요
          {drift.overAvailable.length ? ` — ${drift.overAvailable.length}개 항목의 계획량이 현재 가용 자료보다 많아요` : ''}. 계획을 확인하고 다시 저장해 주세요.
        </p>
      )}
      {/* T-0077 — 다시 확정하면 무엇이 바뀌나: 최신 저장본 → 지금 화면의 제안(아직 저장 전). 저장본이 없거나 못 읽으면 비교하지 않는다 */}
      {!past && store && sw && (dirty || needsReplan) && (
        <PlanChangeSummary testId="plan-change-proposal" change={planChange(savedSides(sw.latest.plan), shown.tasks.map((p) => ({ task: p.task, stage: p.stage, planned: p.quantity.planned, available: p.quantity.available })))}
          lead={`저장본 버전 ${sw.latest.version} → 지금 제안(아직 저장하지 않았어요)`}
          goal={goalChanged ? `목표: ${goalLabel(sw.latest.goalVersionId ?? null, saved)} → ${goalLabel(goalVersion, saved)}` : null} />
      )}
      {!past && store && !sw && <p className={n.fine} data-testid="plan-change-none">아직 저장한 계획이 없어 비교할 저장본이 없어요 — 지금 보이는 계획은 제안이에요.</p>}
      {saved?.error && <p className={n.fine} data-testid="plan-change-unavailable">저장한 계획을 불러오지 못해 무엇이 바뀌는지 비교할 수 없어요.</p>}
      {reason && <p className={n.sub}>{reason}</p>}
      {legacyDraft && <p className={n.sub}>목표 버전이 없는 이전 기기 초안은 보관하고, 지금 계획에 자동 적용하지 않아요.</p>}
      <ol className={n.planList}>
        {shown.tasks.map((p, i) => {
          const isCore = view.core.includes(p.task)
          const home = p.stage === 'transfer' && !isCore ? templates().find(w => w.core.includes(p.task)) : null
          const q = p.quantity
          const extra = q.planned !== null && q.done > q.planned ? q.done - q.planned : 0
          return (
            <li key={p.task} className={n.planItem} data-task={p.task} data-core={isCore} data-planned={q.planned ?? ''} data-done={q.done} data-achievement={p.achievement} data-stage={p.stage ?? ""}>
              <div className={n.planMain}>
                <p className={n.planName}>
                  {p.name}
                  <span className={n.needType}>{isCore ? '중심' : '보조'}{p.need ? ` · ${NEED_LABEL[p.need]}` : ''}{p.stage ? ` · ${STAGE_LABEL[p.stage]}` : ''}</span>
                </p>
                <p className={n.planGoal}>{p.goal}</p>
                <p className={n.planQty} data-testid="plan-qty">
                  {q.planned !== null ? (
                    <>계획 <strong>{q.planned}{q.unit}</strong>(가능 {q.available}) · 수행 {q.done}{extra ? ` — 계획보다 ${extra}{q.unit} 더 했어요` : ` · 남음 ${q.remaining}`} — 기준: {q.rule ? RULE_LABEL[q.rule] : '—'}{p.unresolved.includes('transfer_shortage') ? ' · 기본 적용 계획보다 자료가 부족해요' : ''}</>
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
                  <div className={n.stepper} role="group" aria-label={`${p.name} 계획 ${q.unit} 수`}>
                    <button type="button" className={n.stepBtn} aria-label={`${p.name} 계획 한 ${q.unit} 줄이기`} disabled={(q.planned ?? 0) <= (p.stage === 'transfer' ? 1 : 0)} onClick={() => setPlanned(p, (q.planned ?? 0) - 1)}>
                      <Minus size={14} aria-hidden="true" />
                    </button>
                    <span className={n.stepVal} aria-live="polite">{q.planned}</span>
                    <button type="button" className={n.stepBtn} aria-label={`${p.name} 계획 한 ${q.unit} 늘리기`} disabled={(q.planned ?? 0) >= (q.available ?? 0)} onClick={() => setPlanned(p, (q.planned ?? 0) + 1)}>
                      <Plus size={14} aria-hidden="true" />
                    </button>
                  </div>
                )}
                {!past && home && <Link className={n.go} href={`/csat/diagnosis?tab=map&view=full&map_task=${p.task}&ws=${home.id}`}>중심 Workspace에서 조정</Link>}
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
                  <Link href={withMapReturn(p.next.href, outgoingCtx(saved, p.task, view.workspace))} className={n.go} data-testid="plan-go">
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
            <select value={why} onChange={(e) => { edited(); setWhy(e.target.value as PlanReason) }} data-testid="plan-reason" disabled={!sw}>
              {(sw ? (['learner_adjust', 'new_exam', 'check_result', 'goal_change', 'content_change', 'definition_change'] as PlanReason[]) : (['initial'] as PlanReason[])).map((r) => (
                <option key={r} value={r}>{REASON_LABEL[r]}</option>
              ))}
            </select>
          </label>
          <label className={n.saveField}>
            <span>메모(선택)</span>
            <input value={note} maxLength={500} onChange={(e) => { edited(); setNote(e.target.value); writeNote(key, e.target.value); if (handoff.current?.sourceKey === key) writeNote(handoff.current.key, e.target.value) }} placeholder="예: 이번 주는 5문항만" data-testid="plan-note" />
          </label>
          <button type="button" className={n.cta} onClick={() => submit(sw ? why : 'initial')} disabled={contentBlocked || save.kind === 'saving' || refreshing || (!!sw && !dirty && !needsReplan)} data-testid="plan-save">
            <Save size={15} aria-hidden="true" />
            {contentBlocked ? '자료 준비 후 확정' : save.kind === 'saving' || refreshing ? '저장하는 중…' : sw ? '변경 저장' : '이 계획으로 확정'}
          </button>
          {save.kind === 'conflict' && (
            <p className={n.saveErr} role="alert" data-testid="plan-conflict">
              {save.goalChanged ? '다른 곳에서 목표가 바뀌었어요. 이전 목표의 계획은 저장하지 않았어요.' : '다른 곳(다른 기기 · 다른 탭)에서 계획이 먼저 바뀌었어요. 내 화면은 저장하지 않았어요.'}{' '}
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
          {/* T-0077 — 최신 저장과 바로 앞 저장 버전의 변화(한 번만). 앞 버전이 이력에 없으면 비교 불가 · 사유는 저장된 사유일 뿐 원인 판정이 아니다 */}
          {(() => {
            const prev = previousOf(sw.history, sw.latest)
            if (!prev) return sw.latest.version > 1 ? <p className={n.fine} data-testid="plan-change-saved-unknown">바로 앞 버전 기록이 없어 저장된 변화를 비교할 수 없어요.</p> : null
            return (
              <PlanChangeSummary testId="plan-change-saved" change={planChange(savedSides(prev.plan), savedSides(sw.latest.plan))}
                lead={`저장된 변화 · 버전 ${prev.version} → ${sw.latest.version} · 저장 사유 「${REASON_LABEL[sw.latest.reason]}」`}
                goal={(prev.goalVersionId ?? null) !== (sw.latest.goalVersionId ?? null) ? `목표: ${goalLabel(prev.goalVersionId ?? null, saved)} → ${goalLabel(sw.latest.goalVersionId ?? null, saved)}` : null} />
            )
          })()}
          <ol>
            {sw.history.map((h) => (
              <li key={h.version} data-version={h.version}>
                <span><strong>버전 {h.version}</strong> · {seoul(h.createdAt, true)} · {REASON_LABEL[h.reason]}{h.restoredFrom ? `(버전 ${h.restoredFrom})` : ''}{h.note ? ` · 「${h.note}」` : ''}</span>
                {/* LM-G1.3a — 이 계획을 저장할 때의 목표(저장 이력 그대로 · 소급 없음). 지금 목표와 다르면 복원해도 목표는 그대로라고 알린다 */}
                <span className={n.historyPlan} data-testid="plan-goal-version" data-goal-version={h.goalVersionId ?? ''} data-current={h.goalVersionId === (saved?.goalVersionId ?? null)}>
                  {goalLabel(h.goalVersionId ?? null, saved)}
                  {h.goalVersionId !== (saved?.goalVersionId ?? null) && h.version !== sw.latest.version ? ' — 되돌려도 지금 목표는 바뀌지 않아요' : ''}
                </span>
                {/* T-0077 — 저장 당시 단계와 계획량을 함께(같은 2문항이라도 확인 · 바로잡기는 다르다). 미정은 미정 그대로 */}
                <span className={n.historyPlan} data-testid="plan-history-tasks">{h.plan.tasks.map((x) => `${taskOf(x.task).name} ${x.stage ? STAGE_LABEL[x.stage as keyof typeof STAGE_LABEL] ?? x.stage : '단계 미정'} ${x.planned === null ? '계획량 미정' : `${x.planned}${unitOf(x.stage)}`}`).join(' · ') || '계획 항목 없음'}</span>
                {!past && h.version !== sw.latest.version && (
                  <button type="button" className={n.ghost} onClick={() => submit('restore', h.version)} disabled={save.kind === 'saving' || !!transferRestoreShortage(view, h.version)} data-testid="plan-restore">
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

/** 저장 payload → 비교 쪽(저장 순서대로) */
function savedSides(plan: { order: readonly string[]; tasks: readonly PlanSide[] }): PlanSide[] {
  const rank = new Map(plan.order.map((t, i) => [t, i]))
  return [...plan.tasks].sort((a, b) => (rank.get(a.task) ?? 1e9) - (rank.get(b.task) ?? 1e9)).map((x) => ({ task: x.task, stage: x.stage, planned: x.planned, available: x.available }))
}

/** 계획이 저장될 때의 목표(LM-G1.3a) — 목표 이력 id → 「목표 80점 · 수능」. 이력 밖이거나 없으면 그대로 말한다 */
function goalLabel(id: number | null, saved: SavedPlans | null): string {
  if (id === null) return '저장 당시 목표 기록 없음'
  const g = saved?.goalHistory?.find((x) => x.id === id)
  const now = id === saved?.goalVersionId ? '지금 목표' : '그때 목표'
  if (!g) return `${now} · 목표 기록 #${id} · 과거 목표 상세 확인 불가`
  return `${now} ${g.score}점${g.exam ? ` · ${GOAL_EXAM_LABEL[g.exam]}` : ''}${g.grade ? ` · ${g.grade}등급` : ''}${g.date ? ` · ~${g.date}` : ''}`
}
