// apps/web/src/lib/csat/authored/ai-review.ts
//
// 2A — 두 AI(Claude Code · Codex) 검토 영수증으로 창작 평가 자료를 공급 경로에 올린다. 사람 검토를 했다는 진술은 만들지 않는다.
//
//   verifyAiReviewReceipt — 순수 검증기. 영수증(vocaflow.ai-authored-review-receipt/1)이 이 세트의 **지금 바이트**와
//     문항 · 역할 · body · Gold(JS canonical 해시) · 두 모델 · 서로 다른 세션 · 같은 입력 · 응답 해시(원본 result.txt)에 맞는지 본다.
//   recordAiReviewedSupply — 관리자 **로그인 세션** 클라이언트로 등록 → AI 결정 → 자격 → 승인을 부른다.
//     DB(content_ai_decision_record)가 같은 영수증을 등록 행에서 다시 대조한다 — 여기 통과는 「제안」일 뿐이다.
//     content_human_decision_record 는 부르지 않는다. 자격 축은 영수증 · 시스템 사실이 뒷받침하는 것만 pass, 나머지는 unknown 그대로.
import { createHash } from 'node:crypto'

import type { SupabaseClient } from '@supabase/supabase-js'

import {
  authoredRef, gradeAuthored, isAssessmentRole, registrationArgs, validateAuthoredSet,
  type AuthoredItem, type AuthoredSet,
} from '@/lib/knowledge/authored/authored-items'

export const AI_RECEIPT_SCHEMA = 'vocaflow.ai-authored-review-receipt/1'
const HEX64 = /^[0-9a-f]{64}$/
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/

export interface AiReviewItemVerdict { id: string; verdict: string; choice_0based: number; gold_issues: unknown[]; why?: string }
export interface AiReview {
  agent: string; session_id: string; request_id: string; prompt_sha256: string; response_sha256: string
  source_file_sha256: string; verdict: string; items: AiReviewItemVerdict[]
}
export interface AiReviewReceipt {
  schema: string; set: string; source_file_sha256: string; scope: string[]
  items: { id: string; role: string; item_canonical_sha256: string; body_canonical_sha256: string; gold_canonical_sha256: string }[]
  reviews: AiReview[]; judgment: string; rights_basis: string; rights_grant: boolean; human_review_claimed: boolean
  not_reviewed: string[]
}
/** 원본 증거(선택) — 각 모델의 result.txt 원문과 session.json */
export type RawEvidence = Partial<Record<'claude' | 'codex', { result: string | Buffer; session: { session_id?: string; prompt_sha256?: string; request_id?: string; status?: string } }>>

const sha256 = (x: string | Buffer) => createHash('sha256').update(x).digest('hex')
const sortKeys = (v: unknown): unknown =>
  Array.isArray(v) ? v.map(sortKeys)
    : v && typeof v === 'object' ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sortKeys((v as Record<string, unknown>)[k])])) : v
/** 검토 영수증이 쓴 해시 — 키 정렬 JSON.stringify. DB 는 같은 문자열을 js_canonical_json 으로 다시 만든다(jsonb::text 해시와 다르다) */
export const jsCanonicalSha = (v: unknown) => sha256(JSON.stringify(sortKeys(v)))

export type ReceiptCheck = { ok: true; refs: string[] } | { ok: false; errors: string[] }

