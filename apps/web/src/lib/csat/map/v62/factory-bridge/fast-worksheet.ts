// apps/web/src/lib/csat/map/v62/factory-bridge/fast-worksheet.ts
//
// 단계 3 — FAST 빠른 학습지: 기존 1B 제작 팩(패킷 + 출력 + 원천 snapshot) 하나를 골라 순서 · 발문 · 선지를 고치고,
// 새 바이트에 대한 신규 AI 검수를 받은 뒤 학생용 문제지 · 교사용 해설지 · manifest 를 만든다. 순수 함수(파일 · DB · 시계 없음).
// 불변식:
//   · 1B/1C 검증을 그대로 다시 돈다: checkPacketIntegrity · validateOutput · checkSource(→ evaluateSource) · checkReview.
//   · 범위는 원래 팩 전체(같은 문항 id 집합 · 같은 수량). 수량 · 원문 · 정책 · 역할 · TASK · 주문은 편집 대상이 아니다.
//   · 편집하면 출력 바이트가 바뀌고, 옛 바이트의 검수는 상속되지 않는다(output_sha256 · 문항 hash 결속).
//   · 원천: 묶음의 원본 snapshot 이 패킷 digest 를 재현해야 하고, 현재 행은 지금 다시 판정한다.
//     차이가 has_items(재고 사실)뿐이면 재사용하되 두 관측을 그대로 남긴다. 본문 · 권리 · 게이트 · 분석 등 다른 값이 바뀌면 거절.
//     (1C 입고의 엄격한 source_digest 일치 규칙은 바꾸지 않는다 — 이 완화는 FAST 로컬 파일 출력에만.)
//   · 결과는 로컬 검수 초안 후보다. F(권리)는 AI 가 pass 로 만들 수 없고, FQ 자격 · 등록 · 출시 · 납품을 주장하지 않는다.

import { canonicalJson } from '../canonical-json'
import { AI_REVIEW_SCHEMA, GUIDED_REQUIRED, checkReview, type CheckedReview } from './dcp-admission'
import {
  CHOICE_KEYS,
  LocalProductionError,
  buildManifestRecord,
  checkPacketIntegrity,
  checkSource,
  escapeHtml,
  itemDigest,
  renderSheet,
  sha256Hex,
  sourceBindingFacts,
  validateOutput,
  type AuthoredItem,
  type ExecutionReceiptInput,
  type ProductionOutput,
  type ProductionPacket,
} from './local-production'

export const FAST_BUNDLE_SCHEMA = 'vf.fast-worksheet-bundle/1' as const
export const FAST_REVIEW_REQUEST_SCHEMA = 'vf.fast-review-request/1' as const
export const FAST_MANIFEST_SCHEMA = 'vf.fast-worksheet-manifest/1' as const
/** 지원 범위 — 한 원천의 guided_practice × r.central_meaning 팩 전체(원래 수량 그대로) */
export const FAST_SCOPE = { role: 'guided_practice', task: 'r.central_meaning', types: ['topic', 'title', 'main_point'], unit: 'full_pack' } as const

const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const keysExactly = (o: Record<string, unknown>, allowed: readonly string[], required: readonly string[] = allowed) =>
  Object.keys(o).every((k) => allowed.includes(k)) && required.every((k) => k in o)
/** 출력 직렬화 — CLI · API · 브라우저가 같은 바이트를 만든다(들여쓰기 2 + 끝 줄바꿈) */
export const serializeOutput = (o: ProductionOutput) => `${JSON.stringify(o, null, 2)}\n`
export const outputSha256 = (o: ProductionOutput) => sha256Hex(serializeOutput(o))

// ── 묶음 ─────────────────────────────────────────────────────────────────
export interface FastItemEdit {
  stem?: string
  choices?: string[]
}
export interface FastEdit {
  /** 원래 문항 id 전부의 새 순서 */
  order: string[]
  items: Record<string, FastItemEdit>
  /** 편집한 주체 — 원 작성자(output.author)와 구별한다. AI 가 아니면 session 은 null */
  editor: { kind: 'ai' | 'human'; agent: string; session: string | null; note: string }
}
export interface FastBundle {
  schema: typeof FAST_BUNDLE_SCHEMA
  packet: unknown
  base_output: unknown
  source_snapshot: unknown
  edit: FastEdit | null
  review: unknown
}

