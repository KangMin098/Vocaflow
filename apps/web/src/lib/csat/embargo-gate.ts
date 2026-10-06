// apps/web/src/lib/csat/embargo-gate.ts
//
// **Reveal Gate 앱 계층의 단일 관문.** 오답 원인 Pilot 의 활성 capture(held · collecting) 또는 열린 묘비가 있는 시험은
// 요청자와 무관하게 정답 민감 산출물(정답 · 해설 · 분석 · 뼈대 · 유형 보고 · 점수 · 정오)을 내보내지 않는다
// (docs/csat-learner/codebook/REVEAL_GATE_DESIGN.md §G · §V · §X).
//
// 규칙 셋:
//   ① 개별 라우트 · 로더는 capture 상태를 해석하지 않는다 — 이 파일의 함수만 부른다(가드: embargo-gate-coverage.test.ts).
//   ② fail-closed — DB 판정(RPC)이 실패하면 **보류**로 본다. 오류를 「보류 아님」으로 삼키지 않는다.
//   ③ 캐시 앞에 두지 않는다 — 원본을 캐시하고 요청마다 이 관문으로 거른다(보류는 언제든 시작될 수 있다).
//
// 판정은 DB 의 서비스 전용 RPC(csat_ec_embargoed_exams · csat_ec_embargoed_items · csat_ec_reveal_state)로만 한다.
// 그래서 기본 클라이언트는 service role 이다 — 이 파일은 판정만 하고 정답 민감 데이터를 돌려주지 않는다.
// 앱 계약: 보류 응답 = HTTP 423 · 본문 { held: 'exam_embargo' } · Cache-Control: no-store(revealHeldResponse).

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

import { keysetSelect } from '@/lib/supabase/keyset-select'
import { createAdminClient } from '@/lib/supabase/admin'

export const HELD_REASON = 'exam_embargo' as const
export type HeldReason = typeof HELD_REASON

export interface GateDeps {
  /** 판정용 클라이언트(기본 service role). 테스트가 주입한다 */
  db?: SupabaseClient
}

/** 판정 RPC 한 번에 넘기는 id 수 — 요청 URL · 본문 크기를 넘지 않게 */
const RPC_CHUNK = 500

const gateDb = (deps?: GateDeps): SupabaseClient => deps?.db ?? (createAdminClient() as unknown as SupabaseClient)

/** 문항 id(`M2509#33`) → 시험 id. 저장소 전체의 문항 id 규칙(시험 id + `#` + 번호) */
export function examOfItem(itemId: string): string {
  return itemId.split('#')[0] ?? ''
}

/** RPC 가 돌려준 보류 집합. failed = 판정 실패(이때 set 은 입력 전부 — fail-closed) */
/** 판정 RPC 한 번의 상한 — 넘으면 판정 실패(= 보류). 학습자에게 오래 매달리지 않고 423 으로 끝낸다 */
export const GATE_TIMEOUT_MS = 4000

/**
 * 운영 로그 — 실제 보류(`embargo`)와 관문 실패(`gate_failure`)를 다른 줄로 남긴다.
 * 학습자 응답은 둘 다 같은 423 이다(실패를 500 이나 데이터로 바꾸지 않는다 · 응답으로 둘을 구분하지 않는다).
 */
export type GateLogKind = 'embargo' | 'gate_failure'
export function gateLog(kind: GateLogKind, detail: Record<string, unknown>): void {
  if (kind === 'gate_failure') console.error('[reveal-gate] gate_failure — 판정 실패를 보류로 본다', detail)
  else console.info('[reveal-gate] embargo — 보류 시험', detail)
}

class GateTimeout extends Error {}
async function withTimeout<T>(p: PromiseLike<T>): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      Promise.resolve(p),
      new Promise<never>((_, reject) => { timer = setTimeout(() => reject(new GateTimeout(`판정 ${GATE_TIMEOUT_MS}ms 초과`)), GATE_TIMEOUT_MS) }),
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** RPC 가 돌려준 보류 집합. failed = 판정 실패(이때 set 은 입력 전부 — fail-closed) */
async function heldBy(fn: 'csat_ec_embargoed_exams' | 'csat_ec_embargoed_items', ids: readonly string[], deps?: GateDeps): Promise<{ set: Set<string>; failed: boolean }> {
  const uniq = [...new Set(ids.filter((x) => typeof x === 'string' && x.length > 0))]
  if (uniq.length === 0) return { set: new Set(), failed: false }
  try {
    const db = gateDb(deps)
    const out = new Set<string>()
    for (let i = 0; i < uniq.length; i += RPC_CHUNK) {
      const chunk = uniq.slice(i, i + RPC_CHUNK)
      // 호출 이름은 리터럴로(권한 감사 rpc-call-sites 가 정적으로 모은다)
      const { data, error } = await withTimeout(fn === 'csat_ec_embargoed_items'
        ? db.rpc('csat_ec_embargoed_items', { p_items: chunk })
        : db.rpc('csat_ec_embargoed_exams', { p_exams: chunk }))
      if (error || !Array.isArray(data) || data.some((x) => typeof x !== 'string' || !chunk.includes(x))) {
        gateLog('gate_failure', { fn, reason: error?.message ?? '응답 형식 또는 요청 범위 불일치', n: uniq.length })
        return { set: new Set(uniq), failed: true }
      }
      for (const x of data) if (typeof x === 'string') out.add(x)
    }
    if (out.size > 0) gateLog('embargo', { fn, held: out.size })
    return { set: out, failed: false }
  } catch (e) {
    gateLog('gate_failure', { fn, reason: e instanceof Error ? e.message : String(e), timeout: e instanceof GateTimeout, n: uniq.length })
    return { set: new Set(uniq), failed: true }
  }
}