/** 영수증 · 세트 바이트 · (있으면) 원본 응답의 결속 검증. 하나라도 어긋나면 전체 거절 */
export function verifyAiReviewReceipt(receipt: AiReviewReceipt, set: AuthoredSet, setBytes: string | Buffer, raw: RawEvidence = {}): ReceiptCheck {
  const errors: string[] = []
  const r = receipt
  if (r?.schema !== AI_RECEIPT_SCHEMA) return { ok: false, errors: ['schema'] }
  if (r.judgment !== 'accepted_candidate_content_and_gold') errors.push('judgment')
  if (r.human_review_claimed !== false) errors.push('human_review_claimed')
  if (r.rights_grant !== false || r.rights_basis !== 'first_party_original_declaration_only') errors.push('rights_basis')
  if (r.set !== set.set) errors.push('set_name')
  if (!HEX64.test(r.source_file_sha256 ?? '') || sha256(setBytes) !== r.source_file_sha256) errors.push('source_file_sha256')
  if (set.provenance.derivedFrom.length !== 0) errors.push('not_first_party')
  if (validateAuthoredSet(set).length) errors.push('set_invalid')
  const scope = Array.isArray(r.scope) ? r.scope : []
  if (scope.length === 0 || new Set(scope).size !== scope.length) errors.push('scope')
  if ((r.not_reviewed ?? []).some((id) => scope.includes(id))) errors.push('scope_overlaps_not_reviewed')
  const reviews = Array.isArray(r.reviews) ? r.reviews : []
  const agents = reviews.map((x) => x.agent).sort().join(',')
  if (reviews.length !== 2 || agents !== 'claude,codex') errors.push('two_models_required')
  if (reviews.length === 2 && reviews[0].session_id === reviews[1].session_id) errors.push('same_session')
  if (reviews.length === 2 && reviews[0].prompt_sha256 !== reviews[1].prompt_sha256) errors.push('different_inputs')
  for (const v of reviews) {
    if (!UUID.test(v.session_id ?? '') || !HEX64.test(v.prompt_sha256 ?? '') || !HEX64.test(v.response_sha256 ?? '')) errors.push(`review_identity:${v.agent}`)
    if (v.source_file_sha256 !== r.source_file_sha256 || v.verdict !== 'accept') errors.push(`review_verdict:${v.agent}`)
    const ev = raw[v.agent as 'claude' | 'codex']
    if (ev) {
      if (sha256(ev.result) !== v.response_sha256) errors.push(`raw_response:${v.agent}`)
      if (ev.session.session_id !== v.session_id || ev.session.prompt_sha256 !== v.prompt_sha256 || (ev.session.status && ev.session.status !== 'exited')) errors.push(`raw_session:${v.agent}`)
    }
  }
  for (const id of scope) {
    const it = set.items.find((x) => x.id === id)
    const e = (r.items ?? []).find((x) => x.id === id)
    if (!it || !e) { errors.push(`item_missing:${id}`); continue }
    if (e.role !== it.role) errors.push(`role:${id}`)
    if (e.body_canonical_sha256 !== jsCanonicalSha(it.body) || e.gold_canonical_sha256 !== jsCanonicalSha(it.gold)
        || e.item_canonical_sha256 !== jsCanonicalSha(it)) errors.push(`content_changed:${id}`)
    const answer = (it.gold as { answer?: unknown }).answer
    for (const v of reviews) {
      const iv = (v.items ?? []).find((x) => x.id === id)
      if (!iv || iv.verdict !== 'accept' || iv.choice_0based !== answer || (iv.gold_issues ?? []).length) errors.push(`item_not_accepted:${v.agent}:${id}`)
    }
  }
  return errors.length ? { ok: false, errors } : { ok: true, refs: scope.map(authoredRef) }
}

/** 영수증 · 시스템 사실이 뒷받침하는 축만 pass. 근거 없는 축은 unknown(G 는 공급 시점 판정) */
export function aiQualificationAxes(it: AuthoredItem, runnable: boolean) {
  const assess = isAssessmentRole(it.role)
  return {
    A: { state: 'pass' },                                       // 등록 행 = 검토 판본(DB 가 JS 해시 재계산 · revision 결속)
    B: { state: 'pass' }, C: { state: 'pass' },                 // 두 모델 내용 · 정답 수락
    D: { state: it.role === 'guided_practice' ? 'pass' : 'not_applicable' },  // 안내 연습 단서 검토(평가 역할은 교수 축 없음)
    E: { state: assess ? 'pass' : 'not_applicable' },           // 평가 역할 Gold 수락
    F: { state: 'pass' },                                       // 자체 창작 선언(외부 권리 부여 아님) — evidence 에 명시
    G: { state: 'not_applicable' },
    H: { state: runnable ? 'pass' : 'unknown' },                // 실제 채점기가 Gold 정답을 정답으로 채점하는가
  }
}

