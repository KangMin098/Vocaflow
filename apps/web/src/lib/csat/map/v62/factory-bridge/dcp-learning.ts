// apps/web/src/lib/csat/map/v62/factory-bridge/dcp-learning.ts
//
// 단계 1D — 납품된 공장 DCP 지도 연습(guided_practice · r.central_meaning)을 학습자 본인 세션으로 목록 · 열기 · 제출한다.
//   · 판정은 전부 DB(_pending_factory_dcp_learning.sql)가 한다 — 소유 · 등록 후보 · 역할/TASK · Workspace 열림 · 현재 유효 ·
//     개인 계보 · 제품주문 링크. 여기서는 닫힌 DTO 로 모양만 확인한다(모르는 값은 성공으로 올리지 않는다).
//   · 열기 DTO 에는 passage · stem_ko · choices 만 — answer_key · 해설 · 검수 기록이 섞이면 버린다.
//   · 제출: 같은 mutation 키 재전송 = 저장된 같은 결과. 저장 실패는 { ok:false } — 오답 · 완료로 바꾸지 않는다.
//   · 이 풀이는 연습 기록이다. evidence 는 언제나 false(role_not_evidence) — 독립 확인 · 향상 근거가 아니다.
//   · 미설치(함수 없음) · 조회 실패 · 없음 · 비유효(철회 등)를 구분한다.

import type { SupplyClient } from './dcp-supply'

export const DCP_LEARNING_TYPES = ['topic', 'title', 'main_point'] as const
export type DcpLearningType = (typeof DCP_LEARNING_TYPES)[number]
/** DB factory_dcp_delivery_state 가 돌려주는 닫힌 코드 */
export const DELIVERY_STATES = ['ok', 'not_found', 'not_factory_dcp', 'wrong_role_task', 'workspace_closed', 'stale_revision', 'not_current',
  'lineage_not_current', 'product_link_mismatch', 'product_not_current'] as const
export type DeliveryState = (typeof DELIVERY_STATES)[number]

export interface DeliveryRow {
  deliveryId: string
  dcpItemId: string
  sourceId: string
  type: DcpLearningType
  deliveredAt: string
  state: DeliveryState
  attempts: number
  lastCorrect: boolean | null
}
export interface DeliveryList { workspaceId: string | null; rows: DeliveryRow[]; sources: number; items: number }
export interface OpenedItem {
  deliveryId: string
  workspaceId: string
  sourceId: string
  attempts: number
  item: { id: string; type: DcpLearningType; paragraphIdx: number; payload: { passage: string; stem_ko: string; choices: string[] } }
}
export interface AttemptResult {
  receiptId: string
  deliveryId: string
  correct: boolean
  csatAttemptId: string
  answerKey: Record<string, unknown> | null
  evidence: false
  nonEvidenceReason: 'role_not_evidence'
  replayed: boolean
}

export type LearningFail = { ok: false; code: 'not_installed' | 'query_failed' | 'bad_shape' | 'invalid_input' | 'conflict' | DeliveryState }

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
export const isUuid = (x: unknown): x is string => typeof x === 'string' && UUID.test(x)
const isObj = (x: unknown): x is Record<string, unknown> => !!x && typeof x === 'object' && !Array.isArray(x)
const isState = (x: unknown): x is DeliveryState => (DELIVERY_STATES as readonly unknown[]).includes(x)
const isType = (x: unknown): x is DcpLearningType => (DCP_LEARNING_TYPES as readonly unknown[]).includes(x)
/** 시도 횟수 — 0 이상 정수 숫자만. null · 음수 · 문자열을 0 으로 바꾸지 않는다(미상은 bad_shape) */
const countOf = (x: unknown): number | null => (typeof x === 'number' && Number.isInteger(x) && x >= 0 ? x : null)

/** PostgREST · Postgres 의 「함수 없음」 = 미설치. 그 밖의 오류는 조회 실패 */
function classify(error: { message: string; code?: string }): LearningFail {
  if (error.code === 'PGRST202' || error.code === '42883' || /function .* does not exist|Could not find the function/i.test(error.message)) return { ok: false, code: 'not_installed' }
  const m = /attempt: delivery ([a-z_]+)/.exec(error.message)
  if (m && isState(m[1])) return { ok: false, code: m[1] }
  if (error.code === '23505' || /mutation key reused/.test(error.message)) return { ok: false, code: 'conflict' }
  if (error.code === '22023' || /answer must be/.test(error.message)) return { ok: false, code: 'invalid_input' }
  return { ok: false, code: 'query_failed' }
}

function rowOf(x: unknown): DeliveryRow | null {
  if (!isObj(x) || !isUuid(x.delivery_id) || !isUuid(x.dcp_item_id) || !isUuid(x.source_id) || !isType(x.type) || !isState(x.state)) return null
  const attempts = countOf(x.attempts)
  if (attempts === null || typeof x.delivered_at !== 'string') return null
  if (x.last_correct !== null && typeof x.last_correct !== 'boolean') return null
  return {
    deliveryId: x.delivery_id, dcpItemId: x.dcp_item_id, sourceId: x.source_id, type: x.type, deliveredAt: x.delivered_at, state: x.state, attempts,
    lastCorrect: typeof x.last_correct === 'boolean' ? x.last_correct : null,
  }
}

