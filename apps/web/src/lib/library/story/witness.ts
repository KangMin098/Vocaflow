// apps/web/src/lib/library/story/witness.ts
//
// LCP Story S4 — 검증 증인(서버 전용). 계약: docs/LCP_STORY.md §15 「검증 증명」.
//
// 순서(바꾸지 않는다):
//   1. 쿠키 세션의 활성 스태프 확인 — 실패하면 서비스 주체 클라이언트를 만들지도, 어떤 RPC 도 부르지 않는다.
//   2. 그 뒤에야 주입된 createServiceClient() 로 서비스 주체 클라이언트를 만든다.
//   3. story_service_validation_input(판 id) — DB 에 저장된 그대로의 원천 · 기준 · 판 · 검수.
//   4. 그 응답 data 를 「같은 참조 그대로」(복사 · 덮어쓰기 · 정규화 없이) buildValidationAttestation({ validationInput, now }) 에 넘긴다.
//   5. 통과했을 때만 story_service_attest_validation 으로 증명을 기록한다. 실패하면 단계와 오류를 돌려주고 기록하지 않는다.
// 클라이언트가 보낸 증명 · 검증 결과는 받지 않는다(이 함수의 입력은 판 id 하나다).
//
// 신뢰 경계: 이 기록은 「service_role 자격을 가진 이 서버가 S2 검증 통과를 주장했다」는 것이다. S2 가 실제로 돌았다는
// 암호학적 증거가 아니다 — 보호 수단은 서비스 키 보관과 이 서버 경로다. 서비스 주체는 생산자 · 검수자 · 권리 결정자 · 발행자가 아니다.
// 발행은 이 증인과 별개로 쿠키 세션의 story_admin_publish 가 하며, 그 사이의 검수 · 권리 변경은 DB 가 다시 막는다.

import 'server-only'

import { buildValidationAttestation, type AttestationResult } from '@vocaflow/library-pipeline/story'

import {
  callStoryRpc,
  failStory,
  firstRow,
  isRecord,
  isUuid,
  requireStoryStaff,
  toIssues,
  type StoryDeps,
  type StoryServiceClient,
} from './admin'
import type { StoryAttestResult, StoryResult } from './types'

export interface StoryWitnessDeps extends StoryDeps {
  /** 서비스 주체 클라이언트 팩토리 — 스태프 확인을 통과한 뒤에만 부른다. */
  createServiceClient: () => StoryServiceClient
  /** 기본값 = 실제 S2 어댑터. 시험에서만 바꾼다. */
  buildAttestation?: (input: { validationInput: unknown; now: Date }) => AttestationResult
}

export async function attestStoryValidation(deps: StoryWitnessDeps, editionVersionId: unknown): Promise<StoryResult<StoryAttestResult>> {
  const auth = await requireStoryStaff(deps.client, 'curator')
  if (!auth.ok) return auth
  if (!isUuid(editionVersionId)) {
    return failStory('invalid_input', 'input', [{ code: 'invalid_input', path: 'edition_version_id', message: '판 id 형식이 아니다' }])
  }

  let service: StoryServiceClient
  try {
    service = deps.createServiceClient()
  } catch {
    return failStory('witness_unavailable', 'rpc')
  }

  const input = await callStoryRpc(service, 'story_service_validation_input', { p_edition_version_id: editionVersionId })
  if (!input.ok) return input
  const validationInput = input.data
  if (!isRecord(validationInput) || validationInput.edition_version_id !== editionVersionId) {
    return failStory('witness_input_mismatch', 'input')
  }

  const build = deps.buildAttestation ?? buildValidationAttestation
  const result = build({ validationInput, now: deps.now() })
  if (!result.ok) return failStory('validation_failed', result.stage, toIssues(result.errors))

  const res = await callStoryRpc(service, 'story_service_attest_validation', {
    p_edition_version_id: editionVersionId,
    p_attestation: result.attestation,
  })
  if (!res.ok) return res
  const row = firstRow(res.data)
  if (!row || !isUuid(row.attestation_id) || typeof row.binding_sha256 !== 'string' || typeof row.created !== 'boolean') {
    return failStory('rpc_unexpected_response', 'rpc')
  }
  if (row.binding_sha256 !== result.bindingSha256) return failStory('witness_binding_mismatch', 'rpc')
  return { ok: true, viewer: auth.viewer, data: { attestation_id: row.attestation_id, binding_sha256: row.binding_sha256, created: row.created } }
}