/** 시험 id 들 중 보류인 것. 판정 실패면 입력 전부(fail-closed) */
export async function embargoedExamIds(examIds: readonly string[], deps?: GateDeps): Promise<Set<string>> {
  return (await heldBy('csat_ec_embargoed_exams', examIds, deps)).set
}

/** 문항 id 들 중 보류인 것 — 문항 표 판정(RPC) + 시험 id 접두 판정의 합집합. 판정 실패면 입력 전부 */
export async function embargoedItemIds(itemIds: readonly string[], deps?: GateDeps): Promise<Set<string>> {
  const ids = [...new Set(itemIds.filter(Boolean))]
  if (ids.length === 0) return new Set()
  const [byItem, byExam] = await Promise.all([
    heldBy('csat_ec_embargoed_items', ids, deps),
    heldBy('csat_ec_embargoed_exams', ids.map(examOfItem), deps),
  ])
  if (byItem.failed || byExam.failed) return new Set(ids)
  return new Set(ids.filter((id) => byItem.set.has(id) || byExam.set.has(examOfItem(id))))
}

export async function canRevealExam(examId: string | null | undefined, deps?: GateDeps): Promise<boolean> {
  if (!examId) return true
  return !(await embargoedExamIds([examId], deps)).has(examId)
}

export async function canRevealItem(itemId: string | null | undefined, deps?: GateDeps): Promise<boolean> {
  if (!itemId) return true
  return !(await embargoedItemIds([itemId], deps)).has(itemId)
}

/** 기록 한 회 — 그 시험이 보류면 false. 판정 실패 · 시간 초과 · 없는 세션도 false(fail-closed) */
export async function canRevealSession(sessionId: string, deps?: GateDeps): Promise<boolean> {
  try {
    const { data, error } = await withTimeout(gateDb(deps).rpc('csat_ec_reveal_state', { p_session: sessionId }))
    if (error || !data || typeof data !== 'object') {
      gateLog('gate_failure', { fn: 'csat_ec_reveal_state', reason: error?.message ?? '세션 없음' })
      return false
    }
    const embargoed = (data as { exam_embargoed?: unknown }).exam_embargoed
    if (embargoed === true) gateLog('embargo', { fn: 'csat_ec_reveal_state' })
    return embargoed === false
  } catch (e) {
    gateLog('gate_failure', { fn: 'csat_ec_reveal_state', reason: e instanceof Error ? e.message : String(e), timeout: e instanceof GateTimeout })
    return false
  }
}

/** 학습자 본인 기록 중 보류 시험이 하나라도 있나 — 스냅샷 정책(user_has_embargoed_session)과 같은 판정. 실패면 true */
export async function userHasHeldSession(userId: string, deps?: GateDeps): Promise<boolean> {
  try {
    const db = gateDb(deps)
    const rows = await keysetSelect<{ id: string; exam_id: string | null }, string>(
      (cursor, limit) => {
        const q = db.from('csat_dx_session').select('id, exam_id').eq('user_id', userId).not('exam_id', 'is', null).order('id').limit(limit)
        return cursor === null ? q : q.gt('id', cursor)
      },
      (r) => r.id,
      'reveal-gate 본인 기록',
    )
    const exams = rows.map((r) => r.exam_id).filter((x): x is string => Boolean(x))
    return (await embargoedExamIds(exams, deps)).size > 0
  } catch {
    return true
  }
}

// ── 범위(카탈로그 · 캐시된 원본을 요청마다 거를 때) ──────────────────────────

/** 지금 보류인 시험 · 문항 · 유형. failed 면 모든 것이 보류다 */
export interface RevealScope {
  failed: boolean
  exams: ReadonlySet<string>
  items: ReadonlySet<string>
  types: ReadonlySet<string>
}

