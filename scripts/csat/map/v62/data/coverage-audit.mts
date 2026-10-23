// scripts/csat/map/v62/data/coverage-audit.mts
//
// 학습 지도 데이터 확대 — 시험 · 원천 · 분석 · TASK · 평가 도구 · 공급 커버리지 전수 감사(읽기 전용 · DB 에 쓰지 않는다).
// 원천 · 문항 · 분석 · 검수 · 출시를 서로 다른 상태로 센다. 과거 보고서 수치를 쓰지 않는다 — 매번 DB 와 저장소 파일을 직접 센다.
//   cd apps/web && node --tls-max-v1.2 --env-file=<메인 apps/web/.env.local> --import tsx ../../scripts/csat/map/v62/data/coverage-audit.mts
// 출력(생성물 — 손으로 고치지 않는다): docs/csat-learner/v62/data-expansion/coverage.json
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../../..')
const OUT = path.join(ROOT, 'docs/csat-learner/v62/data-expansion/coverage.json')
if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })

async function all<T>(table: string, select: string): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await db.from(table).select(select).range(from, from + 999)
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...(data as T[]))
    if ((data ?? []).length < 1000) return out
  }
}
/** 없는 테이블 · 권한 오류를 0 으로 삼키지 않는다 — null + 오류 문자열 */
async function countOf(table: string): Promise<{ n: number | null; error: string | null }> {
  const { count, error } = await db.from(table).select('*', { count: 'exact', head: true })
  if (error) return { n: null, error: error.message || error.code || 'error' }
  if (count === null) return { n: null, error: 'count=null' }
  return { n: count, error: null }
}
const sha = (s: string) => crypto.createHash('sha256').update(s).digest('hex')
const norm = (s: string | null) => String(s ?? '').replace(/\s+/g, ' ').trim().toLowerCase()

type Exam = { id: string; label: string; organizer: string | null; kind: string | null; grade: number | null; exam_year: number | null; month: number | null; item_count: number | null; has_answer_key: boolean | null; diagnosis_ready: boolean | null; official_grade1_ratio: number | null; official_stats_source: string | null }
type Item = { id: string; exam_id: string; no: number; type_id: string | null; in_scope: boolean | null; body_ok: boolean | null; answer: number | null; answers: number[] | null; points: number | null; passage: string | null; official_error_rate: number | null }
const exams = await all<Exam>('csat_exams', 'id, label, organizer, kind, grade, exam_year, month, item_count, has_answer_key, diagnosis_ready, official_grade1_ratio, official_stats_source')
const items = await all<Item>('csat_items', 'id, exam_id, no, type_id, in_scope, body_ok, answer, answers, points, passage, official_error_rate')
const analyses = await all<{ item_id: string; version: number; status: string }>('csat_item_analyses', 'item_id, version, status')
const attrs = await all<{ item_id: string; reviewed_at: string | null; source: string | null }>('csat_dx_item_attribute', 'item_id, reviewed_at, source')
const traps = await all<{ item_id: string }>('csat_dx_option_trap', 'item_id')
const units = await all<{ item_id: string }>('csat_item_units', 'item_id')
const keys = await all<{ exam_id: string }>('csat_dx_answer_key', 'exam_id')
const { data: heldRows, error: heldErr } = await db.rpc('csat_ec_embargoed_exams', { p_exams: exams.map((e) => e.id) })
const held = heldErr ? null : new Set(((heldRows ?? []) as unknown[]).map((r) => (typeof r === 'string' ? r : String(Object.values(r as Record<string, unknown>)[0]))))

