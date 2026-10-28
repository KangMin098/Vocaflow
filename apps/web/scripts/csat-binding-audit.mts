// apps/web/scripts/csat-binding-audit.mts
// 기출 원문·근거·선지 결속 전수 검사(대량작업 G) — DB 읽기 전용. 아무 행도 쓰지 않는다.
//
//   pnpm --filter web exec tsx --tsconfig scripts/tsconfig.script.json scripts/csat-binding-audit.mts [--out <file.json>] [--fixtures <id,id,…>]
//
// 하는 일
//   1. 전 문항의 현재 원문 해시 · 현재 근거 단위 · published 분석 · 공식 PDF 좌표를 읽어 bindItem 으로 결속한다
//   2. 유형별 준비도와 차단 이유(G7) · 추출 결함(G8) 집계
//   3. 강의(lecture-data) · 판단 도구 픽스처(judgment/fixtures)가 현재 판본에 유효한지(G6)
//   --item <id> 는 한 문항의 결속 결과 전체를 출력한다(개발용 확인)
//   --fixtures 를 주면 그 문항들의 원자료를 binding/__tests__/fixtures/real-items.json 에 쓴다(테스트 입력 · 재실행 안전)
// node 가 Supabase TLS 에 못 붙으면 NODE_OPTIONS=--tls-max-v1.2
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { bindItem, type AnalysisRow, type ItemRow, type UnitsRow } from '../src/lib/csat/binding/adapter'
import { readinessByType, totals } from '../src/lib/csat/binding/readiness'
import { judgmentItemValidity, lectureValidity, type CurrentState } from '../src/lib/csat/binding/invalidate'
import { auditAnchorFile, type PdfAnchorFile } from '../src/lib/csat/binding/pdf'

const arg = (k: string) => {
  const i = process.argv.indexOf(k)
  return i > 0 ? process.argv[i + 1] : null
}
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !key) throw new Error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요하다(apps/web/.env.local)')
const db = createClient(url, key, { auth: { persistSession: false } })

const LIB = path.resolve('src/lib/csat')

const page = (table: string, cols: string, f: number) => db.from(table).select(cols).range(f, f + 999)
type Query = ReturnType<typeof page>
async function all<T>(table: string, cols: string, filter?: (q: Query) => Query): Promise<T[]> {
  const out: T[] = []
  for (let f = 0; ; f += 1000) {
    let q = page(table, cols, f)
    if (filter) q = filter(q)
    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...(data as T[]))
    if (!data || data.length < 1000) break
  }
  return out
}

const items = await all<ItemRow>('csat_items', 'id,exam_id,no,type_id,stem,passage,choices,answer,answers,body_ok', (q) => q.order('id'))
const analyses = await all<AnalysisRow & { item_id: string }>(
  'csat_item_analyses',
  'item_id,version,status,units_version,units_hash,design_intent,answer_locus,choice_analysis',
  (q) => q.eq('status', 'published').order('item_id').order('version'),
)
const anByItem = new Map<string, AnalysisRow[]>()
for (const a of analyses) anByItem.set(a.item_id, [...(anByItem.get(a.item_id) ?? []), a])

// 현재 단위 — DB 함수 한 곳에서 정한다
const unitsByItem = new Map<string, UnitsRow>()
const ids = items.map((i) => i.id)
for (let i = 0; i < ids.length; i += 200) {
  const { data, error } = await db.rpc('csat_current_units_many', { p_items: ids.slice(i, i + 200) })
  if (error) throw new Error(`csat_current_units_many: ${error.message}`)
  for (const r of data as (UnitsRow & { item_id: string })[]) unitsByItem.set(r.item_id, r)
}
// 현재 원문 해시 — 단위가 없는 문항도 필요하다(무효화 판정 기준)
const inputHash = new Map<string, string>()
for (const [id, u] of unitsByItem) inputHash.set(id, u.input_hash)
const missing = ids.filter((id) => !inputHash.has(id))
for (let i = 0; i < missing.length; i += 25) {
  await Promise.all(missing.slice(i, i + 25).map(async (id) => {
    const { data, error } = await db.rpc('csat_item_input_hash', { p_item: id })
    if (error) throw new Error(`csat_item_input_hash(${id}): ${error.message}`)
    inputHash.set(id, String(data))
  }))
}

// 공식 PDF 좌표
const anchorFiles = new Map<string, PdfAnchorFile>()
for (const f of fs.readdirSync(path.join(LIB, 'anchor-data'))) {
  if (f === 'index.json' || !f.endsWith('.json')) continue
  const d = JSON.parse(fs.readFileSync(path.join(LIB, 'anchor-data', f), 'utf8')) as PdfAnchorFile
  anchorFiles.set(d.exam_id, d)
}
const anchorFileProblems = [...anchorFiles.values()].flatMap((f) => auditAnchorFile(f).map((p) => ({ exam: f.exam_id, ...p })))

const bound = items.map((item) => bindItem({
  item,
  inputHash: inputHash.get(item.id)!,
  units: unitsByItem.get(item.id) ?? null,
  analyses: anByItem.get(item.id) ?? [],
  pdfAnchored: Boolean(anchorFiles.get(item.exam_id)?.items.some((x) => x.no === item.no)),
}))

const byType = readinessByType(bound)
const sum = totals(byType)

