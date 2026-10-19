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
import { bindDeliveryAttempt, type BindingResult } from '@/lib/csat/map/v62/delivery-binding'
import { selectWriter, type AttemptWrite, type AttemptWriter } from '@/lib/knowledge/practice-writer'
import { isSyntheticEmail, parseClientMeta } from '@/lib/knowledge/practice'
import { formatOf, type FormatId } from '@/lib/knowledge/authored/formats'
import {
  gradeAuthored, isAssessmentRole, learnerBody, revealAfterAnswer,
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
    const have = await learner.from('workspace_content_delivery').select('id, artifact_ref').eq('line_id', l.id).eq('user_id', userId)
    if (have.error) throw new Error(`공급 조회 실패: ${have.error.message}`)
    // FI-007 — 현재 수요 충족은 **지금 유효한** 납품만(권리 · 승인 철회 · 자격 대체 뒤에는 부족분으로 다시 센다 · 과거 원장은 보존)
    const haveRows = (have.data ?? []) as { artifact_ref: string; id?: string }[]
    const already = new Set(haveRows.map((x) => x.artifact_ref))
    for (const x of haveRows) if (x.id && (await currentOf(learner, x.id)) === true) out.delivered.push(x.artifact_ref)
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

/** 학습자 본인 납품의 지금 유효성(workspace_delivery_current · FI-007). 함수가 없거나 실패하면 null(= 열지 않는다 · fail-closed) */
export async function currentOf(learner: SupabaseClient, deliveryId: string): Promise<boolean | null> {
  const r = await learner.rpc('workspace_delivery_current', { p_delivery: deliveryId })
  if (r.error) return null
  return r.data === true ? true : r.data === false ? false : null
}

// ── 납품 자료 열기 ────────────────────────────────────────────────────

export interface DeliveredView {
  ref: string
  role: AuthoredRole
  deliveryId: string
  taskId: string
  format: FormatId
  sentences: string[]
  stem: string
  choices: string[]
  teach: AuthoredBody['teach'] | null
  hints: string[] | null
  /** 형식별로 무엇을 묻는지(정답 아님): target · pairs · marks */
  extra: Record<string, unknown>
  /** central_meaning 관계 질문 문장 번호(어느 문장을 묻는지만 — 답은 아니다). 다른 형식은 null */
  probe: number | null
  /** 이미 푼 기록이 있으면 결과 · 해설(응답 뒤에만) */
  done: null | { isCorrect: boolean; reveal: ReturnType<typeof revealAfterAnswer> }
}

export interface DeliveryChoice { deliveryId: string; role: AuthoredRole; deliveredAt: string }
export type OpenResult =
  | { status: 'not_installed' } | { status: 'not_delivered' }
  /** 납품은 있었지만 지금은 무효(권리 · Gold · 승인 철회 · 자격 대체) — 본문을 다시 내보내지 않는다. 과거 결과는 기록에 남아 있다(FI-007) */
  | { status: 'revoked'; deliveryId: string }
  /** 같은 자료가 여러 학습 묶음 · 역할로 납품됐는데 어느 납품에서 시작했는지 모른다 — 추측하지 않고 고르게 한다(FI-001) */
  | { status: 'choose'; choices: DeliveryChoice[] }
  | { status: 'ok'; view: DeliveredView }

/**
 * 이 학습자에게 납품된 자료만 연다(미리보기 없음 — 평가 지문이 납품 전에 새지 않는다).
 * 출처(납품 id)가 있으면 그 납품만 — 본인 · 같은 문항이 아니면 not_delivered. 없으면 납품이 하나일 때만 그것, 둘 이상이면 'choose'(최신 추측 금지 · FI-001).
 */
export async function openDelivered(admin: SupabaseClient, learner: SupabaseClient, userId: string, ref: string, deliveryId?: string | null): Promise<OpenResult> {
  let q = learner.from('workspace_content_delivery').select('id, role, delivered_at')
    .eq('user_id', userId).eq('artifact_kind', 'authored_item').eq('artifact_ref', ref)
  if (deliveryId) {
    if (!/^[0-9a-f-]{36}$/i.test(deliveryId)) return { status: 'not_delivered' }
    q = q.eq('id', deliveryId)
  }
  const d = await q.order('delivered_at', { ascending: true }).limit(20)
  if (d.error) { if (isMissing(d.error)) return { status: 'not_installed' }; throw new Error(`납품 조회 실패: ${d.error.message}`) }
  const all = (d.data as { id: string; role: AuthoredRole; delivered_at: string }[] | null) ?? []
  if (all.length === 0) return { status: 'not_delivered' }
  if (all.length > 1) return { status: 'choose', choices: all.map((x) => ({ deliveryId: x.id, role: x.role, deliveredAt: x.delivered_at })) }
  const delivery = all[0]
  if ((await currentOf(learner, delivery.id)) !== true) return { status: 'revoked', deliveryId: delivery.id }
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
      ref, role: delivery.role, deliveryId: delivery.id, taskId: row.task_id,
      ...learnerBody(delivery.role, item.body),
      probe: formatOf(item.body) === 'central_meaning' ? (item.gold as AuthoredGold).relationProbe.sentence : null,
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
  constructor(message: string, readonly code: 'not_delivered' | 'invalid_input' | 'not_installed' | 'no_provenance') { super(message) }
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
  binding: BindingResult
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
  // 출처 = 화면이 연 납품 id(본문 deliveryId). 없으면 기록하지 않는다 — 어느 학습 묶음 · 역할의 수행인지 모르는 기록을 만들지 않는다(FI-001)
  const deliveryId = typeof o.deliveryId === 'string' ? o.deliveryId : null
  if (!deliveryId) throw new AuthoredInputError('어느 학습 묶음에서 받은 자료인지 알 수 없어요 — 학습 지도에서 다시 열어 주세요', 'no_provenance')
  const opened = await openDelivered(admin, learner, user.id, ref, deliveryId)
  if (opened.status === 'not_installed') throw new AuthoredInputError('창작 자료 공급이 아직 준비되지 않았어요', 'not_installed')
  if (opened.status !== 'ok') throw new AuthoredInputError('이 자료는 아직 받지 않았어요', 'not_delivered')
  const row = await loadRow(admin, ref)
  if (!row) throw new AuthoredInputError('이 자료는 아직 받지 않았어요', 'not_delivered')
  const { set, item } = itemOfRow(row)
  const graded = gradeAuthored(set, item, o.response)
  if (!graded) throw new AuthoredInputError('고른 답을 다시 확인해 주세요', 'invalid_input')
  const hash = await admin.rpc('authored_item_gold_hash', { p_ref: ref })
  if (hash.error || typeof hash.data !== 'string') throw new Error(`채점 주석 hash 조회 실패: ${hash.error?.message ?? 'empty'}`)
  // FI-011 — 바로잡기 수행 문맥(mode=repair). 이미 답 · 해설을 본 뒤 다시 푸는 연습이다:
  //   · 이 학습자의 이 문항 이전 오답이 있어야 한다(바로잡기 대상 · 처음 시도를 바로잡기로 둔갑시키지 않는다)
  //   · **연습 활동(activity practice)** 으로 새 세션에 남기고 G2 결속을 하지 않는다 — 연습은 직접 확인 근거가 아니다(skill-diagnosis) ·
  //     첫 독립 시도 · 정오 · evidence · 노출 · 납품 영수증 불변. 바로잡기 의미는 response.mode='repair' 가 담는다
  //   · 도움 사건(viewed_first · 해설 열람)을 따로 남기지 않는다 — learning_first_attempts 는 같은/다른 세션의 도움 시각이 시도 앞뒤 2분 안이면
  //     과거 독립 시도를 「순서 확인 불가」로 만들어, 확인 직후의 바로잡기가 첫 근거를 소급해 지웠다(종단 e2e 실측 2026-10-19). 표기 방식은 Codex 설계 판정 대상
  //   · 성공 여부는 지도의 repairGate(같은 과제 키 · 막힌 문항 · 확정 뒤 새 정답)가 읽는다. 같은 제출 id 재전송은 기존 기록 그대로(writer 멱등)
  const repair = o.mode === 'repair'
  if (repair) {
    const prior = await admin.from('learning_task_attempts').select('id').eq('user_id', user.id).eq('item_ref', ref).eq('is_correct', false).limit(1)
    if (prior.error) throw new Error(`이전 시도 조회 실패: ${prior.error.message}`)
    if ((prior.data ?? []).length === 0) throw new AuthoredInputError('바로잡을 이전 오답이 없어요 — 학습 지도에서 다시 열어 주세요', 'invalid_input')
  }
  const shape = repair ? { activity: 'practice' as const, phase: 'practice' as const } : attemptShape(opened.view.role)
  const sec = Number.isInteger(o.sec) && (o.sec as number) >= 0 && (o.sec as number) <= 7200 ? (o.sec as number) : null
  const w: AttemptWrite = {
    userId: user.id,
    taskKey: row.task_key,
    applicationId: null,
    itemRef: ref,
    contentHash: hash.data,
    activity: shape.activity,
    phase: shape.phase,
    helpLevel: repair ? 'independent' : meta.value.helpLevel, // 바로잡기는 연습 활동이라 근거 아님 — 도움 사건을 만들지 않는다(위)
    synthetic: isSyntheticEmail(user.email),
    clientMutationId: meta.value.clientMutationId,
    clientSessionId: meta.value.clientSessionId,
    answeredAt: meta.value.answeredAt,
    sec,
    isCorrect: graded.grade.isCorrect,
    answer: graded.response as unknown as Record<string, unknown>,
    // 결속 RPC 는 response.annotation = 산출물 주석 ref 를 확인한다
    extra: { annotation: row.annotation_ref, grade: graded.grade, role: opened.view.role, ...(repair ? { mode: 'repair' } : {}) },
  }
  const sessionId = await writer.reveal(w)
  const outcome = await writer.record(w, sessionId)
  if (outcome === 'conflict') throw new AuthoredInputError('같은 제출 id 로 다른 답이 왔어요 — 화면을 새로 고쳐 주세요', 'invalid_input')
  if (repair) return { grade: graded.grade as unknown as AuthoredAttemptResult['grade'], reveal: revealAfterAnswer(item), binding: { status: 'repair_practice' } }
  const binding: BindingResult = await bindDeliveryAttempt(learner, { userId: user.id, itemRef: ref, clientMutationId: meta.value.clientMutationId, artifactKind: 'authored_item', deliveryId: opened.view.deliveryId })
    .catch((e) => { console.error('[authored delivery binding]', e); return { status: 'error' as const } })
  return { grade: graded.grade as unknown as AuthoredAttemptResult['grade'], reveal: revealAfterAnswer(item), binding }
}

// ── Workspace 목록 ─────────────────────────────────────────────────────

export interface DeliveredRow {
  ref: string
  deliveryId: string
  role: AuthoredRole
  deliveredAt: string
  /** 이 자료(문항)를 푼 기록이 있나 — 어느 납품이든 */
  attempted: boolean
  /** 이 납품에 결속된 결과: true = 근거로 셈 · false = 연습/비근거 · null = 이 납품에는 결속 없음 */
  evidence: boolean | null
  /** 지금 유효한가(FI-007) — false = 철회 · 대체로 지금은 열 수 없음(과거 결과는 남는다) · null = 판정 못 함 */
  current: boolean | null
}

/** 이 학습자의 창작 납품 목록(납품 단위) — 지도 Workspace · 결과 화면이 같이 쓴다. 근거는 **그 납품에 결속된 행**만 본다(FI-001) */
export async function listDelivered(learner: SupabaseClient, userId: string, task: string): Promise<DeliveredRow[] | 'not_installed'> {
  const d = await learner.from('workspace_content_delivery').select('id, artifact_ref, role, delivered_at')
    .eq('user_id', userId).eq('artifact_kind', 'authored_item').eq('task_id', task).order('delivered_at', { ascending: true })
  if (d.error) { if (isMissing(d.error)) return 'not_installed'; throw new Error(`납품 조회 실패: ${d.error.message}`) }
  const rows = (d.data ?? []) as { id: string; artifact_ref: string; role: AuthoredRole; delivered_at: string }[]
  if (rows.length === 0) return []
  const refs = [...new Set(rows.map((r) => r.artifact_ref))]
  const [att, bind] = await Promise.all([
    learner.from('learning_task_attempts').select('item_ref').eq('user_id', userId).in('item_ref', refs),
    learner.from('workspace_delivery_attempt').select('delivery_id, evidence').eq('user_id', userId).in('delivery_id', rows.map((r) => r.id)),
  ])
  if (att.error) throw new Error(`기록 조회 실패: ${att.error.message}`)
  const attempted = new Set(((att.data ?? []) as { item_ref: string }[]).map((x) => x.item_ref))
  const ev = new Map<string, boolean>()
  if (!bind.error) for (const b of (bind.data ?? []) as { delivery_id: string; evidence: boolean }[]) ev.set(b.delivery_id, (ev.get(b.delivery_id) ?? false) || b.evidence)
  const current = await Promise.all(rows.map((r) => currentOf(learner, r.id)))
  return rows.map((r, i) => ({ ref: r.artifact_ref, deliveryId: r.id, role: r.role, deliveredAt: r.delivered_at, attempted: attempted.has(r.artifact_ref), evidence: ev.has(r.id) ? ev.get(r.id)! : null, current: current[i] }))
}

// ── 열기 세션(FI-010) ──────────────────────────────────────────────────

/**
 * 납품 자료 본문을 **열었다는 사실**을 노출 원장(learning_sessions · stage open)에 남긴다. 페이지를 열 때마다 새 세션이다 —
 * 응답 없이 닫고 다른 페이지로 다시 열면, 앞 세션이 이미 본문을 공개한 기록이 되어 다음 제출은 첫 노출이 아니다(G2 결속 ⑥).
 * 같은 페이지에서 낸 제출은 이 세션 id(clientSessionId)를 이어 쓴다. 기록 실패는 화면을 막지 않지만 null 을 돌려
 * 화면이 제출에 쓸 세션을 새로 만들지 않게 한다(그 경우 서버 기록 경로가 세션을 만든다).
 */
export async function recordOpen(admin: SupabaseClient, user: { id: string; email: string | null }, view: DeliveredView, taskKey: string, sessionId: string, at: string): Promise<boolean> {
  const shape = attemptShape(view.role)
  const r = await admin.rpc('learning_session_apply', {
    p_user: user.id, p_mutation: stableKey('authored-open', user.id, sessionId), p_client_session_id: sessionId,
    p_activity: shape.activity, p_phase: shape.phase, p_item_ref: view.ref, p_stage: 'open', p_step: 0, p_steps: 1,
    p_help_level: null, p_at: at, p_synthetic: isSyntheticEmail(user.email), p_task_key: taskKey, p_application_id: null,
  })
  if (r.error) { console.error('[authored open session]', r.error.message); return false }
  return true
}

/** 열기 세션에 쓸 과제 키(DB 행) — 화면은 Gold 없이 과제 키만 알면 된다 */
export async function taskKeyOf(admin: SupabaseClient, ref: string): Promise<string | null> {
  const r = await admin.from('authored_item').select('task_key').eq('ref', ref).maybeSingle()
  return r.error ? null : ((r.data as { task_key: string } | null)?.task_key ?? null)
}
