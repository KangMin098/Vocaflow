// apps/web/src/lib/library/story/admin.ts
//
// LCP Story S4 — 관리자 이야기 라인 서버 로직(서버 전용). 서버 액션(app/admin/curation/story-actions.ts)이 실제 의존성을 넣어 부른다.
// 계약: docs/LCP_STORY.md §9 · §10 · §14 · §15 · §18 · DB 정본 supabase/migrations/20261025094450_lcp_story_s3_schema.sql.
//
// 권한: 매 호출 쿠키 세션의 auth.getUser() → user_profiles(role, status) 로 판정한다. status 는 정확히 'active' 여야 하고
//   (DB story.require_staff 와 같음 — isUsableAccount 의 「status 없음 허용」은 여기서 쓰지 않는다) 역할은 admin|curator,
//   권리 결정 · 발행 · 철회는 admin 만. DEV_ADMIN_BYPASS 는 이 라인에 아무 권한도 주지 않는다(devAdminBypass 를 import 하지 않는다).
//   인증이 실패하면 그 뒤의 어떤 RPC 도 부르지 않는다. 관리 RPC 9개는 모두 같은 쿠키 클라이언트로 부르고 DB 가 역할을 다시 강제한다.
//   화면 · 파일이 주장하는 생산자 · 검수자 · 권리 기록은 권한 근거가 아니다(DB 가 auth.uid() 로 기록한다).
// 업로드: 크기(읽기 전) → 엄격 UTF-8 → JSON → 실제 S2 검증기(validateSnapshot → validatePolicy → validateEdition) → decideEdition.
//   등록은 매번 올라온 파일 전부를 처음부터 다시 검증한 뒤에야 첫 RPC 를 부른다(앞 단계 검사 결과를 믿지 않는다).
//   RPC 에는 파싱한 업로드 객체를 그대로 넘긴다(정체 해시에 들어가는 source_url 등을 다듬지 않는다).
// 여러 RPC 중 뒤 단계가 실패하면 앞 단계 결과를 partial 로 돌려준다 — 원자적 롤백이 아니며, 같은 파일 재등록은 기존 행을 돌려받는다.
// 로그 · 텔레메트리를 남기지 않는다(본문 · id · URL 이 새지 않게).

import 'server-only'

import {
  decideEdition,
  reviewBindingFor,
  sha256Canonical,
  snapshotFromStored,
  validateEdition,
  validatePolicy,
  validateReview,
  validateSnapshot,
  type EditionDecision,
  type EditionResult,
  type Issue,
  type PolicyContext,
  type SourceContext,
} from '@vocaflow/library-pipeline/story'

import { describeStoryCode } from './messages'
import {
  STORY_UPLOAD_MAX_BYTES,
  type StoryBundle,
  type StoryCandidateCheck,
  type StoryFailure,
  type StoryFailureStage,
  type StoryFileCheck,
  type StoryIssue,
  type StoryPublishResult,
  type StoryRegisterResult,
  type StoryRegisterStep,
  type StoryResult,
  type StoryReviewSubmitResult,
  type StoryRightsAsset,
  type StoryRightsResult,
  type StoryRightsStatus,
  type StorySlotRow,
  type StoryStaffRole,
  type StoryViewer,
  type StoryWithdrawResult,
} from './types'

// ── 의존성(좁은 인터페이스 — 실제 Supabase 클라이언트는 액션 경계에서 이 모양으로 넘긴다) ─────────────────

export interface StoryDbError {
  message: string
  code?: string
  details?: string | null
  hint?: string | null
}

export interface StoryRpcResponse {
  data: unknown
  error: StoryDbError | null
}

export interface StoryProfileResponse {
  data: { role?: unknown; status?: unknown } | null
  error: StoryDbError | null
}

/** 쿠키 세션 클라이언트(anon 키 + 사용자 JWT). 관리 RPC 9개와 스태프 확인에만 쓴다. */
export interface StoryRpcClient {
  auth: { getUser(): PromiseLike<{ data: { user: { id: string } | null } | null; error: unknown }> }
  from(table: 'user_profiles'): {
    select(columns: 'role, status'): {
      eq(column: 'user_id', value: string): { maybeSingle(): PromiseLike<StoryProfileResponse> }
    }
  }
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<StoryRpcResponse>
}

/** 검증 증인 전용 서비스 주체 클라이언트. 스태프 확인 뒤 witness.ts 에서만 만든다. */
export interface StoryServiceClient {
  rpc(fn: string, args?: Record<string, unknown>): PromiseLike<StoryRpcResponse>
}

export interface StoryDeps {
  client: StoryRpcClient
  /** 시각은 주입만 받는다(액션 경계에서 new Date()). */
  now: () => Date
}

/** FormData 의 읽기 부분. */
export interface StoryFormLike {
  get(name: string): unknown
}

// ── 공용 결과 · 실패 ────────────────────────────────────────────────────

export function failStory(
  code: string,
  stage: StoryFailureStage,
  issues: StoryIssue[] = [],
  partial?: Partial<StoryRegisterResult>,
): StoryFailure {
  const d = describeStoryCode(code)
  const out: StoryFailure = { ok: false, code, message: d.message, recovery: d.recovery, stage, issues, retryable: d.retryable }
  if (partial) out.partial = partial
  return out
}