export async function listFactoryDeliveries(c: SupplyClient, template: string): Promise<{ ok: true; list: DeliveryList } | LearningFail> {
  if (!/^ws\.[a-z0-9-]{1,40}$/.test(template)) return { ok: false, code: 'invalid_input' }
  const { data, error } = await c.rpc<unknown>('factory_dcp_deliveries', { p_template: template })
  if (error) return classify(error)
  if (!isObj(data) || !Array.isArray(data.rows) || (data.workspace_id !== null && !isUuid(data.workspace_id))) return { ok: false, code: 'bad_shape' }
  const rows = data.rows.map(rowOf)
  if (rows.some((r) => r === null)) return { ok: false, code: 'bad_shape' }
  const ok = rows as DeliveryRow[]
  // 같은 원문에서 나온 3문항은 지문 1개다 — 지문 수와 문항 수를 따로 센다
  return { ok: true, list: { workspaceId: data.workspace_id as string | null, rows: ok, sources: new Set(ok.map((r) => r.sourceId)).size, items: ok.length } }
}

export async function openFactoryDelivery(c: SupplyClient, deliveryId: string): Promise<{ ok: true; opened: OpenedItem } | LearningFail> {
  if (!isUuid(deliveryId)) return { ok: false, code: 'invalid_input' }
  const { data, error } = await c.rpc<unknown>('factory_dcp_open', { p_delivery: deliveryId })
  if (error) return classify(error)
  if (!isObj(data) || !isState(data.state)) return { ok: false, code: 'bad_shape' }
  if (data.state !== 'ok') return { ok: false, code: data.state }
  const it = data.item
  if (!isObj(it) || !isUuid(it.id) || !isType(it.type) || !Number.isInteger(it.paragraph_idx) || !isObj(it.payload)) return { ok: false, code: 'bad_shape' }
  const { passage, stem_ko, choices } = it.payload
  if (typeof passage !== 'string' || !passage.trim() || typeof stem_ko !== 'string' || !Array.isArray(choices) || choices.length !== 5
      || !choices.every((s) => typeof s === 'string')) return { ok: false, code: 'bad_shape' }
  // 요청한 납품과 다른 납품이 돌아오면 열지 않는다
  const attempts = countOf(data.attempts)
  if (data.delivery_id !== deliveryId || !isUuid(data.workspace_id) || !isUuid(data.source_id) || attempts === null) return { ok: false, code: 'bad_shape' }
  return {
    ok: true,
    opened: {
      deliveryId, workspaceId: data.workspace_id, sourceId: data.source_id, attempts,
      // 화이트리스트로 다시 만든다 — DB 가 무엇을 더 실어도 답변 전 화면에는 이 세 칸만 간다
      item: { id: it.id, type: it.type, paragraphIdx: it.paragraph_idx as number, payload: { passage, stem_ko, choices: choices as string[] } },
    },
  }
}

/** 제출 본문(클라이언트) — 닫힌 필드 { choice, mutationId } 만. userId · 정오 · hash · 승인은 받지 않는다 */
export function parseAttemptBody(raw: unknown): { choice: number; mutationId: string } | null {
  if (!isObj(raw)) return null
  const keys = Object.keys(raw).sort()
  if (keys.length !== 2 || keys[0] !== 'choice' || keys[1] !== 'mutationId') return null
  const { choice, mutationId } = raw
  if (typeof choice !== 'number' || !Number.isInteger(choice) || choice < 1 || choice > 5 || !isUuid(mutationId)) return null
  return { choice, mutationId }
}

export async function submitFactoryAttempt(c: SupplyClient, deliveryId: string, body: { choice: number; mutationId: string }): Promise<{ ok: true; result: AttemptResult } | LearningFail> {
  if (!isUuid(deliveryId)) return { ok: false, code: 'invalid_input' }
  const { data, error } = await c.rpc<unknown>('factory_dcp_attempt', { p_delivery: deliveryId, p_answer: { choice: body.choice }, p_mutation: body.mutationId })
  if (error) return classify(error)
  // 정오가 boolean 이 아니면 저장된 결과로 보지 않는다(미상을 오답으로 만들지 않는다)
  if (!isObj(data) || typeof data.correct !== 'boolean' || !isUuid(data.receipt_id) || data.delivery_id !== deliveryId
      || !isUuid(data.csat_attempt_id) || data.evidence !== false || typeof data.replayed !== 'boolean'
      || data.non_evidence_reason !== 'role_not_evidence') return { ok: false, code: 'bad_shape' }
  return {
    ok: true,
    result: {
      receiptId: data.receipt_id, deliveryId, correct: data.correct, csatAttemptId: data.csat_attempt_id,
      answerKey: isObj(data.answer_key) ? data.answer_key : null, evidence: false, nonEvidenceReason: 'role_not_evidence', replayed: data.replayed,
    },
  }
}

/** 학습자 문구 — 열 수 없는 이유(닫힌 코드만). 모르는 코드는 「확인하지 못했어요」 */
export const STATE_COPY: Record<Exclude<DeliveryState, 'ok'>, string> = {
  not_found: '이 자료를 찾지 못했어요.',
  not_factory_dcp: '이 화면에서 열 수 있는 자료가 아니에요.',
  wrong_role_task: '지금 계획의 연습 자료가 아니에요.',
  workspace_closed: '닫힌 Workspace 의 자료라 새로 풀 수 없어요.',
  stale_revision: '자료가 바뀌어 예전 판본은 열 수 없어요.',
  not_current: '승인이 철회되었거나 원문이 바뀌어 지금은 열 수 없어요.',
  lineage_not_current: '학습계획이 바뀌어 이 자료는 지금 계획에 속하지 않아요.',
  product_link_mismatch: '제작 주문 연결을 확인하지 못해 열 수 없어요.',
  product_not_current: '제작 주문이 바뀌어 지금은 열 수 없어요.',
}
