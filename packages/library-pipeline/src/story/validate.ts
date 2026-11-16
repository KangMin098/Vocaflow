// packages/library-pipeline/src/story/validate.ts
//
// LCP Story 순수 검증기 — DB · 파일 · 네트워크를 쓰지 않는다. 시각은 `now` 로 주입한다.
// 계약: docs/LCP_STORY.md §7(원문 결속) · §8(해시) · §9(검수 결속).
//
// ⚠️ 여기서 통과는 「구조 검사 통과」다. 의미 보존 · 자연스러움 · 수준 적합은 검수자의 판단이며
//   이 함수들이 인증하지 않는다(plan.ts 가 그 경계를 발행 미리보기에 그대로 적는다).

import type { ZodType, ZodTypeDef } from 'zod'

import { CanonicalError, sha256Canonical } from './canonical'
import {
  EditionArtifactSchema,
  EditorialPolicySchema,
  PLACEHOLDER_RE,
  ReviewArtifactSchema,
  SourceSnapshotSchema,
  type EditionArtifact,
  type EditionKind,
  type EditorialPolicy,
  type ProductionItem,
  type ReviewArtifact,
  type ReviewBinding,
  type ReviewCheckId,
  type SourceAnchor,
  type ChangeTypeId,
  type SourceSnapshot,
  type TransformationTypeId,
} from './schema'
import {
  checkEditionSpan,
  checkSourceAnchor,
  isNormalizedText,
  isWellFormedUnicode,
  normalizeSourceText,
  paragraphSpans,
  rangesOverlap,
  sourceTextSha256,
  type ParagraphSpan,
} from './text'

export interface Issue {
  code: string
  path: string
  message: string
}

export interface Checked<T> {
  ok: boolean
  value: T | null
  errors: Issue[]
  warnings: Issue[]
}

function done<T>(value: T | null, errors: Issue[], warnings: Issue[] = []): Checked<T> {
  return { ok: errors.length === 0 && value !== null, value: errors.length === 0 ? value : null, errors, warnings }
}

/** 입력 전체에서 잘못된 UTF-16 문자열(값 · 키)을 찾는다. 고치지 않고 경로와 함께 보고한다. */
function collectIllFormed(value: unknown, path: string, out: Issue[], seen: Set<object>): void {
  if (typeof value === 'string') {
    if (!isWellFormedUnicode(value)) {
      out.push({ code: 'text_ill_formed_unicode', path, message: '짝 없는 서로게이트가 있는 문자열 — 잘못된 UTF-16 은 고치지 않고 거부한다' })
    }
    return
  }
  if (!value || typeof value !== 'object' || seen.has(value)) return
  seen.add(value)
  if (Array.isArray(value)) {
    value.forEach((v, i) => collectIllFormed(v, `${path}[${i}]`, out, seen))
  } else {
    for (const [k, v] of Object.entries(value)) {
      if (!isWellFormedUnicode(k)) {
        out.push({ code: 'text_ill_formed_unicode', path: `${path}.<key>`, message: '키에 짝 없는 서로게이트가 있다' })
      }
      collectIllFormed(v, `${path}.${k}`, out, seen)
    }
  }
  seen.delete(value)
}

export function parseSchema<T>(
  schema: ZodType<T, ZodTypeDef, unknown>,
  input: unknown,
  base: string,
): { value: T | null; errors: Issue[] } {
  const illFormed: Issue[] = []
  collectIllFormed(input, base, illFormed, new Set())
  if (illFormed.length > 0) return { value: null, errors: illFormed }
  const parsed = schema.safeParse(input)
  if (parsed.success) return { value: parsed.data, errors: [] }
  return {
    value: null,
    errors: parsed.error.issues.map((i) => ({
      code: `schema_${i.code}`,
      path: [base, ...i.path.map(String)].join('.'),
      message: i.message,
    })),
  }
}

/** 해시 계산 실패(지원하지 않는 값)를 예외 대신 검증 오류로 바꾼다. */
function safeHash(value: unknown, path: string, errors: Issue[]): string | null {
  return safeCompute(() => sha256Canonical(value), path, errors)
}

function safeCompute(compute: () => string, path: string, errors: Issue[]): string | null {
  try {
    return compute()
  } catch (e) {
    if (e instanceof CanonicalError) {
      errors.push({ code: 'canonical_unsupported', path: `${path}${e.path.slice(1)}`, message: e.message })
      return null
    }
    throw e
  }
}

function isFuture(iso: string, now: Date): boolean {
  return Date.parse(iso) > now.getTime()
}

// ── 원천 스냅숏 ─────────────────────────────────────────────────────────────

export interface SourceContext {
  snapshot: SourceSnapshot
  text: string
  /** 본문 해시 — 앵커 검증용. */
  sha256: string
  /** 원천 판본 정체 해시 — 판본 · 검수 · 발행 결속용. 본문이 같아도 다른 원천 판본이면 다르다. */
  identity_sha256: string
  paragraphs: ParagraphSpan[]
}

