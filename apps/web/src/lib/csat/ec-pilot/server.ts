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
 * 참가자이고, 설정 taxonomy 가 TEST 가 아니며 DB 에 봉인돼 있을 때만 연다.
 * taxonomy 사전은 로그인 사용자(authenticated)만 읽는다 — service_role 은 표 권한이 없다(RPC 전용 설계) → 쿠키 클라이언트로 읽는다.
 */
export async function pilotOpen(userId: string, rls?: SupabaseClient): Promise<boolean> {
  if (!isPilotParticipant(userId) || !configTaxonomyAllowed(EC_PILOT.taxonomyVersion)) return false
  const db = rls ?? ((await createClient()) as unknown as SupabaseClient)
  const { data, error } = await db.from('csat_ec_taxonomy_version').select('status, note').eq('version', EC_PILOT.taxonomyVersion).maybeSingle()
  if (error) { console.error('[csat-ec] taxonomy 확인 실패', error.message); return false }
  return data?.status === 'sealed' && !/TEST/.test((data.note as string | null) ?? '')
}

export async function ownSession(admin: SupabaseClient, userId: string, sessionId: string) {
  const { data, error } = await admin.from('csat_dx_session').select('id, user_id, mode, exam_id').eq('id', sessionId).maybeSingle()
  if (error) throw new Error(`세션 조회 실패: ${error.message}`)
  if (!data || data.user_id !== userId || !['live', 'retake'].includes(data.mode as string)) return null
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