/** 예기치 못한 예외(클라이언트 생성 실패 등)를 실패로 — 액션은 클라이언트로 throw 하지 않는다. */
export function storyServerError(): StoryFailure {
  return failStory('server_error', 'rpc')
}

function success<T>(viewer: StoryViewer, data: T): StoryResult<T> {
  return { ok: true, viewer, data }
}

export function toIssues(errors: readonly Issue[]): StoryIssue[] {
  return errors.map((e) => ({ code: e.code, path: e.path, message: e.message }))
}

export function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const RELEASE_KEY_RE = /^lsr_[0-9a-f]{32}$/

export function isUuid(v: unknown): v is string {
  return typeof v === 'string' && UUID_RE.test(v)
}

function inputIssue(path: string, message: string): StoryIssue {
  return { code: 'invalid_input', path, message }
}

// ── 스태프 인증 ──────────────────────────────────────────────────────────

export type StoryStaffCheck = { ok: true; viewer: StoryViewer } | StoryFailure

/**
 * 쿠키 세션의 실제 사용자 · 역할 · active 로만 판정한다. 실패하면 호출자는 더 이상 아무것도 부르지 않는다.
 * 반환하는 viewer 는 화면 안내용이다 — DB RPC 가 auth.uid() 로 다시 강제한다.
 */
export async function requireStoryStaff(client: StoryRpcClient, minRole: StoryStaffRole): Promise<StoryStaffCheck> {
  let uid: string
  try {
    const { data, error } = await client.auth.getUser()
    const user = data?.user
    if (error || !user || typeof user.id !== 'string' || user.id === '') return failStory('auth_required', 'auth')
    uid = user.id
  } catch {
    return failStory('network_failed', 'auth')
  }

  let profile: StoryProfileResponse
  try {
    profile = await client.from('user_profiles').select('role, status').eq('user_id', uid).maybeSingle()
  } catch {
    return failStory('network_failed', 'auth')
  }
  if (profile.error) return failStory('profile_unavailable', 'auth')
  if (!profile.data) return failStory('staff_required', 'auth')
  const { role, status } = profile.data
  if (status !== 'active') return failStory('account_inactive', 'auth')
  if (role !== 'admin' && role !== 'curator') return failStory('staff_required', 'auth')
  if (minRole === 'admin' && role !== 'admin') return failStory('admin_required', 'auth')
  return { ok: true, viewer: { uid, role } }
}

// ── RPC 호출 · 오류 대응 ─────────────────────────────────────────────────

const STORY_CODE_RE = /story:[a-z_]+/
const AUTH_CODES = new Set(['story:auth_required', 'story:staff_required', 'story:admin_required', 'story:account_blocked'])
/** 스태프에게 쓸모 있는 DB 상세만 보여 준다(예: 권리 자산별 상태). 나머지 상세는 내부 정보라 싣지 않는다. */
const DETAIL_CODES = new Set(['story:rights_unconfirmed', 'story:scope_invalid', 'story:coverage_claim_invalid'])
const NETWORK_RE = /fetch failed|failed to fetch|network|ECONNREFUSED|ECONNRESET|ENOTFOUND|ETIMEDOUT|timed? ?out|socket hang up/i

export function mapStoryRpcError(error: StoryDbError): StoryFailure {
  const parts = [error.message, error.details, error.hint].filter((s): s is string => typeof s === 'string')
  const found = STORY_CODE_RE.exec(parts.join(' '))
  if (found) {
    const code = found[0]
    const detail = typeof error.details === 'string' ? error.details.trim() : ''
    const issues = DETAIL_CODES.has(code) && detail ? [{ code, path: 'detail', message: detail.slice(0, 200) }] : []
    return failStory(code, AUTH_CODES.has(code) ? 'auth' : 'rpc', issues)
  }
  if (NETWORK_RE.test(parts.join(' '))) return failStory('network_failed', 'rpc')
  return failStory('rpc_failed', 'rpc')
}

export async function callStoryRpc(
  client: { rpc(fn: string, args?: Record<string, unknown>): PromiseLike<StoryRpcResponse> },
  fn: string,
  args: Record<string, unknown>,
): Promise<{ ok: true; data: unknown } | StoryFailure> {
  let res: StoryRpcResponse
  try {
    res = await client.rpc(fn, args)
  } catch {
    return failStory('network_failed', 'rpc')
  }
  if (res.error) return mapStoryRpcError(res.error)
  // data 는 그대로(같은 참조) 돌려준다 — 증인은 DB 응답을 복사 · 정규화하지 않고 어댑터에 넘긴다.
  return { ok: true, data: res.data }
}

/** returns table RPC 의 첫 행. */
export function firstRow(data: unknown): Record<string, unknown> | null {
  const row = Array.isArray(data) ? data[0] : data
  return isRecord(row) ? row : null
}

function unexpected(partial?: Partial<StoryRegisterResult>): StoryFailure {
  return failStory('rpc_unexpected_response', 'rpc', [], partial)
}

function asCount(v: unknown): number | null {
  const n = typeof v === 'number' ? v : typeof v === 'string' && /^\d+$/.test(v) ? Number(v) : Number.NaN
  return Number.isSafeInteger(n) && n >= 0 ? n : null
}