/**
 * 원천 판본 정체 — 본문을 뺀 스냅숏 전체(작품 · 원천 판본 · revision · 대응 도서 · 번역자 · 확보 시각 ·
 * 정규화 · 범위 · 권리 기록)에 「계산한」 본문 해시를 더한 것. 입력이 주장하는 해시를 쓰지 않는다.
 * 권리 기록은 자산마다 하나뿐이라 자산 이름 순으로 정렬해 배열 순서에 흔들리지 않게 한다.
 */
export function sourceIdentity(snapshot: SourceSnapshot, textSha256: string): Record<string, unknown> {
  const { text: _text, text_sha256: _declared, rights, ...rest } = snapshot
  const sortedRights = [...rights].sort((a, b) => (a.asset < b.asset ? -1 : a.asset > b.asset ? 1 : 0))
  return { ...rest, text_sha256: textSha256, rights: sortedRights }
}

export function sourceIdentitySha256(snapshot: SourceSnapshot, textSha256: string): string {
  return sha256Canonical(sourceIdentity(snapshot, textSha256))
}

export function validateSnapshot(input: unknown, now: Date): Checked<SourceContext> {
  const { value: snap, errors } = parseSchema(SourceSnapshotSchema, input, 'snapshot')
  if (!snap) return done<SourceContext>(null, errors)
  const warnings: Issue[] = []

  if (!isNormalizedText(snap.text)) {
    errors.push({
      code: 'text_not_normalized',
      path: 'snapshot.text',
      message: 'story-text-v1 정본 형태가 아니다(NFC · LF · 줄 끝 공백 · 문단 구분 · 앞뒤 공백). 스냅숏 작성기가 normalizeSourceText 를 거쳐야 한다',
    })
  }
  const sha = sourceTextSha256(snap.text)
  if (sha !== snap.text_sha256) {
    errors.push({ code: 'text_hash_mismatch', path: 'snapshot.text_sha256', message: '선언한 해시가 본문에서 계산한 해시와 다르다' })
  }
  if (isFuture(snap.captured_at, now)) {
    errors.push({ code: 'time_in_future', path: 'snapshot.captured_at', message: '확보 시각이 현재보다 뒤다' })
  }

  const ed = snap.edition
  if (snap.synthetic !== (ed.source_kind === 'synthetic_fixture')) {
    errors.push({ code: 'synthetic_flag_mismatch', path: 'snapshot.synthetic', message: 'synthetic 은 source_kind=synthetic_fixture 와 함께만 참이다' })
  }
  if (ed.source_kind === 'library_book') {
    if (!ed.library_book_id || !ed.source || !ed.source_id) {
      errors.push({
        code: 'library_book_mapping_incomplete',
        path: 'snapshot.edition',
        message: 'library_book 원천은 library_book_id · source · source_id 를 모두 가져야 한다(제목으로 대응시키지 않는다)',
      })
    }
  } else if (ed.library_book_id !== null) {
    errors.push({ code: 'library_book_id_unexpected', path: 'snapshot.edition.library_book_id', message: 'library_book 이 아닌 원천에 library_book_id 를 붙이지 않는다' })
  }

  const seen = new Set<string>()
  snap.rights.forEach((r, i) => {
    const p = `snapshot.rights[${i}]`
    if (seen.has(r.asset)) errors.push({ code: 'rights_duplicate_asset', path: p, message: `${r.asset} 권리 기록이 둘 이상이다` })
    seen.add(r.asset)
    if (r.status === 'confirmed' && (!r.evidence_ref || !r.checked_by || !r.checked_at)) {
      errors.push({ code: 'rights_confirmation_incomplete', path: p, message: 'confirmed 는 evidence_ref · checked_by · checked_at 을 모두 가져야 한다' })
    }
    if (r.checked_at && isFuture(r.checked_at, now)) {
      errors.push({ code: 'time_in_future', path: `${p}.checked_at`, message: '확인 시각이 현재보다 뒤다' })
    }
    if ((r.status === 'synthetic_fixture') !== snap.synthetic) {
      errors.push({ code: 'synthetic_rights_mismatch', path: p, message: '합성 원천은 synthetic_fixture 권리만, 실제 원천은 synthetic_fixture 가 아닌 권리만 가진다' })
    }
  })
  if (!seen.has('source_text')) {
    errors.push({ code: 'rights_source_text_missing', path: 'snapshot.rights', message: 'source_text 권리 기록이 없다' })
  }

  // 번역 — 원작 언어와 원천 본문 언어가 다르면 번역본이다. 번역자와 번역 권리 기록을 따로 요구한다.
  const translated = snap.work.original_language !== ed.text_language
  if (translated && ed.translator === null) {
    errors.push({ code: 'translator_missing', path: 'snapshot.edition.translator', message: '번역본(원작 언어 ≠ 본문 언어)은 번역자를 적어야 한다' })
  }
  if (!translated && ed.translator !== null) {
    errors.push({ code: 'translator_unexpected', path: 'snapshot.edition.translator', message: '원작 언어로 된 본문에 번역자를 적지 않는다' })
  }
  if (translated && !seen.has('translation')) {
    errors.push({ code: 'rights_translation_missing', path: 'snapshot.rights', message: '번역본은 translation 권리 기록이 있어야 한다' })
  }
  if (!translated && seen.has('translation')) {
    errors.push({ code: 'rights_translation_unexpected', path: 'snapshot.rights', message: '원작 언어 본문에 번역 권리 기록이 있다 — 원작 언어 · 본문 언어를 확인한다' })
  }

  if (errors.length > 0) return done<SourceContext>(null, errors, warnings)
  const identity = safeCompute(() => sourceIdentitySha256(snap, sha), 'snapshot', errors)
  return done(
    identity ? { snapshot: snap, text: snap.text, sha256: sha, identity_sha256: identity, paragraphs: paragraphSpans(snap.text) } : null,
    errors,
    warnings,
  )
}