const latest = new Map<string, { version: number; status: string }>()
for (const a of analyses) if (!latest.has(a.item_id) || latest.get(a.item_id)!.version < a.version) latest.set(a.item_id, a)
const setOf = (rows: { item_id: string }[]) => new Set(rows.map((r) => r.item_id))
const trapSet = setOf(traps), unitSet = setOf(units)
const attrReviewed = setOf(attrs.filter((a) => a.reviewed_at)), attrAny = setOf(attrs)
const keyCount = keys.reduce((m, k) => m.set(k.exam_id, (m.get(k.exam_id) ?? 0) + 1), new Map<string, number>())
const hasAnswer = (i: Item) => (i.answers?.length ?? 0) > 0 || i.answer !== null

// ── 시험군별 ─────────────────────────────────────────────
const groupKey = (e: Exam) => `${e.organizer ?? '?'}/${e.kind ?? '?'}/g${e.grade ?? '?'}`
const examById = new Map(exams.map((e) => [e.id, e]))
const groups: Record<string, Record<string, number | string | null>> = {}
for (const e of exams) {
  const g = (groups[groupKey(e)] ??= { exams: 0, years: '', with_answer_key_flag: 0, dx_answer_key_exams: 0, diagnosis_ready: 0, held: held ? 0 : null, official_stats: 0, items: 0, items_answer: 0, items_body_ok: 0, items_official_error_rate: 0, analysis_published: 0, analysis_in_review: 0, analysis_none: 0, attr_reviewed: 0, attr_unreviewed_only: 0, traps: 0, units: 0 })
  ;(g.exams as number)++
  if (e.has_answer_key) (g.with_answer_key_flag as number)++
  if (keyCount.get(e.id)) (g.dx_answer_key_exams as number)++
  if (e.diagnosis_ready) (g.diagnosis_ready as number)++
  if (held?.has(e.id)) (g.held as number)++
  if (e.official_stats_source) (g.official_stats as number)++
}
for (const [k, g] of Object.entries(groups)) {
  const ys = exams.filter((e) => groupKey(e) === k).map((e) => e.exam_year ?? 0)
  g.years = `${Math.min(...ys)}–${Math.max(...ys)}`
}
for (const i of items) {
  const e = examById.get(i.exam_id)
  if (!e) continue
  const g = groups[groupKey(e)]
  ;(g.items as number)++
  if (hasAnswer(i)) (g.items_answer as number)++
  if (i.body_ok) (g.items_body_ok as number)++
  if (i.official_error_rate !== null) (g.items_official_error_rate as number)++
  const a = latest.get(i.id)
  if (!a) (g.analysis_none as number)++
  else if (a.status === 'published') (g.analysis_published as number)++
  else (g.analysis_in_review as number)++
  if (attrReviewed.has(i.id)) (g.attr_reviewed as number)++
  else if (attrAny.has(i.id)) (g.attr_unreviewed_only as number)++
  if (trapSet.has(i.id)) (g.traps as number)++
  if (unitSet.has(i.id)) (g.units as number)++
}

// ── 무결성 ───────────────────────────────────────────────
const itemsByExam = items.reduce((m, i) => m.set(i.exam_id, [...(m.get(i.exam_id) ?? []), i]), new Map<string, Item[]>())
const integrity = {
  item_count_mismatch: exams.filter((e) => (itemsByExam.get(e.id)?.length ?? 0) > 0 && e.item_count !== null && e.item_count !== 45 && e.item_count !== 44)
    .map((e) => ({ exam: e.id, item_count: e.item_count, reading_items: itemsByExam.get(e.id)?.length ?? 0 })),
  exams_without_items: exams.filter((e) => !itemsByExam.has(e.id)).map((e) => e.id),
  answer_flag_without_items_answer: exams.filter((e) => e.has_answer_key && (itemsByExam.get(e.id) ?? []).some((i) => !hasAnswer(i))).map((e) => ({ exam: e.id, missing: (itemsByExam.get(e.id) ?? []).filter((i) => !hasAnswer(i)).length })),
  answer_out_of_range: items.filter((i) => [...(i.answers ?? []), ...(i.answer !== null ? [i.answer] : [])].some((n) => n < 1 || n > 5)).map((i) => i.id),
  duplicate_no: [...itemsByExam].flatMap(([ex, its]) => { const c = its.reduce((m, i) => m.set(i.no, (m.get(i.no) ?? 0) + 1), new Map<number, number>()); return [...c].filter(([, n]) => n > 1).map(([no]) => `${ex}#${no}`) }),
  /** 같은 지문(공백·대소문자 정규화 sha)이 서로 다른 시험에 — 세트 문항(41–42 · 43–45)의 같은 시험 공유는 제외 */
  cross_exam_duplicate_passages: (() => {
    const m = new Map<string, Set<string>>()
    for (const i of items) { const p = norm(i.passage); if (p.length < 200) continue; const h = sha(p); m.set(h, (m.get(h) ?? new Set()).add(`${i.exam_id}#${i.no}`)) }
    return [...m.values()].filter((s) => new Set([...s].map((x) => x.split('#')[0])).size > 1).map((s) => [...s].sort())
  })(),
  held_check: heldErr ? `실패(fail-closed): ${heldErr.message}` : 'ok',
}