function str(v: unknown): v is string {
  return typeof v === 'string' && v !== ''
}

function strOrNull(v: unknown): v is string | null {
  return v === null || str(v)
}

// ── 업로드 ──────────────────────────────────────────────────────────────

type UploadName = 'source' | 'policy' | 'edition' | 'review'
type UploadJson = Partial<Record<UploadName, unknown>>

interface BlobLike {
  size: number
  arrayBuffer(): Promise<ArrayBuffer>
}

function isBlobLike(v: unknown): v is BlobLike {
  return (
    typeof v === 'object' &&
    v !== null &&
    typeof (v as BlobLike).size === 'number' &&
    typeof (v as BlobLike).arrayBuffer === 'function'
  )
}

/**
 * 이름 붙은 파일 필드만 읽는다. 합계 크기를 「읽기 전」 file.size 로 먼저 막고, 엄격 UTF-8(fatal) → JSON.parse.
 * 오류 문구에 파일 내용을 싣지 않는다.
 */
export async function readJsonUploads(
  form: StoryFormLike,
  specs: ReadonlyArray<{ name: UploadName; required: boolean }>,
): Promise<{ ok: true; json: UploadJson } | StoryFailure> {
  const blobs: Array<{ name: UploadName; blob: BlobLike }> = []
  const missing: StoryIssue[] = []
  for (const spec of specs) {
    const v = form.get(spec.name)
    if (isBlobLike(v) && v.size > 0) {
      blobs.push({ name: spec.name, blob: v })
    } else if (spec.required || (v !== null && v !== undefined && !isBlobLike(v))) {
      missing.push({ code: 'upload_missing_file', path: spec.name, message: `${spec.name} 파일이 없거나 비어 있다` })
    }
  }
  if (missing.length > 0) return failStory('upload_missing_file', 'upload', missing)

  const total = blobs.reduce((sum, b) => sum + b.blob.size, 0)
  if (total > STORY_UPLOAD_MAX_BYTES) {
    return failStory('upload_too_large', 'upload', [
      { code: 'upload_too_large', path: 'files', message: `합계 ${total} 바이트가 한도 ${STORY_UPLOAD_MAX_BYTES} 바이트를 넘는다` },
    ])
  }

  const json: UploadJson = {}
  for (const { name, blob } of blobs) {
    let bytes: ArrayBuffer
    try {
      bytes = await blob.arrayBuffer()
    } catch {
      return failStory('upload_missing_file', 'upload', [{ code: 'upload_missing_file', path: name, message: `${name} 파일을 읽지 못했다` }])
    }
    if (bytes.byteLength > STORY_UPLOAD_MAX_BYTES) {
      return failStory('upload_too_large', 'upload', [{ code: 'upload_too_large', path: name, message: `${name} 파일이 한도를 넘는다` }])
    }
    let text: string
    try {
      text = new TextDecoder('utf-8', { fatal: true }).decode(bytes)
    } catch {
      return failStory('upload_invalid_utf8', 'upload', [{ code: 'upload_invalid_utf8', path: name, message: `${name} 파일이 올바른 UTF-8 이 아니다` }])
    }
    try {
      json[name] = JSON.parse(text) as unknown
    } catch {
      return failStory('upload_invalid_json', 'upload', [{ code: 'upload_invalid_json', path: name, message: `${name} 파일을 JSON 으로 읽을 수 없다` }])
    }
  }
  return { ok: true, json }
}

// ── 후보 재검증(S2 검증기 · plan) ─────────────────────────────────────────

interface CandidateEvaluation {
  check: StoryCandidateCheck
  source: SourceContext | null
  policy: PolicyContext | null
  edition: EditionResult | null
  decision: EditionDecision | null
  /** 등록을 막는 첫 사유(원천 → 기준 → 판본 → plan 순). null 이면 등록 가능. */
  blocked: { code: string; stage: StoryFailureStage; issues: StoryIssue[] } | null
}

function notChecked(file: 'policy' | 'edition', message: string): StoryIssue {
  return { code: 'not_checked', path: file, message }
}

