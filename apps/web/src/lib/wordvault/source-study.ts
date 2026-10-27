// apps/web/src/lib/wordvault/source-study.ts
// 출처 목록(text:/set:) → 뜻 떠올리기 세션의 범위 판정 — 목록(Browse)과 세션(/wordvault/study)이 **같은 함수**를 쓴다.
//
// ⚠️ 2026-10-28 이전: /wordvault/study 는 filter 를 parseStateFilter 에만 넘겨, text:/set: 링크가 붙으면
//    **전체 단어의 앞 50개**가 열렸다. 여기서는 범위를 먼저 고르고(applySourceFilter · 기사 membership 계약),
//    목록에 걸린 검색·난이도(matchesQuery · matchesLevel)를 같은 규칙으로 걸고, 그 **뒤에** 상한을 자른다.
//    잘못된 필터·조회 실패는 전체 단어로 바꾸지 않는다.

import { matchesLevel, matchesQuery, normalizeQuery, parseLevelParam, type LevelParam } from './list-params'
import { applySourceFilter, normalizeSourceFilter, type SetMembership } from './source-filter'
import { parseStateFilter, toStateFilterValue, type StateFilterKey } from './state-filter'
import { sanitizeInternalPath } from '@/lib/layout/session-return'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export type StudyFilter =
  | { kind: 'none' }
  | { kind: 'state'; key: StateFilterKey }
  /** 기억 상태 목록에 검색 · 난이도가 함께 걸린 경우 — 상태 → 검색 → 난이도 → 상한 순(2026-10-28) */
  | { kind: 'state-scoped'; key: StateFilterKey; query: string; level: LevelParam | null }
  | { kind: 'source'; filter: string; query: string; level: LevelParam | null }
  | { kind: 'invalid' }

/**
 * /wordvault/study 의 filter(+출처일 때만 q · level)를 판정한다.
 * - 필터 없음 · 빈 값 · all 과 지원하는 state:* 만 기존 진입 그대로(none/state). 그 밖의 명시 값은 invalid.
 * - text:/set: 는 id 가 uuid 여야 한다. 접두어 없는 uuid 는 예전 Reader 링크라 text: 로 읽는다.
 * - 반복 파라미터(배열) · 형식이 틀린 출처 · 출처와 함께 온 반복/모르는 q·level 은 invalid — 전체로 흘리지 않는다.
 */
export function parseStudyFilter(raw: unknown, rawQuery?: unknown, rawLevel?: unknown): StudyFilter {
  if (Array.isArray(raw)) return { kind: 'invalid' }
  if (raw === undefined || raw === null) return { kind: 'none' }
  if (typeof raw !== 'string') return { kind: 'invalid' }
  if (!raw.trim() || raw.trim() === 'all') return { kind: 'none' }
  const v = normalizeSourceFilter(raw)
  const isText = v.startsWith('text:')
  const isSet = v.startsWith('set:')
  if (!isText && !isSet) {
    const key = parseStateFilter(v)
    // 명시했지만 모르는 값(text · set · garbage · state:모름)은 전체 앞 50개로 흘리지 않는다.
    if (!key) return { kind: 'invalid' }
    const cond = parseConditions(rawQuery, rawLevel)
    if (!cond) return { kind: 'invalid' } // 반복 · 모르는 q/level — 조건을 버려 넓은 세션으로 바꾸지 않는다
    // 조건이 없으면 기존 state: 경로 그대로(같은 판정 · 상한)
    return cond.query || cond.level ? { kind: 'state-scoped', key, ...cond } : { kind: 'state', key }
  }
  const id = v.slice(isText ? 5 : 4)
  if (!UUID.test(id)) return { kind: 'invalid' }
  const cond = parseConditions(rawQuery, rawLevel)
  if (!cond) return { kind: 'invalid' }
  return { kind: 'source', filter: `${isText ? 'text' : 'set'}:${id.toLowerCase()}`, ...cond }
}

/** 목록 조건(q · level) — 반복 · 문자열 아님 · 모르는 level 은 null(invalid). 빈 값 · all 은 조건 없음. */
function parseConditions(rawQuery: unknown, rawLevel: unknown): { query: string; level: LevelParam | null } | null {
  if (Array.isArray(rawQuery) || Array.isArray(rawLevel)) return null
  if (rawQuery !== undefined && rawQuery !== null && typeof rawQuery !== 'string') return null
  if (rawLevel !== undefined && rawLevel !== null && typeof rawLevel !== 'string') return null
  let level: LevelParam | null = null
  if (typeof rawLevel === 'string' && rawLevel.trim() && rawLevel.trim() !== 'all') {
    level = parseLevelParam(rawLevel)
    if (!level) return null
  }
  return { query: normalizeQuery(typeof rawQuery === 'string' ? rawQuery : undefined), level }
}

/** 화면 안내용 조건 한 줄 — 난이도 · 검색어 */
export function conditionParts(scope: { query: string; level: LevelParam | null }): string[] {
  const parts: string[] = []
  if (scope.level) parts.push(scope.level.kind === 'cefr' ? scope.level.value : `${scope.level.value.toUpperCase()} 등급`)
  if (scope.query) parts.push(`"${scope.query}"`)
  return parts
}