const BUNDLE_KEYS = ['schema', 'packet', 'base_output', 'source_snapshot', 'edit', 'review'] as const

/** 닫힌 모양 — 모르는 키 · 금지 필드(quantity · answer · source 등)는 편집 단계에서 거절한다 */
export function parseBundle(v: unknown): FastBundle {
  if (!isObj(v) || !keysExactly(v, BUNDLE_KEYS) || v.schema !== FAST_BUNDLE_SCHEMA) throw new LocalProductionError('bundle_shape')
  if (!isObj(v.packet) || !isObj(v.base_output) || !isObj(v.source_snapshot)) throw new LocalProductionError('bundle_shape')
  if (v.review !== null && !isObj(v.review)) throw new LocalProductionError('bundle_review_shape')
  return { schema: FAST_BUNDLE_SCHEMA, packet: v.packet, base_output: v.base_output, source_snapshot: v.source_snapshot, edit: v.edit === null ? null : parseEdit(v.edit), review: v.review }
}

function parseEdit(v: unknown): FastEdit {
  if (!isObj(v) || !keysExactly(v, ['order', 'items', 'editor'])) throw new LocalProductionError('edit_shape')
  const e = v.editor
  if (!isObj(e) || !keysExactly(e, ['kind', 'agent', 'session', 'note']) || (e.kind !== 'ai' && e.kind !== 'human') || typeof e.agent !== 'string' || !e.agent.trim() || typeof e.note !== 'string')
    throw new LocalProductionError('edit_editor')
  if (e.kind === 'ai' ? typeof e.session !== 'string' || !e.session.trim() : e.session !== null) throw new LocalProductionError('edit_editor_session')
  if (!Array.isArray(v.order) || v.order.some((x) => typeof x !== 'string')) throw new LocalProductionError('edit_order')
  if (!isObj(v.items)) throw new LocalProductionError('edit_items')
  const items: Record<string, FastItemEdit> = {}
  for (const [id, raw] of Object.entries(v.items)) {
    if (!isObj(raw) || !keysExactly(raw, ['stem', 'choices'], [])) throw new LocalProductionError('edit_forbidden_field', [id, ...(isObj(raw) ? Object.keys(raw).filter((k) => k !== 'stem' && k !== 'choices') : [])])
    if (raw.stem !== undefined && typeof raw.stem !== 'string') throw new LocalProductionError('edit_stem', [id])
    if (raw.choices !== undefined && (!Array.isArray(raw.choices) || raw.choices.length !== CHOICE_KEYS.length || raw.choices.some((c) => typeof c !== 'string')))
      throw new LocalProductionError('edit_choices', [id])
    items[id] = { ...(raw.stem !== undefined ? { stem: raw.stem as string } : {}), ...(raw.choices !== undefined ? { choices: [...(raw.choices as string[])] } : {}) }
  }
  return { order: [...(v.order as string[])], items, editor: { kind: e.kind, agent: e.agent.trim(), session: e.kind === 'ai' ? (e.session as string).trim() : null, note: e.note } }
}

// ── 원천 경계 ─────────────────────────────────────────────────────────────
export type SourceDrift = 'none' | 'has_items_only'
export interface SourceCheck {
  drift: SourceDrift
  original_digest: string
  current_digest: string
  observations: { original: { observed_at: string; has_items: unknown }; current: { observed_at: string; has_items: unknown } }
  eligibility: string
}