export function evaluateCandidate(json: UploadJson, now: Date): CandidateEvaluation {
  const files: StoryFileCheck[] = []
  const check: StoryCandidateCheck = { source: null, policy: null, edition: null, files, importable: false }
  let source: SourceContext | null = null
  let policy: PolicyContext | null = null
  let edition: EditionResult | null = null
  let decision: EditionDecision | null = null
  let blocked: CandidateEvaluation['blocked'] = null
  const block = (code: string, stage: StoryFailureStage, issues: StoryIssue[]): void => {
    if (!blocked) blocked = { code, stage, issues }
  }

  if (json.source !== undefined) {
    const r = validateSnapshot(json.source, now)
    const issues = toIssues(r.errors)
    if (r.value) {
      source = r.value
      const snap = r.value.snapshot
      check.source = {
        snapshot_id: snap.snapshot_id,
        work_key: snap.work.work_key,
        identity_sha256: r.value.identity_sha256,
        text_sha256: r.value.sha256,
        paragraph_count: r.value.paragraphs.length,
        coverage: snap.coverage,
        synthetic: snap.synthetic,
        rights: snap.rights.map((x) => ({ asset: x.asset, status: x.status })),
      }
      if (snap.synthetic) {
        const issue = { code: 'synthetic_not_allowed', path: 'snapshot.synthetic', message: '합성(시험용) 원천은 등록하지 않는다' }
        issues.push(issue)
        block('synthetic_not_allowed', 'snapshot', [issue])
      }
    } else {
      block('validation_failed', 'snapshot', issues)
    }
    files.push({ file: 'source', ok: issues.length === 0, issues })
  }

  if (json.policy !== undefined) {
    if (!source) {
      const issues = [notChecked('policy', '원천 스냅숏이 검증을 통과해야 편집 기준을 검사할 수 있다')]
      files.push({ file: 'policy', ok: false, issues })
      block('validation_failed', 'policy', issues)
    } else {
      const r = validatePolicy(json.policy, source)
      const issues = toIssues(r.errors)
      if (r.value) {
        policy = r.value
        check.policy = {
          policy_sha256: r.value.policy_sha256,
          editions: r.value.policy.production.map((p) => ({
            edition_key: p.edition_key,
            kind: p.kind,
            coverage: p.coverage,
            transformation: p.transformation,
          })),
        }
      } else {
        block('validation_failed', 'policy', issues)
      }
      files.push({ file: 'policy', ok: issues.length === 0, issues })
    }
  }

  if (json.edition !== undefined) {
    if (!source || !policy) {
      const issues = [notChecked('edition', '원천 스냅숏과 편집 기준이 검증을 통과해야 판본을 검사할 수 있다')]
      files.push({ file: 'edition', ok: false, issues })
      block('validation_failed', 'edition', issues)
    } else {
      const art = isRecord(json.edition) ? json.edition : {}
      const editionKey = typeof art.edition_key === 'string' ? art.edition_key : ''
      const taskId = typeof art.task_id === 'string' ? art.task_id : ''
      const r = validateEdition(json.edition, { source, policy, edition_key: editionKey, task_id: taskId })
      const issues = toIssues(r.errors)
      if (r.value) {
        edition = r.value
        decision = decideEdition({ source, policy, edition_key: editionKey, edition_state: 'valid', edition: r.value, reviews: [] })
        check.edition = {
          edition_key: editionKey,
          edition_sha256: r.value.edition_sha256,
          activities_sha256: r.value.activities_sha256,
          unit_count: r.value.edition.units.length,
          plan_status: decision.status,
          plan_reasons: decision.reasons.map((x) => ({ code: x.code, blocks: x.blocks, message: x.message })),
        }
        if (r.value.edition.assets.length > 0) {
          const issue = { code: 'assets_not_supported', path: 'edition.assets', message: '지금은 글 판본만 받는다 — 자산 선언이 있는 판본은 발행할 수 없다' }
          issues.push(issue)
          block('assets_not_supported', 'edition', [issue])
        }
        // 합성 자료(fixture)는 실제 등록 대상이 아니다 — plan 상태가 hold 여도 fixture 사유가 하나라도 있으면 막는다.
        const fixtureReasons = decision.reasons.filter((x) => x.blocks === 'fixture')
        if (decision.status === 'fixture_only' || fixtureReasons.length > 0) {
          block(
            'plan_fixture_only',
            'plan',
            fixtureReasons.map((x) => ({ code: x.code, path: 'plan', message: x.message })),
          )
        }
      } else {
        block('validation_failed', 'edition', issues)
      }
      files.push({ file: 'edition', ok: issues.length === 0, issues })
    }
  }

  check.importable = blocked === null && source !== null
  return { check, source, policy, edition, decision, blocked }
}

// ── 액션 로직 ────────────────────────────────────────────────────────────

/** 후보 파일 검사(DB 쓰기 없음). 파일 오류는 결과의 files[].issues 로 돌려준다. */
export async function checkStoryCandidate(deps: StoryDeps, form: StoryFormLike): Promise<StoryResult<StoryCandidateCheck>> {
  const auth = await requireStoryStaff(deps.client, 'curator')
  if (!auth.ok) return auth
  const up = await readJsonUploads(form, [
    { name: 'source', required: true },
    { name: 'policy', required: false },
    { name: 'edition', required: false },
  ])
  if (!up.ok) return up
  return success(auth.viewer, evaluateCandidate(up.json, deps.now()).check)
}

function parseSourceRow(data: unknown): StoryRegisterResult['source'] | null {
  const row = firstRow(data)
  if (!row || !isUuid(row.source_id) || !str(row.identity_sha256) || !str(row.text_sha256) || typeof row.created !== 'boolean') return null
  return { source_id: row.source_id, identity_sha256: row.identity_sha256, text_sha256: row.text_sha256, created: row.created }
}

function parsePolicyRows(data: unknown): NonNullable<StoryRegisterResult['policy']> | null {
  if (!Array.isArray(data) || data.length === 0) return null
  const slots: NonNullable<StoryRegisterResult['policy']>['slots'] = []
  let policyId = ''
  let policySha = ''
  let created = false
  for (const [i, raw] of data.entries()) {
    if (!isRecord(raw) || !isUuid(raw.policy_id) || !str(raw.policy_sha256) || !isUuid(raw.slot_id) || !str(raw.edition_key) || !str(raw.target_sha256) || typeof raw.created !== 'boolean') {
      return null
    }
    if (i === 0) {
      policyId = raw.policy_id
      policySha = raw.policy_sha256
      created = raw.created
    } else if (raw.policy_id !== policyId || raw.policy_sha256 !== policySha) {
      return null
    }
    slots.push({ slot_id: raw.slot_id, edition_key: raw.edition_key, target_sha256: raw.target_sha256 })
  }
  return { policy_id: policyId, policy_sha256: policySha, created, slots }
}

