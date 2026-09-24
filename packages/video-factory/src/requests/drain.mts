// packages/video-factory/src/requests/drain.mts
//
// **요청 드레인 — 기획·설계는 에이전트가, 적용은 기존 공장이.**
//
// 저장소의 다른 드레인과 같은 3단 구조(AGENTS.md §LLM 판단):
//   requests:export  → work/requests/chunk-NN.json        (재실행 안전: 채워진 것은 건너뛴다)
//   (에이전트)        → work/requests/chunk-NN.out.json    (video-request-designer 서브에이전트)
//   requests:import  → video_request_add_revision         (기본 예행 · --commit 으로 쓴다)
// 그 뒤:
//   (관리자)          → /admin/video 에서 승인 · 수정 요청 · 반려
//   requests:pull    → 승인본 → work/request-specs.json + video_jobs 큐 + phase applying
//   voice · render · loudness · thumbs · package · publish   (기존 명령 그대로)
//   requests         → 큐가 published 면 applied, failed 면 failed 로 옮긴다(상태 동기화)
//   evaluate         → 요청 편은 규격 + 목적 평가를 video_request_evaluations 에 쓴다
//
// phase 는 전부 RPC 로만 옮긴다 — 전이 규칙(「승인 없이 적용 없음」)은 DB 한 곳에 있다.

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { SupabaseClient } from '@supabase/supabase-js'

import { buildSpecs } from '../catalog/build'
import { loadBundle, type SourceBundle } from '../catalog/bundle'
import { requestVideoId } from '../catalog/ids'
import { enqueueAll, requireServiceClient } from '../jobs/client'
import type { Scorecard } from '../spec/evaluate'
import type { FormatId } from '../spec/format'
import type { VideoSpec } from '../spec/types'
import { NEEDS } from './audiences'
import { PHASE_LABEL, nextStepText } from './phases'
import { checkDesign } from './design'
import { REQUEST_SPECS_PATH, loadRequestSpecs, writeRequestSpecs } from './store'
import { writeRetired } from './retired'
import { buildRequestSpec, type BuildContext, type RequestMeta } from './to-spec'
import type { RequestAudience, RequestDesign, RequestPhase, RequestPlan, RequestPurpose } from './types'

const HERE = path.dirname(fileURLToPath(import.meta.url))
export const REQUESTS_WORK = path.resolve(HERE, '../../work/requests')

/** 청크 하나에 담는 요청 수 — 설계자 한 명이 원료를 읽고 쓰기에 무리 없는 양 */
const PER_CHUNK = 4

/** 목적 평가의 최소 표본 — 이보다 적으면 비율을 내지 않는다(「못 잼」) */
const OUTCOME_MIN_STARTS = 30

interface RequestRow {
  id: string
  domain_id: string
  target_key: string
  target_label: string
  purpose: RequestPurpose
  audience: RequestAudience
  formats: FormatId[]
  memo: string
  video_id: string | null
  phase: RequestPhase
  current_rev: number
  error: string | null
  created_at: string
  mode: 'new' | 'replace'
}

interface RevisionRow {
  request_id: string
  rev: number
  plan: RequestPlan
  design: RequestDesign
}

interface ReviewRow {
  request_id: string
  rev: number
  decision: string
  comment: string
  created_at: string
}

/** 청크 안의 요청 한 건 — 설계자가 읽는 것 */
export interface ChunkItem {
  requestId: string
  /** 이번에 써야 할 rev — import 가 이 값으로 낡은 답을 거른다 */
  rev: number
  videoId: string
  request: Pick<RequestRow, 'domain_id' | 'target_key' | 'target_label' | 'purpose' | 'audience' | 'formats' | 'memo' | 'mode'>
  need: (typeof NEEDS)['learn']['student']
  /** 직전 rev 와 그에 대한 검토 코멘트 — 수정 요청이면 반드시 반영 */
  previous: { rev: number; plan: RequestPlan; design: RequestDesign } | null
  reviews: { rev: number; decision: string; comment: string }[]
  /** 같은 분야·수요자·목적의 지난 평가 — 다음 기획의 입력 */
  pastOutcomes: { videoId: string | null; spec: unknown; outcome: unknown }[]
  /** 대상이 기존 편(규칙 편 또는 요청 편)이면 그 설계도 — 출발점. 교체면 **지금 발행본** */
  baseline: VideoSpec | null
  /** 교체 요청이면 지금 발행본의 재생 기록 — 무엇을 고쳐야 하는지의 근거(표본이 작으면 해석하지 않는다) */
  replacing: { videoId: string; started: number | null; completed: number | null } | null
  /** 빌릴 수 있는 장면 목록(id · 컷 번호 · 종류 · 자막) */
  borrowable: { videoId: string; scenes: { index: number; kind: string; caption: string }[] }[]
  /** 대상과 관련된 원료 발췌 + 인용 가능한 경로 예시 */
  facts: { path: string; value: unknown }[]
}

