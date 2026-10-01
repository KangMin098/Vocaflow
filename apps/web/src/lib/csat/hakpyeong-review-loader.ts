// apps/web/src/lib/csat/hakpyeong-review-loader.ts
//
// **학평 독립 검수 모니터 — DB 읽기(server-only).** 판정은 hakpyeong-review.ts 의 reviewBlock.
//
// 읽는 것은 전부 DB·CLI 가 이미 낸 값이다(화면이 새 기준을 만들지 않는다):
//   · 유효 승인 — RPC csat_valid_review_personas_many(발행 게이트와 **같은 함수**). 과거 pass 개수를 세지 않는다
//   · 사전 검사 — csat_review_prechecks(CLI precheckAnalysis 결과) · 검사 당시 해시를 지금 해시와 비교해 오래됨을 가린다
//   · 현재 근거 단위 목록 해시 — RPC csat_current_units_many(원문 해시까지 묶은 현재 목록)
// 읽기 실패는 `error` 로 돌려준다 — 0건으로 삼키지 않는다.
import 'server-only'
import type { SupabaseClient } from '@supabase/supabase-js'
import { createCsatClient, selectAllPages } from './client'
import { HAKPYEONG_ID_PREFIX } from './exam-id'
import {
  PERSONAS,
  type HakReviewData,
  type HakReviewItem,
  type Persona,
  type PrecheckRecord,
  type ReviewBatch,
  type ReviewFollowup,
  type ReviewVerdict,
} from './hakpyeong-review'

// 검수 표·RPC(csat_review_runs · csat_independent_reviews · csat_review_prechecks · csat_valid_review_personas_many …)는
// 생성된 DB 타입(@vocaflow/types)에 아직 없다 — approvals.ts 와 같이 타입 없는 클라이언트로 읽고 행 모양은 아래 인터페이스로 고정한다
type Db = SupabaseClient
const CHUNK = 200
const chunks = <T,>(xs: T[]) => Array.from({ length: Math.ceil(xs.length / CHUNK) }, (_, i) => xs.slice(i * CHUNK, (i + 1) * CHUNK))

interface AnalysisRow { id: string; item_id: string; version: number; status: string; analyst_run: string | null; units_hash: string | null; csat_analysis_hash: string }
interface ReviewRow { analysis_id: string; persona: Persona; verdict: 'pass' | 'revise' | 'fail'; findings: unknown; reviewed_at: string; csat_review_runs: { kind: 'blind' | 'rereview' } | null }
interface BatchRow { batch: string; run_date: string; kind: ReviewBatch['kind']; chunk_size: number | null; items: number; agents: number | null; tokens: ReviewBatch['tokens']; published: number | null; refused: number | null; re_rejected: number | null; note: string | null }
interface FollowupRow { item_id: string; source: string; finding: string; severity: ReviewFollowup['severity']; status: ReviewFollowup['status']; noted_on: string }
interface PrecheckRow { analysis_id: string; analysis_hash: string; units_hash: string; precheck_version: number; commit: string | null; errors: string[]; warnings: string[]; checked_at: string }

const asStrings = (v: unknown): string[] => (Array.isArray(v) ? v.map((x) => (typeof x === 'string' ? x : JSON.stringify(x))) : [])

/**
 * @param items 이 학년의 문항(id·유형) — evidence 로더가 이미 읽은 것을 넘긴다(csat_items 를 다시 읽지 않는다)
 */
