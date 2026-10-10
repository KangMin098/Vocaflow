// apps/web/src/lib/knowledge/product-server.ts
// Phase 3 제품 게이트(2026-10-08) — 학습자 화면이 「채택된 원리에서 나온 과제」를 보여도 되는지 서버에서만 판단한다.
//
// 노출 조건(하나라도 빠지면 학습자에게 없다):
//   ① 그 표면 · 과제 키의 적용이 active(켜기는 DB 가 「채택 항목 + 검증 계획」일 때만 받는다 — 20261008120000)
//   ② 적용 항목(실행 과제)부터 방법 · 처리 기제까지 사슬 전체가 adopted/applied(live-chain.resolveChain)
//   ③ 문항 주석이 있고 지금 골격과 서명이 같다(문장 경계가 바뀌었으면 채점하지 않는다)
// 학습자에게는 적용 id · 항목 slug · 상태 같은 내부 값을 넘기지 않는다 — 화면용 문구만.
import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'

import { fromItemSlug, toItemSlug } from '@/lib/csat/item-slug'
import { createAdminClient } from '@/lib/supabase/admin'

import { checkBinding } from './anchor-source'
import { CURATED } from './evidence-locate'
import { currentItemTask, ITEM_TASKS } from './item-tasks'
import { isSyntheticEmail, parseClientMeta } from './practice'
import { selectWriter, type AttemptWrite, type AttemptWriter, type WriteOutcome } from './practice-writer'
import type { StepChain } from './learning-decision'
import { resolveChain, type ChainItem, type ChainLink, type ChainVerdict } from './live-chain'

/** 첫 수직 경로의 과제 키(호환) — 과제 키 목록은 item-tasks 레지스트리가 정본 */
export const CLAIM_SUPPORT_TASK = 'claim-support'
/** 적용 surface_ref = 「과제 키:문항 슬러그」 — learning_task_attempts.task_key 와 같은 과제 키 */
export const itemTaskRef = (taskKey: string, itemId: string) => `${taskKey}:${toItemSlug(itemId)}`
/** surface_ref → 과제 키 · 문항 id(레지스트리에 있는 과제만) */
export function parseItemTaskRef(ref: string): { taskKey: string; itemId: string } | null {
  for (const t of ITEM_TASKS) if (ref.startsWith(`${t.key}:`)) return { taskKey: t.key, itemId: fromItemSlug(ref.slice(t.key.length + 1)) }
  return null
}

function db(): SupabaseClient {
  return createAdminClient() as unknown as SupabaseClient
}

async function must<T>(what: string, q: PromiseLike<{ data: unknown; error: { message?: string } | null }>): Promise<T[]> {
  const { data, error } = await q
  if (error) throw new Error(`${what} 읽기 실패: ${error.message ?? ''}`)
  return (data ?? []) as T[]
}

export interface ApplicationRow {
  id: string
  item_id: string
  surface: string
  surface_ref: string
  version: number
  status: string
  audience: Record<string, unknown>
  released_at: string | null
}

const CAP = 1000

export async function loadChainGraph(client: SupabaseClient = db()): Promise<{ items: ChainItem[]; links: ChainLink[] }> {
  const [items, links] = await Promise.all([
    must<ChainItem>('항목', client.from('knowledge_items').select('id, slug, title, layer, kind, status, version, efficacy').limit(CAP)),
    must<ChainLink>('연결', client.from('knowledge_links').select('from_id, to_id, kind').eq('kind', 'implements').limit(CAP)),
  ])
  // 상한에 닿으면 잘린 것이다 — 사슬을 끝까지 못 따라가 게이트가 잘못 판정하지 않게 실패로 알린다(2026-10-08 항목 156 · 연결 수십)
  if (items.length >= CAP || links.length >= CAP) throw new Error(`학습 원리 등록부가 ${CAP} 행을 넘었다 — 페이징이 필요하다`)
  return { items, links }
}

export interface LiveApplication {
  app: ApplicationRow
  chain: ChainVerdict
}

