// packages/library-pipeline/src/story/plan.ts
//
// LCP Story 발행 계획 미리보기 — 계약: docs/LCP_STORY.md §10 · §11 · §12.
//
// 이것은 로컬 미리보기다. 「candidate」는 DB 발행 허가가 아니며, DB 쓰기 · 노출 게이트 ·
// 권리 최종 확인 · 학습자 파일럿은 후속 단계(S3~S7)가 맡는다. 미리보기 자체가 그 사실을 적어 둔다.
// 순수 함수다 — 파일 · DB 를 읽지 않는다.

import { sha256Canonical } from './canonical'
import { RELEASE_KEY_RE, ThemeCollectionSchema, type ReviewArtifact } from './schema'
import { surfaceMetrics, type SurfaceMetrics } from './text'
import {
  parseSchema,
  requiredChecks,
  type EditionResult,
  type Issue,
  type PolicyContext,
  type SourceContext,
} from './validate'

export type EditionState = 'missing' | 'in_progress' | 'invalid' | 'valid'
export type PlanStatus = 'candidate' | 'fixture_only' | 'hold' | 'pending'

export interface PlanReason {
  code: string
  /** release = 실제 발행을 막는다 · fixture = 합성 자료라 실제 발행 대상이 아니다. */
  blocks: 'release' | 'fixture'
  message: string
}

export interface ReviewEvidence {
  file: string
  review: ReviewArtifact
  review_sha256: string
  current: boolean
}

export interface EditionDecisionInput {
  source: SourceContext
  policy: PolicyContext
  edition_key: string
  edition_state: EditionState
  edition: EditionResult | null
  /** 구조 검증을 통과한 검수 기록만. 깨진 검수 파일은 작업 폴더 검증 단계에서 오류로 끝난다. */
  reviews: readonly ReviewEvidence[]
}

/** 판본이 소비자에게 넘길 진도 · 완료 의미. S5 가 이 계약대로 구현한다(지금 runtime 은 없다). */
export interface ReadingIdentity {
  /** 진도 범위 — 발행본마다 다르다. 같은 작품 다른 판본의 진도는 섞이지 않는다. */
  reading_book_key: string
  /** 「읽은 작품 수」를 세는 키 — 같은 작품의 여러 판본은 하나로 센다. */
  work_count_key: string
  /**
   * 작품 전체를 (각색 판본으로) 경험했는가 — complete_work 판본만 참이다. 단편 일부 · 에피소드는 아니다.
   * Easy Reader 전권 완독도 참일 수 있지만 그것은 원문 전문을 읽었다는 증거가 아니다(아래 두 필드).
   */
  counts_as_work_completion: boolean
  /** 화면 · 기록에 쓰는 완료 이름 — 각색 전권과 각색 일부를 구분한다. 원문 완독 이름을 쓰지 않는다. */
  completion_label: 'adapted_full_work' | 'adapted_partial'
  /** Story 라인의 판본은 각색본이다 — 원문 전문 완독으로 세지 않는다(원문 완독은 원본 라인의 기록). */
  counts_as_original_text_completion: false
  /** 판본 · 장면 사이 이동은 완료 · 숙달을 승계하지 않는다. */
  progress_inheritance: 'none'
}

export const EVIDENCE_POLICY = {
  reading_progress: 'reading_record_not_mastery',
  help_requests: 'no_level_or_preference_change',
  deep_reading_factual: 'practice_record_not_independent_evidence',
  deep_reading_interpretive: 'not_scored',
  free_text: 'not_collected_not_scored',
  fsrs: 'no_fsrs_success_from_reading_or_clicks',
} as const