function checkAnchors(anchors: readonly SourceAnchor[], path: string, source: SourceContext, errors: Issue[]): void {
  anchors.forEach((a, i) => {
    for (const issue of checkSourceAnchor(a, source.text, source.sha256, source.paragraphs)) {
      errors.push({ code: issue.code, path: `${path}[${i}]`, message: issue.message })
    }
  })
}

// ── 편집 기준 ──────────────────────────────────────────────────────────────

const KIND_TRANSFORMATION: Record<EditionKind, TransformationTypeId> = {
  story_edition: 'language_modernization',
  easy_reader: 'level_adaptation',
}

/** 판본별로 변경 기록에 쓸 수 있는 유형. 재서사는 어디에도 없다(초기 제작 정책). */
export const ALLOWED_CHANGE_TYPES: Record<EditionKind, readonly ChangeTypeId[]> = {
  story_edition: ['language_modernization', 'editorial_note'],
  easy_reader: ['language_modernization', 'level_adaptation', 'editorial_note'],
}

const NOTE_OPERATIONS: ReadonlySet<string> = new Set(['gloss', 'context_note'])

export interface PolicyContext {
  policy: EditorialPolicy
  /** production 을 뺀 편집 기준의 결속 해시 — 다른 판본을 추가해도 기존 검수가 낡지 않게. */
  policy_sha256: string
  items: Map<string, { item: ProductionItem; target_sha256: string }>
}

export function policyCore(policy: EditorialPolicy): Omit<EditorialPolicy, 'production'> {
  const { production: _production, ...core } = policy
  return core
}

export function validatePolicy(input: unknown, source: SourceContext): Checked<PolicyContext> {
  const { value: policy, errors } = parseSchema(EditorialPolicySchema, input, 'policy')
  if (!policy) return done<PolicyContext>(null, errors)

  if (policy.work_key !== source.snapshot.work.work_key) {
    errors.push({ code: 'work_key_mismatch', path: 'policy.work_key', message: '스냅숏과 다른 작품 키다' })
  }
  if (policy.source_sha256 !== source.sha256) {
    errors.push({ code: 'policy_source_stale', path: 'policy.source_sha256', message: '편집 기준이 다른 원문 판(해시)에 대해 쓰였다' })
  }

  const ids = new Set<string>()
  const claimId = (id: string, path: string): void => {
    if (ids.has(id)) errors.push({ code: 'duplicate_id', path, message: `id ${id} 가 중복이다` })
    ids.add(id)
  }
  for (const group of ['events', 'motivations', 'causality', 'foreshadowing', 'tone_devices'] as const) {
    policy.preserve[group].forEach((item, i) => {
      claimId(item.id, `policy.preserve.${group}[${i}]`)
      checkAnchors(item.anchors, `policy.preserve.${group}[${i}].anchors`, source, errors)
    })
  }
  policy.sensitive_content.forEach((item, i) => {
    claimId(item.id, `policy.sensitive_content[${i}]`)
    checkAnchors(item.anchors, `policy.sensitive_content[${i}].anchors`, source, errors)
  })
  checkAnchors(policy.entry_scene.anchors, 'policy.entry_scene.anchors', source, errors)

  const items = new Map<string, { item: ProductionItem; target_sha256: string }>()
  const lastParagraph = source.paragraphs.length - 1
  policy.production.forEach((item, i) => {
    const p = `policy.production[${i}]`
    if (items.has(item.edition_key)) {
      errors.push({ code: 'duplicate_edition_key', path: p, message: `edition_key ${item.edition_key} 가 중복이다` })
    }
    if (item.transformation === 'renarration') {
      errors.push({ code: 'renarration_excluded', path: `${p}.transformation`, message: '재서사는 초기 제작 범위에서 제외된다' })
    } else if (KIND_TRANSFORMATION[item.kind] !== item.transformation) {
      errors.push({
        code: 'transformation_kind_mismatch',
        path: `${p}.transformation`,
        message: `${item.kind} 는 ${KIND_TRANSFORMATION[item.kind]} 로 만든다`,
      })
    }
    const { first_paragraph: first, last_paragraph: last } = item.scope
    if (first > last || last > lastParagraph) {
      errors.push({ code: 'scope_invalid', path: `${p}.scope`, message: `문단 범위 ${first}..${last} 가 원문 0..${lastParagraph} 안에 있지 않다` })
    }
    if (item.coverage === 'complete_work') {
      if (source.snapshot.coverage !== 'complete_work') {
        errors.push({ code: 'coverage_claim_invalid', path: `${p}.coverage`, message: '발췌 스냅숏으로 작품 전체 판본을 만들 수 없다' })
      } else if (first !== 0 || last !== lastParagraph) {
        errors.push({ code: 'coverage_claim_invalid', path: `${p}.coverage`, message: 'complete_work 는 원문 전 문단을 범위로 가져야 한다' })
      }
    }
    if (item.target.language.v_level_min > item.target.language.v_level_max) {
      errors.push({ code: 'target_range_invalid', path: `${p}.target.language`, message: 'v_level_min 이 v_level_max 보다 크다' })
    }
    if (new Set(item.activities).size !== item.activities.length) {
      errors.push({ code: 'duplicate_activity_kind', path: `${p}.activities`, message: '같은 활동 종류를 두 번 요청했다' })
    }
    const target = safeHash(item, p, errors)
    if (target) items.set(item.edition_key, { item, target_sha256: target })
  })

  const policySha = safeHash(policyCore(policy), 'policy', errors)
  return done(errors.length === 0 && policySha ? { policy, policy_sha256: policySha, items } : null, errors)
}

