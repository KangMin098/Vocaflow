// apps/web/src/lib/library/story/save-word.ts
//
// LCP-D5-I01 — Story 단어 도움에서 **고른 낱말 하나를 명시적으로** 내 단어장(vocabularies)에 담는 서버 로직(서버 전용).
// 계약: docs/lcp-story/LCP_D5_INTEGRATION.md §4.1 · §5.5~9. 서버 액션 saveStoryWordAction(app/(main)/library/stories/actions.ts)이
// 쿠키 세션 클라이언트를 넘겨 부른다. 새 SQL · RPC · 표 · origin 없음.
//
// 권위는 서버에만 있다(클라이언트가 보낸 뜻 · 예문 · 원형 · 사용자 id · texts id 를 받지 않는다):
//   1) 입력 형식(발행 키 · 0-based 단위 · 낱말 번호 · 낱말 글자 · 화면의 본인) — 틀리면 getUser · RPC 전에 거부.
//   2) 쿠키 세션 학습자 판정(learner.ts resolveStoryLearner — 정지 · 삭제 차단) + 화면의 본인과 같아야 한다(viewer_changed · 쓰기 0).
//   3) story_reader_context(같은 발행 키 · 단위) — 발행 · 철회 · 권리 · 판/원천/기준 결속(S5 DB 가 불변 해시 열을 대조) · 계약 모양.
//   4) story_read_unit — 지금 본문(발행본이 가리키는 불변 판) · 읽기 문맥과 같은 단위 수 · 제목에 결속.
//   5) StoryUnitText 와 **같은 토큰화**(story-view splitUnitParagraphs · tokenizeWords)로 그 번호의 낱말이 보낸 글자와 정확히 같아야 한다
//      (selection_mismatch · 쓰기 0).
//   6) lookup_word_meaning(검증된 본문 낱말)으로 사전을 다시 조회 — 확정된 영어 표제어만(found · 유사어 추정 아님 · 이름 아님 · 영어 · 뜻 있음).
//      아니면 not_saveable(임의 뜻을 만들지 않는다).
//   7) 본인 (user_id, 표제어) 사전 확인 — 조회 실패는 「없음」으로 보지 않고 temporary. 이미 있으면 그대로(뜻 · 예문 · 출처 · FSRS 를
//      덮지 않는다) already_exists.
//   8) 새 행: text_id null · origin manual · 사전 필드만(뜻 · 품사 · CEFR 유효값 · 사전 예문). FSRS · 이력 · 갱신 쓰기 없음.
//      동시 저장(23505)은 already_exists. 그 밖의 오류는 제한된 temporary(DB 원문 · 식별자 없음).
// 응답 유실 뒤 재시도는 7)에서 already_exists 로 끝난다(멱등). 영구 Story 출처를 낱말 행에 남기지 않는다(§5.8 — 일반 개인 단어 저장).
// 로그 · 텔레메트리를 남기지 않는다. 시계를 읽지 않는다.

import 'server-only'

import { splitUnitParagraphs, tokenizeWords } from '../../../components/library/story/story-view'

import {
  STORY_LEARNER_MESSAGES,
  STORY_MAX_UNIT_INDEX,
  isStoryReleaseKey,
  mapStoryLearnerRpcError,
  parseStoryReaderContext,
  parseStoryUnitBody,
  resolveStoryLearner,
  type StoryLearnerClient,
  type StoryLearnerDbError,
  type StoryLearnerRpcName,
} from './learner'
import type { StoryWordSaveFailure, StoryWordSaveFailureCode, StoryWordSaveInput, StoryWordSaveOutcome } from './learner-types'

// ── 좁은 클라이언트(쿠키 세션 — 서비스 주체 아님) ─────────────────────────────

interface SaveQuery {
  eq(column: string, value: string): SaveQuery
  maybeSingle(): PromiseLike<{ data: unknown; error: StoryLearnerDbError | null }>
}

export interface StoryWordSaveClient {
  auth: StoryLearnerClient['auth']
  from(table: 'user_profiles' | 'vocabularies'): {
    select(columns: string): SaveQuery
    insert(row: Record<string, unknown>): PromiseLike<{ error: StoryLearnerDbError | null }>
  }
  rpc(fn: StoryLearnerRpcName | 'lookup_word_meaning', args?: Record<string, unknown>): PromiseLike<{ data: unknown; error: StoryLearnerDbError | null }>
}

// ── 실패 ───────────────────────────────────────────────────────────────