export async function loadHakpyeongReview(
  grade: 1 | 2 | 3,
  items: { id: string; typeId: string }[],
  db: Db = createCsatClient() as unknown as SupabaseClient,
): Promise<HakReviewData> {
  const empty: HakReviewData = { items: [], batches: [], followups: [], error: null }
  try {
    // 문항 id 범위: 이 학년의 학평만(`H____G3%`) — exam-id.ts 「DB 질의 범위」
    const idPattern = `${HAKPYEONG_ID_PREFIX}____G${grade}%`
    const analysesRes = await selectAllPages<AnalysisRow>((from, to) =>
      db.from('csat_item_analyses')
        .select('id, item_id, version, status, analyst_run, units_hash, csat_analysis_hash')
        .like('item_id', idPattern)
        .order('item_id').order('version', { ascending: false })
        .range(from, to),
    )
    if (analysesRes.error) return { ...empty, error: `분석 조회: ${analysesRes.error}` }
    const latest = new Map<string, AnalysisRow>()
    for (const r of analysesRes.rows) if (!latest.has(r.item_id)) latest.set(r.item_id, r)
    const analyses = [...latest.values()]
    const ids = analyses.map((a) => a.id)
    const itemIds = analyses.map((a) => a.item_id)

    const valid = new Map<string, Persona[]>()
    const curUnits = new Map<string, string>()
    const verdicts = new Map<string, ReviewVerdict[]>()
    const prechecks = new Map<string, PrecheckRow>()
    for (const part of chunks(ids)) {
      // 이력 표는 분석 200개에 대해서도 1000행을 넘을 수 있다 — 결정적 순서로 전 페이지를 읽는다(CONVENTIONS PostgREST 페이지)
      const [v, rv, pc] = await Promise.all([
        db.rpc('csat_valid_review_personas_many', { p_analyses: part }),
        selectAllPages<ReviewRow>((from, to) => db.from('csat_independent_reviews')
          .select('id, analysis_id, persona, verdict, findings, reviewed_at, csat_review_runs(kind)')
          .in('analysis_id', part)
          .order('analysis_id').order('reviewed_at').order('id')
          .range(from, to)),
        selectAllPages<PrecheckRow>((from, to) => db.from('csat_review_prechecks')
          .select('analysis_id, analysis_hash, units_hash, precheck_version, commit, errors, warnings, checked_at')
          .in('analysis_id', part)
          .order('analysis_id').order('checked_at', { ascending: false }).order('analysis_hash').order('units_hash').order('precheck_version')
          .range(from, to)),
      ])
      if (v.error) return { ...empty, error: `유효 승인 조회: ${v.error.message}` }
      if (rv.error) return { ...empty, error: `검수 판정 조회: ${rv.error}` }
      if (pc.error) return { ...empty, error: `사전 검사 조회: ${pc.error}` }
      for (const r of (v.data ?? []) as { analysis_id: string; personas: string[] | null }[]) {
        valid.set(r.analysis_id, (r.personas ?? []).filter((p): p is Persona => (PERSONAS as readonly string[]).includes(p)))
      }
      for (const r of rv.rows) {
        const list = verdicts.get(r.analysis_id) ?? []
        list.push({ persona: r.persona, verdict: r.verdict, kind: r.csat_review_runs?.kind ?? 'blind', findings: asStrings(r.findings), reviewedAt: r.reviewed_at, counted: false })
        verdicts.set(r.analysis_id, list)
      }
      for (const r of pc.rows) if (!prechecks.has(r.analysis_id)) prechecks.set(r.analysis_id, r)
    }
    for (const part of chunks(itemIds)) {
      const u = await db.rpc('csat_current_units_many', { p_items: part }).select('item_id, units_hash')
      if (u.error) return { ...empty, error: `근거 단위 목록 조회: ${u.error.message}` }
      for (const r of (u.data ?? []) as { item_id: string; units_hash: string }[]) curUnits.set(r.item_id, r.units_hash)
    }

    const typeOf = new Map(items.map((i) => [i.id, i.typeId]))
    const out: HakReviewItem[] = items.map((it) => {
      const a = latest.get(it.id)
      if (!a) {
        return { itemId: it.id, typeId: it.typeId, analysisId: null, version: null, status: null, analystRun: null, unitsBased: false, validPersonas: [], verdicts: [], precheck: null }
      }
      const vp = valid.get(a.id) ?? []
      const pc = prechecks.get(a.id)
      const precheck: PrecheckRecord | null = pc
        ? {
            errors: asStrings(pc.errors), warnings: asStrings(pc.warnings), checkedAt: pc.checked_at,
            precheckVersion: pc.precheck_version, commit: pc.commit,
            current: pc.analysis_hash === a.csat_analysis_hash && pc.units_hash === (curUnits.get(a.item_id) ?? ''),
          }
        : null
      // RPC 는 «유효 승인이 있는 페르소나»만 돌려준다 — 어느 기록이 그 승인인지는 알 수 없다(분석 실행 주체가 바뀌면
      // 최근 통과가 자기 검수가 되고 옛 통과가 유효할 수 있다). 그래서 counted 는 «이 기록의 페르소나에 유효 승인이 있는가»이고,
      // 화면도 기록 단위가 아니라 페르소나 단위로 말한다(Codex 리뷰 — 기록 id 를 주려면 게이트 함수 변경이 필요)
      const vs = [...(verdicts.get(a.id) ?? [])]
        .sort((x, y) => x.reviewedAt.localeCompare(y.reviewedAt))
        .map((v) => ({ ...v, counted: vp.includes(v.persona) }))
      return {
        itemId: it.id, typeId: typeOf.get(it.id) ?? it.typeId, analysisId: a.id, version: a.version, status: a.status,
        analystRun: a.analyst_run, unitsBased: Boolean(a.units_hash), validPersonas: vp, verdicts: vs, precheck,
      }
    })

    const [bRes, fRes] = await Promise.all([
      selectAllPages<BatchRow>((from, to) => db.from('csat_review_batches').select('batch, run_date, kind, chunk_size, items, agents, tokens, published, refused, re_rejected, note').order('run_date', { ascending: false }).order('batch').range(from, to)),
      selectAllPages<FollowupRow>((from, to) => db.from('csat_review_followups').select('item_id, source, finding, severity, status, noted_on').order('noted_on', { ascending: false }).order('item_id').order('source').order('finding').range(from, to)),
    ])
    if (bRes.error) return { ...empty, items: out, error: `배치 원장 조회: ${bRes.error}` }
    if (fRes.error) return { ...empty, items: out, error: `추적 목록 조회: ${fRes.error}` }
    const batches: ReviewBatch[] = bRes.rows.map((b) => ({
      batch: b.batch, runDate: b.run_date, kind: b.kind, chunkSize: b.chunk_size, items: b.items, agents: b.agents,
      tokens: b.tokens ?? null, published: b.published, refused: b.refused, reRejected: b.re_rejected, note: b.note,
    }))
    // 이 학년 문항 + 규칙 과제(문항 id 가 아닌 것)
    const gradeMark = `G${grade}#`
    const followups: ReviewFollowup[] = fRes.rows
      .filter((f) => !f.item_id.startsWith(HAKPYEONG_ID_PREFIX) || f.item_id.includes(gradeMark))
      .map((f) => ({ itemId: f.item_id, source: f.source, finding: f.finding, severity: f.severity, status: f.status, notedOn: f.noted_on }))
    return { items: out, batches, followups, error: null }
  } catch (e) {
    return { ...empty, error: e instanceof Error ? e.message : '검수 모니터를 읽지 못했습니다.' }
  }
}