export interface ReleasePreview {
  /** 불변 식별자 — 원천 판본 정체 · 본문 · 기준 · 목표 · 판본 · 활동 · 검수 판 중 하나만 바뀌어도 새 키가 된다. */
  release_key: string
  preview_kind: 'local_candidate' | 'fixture'
  work_key: string
  edition_key: string
  kind: string
  transformation: string
  coverage: string
  versions: {
    source: { snapshot_id: string; revision: string; identity_sha256: string; text_sha256: string; library_book_id: string | null }
    policy: { policy_id: string; policy_version: number; policy_sha256: string }
    target_sha256: string
    content: { edition_sha256: string; unit_count: number }
    activities: { activities_sha256: string; count: number }
    quality: { review_ids: string[]; review_sha256s: string[]; contract: 'lcp-story/quality@1' }
  }
  reading_identity: ReadingIdentity
  evidence_policy: typeof EVIDENCE_POLICY
  /** 표면 계측만 — CEFR · V-Level · 커버리지 실측이 아니다. */
  surface_metrics: SurfaceMetrics
  structural_checks: 'passed_structure_only'
  requires_followup: string[]
  db_write: false
  publish_permission: 'none_local_preview'
}

export interface EditionDecision {
  edition_key: string
  status: PlanStatus
  reasons: PlanReason[]
  stale_reviews: string[]
  release: ReleasePreview | null
}

function reason(blocks: PlanReason['blocks'], code: string, message: string): PlanReason {
  return { code, blocks, message }
}