/** 설계자가 채우는 것 */
export interface ChunkOutItem {
  requestId: string
  rev: number
  plan: RequestPlan
  design: RequestDesign
}

/* ───────────────────────── 공용 ───────────────────────── */

function ctxOf(bundle: SourceBundle): BuildContext {
  return { bundle, catalog: buildSpecs(bundle) }
}

function metaOf(r: RequestRow, plan: RequestPlan): RequestMeta {
  return {
    videoId: r.video_id ?? requestVideoId(r.target_key, r.id),
    mode: r.mode,
    purpose: r.purpose,
    audience: r.audience,
    formats: r.formats,
    plan,
  }
}

async function must<T>(p: PromiseLike<{ data: T | null; error: { message: string } | null }>, what: string): Promise<T> {
  const { data, error } = await p
  if (error) throw new Error(`${what}: ${error.message}`)
  if (data === null) throw new Error(`${what}: 결과 없음`)
  return data
}

function chunkFiles(): { n: number; file: string; out: string }[] {
  if (!fs.existsSync(REQUESTS_WORK)) return []
  return fs
    .readdirSync(REQUESTS_WORK)
    .map((f) => f.match(/^chunk-(\d+)\.json$/))
    .filter((m): m is RegExpMatchArray => m !== null)
    .map((m) => ({
      n: Number(m[1]),
      file: path.join(REQUESTS_WORK, m[0]),
      out: path.join(REQUESTS_WORK, m[0].replace('.json', '.out.json')),
    }))
    .sort((a, b) => a.n - b.n)
}

/** 원료에서 대상과 관련된 값만 추린다 — 설계자가 경로를 지어내지 않게 실제 경로를 보여 준다 */
function factsFor(b: SourceBundle, targetKey: string): { path: string; value: unknown }[] {
  const out: { path: string; value: unknown }[] = []
  for (const [k, v] of Object.entries(b.platform)) out.push({ path: `platform.${k}`, value: v })
  const vol = targetKey.match(/^volume-([a-z0-9]+)-(\d+)$/)
  const ser = targetKey.match(/^series-([a-z0-9]+)$/)
  const seriesId = vol?.[1] ?? ser?.[1]
  if (seriesId) {
    const s = b.series.find((x) => x.id === seriesId)
    if (s) {
      out.push({ path: `series[id=${s.id}].brand`, value: s.brand })
      out.push({ path: `series[id=${s.id}].marketSeries`, value: s.marketSeries })
      for (const r of s.rungs) {
        if (vol && r.step !== Number(vol[2])) continue
        for (const k of ['volumeTitle', 'schoolBand', 'items', 'explained'] as const) {
          out.push({ path: `series[id=${s.id}].rungs[step=${r.step}].${k}`, value: r[k] })
        }
      }
    }
  }
  const type = targetKey.match(/^type-(.+)$/)
  if (type) {
    const code = type[1]!.replace(/-/g, '_')
    const g = b.typeGuide[code]
    if (g) {
      for (const k of ['label', 'items', 'explained'] as const) out.push({ path: `typeGuide.${code}.${k}`, value: g[k] })
    }
  }
  const mod = targetKey.match(/^module-(.+)$/)
  if (mod) {
    const a = b.activities.find((x) => x.id === mod[1])
    if (a) out.push({ path: `activities[id=${a.id}].name`, value: a.name })
  }
  return out
}

/* ───────────────────────── 내린 편 ───────────────────────── */