export const STORY_WORD_SAVE_MESSAGES: Readonly<Record<'selection_mismatch' | 'not_saveable', string>> = {
  selection_mismatch: '고른 낱말이 지금 본문과 맞지 않아 담지 않았어요. 화면을 다시 불러와 주세요.',
  not_saveable: '사전에서 확정된 낱말만 담을 수 있어요.',
}

export function storyWordSaveFailure(code: StoryWordSaveFailureCode): StoryWordSaveFailure {
  const message = code === 'selection_mismatch' || code === 'not_saveable' ? STORY_WORD_SAVE_MESSAGES[code] : STORY_LEARNER_MESSAGES[code]
  return { ok: false, code, message, retryable: code === 'temporary' }
}
const fail = storyWordSaveFailure

// ── 입력 ───────────────────────────────────────────────────────────────

const VIEWER_ID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
/** 단위 안 낱말 번호 상한 — 형식 방어일 뿐 의미 상한이 아니다(실제 범위는 서버가 본문에서 다시 센다). */
const MAX_WORD_INDEX = 100_000
const MAX_SURFACE = 64

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v)
}

function isIndex(v: unknown, max: number): v is number {
  return typeof v === 'number' && Number.isSafeInteger(v) && v >= 0 && v <= max
}

/** 낱말 글자 = 본문 토큰화가 한 낱말로 보는 문자열 그 자체(공백 · 구두점 · 두 낱말이면 거부). */
function isSingleWord(v: unknown): v is string {
  if (typeof v !== 'string' || v.length === 0 || v.length > MAX_SURFACE) return false
  const { pieces } = tokenizeWords(v)
  return pieces.length === 1 && pieces[0]!.type === 'word' && pieces[0]!.text === v
}

/** 허용 목록 — 다른 키(뜻 · 예문 · 원형 · userId · textId …)는 읽지도 넘기지도 않는다. */
export function parseStoryWordSaveInput(input: unknown): StoryWordSaveInput | null {
  if (!isRecord(input)) return null
  const { releaseKey, unitIndex, wordIndex, surface, expectedViewerId } = input
  if (
    !isStoryReleaseKey(releaseKey) ||
    !isIndex(unitIndex, STORY_MAX_UNIT_INDEX) ||
    !isIndex(wordIndex, MAX_WORD_INDEX) ||
    !isSingleWord(surface) ||
    typeof expectedViewerId !== 'string' ||
    !VIEWER_ID_RE.test(expectedViewerId)
  ) {
    return null
  }
  return { releaseKey, unitIndex, wordIndex, surface, expectedViewerId }
}

/** StoryUnitText 와 같은 규칙으로 단위 본문의 n 번째 낱말(없으면 null). */
export function unitWordAt(text: string, wordIndex: number): string | null {
  let count = 0
  for (const paragraph of splitUnitParagraphs(text)) {
    const { pieces, next } = tokenizeWords(paragraph, count)
    if (wordIndex < next) {
      const hit = pieces.find((p) => p.type === 'word' && p.index === wordIndex)
      return hit && hit.type === 'word' ? hit.text : null
    }
    count = next
  }
  return null
}

// ── 사전 재조회 ─────────────────────────────────────────────────────────

const CEFRS = new Set(['A1', 'A2', 'B1', 'B2', 'C1', 'C2'])

export interface ConfirmedDictionaryEntry {
  headword: string
  meaning: string
  pos: string | null
  cefrLevel: string | null
  exampleEn: string | null
}

/** lookup_word_meaning 1행 → 확정 영어 표제어만. 유사어 추정 · 이름 · 외국어 · 뜻 없음 · 모양 이상은 null. */
export function confirmedDictionaryEntry(data: unknown): ConfirmedDictionaryEntry | null {
  const row = Array.isArray(data) ? (data.length === 1 ? data[0] : null) : data
  if (!isRecord(row)) return null
  const { found, resolved_word, meaning_ko, pos, cefr_level, example_en, match_via, lang } = row
  if (found !== true || typeof resolved_word !== 'string' || typeof meaning_ko !== 'string') return null
  if (match_via === 'suggestion' || match_via === 'proper_noun' || typeof match_via !== 'string') return null
  if (lang !== null && lang !== undefined && lang !== 'en') return null
  const headword = resolved_word.trim().toLowerCase()
  const meaning = meaning_ko.trim()
  if (!isSingleWord(headword) || meaning === '') return null
  return {
    headword,
    meaning,
    pos: typeof pos === 'string' && pos.trim() !== '' ? pos : null,
    cefrLevel: typeof cefr_level === 'string' && CEFRS.has(cefr_level) ? cefr_level : null,
    exampleEn: typeof example_en === 'string' && example_en.trim() !== '' ? example_en : null,
  }
}

