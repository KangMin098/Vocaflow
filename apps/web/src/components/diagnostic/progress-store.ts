// apps/web/src/components/diagnostic/progress-store.ts
//
// 진단 진행 보관 — **본인 · 같은 진단 · 같은 문항판**일 때만 이어서 푼다(DIAG-RESUME-BIND-01).
//
// 왜 바꿨나(2026-10-29 실측):
//   옛 보관분 `vocaflow-diagnostic-progress` 는 testId · responses · savedAt 만 담았다 — 누구의 답인지, 어느 문항판의 답인지 없었다.
//   이어서 하기는 지금 문항에 속한 답만 거른 뒤 그 **개수**를 다음 위치로 써서, 앞에 문항이 끼면 새 문항을 건너뛰었다.
//   같은 브라우저의 다른 계정이 남의 답을 이어 받아 자기 결과로 제출할 수도 있었다.
//
// 새 보관분(v2):
//   - 키를 본인 꼬리표로 나눈다(다른 계정 · 옛 보관분을 덮지 않는다). 꼬리표는 uid 의 해시다 — uid 원문을 저장소 · DOM 에 싣지 않는다.
//   - 문항판 서명 = 순서대로 (id · word · target_v_level · target_track_level · display_order) 의 결정적 해시. 서버 정본 · 서명된 증거가 아니다.
//   - 답은 문항판 앞에서부터 **끊김 없는 유일한 접두**일 때만 이어 간다. 아니면 섞지 않고 이유를 돌려준다(새 시작은 학습자가 고른다).
//   - 옛 보관분(v1)은 읽기만 한다 — 자동으로 이어 받지도, 지우지도 않는다.
//   - 시각은 주입한다(now). 저장소 접근이 던지면 'unavailable' — 메모리 응답은 화면이 유지한다.

export const LEGACY_PROGRESS_KEY = 'vocaflow-diagnostic-progress'
const V2_PREFIX = 'vocaflow-diagnostic-progress.v2.'
export const PROGRESS_TTL_MS = 24 * 60 * 60 * 1000

export interface DiagQuestion {
  id: string
  word: string
  target_v_level: number | null
  target_track_level: number | null
  display_order: number
}

export interface DiagResponse {
  question_id: string
  knew: boolean
}

export interface ProgressRecord {
  v: 2
  owner: string
  testId: string
  sig: string
  responses: DiagResponse[]
  savedAt: number
}

/** localStorage 와 같은 모양 — 시험은 대역을 넘긴다 */
export type KV = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function fnv(src: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < src.length; i++) {
    h ^= src.charCodeAt(i)
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(36)
}

/** 본인 꼬리표 — uid 원문 대신 저장소 키 · 기록에 쓴다(비교용이며 권한 근거가 아니다). */
export function ownerTag(userId: string): string {
  return fnv(`owner|${userId}`) + fnv(`o2|${userId}|x`)
}

/** 문항판 서명 — 순서 · 본문 · 난도 · 표시 순서가 하나라도 바뀌면 다르다. */
export function questionSig(questions: readonly DiagQuestion[]): string {
  const body = JSON.stringify(questions.map((q) => [q.id, q.word, q.target_v_level, q.target_track_level, q.display_order]))
  return `${questions.length}.${fnv(body)}.${fnv(`s|${body}`)}`
}

const keyOf = (owner: string) => `${V2_PREFIX}${owner}`

const isResponse = (r: unknown): r is DiagResponse =>
  typeof r === 'object' && r !== null && typeof (r as DiagResponse).question_id === 'string' && typeof (r as DiagResponse).knew === 'boolean'

export type ReadResult =
  | { kind: 'none' }
  | { kind: 'ok'; rec: ProgressRecord }
  | { kind: 'expired' }
  | { kind: 'invalid' }
  | { kind: 'unavailable' }

/** 본인 보관분을 읽는다. 다른 꼬리표 · 형식 오류 · TTL 지남은 이어 갈 수 없다. */
export function readProgress(kv: KV | null, owner: string, now: number): ReadResult {
  if (!kv) return { kind: 'unavailable' }
  let raw: string | null
  try {
    raw = kv.getItem(keyOf(owner))
  } catch {
    return { kind: 'unavailable' }
  }
  if (!raw) return { kind: 'none' }
  let p: Partial<ProgressRecord>
  try {
    p = JSON.parse(raw) as Partial<ProgressRecord>
  } catch {
    return { kind: 'invalid' }
  }
  if (
    p?.v !== 2 ||
    p.owner !== owner ||
    typeof p.testId !== 'string' ||
    typeof p.sig !== 'string' ||
    typeof p.savedAt !== 'number' ||
    !Array.isArray(p.responses) ||
    !p.responses.every(isResponse)
  ) {
    return { kind: 'invalid' }
  }
  if (now - p.savedAt > PROGRESS_TTL_MS || p.savedAt > now + 60_000) return { kind: 'expired' }
  if (p.responses.length === 0) return { kind: 'none' }
  return { kind: 'ok', rec: { v: 2, owner, testId: p.testId, sig: p.sig, responses: p.responses.map((r) => ({ question_id: r.question_id, knew: r.knew })), savedAt: p.savedAt } }
}