/** 표면 · 과제 키의 active 적용 중 사슬이 살아 있는 것(최신 버전 우선). 없으면 null — 학습자 화면은 아무것도 그리지 않는다 */
export async function loadLiveApplication(surface: string, ref: string, client: SupabaseClient = db()): Promise<LiveApplication | null> {
  const apps = await must<ApplicationRow>('적용', client.from('knowledge_applications')
    .select('id, item_id, surface, surface_ref, version, status, audience, released_at')
    .eq('surface', surface).eq('surface_ref', ref).eq('status', 'active').order('version', { ascending: false }))
  if (apps.length === 0) return null
  const graph = await loadChainGraph(client)
  for (const app of apps) {
    const chain = resolveChain(app.item_id, graph.items, graph.links)
    if (chain.live) return { app, chain }
  }
  return null
}

/** 학습자 문항 화면이 받는 것 — 내부 id · 상태 없음. 과제 모양(panel)은 과제마다 다르다(정답 없음) */
export interface ItemPrinciplePanel {
  taskKey: string
  /** 학습자에게 보이는 원리 이름 */
  principle: string
  /** 왜 필요한지(과제 쪽 고정 문구) */
  why: string
  panel: Record<string, unknown>
}

/**
 * 원문 결속 관문(계약 B · MC-06) — 원문에 결속된 주석(합의 주석 evidence-tasks)은 지금 원문과 대조해 valid 일 때만 과제를 연다.
 * 결속이 없는 과제(주장과 근거 · 이어 주는 단서 — 경계 서명만 있는 기존 주석)는 이 관문을 지나지 않는다(완료 계약에 boundary_only 로 남는다).
 * 원문 조회 실패 · 결속 불일치는 닫는다(fail-closed). 원문이 같다는 것은 근거 위치가 맞다는 뜻일 뿐 원인 판정 근거가 아니다.
 */
export async function anchorGate(itemId: string, client: SupabaseClient = db()): Promise<boolean> {
  const bound = CURATED[itemId] as (typeof CURATED)[string] & { source?: { revision: string } }
  if (!bound) return true
  const { data, error } = await client.from('csat_items').select('passage').eq('id', itemId).maybeSingle()
  const passage = (data as { passage?: string } | null)?.passage
  if (error || !passage) { console.error('[anchor-gate] 원문 조회 실패', itemId, error?.message); return false }
  const c = checkBinding(bound as Parameters<typeof checkBinding>[0], itemId, passage, bound.source?.revision ?? '')
  if (!c.ok) console.error('[anchor-gate] 결속 불일치 — 과제 닫음', itemId, JSON.stringify(c))
  return c.ok
}

/** 주석 · 골격 서명 + 원문 결속까지 맞는 문항 과제 */
async function liveItemTask(itemId: string, client?: SupabaseClient) {
  const task = currentItemTask(itemId)
  if (!task) return null
  return (await anchorGate(itemId, client)) ? task : null
}

export async function loadItemPrinciple(itemId: string): Promise<ItemPrinciplePanel | null> {
  const task = await liveItemTask(itemId)
  if (!task) return null
  const live = await loadLiveApplication('csat_item_task', itemTaskRef(task.def.key, itemId))
  if (!live) return null
  if (!live.chain.path.some((p) => p.layer === 'principle')) return null
  // 학습자 문구는 과제 쪽 고정 문구 — 관리자 항목 문장(효과 미확인 · 처리 후보 같은 연구 단서)을 학습자에게 넘기지 않는다
  return { taskKey: task.def.key, principle: task.def.learner.title, why: task.def.learner.why, panel: task.def.panel(task.ann) }
}

/** 주석이 있고 지금 골격과 같은 문장 경계일 때만(과제 종류 무관) */
export function currentAnnotation(itemId: string) {
  return currentItemTask(itemId)?.ann ?? null
}

