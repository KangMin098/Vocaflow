// apps/web/src/lib/csat/map/v4/workspace.ts
//
// Workspace 첫 편성(읽기 전용) — Template 9 중 실제 확인 콘텐츠가 있는 것(live)에서 대표 하나를 고르고,
// 단계별(확인 · 바로잡기 · 적용 · 다시 확인) 실행 가능 여부와 **실제로 있는** 학습량만 낸다. 저장하지 않는다.
// 계약: docs/csat-learner/LEARNING_MAP_WORKSPACE_CONTRACT.md §1–§4. 순수 함수.
//
// 증거 중복 금지: 단계 판정은 As-Is 의 TASK 확인 판정(asIs.tasks[core].check) 하나를 **참조**한다 — Workspace 마다 다시 세지 않는다.
// 학습량은 문항이 있는 만큼만 — 없으면 null(「준비 중」), 임의 숫자로 채우지 않는다.

import { passageIdentity } from '../lifecycle-evidence'
import { CHECK_ITEMS } from '../skill-diagnosis'

import type { AsIsMap } from './as-is'
import { relationOf, templates, type TaskId, type V4Template } from './definition'
import type { ConfirmLink, ToBeMap } from './to-be'
import { authoredKeysOf } from '@/lib/knowledge/authored/tasks'
import type { DirectCheck } from './types'

export type StageKey = 'check' | 'repair' | 'transfer' | 'recheck'

export interface StageReadiness {
  ready: boolean
  /** 실제 학습량(문항 수) — 계산할 수 없으면 null */
  count: number | null
  /** 준비되지 않은 이유 코드(화면 문구 키) — 준비됐으면 null */
  blocked: null | 'after_check' | 'after_repair' | 'no_unseen_items' | 'no_transfer_items' | 'not_enough_unseen' | 'resolved' | 'no_check_link' | 'content_needed' | 'canon_hold' | 'awaiting_release'
}

export interface WorkspaceView {
  id: string
  name: string
  goal: string
  core: TaskId[]
  support: TaskId[]
  readiness: DirectCheck
  stages: Record<StageKey, StageReadiness>
  /** 지금 할 수 있는 다음 행동 하나 — 확인 문항 링크. 없으면 null */
  next: ConfirmLink | null
  /** 단계별 활동 대상(5차) — 바로잡기 = 확정 · 다시 확인에서 막힌 확인 문항 · 적용 = 연습 풀의 전이 유형 문항(확인 묶음 밖). 계획이 아직 안 한 것 하나를 고른다 */
  stageItems: { repair: ConfirmLink[]; transfer: ConfirmLink[] }
  /** 승인된 구조적 연결 · 제안 연결(검증 전) — 화면은 둘을 다른 말로 */
  relations: { structural: string[]; proposed: string[] }
}

export interface WorkspacePlan {
  /** 대표 Workspace — live 이고 실행 가능한 단계가 하나라도 있을 때만 */
  primary: WorkspaceView | null
  /** 왜 이것을 골랐나 */
  reason: null | 'goal_need' | 'verified_need' | 'checking' | 'axis_check_first' | 'available'
  /** 대표 외 후보(live · ready) */
  others: WorkspaceView[]
  /** 콘텐츠 준비 중 · 보류 템플릿 — 학습자 실패가 아니다 */
  preparing: { id: string; name: string; readiness: DirectCheck }[]
}

export interface WorkspaceInput {
  asIs: AsIsMap
  toBe: ToBeMap | null
  confirmLinks: Record<string, readonly ConfirmLink[]>
  /** 확인 과제 키 → 확인 묶음 밖에서 같은 과제로 적용할 수 있는 활성 문항 수(없으면 0) */
  transferItems: Record<string, number>
  /** 확인 과제 키 → 「다른 글에 적용」 링크로 열 전이 유형 문항 id(연습 화면 ?item=) — 없으면 적용 링크 없음 */
  transferTargets?: Record<string, readonly ConfirmLink[]>
}

const LIVE_ORDER = ['ws.central-meaning', 'ws.option-match', 'ws.evidence-locate']

