// apps/web/src/lib/csat/authored/server.ts
//
// FINAL §4.4 · §8 — 자체 창작 산출물(authored_item)의 공급 요청 · 납품 자료 열기 · 수행 기록(서버 전용).
//
// 신뢰 경계:
//   · 사용자 id 는 로그인 세션에서만(라우트의 learnerContext). 수요는 **서버가 지금 계획 보기로 다시 만든다**(클라이언트 수요 불신).
//   · 수요 · 공급 · 결속 쓰기는 **학습자 세션 클라이언트**로 부른다 — DB 정의자 함수가 auth.uid() 로 소유 · 자격 · 승인 · 사람 결정 ·
//     노출(G)을 모두 다시 판정한다. 여기서 고른 재고 후보는 「제안」일 뿐이고 DB 가 거절하면 그대로 거절이다.
//   · 재고 조회(자격 · 승인 행)와 본문 · Gold 읽기는 service_role(관리자 전용 표) — 학습자에게 Gold 는 응답 뒤 해설로만 나간다.
//   · 본문 · 채점은 DB 행(authored_item)이 정본이다. 저장소 JSON 은 등록 원본일 뿐 — 학습자 화면은 DB 행에서 만든다.
// 표가 없으면(창작 공급 SQL 미적용) 'not_installed' — 화면은 「준비 중」 으로 보이고 아무것도 만들지 않는다.
import 'server-only'
import { createHash } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

import { buildDemand, type MaterialRole } from '@/lib/csat/map/v62/demand'
import { canonicalDemand } from '@/lib/csat/map/v62/persist-contract'
import type { V4View } from '@/lib/csat/map/v4/compose'
import type { TaskId } from '@/lib/csat/map/v4/definition'
import { bindDeliveryAttempt, type BindingStatus } from '@/lib/csat/map/v62/delivery-binding'
import { selectWriter, type AttemptWrite, type AttemptWriter } from '@/lib/knowledge/practice-writer'
import { isSyntheticEmail, parseClientMeta } from '@/lib/knowledge/practice'
import {
  gradeAuthored, isAssessmentRole, revealAfterAnswer,
  type AuthoredBody, type AuthoredGold, type AuthoredItem, type AuthoredRole, type AuthoredSet,
} from '@/lib/knowledge/authored/authored-items'

const MISSING = new Set(['42P01', 'PGRST205', '42883', 'PGRST202'])
const codeOf = (e: unknown) => (e as { code?: string } | null)?.code ?? ''
const isMissing = (e: unknown) => MISSING.has(codeOf(e))