function checkSourceBoundary(packet: ProductionPacket, snapshot: unknown, current: unknown): SourceCheck {
  const orig = checkSource(snapshot)
  if (orig.source_digest !== packet.body.source.source_digest) throw new LocalProductionError('source_snapshot_not_packet_source')
  if (current == null) throw new LocalProductionError('source_current_missing')
  const now = checkSource(current) // 지금 다시 판정 — eligible 이 아니면 여기서 던진다
  const origRow = (snapshot as { row: Record<string, unknown> }).row
  const nowRow = (current as { row: Record<string, unknown> }).row
  let drift: SourceDrift = 'none'
  if (now.source_digest !== orig.source_digest) {
    const a = sourceBindingFacts(origRow) as Record<string, unknown>
    const b = sourceBindingFacts(nowRow) as Record<string, unknown>
    const changed = Object.keys(a).filter((k) => canonicalJson(a[k]) !== canonicalJson(b[k]))
    if (changed.some((k) => k !== 'has_items')) throw new LocalProductionError('source_changed', changed.filter((k) => k !== 'has_items'))
    drift = 'has_items_only'
  }
  return {
    drift,
    original_digest: orig.source_digest,
    current_digest: now.source_digest,
    observations: { original: { observed_at: orig.observed_at, has_items: origRow.has_items ?? null }, current: { observed_at: now.observed_at, has_items: nowRow.has_items ?? null } },
    eligibility: now.eligibility.status,
  }
}

// ── 편집 적용 ─────────────────────────────────────────────────────────────
export interface FastDiff {
  reordered: boolean
  from_order: string[]
  to_order: string[]
  fields: { item_id: string; field: 'stem' | `choice_${string}`; before: string; after: string }[]
}

function applyEdit(base: ProductionOutput, edit: FastEdit | null): { output: ProductionOutput; diff: FastDiff } {
  const fromOrder = base.items.map((i) => i.id)
  if (!edit) return { output: base, diff: { reordered: false, from_order: fromOrder, to_order: fromOrder, fields: [] } }
  const byId = new Map(base.items.map((i) => [i.id, i]))
  if (edit.order.length !== base.items.length) throw new LocalProductionError('quantity_change_requires_new_order', [`base=${base.items.length}`, `edit=${edit.order.length}`])
  if (new Set(edit.order).size !== edit.order.length || edit.order.some((id) => !byId.has(id))) throw new LocalProductionError('edit_order_not_full_pack')
  const unknown = Object.keys(edit.items).filter((id) => !byId.has(id))
  if (unknown.length) throw new LocalProductionError('edit_unknown_item', unknown)
  const fields: FastDiff['fields'] = []
  const items: AuthoredItem[] = edit.order.map((id) => {
    const it = byId.get(id)!
    const e = edit.items[id]
    if (!e) return it
    const next: AuthoredItem = { ...it, choices: it.choices.map((c) => ({ ...c })), evidence_quotes: [...it.evidence_quotes], explanation: { ...it.explanation } }
    if (e.stem !== undefined && e.stem !== it.stem) {
      fields.push({ item_id: id, field: 'stem', before: it.stem, after: e.stem })
      next.stem = e.stem
    }
    e.choices?.forEach((text, k) => {
      if (text !== it.choices[k]!.text) {
        fields.push({ item_id: id, field: `choice_${CHOICE_KEYS[k]}`, before: it.choices[k]!.text, after: text })
        next.choices[k] = { key: CHOICE_KEYS[k]!, text }
      }
    })
    return next
  })
  const toOrder = items.map((i) => i.id)
  return { output: { ...base, items }, diff: { reordered: toOrder.join() !== fromOrder.join(), from_order: fromOrder, to_order: toOrder, fields } }
}

// ── 검수 대상 · 판정 ──────────────────────────────────────────────────────
export interface FastReviewTarget {
  source_digest: string
  output_sha256: string
  order_hash: string
  packet_hash: string
  role: string
  task: string
  items: { item_id: string; item_sha256: string }[]
}

export type FastReviewState =
  | { status: 'review_required'; reason: 'no_review' }
  | { status: 'review_rejected'; code: string; detail: string[] }
  | { status: 'review_not_pass'; conclusion: string; model: string; session: string }
  | { status: 'reviewed'; review: CheckedReview; held_axes: string[] }