/**
 * 후보 등록. step = source | source+policy | source+policy+edition. 매번 올라온 파일 전부를 다시 검증한 뒤에 RPC 를 부르며,
 * 앞 단계 RPC 는 멱등이라(같은 정체 · 같은 기준은 기존 행 created=false) 제출 전 후보는 원천 · 편집 기준 파일을 다시 올려 이어 간다.
 */
export async function registerStoryCandidate(deps: StoryDeps, form: StoryFormLike): Promise<StoryResult<StoryRegisterResult>> {
  const auth = await requireStoryStaff(deps.client, 'curator')
  if (!auth.ok) return auth
  const stepRaw = form.get('step')
  if (stepRaw !== 'source' && stepRaw !== 'policy' && stepRaw !== 'edition') {
    return failStory('invalid_step', 'input', [inputIssue('step', 'step 은 source · policy · edition 중 하나다')])
  }
  const step: StoryRegisterStep = stepRaw
  const up = await readJsonUploads(form, [
    { name: 'source', required: true },
    { name: 'policy', required: step !== 'source' },
    { name: 'edition', required: step === 'edition' },
  ])
  if (!up.ok) return up

  // 첫 변경 전에 전체 입력을 끝까지 다시 검증한다.
  const ev = evaluateCandidate(up.json, deps.now())
  if (ev.blocked) return failStory(ev.blocked.code, ev.blocked.stage, ev.blocked.issues)
  if (!ev.source) return failStory('validation_failed', 'snapshot')

  const client = deps.client
  const srcRes = await callStoryRpc(client, 'story_admin_register_source', { p_snapshot: up.json.source })
  if (!srcRes.ok) return srcRes
  const source = parseSourceRow(srcRes.data)
  if (!source) return unexpected()
  if (source.identity_sha256 !== ev.source.identity_sha256 || source.text_sha256 !== ev.source.sha256) {
    return failStory('source_identity_mismatch', 'rpc', [], { step, source })
  }
  if (step === 'source') return success(auth.viewer, { step, source, policy: null, edition: null })

  if (!ev.policy) return failStory('validation_failed', 'policy', [], { step, source })
  const polRes = await callStoryRpc(client, 'story_admin_register_policy', { p_source_id: source.source_id, p_policy: up.json.policy })
  if (!polRes.ok) return { ...polRes, partial: { step, source } }
  const policy = parsePolicyRows(polRes.data)
  if (!policy) return unexpected({ step, source })
  if (policy.policy_sha256 !== ev.policy.policy_sha256) {
    return failStory('policy_hash_mismatch', 'rpc', [], { step, source, policy })
  }
  if (step === 'policy') return success(auth.viewer, { step, source, policy, edition: null })

  if (!ev.edition || !ev.decision) return failStory('validation_failed', 'edition', [], { step, source, policy })
  const editionKey = ev.edition.edition.edition_key
  const slot = policy.slots.find((s) => s.edition_key === editionKey)
  if (!slot) {
    return failStory('edition_slot_missing', 'edition', [{ code: 'edition_slot_missing', path: 'edition.edition_key', message: `${editionKey} 자리가 없다` }], {
      step,
      source,
      policy,
    })
  }
  const edRes = await callStoryRpc(client, 'story_admin_submit_edition', { p_slot_id: slot.slot_id, p_artifact: up.json.edition })
  if (!edRes.ok) return { ...edRes, partial: { step, source, policy } }
  const row = firstRow(edRes.data)
  if (!row || !isUuid(row.edition_version_id) || !str(row.edition_sha256) || !str(row.activities_sha256) || typeof row.created !== 'boolean') {
    return unexpected({ step, source, policy })
  }
  const edition: NonNullable<StoryRegisterResult['edition']> = {
    slot_id: slot.slot_id,
    edition_version_id: row.edition_version_id,
    edition_sha256: row.edition_sha256,
    activities_sha256: row.activities_sha256,
    created: row.created,
    // hold = 관리자만 보는 초안(학습자 발행 아님). 발행은 검수 · 권리 결정 · 검증 증명 · 발행 단계를 따로 거친다.
    plan_status: ev.decision.status,
  }
  if (edition.edition_sha256 !== ev.edition.edition_sha256 || edition.activities_sha256 !== ev.edition.activities_sha256) {
    return failStory('edition_hash_mismatch', 'rpc', [], { step, source, policy, edition })
  }
  return success(auth.viewer, { step, source, policy, edition })
}

