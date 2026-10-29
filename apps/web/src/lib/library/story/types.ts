// apps/web/src/lib/library/story/types.ts
//
// LCP Story S4 — 관리자 이야기 라인의 서버 액션 ↔ 화면 계약(클라이언트에서도 import 가능, 서버 전용 코드 없음).
// 계약 정본: docs/LCP_STORY.md §9 · §10 · §14 · §15 · §18. DB 정본: supabase/migrations/20261025094450_lcp_story_s3_schema.sql.
// 화면에 보이는 생산자 · 검수자 · 파일 메타데이터는 권한 근거가 아니다 — 권한은 서버가 쿠키 세션의 uid · 역할 · active 로 판정하고
// DB RPC 가 다시 강제한다. 여기의 viewer 는 화면 안내(두 번째 스태프 필요 등)용 표시 값이다.

export type StoryStaffRole = 'admin' | 'curator'

/** 서버가 쿠키 세션에서 확인한 현재 스태프(화면 안내용 — 권한 판정은 서버 · DB 가 매번 다시 한다). */
export interface StoryViewer {
  uid: string
  role: StoryStaffRole
}

export interface StoryIssue {
  code: string
  path: string
  message: string
}

/** 실패가 어느 단계에서 났는가. auth = 세션 · 역할 · active, upload = 파일 크기 · 형식, rpc = DB 가 거부. */
export type StoryFailureStage =
  | 'auth'
  | 'upload'
  | 'input'
  | 'snapshot'
  | 'policy'
  | 'edition'
  | 'reviews'
  | 'plan'
  | 'rpc'

export interface StoryFailure {
  ok: false
  /** `story:*` DB 오류 코드 또는 서버 검사 코드(`upload_too_large` 등). */
  code: string
  message: string
  /** 사용자가 할 수 있는 복구 행동 한 문장. */
  recovery: string
  stage: StoryFailureStage
  issues: StoryIssue[]
  /** 같은 입력으로 다시 눌러도 되는가(네트워크 · 일시 오류). 입력을 고쳐야 하는 오류는 false. */
  retryable: boolean
  /**
   * (추가 · 선택) 후보 등록에서 앞 단계 RPC 는 성공하고 뒤 단계가 실패했을 때, 이미 DB 에 저장된 앞 단계 결과(원천 · 편집 기준과 판본 자리).
   * 원자적 롤백이 아니다 — 같은 원천 · 편집 기준 파일로 다시 등록하면 기존 행을 그대로 돌려받아(created=false) 이어 간다.
   */
  partial?: Partial<StoryRegisterResult>
}

export type StoryResult<T> = { ok: true; viewer: StoryViewer; data: T } | StoryFailure

/** Server Action 기본 본문 한도(1 MB) 안에서 쓰는 업로드 총량 한도. 전역 Next 설정은 바꾸지 않는다. */
export const STORY_UPLOAD_MAX_BYTES = 900_000

export type StoryEditionKind = 'story_edition' | 'easy_reader'
export type StoryCoverage = 'complete_work' | 'episode' | 'excerpt'
export type StoryPlanStatus = 'candidate' | 'fixture_only' | 'hold' | 'pending'
export type StoryReviewVerdict = 'approve' | 'changes_requested' | 'hold' | 'reject'
export type StoryRightsAsset = 'source_text' | 'translation' | 'audio' | 'illustration'
export type StoryRightsStatus = 'confirmed' | 'hold' | 'rejected'

/** public.story_admin_list_slots() 한 행. */
export interface StorySlotRow {
  slot_id: string
  work_key: string
  edition_key: string
  kind: StoryEditionKind
  coverage: StoryCoverage
  source_id: string
  policy_id: string
  /** 판본을 아직 제출하지 않은 자리는 null — get_bundle 을 부를 수 없다(원천 · 편집 기준 파일로 이어 간다). */
  latest_version_id: string | null
  version_count: number
  review_count: number
  qualifying_review_count: number
  live_release_key: string | null
  withdrawn_release_count: number
}