function judgeReview(review: unknown, target: FastReviewTarget, sourceId: string): FastReviewState {
  if (review == null) return { status: 'review_required', reason: 'no_review' }
  if (!isObj(review) || review.schema !== AI_REVIEW_SCHEMA) return { status: 'review_rejected', code: 'review_schema_not_fast', detail: [] }
  let r: CheckedReview
  try {
    r = checkReview(review, { ...target, items: new Map(target.items.map((i) => [i.item_id, i.item_sha256])), source_id: sourceId })
  } catch (e) {
    if (e instanceof LocalProductionError) return { status: 'review_rejected', code: e.code, detail: e.detail }
    throw e
  }
  const missing = target.items.filter((i) => !r.items.has(i.item_id)).map((i) => i.item_id)
  if (missing.length) return { status: 'review_rejected', code: 'review_items_incomplete', detail: missing }
  if (r.conclusion !== 'pass') return { status: 'review_not_pass', conclusion: r.conclusion, model: r.model, session: r.session }
  const contentHeld = (['B', 'C', 'D'] as const).filter((axis) => r.axes[axis]?.state !== 'pass')
  if (contentHeld.length) return { status: 'review_rejected', code: 'review_content_axis_not_pass', detail: contentHeld }
  const held = GUIDED_REQUIRED.filter((k) => r.axes[k]?.state !== 'pass')
  return { status: 'reviewed', review: r, held_axes: held }
}

// ── 전체 판정 ─────────────────────────────────────────────────────────────
export interface FastState {
  packet: ProductionPacket
  base_output: ProductionOutput
  output: ProductionOutput
  output_bytes: string
  output_sha256: string
  base_output_sha256: string
  diff: FastDiff
  edit: FastEdit | null
  source: SourceCheck
  target: FastReviewTarget
  review: FastReviewState
}

/** 묶음 + 지금 읽은 원천 → 상태. 검증 거절은 LocalProductionError 로 던진다(부분 결과를 만들지 않는다) */
export function evaluateFast(bundleValue: unknown, currentSource: unknown): FastState {
  const bundle = parseBundle(bundleValue)
  const packet = checkPacketIntegrity(bundle.packet)
  const b = packet.body
  if (b.request.role !== FAST_SCOPE.role || b.request.task !== FAST_SCOPE.task || b.request.item_types.some((t) => !(FAST_SCOPE.types as readonly string[]).includes(t)))
    throw new LocalProductionError('fast_scope_unsupported', [b.request.role, b.request.task, ...b.request.item_types])
  const baseErrors = validateOutput(packet, bundle.base_output)
  if (baseErrors.length) throw new LocalProductionError('base_output_invalid', baseErrors)
  const base = bundle.base_output as ProductionOutput
  const source = checkSourceBoundary(packet, bundle.source_snapshot, currentSource)
  const { output, diff } = applyEdit(base, bundle.edit)
  const errors = validateOutput(packet, output)
  if (errors.length) throw new LocalProductionError('edited_output_invalid', errors)
  const output_bytes = serializeOutput(output)
  const sha = sha256Hex(output_bytes)
  const target: FastReviewTarget = {
    source_digest: b.source.source_digest,
    output_sha256: sha,
    order_hash: b.order.order_hash,
    packet_hash: packet.packet_hash,
    role: b.request.role,
    task: b.request.task,
    items: output.items.map((it) => ({ item_id: it.id, item_sha256: itemDigest(it) })),
  }
  return { packet, base_output: base, output, output_bytes, output_sha256: sha, base_output_sha256: outputSha256(base), diff, edit: bundle.edit, source, target, review: judgeReview(bundle.review, target, b.source.id) }
}

// ── 신규 세션 검수 요청 ───────────────────────────────────────────────────
export const REVIEW_INSTRUCTIONS = [
  '이 요청은 새 세션에서 처음 읽는다. 이전 검수 · 편집 대화를 이어받지 않는다.',
  'target 블록을 그대로 복사해 응답 target 에 넣는다(바이트 결속). 문항 하나라도 바뀌면 이 검수는 무효다.',
  '축 A~H 마다 state(pass|fail|unknown|not_applicable)와 근거(8자 이상)를 쓴다. 근거 없는 pass 는 거절된다.',
  'F(권리)는 AI 가 pass 로 만들 수 없다 — unknown 으로 둔다. 원천 라이선스 표시는 관측이지 권리 부여가 아니다.',
  'B·C: 정답이 원문으로 유일하게 지지되는지, 오답이 원문과 실제로 어긋나는지, 근거 인용이 원문에 글자 그대로 있는지 확인한다.',
  'D: 편집(순서 · 발문 · 선지)이 유형 · 정답 · 해설과 여전히 맞는지 확인한다. 해설 문구가 바뀐 발문과 어긋나면 적는다.',
  'conclusion 은 내용 결함이 없을 때만 pass. 응답은 response_template 모양의 JSON 하나만.',
] as const