/** 과제 기록 거부 사유(닫힌 열거) — 화면 문구와 별개로 호출자 · 테스트가 이유를 구분한다 */
export type TaskRejectCode = 'no_task' | 'not_live' | 'invalid_input'

export class TaskInputError extends Error {
  constructor(message: string, readonly code: TaskRejectCode) {
    super(message)
  }
}

export interface AttemptResult {
  grade: Record<string, unknown> & { isCorrect: boolean }
  attempts: number
}

/**
 * 수행 기록 한 건 — userId · 이메일은 세션에서만(라우트가 넘긴다). 채점은 서버에서 주석으로 한다(클라이언트 판정을 믿지 않는다).
 * 이 기록은 **과제 수행**이지 효과 판정이 아니다 — 항목 efficacy 는 건드리지 않는다(DB 가드도 막는다).
 * 기록은 G2 계약(공유 쓰기 어댑터 · practice 와 같다): 세션 공개 → learning_attempt_record(요청 멱등 · 판단 시각 · 세션 상속).
 * 본문: { response, sec, clientSessionId, clientMutationId, answeredAt, helpLevel }. `now` 는 라우트가 넘긴다(시계를 직접 읽지 않는다).
 */
export async function recordItemTaskAttempt(
  client: SupabaseClient,
  user: { id: string; email: string | null },
  itemId: string,
  body: unknown,
  now: number,
  writer: AttemptWriter = selectWriter(client),
): Promise<AttemptResult & { outcome: WriteOutcome }> {
  const o = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const meta = parseClientMeta(o, now)
  if (!meta.ok) throw new TaskInputError(meta.error, 'invalid_input')
  const task = await liveItemTask(itemId)
  if (!task) throw new TaskInputError('이 문항에는 지금 확인 과제가 없어요', 'no_task')
  const live = await loadLiveApplication('csat_item_task', itemTaskRef(task.def.key, itemId), client)
  // 주석은 있지만 제품 적용이 켜져 있지 않다(초안 · 중단 · 사슬 미채택) — 노출 게이트가 막은 것
  if (!live) throw new TaskInputError('이 문항에는 지금 확인 과제가 없어요', 'not_live')
  const graded = task.def.grade(task.ann, o.response)
  if (!graded) throw new TaskInputError('고른 답을 다시 확인해 주세요', 'invalid_input')
  const sec = Number.isInteger(o.sec) && (o.sec as number) >= 0 && (o.sec as number) <= 7200 ? (o.sec as number) : null
  const w: AttemptWrite = {
    userId: user.id,
    taskKey: task.def.key,
    applicationId: live.app.id,
    itemRef: itemId,
    contentHash: task.def.hash(task.ann),
    activity: 'theater',
    phase: 'practice',
    // 기기가 보낸 사실 그대로 — 다른 세션의 앞선 도움은 읽을 때 가른다(prior-help)
    helpLevel: meta.value.helpLevel,
    synthetic: isSyntheticEmail(user.email),
    clientMutationId: meta.value.clientMutationId,
    clientSessionId: meta.value.clientSessionId,
    answeredAt: meta.value.answeredAt,
    sec,
    isCorrect: graded.grade.isCorrect,
    answer: graded.response as Record<string, unknown>,
    extra: { annotation: task.ann.version, appVersion: live.app.version, grade: graded.summary },
  }
  const sessionId = await writer.reveal(w)
  const outcome = await writer.record(w, sessionId)
  if (outcome === 'conflict') throw new TaskInputError('같은 제출 id 로 다른 답이 왔어요 — 화면을 새로 고쳐 주세요', 'invalid_input')
  const { count, error } = await client.from('learning_task_attempts').select('id', { count: 'exact', head: true })
    .eq('user_id', user.id).eq('task_key', task.def.key).eq('item_ref', itemId)
  // count 는 오류를 0 으로 삼키지 않는다(AGENTS 「두 번 이상 고친 실수」) — 화면용 보조 수치라 실패해도 기록 결과는 그대로
  return { grade: graded.grade, attempts: error || count == null ? 1 : count, outcome }
}