// ── 판본 결과물 ────────────────────────────────────────────────────────────

export interface EditionContext {
  source: SourceContext
  policy: PolicyContext
  edition_key: string
  task_id: string
}

export interface EditionResult {
  edition: EditionArtifact
  edition_sha256: string
  activities_sha256: string
}

/** 판본 내용 해시 — 활동을 뺀 결과물 전체(생산자 · 결속 포함). 생산자를 바꿔도 검수가 낡는다. */
export function editionSha256(edition: EditionArtifact): string {
  const { activities: _activities, ...content } = edition
  return sha256Canonical(content)
}

export function activitiesSha256(edition: EditionArtifact): string {
  return sha256Canonical(edition.activities)
}

function minStart(anchors: readonly SourceAnchor[]): number {
  return Math.min(...anchors.map((a) => a.start))
}

function compactText(s: string): string {
  return s.replace(/\s+/g, ' ').trim().toLowerCase()
}

function checkBodyText(text: string, path: string, errors: Issue[]): void {
  if (text.trim().length === 0) {
    errors.push({ code: 'text_empty', path, message: '본문이 비어 있다' })
    return
  }
  if (PLACEHOLDER_RE.test(text)) {
    errors.push({ code: 'text_placeholder', path, message: '채우지 않은 표시가 있다' })
  }
  if (normalizeSourceText(text) !== text || text.includes('\u0000')) {
    errors.push({ code: 'text_not_normalized', path, message: 'story-text-v1 형태(NFC · LF · 앞뒤/줄 끝 공백 없음)가 아니다' })
  }
}