export function reviewRequest(s: FastState) {
  const b = s.packet.body
  return {
    schema: FAST_REVIEW_REQUEST_SCHEMA,
    target: s.target,
    instructions: REVIEW_INSTRUCTIONS,
    scope: { ...FAST_SCOPE, quantity: s.output.items.length, exposure: 'local_review_draft_not_release' },
    source: { id: b.source.id, title: b.source.title, display_content: b.source.display_content, display_sha256: b.source.display_sha256 },
    edit: { editor: s.edit?.editor ?? null, diff: s.diff, base_output_sha256: s.base_output_sha256 },
    output: s.output,
    response_template: {
      schema: AI_REVIEW_SCHEMA,
      kind: 'ai',
      reviewer: { model: 'claude|codex', session: '<new session id>', role: 'independent_fast_content_reviewer' },
      target: s.target,
      conclusion: 'pass|fail|unknown',
      axes: Object.fromEntries(['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'].map((k) => [k, { state: 'pass|fail|unknown|not_applicable', evidence: ['...'] }])),
      evidence: [],
      limitations: [],
    },
  }
}

// ── 조판 ─────────────────────────────────────────────────────────────────
/** 학생용 문제지 — 기존 1B renderSheet 그대로(원문 · 발문 · 선지만, 정답 · 해설 · 검수 원본 없음) */
export const renderStudent = (s: FastState) => renderSheet(s.packet, s.output)

/** 교사용 해설지 — 정답 · 근거 인용 · 관찰/해석 해설. 같은 CSP · escape. 관리자 응답에서만 만든다 */
export function renderTeacher(s: FastState): string {
  const b = s.packet.body
  const items = s.output.items.map((it, i) => [
    `<section class="item" data-item-id="${escapeHtml(it.id)}" data-type="${escapeHtml(it.type)}">`,
    `<h3>${i + 1}. ${escapeHtml(it.stem)}</h3>`,
    '<ol class="choices">',
    ...it.choices.map((c) => `<li data-key="${escapeHtml(c.key)}"${c.key === it.answer ? ' class="answer"' : ''}>${escapeHtml(c.text)}${c.key === it.answer ? ' <strong>(정답)</strong>' : ''}</li>`),
    '</ol>',
    `<p class="answer-line">정답 ${escapeHtml(it.answer)}번</p>`,
    '<ul class="evidence">',
    ...it.evidence_quotes.map((q) => `<li><q>${escapeHtml(q)}</q></li>`),
    '</ul>',
    `<p><b>관찰</b> ${escapeHtml(it.explanation.observation)}</p>`,
    `<p><b>해석</b> ${escapeHtml(it.explanation.interpretation)}</p>`,
    '</section>',
  ].join('\n')).join('\n')
  return [
    '<!doctype html>',
    '<html lang="ko"><head><meta charset="utf-8">',
    `<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'">`,
    `<title>${escapeHtml(b.source.title)} — 교사용 해설(검수 초안)</title>`,
    '<style>body{font-family:serif;max-width:46rem;margin:2rem auto;line-height:1.6;word-break:keep-all}.note{border:1px solid #888;padding:.5rem}.answer{font-weight:700}</style>',
    '</head><body>',
    `<p class="note">교사용 · 로컬 검수 초안(FQ 자격 · 등록 · 출시 아님). output ${escapeHtml(s.output_sha256.slice(0, 16))}</p>`,
    `<h1>${escapeHtml(b.source.title)}</h1>`,
    items,
    '</body></html>',
    '',
  ].join('\n')
}

// ── 내보내기 ─────────────────────────────────────────────────────────────
export interface FastFile {
  name: string
  content: string
}

