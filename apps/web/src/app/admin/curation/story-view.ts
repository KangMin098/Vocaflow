// apps/web/src/app/admin/curation/story-view.ts
//
// LCP Story S4 — 이야기 판본 라인의 화면 모델(순수 함수 · 클라이언트에서 import 가능 · 서버 호출 없음).
//
//   · 비교: 선택한 단위의 원문 앵커를 원문 문단 안에서 [start, end) UTF-16 구간으로 강조하고,
//           그 단위에 닿는 변경 기록과 같은 문단의 생략(omit) 기록만 골라 준다(원문 전체를 쏟지 않는다).
//   · 상태: 판본 자리 · 검수 · 권리 · 발행본 상태 문구.
//   · 다음 행동: (판본 자리 | 번들, 보는 계정)에서 하나만 고른다. 화면의 생산자 · 검수자 표기와 보는 계정은
//           안내용이다 — 권한은 서버 · DB 가 매번 다시 판정한다.
//
// 계약: docs/LCP_STORY.md §7(앵커) · §9(검수) · §10(발행) · §14(권리) · §15(노출 게이트).

import type {
  StoryBundle,
  StoryCandidateCheck,
  StoryCoverage,
  StoryEditionKind,
  StoryFailure,
  StoryPlanStatus,
  StoryRegisterStep,
  StoryReviewVerdict,
  StoryRightsAsset,
  StoryRightsStatus,
  StorySlotRow,
  StoryViewer,
} from '@/lib/library/story/types'

// ── 라벨 ───────────────────────────────────────────────────────────────────

export const STORY_KIND_LABEL: Record<StoryEditionKind, string> = {
  story_edition: '서사 보존판',
  easy_reader: '쉬운 읽기판',
}

export const STORY_COVERAGE_LABEL: Record<StoryCoverage, string> = {
  complete_work: '작품 전체',
  episode: '에피소드',
  excerpt: '발췌',
}

export const STORY_VERDICT_LABEL: Record<StoryReviewVerdict, string> = {
  approve: '승인',
  changes_requested: '수정 요청',
  hold: '보류',
  reject: '반려',
}

export const STORY_RIGHTS_STATUS_LABEL: Record<StoryRightsStatus, string> = {
  confirmed: '확인',
  hold: '보류',
  rejected: '거부',
}

export const STORY_RIGHTS_ASSET_LABEL: Record<StoryRightsAsset, string> = {
  source_text: '원문 텍스트',
  translation: '번역',
  audio: '오디오',
  illustration: '삽화',
}

/** 이 화면에서 권리를 결정할 수 있는 자산 — 본문을 이루는 둘뿐이다(오디오 · 삽화는 지원하지 않는다). */
export const STORY_TEXT_RIGHTS_ASSETS = ['source_text', 'translation'] as const satisfies readonly StoryRightsAsset[]

export const STORY_PLAN_LABEL: Record<StoryPlanStatus, string> = {
  candidate: '후보 — DB 검수 · 권리 결정 · 검증 증인이 아직 필요합니다',
  hold: '관리자 초안으로만 저장 · 학습자 발행 아님',
  fixture_only: '합성 자료 — 적재할 수 없음',
  pending: '판본 결과가 아직 없습니다',
}

/**
 * 후보 검사의 계획 판정 문구. S2 plan 은 합성 자료라도 검수가 없으면 상태를 hold 로 내고 합성 사유(blocks:'fixture')를 함께 준다 —
 * 그 경우 「관리자 초안으로 저장」이 아니라 적재 불가다(서버도 fixture 사유가 하나라도 있으면 등록을 거부한다).
 */
export function candidatePlanLabel(edition: {
  plan_status: StoryPlanStatus
  plan_reasons: ReadonlyArray<{ blocks: 'release' | 'fixture' }>
}): string {
  if (edition.plan_status === 'fixture_only' || edition.plan_reasons.some((reason) => reason.blocks === 'fixture')) {
    return STORY_PLAN_LABEL.fixture_only
  }
  return STORY_PLAN_LABEL[edition.plan_status]
}

export const STORY_CHANGE_OPERATION_LABEL: Record<string, string> = {
  rewrite: '고쳐 씀',
  condense: '줄임',
  omit: '생략',
  gloss: '낱말 풀이',
  context_note: '배경 설명',
}

