// packages/library-pipeline/src/story/attest.ts
//
// S2 검증 증명(attestation) 어댑터 — 계약: docs/LCP_STORY.md §15 · DB 쪽 정본 supabase/migrations/_pending_lcp_story_s3_schema.sql.
//
// 공개 관리 RPC 는 초안을 검증 없이 보관할 수 있다. 발행만은 「백엔드 서비스 주체가 DB 에 저장된 바로 그 원천 · 기준 ·
// 판본 · 검수를 S2 검증기로 통과시켰다」는 증명이 있어야 한다. 이 함수가 그 증명을 만든다:
//   입력 = public.story_service_validation_input(version) 이 돌려준 jsonb 그대로(클라이언트가 보낸 판본이 아니다)
//   검사 = validateSnapshot · validatePolicy · validateEdition · 모든 검수 validateReview(현재 결속)
//   출력 = DB 가 다시 계산하는 결속 튜플(원천 · 정체 · 기준 · 목표 · 판본 · 활동 · 검수 해시 목록)과 같은 binding.
// 서비스 주체는 「검증 증인」일 뿐 생산자 · 검수자 · 권리 결정자 · 발행자가 아니다. 이 모듈은 DB 에 쓰지 않는다.
// 합성 원천 · 합성 판본 · 합성 검수는 실제 발행 대상이 아니므로 증명하지 않는다.

import { z } from 'zod'

import { sha256Canonical } from './canonical'
import { SLUG_RE } from './schema'
import {
  parseSchema,
  reviewBindingFor,
  validateEdition,
  validatePolicy,
  validateReview,
  validateSnapshot,
  type Issue,
} from './validate'

export const ATTESTATION_SCHEMA = 'lcp-story/validation-attestation@1' as const
export const ATTESTATION_VALIDATOR = { name: 'lcp-story-s2', contract: 'lcp-story/s2@1' } as const

/** DB 가 story_admin_publish · story_service_attest_validation 에서 다시 계산하는 결속(LCP_STORY §15). */
export interface AttestationBinding {
  source_sha256: string
  source_identity_sha256: string
  policy_sha256: string
  target_sha256: string
  edition_sha256: string
  activities_sha256: string
  /** 그 판의 모든 검수 해시, 오름차순(UTF-16 = "C" 순 — 16진 문자열이라 같다). */
  review_sha256s: string[]
}

export interface ValidationAttestation {
  schema: typeof ATTESTATION_SCHEMA
  validator: typeof ATTESTATION_VALIDATOR
  binding: AttestationBinding
  checks: { snapshot: 'valid'; policy: 'valid'; edition: 'valid'; reviews: 'valid' }
  validated_at: string
}

export type AttestationStage = 'input' | 'snapshot' | 'policy' | 'edition' | 'reviews'

export type AttestationResult =
  | { ok: true; attestation: ValidationAttestation; bindingSha256: string }
  | { ok: false; stage: AttestationStage; errors: Issue[] }

/** story_service_validation_input 의 모양. 이 키 밖의 값은 받지 않는다. */
const ValidationInputSchema = z
  .object({
    edition_version_id: z.string().uuid(),
    edition_key: z.string().regex(SLUG_RE),
    snapshot: z.unknown(),
    policy: z.unknown(),
    artifact: z.unknown(),
    reviews: z.array(z.unknown()),
  })
  .strict()

function fail(stage: AttestationStage, errors: Issue[]): AttestationResult {
  return { ok: false, stage, errors }
}

/** DB 에 저장된 원천 메타 · 본문 · 본문 해시에서 S2 스냅숏을 되살린다(story.sources 의 저장 모양). */
export function snapshotFromStored(meta: Record<string, unknown>, body: string, textSha256: string): Record<string, unknown> {
  return { ...meta, text: body, text_sha256: textSha256 }
}