export interface RetirementRow {
  video_id: string
  reason: string
  retired_at: string
  restored_at: string | null
  purged_at: string | null
}

/**
 * DB 의 내린 편 → `work/retired.json`. 음성·렌더·포장 전에 돈다.
 * **못 읽으면 멈춘다** — 옛 파일이나 빈 목록으로 진행하면 내린 편이 되살아난다.
 */
export async function refreshRetiredFile(db: SupabaseClient = requireServiceClient()): Promise<RetirementRow[]> {
  const rows = await must<RetirementRow[]>(
    db.from('video_retirements').select('video_id,reason,retired_at,restored_at,purged_at'),
    '내린 편 조회',
  )
  const live = rows.filter((r) => r.restored_at === null)
  writeRetired(live.map((r) => r.video_id))
  return live
}

/* ───────────────────────── 상태 · 동기화 ───────────────────────── */

/** 큐(video_jobs)의 결과를 요청 phase 로 옮긴다. 재실행 안전 — 허용된 전이만 일어난다. */
async function syncApplying(db: SupabaseClient): Promise<{ applied: number; failed: number }> {
  const rows = await must<RequestRow[]>(
    db.from('video_requests').select('*').eq('phase', 'applying').not('video_id', 'is', null),
    '적용 중 요청 조회',
  )
  let applied = 0
  let failed = 0
  for (const r of rows) {
    const { data: job } = await db.from('video_jobs').select('stage,error').eq('video_id', r.video_id!).maybeSingle()
    if (!job) continue
    if (job.stage === 'published') {
      await must(db.rpc('video_request_advance', { p_id: r.id, p_phase: 'applied', p_video_id: null, p_error: null }), '발행 반영')
      applied++
    } else if (job.stage === 'failed') {
      await must(
        db.rpc('video_request_advance', { p_id: r.id, p_phase: 'failed', p_video_id: null, p_error: job.error ?? '큐에서 실패' }),
        '실패 반영',
      )
      failed++
    }
  }
  return { applied, failed }
}

export async function cmdRequests(): Promise<number> {
  const db = requireServiceClient()
  const retired = await refreshRetiredFile(db)
  if (retired.length > 0) console.log(`내린 편 ${retired.length}: ${retired.map((r) => r.video_id).join(', ')}`)
  const s = await syncApplying(db)
  if (s.applied || s.failed) console.log(`큐 반영: 발행 ${s.applied} · 실패 ${s.failed}`)
  const rows = await must<RequestRow[]>(
    db.from('video_requests').select('*').order('created_at', { ascending: true }),
    '요청 조회',
  )
  const byPhase = new Map<RequestPhase, RequestRow[]>()
  for (const r of rows) byPhase.set(r.phase, [...(byPhase.get(r.phase) ?? []), r])
  if (rows.length === 0) {
    console.log('요청 0건 — /admin/video 의 「요청」 탭에서 만든다')
    return 0
  }
  for (const [phase, list] of byPhase) {
    console.log(`\n${PHASE_LABEL[phase]} ${list.length}건`)
    for (const r of list) {
      console.log(`  ${r.id.slice(0, 8)}  ${r.domain_id.padEnd(10)} ${r.target_label}  rev ${r.current_rev}` +
        (r.video_id ? `  ${r.video_id}` : '') + (r.error ? `  ✗ ${r.error}` : ''))
      console.log(`            다음: ${nextStepText(r.phase, r.video_id)}`)
    }
  }
  return 0
}

/* ───────────────────────── export ───────────────────────── */