/** @deprecated 첫 수직 경로 이름(호환) — recordItemTaskAttempt 를 쓴다 */
export const recordClaimSupportAttempt = recordItemTaskAttempt

/** 학습 지도 FIND 과제 → 같은 실행 과제로 가는 명시적 연결(learning_map_find 적용 행). 사슬이 죽었으면 빠진다 */
export interface MapPracticeLink {
  href: string
  label: string
  /** 같은 실행 과제의 문항(첫 확인 문항)과 과제 키 — 학습 지도가 그 과제의 본인 수행 결과를 붙일 때 쓴다(화면에 보이지 않는다) */
  itemId: string
  target: string
  taskKey: string
  /** 같은 단계의 확인 문항 전부(첫 항목 = 위 target). 「서로 다른 확인 문항 2개」 기준을 채우려면 audience.items 로 여러 문항을 단다 */
  confirm: { href: string; label: string; target: string; taskKey: string }[]
  /** 이 단계에 연결된 원리 사슬(과제 · 방법 · 원리 id · 버전) — 학습 결정의 추적 정보(learning-decision) */
  chain?: StepChain
}

/** 사슬 경로(과제 → 방법 → 기제 → 본질)에서 층마다 하나 */
export function stepChainOf(path: readonly ChainItem[]): StepChain {
  const pick = (layer: string) => {
    const i = path.find((p) => p.layer === layer)
    return i ? { id: i.id, slug: i.slug, version: i.version } : null
  }
  return { task: pick('practice'), method: pick('method'), principle: pick('principle') }
}

/** 적용 audience → 확인 문항 목록. item(단수 · 기존 행) 다음에 items(복수) — 중복 제거, 순서 유지 */
export function findTargetsOf(audience: Record<string, unknown> | null | undefined): string[] {
  const out: string[] = []
  const push = (v: unknown) => { if (typeof v === 'string' && v && !out.includes(v)) out.push(v) }
  push(audience?.item)
  if (Array.isArray(audience?.items)) for (const v of audience.items) push(v)
  return out
}

const itemLabel = (target: string) => {
  const [exam, no] = target.split('#')
  return `${/^\d{4}$/.test(exam) ? `${exam}학년도 수능` : exam} ${no}번으로 직접 확인`
}

export async function loadMapPracticeLinks(client: SupabaseClient = db()): Promise<Record<string, MapPracticeLink>> {
  const apps = await must<ApplicationRow>('적용', client.from('knowledge_applications')
    .select('id, item_id, surface, surface_ref, version, status, audience, released_at')
    .eq('surface', 'learning_map_find').eq('status', 'active'))
  if (apps.length === 0) return {}
  const graph = await loadChainGraph(client)
  const out: Record<string, MapPracticeLink> = {}
  for (const app of apps.sort((a, b) => b.version - a.version)) {
    // 적용 키는 소문자만 받는다(b6-3) — 지도 과제 id(B6-3)로 되돌린다
    const taskId = app.surface_ref.toUpperCase()
    if (out[taskId]) continue
    const verdict = resolveChain(app.item_id, graph.items, graph.links)
    if (!verdict.live) continue
    // 지도 쪽 연결도 그 문항 쪽 적용이 살아 있어야 한다 — 문항에서 과제가 내려갔는데 지도 링크만 남으면 빈 화면으로 보낸다
    const confirm: MapPracticeLink['confirm'] = []
    for (const target of findTargetsOf(app.audience)) {
      const task = await liveItemTask(target, client)
      if (!task || !(await loadLiveApplication('csat_item_task', itemTaskRef(task.def.key, target), client))) continue
      confirm.push({ href: `/csat/item/${toItemSlug(target)}#principle`, label: itemLabel(target), target, taskKey: task.def.key })
    }
    if (confirm.length === 0) continue
    out[taskId] = { ...confirm[0], itemId: confirm[0].target, confirm, chain: stepChainOf(verdict.path) }
  }
  return out
}
