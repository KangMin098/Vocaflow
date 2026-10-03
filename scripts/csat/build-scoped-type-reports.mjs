// scripts/csat/build-scoped-type-reports.mjs
// P4: publish grade-separated summaries without touching (kice, 0).
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { scopedTypeReports } from './lib-scoped-type-reports.mjs'

function env(name) {
  if (process.env[name]) return process.env[name]
  for (const f of ['.env.local', '.env', 'apps/web/.env.local', 'apps/web/.env']) {
    if (!fs.existsSync(f)) continue
    const m = fs.readFileSync(f, 'utf8').match(new RegExp(`^${name}\\s*=\\s*(.+)$`, 'm'))
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  }
  return null
}
const db = createClient(env('NEXT_PUBLIC_SUPABASE_URL') ?? env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY') ?? env('SUPABASE_SERVICE_KEY'), { auth: { persistSession: false } })
async function all(makeQuery) {
  const rows = []
  for (let start = 0; ; start += 1000) {
    const { data, error } = await makeQuery().range(start, start + 999)
    if (error) throw new Error(error.message)
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}
const [items, analyses, knownScopes] = await Promise.all([
  all(() => db.from('csat_items').select('id,type_id,in_scope').like('id', 'H%').eq('in_scope', true).order('id')),
  all(() => db.from('csat_item_analyses').select('item_id,version,status,answer_unknown,answer_locus,choice_analysis,time_budget_sec').like('item_id', 'H%').order('item_id').order('version')),
  all(() => db.from('csat_type_reports').select('type_id,grade').eq('organizer', 'edu_office').order('grade').order('type_id')),
])
const reports = scopedTypeReports(items, analyses, new Date().toISOString(), knownScopes)
console.log(`유형 미지정 보류 ${items.filter((i) => !i.type_id).length}문항(유형 집계에서 제외)`)
const file = path.resolve('scripts/csat/analysis-drain-hakpyeong/_type-reports-scoped.json')
fs.mkdirSync(path.dirname(file), { recursive: true })
fs.writeFileSync(file, JSON.stringify(reports, null, 1) + '\n')
for (const grade of [1, 2, 3]) {
  const rows = reports.filter((r) => r.grade === grade)
  console.log(`고${grade}: 발행 유형 ${rows.filter((r) => r.status === 'published').length} · 보류 유형 ${rows.filter((r) => r.status !== 'published').length} · 발행 분석 ${rows.reduce((sum, r) => sum + r.n_analyzed, 0)}`)
}
if (!process.argv.includes('--commit')) {
  console.log('미리보기 — DB 쓰기 없음. 결과는 학평 작업 폴더에 저장했다. --commit으로 적재한다.')
} else {
  const { data: before, error: be } = await db.from('csat_type_reports').select('*').eq('organizer', 'kice').order('type_id')
  if (be) throw new Error(be.message)
  const { error } = await db.from('csat_type_reports').upsert(reports, { onConflict: 'type_id,organizer,grade' })
  if (error) throw new Error(error.message)
  const { data: after, error: ae } = await db.from('csat_type_reports').select('*').eq('organizer', 'kice').order('type_id')
  if (ae) throw new Error(ae.message)
  const { isDeepStrictEqual } = await import('node:util')
  if (!isDeepStrictEqual(before, after)) throw new Error('평가원 유형 리포트가 실행 중 바뀌었다 — 비교·원인 확인 필요')
  console.log(`학평 유형 리포트 ${reports.length}행 적재 · 평가원 ${before.length}행 불변`)
}
