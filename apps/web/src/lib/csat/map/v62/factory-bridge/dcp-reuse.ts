// apps/web/src/lib/csat/map/v62/factory-bridge/dcp-reuse.ts
//
// 1C 보충 — 기존 csat_dcp_items 행을 **그대로** 재사용하는 명시적 입고 계획. 순수 함수(파일 · DB · 시계 없음).
// 정본: docs/implementation/learning-outcomes-20261021/04-EXISTING-DCP-REUSE-SPEC.md
// 불변식:
//   · planAdmission 검증(패킷 · 출력 · 원천 재판정 · 검수 대상 결속)을 먼저 그대로 돈다.
//   · 기존 행은 서버가 지금 읽은 행만 받는다(클라이언트는 item_id → dcp_item_id 지정만). practice · 같은 원천 · 유형 · 문단번호.
//   · 산출물의 발문 · 선지 순서 · 정답이 기존 행과 같아야 한다. 기존 passage 는 현재 원문의 공백 정규화 전체 또는 연속 발췌.
//   · 계획 row 는 저장된 payload · answer_key 그대로 — 새 해설로 기존 해설을 바꾸지 않는다(DB 행은 수정하지 않는다).
//   · AI 검수는 target.existing_rows 로 정확한 기존 행 id 와 canonical row sha 에 묶여야 한다. 없는 검수(옛 검수 포함)는 거절.

import { createHash } from 'node:crypto'

import { canonicalJson } from '../canonical-json'
import { AI_REVIEW_SCHEMA, ADMISSION_SCHEMA, planAdmission, requestKeyFor, type AdmissionInput, type AdmissionItemPlan, type AdmissionPlan } from './dcp-admission'
import { LocalProductionError, type ProductionOutput } from './local-production'

const digest = (v: unknown) => createHash('sha256').update(canonicalJson(v)).digest('hex')
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
const isObj = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v)
const norm = (s: string) => s.replace(/\s+/g, ' ').trim()

/** 서버가 읽은 기존 행 — csat_dcp_items 의 자연키 · 역할 · 본문 */
export interface ExistingDcpRow {
  id: string
  kind: string
  ref_id: string
  type: string
  paragraph_idx: number
  item_role: string
  payload: Record<string, unknown>
  answer_key: Record<string, unknown>
}
export const EXISTING_ROW_SELECT = 'id,kind,ref_id,type,paragraph_idx,item_role,payload,answer_key'

export interface ReuseMapping { item_id: string; dcp_item_id: string }
export interface ExistingRowTarget { item_id: string; dcp_item_id: string; row_sha256: string }

/** 검수가 묶이는 정확한 투영 — 그 외 열(created_at 등)은 보지 않는다 */
export const projectExistingRow = (r: ExistingDcpRow) => ({
  id: r.id, kind: r.kind, ref_id: r.ref_id, type: r.type, paragraph_idx: r.paragraph_idx, item_role: r.item_role, payload: r.payload, answer_key: r.answer_key,
})
export const existingRowSha = (r: ExistingDcpRow) => digest(projectExistingRow(r))

export interface ReuseInput extends AdmissionInput {
  reuse: ReuseMapping[]
  /** 서버가 지금 SELECT 한 행(매핑의 dcp_item_id 들) */
  existingRows: ExistingDcpRow[]
}

export interface ReuseItemPlan extends AdmissionItemPlan {
  existing: { dcp_item_id: string; row_sha256: string; passage_scope: 'full' | 'excerpt' } | null
}
export interface ReusePlan extends Omit<AdmissionPlan, 'items'> {
  items: ReuseItemPlan[]
  reuse: { adopted: number; inserted: number; atomic: 'per_item' }
}

/** 매핑 모양 — 빈 매핑 · 중복 · 모르는 키 거절 */
export function parseReuseMapping(v: unknown): ReuseMapping[] {
  if (!Array.isArray(v) || !v.length) throw new LocalProductionError('reuse_mapping_required')
  const items = new Set<string>()
  const ids = new Set<string>()
  return v.map((m) => {
    if (!isObj(m) || Object.keys(m).sort().join() !== 'dcp_item_id,item_id' || typeof m.item_id !== 'string' || typeof m.dcp_item_id !== 'string' || !UUID.test(m.dcp_item_id))
      throw new LocalProductionError('reuse_mapping_shape')
    if (items.has(m.item_id) || ids.has(m.dcp_item_id)) throw new LocalProductionError('reuse_mapping_duplicate', [m.item_id])
    items.add(m.item_id)
    ids.add(m.dcp_item_id)
    return { item_id: m.item_id, dcp_item_id: m.dcp_item_id }
  })
}