/** 승인은 (자격, 범위)당 1행 — 재실행이면 기존 승인을 쓴다. 철회된 승인은 재사용하지 않는다(새 자격 · 새 승인이 필요) */
async function approve(db: SupabaseClient, qualificationId: string, scope: 'public' | 'assessment'): Promise<string> {
  const r = await db.rpc('content_release_approve', { p_qualification: qualificationId, p_scope: scope })
  if (!r.error) return r.data as string
  if (r.error.code !== '23505') throw new Error(`content_release_approve: ${r.error.message ?? r.error.code}`)
  const prev = await db.from('content_release_approval').select('id').eq('qualification_id', qualificationId).eq('scope', scope)
  const id = ((prev.data ?? []) as { id: string }[])[0]?.id
  if (prev.error || !id) throw new Error('content_release_approve: existing approval not readable')
  const rv = await db.from('content_release_revocation').select('approval_id').eq('approval_id', id)
  if (rv.error || ((rv.data ?? []) as unknown[]).length) throw new Error('content_release_approve: approval revoked — new qualification required')
  return id
}
export type AiSupplyOutcome =
  | { status: 'rejected'; errors: string[] }
  | { status: 'ok'; items: { ref: string; decisionId: string; qualificationId: string; approvals: string[] }[] }

/**
 * 관리자 로그인 세션으로 영수증 범위 문항만 공급 경로에 올린다(재실행 안전 — 등록 · 결정 · 자격은 같은 입력 = 같은 행).
 * 범위 밖 문항은 등록하지 않는다. 결정 · 자격 · 승인은 각각 DB 가 다시 판정한다.
 */
export async function recordAiReviewedSupply(db: SupabaseClient, set: AuthoredSet, setBytes: string | Buffer, receipt: AiReviewReceipt, raw: RawEvidence = {}): Promise<AiSupplyOutcome> {
  const check = verifyAiReviewReceipt(receipt, set, setBytes, raw)
  if (!check.ok) return { status: 'rejected', errors: check.errors }
  const call = async <T>(fn: string, args: Record<string, unknown>): Promise<T> => {
    const r = await db.rpc(fn, args)
    if (r.error) throw new Error(`${fn}: ${r.error.message ?? r.error.code}`)
    return r.data as T
  }
  const items: { ref: string; decisionId: string; qualificationId: string; approvals: string[] }[] = []
  for (const id of receipt.scope) {
    const it = set.items.find((x) => x.id === id)!
    const args = registrationArgs(set, it)
    const ref = await call<string>('authored_item_register', args)
    const decisionId = await call<string>('content_ai_decision_record', { p_ref: ref, p_receipt: receipt })
    const g = it.gold as { answer?: number; claim?: number; support?: number[]; relationProbe?: { relation: string } }
    const runnable = gradeAuthored(set, it, { claim: g.claim, support: g.support, relation: g.relationProbe?.relation, choice: g.answer })?.grade.isCorrect === true
    const goldHash = jsCanonicalSha(it.gold)
    const qualificationId = await call<string>('authored_ai_qualify', {
      p_ref: ref, p_role: it.role, p_axes: aiQualificationAxes(it, runnable), p_annotation_ref: args.p_annotation_ref,
      p_evidence_ids: [`ai_decision:${decisionId}`, `ai_receipt:${receipt.source_file_sha256}`, `js_gold:${goldHash}`, 'rights:first_party_original_declaration'],
    })
    const approvals = [await approve(db, qualificationId, 'public')]
    if (isAssessmentRole(it.role)) approvals.push(await approve(db, qualificationId, 'assessment'))
    items.push({ ref, decisionId, qualificationId, approvals })
  }
  return { status: 'ok', items }
}
