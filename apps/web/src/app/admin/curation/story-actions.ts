// apps/web/src/app/admin/curation/story-actions.ts
//
// LCP Story S4 — 관리자 이야기 라인 서버 액션(얇은 배선). 로직 · 권한 판정은 lib/library/story/{admin,witness}.ts.
// - 모든 관리 RPC 는 쿠키 세션 클라이언트(createClient)로 부른다. 권한 = 그 세션의 실제 uid · 역할 · active(DB 가 다시 강제).
// - 서비스 주체 클라이언트(createAdminClient)는 검증 증인에만, 팩토리로만 넘긴다 — 스태프 확인을 통과한 뒤에야 만들어진다.
// - DEV_ADMIN_BYPASS 는 이 라인에 권한을 주지 않는다. 시각은 여기(액션 경계)에서만 읽어 주입한다.
// - 실패는 throw 하지 않고 StoryFailure 로 돌려준다. 로그 · 텔레메트리를 남기지 않는다.

'use server'

import {
  checkStoryCandidate,
  listStorySlots,
  loadStoryBundle,
  publishStory,
  recordStoryRights,
  registerStoryCandidate,
  storyServerError,
  submitStoryReview,
  withdrawStory,
  type StoryDeps,
  type StoryRpcClient,
  type StoryServiceClient,
} from '@/lib/library/story/admin'
import type {
  StoryAttestResult,
  StoryBundle,
  StoryCandidateCheck,
  StoryPublishResult,
  StoryRegisterResult,
  StoryResult,
  StoryReviewSubmitResult,
  StoryRightsInput,
  StoryRightsResult,
  StorySlotRow,
  StoryWithdrawResult,
} from '@/lib/library/story/types'
import { attestStoryValidation } from '@/lib/library/story/witness'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

async function withCookieDeps<T>(run: (deps: StoryDeps) => Promise<StoryResult<T>>): Promise<StoryResult<T>> {
  try {
    const client = (await createClient()) as unknown as StoryRpcClient
    return await run({ client, now: () => new Date() })
  } catch {
    return storyServerError()
  }
}

export async function listStorySlotsAction(): Promise<StoryResult<{ slots: StorySlotRow[] }>> {
  return withCookieDeps((deps) => listStorySlots(deps))
}

export async function loadStoryBundleAction(editionVersionId: string): Promise<StoryResult<StoryBundle>> {
  return withCookieDeps((deps) => loadStoryBundle(deps, editionVersionId))
}

/** 파일 source(필수) · policy · edition(선택)을 서버가 S2 로 다시 검사한다. DB 쓰기 없음. */
export async function checkStoryCandidateAction(form: FormData): Promise<StoryResult<StoryCandidateCheck>> {
  return withCookieDeps((deps) => checkStoryCandidate(deps, form))
}

/** step = source | policy | edition. 파일은 source | source+policy | source+policy+edition — 매번 전부 다시 검증한다. */
export async function registerStoryCandidateAction(form: FormData): Promise<StoryResult<StoryRegisterResult>> {
  return withCookieDeps((deps) => registerStoryCandidate(deps, form))
}

/** 필드 edition_version_id + 파일 review. */
export async function submitStoryReviewAction(form: FormData): Promise<StoryResult<StoryReviewSubmitResult>> {
  return withCookieDeps((deps) => submitStoryReview(deps, form))
}

export async function recordStoryRightsAction(input: StoryRightsInput): Promise<StoryResult<StoryRightsResult>> {
  return withCookieDeps((deps) => recordStoryRights(deps, input))
}

/** 검증 증인 — 스태프 확인 → 서비스 주체로 저장값 검증 → 통과 시에만 증명 기록. 클라이언트 증명은 받지 않는다. */
export async function attestStoryValidationAction(editionVersionId: string): Promise<StoryResult<StoryAttestResult>> {
  return withCookieDeps((deps) =>
    attestStoryValidation(
      { ...deps, createServiceClient: () => createAdminClient() as unknown as StoryServiceClient },
      editionVersionId,
    ),
  )
}

export async function publishStoryAction(editionVersionId: string): Promise<StoryResult<StoryPublishResult>> {
  return withCookieDeps((deps) => publishStory(deps, editionVersionId))
}

export async function withdrawStoryAction(releaseKey: string, reason: string): Promise<StoryResult<StoryWithdrawResult>> {
  return withCookieDeps((deps) => withdrawStory(deps, releaseKey, reason))
}
