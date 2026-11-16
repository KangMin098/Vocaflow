// apps/web/src/lib/csat/map/v62/factory-bridge/dcp-admission.ts
//
// 단계 1C — 1B 지도 연습 제작물 → 기존 csat_dcp_items 후보 등록 계획. 순수 함수(파일 · DB · 시계 없음).
// 불변식:
//   · 1B 검증을 그대로 다시 돈다: 패킷 무결성(checkPacketIntegrity) · 출력 검증(validateOutput) · 원천 재판정(checkSource → evaluateSource).
//   · 원천은 호출자가 **지금 DB 에서 읽은 행**을 준다. 본문 · metadata digest 가 패킷과 다르면 과거 검수를 상속하지 않는다.
//   · AI 검수는 정확한 대상(source digest · 출력 파일 sha · 주문 · 패킷 · 역할 · TASK · 문항 hash)에 묶여야 한다.
//     검수 JSON 의 결론 문자열은 권한이 아니다 — 축마다 근거가 있어야 pass 이고, F(권리)는 AI 가 pass 로 만들 수 없다.
//   · 원문 파생물은 authored_item 이 아니다 — kind 'article' DCP 행이다. 범위는 guided_practice × r.central_meaning × topic/title/main_point.
//   · 계획은 등록 · 출시 · 납품이 아니다. 합성 수요는 격리 시험에서만 쓰고 실등록 대상이 아니다.

import { createHash } from 'node:crypto'

import { canonicalJson } from '../canonical-json'
import {
  LocalProductionError,
  PRODUCTION_ROLE,
  PRODUCTION_TASK,
  checkPacketIntegrity,
  checkSource,
  itemDigest,
  validateOutput,
  type AuthoredItem,
  type ProductionOutput,
  type ProductionPacket,
} from './local-production'

export const ADMISSION_SCHEMA = 'vf.dcp-admission/1' as const
export const AI_REVIEW_SCHEMA = 'vf.dcp-ai-review/1' as const
export const LEGACY_REVIEW_SCHEMA = 'vocaflow-ai-editorial-review/1' as const
export const SUPPORTED_TYPES = ['topic', 'title', 'main_point'] as const
export const AXIS_KEYS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const
export const QUALIFICATION_RULES = 'FQ1.1' as const
/** 지도 연습 필수 축(fq_role_ok) — G 는 공급 시점, E 는 평가 역할에서만 */
export const GUIDED_REQUIRED = ['A', 'B', 'C', 'D', 'F', 'H'] as const

type Axis = (typeof AXIS_KEYS)[number]
type AxisState = 'pass' | 'fail' | 'unknown' | 'not_applicable'
export type Axes = Record<Axis, { state: AxisState; evidence?: string[] }>

const sha = (s: string) => createHash('sha256').update(s).digest('hex')
const digest = (v: unknown) => sha(canonicalJson(v))
const HASH = /^[0-9a-f]{64}$/
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const STATES: readonly string[] = ['pass', 'fail', 'unknown', 'not_applicable']