export function buildValidationAttestation(input: { validationInput: unknown; now: Date }): AttestationResult {
  const now = input.now
  // 시각은 주입만 받는다(직접 시계를 읽지 않는다). 잘못된 시각은 미래 검사와 validated_at 을 무의미하게 만든다.
  if (!(now instanceof Date) || !Number.isFinite(now.getTime())) {
    return fail('input', [{ code: 'invalid_clock', path: 'now', message: '주입된 시각이 유효한 Date 가 아니다' }])
  }
  const { value: vi, errors: inputErrors } = parseSchema(ValidationInputSchema, input.validationInput, 'input')
  if (!vi) return fail('input', inputErrors)

  const src = validateSnapshot(vi.snapshot, now)
  if (!src.value) return fail('snapshot', src.errors)
  if (src.value.snapshot.synthetic) {
    return fail('snapshot', [{ code: 'synthetic_not_publishable', path: 'snapshot.synthetic', message: '합성 원천은 증명하지 않는다' }])
  }

  const pol = validatePolicy(vi.policy, src.value)
  if (!pol.value) return fail('policy', pol.errors)
  const slot = pol.value.items.get(vi.edition_key)
  if (!slot) {
    return fail('policy', [{ code: 'edition_not_in_production', path: 'input.edition_key', message: `${vi.edition_key} 는 편집 기준의 제작 범위에 없다` }])
  }

  const artifact = vi.artifact as { task_id?: unknown } | null
  const taskId = artifact && typeof artifact.task_id === 'string' ? artifact.task_id : ''
  const ctx = { source: src.value, policy: pol.value, edition_key: vi.edition_key, task_id: taskId }
  const ed = validateEdition(vi.artifact, ctx)
  if (!ed.value) return fail('edition', ed.errors)
  if (ed.value.edition.produced_by.provenance === 'synthetic_fixture') {
    return fail('edition', [{ code: 'synthetic_not_publishable', path: 'artifact.produced_by.provenance', message: '합성 판본은 증명하지 않는다' }])
  }

  if (vi.reviews.length === 0) {
    return fail('reviews', [{ code: 'reviews_missing', path: 'input.reviews', message: '검수가 하나도 없다' }])
  }
  const current = reviewBindingFor(ctx, ed.value)
  const reviewErrors: Issue[] = []
  const reviewShas: string[] = []
  vi.reviews.forEach((raw, i) => {
    const r = validateReview(raw, { edition_key: vi.edition_key, current_binding: current, now })
    if (!r.value) {
      for (const e of r.errors) reviewErrors.push({ ...e, path: `reviews[${i}].${e.path}` })
      return
    }
    if (!r.value.current) {
      reviewErrors.push({ code: 'review_not_current', path: `reviews[${i}]`, message: `지금 판과 결속이 다르다: ${r.value.mismatched_fields.join(', ')}` })
      return
    }
    if (r.value.review.provenance === 'synthetic_fixture') {
      reviewErrors.push({ code: 'synthetic_not_publishable', path: `reviews[${i}].provenance`, message: '합성 검수는 증명하지 않는다' })
      return
    }
    reviewShas.push(r.value.review_sha256)
  })
  if (reviewErrors.length > 0) return fail('reviews', reviewErrors)

  const binding: AttestationBinding = {
    source_sha256: src.value.sha256,
    source_identity_sha256: src.value.identity_sha256,
    policy_sha256: pol.value.policy_sha256,
    target_sha256: slot.target_sha256,
    edition_sha256: ed.value.edition_sha256,
    activities_sha256: ed.value.activities_sha256,
    review_sha256s: [...reviewShas].sort(),
  }
  const attestation: ValidationAttestation = {
    schema: ATTESTATION_SCHEMA,
    validator: ATTESTATION_VALIDATOR,
    binding,
    checks: { snapshot: 'valid', policy: 'valid', edition: 'valid', reviews: 'valid' },
    validated_at: now.toISOString(),
  }
  return { ok: true, attestation, bindingSha256: sha256Canonical(binding) }
}
