// apps/web/src/lib/csat/ec-pilot/server.ts
//
// 학생 증거 수집 — 서버 쪽. 원인 RPC(csat_ec_*)는 auth.uid() 를 쓰므로 **쿠키 클라이언트**로 부른다.
// 세션 소유 확인 · 문항 원문 · 정오는 service role 로 읽되, 정오(is_correct)는 학생 응답에 내보내지 않는다.

import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import { NextResponse } from 'next/server'

import { recordQuality } from '@/lib/csat/diagnosis/engine/record-quality'
import { createAdminClient } from '@/lib/supabase/admin'
import { createClient } from '@/lib/supabase/server'

import { EC_PILOT, configTaxonomyAllowed, isPilotParticipant } from './config'
import { pilotMode, runGate } from './gate'
import { currentProbe, studentProbe, type StudentProbe } from './probes'
import { selectTargets, sentenceRanges, type InterpretationState, type TargetCandidate } from './targets'

export interface EcContext { userId: string; rls: SupabaseClient; admin: SupabaseClient }

/** 로그인 · 참가자 · taxonomy 관문을 모두 통과해야 ctx. 아니면 응답(401 · 404) */
export async function ecContext(): Promise<EcContext | NextResponse> {
  const rls = (await createClient()) as unknown as SupabaseClient
  const { data: { user } } = await rls.auth.getUser()
  if (!user) return NextResponse.json({ error: '로그인이 필요해요' }, { status: 401 })
  const admin = createAdminClient() as unknown as SupabaseClient
  if (!(await pilotOpen(user.id, rls))) return NextResponse.json({ error: '지금은 사용할 수 없어요' }, { status: 404 })
  return { userId: user.id, rls, admin }
}

/**
 * 참가자이고, G6 게이트(gate.ts)를 통과할 때만 연다.
 *   · run 모드: 봉인 run 메타 + live 해시 · 설정 · env 일치(fail-closed). examId 를 주면 run 의 시험인지도 본다.
 *   · verification 모드: 활성 run 이 없고 CSAT_EC_PILOT_MODE=verification · 로그인 이메일 @example.com 일 때만(개발 · e2e).
 *   · 두 모드 모두 설정 taxonomy 가 TEST 가 아니고 DB 에 봉인돼 있어야 한다.
 * taxonomy 사전은 로그인 사용자(authenticated)만 읽는다 — service_role 은 표 권한이 없다(RPC 전용 설계) → 쿠키 클라이언트로 읽는다.
 */
export async function pilotOpen(userId: string, rls?: SupabaseClient, examId?: string): Promise<boolean> {
  const mode = pilotMode()
  if (mode === 'closed' || !isPilotParticipant(userId) || !configTaxonomyAllowed(EC_PILOT.taxonomyVersion)) return false
  const db = rls ?? ((await createClient()) as unknown as SupabaseClient)
  if (mode === 'run') {
    const g = await runGate(db)
    return g.open && (examId === undefined || g.exams.includes(examId))
  }
  // verification — 테스트 계정만(실제 참가자는 @example.com 을 가질 수 없다 · PILOT_PROTOCOL §2)
  const { data: { user } } = await db.auth.getUser()
  if (!user || user.id !== userId || !/@example\.com$/i.test(user.email ?? '')) return false
  const { data, error } = await db.from('csat_ec_taxonomy_version').select('status, note').eq('version', EC_PILOT.taxonomyVersion).maybeSingle()
  if (error) { console.error('[csat-ec] taxonomy 확인 실패', error.message); return false }
  return data?.status === 'sealed' && !/TEST/.test((data.note as string | null) ?? '')
}

export async function ownSession(admin: SupabaseClient, userId: string, sessionId: string) {
  const { data, error } = await admin.from('csat_dx_session').select('id, user_id, mode, exam_id').eq('id', sessionId).maybeSingle()
  if (error) throw new Error(`세션 조회 실패: ${error.message}`)
  if (!data || data.user_id !== userId || !['live', 'retake'].includes(data.mode as string)) return null
  // run 모드면 run 의 시험만 수집 경로로 다룬다(다른 시험 세션은 없는 것처럼)
  if (pilotMode() === 'run' && !(await runGate((await createClient()) as unknown as SupabaseClient)).exams.includes(data.exam_id as string)) return null
  return data as { id: string; user_id: string; mode: string; exam_id: string }
}