export async function cmdRequestsExport(): Promise<number> {
  const db = requireServiceClient()
  const bundle = loadBundle()
  const catalog = buildSpecs(bundle)

  const rows = await must<RequestRow[]>(
    db.from('video_requests').select('*').in('phase', ['requested', 'changes_requested']).order('created_at'),
    '설계 대기 조회',
  )

  // 이미 청크에 나간(답이 있든 없든) 같은 rev 는 다시 내보내지 않는다 — 재실행 안전
  const already = new Set<string>()
  for (const c of chunkFiles()) {
    const items = JSON.parse(fs.readFileSync(c.file, 'utf8')) as ChunkItem[]
    for (const it of items) already.add(`${it.requestId}#${it.rev}`)
  }
  const todo = rows.filter((r) => !already.has(`${r.id}#${r.current_rev + 1}`))
  const skipped = rows.length - todo.length

  const ids = todo.map((r) => r.id)
  const revs = ids.length
    ? await must<RevisionRow[]>(db.from('video_request_revisions').select('request_id,rev,plan,design').in('request_id', ids), '이전 rev')
    : []
  const reviews = ids.length
    ? await must<ReviewRow[]>(db.from('video_request_reviews').select('request_id,rev,decision,comment,created_at').in('request_id', ids).order('created_at'), '검토')
    : []
  const evaluated = await must<(RequestRow & { video_request_evaluations: { spec: unknown; outcome: unknown }[] })[]>(
    db.from('video_requests').select('*, video_request_evaluations(spec,outcome)').eq('phase', 'evaluated'),
    '지난 평가',
  )

  const requested = loadRequestSpecs()
  const plays = new Map<string, { videoId: string; started: number | null; completed: number | null }>()
  for (const r of todo.filter((x) => x.mode === 'replace')) {
    const n = async (event: string): Promise<number | null> => {
      const { count, error } = await db
        .from('funnel_events')
        .select('id', { count: 'exact', head: true })
        .eq('event', event)
        .eq('meta->>videoId', r.target_key)
      return error || count === null ? null : count
    }
    plays.set(r.target_key, { videoId: r.target_key, started: await n('video_started'), completed: await n('video_completed') })
  }

  const borrowable = catalog.map((s) => ({
    videoId: s.id,
    scenes: s.scenes.map((sc, index) => ({ index, kind: sc.kind, caption: sc.caption })),
  }))

  const items: ChunkItem[] = todo.map((r) => {
    const prev = revs.filter((v) => v.request_id === r.id).sort((a, b) => b.rev - a.rev)[0] ?? null
    return {
      requestId: r.id,
      rev: r.current_rev + 1,
      videoId: r.video_id ?? requestVideoId(r.target_key, r.id),
      request: {
        domain_id: r.domain_id,
        target_key: r.target_key,
        target_label: r.target_label,
        purpose: r.purpose,
        audience: r.audience,
        formats: r.formats,
        memo: r.memo,
        mode: r.mode,
      },
      need: NEEDS[r.purpose][r.audience],
      previous: prev ? { rev: prev.rev, plan: prev.plan, design: prev.design } : null,
      reviews: reviews.filter((v) => v.request_id === r.id).map((v) => ({ rev: v.rev, decision: v.decision, comment: v.comment })),
      pastOutcomes: evaluated
        .filter((e) => e.domain_id === r.domain_id && e.audience === r.audience && e.purpose === r.purpose)
        .slice(-3)
        .map((e) => ({ videoId: e.video_id, spec: e.video_request_evaluations[0]?.spec ?? null, outcome: e.video_request_evaluations[0]?.outcome ?? null })),
      baseline: catalog.find((s) => s.id === r.target_key) ?? requested.find((s) => s.id === r.target_key) ?? null,
      replacing: r.mode === 'replace' ? (plays.get(r.target_key) ?? { videoId: r.target_key, started: null, completed: null }) : null,
      borrowable,
      facts: factsFor(bundle, r.target_key),
    }
  })

  fs.mkdirSync(REQUESTS_WORK, { recursive: true })
  let n = chunkFiles().reduce((m, c) => Math.max(m, c.n), 0)
  let chunks = 0
  for (let i = 0; i < items.length; i += PER_CHUNK) {
    n++
    chunks++
    const file = path.join(REQUESTS_WORK, `chunk-${String(n).padStart(2, '0')}.json`)
    fs.writeFileSync(file, JSON.stringify(items.slice(i, i + PER_CHUNK), null, 2) + '\n', 'utf8')
  }
  console.log(`대상 ${todo.length} · 청크 ${chunks} · 이미 나가 건너뜀 ${skipped}  (${REQUESTS_WORK})`)
  if (chunks > 0) console.log('다음: 청크마다 video-request-designer 서브에이전트 → chunk-NN.out.json → pnpm video requests:import')
  return 0
}