/** 이 묶음의 확인 · 전이 과제 키 — 정본 첫 키 + 중심 TASK 의 창작 키(FI-011). 창작 키 링크는 납품된 자료만 들어온다(load.ts) */
function keysOf(t: V4Template): string[] {
  return [...t.content_keys.slice(0, 1), ...authoredKeysOf(t.core[0] ?? '')]
}
const linksOf = (t: V4Template, confirmLinks: Record<string, readonly ConfirmLink[]>) => keysOf(t).flatMap((k) => confirmLinks[k] ?? [])
const transfersOf = (t: V4Template, targets?: Record<string, readonly ConfirmLink[]>) => keysOf(t).flatMap((k) => targets?.[k] ?? [])
/** 창작 납품(확인 · 전이)이 있는가 — 있으면 정본 준비 상태(content_needed · ready)와 무관하게 그 자료로 단계를 연다 */
const authoredLive = (t: V4Template, input: Pick<WorkspaceInput, 'confirmLinks' | 'transferTargets'>) =>
  authoredKeysOf(t.core[0] ?? '').some((k) => (input.confirmLinks[k]?.length ?? 0) + (input.transferTargets?.[k]?.length ?? 0) > 0)
/** 정본 quantity_policy 「전이 2지문」(workspaces.json) — 적용 단계 계획량의 상한 */
export const TRANSFER_PASSAGES = 2

export function stagesOf(t: V4Template, asIs: AsIsMap, input: Pick<WorkspaceInput, 'confirmLinks' | 'transferItems' | 'transferTargets'>): Record<StageKey, StageReadiness> {
  const off = (blocked: StageReadiness['blocked']): StageReadiness => ({ ready: false, count: null, blocked })
  if (t.hold) return { check: off('canon_hold'), repair: off('canon_hold'), transfer: off('canon_hold'), recheck: off('canon_hold') }
  const live = authoredLive(t, input)
  if (t.readiness === 'ready' && !live) return { check: off('awaiting_release'), repair: off('awaiting_release'), transfer: off('awaiting_release'), recheck: off('awaiting_release') }
  if ((t.readiness === 'content_needed' || t.readiness === 'blocked') && !live) return { check: off('content_needed'), repair: off('content_needed'), transfer: off('content_needed'), recheck: off('content_needed') }
  const key = t.content_keys[0]
  const links = linksOf(t, input.confirmLinks)
  const c = asIs.tasks[t.core[0]]?.check ?? null
  if (!c || links.length === 0) return { check: off('no_check_link'), repair: off('after_check'), transfer: off('after_repair'), recheck: off('after_check') }
  const unseenLinked = c.unseen.filter((i) => links.some((l) => l.target === i))
  const opened = c.status === 'verified' || c.status === 'still_needed'
  const resolved = c.status === 'resolved'
  // 적용 가능한 문항 = 링크로 열 수 있는 전이 문항이 있으면 그 수, 없으면 풀 전체 수(옛 입력) — 계획량은 정본 「전이 2지문」을 넘지 않는다
  const tt = transfersOf(t, input.transferTargets)
  const transfer = tt.length || input.transferTargets?.[key] ? new Set(tt.map(l => passageIdentity(l.target, l.passageKey)).filter(Boolean)).size : input.transferItems[key] ?? 0
  return {
    check: opened || resolved
      ? { ready: false, count: null, blocked: resolved ? 'resolved' : null }
      : unseenLinked.length > 0 ? { ready: true, count: unseenLinked.length, blocked: null } : off('no_unseen_items'),
    // 바로잡기 대상 = 확정에 쓴 문항 + 다시 확인에서 막힌 문항(실제 막힌 곳만)
    repair: opened ? { ready: true, count: new Set([...c.verifiedItems, ...c.wrongItems]).size, blocked: null } : off('after_check'),
    transfer: !(opened || resolved) ? off('after_repair') : transfer > 0 ? { ready: true, count: Math.min(transfer, TRANSFER_PASSAGES), blocked: null } : off('no_transfer_items'),
    recheck: !opened ? off(resolved ? 'resolved' : 'after_check') : unseenLinked.length >= CHECK_ITEMS ? { ready: true, count: CHECK_ITEMS, blocked: null } : off('not_enough_unseen'),
  }
}