const FAILED_SCOPE: RevealScope = Object.freeze({ failed: true, exams: new Set<string>(), items: new Set<string>(), types: new Set<string>() })

/**
 * 지금의 보류 범위를 한 번에 읽는다(요청마다 — 캐시하지 않는다).
 * 시험 목록 → csat_ec_embargoed_exams → 보류 시험의 문항 · 유형. 보류가 없으면 질의 둘로 끝난다.
 * 유형 보류는 DB 정책(type_answer_embargoed)과 같다 — 보류 시험에 그 유형 문항이 하나라도 있으면 그 유형의 보고 · 사례를 뺀다.
 */
export async function loadRevealScope(deps?: GateDeps): Promise<RevealScope> {
  try {
    const db = gateDb(deps)
    // 주최 둘(CHECK 제약 organizer ∈ kice · edu_office)을 각각 — 학평도 보류 대상이라 평가원으로 좁히지 않는다
    const page = (kice: boolean) => keysetSelect<{ id: string }, string>(
      (cursor, limit) => {
        const q = kice
          ? db.from('csat_exams').select('id').eq('organizer', 'kice').order('id').limit(limit)
          : db.from('csat_exams').select('id').eq('organizer', 'edu_office').order('id').limit(limit)
        return cursor === null ? q : q.gt('id', cursor)
      },
      (r) => r.id,
      'reveal-gate 시험 목록',
    )
    const exams = (await Promise.all([page(true), page(false)])).flat()
    const held = await heldBy('csat_ec_embargoed_exams', exams.map((e) => e.id), deps)
    if (held.failed) return FAILED_SCOPE
    if (held.set.size === 0) return { failed: false, exams: held.set, items: new Set(), types: new Set() }
    const heldExams = [...held.set]
    const items = await keysetSelect<{ id: string; type_id: string | null }, string>(
      (cursor, limit) => {
        const q = db.from('csat_items').select('id, type_id').in('exam_id', heldExams).order('id').limit(limit)
        return cursor === null ? q : q.gt('id', cursor)
      },
      (r) => r.id,
      'reveal-gate 보류 문항',
    )
    return {
      failed: false,
      exams: held.set,
      items: new Set(items.map((i) => i.id)),
      types: new Set(items.map((i) => i.type_id).filter((x): x is string => Boolean(x))),
    }
  } catch (e) {
    gateLog('gate_failure', { fn: 'loadRevealScope', reason: e instanceof Error ? e.message : String(e) })
    return FAILED_SCOPE
  }
}

export function isExamHeld(scope: RevealScope, examId: string | null | undefined): boolean {
  return scope.failed || (examId != null && scope.exams.has(examId))
}

export function isItemHeld(scope: RevealScope, itemId: string | null | undefined): boolean {
  return scope.failed || (itemId != null && (scope.items.has(itemId) || scope.exams.has(examOfItem(itemId))))
}

export function isTypeHeld(scope: RevealScope, typeId: string | null | undefined): boolean {
  return scope.failed || (typeId != null && scope.types.has(typeId))
}

/** 아무것도 보류가 아닌가(빠른 길 — 원본을 그대로 내도 되는가) */
export function scopeIsClear(scope: RevealScope): boolean {
  return !scope.failed && scope.exams.size === 0
}

// ── 보류 결과 · 응답 계약 ───────────────────────────────────────────────────

export class RevealHeldError extends Error {
  readonly held: HeldReason = HELD_REASON
  constructor() {
    super('reveal-gate: 보류 중인 시험의 정답 민감 데이터')
    this.name = 'RevealHeldError'
  }
}

export function isRevealHeld(e: unknown): e is RevealHeldError {
  return e instanceof RevealHeldError
}

export interface RevealTarget {
  examId?: string | null
  itemId?: string | null
  sessionId?: string | null
}

/** 데이터를 읽기 **전에** 부른다. 보류(또는 판정 실패)면 RevealHeldError 를 던진다 */
export async function assertRevealAllowed(target: RevealTarget, deps?: GateDeps): Promise<void> {
  const checks: Promise<boolean>[] = []
  if (target.examId) checks.push(canRevealExam(target.examId, deps))
  if (target.itemId) checks.push(canRevealItem(target.itemId, deps))
  if (target.sessionId) checks.push(canRevealSession(target.sessionId, deps))
  if (checks.length === 0) return
  if ((await Promise.all(checks)).some((ok) => !ok)) throw new RevealHeldError()
}

/** 앱 계약 — 423 · { held: 'exam_embargo' } · no-store. 본문에 다른 키를 싣지 않는다(시험 · 문항 id 도) */
export function revealHeldResponse(): NextResponse {
  return NextResponse.json({ held: HELD_REASON }, { status: 423, headers: { 'cache-control': 'no-store' } })
}