/** 이미 범위를 고른(정렬 유지) 단어에 검색 · 난이도를 걸고 그 **뒤에** 상한을 자른다. */
export function applyConditionsThenCap<W extends { word: string; meaning: string } & Parameters<typeof matchesLevel>[0]>(
  words: readonly W[],
  scope: { query: string; level: LevelParam | null },
  cap: number,
): { words: W[]; total: number } {
  let list = [...words]
  if (scope.query) list = list.filter((w) => matchesQuery(w, scope.query))
  if (scope.level) list = list.filter((w) => matchesLevel(w, scope.level))
  return { words: list.slice(0, cap), total: list.length }
}

export type SourceStudyScope<W> =
  | { status: 'ok'; words: W[]; total: number }
  | { status: 'membership-error' }

/**
 * 정렬된 본인 단어(due 우선)에서 출처 범위 → 검색 → 난이도 → 상한 순으로 고른다. 순서는 바꾸지 않는다.
 * set: 의 기사 membership 조회가 실패하면 origin 만으로 줄여 시작하지 않는다(목록은 안내와 함께 origin 만 보이지만,
 * 세션은 「이 목록」 이라고 말할 수 없으므로 실패로 알린다). membership 이 null(도서 장 세트 등)이면 origin 판정 그대로.
 */
export function scopeSourceStudyWords<W extends { setId?: string | null; textId?: string | null; word: string; meaning: string } & Parameters<typeof matchesLevel>[0]>(
  words: readonly W[],
  scope: { filter: string; query: string; level: LevelParam | null },
  membership: SetMembership | null,
  cap: number,
): SourceStudyScope<W> {
  if (scope.filter.startsWith('set:') && membership && membership.setId === scope.filter.slice(4) && 'error' in membership) {
    return { status: 'membership-error' }
  }
  return { status: 'ok', ...applyConditionsThenCap(applySourceFilter(words, scope.filter, membership), scope, cap) }
}

/** 출처 세션이 끝나면 돌아갈 목록 — 검증된 내부 Browse 주소만. 없거나 다른 곳이면 그 출처의 목록. */
export function sourceStudyReturnHref(from: unknown, filter: string): string {
  const safe = typeof from === 'string' ? sanitizeInternalPath(from) : null
  if (safe && (safe === '/wordvault/browse' || safe.startsWith('/wordvault/browse?'))) return safe
  return filter ? `/wordvault/browse?filter=${encodeURIComponent(filter)}` : '/wordvault/browse'
}

/** Browse → 세션 진입 주소. 지금 화면의 출처 · 검색 · 난이도와 돌아올 목록 주소를 싣는다. */
export function sourceStudyHref(opts: { filter: string; query?: string; level?: string | null; from: string }): string {
  const qs = new URLSearchParams({ filter: opts.filter })
  const q = (opts.query ?? '').trim()
  if (q) qs.set('q', q)
  if (opts.level && parseLevelParam(opts.level)) qs.set('level', opts.level)
  qs.set('from', opts.from)
  return `/wordvault/study?${qs.toString()}`
}

/** 지금 Browse 의 실제 조건을 반영한 목록 주소 — 칩·검색으로 바뀐 값을 URL 에 싣고, 그 밖의 문맥 파라미터는 그대로 둔다. */
export function currentBrowseHref(params: URLSearchParams, state: { filter: string; query: string; level: string }): string {
  const p = new URLSearchParams(params.toString())
  p.set('filter', state.filter)
  if (state.query.trim()) p.set('q', state.query.trim())
  else p.delete('q')
  if (parseLevelParam(state.level)) p.set('level', state.level)
  else p.delete('level')
  return `/wordvault/browse?${p.toString()}`
}

/**
 * 로그인 next · 다시 열기(WordVaultViewerGate reopenHref) 주소 — 검증한 값만 싣는다(uid 없음).
 * invalid 는 fail-closed 표식(filter=invalid)으로 남긴다: 반복 값을 버리면 로그인 뒤 전체 · 더 넓은 범위가 열린다.
 */
export function studyReopenHref(parsed: StudyFilter, rawFilter: unknown, rawLevel: unknown, safeFrom: string | null): string {
  const reopen = new URLSearchParams()
  if (parsed.kind === 'invalid') reopen.set('filter', 'invalid')
  else if (parsed.kind === 'source') {
    reopen.set('filter', parsed.filter)
    if (parsed.query) reopen.set('q', parsed.query)
    if (typeof rawLevel === 'string' && parsed.level) reopen.set('level', rawLevel.trim())
  } else if (parsed.kind === 'state-scoped') {
    reopen.set('filter', toStateFilterValue(parsed.key))
    if (parsed.query) reopen.set('q', parsed.query)
    if (typeof rawLevel === 'string' && parsed.level) reopen.set('level', rawLevel.trim())
  } else if (typeof rawFilter === 'string' && rawFilter) reopen.set('filter', rawFilter)
  if (safeFrom) reopen.set('from', safeFrom)
  return reopen.size ? `/wordvault/study?${reopen.toString()}` : '/wordvault/study'
}
