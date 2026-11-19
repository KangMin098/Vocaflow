// apps/web/src/lib/library/story/activity.ts
//
// T-0228 — Story 근거 선택 활동(story_unit_activity) 학습자 라인. 판정 · 권리 · 진도 조건 · 정답은 전부 서버 함수가 갖는다.
// - 조회(p_choice null) 응답은 키 화이트리스트로만 받는다 — 정답 · 등록 근거 같은 다른 키가 섞이면 reader_data_invalid 로 닫는다.
// - 제출은 학습자의 명시적 선택 하나. 고른 근거 · 등록 근거 · 맞음 여부가 서로 맞물려야 받는다(어긋나면 reader_data_invalid).
// - 함수가 이 환경에 없으면(사용자 승인 전 미적용) reader_not_ready — 화면은 아무것도 그리지 않는다.
// - 학습 기록 · 점수 · 완료 · FSRS · 로그를 남기지 않는다. expectedViewerId 는 쿠키 세션 uid 와 비교하는 전제일 뿐이다.

import 'server-only'

import { STORY_MAX_UNIT_INDEX, callRpc, isStoryReleaseKey, resolveStoryLearner, storyLearnerFailure, type StoryLearnerDeps } from './learner'
import type {
  StoryActivity,
  StoryActivityFeedback,
  StoryActivityLoadInput,
  StoryActivityOption,
  StoryActivitySubmitInput,
  StoryLearnerResult,
} from './learner-types'

const fail = storyLearnerFailure

/** 활동 · 선택지 id — 저장값의 kebab 식별자(why-horner-is-safe · case-collapses). */
export const STORY_ACTIVITY_ID_RE = /^[a-z0-9][a-z0-9_-]{0,127}$/

const LOAD_KEYS = ['activity_id', 'claim', 'offset_unit', 'options', 'prompt', 'release_key'] as const
const RESULT_KEYS = ['activity_id', 'choice', 'chosen', 'correct', 'offset_unit', 'registered_evidence', 'release_key'] as const
const OPTION_KEYS = ['end', 'option_id', 'quote', 'start', 'unit_index'] as const
const OFFSET_UNIT = 'utf16_code_unit'

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

/** 키가 정확히 이 목록이다(빠짐 · 더함 모두 거부). */
function exactKeys(v: Record<string, unknown>, keys: readonly string[]): boolean {
  const got = Object.keys(v).sort()
  return got.length === keys.length && got.every((k, i) => k === keys[i])
}

function isId(v: unknown): v is string {
  return typeof v === 'string' && STORY_ACTIVITY_ID_RE.test(v)
}

function isText(v: unknown): v is string {
  return typeof v === 'string' && v.trim() !== ''
}

function isOffset(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0 && v <= 1e9
}

function parseOption(raw: unknown): StoryActivityOption | null {
  if (!isRecord(raw) || !exactKeys(raw, OPTION_KEYS)) return null
  const { option_id, unit_index, start, end, quote } = raw
  if (!isId(option_id) || !isText(quote) || !isOffset(start) || !isOffset(end) || start >= end) return null
  if (typeof unit_index !== 'number' || !Number.isInteger(unit_index) || unit_index < 0 || unit_index > STORY_MAX_UNIT_INDEX) return null
  return { optionId: option_id, unitIndex: unit_index, start, end, quote }
}

/** 조회 응답 — 정답 없는 화이트리스트 모양 · 이 발행 키 · 이 활동이어야 한다. */
export function parseStoryActivity(
  data: unknown,
  expected: { releaseKey: string; activityId: string },
): Omit<StoryActivity, 'viewerId'> | null {
  if (!isRecord(data) || !exactKeys(data, LOAD_KEYS)) return null
  if (data.release_key !== expected.releaseKey || data.activity_id !== expected.activityId || data.offset_unit !== OFFSET_UNIT) return null
  if (!isText(data.prompt) || !isText(data.claim) || !Array.isArray(data.options) || data.options.length < 2) return null
  const options: StoryActivityOption[] = []
  for (const raw of data.options) {
    const o = parseOption(raw)
    if (!o) return null
    options.push(o)
  }
  if (new Set(options.map((o) => o.optionId)).size !== options.length) return null
  return { releaseKey: expected.releaseKey, activityId: expected.activityId, prompt: data.prompt, claim: data.claim, options }
}

