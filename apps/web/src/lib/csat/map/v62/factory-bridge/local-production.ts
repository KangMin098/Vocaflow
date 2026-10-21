// apps/web/src/lib/csat/map/v62/factory-bridge/local-production.ts
//
// 단계 1B — 1A 주문 초안(draft_prepared) + 읽기 전용 원천 snapshot → 작업 패킷 → (실행 중인 에이전트가 직접 작성) → 검증 → HTML · 자료 JSON · manifest.
// 순수 함수만 둔다: 파일 · 시계 · 네트워크는 CLI(scripts/textbook/factory-production-local.mts)가 맡고, 시각 · run id 는 인자로 받는다.
// 불변식:
//   · 주문 hash 는 공장 `sealProductOrder` 로 다시 계산한다 — 초안의 registrable · 승인 flag 로 권한을 만들지 않는다.
//   · 원천 적격성은 `sourceEligibilityInput` + `evaluateSource(...,'textbook')` 결과 그대로 — eligible 이 아니면 거절(review · conditional 포함).
//   · 범위는 guided_practice × r.central_meaning 한 줄. 독립 확인 · 전이 · 지연 역할로 승격하지 않는다.
//   · 결과 manifest 는 기존 `validateManifest` 를 통과해야 하고, 상태는 review_pending · lifecycle test_fixture 다(공급 · 등록 · 발행 · 납품 아님).
//   · 실행 영수증(execution)이 없으면 REAL 이 아니라 MOCK 으로 만든다.

import { createHash } from 'node:crypto'

import { evaluateSource, sourceEligibilityInput } from '@vocaflow/library-pipeline'
import { sealProductOrder } from '@vocaflow/library-pipeline/factory-order'

import { canonicalJson } from '../canonical-json'
import {
  FACTORY_MANIFEST_SCHEMA,
  FACTORY_REQUEST_SCHEMA,
  ROLE_SPEC,
  requestBody,
  validateManifest,
  type FactoryRequest,
  type FactoryResultManifest,
  type ManifestArtifact,
} from '../factory-integration'
import { canonicalSpec, type LineageSpec } from './order-lineage'

export const PACKET_SCHEMA = 'vf.local-production-packet/1' as const
export const OUTPUT_SCHEMA = 'vf.local-production-output/1' as const
export const REQUEST_SCHEMA = 'vf.local-production-request/1' as const
export const MATERIALS_SCHEMA = 'vf.local-production-materials/1' as const
export const PRODUCTION_ROLE = 'guided_practice' as const
export const PRODUCTION_TASK = 'r.central_meaning' as const
export const CHOICE_KEYS = ['1', '2', '3', '4', '5'] as const
export const FACTORY_ID = { name: 'vocaflow-local-production', version: '1b' } as const

export class LocalProductionError extends Error {
  constructor(readonly code: string, readonly detail: string[] = []) {
    super(detail.length ? `${code}: ${detail.join(', ')}` : code)
  }
}

const sha = (text: string | Uint8Array) => createHash('sha256').update(text).digest('hex')
const digest = (value: unknown) => sha(canonicalJson(value))
const HASH = /^[0-9a-f]{64}$/
const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/
const PLACEHOLDER = /\b(TODO|TBD|lorem|ipsum|placeholder|FIXME)\b|<fill|\?\?\?|\.\.\.\s*$/i
const ITEM_ID = /^[a-z0-9][a-z0-9-]{2,63}$/
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const str = (v: unknown, min = 1): v is string => typeof v === 'string' && v.trim().length >= min
const strictKeys = (o: Record<string, unknown>, keys: readonly string[]) => Object.keys(o).sort().join(',') === [...keys].sort().join(',')
/** 한 글자 반복 hash(예: '1'×64)는 시험 합성값 — 정책 승인이 아니다 */
const syntheticHash = (h: unknown) => typeof h === 'string' && HASH.test(h) && new Set(h).size === 1

// ── 입력 1: 1A draft_prepared ─────────────────────────────────────────────
export interface PreparedDraftInput {
  /** 1A 정상 fixture 로 실제 서비스를 돌려 만든 smoke 면 true — 실제 주문 · 등록이 아니다 */
  synthetic_demand: boolean
  prepared: unknown
}