export function validateEdition(input: unknown, ctx: EditionContext): Checked<EditionResult> {
  const { value: ed, errors } = parseSchema(EditionArtifactSchema, input, 'edition')
  if (!ed) return done<EditionResult>(null, errors)
  const warnings: Issue[] = []
  const { source, policy } = ctx
  const slot = policy.items.get(ctx.edition_key)
  if (!slot) {
    errors.push({ code: 'edition_not_in_production', path: 'edition.edition_key', message: `${ctx.edition_key} 는 편집 기준의 제작 범위에 없다` })
    return done<EditionResult>(null, errors)
  }
  const { item } = slot

  // 결속 — 입력 해시를 믿지 않고 지금 원문 · 기준 · 목표에서 다시 계산한 값과 비교한다.
  if (ed.task_id !== ctx.task_id) {
    errors.push({ code: 'edition_task_mismatch', path: 'edition.task_id', message: '다른 작업의 결과물이다' })
  }
  if (ed.edition_key !== ctx.edition_key || ed.kind !== item.kind) {
    errors.push({ code: 'edition_slot_mismatch', path: 'edition.edition_key', message: '다른 판본 자리의 결과물이다' })
  }
  const expected = {
    source_sha256: source.sha256,
    source_identity_sha256: source.identity_sha256,
    policy_sha256: policy.policy_sha256,
    target_sha256: slot.target_sha256,
  }
  for (const key of Object.keys(expected) as Array<keyof typeof expected>) {
    if (ed.binding[key] !== expected[key]) {
      errors.push({ code: 'edition_binding_stale', path: `edition.binding.${key}`, message: '결과물이 지금과 다른 원천 판본/본문/기준/목표에 대해 만들어졌다' })
    }
  }
  if (ed.produced_by.provenance === 'synthetic_fixture' && !source.snapshot.synthetic) {
    errors.push({ code: 'synthetic_mismatch', path: 'edition.produced_by.provenance', message: '실제 원천에 합성 결과물을 붙일 수 없다' })
  }

  const scopeFirst = item.scope.first_paragraph
  const scopeLast = item.scope.last_paragraph
  const inScope = (a: SourceAnchor): boolean => a.paragraph >= scopeFirst && a.paragraph <= scopeLast
  const checkScoped = (anchors: readonly SourceAnchor[], path: string): void => {
    checkAnchors(anchors, path, source, errors)
    anchors.forEach((a, i) => {
      if (!inScope(a)) {
        errors.push({ code: 'anchor_outside_scope', path: `${path}[${i}]`, message: `문단 ${a.paragraph} 은 제작 범위 ${scopeFirst}..${scopeLast} 밖이다` })
      }
    })
  }

  // 제목 · 진입 장면
  checkBodyText(ed.hook.text, 'edition.hook.text', errors)
  checkScoped(ed.hook.source_anchors, 'edition.hook.source_anchors')
  ed.hook.source_anchors.forEach((h, i) => {
    const inside = policy.policy.entry_scene.anchors.some((e) => e.start <= h.start && h.end <= e.end)
    if (!inside) {
      errors.push({ code: 'hook_outside_entry_scene', path: `edition.hook.source_anchors[${i}]`, message: '진입 장면이 편집 기준이 정한 스포일러 없는 구간 밖이다' })
    }
  })

  // 단위
  const units = new Map<string, EditionArtifact['units'][number]>()
  const texts = new Map<string, string>()
  ed.units.forEach((u, i) => {
    const p = `edition.units[${i}]`
    if (units.has(u.unit_id)) errors.push({ code: 'duplicate_id', path: p, message: `unit_id ${u.unit_id} 가 중복이다` })
    units.set(u.unit_id, u)
    if (u.order !== i + 1) {
      errors.push({ code: 'unit_order_field_invalid', path: `${p}.order`, message: `order 는 배열 순서대로 1..n 이어야 한다(기대 ${i + 1})` })
    }
    checkBodyText(u.text, `${p}.text`, errors)
    const key = compactText(u.text)
    const twin = texts.get(key)
    if (key.length > 0 && twin) {
      errors.push({ code: 'unit_duplicate_text', path: `${p}.text`, message: `단위 ${twin} 와 본문이 같다` })
    }
    texts.set(key, u.unit_id)
    checkScoped(u.source_anchors, `${p}.source_anchors`)
    if (i > 0) {
      const prev = ed.units[i - 1]!
      if (minStart(u.source_anchors) < minStart(prev.source_anchors)) {
        errors.push({
          code: 'unit_order_changed',
          path: `${p}.source_anchors`,
          message: `단위 ${u.unit_id} 가 원문에서 ${prev.unit_id} 보다 앞선 곳에서 시작한다 — 초기 제작은 원작 순서를 바꾸지 않는다`,
        })
      }
    }
  })

  // 정렬 누락 — 범위 안 모든 문단은 단위가 가리키거나 omit 변경으로 기록돼야 한다.
  const touched = new Set<number>()
  for (const u of ed.units) for (const a of u.source_anchors) touched.add(a.paragraph)
  for (const c of ed.change_log) {
    if (c.operation === 'omit') for (const a of c.source_anchors) touched.add(a.paragraph)
  }
  const gaps: number[] = []
  for (let p = scopeFirst; p <= scopeLast; p++) if (!touched.has(p)) gaps.push(p)
  if (gaps.length > 0) {
    errors.push({
      code: 'alignment_gap',
      path: 'edition.units',
      message: `범위 안 문단 ${gaps.join(', ')} 이 어느 단위에도 대응되지 않고 생략 기록도 없다`,
    })
  }

  // 보존 요소
  const preserveItems = (['events', 'motivations', 'causality', 'foreshadowing', 'tone_devices'] as const).flatMap(
    (g) => policy.policy.preserve[g],
  )
  const preserveIds = new Set(preserveItems.map((p) => p.id))
  ed.units.forEach((u, i) => {
    u.preserves.forEach((id, j) => {
      if (!preserveIds.has(id)) {
        errors.push({ code: 'preserve_unknown', path: `edition.units[${i}].preserves[${j}]`, message: `편집 기준에 없는 보존 요소 ${id}` })
      }
    })
  })
  for (const pi of preserveItems) {
    if (!pi.required_in.includes(ed.kind)) continue
    if (!pi.anchors.some(inScope)) continue
    const claimers = ed.units.filter((u) => u.preserves.includes(pi.id))
    if (claimers.length === 0) {
      errors.push({ code: 'preserve_item_missing', path: 'edition.units', message: `보존 요소 ${pi.id} 를 담는 단위가 없다` })
      continue
    }
    const anchored = claimers.some((u) => u.source_anchors.some((ua) => pi.anchors.some((ia) => rangesOverlap(ua, ia))))
    if (!anchored) {
      errors.push({ code: 'preserve_item_unanchored', path: 'edition.units', message: `보존 요소 ${pi.id} 를 담는다는 단위가 그 원문 구간에 대응되지 않는다` })
    }
  }

  // 변경 기록
  const changeIds = new Set<string>()
  const sensitiveIds = new Set(policy.policy.sensitive_content.map((s) => s.id))
  ed.change_log.forEach((c, i) => {
    const p = `edition.change_log[${i}]`
    if (changeIds.has(c.change_id)) errors.push({ code: 'duplicate_id', path: p, message: `change_id ${c.change_id} 가 중복이다` })
    changeIds.add(c.change_id)
    if (c.type === 'renarration') {
      errors.push({ code: 'renarration_excluded', path: `${p}.type`, message: '재서사 변경은 초기 제작 범위에서 제외된다' })
    } else if (!ALLOWED_CHANGE_TYPES[ed.kind].includes(c.type)) {
      errors.push({ code: 'change_type_not_allowed', path: `${p}.type`, message: `${ed.kind} 에는 ${c.type} 변경을 쓰지 않는다` })
    }
    if ((c.type === 'editorial_note') !== NOTE_OPERATIONS.has(c.operation)) {
      errors.push({
        code: 'change_type_operation_mismatch',
        path: `${p}.operation`,
        message: 'gloss · context_note 는 editorial_note 로만, editorial_note 는 gloss · context_note 로만 기록한다',
      })
    }
    if (c.operation !== 'omit' && c.unit_ids.length === 0) {
      errors.push({ code: 'change_units_required', path: `${p}.unit_ids`, message: '생략이 아닌 변경은 결과 단위를 가리켜야 한다' })
    }
    c.unit_ids.forEach((id, j) => {
      if (!units.has(id)) errors.push({ code: 'change_unit_missing', path: `${p}.unit_ids[${j}]`, message: `없는 단위 ${id}` })
    })
    checkScoped(c.source_anchors, `${p}.source_anchors`)
    if (c.sensitive_ref !== null && !sensitiveIds.has(c.sensitive_ref)) {
      errors.push({ code: 'sensitive_unknown', path: `${p}.sensitive_ref`, message: `편집 기준에 없는 민감 표현 ${c.sensitive_ref}` })
    }
  })

  // 민감 표현 — 은폐하지도 무비판 재생산하지도 않는다. 처리 방침대로 기록하고 학습자 설명을 남긴다.
  const expectedOp = { retain_with_context: 'context_note', revise_with_note: 'rewrite', omit_with_note: 'omit' } as const
  for (const s of policy.policy.sensitive_content) {
    if (!s.anchors.some(inScope)) continue
    const handled = ed.change_log.filter((c) => c.sensitive_ref === s.id)
    if (handled.length === 0) {
      errors.push({ code: 'sensitive_unhandled', path: 'edition.change_log', message: `민감 표현 ${s.id} 의 처리 기록이 없다` })
      continue
    }
    if (!handled.some((c) => c.operation === expectedOp[s.handling])) {
      errors.push({ code: 'sensitive_handling_mismatch', path: 'edition.change_log', message: `${s.id} 는 ${s.handling} → ${expectedOp[s.handling]} 로 처리해야 한다` })
    }
    if (handled.some((c) => c.learner_note === null)) {
      errors.push({ code: 'sensitive_note_missing', path: 'edition.change_log', message: `${s.id} 처리에 학습자 설명(learner_note)이 없다` })
    }
    if (!handled.some((c) => c.source_anchors.some((ca) => s.anchors.some((sa) => rangesOverlap(ca, sa))))) {
      errors.push({ code: 'sensitive_unanchored', path: 'edition.change_log', message: `${s.id} 처리 기록이 그 원문 구간을 가리키지 않는다` })
    }
  }

  // 활동 — 요청한 조합만, 판단 구조만.
  const requested = new Set(item.activities)
  const activityIds = new Set<string>()
  ed.activities.forEach((a, i) => {
    const p = `edition.activities[${i}]`
    if (activityIds.has(a.activity_id)) errors.push({ code: 'duplicate_id', path: p, message: `activity_id ${a.activity_id} 가 중복이다` })
    activityIds.add(a.activity_id)
    if (!requested.has(a.kind)) {
      errors.push({ code: 'activity_not_requested', path: `${p}.kind`, message: `제작 범위에 없는 활동 ${a.kind}` })
    }
    if (a.kind === 'original_bridge') {
      const unit = units.get(a.unit_id)
      if (!unit) {
        errors.push({ code: 'activity_unit_missing', path: `${p}.unit_id`, message: `없는 단위 ${a.unit_id}` })
        return
      }
      if (a.edition_span.unit_id !== a.unit_id) {
        errors.push({ code: 'bridge_span_unit_mismatch', path: `${p}.edition_span`, message: '판본 구간이 다른 단위를 가리킨다' })
      }
      for (const issue of checkEditionSpan(a.edition_span, units.get(a.edition_span.unit_id)?.text)) {
        errors.push({ code: issue.code, path: `${p}.edition_span`, message: issue.message })
      }
      checkScoped(a.source_anchors, `${p}.source_anchors`)
      const aligned = a.source_anchors.some((sa) => unit.source_anchors.some((ua) => rangesOverlap(sa, ua)))
      if (!aligned) {
        errors.push({ code: 'bridge_unaligned', path: `${p}.source_anchors`, message: '원문 대응 자료가 그 단위의 원문 구간과 겹치지 않는다' })
      }
      return
    }
    if (!units.has(a.after_unit_id)) {
      errors.push({ code: 'activity_unit_missing', path: `${p}.after_unit_id`, message: `없는 단위 ${a.after_unit_id}` })
    }
    const task = a.task
    if (task.interaction === 'choose_evidence') {
      const optionIds = new Set<string>()
      task.options.forEach((o, j) => {
        if (optionIds.has(o.option_id)) errors.push({ code: 'duplicate_id', path: `${p}.task.options[${j}]`, message: `option_id ${o.option_id} 가 중복이다` })
        optionIds.add(o.option_id)
        for (const issue of checkEditionSpan(o, units.get(o.unit_id)?.text)) {
          errors.push({ code: issue.code, path: `${p}.task.options[${j}]`, message: issue.message })
        }
      })
      const refs = task.answer.basis === 'factual' ? task.answer.correct : task.answer.defensible
      refs.forEach((id, j) => {
        if (!optionIds.has(id)) errors.push({ code: 'answer_unknown_option', path: `${p}.task.answer[${j}]`, message: `없는 선택지 ${id}` })
      })
    } else {
      const itemIds = new Set<string>()
      task.items.forEach((it, j) => {
        if (itemIds.has(it.item_id)) errors.push({ code: 'duplicate_id', path: `${p}.task.items[${j}]`, message: `item_id ${it.item_id} 가 중복이다` })
        itemIds.add(it.item_id)
        if (!units.has(it.unit_id)) errors.push({ code: 'activity_unit_missing', path: `${p}.task.items[${j}].unit_id`, message: `없는 단위 ${it.unit_id}` })
      })
      const order = task.answer.order
      const permutation = order.length === itemIds.size && new Set(order).size === order.length && order.every((id) => itemIds.has(id))
      if (!permutation) {
        errors.push({ code: 'order_answer_invalid', path: `${p}.task.answer.order`, message: '정답 순서가 항목 전체의 순열이 아니다' })
      }
    }
  })
  for (const kind of requested) {
    if (!ed.activities.some((a) => a.kind === kind)) {
      errors.push({ code: 'activity_missing', path: 'edition.activities', message: `제작 범위가 요청한 ${kind} 활동이 없다` })
    }
  }

  // 자산 — 선언만 검사한다. 권리 · 본문 정합 확정은 plan.ts 가 보류 사유로 다룬다.
  const assetIds = new Set<string>()
  ed.assets.forEach((a, i) => {
    const p = `edition.assets[${i}]`
    if (assetIds.has(a.asset_id)) errors.push({ code: 'duplicate_id', path: p, message: `asset_id ${a.asset_id} 가 중복이다` })
    assetIds.add(a.asset_id)
    a.unit_ids.forEach((id, j) => {
      if (!units.has(id)) errors.push({ code: 'asset_unit_missing', path: `${p}.unit_ids[${j}]`, message: `없는 단위 ${id}` })
    })
  })

  if (errors.length > 0) return done<EditionResult>(null, errors, warnings)
  const editionHash = safeCompute(() => editionSha256(ed), 'edition', errors)
  const activitiesHash = safeCompute(() => activitiesSha256(ed), 'edition.activities', errors)
  if (!editionHash || !activitiesHash) return done<EditionResult>(null, errors, warnings)
  return done({ edition: ed, edition_sha256: editionHash, activities_sha256: activitiesHash }, errors, warnings)
}