/** 산출물 문항과 기존 행의 대응을 잰다. 오류 목록이 비어야 통과 */
export function compareExisting(sourceId: string, sourceContent: string, it: ProductionOutput['items'][number], r: ExistingDcpRow): { errors: string[]; scope: 'full' | 'excerpt' } {
  const e: string[] = []
  if (r.kind !== 'article') e.push('kind')
  if (r.ref_id !== sourceId) e.push('source')
  if (r.type !== it.type) e.push('type')
  if (r.paragraph_idx !== 0) e.push('paragraph_idx')
  if (r.item_role !== 'practice') e.push('item_role')
  const p = r.payload ?? {}
  if (p.stem_ko !== it.stem) e.push('stem')
  const choices = Array.isArray(p.choices) ? p.choices : []
  if (choices.length !== it.choices.length || choices.some((c, k) => c !== it.choices[k]!.text)) e.push('choices')
  if (Number(r.answer_key?.answer) !== Number(it.answer)) e.push('answer')
  const passage = typeof p.passage === 'string' ? norm(p.passage) : ''
  const content = norm(sourceContent)
  if (!passage || !content.includes(passage)) e.push('passage_not_in_current_source')
  return { errors: e, scope: passage === content ? 'full' : 'excerpt' }
}

function reviewExistingTargets(review: unknown): ExistingRowTarget[] {
  if (!isObj(review) || review.schema !== AI_REVIEW_SCHEMA) throw new LocalProductionError('reuse_review_required')
  const t = review.target
  const rows = isObj(t) ? t.existing_rows : undefined
  if (!Array.isArray(rows) || !rows.length) throw new LocalProductionError('reuse_review_missing_existing_rows')
  return rows.map((x) => {
    if (!isObj(x) || typeof x.item_id !== 'string' || typeof x.dcp_item_id !== 'string' || typeof x.row_sha256 !== 'string') throw new LocalProductionError('reuse_review_existing_rows_shape')
    return { item_id: x.item_id, dcp_item_id: x.dcp_item_id, row_sha256: x.row_sha256 }
  })
}

export function planExistingDcpReuse(input: ReuseInput): ReusePlan {
  const base = planAdmission(input)
  const mapping = parseReuseMapping(input.reuse)
  const output = input.output as ProductionOutput
  const packet = input.packet as { body: { source: { id: string; content: string } } }
  const sourceId = packet.body.source.id
  const content = packet.body.source.content

  // 검수 결속 — 매핑과 정확히 같은 집합(누락 · 추가 · 중복 · 다른 hash 거절)
  const targets = reviewExistingTargets(input.review)
  const byId = new Map(input.existingRows.map((r) => [r.id, r]))
  const tErr: string[] = []
  if (new Set(targets.map((x) => x.item_id)).size !== targets.length) tErr.push('duplicate')
  if (targets.length !== mapping.length) tErr.push('count')
  const errs: string[] = []
  const existing = new Map<string, NonNullable<ReuseItemPlan['existing']> & { row: ExistingDcpRow }>()
  for (const m of mapping) {
    const it = output.items.find((i) => i.id === m.item_id)
    if (!it) { errs.push(`${m.item_id}:item_not_in_output`); continue }
    const r = byId.get(m.dcp_item_id)
    if (!r) { errs.push(`${m.item_id}:existing_row_not_found`); continue }
    const sha = existingRowSha(r)
    const t = targets.find((x) => x.item_id === m.item_id)
    if (!t || t.dcp_item_id !== m.dcp_item_id || t.row_sha256 !== sha) tErr.push(`row:${m.item_id}`)
    const c = compareExisting(sourceId, content, it, r)
    errs.push(...c.errors.map((x) => `${m.item_id}:${x}`))
    existing.set(m.item_id, { dcp_item_id: r.id, row_sha256: sha, passage_scope: c.scope, row: r })
  }
  for (const t of targets) if (!mapping.some((m) => m.item_id === t.item_id)) tErr.push(`extra:${t.item_id}`)
  if (errs.length) throw new LocalProductionError('reuse_existing_mismatch', errs)
  if (tErr.length) throw new LocalProductionError('reuse_review_target_mismatch', tErr)

  const items = base.items.map((p): ReuseItemPlan => {
    const ex = existing.get(p.item_id)
    if (!ex) return { ...p, existing: null }
    // 저장된 본문 그대로 — SQL 이 이 row 와 현재 행의 JSONB 동등성을 잠근 채 다시 잰다
    const row = { kind: 'article' as const, ref_id: ex.row.ref_id, type: ex.row.type, paragraph_idx: ex.row.paragraph_idx, payload: ex.row.payload, answer_key: ex.row.answer_key }
    const body = { ...p.body, schema: ADMISSION_SCHEMA, row, existing: { dcp_item_id: ex.dcp_item_id, row_sha256: ex.row_sha256, passage_scope: ex.passage_scope } }
    const bodyHash = digest(body)
    return {
      ...p, body, body_hash: bodyHash, request_key: requestKeyFor(bodyHash), row: row as unknown as AdmissionItemPlan['row'],
      existing: { dcp_item_id: ex.dcp_item_id, row_sha256: ex.row_sha256, passage_scope: ex.passage_scope },
    }
  })
  return { ...base, items, reuse: { adopted: existing.size, inserted: items.length - existing.size, atomic: 'per_item' } }
}