/** 결정적 UUID(v4 모양) — 같은 입력 = 같은 요청 키(재시도 멱등) */
export function stableKey(...parts: string[]): string {
  const h = createHash('sha256').update(parts.join('|')).digest('hex')
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-${((parseInt(h[16], 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`
}

export interface AuthoredRow {
  ref: string
  task_id: string
  task_key: string
  role_class: 'instruction' | 'assessment'
  intended_role: AuthoredRole
  passage_group: string
  body: AuthoredBody
  gold: AuthoredGold
  annotation_ref: string
}

/** DB 행 → 채점 · 보기 함수가 쓰는 세트 · 문항 모양 */
export function itemOfRow(row: AuthoredRow): { set: AuthoredSet; item: AuthoredItem } {
  const id = row.ref.slice('authored:'.length)
  const version = row.annotation_ref.slice(row.annotation_ref.lastIndexOf('.') + 1)
  const set: AuthoredSet = {
    set: `db.${version}`, taskId: row.task_id, taskKey: row.task_key,
    provenance: { author: '', method: '', derivedFrom: [], createdAt: '', humanGold: '', rights: '' }, items: [],
  }
  const item: AuthoredItem = { id, role: row.intended_role, passageGroup: row.passage_group, body: row.body, gold: row.gold }
  set.items.push(item)
  return { set, item }
}

// ── 공급 요청 ─────────────────────────────────────────────────────────

export interface SupplyInput {
  view: V4View
  task: TaskId
  template: string
  workspaceId: string
  planVersion: number
  goalVersion: number | null
}

export type LineOutcome = {
  role: MaterialRole
  requested: number
  delivered: string[]
  /** 재고 후보를 DB 가 거절한 이유(노출 · 사람 결정 · 승인 등) — 닫힌 코드 */
  rejected: { ref: string; reason: RejectReason }[]
  /** 재고가 모자라 생산 주문을 열었나(수요는 재고와 따로 남는다) */
  orderOpened: boolean
}
export type RejectReason = 'exposure' | 'human_decision' | 'approval' | 'quantity' | 'other'
export type SupplyResult =
  | { status: 'not_installed' }
  | { status: 'no_lines' }
  | { status: 'ok'; demandId: string; lines: LineOutcome[] }

const reasonOf = (msg: string): RejectReason =>
  /exposure/.test(msg) ? 'exposure'
    : /human rights\/gold decision|authored gold differs/.test(msg) ? 'human_decision'
      : /approval/.test(msg) ? 'approval'
        : /quantity reached/.test(msg) ? 'quantity' : 'other'

interface Stock { qualificationId: string; ref: string; approvalId: string }

/** 재고 — 이 TASK · 역할의 창작 자격 중 대체되지 않았고 철회되지 않은 승인이 있는 것(최종 판정은 DB 공급 함수) */
async function authoredStock(admin: SupabaseClient, task: string, role: MaterialRole): Promise<Stock[] | 'not_installed'> {
  const q = await admin.from('content_qualification').select('id, artifact_ref, supersedes')
    .eq('artifact_kind', 'authored_item').eq('task_id', task).eq('role', role).order('created_at', { ascending: true })
  if (q.error) { if (isMissing(q.error)) return 'not_installed'; throw new Error(`재고 조회 실패: ${q.error.message}`) }
  const rows = (q.data ?? []) as { id: string; artifact_ref: string; supersedes: string | null }[]
  const superseded = new Set(rows.map((r) => r.supersedes).filter((x): x is string => !!x))
  const live = rows.filter((r) => !superseded.has(r.id))
  if (live.length === 0) return []
  const a = await admin.from('content_release_approval').select('id, qualification_id, scope').in('qualification_id', live.map((r) => r.id))
  if (a.error) throw new Error(`승인 조회 실패: ${a.error.message}`)
  const approvals = (a.data ?? []) as { id: string; qualification_id: string; scope: 'public' | 'assessment' }[]
  const rv = approvals.length ? await admin.from('content_release_revocation').select('approval_id').in('approval_id', approvals.map((x) => x.id)) : { data: [], error: null }
  if (rv.error) throw new Error(`철회 조회 실패: ${rv.error.message}`)
  const revoked = new Set(((rv.data ?? []) as { approval_id: string }[]).map((x) => x.approval_id))
  const want: 'public' | 'assessment' = isAssessmentRole(role) ? 'assessment' : 'public'
  const out: Stock[] = []
  for (const r of live) {
    const ok = approvals.filter((x) => x.qualification_id === r.id && !revoked.has(x.id))
    const pick = ok.find((x) => x.scope === want)
    if (pick && ok.some((x) => x.scope === 'public')) out.push({ qualificationId: r.id, ref: r.artifact_ref, approvalId: pick.id })
  }
  return out
}

/**
 * 공급 요청 — 수요 기록(학습자) → 줄마다 재고 공급 시도(학습자 · DB 재판정) → 모자라면 생산 주문(학습자).
 * 재시도 안전: 수요 서명 · 공급 요청 키 · 주문 요청 키가 모두 결정적이라 같은 요청은 같은 행을 돌려준다.
 */
export async function requestAuthoredSupply(admin: SupabaseClient, learner: SupabaseClient, userId: string, input: SupplyInput): Promise<SupplyResult> {
  const probe = await admin.from('authored_item').select('ref', { head: true, count: 'exact' }).limit(1)
  if (probe.error) { if (isMissing(probe.error)) return { status: 'not_installed' }; throw new Error(`창작 원장 조회 실패: ${probe.error.message}`) }
  const demand = buildDemand(input.view, input.task, input.template, {
    workspaceId: input.workspaceId, planVersion: input.planVersion, goalVersion: input.goalVersion,
  })
  if (demand.lines.length === 0) return { status: 'no_lines' }
  const rec = await learner.rpc('workspace_demand_record', { p_canonical: canonicalDemand(userId, demand) })
  if (rec.error) { if (isMissing(rec.error)) return { status: 'not_installed' }; throw new Error(`수요 기록 실패: ${rec.error.message}`) }
  const demandId = rec.data as string
  const ln = await learner.from('workspace_content_demand_line').select('id, role, task_id, quantity').eq('demand_id', demandId).eq('user_id', userId)
  if (ln.error) throw new Error(`수요 줄 조회 실패: ${ln.error.message}`)
  const lines: LineOutcome[] = []
  for (const l of (ln.data ?? []) as { id: string; role: MaterialRole; task_id: string; quantity: number }[]) {
    const out: LineOutcome = { role: l.role, requested: l.quantity, delivered: [], rejected: [], orderOpened: false }
    const have = await learner.from('workspace_content_delivery').select('artifact_ref').eq('line_id', l.id).eq('user_id', userId)
    if (have.error) throw new Error(`공급 조회 실패: ${have.error.message}`)
    const already = new Set(((have.data ?? []) as { artifact_ref: string }[]).map((x) => x.artifact_ref))
    out.delivered.push(...already)
    const stock = await authoredStock(admin, l.task_id, l.role)
    if (stock === 'not_installed') return { status: 'not_installed' }
    for (const s of stock) {
      if (out.delivered.length >= l.quantity) break
      if (already.has(s.ref)) continue
      const r = await learner.rpc('workspace_delivery_record', {
        p_line: l.id, p_order: null, p_qualification: s.qualificationId, p_approval: s.approvalId,
        p_request_key: stableKey('authored-delivery', userId, l.id, s.qualificationId),
      })
      if (r.error) out.rejected.push({ ref: s.ref, reason: reasonOf(r.error.message ?? '') })
      else out.delivered.push(s.ref)
    }
    if (out.delivered.length < l.quantity) {
      // 모자람 = 생산 수요. 주문은 학습자 소유 기록이고 같은 키 재전송은 같은 주문이다(열린 주문이 있으면 DB 가 거절 — 그대로 둔다)
      const o = await learner.rpc('factory_order_open', {
        p_line: l.id, p_reason: 'initial', p_quantity: l.quantity - out.delivered.length,
        p_request_key: stableKey('authored-order', userId, l.id, String(l.quantity - out.delivered.length)),
      })
      out.orderOpened = !o.error
    }
    lines.push(out)
  }
  return { status: 'ok', demandId, lines }
}

// ── 납품 자료 열기 ────────────────────────────────────────────────────

export interface DeliveredView {
  ref: string
  role: AuthoredRole
  deliveryId: string
  sentences: string[]
  stem: string
  choices: string[]
  teach: AuthoredBody['teach'] | null
  hints: string[] | null
  /** 관계 질문 문장 번호(어느 문장을 묻는지만 — 답은 아니다) */
  probe: number
  /** 이미 푼 기록이 있으면 결과 · 해설(응답 뒤에만) */
  done: null | { isCorrect: boolean; reveal: ReturnType<typeof revealAfterAnswer> }
}

export type OpenResult = { status: 'not_installed' } | { status: 'not_delivered' } | { status: 'ok'; view: DeliveredView }

/** 이 학습자에게 납품된 자료만 연다(미리보기 없음 — 평가 지문이 납품 전에 새지 않는다) */
export async function openDelivered(admin: SupabaseClient, learner: SupabaseClient, userId: string, ref: string): Promise<OpenResult> {
  const d = await learner.from('workspace_content_delivery').select('id, role, delivered_at')
    .eq('user_id', userId).eq('artifact_kind', 'authored_item').eq('artifact_ref', ref).order('delivered_at', { ascending: false }).limit(1)
  if (d.error) { if (isMissing(d.error)) return { status: 'not_installed' }; throw new Error(`납품 조회 실패: ${d.error.message}`) }
  const delivery = (d.data as { id: string; role: AuthoredRole }[] | null)?.[0]
  if (!delivery) return { status: 'not_delivered' }
  const row = await loadRow(admin, ref)
  if (!row) return { status: 'not_delivered' }
  const { item } = itemOfRow(row)
  const prior = await admin.from('learning_task_attempts').select('is_correct').eq('user_id', userId).eq('item_ref', ref)
    .order('answered_at', { ascending: true }).limit(1)
  if (prior.error) throw new Error(`기록 조회 실패: ${prior.error.message}`)
  const first = (prior.data as { is_correct: boolean | null }[] | null)?.[0]
  return {
    status: 'ok',
    view: {
      ref, role: delivery.role, deliveryId: delivery.id,
      sentences: item.body.sentences, stem: item.body.stem, choices: item.body.choices,
      teach: delivery.role === 'model_explanation' ? item.body.teach ?? null : null,
      hints: delivery.role === 'guided_practice' ? item.body.hints ?? null : null,
      probe: item.gold.relationProbe.sentence,
      done: first ? { isCorrect: first.is_correct === true, reveal: revealAfterAnswer(item) } : null,
    },
  }
}

async function loadRow(admin: SupabaseClient, ref: string): Promise<AuthoredRow | null> {
  const r = await admin.from('authored_item').select('ref, task_id, task_key, role_class, intended_role, passage_group, body, gold, annotation_ref').eq('ref', ref).maybeSingle()
  if (r.error) { if (isMissing(r.error)) return null; throw new Error(`창작 원장 조회 실패: ${r.error.message}`) }
  return (r.data as AuthoredRow | null) ?? null
}

// ── 수행 기록 ─────────────────────────────────────────────────────────

export class AuthoredInputError extends Error {
  constructor(message: string, readonly code: 'not_delivered' | 'invalid_input' | 'not_installed') { super(message) }
}

/** 납품 역할 → G2 시도 모양. 결속 RPC 의 도움 상태 규칙(activity · phase · help)과 맞춘다 */
//   교수 · 안내 연습 = practice(근거 아님) · 전이 = theater/transfer · 독립 · 지연 확인 = theater/practice.
//   도움(hint · viewed_first)은 helpLevel 로 따로 남고, DB 가 「helped」로 판정해 근거에서 뺀다.
export function attemptShape(role: AuthoredRole): Pick<AttemptWrite, 'activity' | 'phase'> {
  if (!isAssessmentRole(role)) return { activity: 'practice', phase: 'practice' }
  if (role === 'transfer') return { activity: 'theater', phase: 'transfer' }
  return { activity: 'theater', phase: 'practice' }
}

export interface AuthoredAttemptResult {
  grade: Record<string, unknown> & { isCorrect: boolean }
  reveal: ReturnType<typeof revealAfterAnswer>
  binding: BindingStatus
}

/**
 * 한 번의 풀이 — 납품 확인 → DB Gold 로 채점 → G2 쓰기(service_role 어댑터) → 학습자 세션으로 납품 결속.
 * 결속 판정(첫 노출 · 도움 상태 · 근거 여부)은 DB 가 한다. 결속 실패는 기록을 되돌리지 않는다.
 */
export async function recordAuthoredAttempt(
  admin: SupabaseClient, learner: SupabaseClient, user: { id: string; email: string | null }, ref: string, body: unknown, now: number,
  writer: AttemptWriter = selectWriter(admin),
): Promise<AuthoredAttemptResult> {
  const o = (body && typeof body === 'object' ? body : {}) as Record<string, unknown>
  const meta = parseClientMeta(o, now)
  if (!meta.ok) throw new AuthoredInputError(meta.error, 'invalid_input')
  const opened = await openDelivered(admin, learner, user.id, ref)
  if (opened.status === 'not_installed') throw new AuthoredInputError('창작 자료 공급이 아직 준비되지 않았어요', 'not_installed')
  if (opened.status === 'not_delivered') throw new AuthoredInputError('이 자료는 아직 받지 않았어요', 'not_delivered')
  const row = await loadRow(admin, ref)
  if (!row) throw new AuthoredInputError('이 자료는 아직 받지 않았어요', 'not_delivered')
  const { set, item } = itemOfRow(row)
  const graded = gradeAuthored(set, item, o.response)
  if (!graded) throw new AuthoredInputError('고른 답을 다시 확인해 주세요', 'invalid_input')
  const hash = await admin.rpc('authored_item_gold_hash', { p_ref: ref })
  if (hash.error || typeof hash.data !== 'string') throw new Error(`채점 주석 hash 조회 실패: ${hash.error?.message ?? 'empty'}`)
  const shape = attemptShape(opened.view.role)
  const sec = Number.isInteger(o.sec) && (o.sec as number) >= 0 && (o.sec as number) <= 7200 ? (o.sec as number) : null
  const w: AttemptWrite = {
    userId: user.id,
    taskKey: row.task_key,
    applicationId: null,
    itemRef: ref,
    contentHash: hash.data,
    activity: shape.activity,
    phase: shape.phase,
    helpLevel: meta.value.helpLevel,
    synthetic: isSyntheticEmail(user.email),
    clientMutationId: meta.value.clientMutationId,
    clientSessionId: meta.value.clientSessionId,
    answeredAt: meta.value.answeredAt,
    sec,
    isCorrect: graded.grade.isCorrect,
    answer: graded.response as unknown as Record<string, unknown>,
    // 결속 RPC 는 response.annotation = 산출물 주석 ref 를 확인한다
    extra: { annotation: row.annotation_ref, grade: graded.grade, role: opened.view.role },
  }
  const sessionId = await writer.reveal(w)
  const outcome = await writer.record(w, sessionId)
  if (outcome === 'conflict') throw new AuthoredInputError('같은 제출 id 로 다른 답이 왔어요 — 화면을 새로 고쳐 주세요', 'invalid_input')
  const binding = await bindDeliveryAttempt(learner, { userId: user.id, itemRef: ref, clientMutationId: meta.value.clientMutationId, artifactKind: 'authored_item' })
    .catch((e) => { console.error('[authored delivery binding]', e); return { status: 'error' as const } })
  return { grade: graded.grade as unknown as AuthoredAttemptResult['grade'], reveal: revealAfterAnswer(item), binding: binding.status }
}

// ── Workspace 목록 ─────────────────────────────────────────────────────

export interface DeliveredRow { ref: string; role: AuthoredRole; deliveredAt: string; attempted: boolean; evidence: boolean | null }

/** 이 학습자의 창작 납품 목록 + 풀었는지 · 근거로 셌는지(결속 원장) — 지도 Workspace 와 결과 화면이 같이 쓴다 */
export async function listDelivered(learner: SupabaseClient, userId: string, task: string): Promise<DeliveredRow[] | 'not_installed'> {
  const d = await learner.from('workspace_content_delivery').select('artifact_ref, role, delivered_at')
    .eq('user_id', userId).eq('artifact_kind', 'authored_item').eq('task_id', task).order('delivered_at', { ascending: true })
  if (d.error) { if (isMissing(d.error)) return 'not_installed'; throw new Error(`납품 조회 실패: ${d.error.message}`) }
  const rows = (d.data ?? []) as { artifact_ref: string; role: AuthoredRole; delivered_at: string }[]
  if (rows.length === 0) return []
  const refs = rows.map((r) => r.artifact_ref)
  const [att, bind] = await Promise.all([
    learner.from('learning_task_attempts').select('item_ref').eq('user_id', userId).in('item_ref', refs),
    learner.from('workspace_delivery_attempt').select('artifact_ref, evidence').eq('user_id', userId).in('artifact_ref', refs),
  ])
  if (att.error) throw new Error(`기록 조회 실패: ${att.error.message}`)
  const attempted = new Set(((att.data ?? []) as { item_ref: string }[]).map((x) => x.item_ref))
  const ev = new Map<string, boolean>()
  if (!bind.error) for (const b of (bind.data ?? []) as { artifact_ref: string; evidence: boolean }[]) ev.set(b.artifact_ref, (ev.get(b.artifact_ref) ?? false) || b.evidence)
  return rows.map((r) => ({ ref: r.artifact_ref, role: r.role, deliveredAt: r.delivered_at, attempted: attempted.has(r.artifact_ref), evidence: ev.has(r.artifact_ref) ? ev.get(r.artifact_ref)! : null }))
}