export interface CaptureItem {
  itemNo: number
  chosen: number
  stem: string
  passage: { sentence: number; text: string }[]
  choices: { no: number; text: string }[]
  saved: { reason: boolean; blocked: boolean; interpretation: InterpretationState | null; category: boolean }
}
export interface CaptureState {
  status: 'open' | 'not_eligible'
  confirmed: boolean
  items: CaptureItem[]
}

/** 대상 문항 · 원문 · 저장 상태 — 정오는 포함하지 않는다 */
export async function loadCapture(ctx: EcContext, sessionId: string): Promise<CaptureState | null> {
  const s = await ownSession(ctx.admin, ctx.userId, sessionId)
  if (!s) return null
  // 정오(is_correct)는 읽지 않는다 — 대상은 봉인된 capture 대상(정오 무관)으로만 정한다
  const { data: resp, error } = await ctx.admin.from('csat_dx_response').select('item_no, item_id, chosen_option').eq('session_id', sessionId)
  if (error) throw new Error(`응답 조회 실패: ${error.message}`)
  const rows = resp ?? []
  if (recordQuality(rows.map((r) => ({ no: r.item_no as number, chosen: (r.chosen_option as number | null) ?? null }))).status !== 'trusted')
    return { status: 'not_eligible', confirmed: false, items: [] }
  const ids = rows.map((r) => r.item_id as string | null).filter((x): x is string => !!x)
  const { data: items, error: ie } = await ctx.admin.from('csat_items').select('id, stem, passage, choices, body_ok').in('id', ids.length ? ids : ['-'])
  if (ie) throw new Error(`문항 조회 실패: ${ie.message}`)
  const byId = new Map((items ?? []).map((i) => [i.id as string, i]))
  const cands: TargetCandidate[] = rows.map((r) => {
    const it = r.item_id ? byId.get(r.item_id as string) : undefined
    return { itemNo: r.item_no as number, chosen: (r.chosen_option as number | null) ?? null,
      stem: (it?.stem as string | null) ?? null, passage: (it?.passage as string | null) ?? null,
      choices: Array.isArray(it?.choices) ? (it!.choices as string[]) : null, bodyOk: it?.body_ok === true }
  })
  const { data: cap, error: ce } = await ctx.rls.rpc('csat_ec_my_capture_state', { p_session: sessionId })
  if (ce) throw new Error(`수집 상태 조회 실패: ${ce.message}`)
  // 수집 화면을 처음 열면 held → collecting(capture_open · 멱등 — 이미 열렸거나 끝났으면 상태만 돌려준다).
  // 보류(정답 · 정오 비공개)는 collecting 에서도 그대로다 — 풀리는 것은 finishCapture(completed) 뒤다
  if ((cap as { status?: string } | null)?.status === 'held') {
    const { error: oe } = await ctx.rls.rpc('csat_ec_capture_open', { p_session: sessionId })
    if (oe) throw new Error(`수집 열기 실패: ${oe.message}`)
  }
  const sealed = Array.isArray((cap as { targets?: unknown } | null)?.targets) ? ((cap as { targets: unknown[] }).targets.filter((x): x is number => typeof x === 'number')) : []
  const targets = new Set(selectTargets(cands, sealed))
  const saved = await savedSummary(ctx, sessionId)
  const { data: conf } = await ctx.rls.from('csat_ec_session_confirmation').select('revision, took_exam, judged_each').eq('session_id', sessionId).order('revision', { ascending: false }).limit(1)
  const out: CaptureItem[] = []
  for (const r of rows.filter((x) => targets.has(x.item_no as number)).sort((a, b) => (a.item_no as number) - (b.item_no as number))) {
    const it = byId.get(r.item_id as string)!
    const passage = (it.passage as string | null) ?? ''
    out.push({
      itemNo: r.item_no as number,
      chosen: r.chosen_option as number,
      stem: it.stem as string,
      passage: sentenceRanges(passage, 'passage').map((x, i) => ({ sentence: i, text: passage.slice(x.start, x.end) })),
      choices: (it.choices as string[]).map((t, i) => ({ no: i + 1, text: t })),
      saved: saved.get(r.item_no as number) ?? { reason: false, blocked: false, interpretation: null, category: false },
    })
  }
  return { status: 'open', confirmed: !!(conf?.[0]?.took_exam && conf?.[0]?.judged_each), items: out }
}