/** 이 판본을 발행 후보로 올릴 수 있는가. 막히면 사유를 전부 모은다(첫 사유에서 멈추지 않는다). */
export function decideEdition(input: EditionDecisionInput): EditionDecision {
  const base = { edition_key: input.edition_key, stale_reviews: [] as string[], release: null }
  if (input.edition_state === 'missing' || input.edition_state === 'in_progress') {
    return { ...base, status: 'pending', reasons: [reason('release', `edition_${input.edition_state}`, '판본 결과물이 아직 없다')] }
  }
  if (input.edition_state === 'invalid' || !input.edition) {
    return { ...base, status: 'hold', reasons: [reason('release', 'edition_invalid', '판본 결과물이 구조 검증을 통과하지 못했다')] }
  }

  const { source, policy } = input
  const result = input.edition
  const ed = result.edition
  const snap = source.snapshot
  const reasons: PlanReason[] = []

  if (snap.synthetic) reasons.push(reason('fixture', 'synthetic_source', '합성 원천이다 — 실제 도서가 아니다'))
  if (ed.produced_by.provenance === 'synthetic_fixture') {
    reasons.push(reason('fixture', 'synthetic_edition', '합성 판본이다'))
  }

  // 권리 — 사이트 단위 표지(claimed_by_source)로 확정하지 않는다. 법적 적법성을 이 함수가 판정하지 않는다.
  // 본문을 이루는 권리(원문 · 선언된 번역)는 전부 confirmed 여야 한다. 쓰지 않는 오디오 · 삽화 기록은 본문 판본을 막지 않는다.
  for (const asset of ['source_text', 'translation'] as const) {
    const r = snap.rights.find((x) => x.asset === asset)
    if (!r && asset === 'translation') continue
    if (r?.status === 'synthetic_fixture') {
      reasons.push(reason('fixture', `synthetic_rights:${asset}`, '합성 자료의 권리 표기다 — 실제 권리 심사가 아니다'))
    } else if (r?.status !== 'confirmed') {
      reasons.push(reason('release', `rights_unconfirmed:${asset}`, `${asset} 권리가 확인되지 않았다(${r?.status ?? 'missing'})`))
    }
  }
  for (const asset of ed.assets) {
    if (asset.rights_status !== 'confirmed' || !asset.rights_evidence_ref) {
      reasons.push(reason('release', `asset_rights_unconfirmed:${asset.asset_id}`, `${asset.kind} 자산 권리가 확인되지 않았다`))
    }
    if (asset.alignment !== 'verified') {
      reasons.push(reason('release', `asset_alignment_unverified:${asset.asset_id}`, `${asset.kind} 자산과 이 판본 본문의 정합이 확인되지 않았다`))
    }
    if (asset.origin === 'inherited_from_source' && (asset.kind === 'audio' || asset.kind === 'illustration')) {
      const sourceRights = snap.rights.find((r) => r.asset === asset.kind)
      if (sourceRights?.status !== 'confirmed') {
        reasons.push(reason('release', `asset_source_rights_unconfirmed:${asset.asset_id}`, `원천 ${asset.kind} 권리가 확인되지 않았다 — 원본 자산을 자동 상속하지 않는다`))
      }
    }
  }

  // 검수 — 지금 판에 결속된 것만 센다. 생성기 자기 승인 · 합성 검수는 실제 승인이 아니다.
  const stale = input.reviews.filter((r) => !r.current)
  const current = input.reviews.filter((r) => r.current)
  const required = requiredChecks(ed)
  const qualifying: ReviewEvidence[] = []
  if (current.length === 0) {
    reasons.push(
      stale.length > 0
        ? reason('release', 'review_stale', `지금 판에 결속된 검수가 없다 — 옛 판 검수 ${stale.length}건은 재사용하지 않는다`)
        : reason('release', 'review_missing', '검수 결과가 없다'),
    )
  }
  for (const r of current) {
    const rv = r.review
    let ok = true
    if (rv.reviewer.session_id === ed.produced_by.session_id) {
      reasons.push(reason('release', `self_review:${rv.review_id}`, '판본을 만든 세션이 스스로 검수했다'))
      ok = false
    }
    if (rv.provenance === 'synthetic_fixture') {
      reasons.push(reason('fixture', `synthetic_review:${rv.review_id}`, '합성 검수다 — 실제 검토가 아니다'))
    }
    if (rv.verdict !== 'approve') {
      reasons.push(reason('release', `review_verdict:${rv.verdict}:${rv.review_id}`, `검수 판정이 ${rv.verdict} 다`))
      ok = false
    }
    for (const check of required) {
      const c = rv.checks.find((x) => x.check === check)
      if (!c || c.verdict !== 'pass') {
        reasons.push(reason('release', `check_not_passed:${check}:${rv.review_id}`, `검수 항목 ${check} 가 ${c?.verdict ?? 'missing'} 다`))
        ok = false
      }
    }
    for (const issue of rv.issues) {
      if (issue.status !== 'open') continue
      if (issue.severity === 'critical' || issue.severity === 'major') {
        reasons.push(reason('release', `${issue.severity}_issue_open:${issue.issue_id}`, `${issue.severity} 문제가 열려 있다`))
        ok = false
      }
    }
    if (ok) qualifying.push(r)
  }
  if (current.length > 0 && qualifying.length === 0 && !reasons.some((x) => x.blocks === 'release')) {
    reasons.push(reason('release', 'no_qualifying_approval', '조건을 갖춘 승인 검수가 없다'))
  }

  const blocked = reasons.some((x) => x.blocks === 'release')
  const status: PlanStatus = blocked ? 'hold' : reasons.length > 0 ? 'fixture_only' : 'candidate'
  const staleFiles = stale.map((r) => r.file)
  if (status === 'hold') return { ...base, status, reasons, stale_reviews: staleFiles }

  const slot = policy.items.get(input.edition_key)
  if (!slot) throw new Error(`decideEdition: ${input.edition_key} 는 제작 범위에 없다`)
  const reviewShas = qualifying.map((r) => r.review_sha256).sort()
  const identity = {
    work_key: snap.work.work_key,
    edition_key: input.edition_key,
    source_identity_sha256: source.identity_sha256,
    source_text_sha256: source.sha256,
    policy_sha256: policy.policy_sha256,
    target_sha256: slot.target_sha256,
    edition_sha256: result.edition_sha256,
    activities_sha256: result.activities_sha256,
    review_sha256s: reviewShas,
    quality_contract: 'lcp-story/quality@1',
  }
  const releaseKey = `lsr_${sha256Canonical(identity).slice(0, 32)}`
  const fullWork = slot.item.coverage === 'complete_work' && snap.coverage === 'complete_work'
  const followup = [
    'db_publish_gate_not_implemented',
    'language_level_not_measured',
    'meaning_preservation_is_reviewer_judgment',
    'learner_pilot_not_run',
  ]
  if (!qualifying.some((r) => r.review.provenance === 'human_review')) followup.push('human_review_not_performed')
  if (ed.assets.length > 0) followup.push('asset_rights_recheck_at_publish')
  if (status === 'fixture_only') followup.push('synthetic_fixture_not_publishable')

  const release: ReleasePreview = {
    release_key: releaseKey,
    preview_kind: status === 'candidate' ? 'local_candidate' : 'fixture',
    work_key: snap.work.work_key,
    edition_key: input.edition_key,
    kind: ed.kind,
    transformation: slot.item.transformation,
    coverage: slot.item.coverage,
    versions: {
      source: {
        snapshot_id: snap.snapshot_id,
        revision: snap.edition.revision,
        identity_sha256: source.identity_sha256,
        text_sha256: source.sha256,
        library_book_id: snap.edition.library_book_id,
      },
      policy: {
        policy_id: policy.policy.policy_id,
        policy_version: policy.policy.policy_version,
        policy_sha256: policy.policy_sha256,
      },
      target_sha256: slot.target_sha256,
      content: { edition_sha256: result.edition_sha256, unit_count: ed.units.length },
      activities: { activities_sha256: result.activities_sha256, count: ed.activities.length },
      quality: {
        review_ids: qualifying.map((r) => r.review.review_id).sort(),
        review_sha256s: reviewShas,
        contract: 'lcp-story/quality@1',
      },
    },
    reading_identity: {
      reading_book_key: releaseKey,
      work_count_key: snap.work.work_key,
      counts_as_work_completion: fullWork,
      completion_label: fullWork ? 'adapted_full_work' : 'adapted_partial',
      counts_as_original_text_completion: false,
      progress_inheritance: 'none',
    },
    evidence_policy: EVIDENCE_POLICY,
    surface_metrics: surfaceMetrics(ed.units.map((u) => u.text)),
    structural_checks: 'passed_structure_only',
    requires_followup: followup,
    db_write: false,
    publish_permission: 'none_local_preview',
  }
  return { ...base, status, reasons, stale_reviews: staleFiles, release }
}