// ── TASK · 평가 도구 · 공급 ───────────────────────────────
const codebook = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/csat-learner/v4/codebook.json'), 'utf8'))
const authoredDir = path.join(ROOT, 'apps/web/src/lib/knowledge/authored')
const authored = fs.readdirSync(authoredDir).filter((f) => f.endsWith('.json')).map((f) => {
  const raw = fs.readFileSync(path.join(authoredDir, f), 'utf8')
  const j = JSON.parse(raw)
  const its: { role?: string; intended_role?: string; role_class?: string }[] = j.items ?? []
  const roles = its.reduce((m, i) => { const r = String(i.intended_role ?? i.role ?? 'unknown'); m[r] = (m[r] ?? 0) + 1; return m }, {} as Record<string, number>)
  return { file: f, task: j.taskId ?? j.task_id ?? null, revision: j.set ?? j.revision ?? null, items: its.length, roles, sha256: sha(raw) }
})
const ledger = Object.fromEntries(await Promise.all(['authored_item', 'content_qualification', 'content_release_approval', 'content_release_revocation', 'workspace_content_delivery', 'workspace_delivery_attempt', 'learning_task_attempts', 'csat_map_goal_version', 'csat_session_attempts', 'csat_item_response_stats'].map(async (t) => [t, await countOf(t)])))
const tasks = codebook.tasks.map((t: Record<string, unknown>) => ({
  id: t.id, display: t.display, kind: t.kind, status: t.status, direct_check: t.direct_check,
  authored_sets: authored.filter((a) => a.task === t.id).map((a) => a.file),
  authored_items: authored.filter((a) => a.task === t.id).reduce((s, a) => s + a.items, 0),
}))

const out = {
  generated_by: 'scripts/csat/map/v62/data/coverage-audit.mts',
  generated_at: new Date().toISOString(),
  note: '읽기 전용 실측. 원천 · 문항 · 분석 · 검수 · 출시는 다른 상태다. 분석 published 는 v3 드레인 AI 분석의 공개 상태이며 사람 검수 · Gold 가 아니다.',
  totals: { exams: exams.length, items: items.length, analysis_latest: latest.size, attr_reviewed_items: attrReviewed.size, trap_items: trapSet.size, unit_items: unitSet.size },
  groups, integrity,
  tasks: { non_held: tasks.filter((t: { status: string }) => t.status !== 'hold').length, held: tasks.filter((t: { status: string }) => t.status === 'hold').length, rows: tasks },
  authored: { files: authored.length, items: authored.reduce((s, a) => s + a.items, 0), rows: authored },
  supply_ledger: ledger,
}
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify(out, null, 1) + '\n')
console.log(JSON.stringify({ totals: out.totals, groups, integrity: { ...integrity, cross_exam_duplicate_passages: integrity.cross_exam_duplicate_passages.length }, authored: { files: authored.length, items: out.authored.items }, ledger }, null, 1))