const defectCounts: Record<string, number> = {}
const defectExamples: Record<string, string[]> = {}
for (const b of bound) for (const d of b.defects) {
  defectCounts[d.code] = (defectCounts[d.code] ?? 0) + 1
  const ex = (defectExamples[d.code] ??= [])
  if (ex.length < 5 && !ex.includes(b.id)) ex.push(b.id)
}
const itemsWithDefects = bound.filter((b) => b.defects.length).length

const boundById = new Map(bound.map((b) => [b.id, b]))
const fastState = (id: string): CurrentState | null => {
  const b = boundById.get(id)
  return b ? { itemId: id, inputHash: b.basis.inputHash, passage: '', unitsVersion: b.basis.unitsVersion, unitsHash: b.basis.unitsHash, analysisVersion: b.analysisVersion } : null
}

// G6 — 강의
const lectureResult: Record<string, number> = { valid: 0, stale: 0, unverifiable: 0, orphan: 0 }
let anchorCues = 0
for (const f of fs.readdirSync(path.join(LIB, 'lecture-data'))) {
  const d = JSON.parse(fs.readFileSync(path.join(LIB, 'lecture-data', f), 'utf8'))
  type Lec = { item_id: string; binding?: { analysis_version: number; units_hash: string } | null; cues?: { target?: { kind?: string } }[] }
  for (const lec of Object.values(d.lectures ?? {}) as Lec[]) {
    anchorCues += (lec.cues ?? []).filter((c) => c.target?.kind === 'anchor').length
    const cur = fastState(lec.item_id)
    if (!cur) { lectureResult.orphan += 1; continue }
    lectureResult[lectureValidity(lec, cur).status] += 1
  }
}
// G6 — 판단 도구 픽스처
const judgment: { id: string; status: string; reasons?: string[] }[] = []
const fxDir = path.join(LIB, 'judgment/fixtures')
for (const f of fs.readdirSync(fxDir).filter((x) => x.endsWith('.items.json'))) {
  for (const it of JSON.parse(fs.readFileSync(path.join(fxDir, f), 'utf8')).items) {
    const cur = fastState(it.id)
    const v = cur ? judgmentItemValidity(it, cur) : { status: 'stale', reasons: ['item'] }
    judgment.push({ id: it.id, status: v.status, ...('reasons' in v ? { reasons: v.reasons } : {}) })
  }
}

const multi = bound.filter((b) => b.answer.multiple).map((b) => ({ id: b.id, answers: b.answer.answers, coverage: b.coverage }))
const publishedMulti = bound.filter((b) => b.publishedVersions.length > 1).length

const report = {
  generated_by: 'apps/web/scripts/csat-binding-audit.mts',
  items: items.length,
  exams: new Set(items.map((i) => i.exam_id)).size,
  current_units: unitsByItem.size,
  analysis_pick: Object.fromEntries(['bound', 'unbound', 'stale', 'none'].map((k) => [k, bound.filter((b) => b.analysisPick === k).length])),
  items_with_multiple_published_versions: publishedMulti,
  readiness: sum,
  by_type: byType,
  extraction: { items_with_defects: itemsWithDefects, counts: defectCounts, examples: defectExamples },
  multi_answer: multi,
  pdf: { exams_with_reference: anchorFiles.size, items_anchored: bound.filter((b) => !b.reasons.includes('no_pdf_anchor')).length, anchor_file_problems: anchorFileProblems.length, anchor_file_problem_examples: anchorFileProblems.slice(0, 10) },
  invalidation: { lectures: lectureResult, lecture_anchor_cues: anchorCues, judgment_fixtures: judgment },
}

const out = arg('--out')
if (out) fs.writeFileSync(out, JSON.stringify(report, null, 1))

const fx = arg('--fixtures')
if (fx) {
  const want = fx.split(',')
  const rows = want.map((id) => {
    const item = items.find((i) => i.id === id)
    if (!item) throw new Error(`문항 없음: ${id}`)
    return { item, inputHash: inputHash.get(id), units: unitsByItem.get(id) ?? null, analyses: anByItem.get(id) ?? [], pdfAnchored: Boolean(anchorFiles.get(item.exam_id)?.items.some((x) => x.no === item.no)) }
  })
  const file = path.resolve('src/lib/csat/binding/__tests__/fixtures/real-items.json')
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify({ exported_by: 'scripts/csat-binding-audit.mts --fixtures', note: 'DB 읽기 전용 export — 손으로 고치지 않는다', rows }, null, 1) + '\n')
  console.log(`fixtures ${rows.length} → ${path.relative(process.cwd(), file)}`)
}

// 개발용 확인 — 한 문항의 결속 결과 전체(근거 앵커 · 결함 · 차단 이유)
const one = arg('--item')
if (one) {
  const b = boundById.get(one)
  if (!b) throw new Error(`문항 없음: ${one}`)
  console.log(JSON.stringify(b, null, 1))
}

console.log(JSON.stringify({ items: report.items, exams: report.exams, current_units: report.current_units, analysis_pick: report.analysis_pick, multi_published: publishedMulti, readiness: { total: sum.total, ready: sum.ready, toolReady: sum.toolReady }, blocked: sum.blocked, warned: sum.warned, extraction: { items: itemsWithDefects, counts: defectCounts }, pdf: report.pdf.items_anchored, lectures: lectureResult, anchorCues, judgment: judgment.reduce((m: Record<string, number>, j) => ((m[j.status] = (m[j.status] ?? 0) + 1), m), {}) }, null, 1))