interface CheckedPrepared {
  demand: { demand_id: string; line_id: string; line_no: number; signature: string; definition_version: string; goal_version_id: number | null; plan_version: number; role: string; task: string; quantity: number }
  spec: LineageSpec
  order: { product_order_id: string; order_revision: number; product_family: string; item_types: string[]; planning_hash: string | null }
  order_hash: string
  planning_hash: string
  blockers: string[]
  policy_hashes_synthetic: boolean
}

/** 1A 응답을 다시 검증한다 — 상태 필드 · 실제 sealer 의 order hash · spec · 역할/TASK 범위 */
export function checkPrepared(value: unknown): CheckedPrepared {
  if (!isObj(value)) throw new LocalProductionError('prepared_shape')
  const p = value
  const stateErr = [
    p.ok !== true && 'ok',
    p.status !== 'draft_prepared' && 'status',
    p.persisted !== false && 'persisted',
    p.lineage !== 'not_registered' && 'lineage',
    p.production !== 'not_started' && 'production',
    p.delivery !== 'not_performed' && 'delivery',
    p.registrable !== false && 'registrable',
    p.mapping !== 'candidate_unvalidated' && 'mapping',
  ].filter((x): x is string => typeof x === 'string')
  if (stateErr.length) throw new LocalProductionError('prepared_state', stateErr)
  const factory = p.factory as Record<string, unknown> | undefined
  if (!isObj(factory) || !isObj(factory.order)) throw new LocalProductionError('prepared_factory_shape')
  let sealed: ReturnType<typeof sealProductOrder>
  try {
    sealed = sealProductOrder(structuredClone(factory.order))
  } catch {
    throw new LocalProductionError('order_seal_failed')
  }
  if (sealed.order_hash !== factory.order_hash) throw new LocalProductionError('order_hash_mismatch')
  if (typeof factory.planning_hash !== 'string' || sealed.order.planning_hash !== factory.planning_hash)
    throw new LocalProductionError('planning_hash_mismatch')
  let spec: LineageSpec
  try {
    spec = canonicalSpec(p.spec)
  } catch {
    throw new LocalProductionError('spec_invalid')
  }
  const d = p.demand as CheckedPrepared['demand']
  if (!isObj(d)) throw new LocalProductionError('prepared_demand_shape')
  const scope = [
    d.role !== PRODUCTION_ROLE && 'demand_role',
    spec.role !== PRODUCTION_ROLE && 'spec_role',
    d.task !== PRODUCTION_TASK && 'demand_task',
    spec.task !== d.task && 'spec_task',
    spec.definition !== d.definition_version && 'definition',
    !(Number.isSafeInteger(d.quantity) && d.quantity >= 1 && d.quantity <= 10) && 'quantity',
    !HASH.test(String(d.signature)) && 'signature',
  ].filter((x): x is string => typeof x === 'string')
  if (scope.length) throw new LocalProductionError('prepared_scope', scope)
  const order = sealed.order
  const items = Array.isArray(factory.item_types) ? (factory.item_types as string[]) : []
  if (canonicalJson([...items].sort()) !== canonicalJson([...order.item_types].sort())) throw new LocalProductionError('item_types_mismatch')
  const policies = [order.source_policy_hash, order.rights_policy_hash, order.adaptation_policy_hash, order.benchmark_contract_hash, order.evidence_policy_hash, order.trust_policy_hash]
  return {
    demand: { demand_id: d.demand_id, line_id: d.line_id, line_no: d.line_no, signature: d.signature, definition_version: d.definition_version, goal_version_id: d.goal_version_id, plan_version: d.plan_version, role: d.role, task: d.task, quantity: d.quantity },
    spec,
    order: { product_order_id: order.product_order_id, order_revision: order.order_revision, product_family: order.product_family, item_types: [...order.item_types], planning_hash: order.planning_hash ?? null },
    order_hash: sealed.order_hash,
    planning_hash: factory.planning_hash,
    blockers: Array.isArray(p.blockers) ? (p.blockers as unknown[]).filter((b): b is string => typeof b === 'string') : [],
    policy_hashes_synthetic: policies.some(syntheticHash),
  }
}

// ── 입력 2: 원천 snapshot ─────────────────────────────────────────────────
export interface SourceSnapshot {
  snapshot_kind: string
  current_time: string
  row: Record<string, unknown>
  limitation?: string
}