export async function listStorySlots(deps: StoryDeps): Promise<StoryResult<{ slots: StorySlotRow[] }>> {
  const auth = await requireStoryStaff(deps.client, 'curator')
  if (!auth.ok) return auth
  const res = await callStoryRpc(deps.client, 'story_admin_list_slots', {})
  if (!res.ok) return res
  if (!Array.isArray(res.data)) return unexpected()
  const slots: StorySlotRow[] = []
  for (const raw of res.data) {
    if (!isRecord(raw)) return unexpected()
    const counts = [raw.version_count, raw.review_count, raw.qualifying_review_count, raw.withdrawn_release_count].map(asCount)
    const [versionCount, reviewCount, qualifyingCount, withdrawnCount] = counts
    if (
      !isUuid(raw.slot_id) ||
      !str(raw.work_key) ||
      !str(raw.edition_key) ||
      (raw.kind !== 'story_edition' && raw.kind !== 'easy_reader') ||
      (raw.coverage !== 'complete_work' && raw.coverage !== 'episode' && raw.coverage !== 'excerpt') ||
      !isUuid(raw.source_id) ||
      !isUuid(raw.policy_id) ||
      !(raw.latest_version_id === null || isUuid(raw.latest_version_id)) ||
      !strOrNull(raw.live_release_key) ||
      versionCount === null ||
      reviewCount === null ||
      qualifyingCount === null ||
      withdrawnCount === null
    ) {
      return unexpected()
    }
    slots.push({
      slot_id: raw.slot_id,
      work_key: raw.work_key,
      edition_key: raw.edition_key,
      kind: raw.kind,
      coverage: raw.coverage,
      source_id: raw.source_id,
      policy_id: raw.policy_id,
      latest_version_id: raw.latest_version_id,
      version_count: versionCount,
      review_count: reviewCount,
      qualifying_review_count: qualifyingCount,
      live_release_key: raw.live_release_key,
      withdrawn_release_count: withdrawnCount,
    })
  }
  return success(auth.viewer, { slots })
}

/** get_bundle 응답의 최소 모양 확인. 원천 메타(source_url 포함)는 손대지 않고 그대로 둔다. */
export function parseStoryBundle(data: unknown): StoryBundle | null {
  if (!isRecord(data)) return null
  const { source, policy, slot, version, reviews, validation, rights_ok, rights, releases } = data
  if (
    !isRecord(source) ||
    !isUuid(source.id) ||
    !isRecord(source.meta) ||
    typeof source.body !== 'string' ||
    !str(source.text_sha256) ||
    !str(source.identity_sha256) ||
    !isRecord(policy) ||
    !isUuid(policy.id) ||
    !isRecord(policy.policy) ||
    !str(policy.policy_sha256) ||
    !isRecord(slot) ||
    !isUuid(slot.id) ||
    !str(slot.edition_key) ||
    !str(slot.target_sha256) ||
    !isRecord(version) ||
    !isUuid(version.id) ||
    !isRecord(version.artifact) ||
    !str(version.edition_sha256) ||
    !str(version.activities_sha256) ||
    typeof version.is_latest !== 'boolean' ||
    !Array.isArray(reviews) ||
    !reviews.every((r) => isRecord(r) && isRecord(r.review) && typeof r.qualifies === 'boolean') ||
    !isRecord(validation) ||
    !str(validation.binding_sha256) ||
    typeof validation.attested !== 'boolean' ||
    typeof rights_ok !== 'boolean' ||
    !Array.isArray(rights) ||
    !Array.isArray(releases)
  ) {
    return null
  }
  return data as unknown as StoryBundle
}

const SHA256_RE = /^[0-9a-f]{64}$/

/**
 * 지금 판 · 지금 검수 전부로 발행하면 나올 발행 키(화면 안내용 — 실제 발행 허가 · 키는 DB 가 정한다).
 * 입력은 get_bundle 의 validation.binding(DB 가 저장값에서 다시 계산한 결속 — 검수 해시 전부, "C" 순)과 원천 메타의 작품 키 ·
 * 자리의 판본 키뿐이다. 정체 모양은 S2 plan.ts decideEdition · DB story_admin_publish 의 발행 키 정체와 같다(검수가 모두
 * 자격이 있어야 발행되므로 DB 의 "그 판 검수 전부" 와 S2 의 "자격 있는 검수" 가 발행 시점에 같다). 철회된 같은 키가 있으면 재발행은 실패한다.
 */
export function prospectiveReleaseKey(bundle: StoryBundle): string | null {
  const b = bundle.validation.binding
  const work = isRecord(bundle.source.meta.work) ? bundle.source.meta.work : null
  const workKey = work && typeof work.work_key === 'string' ? work.work_key : null
  const fields = ['source_sha256', 'source_identity_sha256', 'policy_sha256', 'target_sha256', 'edition_sha256', 'activities_sha256'] as const
  if (!workKey || !fields.every((f) => typeof b[f] === 'string' && SHA256_RE.test(b[f] as string))) return null
  const reviews = b.review_sha256s
  if (!Array.isArray(reviews) || reviews.length === 0 || !reviews.every((r) => typeof r === 'string' && SHA256_RE.test(r))) return null
  const identity = {
    work_key: workKey,
    edition_key: bundle.slot.edition_key,
    source_identity_sha256: b.source_identity_sha256,
    source_text_sha256: b.source_sha256,
    policy_sha256: b.policy_sha256,
    target_sha256: b.target_sha256,
    edition_sha256: b.edition_sha256,
    activities_sha256: b.activities_sha256,
    review_sha256s: [...(reviews as string[])].sort(),
    quality_contract: 'lcp-story/quality@1',
  }
  return `lsr_${sha256Canonical(identity).slice(0, 32)}`
}