/** 결정론 요청 키 — 같은 본문의 재시도는 같은 키(멱등), 본문이 바뀌면 다른 키 */
export const requestKeyFor = (bodyHash: string) => {
  const h = bodyHash.slice(0, 32)
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-${((parseInt(h[16]!, 16) & 3) | 8).toString(16)}${h.slice(17, 20)}-${h.slice(20, 32)}`
}

// ── AI 검수 기록 ──────────────────────────────────────────────────────────
export interface AiReviewTarget {
  item_id: string
  item_sha256: string
}
export interface AiReview {
  schema: typeof AI_REVIEW_SCHEMA
  kind: 'ai'
  reviewer: { model: 'claude' | 'codex'; session: string; role: string }
  target: { source_digest: string; output_sha256: string; order_hash: string; packet_hash: string; role: string; task: string; items: AiReviewTarget[] }
  conclusion: 'pass' | 'fail' | 'unknown'
  axes: Partial<Record<Axis, { state: AxisState; evidence: string[] }>>
  evidence: string[]
  limitations: string[]
}

export interface CheckedReview {
  sha256: string
  model: 'claude' | 'codex'
  session: string
  legacy: boolean
  conclusion: 'pass' | 'fail' | 'unknown'
  axes: Partial<Record<Axis, { state: AxisState; evidence: string[] }>>
  items: Set<string>
  limitations: string[]
}

export interface ReviewExpect {
  source_digest: string
  output_sha256: string
  order_hash: string
  packet_hash: string
  role: string
  task: string
  items: Map<string, string>
}

/**
 * 검수 기록을 대상에 대어 본다. 현재 형식(vf.dcp-ai-review/1)은 축별 판단을 갖는다.
 * 1B 의 기존 Codex 편집 검수(vocaflow-ai-editorial-review/1)는 출력 파일 sha · 원천 id 에만 묶이고 축 판단이 없다 →
 * 결속은 인정하되 축은 전부 unknown(자격 보류)으로 둔다.
 */
export function checkReview(value: unknown, expect: ReviewExpect & { source_id: string }): CheckedReview {
  if (!isObj(value)) throw new LocalProductionError('review_shape')
  const sha256 = digest(value)
  if (value.schema === LEGACY_REVIEW_SCHEMA) {
    const err = [
      value.source_id !== expect.source_id && 'source_id',
      value.reviewed_output_sha256 !== expect.output_sha256 && 'reviewed_output_sha256',
      !/codex|claude/i.test(String(value.reviewer)) && 'reviewer_not_ai',
    ].filter((x): x is string => typeof x === 'string')
    if (err.length) throw new LocalProductionError('review_target_mismatch', err)
    const keys = Array.isArray(value.keys_checked) ? (value.keys_checked as { item_id?: unknown }[]) : []
    return {
      sha256,
      model: /claude/i.test(String(value.reviewer)) ? 'claude' : 'codex',
      session: String(value.reviewed_on ?? 'unknown'),
      legacy: true,
      conclusion: 'unknown',
      axes: {},
      items: new Set(keys.map((k) => String(k.item_id))),
      limitations: ['legacy_review_without_axis_judgment', 'legacy_review_not_bound_to_order_packet_role_task'],
    }
  }
  if (value.schema !== AI_REVIEW_SCHEMA || value.kind !== 'ai') throw new LocalProductionError('review_schema')
  const r = value as unknown as AiReview
  if (!isObj(r.reviewer) || !['claude', 'codex'].includes(r.reviewer.model) || typeof r.reviewer.session !== 'string' || !r.reviewer.session.trim())
    throw new LocalProductionError('review_reviewer')
  const t = r.target
  if (!isObj(t)) throw new LocalProductionError('review_target_shape')
  const err = [
    t.source_digest !== expect.source_digest && 'source_digest',
    t.output_sha256 !== expect.output_sha256 && 'output_sha256',
    t.order_hash !== expect.order_hash && 'order_hash',
    t.packet_hash !== expect.packet_hash && 'packet_hash',
    t.role !== expect.role && 'role',
    t.task !== expect.task && 'task',
  ].filter((x): x is string => typeof x === 'string')
  const items = Array.isArray(t.items) ? t.items : []
  for (const it of items) if (!isObj(it) || expect.items.get(String(it.item_id)) !== it.item_sha256) err.push(`item:${String(isObj(it) ? it.item_id : '?')}`)
  if (err.length) throw new LocalProductionError('review_target_mismatch', err)
  if (!['pass', 'fail', 'unknown'].includes(r.conclusion)) throw new LocalProductionError('review_conclusion')
  const axes: CheckedReview['axes'] = {}
  for (const [k, a] of Object.entries(isObj(r.axes) ? r.axes : {})) {
    if (!(AXIS_KEYS as readonly string[]).includes(k) || !isObj(a) || !STATES.includes(String(a.state))) throw new LocalProductionError('review_axis_shape', [k])
    const ev = Array.isArray(a.evidence) ? a.evidence.filter((e): e is string => typeof e === 'string' && e.trim().length >= 8) : []
    if (a.state === 'pass' && !ev.length) throw new LocalProductionError('review_axis_pass_without_evidence', [k])
    if (k === 'F' && a.state === 'pass') throw new LocalProductionError('review_ai_cannot_grant_rights')
    axes[k as Axis] = { state: a.state as AxisState, evidence: ev }
  }
  return {
    sha256,
    model: r.reviewer.model,
    session: r.reviewer.session,
    legacy: false,
    conclusion: r.conclusion,
    axes,
    items: new Set(items.map((i) => i.item_id)),
    limitations: Array.isArray(r.limitations) ? r.limitations.filter((x): x is string => typeof x === 'string') : [],
  }
}

// ── DCP 행 변환 ──────────────────────────────────────────────────────────
/** 기존 선택지 DCP 모양: payload {passage, choices[5], stem_ko, underline, summary_sentence, choice_language} · answer_key {answer 1..5, rationale_ko} */
export function toDcpRow(sourceId: string, passage: string, it: AuthoredItem) {
  if (!(SUPPORTED_TYPES as readonly string[]).includes(it.type)) throw new LocalProductionError('unsupported_item_type', [it.type])
  const choices = it.choices.map((c) => c.text)
  return {
    kind: 'article' as const,
    ref_id: sourceId,
    type: it.type,
    paragraph_idx: 0,
    payload: {
      passage,
      choices,
      stem_ko: it.stem,
      underline: null,
      summary_sentence: null,
      choice_language: choices.some((c) => /[가-힣]/.test(c)) ? 'ko' : 'en',
    },
    answer_key: {
      answer: Number(it.answer),
      rationale_ko: `${it.explanation.observation}\n${it.explanation.interpretation}`,
      evidence_quotes: [...it.evidence_quotes],
    },
  }
}

// ── 등록 계획 ────────────────────────────────────────────────────────────
export interface RightsEvidence {
  /**
   * 권리 근거 기록 id — 실제 원저작 · 라이선스 문서(원천 측 관측값)를 검수 역할(AI 포함)이 확인한 기록.
   * 검수는 이미 존재하는 문서를 확인할 뿐 권리를 새로 발급하지 않는다 — 문서 관측이 없는 AI 의견은 근거가 아니다.
   */
  record_id: string
  basis: string
}

export interface AdmissionInput {
  packet: unknown
  output: unknown
  /** 출력 파일 bytes 의 sha256 — 검수가 묶인 정확한 판본 */
  outputSha256: string
  review: unknown
  /** 지금 DB 에서 읽은 원천(snapshot 모양) */
  currentSource: unknown
  rights?: RightsEvidence | null
}

export interface AdmissionItemPlan {
  item_id: string
  item_sha256: string
  request_key: string
  body: Record<string, unknown>
  body_hash: string
  row: ReturnType<typeof toDcpRow>
  axes: Axes
  qualification_ready: boolean
  held: string[]
}

export interface AdmissionPlan {
  schema: 'vf.dcp-admission-plan/1'
  real_admissible: boolean
  blockers: string[]
  source: { id: string; content_sha256: string; source_digest: string; eligibility: string }
  order: { product_order_id: string; order_revision: number; order_hash: string }
  review: { sha256: string; model: string; session: string; legacy: boolean; limitations: string[] }
  items: AdmissionItemPlan[]
  claims: { registered: false; qualified: false; released: false; delivered: false; human_review: false }
}

function axesFor(review: CheckedReview, source: { source_digest: string }, rights: RightsEvidence | null | undefined): Axes {
  const out = {} as Axes
  for (const k of AXIS_KEYS) {
    const a = review.axes[k]
    out[k] = a ? { state: a.state, evidence: a.evidence.map((e) => `ai:${review.model}:${e}`) } : { state: 'unknown' }
  }
  // A(원천 결속)는 시스템이 방금 재판정한 사실로만 — 검수 의견이 아니라 현재 행의 digest
  out.A = { state: 'pass', evidence: [`source_digest:${source.source_digest}`] }
  // F(권리)는 등록된 권리 근거가 있을 때만. 없으면 unknown(공급 보류)
  out.F = rights?.record_id ? { state: 'pass', evidence: [`rights_record:${rights.record_id}`] } : { state: 'unknown' }
  // G(학습자 노출)는 공급 시점 판정
  out.G = { state: 'not_applicable' }
  return out
}

export function planAdmission(input: AdmissionInput): AdmissionPlan {
  const packet: ProductionPacket = checkPacketIntegrity(input.packet)
  const outErr = validateOutput(packet, input.output)
  if (outErr.length) throw new LocalProductionError('output_invalid', outErr)
  const output = input.output as ProductionOutput
  if (!HASH.test(input.outputSha256)) throw new LocalProductionError('output_sha_required')
  const b = packet.body
  if (b.request.role !== PRODUCTION_ROLE || b.request.task !== PRODUCTION_TASK) throw new LocalProductionError('unsupported_stage', [b.request.role, b.request.task])

  // 원천 — 지금 행으로 다시 판정하고 패킷과 대조(본문 · metadata 가 바뀌면 상속 없음)
  const current = checkSource(input.currentSource)
  const srcErr = [
    current.id !== b.source.id && 'source_id',
    current.content_sha256 !== b.source.content_sha256 && 'content_changed',
    current.source_digest !== b.source.source_digest && 'metadata_changed',
  ].filter((x): x is string => typeof x === 'string')
  if (srcErr.length) throw new LocalProductionError('source_changed', srcErr)

  const itemHashes = new Map(output.items.map((it) => [it.id, itemDigest(it)]))
  const review = checkReview(input.review, {
    source_id: b.source.id,
    source_digest: b.source.source_digest,
    output_sha256: input.outputSha256,
    order_hash: b.order.order_hash,
    packet_hash: packet.packet_hash,
    role: b.request.role,
    task: b.request.task,
    items: itemHashes,
  })

  const blockers = [
    ...(b.synthetic_demand ? ['synthetic_demand_isolated_only'] : []),
    ...(b.limits.includes('synthetic_policy_hash_not_policy_approval') ? ['synthetic_policy_hash'] : []),
  ]
  const axes = axesFor(review, current, input.rights)
  const items = output.items.map((it): AdmissionItemPlan => {
    const row = toDcpRow(b.source.id, b.source.display_content, it)
    const h = itemHashes.get(it.id)!
    const held = [
      ...(review.items.has(it.id) ? [] : ['item_not_reviewed']),
      ...(review.conclusion === 'pass' ? [] : [`review_conclusion_${review.conclusion}`]),
      ...GUIDED_REQUIRED.filter((k) => axes[k].state !== 'pass').map((k) => `axis_${k}_${axes[k].state}`),
    ]
    const body = {
      schema: ADMISSION_SCHEMA,
      synthetic_demand: b.synthetic_demand,
      role: b.request.role,
      task: b.request.task,
      source: { id: b.source.id, content_sha256: b.source.content_sha256, source_digest: b.source.source_digest },
      order: { product_order_id: b.order.product_order_id, order_revision: b.order.order_revision, order_hash: b.order.order_hash, planning_hash: b.order.planning_hash },
      packet_hash: packet.packet_hash,
      task_id: packet.task_id,
      request_id: b.request_id,
      output_sha256: input.outputSha256,
      item: { id: it.id, sha256: h, type: it.type },
      review: { kind: 'ai', model: review.model, session: review.session, sha256: review.sha256, legacy: review.legacy },
      row,
    }
    const bodyHash = digest(body)
    return { item_id: it.id, item_sha256: h, request_key: requestKeyFor(bodyHash), body, body_hash: bodyHash, row, axes, qualification_ready: held.length === 0, held }
  })
  return {
    schema: 'vf.dcp-admission-plan/1',
    real_admissible: blockers.length === 0,
    blockers,
    source: { id: current.id, content_sha256: current.content_sha256, source_digest: current.source_digest, eligibility: current.eligibility.status },
    order: { product_order_id: b.order.product_order_id, order_revision: b.order.order_revision, order_hash: b.order.order_hash },
    review: { sha256: review.sha256, model: review.model, session: review.session, legacy: review.legacy, limitations: review.limitations },
    items,
    claims: { registered: false, qualified: false, released: false, delivered: false, human_review: false },
  }
}

/** 자격 기록 인자 — 기존 content_qualification_record 서명 그대로. method 에 AI 검수임을 남긴다 */
export function qualificationArgs(plan: AdmissionPlan, item: AdmissionItemPlan, dcpItemId: string, artifactRevision: string) {
  return {
    p_rules_version: QUALIFICATION_RULES,
    p_kind: 'dcp_item',
    p_ref: dcpItemId,
    p_revision: artifactRevision,
    p_task: PRODUCTION_TASK,
    p_role: PRODUCTION_ROLE,
    p_axes: Object.fromEntries(AXIS_KEYS.map((k) => [k, { state: item.axes[k].state }])),
    p_source_revision: plan.source.source_digest,
    p_source_hash: plan.source.content_sha256,
    p_analysis_revision: null,
    p_gold_revision: null,
    p_gold_hash: null,
    // 적용된 I2 서명(주석 결속 2개) — DCP 문항은 주석 기반 과제가 아니라 null(I2 제약은 csat_item 에만 걸린다)
    p_annotation_ref: null,
    p_annotation_hash: null,
    p_defects: item.held,
    p_evidence_ids: [`ai_review:${plan.review.model}:${plan.review.sha256}`, `admission:${item.body_hash}`,
      ...AXIS_KEYS.flatMap((k) => item.axes[k].evidence ?? []).filter((e) => !e.startsWith('ai:')).slice(0, 4)],
    p_method: `AI 검수(${plan.review.model}) — 사람 검수 아님 · 1C 후보`,
    p_supersedes: null,
  }
}