/** source_digest 에 들어가는 결속 값 전체(본문 hash · 상태 · 권리 · 게이트 · 분석 · 재고 사실 has_items). FAST 재사용 비교도 이 값을 쓴다 */
export function sourceBindingFacts(row: Record<string, unknown>) {
  return {
    id: row.id, title: row.title, status: row.status, source: row.source ?? null, source_url: row.source_url ?? null,
    license: row.license ?? null, license_class: row.license_class ?? null, copyright_safe_in_kr: row.copyright_safe_in_kr ?? null,
    display_only: row.display_only ?? null, gate: row.gate ?? null, windows: row.windows ?? null, has_items: row.has_items ?? null,
    analysis: { article_v_level: row.article_v_level ?? null, word_count: row.word_count ?? null, register: row.register ?? null, cefr_level: row.cefr_level ?? null, syntax_score: row.syntax_score ?? null },
    content_sha256: sha(String(row.content)),
  }
}

/** 원천 결속 — 본문 · 상태 · 권리 · 게이트 · 분석 값에 묶인 digest. 원문 literal `\n` 은 원본 hash 를 유지하고 정규화 hash 를 따로 둔다 */
export function checkSource(snapshot: unknown) {
  if (!isObj(snapshot) || snapshot.snapshot_kind !== 'read_only_database_export' || !isObj(snapshot.row) || !str(snapshot.current_time))
    throw new LocalProductionError('source_snapshot_shape')
  const row = snapshot.row
  if (!str(row.id) || !str(row.content, 20) || !str(row.title)) throw new LocalProductionError('source_row_shape')
  const content = row.content as string
  if (EMAIL.test(content) || EMAIL.test(String(row.title))) throw new LocalProductionError('source_personal_identifier')
  const eligibility = evaluateSource(sourceEligibilityInput(row, row.has_items === true), 'textbook')
  if (eligibility.status !== 'eligible')
    throw new LocalProductionError(`source_${eligibility.status}`, eligibility.blockers.length ? eligibility.blockers : eligibility.reasons)
  const literal = content.includes('\\n')
  const display = literal ? content.replace(/\\n/g, '\n') : content
  const bound = sourceBindingFacts(row)
  return {
    id: row.id as string,
    title: row.title as string,
    content,
    display_content: display,
    content_sha256: bound.content_sha256,
    display_sha256: sha(display),
    normalization: literal ? ['literal_backslash_n_to_newline'] : [],
    source_digest: digest(bound),
    observed_at: snapshot.current_time as string,
    eligibility: { status: eligibility.status, grade: eligibility.grade, reasons: [...eligibility.reasons], warnings: [...eligibility.warnings], spec_version: eligibility.specVersion, source_quality: eligibility.sourceQuality },
    limits: [
      'source_metadata_is_observation_not_rights_grant',
      'no_import_time_live_requery',
      ...(snapshot.limitation ? [`snapshot:${String(snapshot.limitation)}`] : []),
    ],
  }
}

// ── 입력 3: 제작 요청 ─────────────────────────────────────────────────────
export interface ProductionRequest {
  schema: typeof REQUEST_SCHEMA
  role: string
  task: string
  quantity: number
  item_types: string[]
}

export function checkRequest(value: unknown, prepared: CheckedPrepared): ProductionRequest {
  if (!isObj(value) || !strictKeys(value, ['schema', 'role', 'task', 'quantity', 'item_types']) || value.schema !== REQUEST_SCHEMA)
    throw new LocalProductionError('request_shape')
  const r = value as unknown as ProductionRequest
  const types = Array.isArray(r.item_types) ? r.item_types : []
  const err = [
    r.role !== prepared.demand.role && 'role',
    r.task !== prepared.demand.task && 'task',
    r.quantity !== prepared.demand.quantity && 'quantity',
    (!types.length || new Set(types).size !== types.length) && 'item_types',
    types.some((t) => !prepared.order.item_types.includes(t)) && 'item_type_outside_order',
  ].filter((x): x is string => typeof x === 'string')
  if (err.length) throw new LocalProductionError('request_mismatch', err)
  return { schema: REQUEST_SCHEMA, role: r.role, task: r.task, quantity: r.quantity, item_types: [...types] }
}