function viewOf(t: V4Template, input: WorkspaceInput): WorkspaceView {
  const stages = stagesOf(t, input.asIs, input)
  const c = input.asIs.tasks[t.core[0]]?.check ?? null
  const links = linksOf(t, input.confirmLinks)
  // 다음 행동 — 확인 · 다시 확인이 열려 있으면 아직 안 본 확인 문항 하나
  const next = (stages.check.ready || stages.recheck.ready) && c ? links.find((l) => c.unseen.includes(l.target)) ?? null : null
  const blocked = new Set([...(c?.verifiedItems ?? []), ...(c?.wrongItems ?? [])])
  const stageItems = {
    repair: links.filter((l) => blocked.has(l.target)),
    transfer: transfersOf(t, input.transferTargets),
  }
  const rels = t.relations.map((id) => relationOf(id)).filter((r): r is NonNullable<typeof r> => !!r)
  return {
    id: t.id, name: t.name, goal: t.goal, core: t.core, support: t.support, readiness: t.readiness, stages, next, stageItems,
    relations: { structural: rels.filter((r) => r.status === 'approved').map((r) => r.id), proposed: rels.filter((r) => r.status !== 'approved').map((r) => r.id) },
  }
}

const anyReady = (v: WorkspaceView) => Object.values(v.stages).some((s) => s.ready)

export function planWorkspaces(input: WorkspaceInput): WorkspacePlan {
  const all = templates()
  const templateById = (id: string) => all.find((t) => t.id === id)!
  // 창작 납품이 있는 content_needed · blocked 템플릿은 「자료 준비 중」이 아니라 실행 가능한 Workspace 다(FI-011 — 단계만 열고 목록은 막던 어긋남)
  const delivered = (t: V4Template) => !t.hold && (t.readiness === 'content_needed' || t.readiness === 'blocked') && authoredLive(t, input)
  const views = all.filter((t) => !t.hold && (t.readiness === 'live' || t.readiness === 'ready' || delivered(t))).map((t) => viewOf(t, input))
  const live = views.filter((v) => (v.readiness === 'live' || delivered(templateById(v.id))) && anyReady(v))
  const coreStatus = (v: WorkspaceView) => input.asIs.tasks[v.core[0]]?.status
  let primary: WorkspaceView | null = null
  let reason: WorkspacePlan['reason'] = null
  // 1) 목표가 있으면 — 우선순위가 가장 높은 요구의 TASK 를 중심으로 하는 live Workspace
  if (input.toBe) {
    for (const n of input.toBe.needs) {
      const hit = live.find((v) => v.core.includes(n.task))
      if (hit) { primary = hit; reason = 'goal_need'; break }
    }
  }
  // 2) 목표가 없거나 맞는 요구가 없으면 — As-Is 근거로(확인된 요구 > 진행 중 > 축 기록상 먼저 확인 > 지금 할 수 있는 것)
  if (!primary) {
    const pick = (pred: (v: WorkspaceView) => boolean, why: NonNullable<WorkspacePlan['reason']>) => {
      if (primary) return
      const hit = [...live].sort((a, b) => LIVE_ORDER.indexOf(a.id) - LIVE_ORDER.indexOf(b.id)).find(pred)
      if (hit) { primary = hit; reason = why }
    }
    pick((v) => coreStatus(v) === 'verified_need', 'verified_need')
    pick((v) => coreStatus(v) === 'checking', 'checking')
    pick((v) => coreStatus(v) === 'check_first', 'axis_check_first')
    pick(() => true, 'available')
  }
  const chosen = primary as WorkspaceView | null
  return {
    primary: chosen,
    reason,
    others: views.filter((v) => v.id !== chosen?.id),
    preparing: all.filter((t) => t.hold || ((t.readiness === 'content_needed' || t.readiness === 'blocked') && !delivered(t))).map((t) => ({ id: t.id, name: t.name, readiness: t.readiness })),
  }
}

export const STAGE_LABEL: Record<StageKey, string> = { check: '확인하기', repair: '바로잡기', transfer: '다른 글에 적용', recheck: '다시 확인하기' }
export const STAGE_BLOCKED_LABEL: Record<NonNullable<StageReadiness['blocked']>, string> = {
  after_check: '확인 결과가 나온 뒤 열려요',
  after_repair: '바로잡기 뒤에 열려요',
  no_unseen_items: '아직 풀지 않은 확인 문항이 남아 있지 않아요',
  no_transfer_items: '적용할 다른 문항을 준비하고 있어요',
  not_enough_unseen: `다시 확인할 새 문항이 ${CHECK_ITEMS}개보다 적어요`,
  resolved: '이미 다시 확인을 통과했어요',
  no_check_link: '확인 문항 연결을 준비하고 있어요',
  content_needed: '확인 콘텐츠를 준비하고 있어요',
  canon_hold: '아직 측정 방법을 정하지 않은 영역이에요',
  awaiting_release: '확인 문항을 더 갖추고 공개 승인을 기다리고 있어요',
}