/** public.story_admin_get_bundle(version) 응답. */
export interface StoryBundle {
  source: {
    id: string
    meta: Record<string, unknown>
    body: string
    text_sha256: string
    identity_sha256: string
    correspondence: string
    library_book_id: string | null
    registered_by: string
    registered_at: string
  }
  policy: { id: string; policy: Record<string, unknown>; policy_sha256: string }
  slot: { id: string; edition_key: string; production: Record<string, unknown>; target_sha256: string }
  version: {
    id: string
    artifact: Record<string, unknown>
    edition_sha256: string
    activities_sha256: string
    submitted_by: string
    submitted_at: string
    is_latest: boolean
  }
  reviews: Array<{
    id: string
    review: Record<string, unknown>
    review_sha256: string
    verdict: StoryReviewVerdict
    qualifies: boolean
    submitted_by: string
    submitted_at: string
  }>
  validation: { binding: Record<string, unknown>; binding_sha256: string; attested: boolean }
  rights_ok: boolean
  rights: Array<{
    asset: StoryRightsAsset
    status: StoryRightsStatus
    basis: string
    evidence_ref: string | null
    decided_by: string
    decided_at: string
  }>
  releases: Array<{ release_key: string; published_at: string; withdrawn_at: string | null; available: boolean }>
  /**
   * 서버가 DB 결속(validation.binding)에서 계산한 「지금 판 · 지금 검수 전부로 발행하면 나올 발행 키」(화면 안내용, DB 응답 필드 아님).
   * 검수가 없거나 결속이 비정상이면 null. 같은 키의 철회본이 releases 에 있으면 재발행은 DB 가 story:release_key_exists 로 거부한다.
   */
  prospective_release_key?: string | null
}

export interface StoryFileCheck {
  file: 'source' | 'policy' | 'edition' | 'review'
  ok: boolean
  issues: StoryIssue[]
}

/** 제출 전 후보 파일(원천 스냅숏 · 편집 기준 · 판본 결과물)을 서버가 S2 검증기 · plan 으로 다시 검사한 결과. DB 쓰기 없음. */
export interface StoryCandidateCheck {
  source: {
    snapshot_id: string
    work_key: string
    identity_sha256: string
    text_sha256: string
    paragraph_count: number
    coverage: StoryCoverage
    synthetic: boolean
    rights: Array<{ asset: StoryRightsAsset; status: string }>
  } | null
  policy: {
    policy_sha256: string
    editions: Array<{ edition_key: string; kind: StoryEditionKind; coverage: StoryCoverage; transformation: string }>
  } | null
  edition: {
    edition_key: string
    edition_sha256: string
    activities_sha256: string
    unit_count: number
    plan_status: StoryPlanStatus
    plan_reasons: Array<{ code: string; blocks: 'release' | 'fixture'; message: string }>
  } | null
  files: StoryFileCheck[]
  /** 오류가 없고 fixture_only 가 아니면 true. hold 는 관리자 초안으로만 저장할 수 있다(학습자 발행 아님). */
  importable: boolean
}

/** registerStoryCandidateAction 의 단계. 매 단계 서버가 올린 파일 전체를 다시 검증한다(앞 단계 결과를 믿지 않는다). */
export type StoryRegisterStep = 'source' | 'policy' | 'edition'

export interface StoryRegisterResult {
  step: StoryRegisterStep
  source: { source_id: string; identity_sha256: string; text_sha256: string; created: boolean }
  policy: {
    policy_id: string
    policy_sha256: string
    created: boolean
    slots: Array<{ slot_id: string; edition_key: string; target_sha256: string }>
  } | null
  edition: { slot_id: string; edition_version_id: string; edition_sha256: string; activities_sha256: string; created: boolean; plan_status: StoryPlanStatus } | null
}

export interface StoryReviewSubmitResult {
  review_id: string
  review_sha256: string
  qualifies: boolean
  created: boolean
}

export interface StoryAttestResult {
  attestation_id: string
  binding_sha256: string
  created: boolean
}

export interface StoryPublishResult {
  release_id: string
  release_key: string
}

export interface StoryWithdrawResult {
  release_key: string
  withdrawn_at: string
  changed: boolean
}

export interface StoryRightsResult {
  decision_id: string
}

export interface StoryRightsInput {
  source_id: string
  asset: StoryRightsAsset
  status: StoryRightsStatus
  basis: string
  evidence_ref: string
}