// ── 기존 계약과 비교 가능한 FactoryRequest ─────────────────────────────────
/** 1A 응답에서 FactoryRequest 를 만든다. workspaceId 는 공용 산출물에 개인 id 를 넣지 않으려고 null. guided_practice 는 repair 단계에서만 나온다(demand.ts STAGE_ROLES) */
export function factoryRequestFor(p: CheckedPrepared): FactoryRequest {
  const r: FactoryRequest = {
    schema: FACTORY_REQUEST_SCHEMA,
    requestId: '',
    idempotencyKey: `${p.demand.signature}:${p.demand.line_no}`,
    demandKey: p.demand.demand_id,
    workspaceId: null,
    versions: { goal: p.demand.goal_version_id, plan: p.demand.plan_version, definition: p.demand.definition_version },
    task: p.demand.task,
    supportTasks: [],
    role: PRODUCTION_ROLE,
    lineNo: p.demand.line_no,
    education: { ...ROLE_SPEC[PRODUCTION_ROLE], reason: 'stage_repair' },
    content: { csatTypes: [...p.spec.types], factoryTypes: [...p.order.item_types] },
    quantity: { n: p.demand.quantity, unit: '문항', basis: 'plan_stage_quantity' },
    source: { rightsUsable: true, excludeUnsupportedExams: true },
    constraints: { gold: false, unseenByLearner: false, noExplanationBefore: false, versionBinding: 'exact_revision' },
    postReview: ['unit_mismatch', 'item_level_rights', 'task_fit_review', 'workspace_runner'],
    reuseAllowed: true,
    productionUnit: { support: 'convertible_to_volume', why: 'local_production_1b', commands: [] },
    connection: 'MOCK_ONLY',
    approvalsNeeded: ['bulk_generation_cost', 'db_schema_orders', 'content_release'],
  }
  r.requestId = sha(requestBody(r)).slice(0, 32)
  return r
}

// ── export: 작업 패킷 ─────────────────────────────────────────────────────
export const WRITING_INSTRUCTIONS = [
  '역할은 guided_practice(지도 연습) — 힌트 · 해설 허용, 독립 수행 · 평가로 세지 않는다.',
  'TASK r.central_meaning: 글 전체의 중심 의미(주제 · 제목 · 요지)를 고르는 문항.',
  'request.quantity 만큼 서로 다른 문항을 쓴다. type 은 request.item_types 중에서, id 는 소문자 · 숫자 · 하이픈 3~64자, 서로 달라야 한다.',
  '발문(stem)은 한국어, 선지 5개(key 1~5)는 서로 다른 문장. answer 는 그 key 중 하나.',
  'evidence_quotes 는 source.content 에 글자 그대로 있는 구절(8자 이상)만. 지어낸 인용은 거절된다.',
  'explanation.observation 은 근거 구절과 그 구절이 글에서 하는 일(관찰), explanation.interpretation 은 그래서 정답이 되는 이유와 오답 이유(해석). 둘을 섞지 않는다.',
  '빈 값 · 추측 채움 · TODO · placeholder 금지. 문항을 쓰지 못하면 출력 파일을 만들지 않는다.',
] as const

export interface ProductionPacket {
  schema: typeof PACKET_SCHEMA
  task_id: string
  packet_hash: string
  body: {
    synthetic_demand: boolean
    request_id: string
    order: CheckedPrepared['order'] & { order_hash: string; planning_hash: string }
    demand: CheckedPrepared['demand']
    spec: LineageSpec
    request: ProductionRequest
    source: Omit<ReturnType<typeof checkSource>, 'display_content'> & { display_content: string }
    instructions: readonly string[]
    limits: string[]
  }
  /** 비의미 필드 — packet_hash · task_id 에 들어가지 않는다 */
  meta: { run_id: string; exported_at: string }
}