/** 제출 응답 — 고른 것 = 보낸 선택 · 등록 근거 하나 · 맞음 여부가 둘의 일치와 같아야 한다. */
export function parseStoryActivityResult(
  data: unknown,
  expected: { releaseKey: string; activityId: string; choice: string },
): Omit<StoryActivityFeedback, 'viewerId'> | null {
  if (!isRecord(data) || !exactKeys(data, RESULT_KEYS)) return null
  if (data.release_key !== expected.releaseKey || data.activity_id !== expected.activityId || data.offset_unit !== OFFSET_UNIT) return null
  if (data.choice !== expected.choice || typeof data.correct !== 'boolean') return null
  const chosen = parseOption(data.chosen)
  const registered = parseOption(data.registered_evidence)
  if (!chosen || !registered || chosen.optionId !== expected.choice) return null
  if (data.correct !== (registered.optionId === chosen.optionId)) return null
  return { releaseKey: expected.releaseKey, activityId: expected.activityId, choice: expected.choice, correct: data.correct, chosen, registered }
}

function isViewerId(v: unknown): v is string {
  return typeof v === 'string' && v !== '' && v.length <= 64
}

function parseLoadInput(input: unknown): StoryActivityLoadInput | null {
  if (!isRecord(input)) return null
  const { releaseKey, activityId, expectedViewerId } = input
  if (!isStoryReleaseKey(releaseKey) || !isId(activityId) || !isViewerId(expectedViewerId)) return null
  return { releaseKey, activityId, expectedViewerId }
}

function parseSubmitInput(input: unknown): StoryActivitySubmitInput | null {
  const base = parseLoadInput(input)
  if (!base || !isRecord(input) || !isId(input.choice)) return null
  return { ...base, choice: input.choice }
}

/** 공통 문 — 쿠키 세션 학습자 · 화면의 본인과 같음(다르면 viewer_changed · RPC 미호출). */
async function precheck(deps: StoryLearnerDeps, expectedViewerId: string): Promise<{ ok: true; userId: string } | ReturnType<typeof fail>> {
  const learner = await resolveStoryLearner(deps.client)
  if (!learner.ok) return learner
  if (learner.userId !== expectedViewerId) return fail('viewer_changed')
  return learner
}

/** 조회 1회 — 정답 없는 활동(주장 · 질문 · 선택지). */
export async function loadStoryActivity(deps: StoryLearnerDeps, input: unknown): Promise<StoryLearnerResult<StoryActivity>> {
  try {
    const parsed = parseLoadInput(input)
    if (!parsed) return fail('invalid_input')
    const learner = await precheck(deps, parsed.expectedViewerId)
    if (!learner.ok) return learner
    const res = await callRpc(deps.client, 'story_unit_activity', { p_release_key: parsed.releaseKey, p_activity_id: parsed.activityId, p_choice: null })
    if (!res.ok) return res
    const data = parseStoryActivity(res.data, parsed)
    if (!data) return fail('reader_data_invalid')
    return { ok: true, data: { viewerId: learner.userId, ...data } }
  } catch {
    return fail('temporary')
  }
}

/** 명시적 제출 1회 — 고른 근거와 등록 근거. 아무것도 기록하지 않는다(서버 함수가 STABLE · 쓰기 없음). */
export async function submitStoryActivity(deps: StoryLearnerDeps, input: unknown): Promise<StoryLearnerResult<StoryActivityFeedback>> {
  try {
    const parsed = parseSubmitInput(input)
    if (!parsed) return fail('invalid_input')
    const learner = await precheck(deps, parsed.expectedViewerId)
    if (!learner.ok) return learner
    const res = await callRpc(deps.client, 'story_unit_activity', {
      p_release_key: parsed.releaseKey,
      p_activity_id: parsed.activityId,
      p_choice: parsed.choice,
    })
    if (!res.ok) return res
    const data = parseStoryActivityResult(res.data, parsed)
    if (!data) return fail('reader_data_invalid')
    return { ok: true, data: { viewerId: learner.userId, ...data } }
  } catch {
    return fail('temporary')
  }
}
