// apps/web/src/lib/library/story/learner.ts
//
// LCP Story S5 — 학습자 서가 · 판본 독서 서버 로직(서버 전용). 페이지(RSC)와 서버 액션(app/(main)/library/stories/actions.ts)이
// 쿠키 세션 클라이언트를 좁은 모양(StoryLearnerClient)으로 넣어 부른다. 계약: docs/LCP_STORY.md §12 · §13 · §15 · §17 ·
// 공유 타입 ./learner-types.ts · DB 정본 S3 `20261025094450_lcp_story_s3_schema.sql` 학습자 RPC 5개 +
// S5 `public.story_reader_context(p_release_key text, p_unit_index integer) returns jsonb` ·
// U1(T-0187 · dev 원장20261026110732) `public.story_release_guidance(p_release_key text default null)`(supabase/migrations/20261026110732_lcp_story_u1_guidance.sql) ·
// W2(T-0189 · 미적용 제안) `public.story_unit_context_notes(p_release_key text, p_unit_index integer) returns jsonb`
// (supabase/migrations/_pending_lcp_story_w2_context_notes.sql — 함수가 없으면 「불러오지 못함」).
//
// 학습자 판정 = DB story.require_learner 와 같다: 쿠키 세션의 auth.getUser() 사용자가 있어야 하고, user_profiles.status 가
//   'suspended' · 'deleted' 면 막는다(프로필 행이 없으면 막지 않는다 — isUsableAccount). 프로필 조회가 실패하면 닫는다(학습자 RPC 를 부르지 않는다).
//   스태프 판정(active · 역할)은 쓰지 않는다. DEV_ADMIN_BYPASS · 서비스 주체 클라이언트를 import 하지 않는다. 호출자가 보낸 사용자 id 는 받지 않는다
//   (DB 가 auth.uid() 로 다시 강제한다).
// 선택 안내(story_release_guidance)는 공개 읽기다 — anon/사용자 쿠키 클라이언트로만 부르고, 실패는 「불러오지 못함」(주의 없음이 아니다)으로 돌려준다.
// 화면 렌더(GET) 경로(loadStoryCatalogPage · loadStoryReaderPage)는 위치 기록 · 단위 완료를 부르지 않는다 — 그 둘은 명시적 행동의 서버 액션에서만 부른다.
// 모든 RPC 응답은 런타임으로 검사해 허용 목록 필드만 새로 만든다(해시 · 내부 id 는 버린다). 본문은 저장값 그대로 돌려준다(다듬지 않는다).
// viewerId = 그 요청에서 쿠키 세션 getUser 로 확인한 본인 uid(개인 상태 결속용). RPC 인자 · 권한 근거로 쓰지 않는다.
// 실패는 throw 하지 않고 StoryLearnerFailure(한국어 한 줄 · DB 원문 없음)로 돌려준다. 로그 · 텔레메트리를 남기지 않는다(id · 본문 · URL 이 새지 않게).
// 시계를 읽지 않는다.

import 'server-only'

import { isUsableAccount } from '../../auth/account'
import { loginUrlWithReturn } from '../../auth/redirect'
import type {
  StoryCatalogPageState,
  StoryGuidanceLevel,
  StoryGuidanceState,
  StoryGuidanceUnavailableReason,
  StoryReleaseGuidance,
  StoryReleaseGuidanceView,
  StoryCatalogRelease,
  StoryCompleteInput,
  StoryCompletionLabel,
  StoryContextNote,
  StoryContextNotesView,
  StoryCoverage,
  StoryKind,
  StoryLearnerFailure,
  StoryLearnerFailureCode,
  StoryLearnerResult,
  StoryPositionInput,
  StoryPositionReason,
  StoryPositionResult,
  StoryProgressRow,
  StoryReaderContext,
  StoryReaderPageState,
  StoryReaderProgress,
  StoryReaderSource,
  StoryReaderTocEntry,
  StorySourceAnchor,
  StorySourceCoverage,
  StoryUnitBody,
  StoryUnitCompletionResult,
} from './learner-types'

// ── 의존성(좁은 인터페이스 — 실제 Supabase 쿠키 클라이언트는 페이지 · 액션 경계에서 이 모양으로 넘긴다) ────────────

export interface StoryLearnerDbError {
  message?: unknown
  code?: unknown
  details?: unknown
  hint?: unknown
}

export interface StoryLearnerRpcResponse {
  data: unknown
  error: StoryLearnerDbError | null
}

export interface StoryLearnerProfileResponse {
  data: { status?: unknown } | null
  error: StoryLearnerDbError | null
}

/** 학습자 라인이 부르는 RPC 전부(관리 · 증인 RPC 는 이 라인에서 부를 수 없다). */
export type StoryLearnerRpcName =
  | 'story_catalog'
  | 'story_my_progress'
  | 'story_reader_context'
  | 'story_read_unit'
  | 'story_record_position'
  | 'story_complete_unit'
  | 'story_release_guidance'
  | 'story_unit_context_notes'

/** 쿠키 세션 클라이언트(anon 키 + 사용자 JWT · 비로그인이면 anon). */
export interface StoryLearnerClient {
  auth: { getUser(): PromiseLike<{ data: { user: { id: string } | null } | null; error: unknown }> }
  from(table: 'user_profiles'): {
    select(columns: 'status'): {
      eq(column: 'user_id', value: string): { maybeSingle(): PromiseLike<StoryLearnerProfileResponse> }
    }
  }
  rpc(fn: StoryLearnerRpcName, args?: Record<string, unknown>): PromiseLike<StoryLearnerRpcResponse>
}

export interface StoryLearnerDeps {
  client: StoryLearnerClient
}

// ── 실패 ───────────────────────────────────────────────────────────────

export const STORY_LEARNER_MESSAGES: Readonly<Record<StoryLearnerFailureCode, string>> = {
  auth_required: '로그인하면 이 이야기를 읽을 수 있어요.',
  account_blocked: '이 계정은 지금 이야기를 읽을 수 없어요.',
  release_unavailable: '이 판본은 지금 읽을 수 없어요.',
  unit_not_found: '이 판본에는 그 장면이 없어요.',
  reader_not_ready: '이 판본의 읽기 화면은 아직 준비 중이에요.',
  reader_data_invalid: '이 판본의 읽기 자료를 확인하지 못했어요.',
  invalid_input: '주소나 요청이 올바르지 않아요.',
  viewer_changed: '로그인 계정이 바뀌어 저장하지 않았어요. 화면을 다시 불러와 주세요.',
  temporary: '잠시 연결이 불안정해요. 다시 시도해 주세요.',
}