export function buildPacket(input: { prepared: PreparedDraftInput; snapshot: unknown; request: unknown }, meta: { runId: string; now: string }): ProductionPacket {
  if (!isObj(input.prepared) || typeof input.prepared.synthetic_demand !== 'boolean') throw new LocalProductionError('prepared_wrapper')
  const prepared = checkPrepared(input.prepared.prepared)
  const source = checkSource(input.snapshot)
  const request = checkRequest(input.request, prepared)
  const req = factoryRequestFor(prepared)
  const limits = [
    'review_pending_internal_candidate',
    'not_registered_not_published_not_delivered',
    'policy_authenticity_unverified',
    'rights_unverified',
    'crosswalk_candidate_unvalidated',
    ...(prepared.policy_hashes_synthetic ? ['synthetic_policy_hash_not_policy_approval'] : []),
    ...(input.prepared.synthetic_demand ? ['synthetic_demand_smoke'] : []),
    ...source.limits,
  ]
  const body: ProductionPacket['body'] = {
    synthetic_demand: input.prepared.synthetic_demand,
    request_id: req.requestId,
    order: { ...prepared.order, order_hash: prepared.order_hash, planning_hash: prepared.planning_hash },
    demand: prepared.demand,
    spec: prepared.spec,
    request,
    source,
    instructions: WRITING_INSTRUCTIONS,
    limits,
  }
  const packetHash = digest(body)
  return { schema: PACKET_SCHEMA, task_id: `LP-${packetHash.slice(0, 24)}`, packet_hash: packetHash, body, meta: { run_id: meta.runId, exported_at: meta.now } }
}

/** 패킷 자체 무결성 — 파일에서 다시 읽은 본문의 hash · id */
export function checkPacketIntegrity(packet: unknown): ProductionPacket {
  if (!isObj(packet) || packet.schema !== PACKET_SCHEMA || !isObj(packet.body)) throw new LocalProductionError('packet_shape')
  const p = packet as unknown as ProductionPacket
  const h = digest(p.body)
  if (h !== p.packet_hash || p.task_id !== `LP-${h.slice(0, 24)}`) throw new LocalProductionError('packet_hash_mismatch')
  return p
}

// ── import: 출력 검증 ─────────────────────────────────────────────────────
export interface AuthoredItem {
  id: string
  type: string
  stem: string
  choices: { key: string; text: string }[]
  answer: string
  evidence_quotes: string[]
  explanation: { observation: string; interpretation: string }
}
export interface ProductionOutput {
  schema: typeof OUTPUT_SCHEMA
  task_id: string
  packet_hash: string
  request_id: string
  order_hash: string
  order_revision: number
  source_digest: string
  role: string
  task: string
  quantity: number
  author: { agent: string; model: string; method: string }
  items: AuthoredItem[]
}

const OUTPUT_KEYS = ['schema', 'task_id', 'packet_hash', 'request_id', 'order_hash', 'order_revision', 'source_digest', 'role', 'task', 'quantity', 'author', 'items'] as const
const ITEM_KEYS = ['id', 'type', 'stem', 'choices', 'answer', 'evidence_quotes', 'explanation'] as const