/* ───────────────────────── import ───────────────────────── */

export async function cmdRequestsImport(commit: boolean): Promise<number> {
  const db = requireServiceClient()
  const ctx = ctxOf(loadBundle())
  let put = 0
  let failed = 0
  const skipped: string[] = []

  for (const c of chunkFiles()) {
    if (!fs.existsSync(c.out)) continue
    const outs = JSON.parse(fs.readFileSync(c.out, 'utf8')) as ChunkOutItem[]
    for (const o of outs) {
      const tag = `${path.basename(c.out)} ${o.requestId?.slice(0, 8)}`
      if (!o.plan || !o.design) {
        skipped.push(`${tag}: 빈 값`)
        continue
      }
      const { data: r } = await db.from('video_requests').select('*').eq('id', o.requestId).maybeSingle<RequestRow>()
      if (!r) {
        skipped.push(`${tag}: 요청이 없다`)
        continue
      }
      if (!['requested', 'changes_requested'].includes(r.phase) || r.current_rev + 1 !== o.rev) {
        skipped.push(`${tag}: 이미 반영됐거나 상태가 바뀌었다(phase ${r.phase}, rev ${r.current_rev})`)
        continue
      }
      const checks = checkDesign(o.plan, o.design, metaOf(r, o.plan), ctx)
      if (!checks.ok) {
        failed++
        console.log(`✗ ${tag} ${r.target_label}`)
        for (const i of checks.items.filter((x) => x.level === 'error')) console.log(`    [${i.rule}] ${i.detail}`)
        continue
      }
      for (const i of checks.items.filter((x) => x.level === 'warn')) console.log(`  ! ${tag} [${i.rule}] ${i.detail}`)
      if (commit) {
        await must(
          db.rpc('video_request_add_revision', {
            p_id: r.id,
            p_plan: o.plan,
            p_design: o.design,
            p_checks: checks,
            p_author: 'claude',
          }),
          `${tag} rev 기록`,
        )
      }
      put++
      console.log(`✓ ${tag} ${r.target_label} — ${checks.seconds}초`)
    }
  }
  console.log(
    `\n${commit ? '넣음' : '넣을 것(예행)'} ${put} · 검사 탈락 ${failed} · 건너뜀 ${skipped.length}` +
      (commit ? '' : '\n확인 뒤 --commit 으로 다시 실행'),
  )
  for (const s of skipped) console.log(`  - ${s}`)
  return failed > 0 ? 1 : 0
}

/* ───────────────────────── pull ───────────────────────── */

/**
 * 승인본을 설계도로 굳힌다. **승인된 rev 만** — DB RPC 가 한 번 더 막는다.
 *
 * `work/request-specs.json` 은 적용 이후 단계의 편 전부로 다시 쓴다(부분만 쓰면 이미 찍은 편이
 * 파일에서 빠져 다시 렌더할 수 없게 된다).
 */