// ── 본 동작 ─────────────────────────────────────────────────────────────

async function rpc(
  client: StoryWordSaveClient,
  fn: StoryLearnerRpcName | 'lookup_word_meaning',
  args: Record<string, unknown>,
): Promise<{ ok: true; data: unknown } | StoryWordSaveFailure> {
  let res: { data: unknown; error: StoryLearnerDbError | null }
  try {
    res = await client.rpc(fn, args)
  } catch {
    return fail('temporary')
  }
  if (!isRecord(res)) return fail('temporary')
  if (res.error) {
    if (fn === 'lookup_word_meaning') return fail('temporary')
    const mapped = mapStoryLearnerRpcError(isRecord(res.error) ? res.error : {}, fn)
    return fail(mapped.code)
  }
  return { ok: true, data: res.data }
}

/**
 * 고른 낱말 하나를 내 단어장에 담는다(명시 행동 · 위치 · 완료 · FSRS 쓰기 없음). 입력은 StoryWordSaveInput(unknown 으로 받아 검사).
 * 응답의 viewerId 는 쿠키 세션에서 확인한 본인 uid — 화면은 자기 주인과 같을 때만 결과를 적용한다.
 */
export async function saveStoryWord(deps: { client: StoryWordSaveClient }, input: unknown): Promise<StoryWordSaveOutcome> {
  try {
    const parsed = parseStoryWordSaveInput(input)
    if (!parsed) return fail('invalid_input')
    const client = deps.client

    const learner = await resolveStoryLearner(client as unknown as StoryLearnerClient)
    if (!learner.ok) return fail(learner.code)
    if (learner.userId !== parsed.expectedViewerId) return fail('viewer_changed')
    const uid = learner.userId

    const ctxRes = await rpc(client, 'story_reader_context', { p_release_key: parsed.releaseKey, p_unit_index: parsed.unitIndex })
    if (!ctxRes.ok) return ctxRes
    const context = parseStoryReaderContext(ctxRes.data, { releaseKey: parsed.releaseKey, unitIndex: parsed.unitIndex })
    if (!context) return fail('reader_data_invalid')

    const bodyRes = await rpc(client, 'story_read_unit', { p_release_key: parsed.releaseKey, p_unit_index: parsed.unitIndex })
    if (!bodyRes.ok) return bodyRes
    const body = parseStoryUnitBody(bodyRes.data)
    if (
      !body ||
      body.releaseKey !== parsed.releaseKey ||
      body.unitIndex !== parsed.unitIndex ||
      body.unitCount !== context.unitCount ||
      body.unitTitle !== context.unit.unitTitle
    ) {
      return fail('reader_data_invalid')
    }
    if (unitWordAt(body.text, parsed.wordIndex) !== parsed.surface) return fail('selection_mismatch')

    const lookup = await rpc(client, 'lookup_word_meaning', { p_surface: parsed.surface })
    if (!lookup.ok) return lookup
    const entry = confirmedDictionaryEntry(lookup.data)
    if (!entry) return fail('not_saveable')

    // 이미 담긴 낱말 — 조회 실패를 「없음」으로 보지 않는다. 있으면 아무것도 바꾸지 않는다.
    let existing: { data: unknown; error: StoryLearnerDbError | null }
    try {
      existing = await client.from('vocabularies').select('id').eq('user_id', uid).eq('word', entry.headword).maybeSingle()
    } catch {
      return fail('temporary')
    }
    if (!isRecord(existing) || existing.error) return fail('temporary')
    const result = { viewerId: uid, headword: entry.headword, surface: parsed.surface }
    if (existing.data !== null && existing.data !== undefined) return { ok: true, data: { ...result, status: 'already_exists' } }

    let inserted: { error: StoryLearnerDbError | null }
    try {
      inserted = await client.from('vocabularies').insert({
        user_id: uid,
        text_id: null,
        word: entry.headword,
        meaning: entry.meaning,
        pronunciation: '',
        pos: entry.pos ?? '',
        cefr_level: entry.cefrLevel,
        example_sentence: entry.exampleEn ?? '',
        origin: 'manual',
      })
    } catch {
      return fail('temporary')
    }
    if (!isRecord(inserted)) return fail('temporary')
    if (inserted.error) {
      return isRecord(inserted.error) && inserted.error.code === '23505' ? { ok: true, data: { ...result, status: 'already_exists' } } : fail('temporary')
    }
    return { ok: true, data: { ...result, status: 'saved' } }
  } catch {
    return fail('temporary')
  }
}