export async function loadStoryBundle(deps: StoryDeps, editionVersionId: unknown): Promise<StoryResult<StoryBundle>> {
  const auth = await requireStoryStaff(deps.client, 'curator')
  if (!auth.ok) return auth
  if (!isUuid(editionVersionId)) return failStory('invalid_input', 'input', [inputIssue('edition_version_id', '판 id 형식이 아니다')])
  const res = await callStoryRpc(deps.client, 'story_admin_get_bundle', { p_edition_version_id: editionVersionId })
  if (!res.ok) return res
  const bundle = parseStoryBundle(res.data)
  if (!bundle || bundle.version.id !== editionVersionId) return unexpected()
  return success(auth.viewer, { ...bundle, prospective_release_key: prospectiveReleaseKey(bundle) })
}

const BINDING_FIELD_LABEL: Readonly<Record<string, string>> = {
  task_id: '작업 id',
  edition_key: '판본 키',
  source_sha256: '원문 본문 해시',
  source_identity_sha256: '원천 판본 정체',
  policy_sha256: '편집 기준',
  target_sha256: '판본 목표',
  edition_sha256: '판본 내용',
  activities_sha256: '활동',
}

/** DB 에 저장된 원천 · 기준 · 판을 S2 검증기로 다시 통과시켜 지금 결속을 계산한다(파일이 주장하는 결속을 믿지 않는다). */
function revalidateStored(
  bundle: StoryBundle,
  now: Date,
): { ok: true; ctx: { source: SourceContext; policy: PolicyContext; edition_key: string; task_id: string }; edition: EditionResult } | StoryFailure {
  const snapshot = snapshotFromStored(bundle.source.meta, bundle.source.body, bundle.source.text_sha256)
  const src = validateSnapshot(snapshot, now)
  if (!src.value) return failStory('stored_invalid', 'snapshot', toIssues(src.errors))
  const pol = validatePolicy(bundle.policy.policy, src.value)
  if (!pol.value) return failStory('stored_invalid', 'policy', toIssues(pol.errors))
  const artifact = bundle.version.artifact
  const taskId = typeof artifact.task_id === 'string' ? artifact.task_id : ''
  const ctx = { source: src.value, policy: pol.value, edition_key: bundle.slot.edition_key, task_id: taskId }
  const ed = validateEdition(artifact, ctx)
  if (!ed.value) return failStory('stored_invalid', 'edition', toIssues(ed.errors))
  return { ok: true, ctx, edition: ed.value }
}

export async function submitStoryReview(deps: StoryDeps, form: StoryFormLike): Promise<StoryResult<StoryReviewSubmitResult>> {
  const auth = await requireStoryStaff(deps.client, 'curator')
  if (!auth.ok) return auth
  const editionVersionId = form.get('edition_version_id')
  if (!isUuid(editionVersionId)) return failStory('invalid_input', 'input', [inputIssue('edition_version_id', '판 id 형식이 아니다')])
  const up = await readJsonUploads(form, [{ name: 'review', required: true }])
  if (!up.ok) return up

  const bundleRes = await callStoryRpc(deps.client, 'story_admin_get_bundle', { p_edition_version_id: editionVersionId })
  if (!bundleRes.ok) return bundleRes
  const bundle = parseStoryBundle(bundleRes.data)
  if (!bundle || bundle.version.id !== editionVersionId) return unexpected()
  if (!bundle.version.is_latest) return failStory('not_latest_version', 'reviews')

  const now = deps.now()
  const stored = revalidateStored(bundle, now)
  if (!stored.ok) return stored
  const r = validateReview(up.json.review, {
    edition_key: bundle.slot.edition_key,
    current_binding: reviewBindingFor(stored.ctx, stored.edition),
    now,
  })
  if (!r.value) return failStory('validation_failed', 'reviews', toIssues(r.errors))
  if (!r.value.current) {
    return failStory(
      'review_binding_stale',
      'reviews',
      r.value.mismatched_fields.map((f) => ({
        code: 'review_binding_stale',
        path: `review.binding.${f}`,
        message: `${BINDING_FIELD_LABEL[f] ?? f} 이(가) 지금 판과 다르다`,
      })),
    )
  }
  if (r.value.review.provenance === 'synthetic_fixture') {
    return failStory('synthetic_not_allowed', 'reviews', [{ code: 'synthetic_not_allowed', path: 'review.provenance', message: '합성 검수는 실제 검토가 아니다' }])
  }
  if (r.value.review.reviewer.session_id === stored.edition.edition.produced_by.session_id) {
    return failStory('self_review_claim', 'reviews', [{ code: 'self_review_claim', path: 'review.reviewer.session_id', message: '검수 세션이 판본 생산 세션과 같다' }])
  }

  const res = await callStoryRpc(deps.client, 'story_admin_submit_review', { p_edition_version_id: editionVersionId, p_review: up.json.review })
  if (!res.ok) return res
  const row = firstRow(res.data)
  if (!row || !isUuid(row.review_id) || !str(row.review_sha256) || typeof row.qualifies !== 'boolean' || typeof row.created !== 'boolean') {
    return unexpected()
  }
  return success(auth.viewer, { review_id: row.review_id, review_sha256: row.review_sha256, qualifies: row.qualifies, created: row.created })
}