export async function cmdRequestsPull(): Promise<number> {
  const db = requireServiceClient()
  const ctx = ctxOf(loadBundle())
  const rows = await must<RequestRow[]>(
    db.from('video_requests').select('*').in('phase', ['approved', 'failed', 'applying', 'applied', 'evaluated']),
    '적용 대상 조회',
  )
  const ids = rows.map((r) => r.id)
  const revs = ids.length
    ? await must<RevisionRow[]>(db.from('video_request_revisions').select('request_id,rev,plan,design').in('request_id', ids), 'rev')
    : []

  const specs: VideoSpec[] = []
  const toStart: { row: RequestRow; spec: VideoSpec }[] = []
  let broken = 0
  for (const r of rows) {
    const rev = revs.find((v) => v.request_id === r.id && v.rev === r.current_rev)
    if (!rev) {
      console.log(`✗ ${r.id.slice(0, 8)} rev ${r.current_rev} 가 없다`)
      broken++
      continue
    }
    const built = buildRequestSpec(rev.design, metaOf(r, rev.plan), ctx)
    if (!built.spec) {
      // 승인 뒤 원료가 바뀌어 수치가 사라졌을 수 있다 — 지어내지 않고 멈춘다
      console.log(`✗ ${r.target_label}: 설계도를 못 지었다`)
      for (const p of built.problems) console.log(`    [${p.rule}] ${p.detail}`)
      broken++
      continue
    }
    specs.push(built.spec)
    if (r.phase === 'approved' || r.phase === 'failed') toStart.push({ row: r, spec: built.spec })
  }

  writeRequestSpecs(specs)
  // 새 편은 큐에 올리고, 교체 편은 **같은 자리의 큐 행을 처음 단계로** 되돌린다
  //   (video_job_advance 는 단계를 되돌리지 않는다 — 발행된 자리를 다시 찍으면 기록이 안 움직인다)
  const q = await enqueueAll(toStart.filter((t) => t.row.mode !== 'replace').map((t) => t.spec))
  for (const t of toStart.filter((x) => x.row.mode === 'replace')) {
    await must(db.rpc('video_job_restart', { p_video_id: t.spec.id, p_kind: t.spec.kind }), `${t.spec.id} 큐 되돌리기`)
  }
  for (const t of toStart) {
    await must(
      db.rpc('video_request_advance', { p_id: t.row.id, p_phase: 'applying', p_video_id: t.spec.id, p_error: null }),
      `${t.spec.id} 적용 시작`,
    )
    console.log(`→ ${t.spec.id}  ${t.row.target_label}${t.row.mode === 'replace' ? '  (교체 — 발행하면 같은 자리를 덮는다)' : ''}`)
  }
  console.log(
    `\n요청 편 설계도 ${specs.length}편 → ${path.relative(process.cwd(), REQUEST_SPECS_PATH)}` +
      ` · 새로 적용 ${toStart.length} (큐 ${q.ok}${q.skipped ? ` · 못 올림 ${q.skipped}` : ''})` +
      (broken ? ` · 못 지음 ${broken}` : ''),
  )
  if (toStart.length > 0) {
    const ids2 = toStart.map((t) => t.spec.id).join(' ')
    console.log(`다음: pnpm video voice ${ids2} && pnpm video render ${ids2} … (화면의 「적용」 칸에 같은 명령이 있다)`)
  }
  return broken > 0 ? 1 : 0
}

/* ───────────────────────── evaluate ───────────────────────── */

/**
 * 요청 편의 평가를 기록한다 — 규격(스코어카드) + 목적(재생·완주).
 *
 * 목적 평가는 **표본이 작으면 비율을 내지 않는다.** 재생 3번 중 2번 완주를 「67%」로 적으면
 * 다음 기획이 그 수를 근거로 쓴다. CTA 클릭은 영상 계측에 아직 없다 — 없는 것은 「못 잼」이다.
 */
export async function recordRequestEvaluations(cards: Scorecard[]): Promise<number> {
  // 교체 편은 원래 편의 kind 를 이어받으므로 kind 로 거르지 않는다 — 요청의 video_id 로 찾는다
  const db = requireServiceClient()
  const { data: live } = await db
    .from('video_requests')
    .select('*')
    .in('video_id', cards.map((c) => c.videoId))
    .in('phase', ['applied', 'evaluated'])
    .order('updated_at', { ascending: false })
  const rows = (live ?? []) as RequestRow[]
  let n = 0
  for (const c of cards) {
    // 같은 자리를 여러 번 교체했으면 가장 최근 요청이 이 파일의 주인이다(applied 우선)
    const mineRows = rows.filter((x) => x.video_id === c.videoId)
    const r = mineRows.find((x) => x.phase === 'applied') ?? mineRows[0]
    if (!r) continue
    const count = async (event: string): Promise<number | null> => {
      const { count: k, error } = await db
        .from('funnel_events')
        .select('id', { count: 'exact', head: true })
        .eq('event', event)
        .eq('meta->>videoId', c.videoId)
      // 오류를 0 으로 삼키지 않는다 — 못 센 것은 null
      return error || k === null ? null : k
    }
    const started = await count('video_started')
    const completed = await count('video_completed')
    const enough = started !== null && started >= OUTCOME_MIN_STARTS
    const outcome = {
      purpose: r.purpose,
      started,
      completed,
      completionRate: enough && completed !== null ? Math.round((completed / started!) * 1000) / 1000 : null,
      verdict: enough ? 'measured' : 'unknown',
      note: enough ? null : `재생 ${started ?? '못 셈'}회 — ${OUTCOME_MIN_STARTS}회 미만은 비율을 내지 않는다`,
      cta: { verdict: 'unknown', note: '영상 CTA 클릭 계측이 아직 없다' },
    }
    await must(
      db.rpc('video_request_record_evaluation', {
        p_id: r.id,
        p_spec: { pass: c.pass, fail: c.fail, unknown: c.unknown, axes: c.axes },
        p_outcome: outcome,
      }),
      `${c.videoId} 평가 기록`,
    )
    n++
  }
  return n
}