/**
 * 관측 사례 준비 — 원래 산출물의 매핑 문항을 기존 행의 발문 · 선지 · 정답으로 맞춘다(DB 행은 바꾸지 않는다).
 * 해설은 새로 지어내지 않는다: observation 은 저장된 기존 해설 원문, interpretation 은 그것이 기존 해설 그대로라는 사실과 정답 선지.
 * 근거 인용은 기존 해설에 큰따옴표로 인용되고 현재 원문에 글자 그대로 있는 구절만 — 없으면 거절(검수자가 직접 판단할 몫).
 */
export function adaptOutputToExisting(output: ProductionOutput, mapping: ReuseMapping[], rows: ExistingDcpRow[], sourceContent: string): ProductionOutput {
  const byId = new Map(rows.map((r) => [r.id, r]))
  const items = output.items.map((it) => {
    const m = mapping.find((x) => x.item_id === it.id)
    if (!m) return it
    const r = byId.get(m.dcp_item_id)
    if (!r) throw new LocalProductionError('existing_row_not_found', [m.dcp_item_id])
    if (r.type !== it.type) throw new LocalProductionError('reuse_existing_mismatch', [`${it.id}:type`])
    const choices = (Array.isArray(r.payload.choices) ? r.payload.choices : []).map((text, k) => ({ key: String(k + 1), text: String(text) }))
    const rationale = String(r.answer_key.rationale_ko ?? '')
    const quotes = [...rationale.matchAll(/"([^"]{8,})"/g)].map((q) => q[1]!.trim()).filter((q) => sourceContent.includes(q))
    if (!quotes.length) throw new LocalProductionError('reuse_existing_rationale_without_source_quote', [it.id])
    const answer = String(Number(r.answer_key.answer))
    return {
      ...it,
      stem: String(r.payload.stem_ko),
      choices,
      answer,
      evidence_quotes: [...new Set(quotes)],
      explanation: {
        observation: `기존 DCP ${r.id} 저장 해설(원문 그대로): ${rationale}`,
        interpretation: `이 문항은 기존 행을 재사용한다 — 정답 ${answer}번 「${choices[Number(answer) - 1]?.text ?? ''}」 · 새 해설을 쓰지 않았으므로 해설의 충분성은 검수자가 판단한다.`,
      },
    }
  })
  return { ...output, author: { ...output.author, method: `${output.author.method} + existing-dcp-adapt(${mapping.length})` }, items } as ProductionOutput
}

/** 검수 요청 대상 —독립 검수자가 그대로 target 에 옮길 결속 값 */
export function reuseReviewTarget(base: { source_digest: string; output_sha256: string; order_hash: string; packet_hash: string; role: string; task: string; items: { item_id: string; item_sha256: string }[] }, mapping: ReuseMapping[], rows: ExistingDcpRow[]) {
  const byId = new Map(rows.map((r) => [r.id, r]))
  return {
    ...base,
    existing_rows: mapping.map((m) => {
      const r = byId.get(m.dcp_item_id)
      if (!r) throw new LocalProductionError('existing_row_not_found', [m.dcp_item_id])
      return { item_id: m.item_id, dcp_item_id: m.dcp_item_id, row_sha256: existingRowSha(r) }
    }),
  }
}