export type FinishResult =
  | { status: 'completed' | 'closed_incomplete' }
  | { status: 'collecting'; missing: 'confirmation' }
  | { status: 'collecting'; missing: 'interpretation'; remaining: number[] }
  | { status: 'none' }

/**
 * 수집을 끝낸다(collecting → completed, capture_finish · 멱등). 끝나야 그 시험의 보류가 풀린다.
 * 확인 · 해석이 빠졌으면 끝내지 않고 무엇이 남았는지만 돌려준다(정오는 담지 않는다 — 남은 문항 번호는 봉인된 대상 안의 번호다).
 * 수집 대상이 아닌 기록(capture 행 없음)은 'none'.
 */
export async function finishCapture(ctx: EcContext, sessionId: string): Promise<FinishResult | null> {
  if (!(await ownSession(ctx.admin, ctx.userId, sessionId))) return null
  const { data: cap, error: ce } = await ctx.rls.rpc('csat_ec_my_capture_state', { p_session: sessionId })
  if (ce) throw new Error(`수집 상태 조회 실패: ${ce.message}`)
  const status = (cap as { status?: string } | null)?.status
  if (!status) return { status: 'none' }
  if (status === 'held') {
    const { error: oe } = await ctx.rls.rpc('csat_ec_capture_open', { p_session: sessionId })
    if (oe) throw new Error(`수집 열기 실패: ${oe.message}`)
  }
  const { data, error } = await ctx.rls.rpc('csat_ec_capture_finish', { p_session: sessionId })
  if (error) throw new Error(`수집 끝내기 실패: ${error.message}`)
  const r = (data ?? {}) as { status?: string; missing?: string; remaining?: unknown }
  if (r.status === 'completed' || r.status === 'closed_incomplete') return { status: r.status }
  if (r.missing === 'confirmation') return { status: 'collecting', missing: 'confirmation' }
  if (r.missing === 'interpretation') {
    const remaining = Array.isArray(r.remaining) ? r.remaining.filter((x): x is number => typeof x === 'number') : []
    return { status: 'collecting', missing: 'interpretation', remaining }
  }
  throw new Error(`수집 끝내기 응답을 해석하지 못했다: ${JSON.stringify(r).slice(0, 120)}`)
}

export interface OwnEvidence { id: string; item_no: number; kind: string; value: Record<string, unknown>; created_at: string }

/** 본인 세션의 **유효** 과정 증거(지금 문항 입력 해시 · 정정되지 않음 — csat_ec_my_process_evidence) */
export async function ownValidEvidence(ctx: EcContext, sessionId: string): Promise<OwnEvidence[]> {
  const { data, error } = await ctx.rls.rpc('csat_ec_my_process_evidence', { p_session: sessionId })
  if (error) throw new Error(`증거 조회 실패: ${error.message}`)
  return (data ?? []) as OwnEvidence[]
}

/** 문항별 저장 상태 — 유효 증거만(원문 · 정답이 바뀌어 무효가 된 증거는 저장 안 됨으로 본다) */
async function savedSummary(ctx: EcContext, sessionId: string) {
  const m = new Map<number, CaptureItem['saved']>()
  for (const r of await ownValidEvidence(ctx, sessionId)) {
    const cur = m.get(r.item_no) ?? { reason: false, blocked: false, interpretation: null, category: false }
    if (r.kind === 'reason') cur.reason = true
    if (r.kind === 'blocked_span') cur.blocked = true
    if (r.kind === 'category') cur.category = true
    if (r.kind === 'interpretation') cur.interpretation = ((r.value as { state?: InterpretationState }).state ?? 'answered')
    m.set(r.item_no, cur)
  }
  return m
}