const RIGHTS_ASSETS: readonly StoryRightsAsset[] = ['source_text', 'translation', 'audio', 'illustration']
const RIGHTS_STATUSES: readonly StoryRightsStatus[] = ['confirmed', 'hold', 'rejected']
const BASIS_MAX = 2000
const EVIDENCE_MAX = 2000
const WITHDRAW_REASON_MAX = 1000

export async function recordStoryRights(deps: StoryDeps, input: unknown): Promise<StoryResult<StoryRightsResult>> {
  const auth = await requireStoryStaff(deps.client, 'admin')
  if (!auth.ok) return auth
  const issues: StoryIssue[] = []
  const v = isRecord(input) ? input : {}
  const sourceId = v.source_id
  const asset = v.asset
  const status = v.status
  const basis = typeof v.basis === 'string' ? v.basis.trim() : ''
  const evidence = typeof v.evidence_ref === 'string' ? v.evidence_ref.trim() : ''
  if (!isUuid(sourceId)) issues.push(inputIssue('source_id', '원천 id 형식이 아니다'))
  if (!RIGHTS_ASSETS.includes(asset as StoryRightsAsset)) issues.push(inputIssue('asset', '권리 자산은 source_text · translation · audio · illustration 중 하나다'))
  if (!RIGHTS_STATUSES.includes(status as StoryRightsStatus)) issues.push(inputIssue('status', '결정은 confirmed · hold · rejected 중 하나다'))
  if (basis.length === 0) issues.push(inputIssue('basis', '결정 근거를 적어야 한다'))
  if (basis.length > BASIS_MAX) issues.push(inputIssue('basis', `근거는 ${BASIS_MAX}자 이하다`))
  if (v.evidence_ref !== undefined && v.evidence_ref !== null && typeof v.evidence_ref !== 'string') issues.push(inputIssue('evidence_ref', '근거 자료 위치는 글이어야 한다'))
  if (evidence.length > EVIDENCE_MAX) issues.push(inputIssue('evidence_ref', `근거 자료 위치는 ${EVIDENCE_MAX}자 이하다`))
  if (status === 'confirmed' && evidence.length === 0) issues.push(inputIssue('evidence_ref', '「확인」 결정은 근거 자료 위치가 있어야 한다'))
  if (issues.length > 0) return failStory('invalid_input', 'input', issues)

  const res = await callStoryRpc(deps.client, 'story_admin_record_rights', {
    p_source_id: sourceId,
    p_asset: asset,
    p_status: status,
    p_basis: basis,
    p_evidence_ref: evidence === '' ? null : evidence,
  })
  if (!res.ok) return res
  const id = typeof res.data === 'string' ? res.data : null
  if (!isUuid(id)) return unexpected()
  return success(auth.viewer, { decision_id: id })
}

/** 발행 — 증인과 별개의 쿠키 세션 RPC. 그 사이의 검수 · 권리 변경은 DB 가 결속 · 권리 재확인으로 막는다. */
export async function publishStory(deps: StoryDeps, editionVersionId: unknown): Promise<StoryResult<StoryPublishResult>> {
  const auth = await requireStoryStaff(deps.client, 'admin')
  if (!auth.ok) return auth
  if (!isUuid(editionVersionId)) return failStory('invalid_input', 'input', [inputIssue('edition_version_id', '판 id 형식이 아니다')])
  const res = await callStoryRpc(deps.client, 'story_admin_publish', { p_edition_version_id: editionVersionId })
  if (!res.ok) return res
  const row = firstRow(res.data)
  if (!row || !isUuid(row.release_id) || typeof row.release_key !== 'string' || !RELEASE_KEY_RE.test(row.release_key)) return unexpected()
  return success(auth.viewer, { release_id: row.release_id, release_key: row.release_key })
}

export async function withdrawStory(deps: StoryDeps, releaseKey: unknown, reason: unknown): Promise<StoryResult<StoryWithdrawResult>> {
  const auth = await requireStoryStaff(deps.client, 'admin')
  if (!auth.ok) return auth
  const issues: StoryIssue[] = []
  const text = typeof reason === 'string' ? reason.trim() : ''
  if (typeof releaseKey !== 'string' || !RELEASE_KEY_RE.test(releaseKey)) issues.push(inputIssue('release_key', '발행 키 형식이 아니다'))
  if (text.length === 0) issues.push({ code: 'story:withdraw_reason_required', path: 'reason', message: '철회 사유를 적어야 한다' })
  if (text.length > WITHDRAW_REASON_MAX) issues.push(inputIssue('reason', `철회 사유는 ${WITHDRAW_REASON_MAX}자 이하다`))
  if (issues.length > 0) {
    return failStory(text.length === 0 && issues.length === 1 ? 'story:withdraw_reason_required' : 'invalid_input', 'input', issues)
  }
  const res = await callStoryRpc(deps.client, 'story_admin_withdraw', { p_release_key: releaseKey, p_reason: text })
  if (!res.ok) return res
  const row = firstRow(res.data)
  if (!row || typeof row.release_key !== 'string' || !str(row.withdrawn_at) || typeof row.changed !== 'boolean') return unexpected()
  return success(auth.viewer, { release_key: row.release_key, withdrawn_at: row.withdrawn_at, changed: row.changed })
}