// ── 검수 ───────────────────────────────────────────────────────────────────

const BASE_REQUIRED_CHECKS: readonly ReviewCheckId[] = [
  'source_alignment',
  'meaning_preservation',
  'preserve_items',
  'language_target',
  'cognitive_target',
  'background_supports',
  'sensitivity_handling',
  'hook_spoiler_free',
  'naturalness',
]

/** 이 판본의 검수가 반드시 다뤄야 하는 항목. 활동 · 자산이 있으면 그 항목도. */
export function requiredChecks(edition: EditionArtifact): ReviewCheckId[] {
  const out = [...BASE_REQUIRED_CHECKS]
  if (edition.activities.length > 0) out.push('activities')
  if (edition.assets.length > 0) out.push('assets')
  return out
}

export function reviewBindingFor(ctx: EditionContext, result: EditionResult): ReviewBinding {
  const slot = ctx.policy.items.get(ctx.edition_key)
  if (!slot) throw new Error(`reviewBindingFor: ${ctx.edition_key} 는 제작 범위에 없다`)
  return {
    task_id: ctx.task_id,
    edition_key: ctx.edition_key,
    source_sha256: ctx.source.sha256,
    source_identity_sha256: ctx.source.identity_sha256,
    policy_sha256: ctx.policy.policy_sha256,
    target_sha256: slot.target_sha256,
    edition_sha256: result.edition_sha256,
    activities_sha256: result.activities_sha256,
  }
}