export async function itemSource(ctx: EcContext, sessionId: string, itemNo: number) {
  const { data, error } = await ctx.admin.from('csat_dx_response').select('item_id').eq('session_id', sessionId).eq('item_no', itemNo).maybeSingle()
  if (error) throw new Error(`응답 조회 실패: ${error.message}`)
  if (!data?.item_id) return null
  const { data: it, error: ie } = await ctx.admin.from('csat_items').select('id, stem, passage, choices').eq('id', data.item_id as string).maybeSingle()
  if (ie) throw new Error(`문항 조회 실패: ${ie.message}`)
  return it ? { itemId: it.id as string, stem: it.stem as string | null, passage: it.passage as string | null, choices: Array.isArray(it.choices) ? (it.choices as string[]) : null } : null
}

export interface PendingProbe { itemNo: number; probe: StudentProbe }

/** 대기 probe — 설정 taxonomy 만 · 저장소 정의가 있는 것만 · 세션 상한(건너뜀 포함 누계) 안에서만 */
export async function pendingProbes(ctx: EcContext, sessionId: string): Promise<PendingProbe[]> {
  const { data, error } = await ctx.rls.rpc('csat_ec_my_pending_probes', { p_session: sessionId })
  if (error) throw new Error(`대기 질문 조회 실패: ${error.message}`)
  const rows = ((data ?? []) as { item_no: number; taxonomy_version: string; probe_key: string }[])
    .filter((r) => r.taxonomy_version === EC_PILOT.taxonomyVersion)
  const out: PendingProbe[] = []
  for (const r of rows) {
    const def = currentProbe(r.probe_key)
    if (def && !out.some((p) => p.itemNo === r.item_no)) out.push({ itemNo: r.item_no, probe: studentProbe(def) })
  }
  const cap = EC_PILOT.probeCapPerSession
  if (cap === null) return out.sort((a, b) => a.itemNo - b.itemNo)
  const { count, error: ce } = await ctx.rls.from('csat_ec_process_evidence').select('id', { count: 'exact', head: true })
    .eq('session_id', sessionId).eq('kind', 'targeted_probe').is('supersedes_id', null)
  if (ce || count === null) throw new Error(`질문 누계 조회 실패: ${ce?.message ?? 'count 없음'}`)
  return out.sort((a, b) => a.itemNo - b.itemNo).slice(0, Math.max(0, cap - count))
}

/** 저장된 probe 응답 경계 키 — 대기 목록에서 꺼낸 경계와 같아야 한다 */
export async function pendingBoundary(ctx: EcContext, sessionId: string, itemNo: number, probeKey: string): Promise<string | null> {
  const { data, error } = await ctx.rls.rpc('csat_ec_my_pending_probes', { p_session: sessionId })
  if (error) throw new Error(`대기 질문 조회 실패: ${error.message}`)
  const row = ((data ?? []) as { item_no: number; taxonomy_version: string; boundary_key: string; probe_key: string }[])
    .find((r) => r.item_no === itemNo && r.probe_key === probeKey && r.taxonomy_version === EC_PILOT.taxonomyVersion)
  return row?.boundary_key ?? null
}

/** 이미 저장된 첫 probe 응답의 경계(재시도 · 중복 복구용) */
export async function savedProbe(ctx: EcContext, sessionId: string, itemNo: number, probeKey: string) {
  const { data, error } = await ctx.rls.from('csat_ec_process_evidence').select('id, value').eq('session_id', sessionId).eq('item_no', itemNo)
    .eq('kind', 'targeted_probe').is('supersedes_id', null)
  if (error) throw new Error(`질문 응답 조회 실패: ${error.message}`)
  return (data ?? []).find((r) => (r.value as { probe_key?: string }).probe_key === probeKey) ?? null
}