/** 실패 값 — 매번 새 객체. 다시 시도해 볼 만한 것은 일시 오류뿐이다. */
export function storyLearnerFailure(code: StoryLearnerFailureCode): StoryLearnerFailure {
  return { ok: false, code, message: STORY_LEARNER_MESSAGES[code], retryable: code === 'temporary' }
}

const fail = storyLearnerFailure

// ── 입력 형식 ─────────────────────────────────────────────────────────

export const STORY_RELEASE_KEY_RE = /^lsr_[0-9a-f]{32}$/
/** 단위 번호 상한(입력 · 응답 공통). 정준 10진 표기만 받는다(앞자리 0 · 부호 · 공백 · 소수 없음). */
export const STORY_MAX_UNIT_INDEX = 9999
const UNIT_PARAM_RE = /^(0|[1-9][0-9]{0,3})$/
const POSITION_REASONS: readonly StoryPositionReason[] = ['start', 'resume', 'navigate']

export function isStoryReleaseKey(v: unknown): v is string {
  return typeof v === 'string' && STORY_RELEASE_KEY_RE.test(v)
}

function isUnitIndex(v: unknown): v is number {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= STORY_MAX_UNIT_INDEX
}

/** `?unit=` 해석. 없으면 null(작품 입구). 여러 값 · 빈 값 · 정준 표기가 아닌 값 · 상한 초과는 거부. */
export function parseStoryUnitParam(raw: string | string[] | undefined): { ok: true; unit: number | null } | { ok: false } {
  if (raw === undefined) return { ok: true, unit: null }
  if (typeof raw !== 'string' || !UNIT_PARAM_RE.test(raw)) return { ok: false }
  const n = Number(raw)
  return isUnitIndex(n) ? { ok: true, unit: n } : { ok: false }
}

// ── 런타임 검사 도구 ──────────────────────────────────────────────────

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function nonEmpty(v: unknown): v is string {
  return typeof v === 'string' && v !== ''
}

function strOrNull(v: unknown): v is string | null {
  return v === null || typeof v === 'string'
}

function nonEmptyOrNull(v: unknown): v is string | null {
  return v === null || nonEmpty(v)
}

function isCount(v: unknown): v is number {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0
}

/** 판본 단위 수: 1..STORY_MAX_UNIT_INDEX+1. */
function isUnitCount(v: unknown): v is number {
  return isCount(v) && v > 0 && v <= STORY_MAX_UNIT_INDEX + 1
}

const KINDS: readonly StoryKind[] = ['story_edition', 'easy_reader']
const COVERAGES: readonly StoryCoverage[] = ['complete_work', 'episode', 'excerpt']
const SOURCE_COVERAGES: readonly StorySourceCoverage[] = ['complete_work', 'excerpt']
const COMPLETION_LABELS: readonly StoryCompletionLabel[] = ['adapted_full_work', 'adapted_partial']
const LANG_RE = /^[a-z]{2,3}$/
const SHA256_RE = /^[0-9a-f]{64}$/

function oneOf<T extends string>(list: readonly T[], v: unknown): v is T {
  return typeof v === 'string' && (list as readonly string[]).includes(v)
}

// ── RPC 호출 · 오류 대응 ─────────────────────────────────────────────

const STORY_CODE_RE = /story:[a-z_]+/
const STORY_CODE_MAP: Readonly<Record<string, StoryLearnerFailureCode>> = {
  'story:auth_required': 'auth_required',
  'story:account_blocked': 'account_blocked',
  'story:release_unavailable': 'release_unavailable',
  'story:unit_not_found': 'unit_not_found',
  'story:reader_context_mismatch': 'reader_data_invalid',
  'story:guidance_mismatch': 'reader_data_invalid',
  'story:context_notes_mismatch': 'reader_data_invalid',
}

function isMissingFunction(error: StoryLearnerDbError, text: string): boolean {
  if (error.code === 'PGRST202' || error.code === '42883') return true
  if (/could not find the function/i.test(text)) return true
  return /\bfunction\b[\s\S]*\bdoes not exist\b/i.test(text)
}

/** 이 환경에 아직 없을 수 있는(제안 SQL 미적용) 읽기 RPC — 함수가 없으면 reader_not_ready 다. */
const MAY_BE_MISSING: readonly StoryLearnerRpcName[] = ['story_reader_context', 'story_release_guidance', 'story_unit_context_notes']

/**
 * DB 오류 → 학습자 실패. story:* 코드가 먼저다. 함수가 없으면(PGRST202 · 42883) 읽기 문맥 · 선택 안내 · 맥락 설명 RPC 만 reader_not_ready
 * (SQL 미적용 — 꾸민 목차 · 앵커 · 진도 · 안내로 대신하지 않는다)이고, 나머지는 일시 오류다. DB 원문은 싣지 않는다.
 */
export function mapStoryLearnerRpcError(error: StoryLearnerDbError, fn: StoryLearnerRpcName): StoryLearnerFailure {
  const text = [error.message, error.details, error.hint].filter((s): s is string => typeof s === 'string').join(' ')
  const found = STORY_CODE_RE.exec(text)
  if (found) return fail(STORY_CODE_MAP[found[0]] ?? 'temporary')
  if (isMissingFunction(error, text)) return fail(MAY_BE_MISSING.includes(fn) ? 'reader_not_ready' : 'temporary')
  return fail('temporary')
}

async function callRpc(
  client: StoryLearnerClient,
  fn: StoryLearnerRpcName,
  args: Record<string, unknown>,
): Promise<{ ok: true; data: unknown } | StoryLearnerFailure> {
  let res: StoryLearnerRpcResponse
  try {
    res = await client.rpc(fn, args)
  } catch {
    return fail('temporary')
  }
  if (!isRecord(res)) return fail('temporary')
  if (res.error) return mapStoryLearnerRpcError(isRecord(res.error) ? res.error : {}, fn)
  return { ok: true, data: res.data }
}