export function reviewBindingSha256(binding: ReviewBinding): string {
  return sha256Canonical(binding)
}

export interface ReviewResult {
  review: ReviewArtifact
  review_sha256: string
  binding_sha256: string
  /** 지금 원문 · 기준 · 목표 · 판본 · 활동과 결속이 모두 같은가. 다르면 옛 판에 대한 기록이다. */
  current: boolean
  mismatched_fields: string[]
}

export function validateReview(
  input: unknown,
  ctx: { edition_key: string; current_binding: ReviewBinding | null; now: Date },
): Checked<ReviewResult> {
  const { value: rv, errors } = parseSchema(ReviewArtifactSchema, input, 'review')
  if (!rv) return done<ReviewResult>(null, errors)

  if (rv.binding.edition_key !== ctx.edition_key) {
    errors.push({ code: 'review_wrong_edition', path: 'review.binding.edition_key', message: '다른 판본의 검수 결과다 — 다른 판본에 재사용하지 않는다' })
  }
  const humanPair = rv.reviewer.kind === 'human' ? rv.provenance === 'human_review' : rv.provenance !== 'human_review'
  if (!humanPair) {
    errors.push({ code: 'review_provenance_mismatch', path: 'review.provenance', message: '검수자 종류와 출처가 맞지 않는다(사람 검수만 human_review)' })
  }
  if (isFuture(rv.reviewed_at, ctx.now)) {
    errors.push({ code: 'time_in_future', path: 'review.reviewed_at', message: '검수 시각이 현재보다 뒤다' })
  }
  const checkIds = new Set<string>()
  rv.checks.forEach((c, i) => {
    if (checkIds.has(c.check)) errors.push({ code: 'duplicate_check', path: `review.checks[${i}]`, message: `${c.check} 가 두 번 있다` })
    checkIds.add(c.check)
  })
  const issueIds = new Set<string>()
  rv.issues.forEach((it, i) => {
    if (issueIds.has(it.issue_id)) errors.push({ code: 'duplicate_id', path: `review.issues[${i}]`, message: `issue_id ${it.issue_id} 가 중복이다` })
    issueIds.add(it.issue_id)
    if (it.severity === 'critical' && it.status === 'accepted_risk') {
      errors.push({ code: 'critical_issue_accepted', path: `review.issues[${i}]`, message: '치명 문제는 위험 수용으로 닫을 수 없다' })
    }
  })
  if (rv.verdict === 'approve') {
    if (rv.checks.some((c) => c.verdict === 'fail' || c.verdict === 'hold')) {
      errors.push({ code: 'review_inconsistent', path: 'review.verdict', message: '실패/보류 항목이 있는데 승인했다' })
    }
    if (rv.issues.some((it) => it.severity === 'critical' && it.status === 'open')) {
      errors.push({ code: 'review_inconsistent', path: 'review.verdict', message: '열린 치명 문제가 있는데 승인했다' })
    }
  }

  const bindingSha = safeHash(rv.binding, 'review.binding', errors)
  const reviewSha = safeHash(rv, 'review', errors)
  if (errors.length > 0 || !bindingSha || !reviewSha) return done<ReviewResult>(null, errors)

  const mismatched: string[] = []
  if (ctx.current_binding) {
    for (const key of Object.keys(ctx.current_binding) as Array<keyof ReviewBinding>) {
      if (rv.binding[key] !== ctx.current_binding[key]) mismatched.push(key)
    }
  }
  const current = ctx.current_binding !== null && mismatched.length === 0
  return done({ review: rv, review_sha256: reviewSha, binding_sha256: bindingSha, current, mismatched_fields: mismatched }, errors)
}