/** 검수 전: 편집 출력 + 검수 요청만. 검수 통과 뒤: 문제지 · 해설지 · 검수 · manifest 까지. 파일 쓰기는 호출자 */
export function fastFiles(s: FastState, execution: ExecutionReceiptInput | null): FastFile[] {
  const pretty = (v: unknown) => `${JSON.stringify(v, null, 2)}\n`
  const files: FastFile[] = [
    { name: 'edited-output.json', content: s.output_bytes },
    { name: 'review-request.json', content: pretty(reviewRequest(s)) },
  ]
  if (s.review.status !== 'reviewed') return files
  const r = s.review
  const enc = new TextEncoder()
  const student = renderStudent(s)
  const teacher = renderTeacher(s)
  const record = buildManifestRecord(s.packet, s.output, [
    { name: 'student.html', bytes: enc.encode(student) },
    { name: 'teacher.html', bytes: enc.encode(teacher) },
    { name: 'edited-output.json', bytes: enc.encode(s.output_bytes) },
  ], execution)
  const manifest = {
    schema: FAST_MANIFEST_SCHEMA,
    scope: { ...FAST_SCOPE, quantity: s.output.items.length },
    base_output_sha256: s.base_output_sha256,
    edited_output_sha256: s.output_sha256,
    author: s.output.author,
    editor: s.edit?.editor ?? null,
    diff: s.diff,
    review: { model: r.review.model, session: r.review.session, sha256: r.review.sha256, conclusion: r.review.conclusion, axes: Object.fromEntries(Object.entries(r.review.axes).map(([k, a]) => [k, a.state])), limitations: r.review.limitations },
    source: s.source,
    fq: {
      status: r.held_axes.length ? 'held' : 'content_axes_pass',
      held_axes: r.held_axes,
      limits: ['ai_content_review_is_not_full_fq_qualification', 'rights_axis_F_not_grantable_by_ai', 'source_license_is_observation_not_rights_grant'],
    },
    claims: { status: 'local_reviewed_draft_candidate', fq_qualified: false, registered: false, released: false, delivered: false, db_writes: 0 },
    production_record: record,
  }
  return [...files, { name: 'student.html', content: student }, { name: 'teacher.html', content: teacher }, { name: 'review-binding.json', content: pretty(reviewEcho(s)) }, { name: 'manifest.json', content: pretty(manifest) }]
}

/** 가져온 검수 원본은 묶음에 있다 — 내보내기에는 결속 확인 결과만 둔다(원본 재직렬화로 sha 를 바꾸지 않는다) */
function reviewEcho(s: FastState) {
  const r = s.review as Extract<FastReviewState, { status: 'reviewed' }>
  return { schema: 'vf.fast-review-binding/1', review_sha256: r.review.sha256, model: r.review.model, session: r.review.session, target: s.target, conclusion: r.review.conclusion, held_axes: r.held_axes }
}

// ── 화면 DTO ─────────────────────────────────────────────────────────────
/** 관리자 화면용 투영 — 브라우저는 Node crypto · Gold helper 를 import 하지 않고 이 값만 받는다 */
export function fastView(s: FastState) {
  const b = s.packet.body
  return {
    scope: { ...FAST_SCOPE, quantity: s.output.items.length },
    task_id: s.packet.task_id,
    source: { id: b.source.id, title: b.source.title, paragraphs: b.source.display_content.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean), eligibility: s.source.eligibility, drift: s.source.drift, observations: s.source.observations, limits: b.source.limits },
    items: s.output.items.map((it) => ({ id: it.id, type: it.type, stem: it.stem, choices: it.choices, answer: it.answer, evidence_quotes: it.evidence_quotes, explanation: it.explanation })),
    base_order: s.diff.from_order,
    diff: s.diff,
    editor: s.edit?.editor ?? null,
    output_sha256: s.output_sha256,
    base_output_sha256: s.base_output_sha256,
    review: s.review.status === 'reviewed'
      ? { status: 'reviewed' as const, model: s.review.review.model, session: s.review.review.session, held_axes: s.review.held_axes }
      : s.review,
    student_html: s.review.status === 'reviewed' ? renderStudent(s) : null,
    teacher_html: s.review.status === 'reviewed' ? renderTeacher(s) : null,
    limits: [...b.limits],
  }
}
export type FastView = ReturnType<typeof fastView>