export interface ReleaseCount {
  releases: number
  /** 같은 작품의 여러 판본은 한 작품이다. */
  distinct_works: number
}

export function countReleases(releases: readonly Pick<ReleasePreview, 'release_key' | 'reading_identity'>[]): ReleaseCount {
  const keys = new Set(releases.map((r) => r.release_key))
  const works = new Set(releases.map((r) => r.reading_identity.work_count_key))
  return { releases: keys.size, distinct_works: works.size }
}

/**
 * 테마 편성 — 발행본 키만 묶는다(본문 복제 없음). 실제 후보 발행본만 담을 수 있고,
 * 같은 작품의 여러 판본만으로는 「여러 작품을 잇는」 편성이 되지 않는다.
 */
export function validateThemeCollection(
  input: unknown,
  candidates: readonly ReleasePreview[],
): { ok: boolean; errors: Issue[]; count: ReleaseCount | null } {
  const { value, errors } = parseSchema(ThemeCollectionSchema, input, 'collection')
  if (!value) return { ok: false, errors, count: null }
  const byKey = new Map(candidates.map((c) => [c.release_key, c]))
  const seen = new Set<string>()
  const picked: ReleasePreview[] = []
  value.entries.forEach((e, i) => {
    const p = `collection.entries[${i}]`
    if (!RELEASE_KEY_RE.test(e.release_key)) return
    if (seen.has(e.release_key)) errors.push({ code: 'duplicate_release', path: p, message: '같은 발행본이 두 번 있다' })
    seen.add(e.release_key)
    const c = byKey.get(e.release_key)
    if (!c || c.preview_kind !== 'local_candidate') {
      errors.push({ code: 'collection_release_unavailable', path: p, message: '후보 발행본이 아니다(보류 · 합성 · 없는 키)' })
      return
    }
    if (c.work_key !== e.work_key) {
      errors.push({ code: 'collection_work_mismatch', path: p, message: '발행본의 작품 키와 다르다' })
      return
    }
    picked.push(c)
  })
  const count = countReleases(picked)
  if (errors.length === 0 && count.distinct_works < 2) {
    errors.push({ code: 'collection_single_work', path: 'collection.entries', message: '테마 편성은 서로 다른 작품 둘 이상을 잇는다' })
  }
  return { ok: errors.length === 0, errors, count }
}