// ── 학습자 판정 ────────────────────────────────────────────────────────

/** 인증 서버에 닿지 못한 getUser 오류(재시도 가능) — 로그아웃으로 보지 않는다. */
function isRetryableAuthError(error: unknown): boolean {
  if (!isRecord(error)) return false
  if (error.name === 'AuthRetryableFetchError') return true
  const status = error.status
  return typeof status === 'number' && (status === 0 || status >= 500)
}

/** 실패해도 쿠키 세션 사용자가 확인됐으면 sessionUserId 를 남긴다(서가의 signedIn · viewerId 용 — 학습자 RPC 근거가 아니다). */
type LearnerCheck = { ok: true; userId: string } | { ok: false; failure: StoryLearnerFailure; sessionUserId: string | null }

async function checkLearner(client: StoryLearnerClient): Promise<LearnerCheck> {
  let uid: string
  try {
    const res = await client.auth.getUser()
    const user = res?.data?.user
    if (!user || typeof user.id !== 'string' || user.id === '') {
      const retry = res?.error ? isRetryableAuthError(res.error) : false
      return { ok: false, failure: fail(retry ? 'temporary' : 'auth_required'), sessionUserId: null }
    }
    if (res.error) return { ok: false, failure: fail('auth_required'), sessionUserId: null }
    uid = user.id
  } catch {
    return { ok: false, failure: fail('temporary'), sessionUserId: null }
  }

  let profile: StoryLearnerProfileResponse
  try {
    profile = await client.from('user_profiles').select('status').eq('user_id', uid).maybeSingle()
  } catch {
    return { ok: false, failure: fail('temporary'), sessionUserId: uid }
  }
  // 조회 실패는 닫는다(fail closed). 행이 없는 것은 허용(DB require_learner 와 같음).
  if (!isRecord(profile) || profile.error || (profile.data !== null && !isRecord(profile.data))) {
    return { ok: false, failure: fail('temporary'), sessionUserId: uid }
  }
  const status = profile.data?.status
  if (!isUsableAccount(typeof status === 'string' ? status : null)) {
    return { ok: false, failure: fail('account_blocked'), sessionUserId: uid }
  }
  return { ok: true, userId: uid }
}

/**
 * 쿠키 세션의 학습자 판정(DB story.require_learner 와 같은 정책). 실패하면 호출자는 학습자 RPC 를 부르지 않는다.
 * userId 는 서버 안의 안내용이다 — 어떤 RPC 인자로도 넘기지 않는다(DB 가 auth.uid() 로 판정).
 */
export async function resolveStoryLearner(client: StoryLearnerClient): Promise<{ ok: true; userId: string } | StoryLearnerFailure> {
  const r = await checkLearner(client)
  return r.ok ? r : r.failure
}

// ── 응답 검사(허용 목록 구성) ──────────────────────────────────────────

/** `story_catalog()` 행 하나. */
function parseCatalogRow(raw: unknown): StoryCatalogRelease | null {
  if (!isRecord(raw)) return null
  const { release_key, work_key, edition_key, kind, coverage, completion_label, title, hook_text, unit_count, target_cefr, published_at } = raw
  if (
    !isStoryReleaseKey(release_key) ||
    !nonEmpty(work_key) ||
    !nonEmpty(edition_key) ||
    !oneOf(KINDS, kind) ||
    !oneOf(COVERAGES, coverage) ||
    !oneOf(COMPLETION_LABELS, completion_label) ||
    !nonEmpty(title) ||
    typeof hook_text !== 'string' ||
    !isUnitCount(unit_count) ||
    !nonEmptyOrNull(target_cefr) ||
    !nonEmpty(published_at)
  ) {
    return null
  }
  return {
    releaseKey: release_key,
    workKey: work_key,
    editionKey: edition_key,
    kind,
    coverage,
    completionLabel: completion_label,
    title,
    hookText: hook_text,
    unitCount: unit_count,
    targetCefr: target_cefr,
    publishedAt: published_at,
  }
}

/** `story_catalog()` 전체. 한 행이라도 계약과 다르거나 발행 키가 겹치면 null(빈 서가로 바꾸지 않는다). */
export function parseStoryCatalog(data: unknown): StoryCatalogRelease[] | null {
  if (!Array.isArray(data)) return null
  const out: StoryCatalogRelease[] = []
  const seen = new Set<string>()
  for (const raw of data) {
    const row = parseCatalogRow(raw)
    if (!row || seen.has(row.releaseKey)) return null
    seen.add(row.releaseKey)
    out.push(row)
  }
  return out
}