export const STORY_CHANGE_TYPE_LABEL: Record<string, string> = {
  language_modernization: '현대어화',
  level_adaptation: '수준 조정',
  renarration: '재서사',
  editorial_note: '편집 주석',
}

export function shortHash(value: string | null | undefined, length = 12): string {
  if (!value) return '없음'
  return value.length > length ? value.slice(0, length) : value
}

/** 시각을 UTC 분 단위로 고정 표기한다(로케일 · 시간대에 따라 글자가 바뀌지 않게). 해석할 수 없으면 원문 그대로. */
export function formatStoryTime(iso: string | null | undefined): string {
  if (!iso) return '없음'
  const time = new Date(iso)
  if (Number.isNaN(time.getTime())) return iso
  return `${time.toISOString().slice(0, 16).replace('T', ' ')} UTC`
}

export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} B`
  return `${(bytes / 1000).toFixed(bytes < 100_000 ? 1 : 0)} KB`
}

/** 저장값 그대로의 원천 URL 을 링크로 걸어도 되는가 — http/https 만. 값은 고치지 않는다. */
export function safeSourceHref(raw: unknown): string | null {
  if (typeof raw !== 'string' || raw.length === 0) return null
  // URL 파서는 앞뒤 공백 · 제어 문자를 조용히 지운다 — 저장값이 그런 모양이면 고쳐 걸지 않고 글자로만 보인다.
  if (!/^https?:\/\/\S+$/i.test(raw)) return null
  for (let index = 0; index < raw.length; index++) {
    const code = raw.charCodeAt(index)
    if (code < 0x20 || code === 0x7f) return null
  }
  try {
    const url = new URL(raw)
    return url.protocol === 'http:' || url.protocol === 'https:' ? raw : null
  } catch {
    return null
  }
}

// ── 판본 결과물 읽기(저장된 jsonb 를 방어적으로) ───────────────────────────────

export interface ViewAnchor {
  paragraph: number
  start: number
  end: number
  quote: string
}

export interface ViewUnit {
  unit_id: string
  order: number
  title: string | null
  text: string
  anchors: ViewAnchor[]
  preserves: string[]
}

export interface ViewChange {
  change_id: string
  type: string
  operation: string
  unit_ids: string[]
  anchors: ViewAnchor[]
  rationale: string
  learner_note: string | null
}

export interface ViewArtifact {
  title: string | null
  edition_key: string | null
  hook: { text: string; anchors: ViewAnchor[] } | null
  units: ViewUnit[]
  changes: ViewChange[]
  asset_count: number
  activity_count: number
  /** 파일이 주장한 생산자 — 권한 근거가 아니다. */
  producer_claim: { agent: string; provenance: string } | null
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)
const str = (value: unknown): string | null => (typeof value === 'string' ? value : null)
const int = (value: unknown): number | null =>
  typeof value === 'number' && Number.isInteger(value) ? value : null

function readAnchors(raw: unknown): ViewAnchor[] {
  if (!Array.isArray(raw)) return []
  const out: ViewAnchor[] = []
  for (const item of raw) {
    if (!isRecord(item)) continue
    const paragraph = int(item.paragraph)
    const start = int(item.start)
    const end = int(item.end)
    if (paragraph === null || start === null || end === null) continue
    out.push({ paragraph, start, end, quote: str(item.quote) ?? '' })
  }
  return out
}

export function readStoryArtifact(artifact: Record<string, unknown> | null | undefined): ViewArtifact {
  const a = isRecord(artifact) ? artifact : {}
  const units: ViewUnit[] = (Array.isArray(a.units) ? a.units : [])
    .filter(isRecord)
    .map((unit, index) => ({
      unit_id: str(unit.unit_id) ?? `unit-${index + 1}`,
      order: int(unit.order) ?? index + 1,
      title: str(unit.title),
      text: str(unit.text) ?? '',
      anchors: readAnchors(unit.source_anchors),
      preserves: Array.isArray(unit.preserves) ? unit.preserves.filter((p): p is string => typeof p === 'string') : [],
    }))
    .sort((left, right) => left.order - right.order)
  const changes: ViewChange[] = (Array.isArray(a.change_log) ? a.change_log : [])
    .filter(isRecord)
    .map((change, index) => ({
      change_id: str(change.change_id) ?? `change-${index + 1}`,
      type: str(change.type) ?? '',
      operation: str(change.operation) ?? '',
      unit_ids: Array.isArray(change.unit_ids) ? change.unit_ids.filter((u): u is string => typeof u === 'string') : [],
      anchors: readAnchors(change.source_anchors),
      rationale: str(change.rationale) ?? '',
      learner_note: str(change.learner_note),
    }))
  const hook = isRecord(a.hook) ? { text: str(a.hook.text) ?? '', anchors: readAnchors(a.hook.source_anchors) } : null
  const produced = isRecord(a.produced_by) ? a.produced_by : null
  return {
    title: str(a.title),
    edition_key: str(a.edition_key),
    hook,
    units,
    changes,
    asset_count: Array.isArray(a.assets) ? a.assets.length : 0,
    activity_count: Array.isArray(a.activities) ? a.activities.length : 0,
    producer_claim: produced
      ? { agent: str(produced.agent) ?? '', provenance: str(produced.provenance) ?? '' }
      : null,
  }
}

// ── 비교 모델 ───────────────────────────────────────────────────────────────
//
// 앵커 오프셋은 **원천 본문 전체** 기준 UTF-16 [start, end) 이고, `paragraph` 는 그 구간이 들어 있어야 하는 문단 번호다
// (S2 text.ts checkSourceAnchor 와 같은 규칙 — 패키지는 node:crypto 를 쓰므로 여기서 같은 분할을 직접 한다).
// 검사는 전역 구간으로 하고, 문단 안 강조로 그릴 때만 문단 시작을 뺀다.

export function splitStoryParagraphs(body: string): string[] {
  return body.length === 0 ? [] : body.split('\n\n')
}

export interface StoryParagraphSpan {
  index: number
  start: number
  end: number
}

/** 문단 구간(본문 전체 기준, 구분자 `\n\n` 제외) — S2 paragraphSpans 와 같은 결과. */
export function storyParagraphSpans(body: string): StoryParagraphSpan[] {
  if (body.length === 0) return []
  const spans: StoryParagraphSpan[] = []
  let start = 0
  let index = 0
  for (;;) {
    const separator = body.indexOf('\n\n', start)
    const end = separator === -1 ? body.length : separator
    spans.push({ index, start, end })
    if (separator === -1) break
    start = separator + 2
    index += 1
  }
  return spans
}

function splitsSurrogate(text: string, offset: number): boolean {
  if (offset <= 0 || offset >= text.length) return false
  const before = text.charCodeAt(offset - 1)
  const after = text.charCodeAt(offset)
  return before >= 0xd800 && before <= 0xdbff && after >= 0xdc00 && after <= 0xdfff
}

export type MarkKind = 'unit' | 'omit'

export interface ParagraphSegment {
  text: string
  mark: MarkKind | null
}

export interface MarkRange {
  start: number
  end: number
  kind: MarkKind
}

/**
 * 문단을 강조 구간으로 자른다. 구간은 문단 길이로 자르고, 겹치면 합친다(단위 강조가 생략 표시보다 우선).
 * 오프셋은 JS 문자열 인덱스(UTF-16) — 앵커 계약과 같은 단위다.
 */
export function segmentParagraph(text: string, ranges: readonly MarkRange[]): ParagraphSegment[] {
  const marks: (MarkKind | null)[] = new Array(text.length).fill(null)
  const ordered = [...ranges].sort((left, right) => (left.kind === right.kind ? 0 : left.kind === 'omit' ? -1 : 1))
  for (const range of ordered) {
    const start = Math.max(0, Math.min(text.length, range.start))
    const end = Math.max(start, Math.min(text.length, range.end))
    for (let index = start; index < end; index++) marks[index] = range.kind
  }
  const segments: ParagraphSegment[] = []
  let index = 0
  while (index < text.length) {
    const mark = marks[index]
    let next = index + 1
    while (next < text.length && marks[next] === mark) next++
    segments.push({ text: text.slice(index, next), mark })
    index = next
  }
  return segments
}

export interface ComparisonParagraph {
  index: number
  segments: ParagraphSegment[]
}

export type AnchorProblem = 'range_invalid' | 'splits_surrogate' | 'paragraph_missing' | 'outside_paragraph' | 'quote_mismatch'

export interface AnchorCheck {
  anchor: ViewAnchor
  /** 저장 원문 전체에서 같은 구간을 잘라 인용과 같고, 적힌 문단 안에 있는가. 아니면 화면이 그 사실을 표시한다(검증은 증인이 다시 한다). */
  matches: boolean
  problem: AnchorProblem | null
}

export interface StoryComparison {
  paragraph_total: number
  units: ViewUnit[]
  unit: ViewUnit | null
  paragraphs: ComparisonParagraph[]
  anchors: AnchorCheck[]
  /** 그 단위를 unit_ids 로 가리키는 변경 기록. */
  changes: ViewChange[]
  /** 그 단위의 앵커와 같은 문단에 있는 생략 기록(생략은 단위가 없어서 앵커 문단으로 잇는다). */
  omits: ViewChange[]
  hook: { text: string; anchors: AnchorCheck[] } | null
}

export function checkStoryAnchor(body: string, spans: readonly StoryParagraphSpan[], anchor: ViewAnchor): AnchorCheck {
  const fail = (problem: AnchorProblem): AnchorCheck => ({ anchor, matches: false, problem })
  const { start, end } = anchor
  if (!Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end > body.length || start >= end) {
    return fail('range_invalid')
  }
  if (splitsSurrogate(body, start) || splitsSurrogate(body, end)) return fail('splits_surrogate')
  const span = spans[anchor.paragraph]
  if (!span) return fail('paragraph_missing')
  if (start < span.start || end > span.end) return fail('outside_paragraph')
  if (body.slice(start, end) !== anchor.quote) return fail('quote_mismatch')
  return { anchor, matches: true, problem: null }
}

export function buildStoryComparison(
  bundle: Pick<StoryBundle, 'source' | 'version'>,
  selectedUnitId: string | null
): StoryComparison {
  const body = bundle.source.body
  const spans = storyParagraphSpans(body)
  const artifact = readStoryArtifact(bundle.version.artifact)
  const unit = artifact.units.find((item) => item.unit_id === selectedUnitId) ?? artifact.units[0] ?? null
  const unitParagraphs = new Set((unit?.anchors ?? []).map((anchor) => anchor.paragraph))
  const changes = unit
    ? artifact.changes.filter((change) => change.operation !== 'omit' && change.unit_ids.includes(unit.unit_id))
    : []
  const omits = unit
    ? artifact.changes.filter(
        (change) =>
          change.operation === 'omit' &&
          (change.unit_ids.includes(unit.unit_id) || change.anchors.some((anchor) => unitParagraphs.has(anchor.paragraph)))
      )
    : []
  // 강조는 범위가 올바르고 적힌 문단 안에 든 앵커만 그린다(인용 불일치는 그리되 불일치로 따로 센다 —
  // 구간이 실제로 가리키는 글을 보여 줘야 무엇이 어긋났는지 보인다). 그릴 때만 문단 시작을 뺀다.
  const ranges = new Map<number, MarkRange[]>()
  const add = (anchor: ViewAnchor, kind: MarkKind) => {
    const check = checkStoryAnchor(body, spans, anchor)
    if (check.problem !== null && check.problem !== 'quote_mismatch') return
    const span = spans[anchor.paragraph]!
    const list = ranges.get(span.index) ?? []
    list.push({ start: anchor.start - span.start, end: anchor.end - span.start, kind })
    ranges.set(span.index, list)
  }
  for (const anchor of unit?.anchors ?? []) add(anchor, 'unit')
  for (const change of omits) for (const anchor of change.anchors) add(anchor, 'omit')
  const shown = [...ranges.keys()].sort((left, right) => left - right)
  return {
    paragraph_total: spans.length,
    units: artifact.units,
    unit,
    paragraphs: shown.map((index) => {
      const span = spans[index]!
      return { index, segments: segmentParagraph(body.slice(span.start, span.end), ranges.get(index)!) }
    }),
    anchors: (unit?.anchors ?? []).map((anchor) => checkStoryAnchor(body, spans, anchor)),
    changes,
    omits,
    hook: artifact.hook
      ? { text: artifact.hook.text, anchors: artifact.hook.anchors.map((anchor) => checkStoryAnchor(body, spans, anchor)) }
      : null,
  }
}

// ── 권리 · 상태 ─────────────────────────────────────────────────────────────

/** 본문 열람에 필요한 권리 — 원문, 그리고 원작 언어 ≠ 본문 언어이거나 스냅숏이 번역 권리를 주장하면 번역(DB required_rights 와 같은 규칙). */
export function requiredStoryRights(source: Pick<StoryBundle['source'], 'meta'>): Array<'source_text' | 'translation'> {
  const meta = isRecord(source.meta) ? source.meta : {}
  const work = isRecord(meta.work) ? meta.work : {}
  const edition = isRecord(meta.edition) ? meta.edition : {}
  const claims = Array.isArray(meta.rights) ? meta.rights.filter(isRecord) : []
  const translated =
    (str(work.original_language) ?? '') !== (str(edition.text_language) ?? '') ||
    claims.some((claim) => claim.asset === 'translation')
  return translated ? ['source_text', 'translation'] : ['source_text']
}

export interface RightsRow {
  asset: 'source_text' | 'translation'
  decision: StoryBundle['rights'][number] | null
  confirmed: boolean
}

export function storyRightsRows(bundle: Pick<StoryBundle, 'source' | 'rights'>): RightsRow[] {
  return requiredStoryRights(bundle.source).map((asset) => {
    const decision = bundle.rights.find((item) => item.asset === asset) ?? null
    return { asset, decision, confirmed: decision?.status === 'confirmed' }
  })
}

/**
 * 목록 한 줄의 상태. list_slots 의 검수 수는 그 자리 **모든 판**의 합계라 현재 판의 검수 자격을 뜻하지 않는다 —
 * 그래서 여기서는 누적 이력만 중립으로 말하고, 현재 판 판정은 선택한 번들(bundle.reviews)에서만 한다(nextStoryAction).
 */
export function storySlotState(slot: StorySlotRow): string {
  if (slot.live_release_key) return '발행 중'
  if (!slot.latest_version_id) return '판본 미제출'
  if (slot.review_count === 0) return '검수 기록 없음'
  return '판본 제출됨 — 현재 판 상태는 열어서 확인'
}

/** 목록의 누적 이력 문구(모든 판 합계). */
export function storySlotHistory(slot: StorySlotRow): string {
  return `판 ${slot.version_count} · 검수 기록 ${slot.review_count}건 · 자격 ${slot.qualifying_review_count}건(모든 판) · 철회 ${slot.withdrawn_release_count}`
}

export function releaseStateLabel(release: StoryBundle['releases'][number]): string {
  if (release.withdrawn_at) return '철회됨'
  return release.available ? '열람 가능' : '권리 미확인으로 열람 닫힘'
}

// ── 실패 분류 ───────────────────────────────────────────────────────────────

const STALE_CODES = new Set([
  'not_latest_version',
  'edition_binding_stale',
  'review_binding_mismatch',
  'review_binding_stale',
  'attestation_binding_mismatch',
  'witness_binding_mismatch',
  'witness_input_mismatch',
  'edition_version_not_found',
])

/** 화면이 들고 있는 상태가 낡았다는 뜻의 실패 — 「최신 상태 다시 불러오기」를 낸다. */
export function isStaleStoryFailure(failure: Pick<StoryFailure, 'code'>): boolean {
  return STALE_CODES.has(failure.code.replace(/^story:/, ''))
}

// ── 후보 파일 ───────────────────────────────────────────────────────────────

export type StoryUploadSlot = 'source' | 'policy' | 'edition'

/** 단계마다 서버로 보내는 파일 — 서버는 매 단계 올린 파일 전체를 다시 검증한다. */
export const STORY_STEP_FILES: Record<StoryRegisterStep, StoryUploadSlot[]> = {
  source: ['source'],
  policy: ['source', 'policy'],
  edition: ['source', 'policy', 'edition'],
}

export function uploadTotal(files: Partial<Record<StoryUploadSlot, { size: number } | null>>, slots: readonly StoryUploadSlot[]): number {
  return slots.reduce((sum, slot) => sum + (files[slot]?.size ?? 0), 0)
}

/** 이 단계를 등록할 수 있는가 — 같은 파일 선택으로 한 검사 결과가 근거. 서버가 다시 검증한다. */
export function storyRegisterGate(
  step: StoryRegisterStep,
  check: StoryCandidateCheck | null
): { ok: true } | { ok: false; reason: string } {
  if (!check) return { ok: false, reason: '먼저 파일 검사를 실행하세요.' }
  for (const file of STORY_STEP_FILES[step]) {
    const result = check.files.find((item) => item.file === file)
    if (!result) return { ok: false, reason: '이 단계에 필요한 파일이 검사되지 않았습니다.' }
    if (!result.ok) return { ok: false, reason: '검사에서 문제가 난 파일이 있습니다. 고친 파일로 다시 검사하세요.' }
  }
  if (check.source?.synthetic) return { ok: false, reason: '합성 자료 — 적재할 수 없음' }
  if (step === 'edition') {
    if (!check.edition) return { ok: false, reason: '판본 결과물이 검사되지 않았습니다.' }
    if (check.edition.plan_status === 'fixture_only') return { ok: false, reason: '합성 자료 — 적재할 수 없음' }
    if (check.edition.plan_status === 'pending') return { ok: false, reason: '판본 결과가 아직 없습니다.' }
    if (!check.importable) return { ok: false, reason: '검사 결과가 적재 가능하지 않습니다.' }
  }
  return { ok: true }
}

// ── 다음 행동 하나 ──────────────────────────────────────────────────────────

export type StoryActionKind =
  | 'reopen_files'
  | 'load_bundle'
  | 'reload_latest'
  | 'resubmit_edition'
  | 'submit_review'
  | 'record_rights'
  | 'attest'
  | 'publish'
  | 'withdraw'

export interface StoryNextAction {
  kind: StoryActionKind
  title: string
  reason: string
  /** 보는 계정이 이 행동을 할 수 없을 때의 설명(버튼은 막히고, 할 수 있는 사람을 알려 준다). */
  blocked: string | null
}

export const STORY_PRODUCER_BLOCK = '이 판을 제출한 계정은 검수·발행할 수 없습니다 — 다른 인증 스태프가 필요합니다'
export const STORY_ADMIN_ONLY = 'admin 전용 — admin 계정으로 로그인해 진행해야 합니다'

/**
 * 판본 자리의 출처 구분자 — 원천 · 편집 기준 등록 id 전체(같은 작품 · 판본 키의 서로 다른 자리를 목록에서 가른다).
 * 앞부분만 자르면 id 끼리 겹칠 수 있어 줄이지 않는다(화면은 줄바꿈해 보인다).
 */
export function storySlotOrigin(slot: Pick<StorySlotRow, 'source_id' | 'policy_id'>): string {
  return `원천 ${slot.source_id} · 기준 ${slot.policy_id}`
}

/**
 * 지금 판 · 지금 검수 전부로 발행하면 나올 발행 키(서버가 DB 결속에서 계산)가 이미 철회된 발행본의 키인가.
 * 옛 판의 철회본은 키가 달라 새 판 발행을 막지 않는다. 키를 모르면(null) 막지 않는다 — 실제 판정은 DB 가 한다.
 */
export function withdrawnWithSameBinding(bundle: StoryBundle): boolean {
  const key = bundle.prospective_release_key
  if (!key) return false
  return bundle.releases.some((release) => release.withdrawn_at !== null && release.release_key === key)
}

export function nextStoryAction(input: {
  slot: StorySlotRow
  bundle: StoryBundle | null
  viewer: StoryViewer | null
}): StoryNextAction {
  const { slot, bundle, viewer } = input
  const isAdmin = viewer?.role === 'admin'
  if (!slot.latest_version_id) {
    return {
      kind: 'reopen_files',
      title: '원천·편집 기준 파일을 다시 열기',
      reason:
        '이 자리에는 아직 제출된 판본이 없습니다. 같은 원천 스냅숏 · 편집 기준 파일과 판본 결과물을 올려 판본 제출을 이어 갑니다.',
      blocked: null,
    }
  }
  if (!bundle) {
    return { kind: 'load_bundle', title: '판본 불러오는 중', reason: '최신 판의 원문 · 판본 · 검수 상태를 읽고 있습니다.', blocked: null }
  }
  if (!bundle.version.is_latest || bundle.version.id !== slot.latest_version_id) {
    return {
      kind: 'reload_latest',
      title: '최신 판 다시 불러오기',
      reason: '지금 보는 판 뒤에 새 판이 제출됐습니다. 검수 · 증인 · 발행은 최신 판에만 합니다.',
      blocked: null,
    }
  }
  const submittedByViewer = viewer !== null && viewer.uid === bundle.version.submitted_by
  const live = bundle.releases.find((release) => !release.withdrawn_at) ?? null
  // 번들의 발행본은 판이 아니라 **자리 전체**의 것이다(옛 판의 발행본일 수 있다) — 자리 단위로만 말한다.
  if (live) {
    if (!bundle.rights_ok) {
      return {
        kind: 'record_rights',
        title: '권리 다시 결정',
        reason: `이 자리에 발행본이 있지만(발행 키 ${live.release_key}) 필요한 권리의 최신 결정이 「확인」이 아니라 학습자 열람이 닫혀 있습니다. 근거와 함께 다시 확인하면 즉시 열립니다.`,
        blocked: isAdmin ? null : STORY_ADMIN_ONLY,
      }
    }
    return {
      kind: 'withdraw',
      title: '이 자리에 열린 발행본 — 필요하면 철회',
      reason: `이 자리에 학습자에게 열린 발행본이 있습니다 — 발행 키 ${live.release_key}. 같은 자리에는 살아 있는 발행본이 하나뿐이라 새로 발행하려면 먼저 철회해야 합니다. 철회는 사유가 필요하고 이력 · 진도는 보존됩니다.`,
      blocked: isAdmin ? null : STORY_ADMIN_ONLY,
    }
  }
  const artifact = readStoryArtifact(bundle.version.artifact)
  if (artifact.asset_count > 0) {
    return {
      kind: 'resubmit_edition',
      title: '글 판본으로 새 판 제출',
      reason: '자산(오디오 · 삽화 · 퀴즈)을 선언한 판본은 발행할 수 없습니다. 지금은 글 판본만 발행합니다.',
      blocked: null,
    }
  }
  // 같은 판 · 같은 검수 집합으로 이미 발행했다가 철회했다면 다시 발행해도 발행 키가 같아 DB 가 story:release_key_exists 로 거부한다.
  if (withdrawnWithSameBinding(bundle)) {
    return {
      kind: 'resubmit_edition',
      title: '새 판 제출',
      reason:
        '이 판은 지금의 검수 그대로 이미 발행됐다가 철회됐습니다. 같은 판 · 같은 검수로는 발행 키가 같아 다시 발행할 수 없습니다(철회본도 키를 차지합니다). 고친 판본을 새 판으로 제출하고 다시 검수합니다.',
      blocked: null,
    }
  }
  if (bundle.reviews.length === 0) {
    return {
      kind: 'submit_review',
      title: '다른 스태프의 검수 결과 올리기',
      reason: '이 판에는 아직 검수가 없습니다. 판을 제출한 계정이 아닌 다른 인증 스태프가 검수 파일을 올려야 합니다.',
      blocked: submittedByViewer ? STORY_PRODUCER_BLOCK : null,
    }
  }
  if (bundle.reviews.some((review) => !review.qualifies)) {
    return {
      kind: 'resubmit_edition',
      title: '새 판 제출',
      reason: '발행 자격이 없는 검수(보류 · 수정 요청 · 미통과 항목 · 열린 주요 문제)가 있어 이 판은 발행할 수 없습니다. 고친 판본을 새 판으로 제출하고 다시 검수합니다.',
      blocked: null,
    }
  }
  if (!bundle.rights_ok) {
    return {
      kind: 'record_rights',
      title: 'admin 권리 결정',
      reason: '본문을 이루는 권리(원문, 필요하면 번역)의 최신 결정이 모두 확인이어야 발행할 수 있습니다. 파일의 권리 기록은 주장일 뿐입니다.',
      blocked: isAdmin ? null : STORY_ADMIN_ONLY,
    }
  }
  if (!bundle.validation.attested) {
    return {
      kind: 'attest',
      title: '검증 증인 — 검증 실행',
      reason: '저장된 원천 · 편집 기준 · 판본 · 검수 전부를 서버가 검증기로 다시 검사해, 지금 결속에 대한 증명을 남겨야 발행할 수 있습니다.',
      blocked: null,
    }
  }
  return {
    kind: 'publish',
    title: 'admin 발행',
    reason: '검수 · 권리 · 검증 증명이 지금 판에 맞습니다. 발행하면 학습자 서가에 텍스트 판본이 열립니다.',
    blocked: !isAdmin ? STORY_ADMIN_ONLY : submittedByViewer ? STORY_PRODUCER_BLOCK : null,
  }
}