/** 출력 하나하나를 패킷에 대고 다시 잰다. 오류 목록이 비어야 통과 */
export function validateOutput(packet: ProductionPacket, output: unknown): string[] {
  const e: string[] = []
  if (!isObj(output) || !strictKeys(output, OUTPUT_KEYS) || output.schema !== OUTPUT_SCHEMA) return ['output_shape']
  const o = output as unknown as ProductionOutput
  const b = packet.body
  if (o.task_id !== packet.task_id) e.push('task_id_mismatch')
  if (o.packet_hash !== packet.packet_hash) e.push('packet_hash_mismatch')
  if (o.request_id !== b.request_id) e.push('request_id_mismatch')
  if (o.order_hash !== b.order.order_hash) e.push('order_hash_mismatch')
  if (o.order_revision !== b.order.order_revision) e.push('order_revision_mismatch')
  if (o.source_digest !== b.source.source_digest) e.push('source_digest_mismatch')
  if (o.role !== b.request.role) e.push('role_mismatch')
  if (o.task !== b.request.task) e.push('task_mismatch')
  if (o.quantity !== b.request.quantity) e.push('quantity_mismatch')
  if (!isObj(o.author) || !str(o.author.agent) || !str(o.author.model) || !str(o.author.method)) e.push('author_missing')
  if (!Array.isArray(o.items)) return [...e, 'items_shape']
  if (o.items.length !== b.request.quantity) e.push('item_count_mismatch')
  const ids = new Set<string>()
  const stems = new Set<string>()
  const content = b.source.content
  o.items.forEach((raw, i) => {
    const at = `item[${i}]`
    if (!isObj(raw) || !strictKeys(raw, ITEM_KEYS)) return void e.push(`${at}:shape`)
    const it = raw as unknown as AuthoredItem
    if (typeof it.id !== 'string' || !ITEM_ID.test(it.id)) e.push(`${at}:id`)
    else if (ids.has(it.id)) e.push(`${at}:duplicate_id`)
    else ids.add(it.id)
    if (!b.request.item_types.includes(it.type)) e.push(`${at}:type_not_allowed`)
    if (!str(it.stem, 10)) e.push(`${at}:stem`)
    else if (stems.has(it.stem.trim())) e.push(`${at}:duplicate_stem`)
    else stems.add(it.stem.trim())
    const choices = Array.isArray(it.choices) ? it.choices : []
    if (choices.length !== CHOICE_KEYS.length || choices.some((c, k) => !isObj(c) || !strictKeys(c, ['key', 'text']) || c.key !== CHOICE_KEYS[k] || !str(c.text, 2)))
      e.push(`${at}:choices`)
    else if (new Set(choices.map((c) => c.text.trim().toLowerCase())).size !== choices.length) e.push(`${at}:duplicate_choice`)
    if (!choices.some((c) => isObj(c) && c.key === it.answer)) e.push(`${at}:answer_not_in_choices`)
    const quotes = Array.isArray(it.evidence_quotes) ? it.evidence_quotes : []
    if (!quotes.length) e.push(`${at}:evidence_missing`)
    quotes.forEach((q, k) => {
      if (typeof q !== 'string' || q.trim().length < 8) e.push(`${at}:evidence[${k}]:short`)
      else if (!content.includes(q)) e.push(`${at}:evidence[${k}]:not_in_source`)
    })
    const ex = it.explanation
    if (!isObj(ex) || !strictKeys(ex, ['observation', 'interpretation']) || !str(ex.observation, 20) || !str(ex.interpretation, 20)) e.push(`${at}:explanation`)
    else if (ex.observation.trim() === ex.interpretation.trim()) e.push(`${at}:explanation_not_separated`)
    const texts = [it.stem, it.explanation?.observation, it.explanation?.interpretation, ...choices.map((c) => (isObj(c) ? c.text : ''))]
    if (texts.some((t) => typeof t === 'string' && PLACEHOLDER.test(t))) e.push(`${at}:placeholder`)
    if (texts.some((t) => typeof t === 'string' && EMAIL.test(t))) e.push(`${at}:personal_identifier`)
  })
  return e
}

// ── 조판 · 자료 · manifest ────────────────────────────────────────────────
export const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;')

/** 학습지 HTML — 원문 · 발문 · 선지만(정답 · 해설 없음). 스크립트 · 외부 자원 없음, 모든 문자열 escape */
export function renderSheet(packet: ProductionPacket, output: ProductionOutput): string {
  const b = packet.body
  const paras = b.source.display_content.split(/\n{2,}/).map((p) => `<p>${escapeHtml(p.trim())}</p>`).join('\n')
  const items = output.items.map((it, i) => [
    `<section class="item" data-item-id="${escapeHtml(it.id)}" data-type="${escapeHtml(it.type)}">`,
    `<h3>${i + 1}. ${escapeHtml(it.stem)}</h3>`,
    '<ol class="choices">',
    ...it.choices.map((c) => `<li data-key="${escapeHtml(c.key)}">${escapeHtml(c.text)}</li>`),
    '</ol>',
    '</section>',
  ].join('\n')).join('\n')
  return [
    '<!doctype html>',
    '<html lang="ko"><head><meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">`,
    `<title>${escapeHtml(b.source.title)} — 내부 검수 후보</title>`,
    '<style>body{font-family:serif;max-width:46rem;margin:2rem auto;line-height:1.6;word-break:keep-all}.note{border:1px solid #888;padding:.5rem}</style>',
    '</head><body>',
    `<p class="note">내부 검수 후보(review_pending · test_fixture). 등록 · 발행 · 납품 · 공개 학습 화면이 아니다. task ${escapeHtml(packet.task_id)}</p>`,
    `<h1>${escapeHtml(b.source.title)}</h1>`,
    `<article class="passage">\n${paras}\n</article>`,
    `<h2>지도 연습 — 중심 의미</h2>`,
    items,
    '</body></html>',
    '',
  ].join('\n')
}