/* ───────────────────────── 내리기 반영 ───────────────────────── */

const REPO = path.resolve(HERE, '../../../..')
const MANIFEST_PATH = path.join(REPO, 'apps/web/src/lib/video/manifest.json')
const OUT_DIR = path.resolve(HERE, '../../out')
const DIST_DIR = path.resolve(HERE, '../../dist-media')
const BUCKET = 'video'
const FORMAT_DIRS = ['wide', 'vertical', 'square'] as const

/** 한 편이 버킷·로컬에 남기는 파일 — publish.mts 가 올리는 경로 모양 그대로 */
export function filesOfVideo(id: string): string[] {
  return [
    ...FORMAT_DIRS.flatMap((f) => [`${f}/${id}.mp4`, `${f}/${id}.jpg`]),
    `${id}.vtt`,
    `${id}.txt`,
    `thumb/${id}.jpg`,
  ]
}

/**
 * **내린 편을 학습자 화면에서 뺀다** — manifest 에서 지운다. 기본은 예행.
 *
 * `--purge` 는 버킷 파일과 로컬 산출물(out · dist-media)까지 지우고 `purged_at` 을 남긴다.
 * **되돌릴 수 없다** — 되살리려면 다시 찍어야 한다. 로컬도 지우는 이유: publish 는 로컬 폴더를
 * 통째로 올리므로 로컬에 남아 있으면 다음 발행에 버킷으로 되돌아간다.
 */
export async function cmdRetireSync(commit: boolean, purge: boolean): Promise<number> {
  const db = requireServiceClient()
  const live = await refreshRetiredFile(db)
  const ids = new Set(live.map((r) => r.video_id))

  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) as { videos: { id: string }[] }
  const drop = manifest.videos.filter((v) => ids.has(v.id)).map((v) => v.id)
  console.log(`내린 편 ${ids.size} · manifest 에서 뺄 것 ${drop.length}` + (drop.length ? ` — ${drop.join(', ')}` : ''))
  const purgeTargets = purge ? live.filter((r) => r.purged_at === null) : []
  if (purge) console.log(`파일까지 지울 것 ${purgeTargets.length}편 (버킷 + 로컬) — 되돌릴 수 없다`)

  if (!commit) {
    console.log('\n(예행 — --commit 을 붙이면 쓴다)')
    return 0
  }

  if (drop.length > 0) {
    const next = { ...manifest, videos: manifest.videos.filter((v) => !ids.has(v.id)) }
    fs.writeFileSync(MANIFEST_PATH, JSON.stringify(next, null, 2) + '\n', 'utf8')
    console.log(`manifest → ${path.relative(process.cwd(), MANIFEST_PATH)} (커밋·배포해야 화면에서 사라진다)`)
  }

  for (const r of purgeTargets) {
    const keys = filesOfVideo(r.video_id)
    const { error } = await db.storage.from(BUCKET).remove(keys)
    if (error) {
      console.log(`✗ ${r.video_id} 버킷 삭제 실패: ${error.message} — purged 로 적지 않는다`)
      continue
    }
    for (const k of keys) {
      for (const base of [OUT_DIR, DIST_DIR]) {
        const abs = path.join(base, k)
        if (fs.existsSync(abs)) fs.rmSync(abs)
      }
    }
    await must(db.rpc('video_retire_mark_purged', { p_video_id: r.video_id }), `${r.video_id} purged 기록`)
    console.log(`🗑 ${r.video_id} — 버킷·로컬 파일 삭제`)
  }
  return 0
}