const CEFRS: readonly string[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']
const GUIDANCE_LEVELS: readonly StoryGuidanceLevel[] = ['low', 'moderate', 'high']
/**
 * 주의 문장 하나 — S2 Text 계약(packages/library-pipeline/src/story/schema.ts)과 같은 「JS trim 뒤 비어 있지 않은 문자열」.
 * 개수 · 길이 상한은 S2 에 없으므로 두지 않는다(유효한 발행 데이터를 거부하지 않는다). 값은 다듬지 않고 그대로 넘긴다.
 */
function isCaution(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== ''
}

/**
 * `story_release_guidance` 응답. 열거한 다섯 필드만 새로 만들고(다른 키는 읽지 않는다) 형식 · 범위가 하나라도 어긋나거나
 * 발행 키가 겹치면 null(호출자는 「확인하지 못함」으로 다룬다 — 「주의 없음」으로 바꾸지 않는다).
 */
export function parseStoryGuidance(data: unknown): StoryReleaseGuidance[] | null {
  if (!Array.isArray(data)) return null
  const out: StoryReleaseGuidance[] = []
  const seen = new Set<string>()
  for (const raw of data) {
    if (!isRecord(raw)) return null
    const { release_key, target_cefr, cognitive_demand, background_load, cautions } = raw
    if (
      !isStoryReleaseKey(release_key) ||
      seen.has(release_key) ||
      typeof target_cefr !== 'string' ||
      !CEFRS.includes(target_cefr) ||
      !oneOf(GUIDANCE_LEVELS, cognitive_demand) ||
      !oneOf(GUIDANCE_LEVELS, background_load) ||
      !Array.isArray(cautions) ||
      !cautions.every(isCaution)
    ) {
      return null
    }
    seen.add(release_key)
    out.push({
      releaseKey: release_key,
      targetCefr: target_cefr,
      cognitiveDemand: cognitive_demand,
      backgroundLoad: background_load,
      cautions: [...cautions],
    })
  }
  return out
}

function guidanceReason(failure: StoryLearnerFailure): StoryGuidanceUnavailableReason {
  if (failure.code === 'reader_not_ready') return 'not_ready'
  if (failure.code === 'reader_data_invalid') return 'invalid'
  return 'temporary'
}

/**
 * 선택 안내 조회(공개 · 쓰기 없음). releaseKey 가 null 이면 이용 가능한 전부를 한 번에(서가 — N+1 없음), 있으면 그 하나.
 * 받은 행은 같은 요청의 서가 행과 대조한다 — 서가에 있는 발행본의 편집 목표 CEFR 가 다르면 결속 불일치로 전체를 invalid 로 닫는다.
 * 서가에 없는 행(두 조회 사이 발행 · 권리 변화)은 버린다.
 */
async function loadGuidance(
  client: StoryLearnerClient,
  catalog: readonly StoryCatalogRelease[],
  releaseKey: string | null,
): Promise<StoryGuidanceState> {
  const res = await callRpc(client, 'story_release_guidance', releaseKey === null ? {} : { p_release_key: releaseKey })
  if (!res.ok) return { status: 'unavailable', reason: guidanceReason(res) }
  const rows = parseStoryGuidance(res.data)
  if (!rows) return { status: 'unavailable', reason: 'invalid' }
  if (releaseKey !== null && rows.some((r) => r.releaseKey !== releaseKey)) return { status: 'unavailable', reason: 'invalid' }
  const byKey = new Map(catalog.map((r) => [r.releaseKey, r]))
  const byRelease: Record<string, StoryReleaseGuidance> = {}
  for (const row of rows) {
    const rel = byKey.get(row.releaseKey)
    if (!rel) continue
    if (rel.targetCefr !== row.targetCefr) return { status: 'unavailable', reason: 'invalid' }
    byRelease[row.releaseKey] = row
  }
  return { status: 'ready', byRelease }
}

/** 발행본 하나의 안내. 안내 조회는 됐는데 그 발행본 행이 없으면 「불러오지 못함」이다(주의 없음이 아니다). */
export function releaseGuidanceView(state: StoryGuidanceState, releaseKey: string): StoryReleaseGuidanceView {
  if (state.status === 'unavailable') return state
  const guidance = state.byRelease[releaseKey]
  return guidance ? { status: 'ready', guidance } : { status: 'unavailable', reason: 'temporary' }
}

/** 서가 메타가 없어(조회 실패 · 없는 키) 안내를 부르지 않은 경우. */
const GUIDANCE_NOT_LOADED: StoryReleaseGuidanceView = { status: 'unavailable', reason: 'temporary' }

/**
 * `story_unit_context_notes` 응답. 요청한 발행 키 · 단위와 같아야 하고, notes 는 배열 · 원소마다 id(비어 있지 않은 문자열 · 중복 없음) ·
 * text(S2 Text 계약과 같은 「JS trim 뒤 비어 있지 않은 문자열」)여야 한다. 개수 · 길이 상한은 두지 않는다(S2 에 없다).
 * 두 필드만 새로 만들고 다른 키는 읽지 않는다. 하나라도 어긋나면 null(「설명 없음」으로 바꾸지 않는다). 본문은 저장값 그대로.
 */
export function parseStoryContextNotes(
  data: unknown,
  expected: { releaseKey: string; unitIndex: number },
): { releaseKey: string; unitIndex: number; notes: StoryContextNote[] } | null {
  if (!isRecord(data)) return null
  const { release_key, unit_index, notes } = data
  if (release_key !== expected.releaseKey || !isStoryReleaseKey(release_key)) return null
  if (unit_index !== expected.unitIndex || !isUnitIndex(unit_index)) return null
  if (!Array.isArray(notes)) return null
  const out: StoryContextNote[] = []
  const seen = new Set<string>()
  for (const raw of notes) {
    if (!isRecord(raw)) return null
    const { id, text } = raw
    if (!nonEmpty(id) || seen.has(id) || typeof text !== 'string' || text.trim() === '') return null
    seen.add(id)
    out.push({ id, text })
  }
  return { releaseKey: release_key, unitIndex: unit_index, notes: out }
}

/**
 * 단위 하나의 시대적 맥락 설명(학습자 · 쓰기 없음). 본문을 이미 받은 뒤에만 부른다. 실패는 unavailable 이유로만 돌려준다 —
 * 독서 화면 · 진도 · 완료 판정을 바꾸지 않는다(함수 없음 → not_ready · 결속/모양 불일치 → invalid · 나머지 → temporary).
 */
async function loadContextNotes(client: StoryLearnerClient, releaseKey: string, unitIndex: number): Promise<StoryContextNotesView> {
  const res = await callRpc(client, 'story_unit_context_notes', { p_release_key: releaseKey, p_unit_index: unitIndex })
  if (!res.ok) return { status: 'unavailable', reason: guidanceReason(res) }
  const parsed = parseStoryContextNotes(res.data, { releaseKey, unitIndex })
  if (!parsed) return { status: 'unavailable', reason: 'invalid' }
  return { status: 'ready', ...parsed }
}

/** `story_my_progress()` 전체. */
export function parseStoryProgress(data: unknown): StoryProgressRow[] | null {
  if (!Array.isArray(data)) return null
  const out: StoryProgressRow[] = []
  const seen = new Set<string>()
  for (const raw of data) {
    if (!isRecord(raw)) return null
    const {
      release_key,
      work_key,
      edition_key,
      completion_label,
      counts_as_work_completion,
      counts_as_original_text_completion,
      last_unit_index,
      furthest_unit_index,
      completed_unit_count,
      unit_count,
      completed_at,
      release_available,
    } = raw
    if (
      !isStoryReleaseKey(release_key) ||
      seen.has(release_key) ||
      !nonEmpty(work_key) ||
      !nonEmpty(edition_key) ||
      !oneOf(COMPLETION_LABELS, completion_label) ||
      typeof counts_as_work_completion !== 'boolean' ||
      counts_as_work_completion !== (completion_label === 'adapted_full_work') ||
      counts_as_original_text_completion !== false ||
      !isUnitCount(unit_count) ||
      !isCount(last_unit_index) ||
      !isCount(furthest_unit_index) ||
      !isCount(completed_unit_count) ||
      last_unit_index > furthest_unit_index ||
      furthest_unit_index >= unit_count ||
      completed_unit_count > unit_count ||
      !nonEmptyOrNull(completed_at) ||
      (completed_at !== null && completed_unit_count !== unit_count) ||
      typeof release_available !== 'boolean'
    ) {
      return null
    }
    seen.add(release_key)
    out.push({
      releaseKey: release_key,
      workKey: work_key,
      editionKey: edition_key,
      completionLabel: completion_label,
      countsAsWorkCompletion: counts_as_work_completion,
      countsAsOriginalTextCompletion: false,
      lastUnitIndex: last_unit_index,
      furthestUnitIndex: furthest_unit_index,
      completedUnitCount: completed_unit_count,
      unitCount: unit_count,
      completedAt: completed_at,
      releaseAvailable: release_available,
    })
  }
  return out
}

function parseAnchor(raw: unknown): StorySourceAnchor | null {
  if (!isRecord(raw)) return null
  const { paragraph, start, end, quote } = raw
  if (!isCount(paragraph) || !isCount(start) || !isCount(end) || start >= end || !nonEmpty(quote)) return null
  return { paragraph, start, end, quote }
}

function parseSource(raw: unknown): StoryReaderSource | null {
  if (!isRecord(raw)) return null
  const { identity_sha256, text_sha256, title, author, original_language, text_language, translator, edition_label, coverage, source_url } = raw
  // 해시는 계약상 있어야 하지만 화면으로 보내지 않는다(아래에서 버린다).
  if (
    typeof identity_sha256 !== 'string' ||
    !SHA256_RE.test(identity_sha256) ||
    typeof text_sha256 !== 'string' ||
    !SHA256_RE.test(text_sha256) ||
    !nonEmpty(title) ||
    !nonEmptyOrNull(author) ||
    typeof original_language !== 'string' ||
    !LANG_RE.test(original_language) ||
    typeof text_language !== 'string' ||
    !LANG_RE.test(text_language) ||
    !nonEmptyOrNull(translator) ||
    (original_language === text_language) !== (translator === null) ||
    !nonEmpty(edition_label) ||
    !oneOf(SOURCE_COVERAGES, coverage) ||
    !strOrNull(source_url)
  ) {
    return null
  }
  // source_url 은 저장값 그대로(다듬지 않는다 — 링크 안전 처리는 화면 책임).
  return {
    title,
    author,
    originalLanguage: original_language,
    textLanguage: text_language,
    translator,
    editionLabel: edition_label,
    coverage,
    sourceUrl: source_url,
  }
}

/**
 * `story_reader_context` 응답 검사. 요청한 발행 키 · 단위와 같아야 하고, 목차는 정확히 0..unitCount-1 순서,
 * 진도 · 목차 완료 수가 서로 맞아야 한다. 해시 · offset_unit 은 검사만 하고 버린다.
 */
export function parseStoryReaderContext(data: unknown, expected: { releaseKey: string; unitIndex: number }): StoryReaderContext | null {
  if (!isRecord(data)) return null
  const {
    release_key,
    work_key,
    edition_key,
    kind,
    coverage,
    completion_label,
    counts_as_work_completion,
    counts_as_original_text_completion,
    title,
    unit_count,
    progress,
    toc,
    unit,
    source,
  } = data
  if (
    release_key !== expected.releaseKey ||
    !isStoryReleaseKey(release_key) ||
    !nonEmpty(work_key) ||
    !nonEmpty(edition_key) ||
    !oneOf(KINDS, kind) ||
    !oneOf(COVERAGES, coverage) ||
    !oneOf(COMPLETION_LABELS, completion_label) ||
    typeof counts_as_work_completion !== 'boolean' ||
    counts_as_work_completion !== (completion_label === 'adapted_full_work') ||
    counts_as_original_text_completion !== false ||
    !nonEmpty(title) ||
    !isUnitCount(unit_count)
  ) {
    return null
  }

  // 목차
  if (!Array.isArray(toc) || toc.length !== unit_count) return null
  const tocOut: StoryReaderTocEntry[] = []
  let tocCompleted = 0
  for (const [i, raw] of toc.entries()) {
    if (!isRecord(raw) || raw.unit_index !== i || !strOrNull(raw.unit_title) || typeof raw.completed !== 'boolean') return null
    if (raw.completed) tocCompleted += 1
    tocOut.push({ unitIndex: i, unitTitle: raw.unit_title, completed: raw.completed })
  }

  // 진도(이 학습자 것 · 없으면 null)
  let progressOut: StoryReaderProgress | null = null
  if (progress !== null) {
    if (!isRecord(progress)) return null
    const { last_unit_index, furthest_unit_index, completed_unit_count, completed } = progress
    if (
      !isCount(last_unit_index) ||
      !isCount(furthest_unit_index) ||
      !isCount(completed_unit_count) ||
      typeof completed !== 'boolean' ||
      last_unit_index > furthest_unit_index ||
      furthest_unit_index >= unit_count ||
      completed_unit_count > unit_count ||
      completed_unit_count !== tocCompleted ||
      (completed && completed_unit_count !== unit_count)
    ) {
      return null
    }
    progressOut = {
      lastUnitIndex: last_unit_index,
      furthestUnitIndex: furthest_unit_index,
      completedUnitCount: completed_unit_count,
      completed,
    }
  } else if (tocCompleted !== 0) {
    return null
  }

  // 고른 단위 · 원문 앵커
  if (!isRecord(unit)) return null
  if (unit.unit_index !== expected.unitIndex || !isUnitIndex(unit.unit_index) || unit.unit_index >= unit_count) return null
  const tocEntry = tocOut[unit.unit_index]
  if (!tocEntry || !strOrNull(unit.unit_title) || unit.unit_title !== tocEntry.unitTitle) return null
  if (unit.offset_unit !== 'utf16_code_unit') return null
  if (!Array.isArray(unit.anchors) || unit.anchors.length === 0) return null
  const anchors: StorySourceAnchor[] = []
  for (const raw of unit.anchors) {
    const a = parseAnchor(raw)
    if (!a) return null
    anchors.push(a)
  }

  const sourceOut = parseSource(source)
  if (!sourceOut) return null

  return {
    releaseKey: release_key,
    workKey: work_key,
    editionKey: edition_key,
    kind,
    coverage,
    completionLabel: completion_label,
    countsAsWorkCompletion: counts_as_work_completion,
    countsAsOriginalTextCompletion: false,
    title,
    unitCount: unit_count,
    progress: progressOut,
    toc: tocOut,
    unit: { unitIndex: unit.unit_index, unitTitle: unit.unit_title, anchors },
    source: sourceOut,
  }
}

/** returns table RPC 의 단일 행(정확히 한 행이어야 한다). */
function singleRow(data: unknown): Record<string, unknown> | null {
  if (Array.isArray(data)) return data.length === 1 && isRecord(data[0]) ? data[0] : null
  return isRecord(data) ? data : null
}

/** `story_read_unit` 응답(본문은 저장값 그대로). */
export function parseStoryUnitBody(data: unknown): StoryUnitBody | null {
  const row = singleRow(data)
  if (!row) return null
  const { release_key, unit_index, unit_count, unit_title, unit_text } = row
  if (
    !isStoryReleaseKey(release_key) ||
    !isUnitIndex(unit_index) ||
    !isUnitCount(unit_count) ||
    unit_index >= unit_count ||
    !strOrNull(unit_title) ||
    !nonEmpty(unit_text)
  ) {
    return null
  }
  return { releaseKey: release_key, unitIndex: unit_index, unitCount: unit_count, unitTitle: unit_title, text: unit_text }
}

/** `story_record_position` 응답. */
export function parseStoryPositionResult(data: unknown): Omit<StoryPositionResult, 'viewerId'> | null {
  const row = singleRow(data)
  if (!row) return null
  const { release_key, last_unit_index, furthest_unit_index, completed_unit_count, unit_count, completed } = row
  if (
    !isStoryReleaseKey(release_key) ||
    !isUnitCount(unit_count) ||
    !isCount(last_unit_index) ||
    !isCount(furthest_unit_index) ||
    !isCount(completed_unit_count) ||
    typeof completed !== 'boolean' ||
    last_unit_index > furthest_unit_index ||
    furthest_unit_index >= unit_count ||
    completed_unit_count > unit_count ||
    (completed && completed_unit_count !== unit_count)
  ) {
    return null
  }
  return {
    releaseKey: release_key,
    lastUnitIndex: last_unit_index,
    furthestUnitIndex: furthest_unit_index,
    completedUnitCount: completed_unit_count,
    unitCount: unit_count,
    completed,
  }
}

/** `story_complete_unit` 응답. 방금 완료한 단위가 있으므로 완료 수는 1 이상이다. */
export function parseStoryUnitCompletion(data: unknown): Omit<StoryUnitCompletionResult, 'viewerId'> | null {
  const row = singleRow(data)
  if (!row) return null
  const { release_key, unit_index, completed_unit_count, unit_count, completed, completion_label } = row
  if (
    !isStoryReleaseKey(release_key) ||
    !isUnitIndex(unit_index) ||
    !isUnitCount(unit_count) ||
    unit_index >= unit_count ||
    !isCount(completed_unit_count) ||
    completed_unit_count < 1 ||
    completed_unit_count > unit_count ||
    typeof completed !== 'boolean' ||
    (completed && completed_unit_count !== unit_count) ||
    !oneOf(COMPLETION_LABELS, completion_label)
  ) {
    return null
  }
  return {
    releaseKey: release_key,
    unitIndex: unit_index,
    completedUnitCount: completed_unit_count,
    unitCount: unit_count,
    completed,
    completionLabel: completion_label,
  }
}

// ── 서가 화면(GET) ─────────────────────────────────────────────────────

/**
 * 서가 판정. story_catalog 는 anon 도 부를 수 있어 로그인과 무관하게 먼저 부른다(실패 → error, 빈 서가로 바꾸지 않는다).
 * signedIn = 쿠키 세션에 사용자가 있음(viewerId = 그 uid · 없으면 null). 정지 · 삭제 계정도 signedIn=true 지만 진도를 부르지 않고 progressError=account_blocked.
 * 사용자는 있는데 프로필 조회가 실패하면 signedIn=true · progressError=temporary(진도를 부르지 않는다).
 * getUser 자체가 일시 오류면 signedIn=false · progressError=temporary. 이용 가능한 학습자만 story_my_progress 를 부른다.
 * 위치 기록 · 단위 완료를 부르지 않는다.
 */
export async function loadStoryCatalogPage(deps: StoryLearnerDeps): Promise<StoryCatalogPageState> {
  try {
    const client = deps.client
    const cat = await callRpc(client, 'story_catalog', {})
    if (!cat.ok) return { status: 'error', failure: cat }
    const releases = parseStoryCatalog(cat.data)
    if (!releases) return { status: 'error', failure: fail('reader_data_invalid') }
    // 선택 안내는 서가 전체에 한 번. 빈 서가면 부르지 않는다. 실패해도 서가는 그대로다.
    const guidance: StoryGuidanceState =
      releases.length === 0 ? { status: 'ready', byRelease: {} } : await loadGuidance(client, releases, null)

    const learner = await checkLearner(client)
    if (!learner.ok) {
      const signedOut = learner.failure.code === 'auth_required'
      return {
        status: 'ready',
        signedIn: learner.sessionUserId !== null,
        viewerId: learner.sessionUserId,
        releases,
        progress: null,
        progressError: signedOut ? null : learner.failure,
        guidance,
      }
    }

    const viewerId = learner.userId
    const prog = await callRpc(client, 'story_my_progress', {})
    if (!prog.ok) return { status: 'ready', signedIn: true, viewerId, releases, progress: null, progressError: prog, guidance }
    const progress = parseStoryProgress(prog.data)
    if (!progress) {
      return { status: 'ready', signedIn: true, viewerId, releases, progress: null, progressError: fail('reader_data_invalid'), guidance }
    }
    return { status: 'ready', signedIn: true, viewerId, releases, progress, progressError: null, guidance }
  } catch {
    return { status: 'error', failure: fail('temporary') }
  }
}

// ── 독서 화면(GET) ─────────────────────────────────────────────────────

export interface StoryReaderRequest {
  releaseKey: string
  unitParam: string | string[] | undefined
  /** 로그인 뒤 돌아올 내부 경로(페이지가 만든다 — loginUrlWithReturn 이 다시 검사한다). */
  returnPath: string
}

async function catalogRows(client: StoryLearnerClient): Promise<StoryCatalogRelease[] | null> {
  const cat = await callRpc(client, 'story_catalog', {})
  return cat.ok ? parseStoryCatalog(cat.data) : null
}

/** 이 발행본 하나의 선택 안내(같은 요청의 서가 행으로 대조). */
async function guidanceForRelease(
  client: StoryLearnerClient,
  rows: readonly StoryCatalogRelease[],
  releaseKey: string,
): Promise<StoryReleaseGuidanceView> {
  return releaseGuidanceView(await loadGuidance(client, rows, releaseKey), releaseKey)
}

/** 비로그인: 공개 서가 메타 + 시작 전 선택 안내만(본문 · 목차 · 앵커 없음). 서가 조회 실패 · 없는 키는 release=null(안내도 부르지 않는다). */
async function signedOutState(client: StoryLearnerClient, releaseKey: string, returnPath: string): Promise<StoryReaderPageState> {
  const rows = await catalogRows(client)
  const release = rows?.find((r) => r.releaseKey === releaseKey) ?? null
  const guidance = rows && release ? await guidanceForRelease(client, rows, releaseKey) : GUIDANCE_NOT_LOADED
  return { status: 'signed_out', loginHref: loginUrlWithReturn(returnPath), release, guidance }
}

async function readerFailureState(
  client: StoryLearnerClient,
  failure: StoryLearnerFailure,
  req: { releaseKey: string; returnPath: string },
): Promise<StoryReaderPageState> {
  if (failure.code === 'auth_required') return signedOutState(client, req.releaseKey, req.returnPath)
  if (failure.code === 'account_blocked') return { status: 'blocked' }
  return { status: 'unavailable', failure }
}

/** 서가 행과 읽기 문맥이 같은 발행본을 말하는가(둘 다 story.releases 한 행에서 나온다). */
function catalogMatchesContext(row: StoryCatalogRelease, ctx: StoryReaderContext): boolean {
  return (
    row.workKey === ctx.workKey &&
    row.editionKey === ctx.editionKey &&
    row.kind === ctx.kind &&
    row.coverage === ctx.coverage &&
    row.completionLabel === ctx.completionLabel &&
    row.title === ctx.title &&
    row.unitCount === ctx.unitCount
  )
}

/**
 * 독서 화면 판정. 순서: 입력 형식(RPC 전) → 학습자 판정(비로그인 → signed_out · 차단 → blocked, 학습자 RPC 없음) →
 * story_reader_context(unit ?? 0) → `?unit=` 이 있으면 story_read_unit(같은 발행 키 · 단위 · 단위 수 · 제목에 결속) →
 * 본문이 있으면 story_unit_context_notes(실패 = contextNotes unavailable · 독서는 그대로) →
 * 서가 재관찰(이 발행본의 서가 메타 = release · 같은 작품의 다른 발행본 = siblings · 조회 성공인데 이 발행본이 없으면 unavailable ·
 * 조회 실패면 release · siblings 모두 null). 위치 기록 · 단위 완료를 부르지 않는다.
 */
export async function loadStoryReaderPage(deps: StoryLearnerDeps, req: StoryReaderRequest): Promise<StoryReaderPageState> {
  try {
    const client = deps.client
    const releaseKey = req.releaseKey
    if (!isStoryReleaseKey(releaseKey)) return { status: 'unavailable', failure: fail('invalid_input') }
    const unitParsed = parseStoryUnitParam(req.unitParam)
    if (!unitParsed.ok) return { status: 'unavailable', failure: fail('invalid_input') }
    const unit = unitParsed.unit
    const unitIndex = unit ?? 0
    const ctxReq = { releaseKey, returnPath: req.returnPath }

    const learner = await resolveStoryLearner(client)
    if (!learner.ok) return readerFailureState(client, learner, ctxReq)

    const ctxRes = await callRpc(client, 'story_reader_context', { p_release_key: releaseKey, p_unit_index: unitIndex })
    if (!ctxRes.ok) return readerFailureState(client, ctxRes, ctxReq)
    const context = parseStoryReaderContext(ctxRes.data, { releaseKey, unitIndex })
    if (!context) return { status: 'unavailable', failure: fail('reader_data_invalid') }

    let body: StoryUnitBody | null = null
    if (unit !== null) {
      const unitRes = await callRpc(client, 'story_read_unit', { p_release_key: releaseKey, p_unit_index: unit })
      if (!unitRes.ok) return readerFailureState(client, unitRes, ctxReq)
      const parsed = parseStoryUnitBody(unitRes.data)
      if (
        !parsed ||
        parsed.releaseKey !== releaseKey ||
        parsed.unitIndex !== unit ||
        parsed.unitCount !== context.unitCount ||
        parsed.unitTitle !== context.unit.unitTitle
      ) {
        return { status: 'unavailable', failure: fail('reader_data_invalid') }
      }
      body = parsed
    }
    // 맥락 설명은 본문을 받은 단위 화면에서만 · 본문 뒤에 부른다. 실패해도 본문 · 진도 판정은 그대로다(unavailable 로만 남는다).
    const contextNotes = body === null ? null : await loadContextNotes(client, releaseKey, body.unitIndex)

    // 마지막 서가 조회 = 이용 가능 재관찰. 조회는 됐는데 이 발행본이 없으면(읽는 사이 철회 · 권리 보류) 앞서 읽은 본문을 보이지 않고 닫는다.
    // 조회 실패는 「정보를 불러오지 못함」(release · siblings 모두 null)이다.
    const rows = await catalogRows(client)
    if (!rows) {
      return { status: 'ready', viewerId: learner.userId, context, release: null, unit: body, siblings: null, guidance: GUIDANCE_NOT_LOADED, contextNotes }
    }
    const release = rows.find((r) => r.releaseKey === context.releaseKey)
    if (!release) return { status: 'unavailable', failure: fail('release_unavailable') }
    if (!catalogMatchesContext(release, context)) return { status: 'unavailable', failure: fail('reader_data_invalid') }
    const siblings = rows.filter((r) => r.workKey === context.workKey && r.releaseKey !== context.releaseKey)
    // 선택 안내는 작품 입구(?unit 없음)에서만 보인다 — 단위 화면에서는 부르지 않는다. 실패해도 독서는 그대로다.
    const guidance = unit === null ? await guidanceForRelease(client, rows, releaseKey) : GUIDANCE_NOT_LOADED
    return { status: 'ready', viewerId: learner.userId, context, release, unit: body, siblings, guidance, contextNotes }
  } catch {
    return { status: 'unavailable', failure: fail('temporary') }
  }
}

// ── 명시적 행동(서버 액션 전용) ─────────────────────────────────────────

const VIEWER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

function isViewerId(v: unknown): v is string {
  return typeof v === 'string' && VIEWER_ID_RE.test(v)
}

/** 입력 허용 목록 — 다른 키는 읽지도 넘기지도 않는다. expectedViewerId 는 전제 비교에만 쓴다(RPC 인자 · 권한 근거 아님). */
function parsePositionInput(input: unknown): StoryPositionInput | null {
  if (!isRecord(input)) return null
  const { releaseKey, unitIndex, reason, expectedViewerId } = input
  if (!isStoryReleaseKey(releaseKey) || !isUnitIndex(unitIndex) || !oneOf(POSITION_REASONS, reason) || !isViewerId(expectedViewerId)) return null
  return { releaseKey, unitIndex, reason, expectedViewerId }
}

function parseCompleteInput(input: unknown): StoryCompleteInput | null {
  if (!isRecord(input)) return null
  const { releaseKey, unitIndex, expectedViewerId } = input
  if (!isStoryReleaseKey(releaseKey) || !isUnitIndex(unitIndex) || !isViewerId(expectedViewerId)) return null
  return { releaseKey, unitIndex, expectedViewerId }
}

/**
 * 저장 전 공통 문: ① 실제 쿠키 세션 학습자 판정 ② 확인된 uid 가 화면의 전제(expectedViewerId)와 정확히 같아야 한다
 * (다르면 viewer_changed · 그 뒤 RPC 0) ③ 읽기 문맥(같은 발행 키 · 단위)이 준비 · 이용 가능 · 계약 모양이어야 한다
 * (함수 없음 → reader_not_ready · story:* 거부 → 대응 실패 · 모양 불일치 → reader_data_invalid, 모두 저장 RPC 0).
 * 저장 RPC 는 DB 가 권리 · 학습자를 다시 강제한다.
 */
async function mutationPrecheck(
  client: StoryLearnerClient,
  input: { releaseKey: string; unitIndex: number; expectedViewerId: string },
): Promise<{ ok: true; userId: string } | StoryLearnerFailure> {
  const learner = await resolveStoryLearner(client)
  if (!learner.ok) return learner
  if (learner.userId !== input.expectedViewerId) return fail('viewer_changed')
  const ctxRes = await callRpc(client, 'story_reader_context', { p_release_key: input.releaseKey, p_unit_index: input.unitIndex })
  if (!ctxRes.ok) return ctxRes
  if (!parseStoryReaderContext(ctxRes.data, { releaseKey: input.releaseKey, unitIndex: input.unitIndex })) return fail('reader_data_invalid')
  return learner
}

/**
 * 위치 기록(이동만 — 완료를 만들지 않는다). 입력은 StoryPositionInput.
 * reason 은 명시적 행동이라는 표시로 검사만 한다(DB 인자 없음). 형식이 틀리면 getUser · RPC 전에 거부, 그다음 매 호출 저장 전 공통 문.
 * 응답은 같은 발행 키 · 그 단위를 마지막 위치로 돌려줘야 한다.
 */
export async function recordStoryPosition(deps: StoryLearnerDeps, input: unknown): Promise<StoryLearnerResult<StoryPositionResult>> {
  try {
    const parsed = parsePositionInput(input)
    if (!parsed) return fail('invalid_input')
    const learner = await mutationPrecheck(deps.client, parsed)
    if (!learner.ok) return learner
    const res = await callRpc(deps.client, 'story_record_position', { p_release_key: parsed.releaseKey, p_unit_index: parsed.unitIndex })
    if (!res.ok) return res
    const data = parseStoryPositionResult(res.data)
    if (!data || data.releaseKey !== parsed.releaseKey || data.lastUnitIndex !== parsed.unitIndex) return fail('reader_data_invalid')
    return { ok: true, data: { viewerId: learner.userId, ...data } }
  } catch {
    return fail('temporary')
  }
}

/** 단위 하나 완료(학습자의 명시적 표시 · DB 가 재호출 안전). 입력은 StoryCompleteInput. 응답은 같은 발행 키 · 단위를 돌려줘야 한다. */
export async function completeStoryUnit(deps: StoryLearnerDeps, input: unknown): Promise<StoryLearnerResult<StoryUnitCompletionResult>> {
  try {
    const parsed = parseCompleteInput(input)
    if (!parsed) return fail('invalid_input')
    const learner = await mutationPrecheck(deps.client, parsed)
    if (!learner.ok) return learner
    const res = await callRpc(deps.client, 'story_complete_unit', { p_release_key: parsed.releaseKey, p_unit_index: parsed.unitIndex })
    if (!res.ok) return res
    const data = parseStoryUnitCompletion(res.data)
    if (!data || data.releaseKey !== parsed.releaseKey || data.unitIndex !== parsed.unitIndex) return fail('reader_data_invalid')
    return { ok: true, data: { viewerId: learner.userId, ...data } }
  } catch {
    return fail('temporary')
  }
}