export const itemDigest = (it: AuthoredItem) => digest(it)

export function buildMaterials(packet: ProductionPacket, output: ProductionOutput) {
  return {
    schema: MATERIALS_SCHEMA,
    task_id: packet.task_id,
    packet_hash: packet.packet_hash,
    request_id: packet.body.request_id,
    order: { product_order_id: packet.body.order.product_order_id, order_revision: packet.body.order.order_revision, order_hash: packet.body.order.order_hash, planning_hash: packet.body.order.planning_hash },
    source: { id: packet.body.source.id, content_sha256: packet.body.source.content_sha256, display_sha256: packet.body.source.display_sha256, source_digest: packet.body.source.source_digest, normalization: packet.body.source.normalization },
    role: output.role,
    task: output.task,
    author: output.author,
    items: output.items.map((it) => ({ ...it, sha256: itemDigest(it) })),
    exposure: 'internal_review_only_not_public_learning_screen',
  }
}

export interface ExecutionReceiptInput {
  runId: string
  startedAt: string
  command: string[]
  node: string
}

/**
 * 파일 bytes 가 정해진 뒤 manifest 를 만든다. execution 이 없으면 MOCK(실행 기록 없음) — REAL 은 실제 로컬 실행 영수증이 있을 때만.
 * 산출물 = 실제 작성 · 검증된 문항(textbook_activity) 수. lifecycle 은 언제나 test_fixture(전환 승인 없음).
 */
export function buildManifestRecord(
  packet: ProductionPacket,
  output: ProductionOutput,
  files: { name: string; bytes: Uint8Array }[],
  execution: ExecutionReceiptInput | null,
) {
  const req = factoryRequestFor({ demand: packet.body.demand, spec: packet.body.spec, order: packet.body.order, order_hash: packet.body.order.order_hash, planning_hash: packet.body.order.planning_hash, blockers: [], policy_hashes_synthetic: false })
  if (req.requestId !== packet.body.request_id) throw new LocalProductionError('request_id_mismatch')
  const mock = execution === null
  const runId = execution?.runId ?? null
  const artifacts: ManifestArtifact[] = output.items.map((it) => {
    const h = itemDigest(it)
    return {
      id: `${packet.task_id}:${it.id}`,
      kind: 'textbook_activity',
      revision: `sha256:${h}`,
      sha256: h,
      refs: { source: `library_articles:${packet.body.source.id}@${packet.body.source.content_sha256}`, analysis: null, gold: null },
      contentType: it.type,
      tasks: [output.task],
      roleCandidates: [PRODUCTION_ROLE],
      access: `local:${packet.task_id}/materials.json#${it.id}`,
      rights: 'unknown',
      quality: 'unreviewed',
      provenance: { runId, mock },
      lifecycle: 'test_fixture',
    }
  })
  const manifest: FactoryResultManifest = {
    schema: FACTORY_MANIFEST_SCHEMA,
    requestId: req.requestId,
    mode: mock ? 'MOCK' : 'REAL',
    status: 'review_pending',
    runId,
    producedCount: artifacts.length,
    artifacts,
    failure: null,
    factory: { ...FACTORY_ID },
  }
  const errors = validateManifest(manifest, req)
  if (errors.length) throw new LocalProductionError('manifest_invalid', errors)
  return {
    schema: 'vf.local-production-manifest-record/1' as const,
    manifest,
    files: files.map((f) => ({ name: f.name, bytes: f.bytes.byteLength, sha256: sha(f.bytes) })),
    lineage: { task_id: packet.task_id, packet_hash: packet.packet_hash, order_hash: packet.body.order.order_hash, planning_hash: packet.body.order.planning_hash, source_digest: packet.body.source.source_digest, demand_signature: packet.body.demand.signature },
    claims: {
      public_fit: 'not_claimed',
      registrable: false,
      production_ready: false,
      released: false,
      delivered: false,
      synthetic_demand: packet.body.synthetic_demand,
      receipt_is_not_db_run_ledger: true,
    },
    limits: packet.body.limits,
  }
}

export const sha256Hex = sha
export const canonicalDigest = digest