/** 옛 형식 보관분이 아직 유효 기간 안에 있는가 — 알리기만 한다(이어 받기 · 지우기 없음). */
export function hasLegacyProgress(kv: KV | null, now: number): boolean {
  if (!kv) return false
  try {
    const raw = kv.getItem(LEGACY_PROGRESS_KEY)
    if (!raw) return false
    const p = JSON.parse(raw) as { savedAt?: unknown; responses?: unknown }
    return typeof p?.savedAt === 'number' && now - p.savedAt <= PROGRESS_TTL_MS && Array.isArray(p.responses) && p.responses.length > 0
  } catch {
    return false
  }
}

/** 보관. 실패하면 false — 화면은 「보관됨」을 약속하지 않는다. */
export function writeProgress(kv: KV | null, rec: Omit<ProgressRecord, 'v' | 'savedAt'>, now: number): boolean {
  if (!kv) return false
  try {
    kv.setItem(keyOf(rec.owner), JSON.stringify({ v: 2, ...rec, savedAt: now } satisfies ProgressRecord))
    return true
  } catch {
    return false
  }
}

/** 본인 v2 보관분만 지운다(옛 보관분 · 다른 꼬리표는 건드리지 않는다). */
export function clearProgress(kv: KV | null, owner: string): void {
  if (!kv) return
  try {
    kv.removeItem(keyOf(owner))
  } catch {
    // 지우지 못해도 TTL 이 정리한다
  }
}

export type ResumePlan =
  | { ok: true; nextIdx: number; responses: DiagResponse[]; complete: boolean }
  | { ok: false; reason: 'test' | 'changed' | 'order' | 'duplicate' | 'too_many' }

/**
 * 이어 갈 위치. 같은 진단 · 같은 문항판 서명이고, 답이 문항판 앞에서부터 끊김 없이 유일하게 이어질 때만 ok.
 * 일부 답을 걸러 새 판에 섞지 않는다 — 하나라도 어긋나면 이유를 돌려준다.
 */
export function planResume(rec: ProgressRecord, testId: string, questions: readonly DiagQuestion[]): ResumePlan {
  if (rec.testId !== testId) return { ok: false, reason: 'test' }
  if (rec.sig !== questionSig(questions)) return { ok: false, reason: 'changed' }
  const ids = rec.responses.map((r) => r.question_id)
  if (new Set(ids).size !== ids.length) return { ok: false, reason: 'duplicate' }
  if (ids.length > questions.length) return { ok: false, reason: 'too_many' }
  for (let i = 0; i < ids.length; i++) if (ids[i] !== questions[i].id) return { ok: false, reason: 'order' }
  return { ok: true, nextIdx: ids.length, responses: rec.responses.map((r) => ({ ...r })), complete: ids.length === questions.length }
}

/** 제출 직전 확인 — 지금 문항판 전체에 대해 순서대로 한 번씩 답했는가. */
export function completeFor(responses: readonly DiagResponse[], questions: readonly DiagQuestion[]): boolean {
  return responses.length === questions.length && questions.length > 0 && responses.every((r, i) => r.question_id === questions[i].id)
}

export const RESUME_REASON_TEXT: Record<Exclude<ResumePlan, { ok: true }>['reason'] | 'invalid' | 'expired' | 'legacy', string> = {
  test: '보관된 답이 지금 고른 진단과 달라요.',
  changed: '그 사이 진단 문항이 바뀌어 보관된 답을 이어 붙일 수 없어요.',
  order: '보관된 답의 순서가 지금 문항과 맞지 않아요.',
  duplicate: '보관된 답에 같은 문항이 두 번 들어 있어요.',
  too_many: '보관된 답이 지금 문항 수보다 많아요.',
  invalid: '보관된 답의 형식을 읽을 수 없어요.',
  expired: '보관된 답이 24시간을 넘겨 이어서 할 수 없어요.',
  legacy: '예전 방식으로 보관된 답이 있어요. 누구의 어떤 문항판 답인지 확인할 수 없어 이어서 하지 않아요.',
}
