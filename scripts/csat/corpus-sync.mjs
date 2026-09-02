// scripts/csat/corpus-sync.mjs
//
// **기출 원장(corpus.json)을 DB 로 올린다 — 유형 · 회차 · 문항.**
//
// 분석(csat_item_analyses)은 여기서 건드리지 않는다. 이 스크립트는 **원본 자료**만 다루고,
// 분석은 `analysis-drain-import.mjs` 가 따로 올린다. 둘을 섞으면 코퍼스를 다시 만들 때마다
// 분석이 날아갈 위험이 생긴다.
//
// upsert 다 — 몇 번을 돌려도 결과가 같다. **삭제는 하지 않는다**: 코퍼스에서 사라진 문항이
// 있어도 DB 에서 지우지 않는다. 지우면 그 문항에 달린 분석이 CASCADE 로 함께 사라진다.
// 사라진 문항은 화면에 보고만 하고, 지우는 것은 사람이 결정한다.
//
// 실행:
//   node scripts/csat/corpus-sync.mjs            (미리보기 — 쓰지 않는다)
//   node scripts/csat/corpus-sync.mjs --commit

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const COMMIT = process.argv.includes('--commit')
const DIR = path.resolve('scripts/csat/data')

function env(name) {
  if (process.env[name]) return process.env[name]
  for (const f of ['.env.local', '.env', 'apps/web/.env.local', 'apps/web/.env']) {
    if (!fs.existsSync(f)) continue
    const m = fs.readFileSync(f, 'utf8').match(new RegExp(`^${name}\\s*=\\s*(.+)$`, 'm'))
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  }
  return null
}

const URL = env('NEXT_PUBLIC_SUPABASE_URL') ?? env('SUPABASE_URL')
const KEY = env('SUPABASE_SERVICE_ROLE_KEY') ?? env('SUPABASE_SERVICE_KEY')
if (!URL || !KEY) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 를 못 찾았다 (.env.local 확인)')
const db = createClient(URL, KEY, { auth: { persistSession: false } })

const corpus = JSON.parse(fs.readFileSync(path.join(DIR, 'corpus.json'), 'utf8'))
const typeTable = JSON.parse(fs.readFileSync(path.join(DIR, 'classified.json'), 'utf8')).types

// ── 유형 ──────────────────────────────────────────────────────────────
// 사정권(in_scope)은 **듣기가 아닌 것**이다. 유형표의 sec 로 정한다 — 번호가 아니라 유형이
// 판정 근거여야 2014 회차(듣기 22번까지)에서도 어긋나지 않는다.
const usedTypes = new Set(corpus.items.map((i) => i.type_id).filter(Boolean))
const recentTypes = new Set(corpus.items.filter((i) => i.year >= 2023 && i.type_id).map((i) => i.type_id))
const types = typeTable
  .filter((t) => usedTypes.has(t.id))
  .map((t) => ({
    id: t.id,
    name: t.name,
    section: t.sec,
    in_scope: t.sec !== '듣기',
    status: recentTypes.has(t.id) ? 'active' : 'retired',
    match_pattern: t.match,
  }))

// ── 회차 ──────────────────────────────────────────────────────────────
const examMap = new Map()
for (const it of corpus.items) {
  const e = examMap.get(it.exam) ?? {
    id: it.exam,
    label: it.exam_label,
    kind: it.exam_kind,
    year: it.year,
    month: it.month,
    form: it.exam.length > 4 && !it.exam.startsWith('M') ? it.exam.slice(4) : null,
    listening_end: it.exam.startsWith('2014') ? 22 : 17,
    item_count: 0,
    has_answer_key: false,
    source_note: null,
  }
  e.item_count += 1
  if (it.answer != null) e.has_answer_key = true
  examMap.set(it.exam, e)
}
// 정답표가 없는 회차는 그 사실을 회차 행에 적어 둔다 — 화면이 "왜 비었나" 를 설명할 수 있어야 한다
for (const e of examMap.values()) {
  if (!e.has_answer_key) e.source_note = '평가원 정답표 PDF 가 실제로는 듣기 대본 — 정답·배점 미상'
}
const exams = [...examMap.values()]

// ── 문항 ──────────────────────────────────────────────────────────────
const items = corpus.items.map((it) => ({
  id: it.id,
  exam_id: it.exam,
  no: it.no,
  section: it.section,
  in_scope: it.in_scope,
  type_id: it.type_id,
  stem: it.stem,
  passage: it.passage,
  choices: it.choices,
  answer: it.answer,
  answers: it.answers,
  points: it.points,
  high_score: it.high_score,
  body_ok: Boolean(it.passage && it.choices) && !it.body_suspect,
  raw_block: null,
}))

console.log(`  유형 ${types.length} · 회차 ${exams.length} · 문항 ${items.length}`)
console.log(`  사정권 문항 ${items.filter((i) => i.in_scope).length} · 정답 보유 ${items.filter((i) => i.answer != null).length}`)
console.log(`  현행 유형 ${types.filter((t) => t.status === 'active').length} · 폐지 ${types.filter((t) => t.status === 'retired').length}`)

if (!COMMIT) {
  console.log('\n  미리보기다 — 아무것도 쓰지 않았다. 올리려면 --commit')
  process.exit(0)
}

async function upsert(table, rows, chunk = 500) {
  for (let i = 0; i < rows.length; i += chunk) {
    const { error } = await db.from(table).upsert(rows.slice(i, i + chunk), { onConflict: 'id' })
    if (error) throw new Error(`${table}: ${error.message}`)
    process.stdout.write(`\r  ${table} ${Math.min(i + chunk, rows.length)}/${rows.length}`)
  }
  process.stdout.write('\n')
}

await upsert('csat_types', types)
await upsert('csat_exams', exams)
await upsert('csat_items', items)

// 코퍼스에 없는데 DB 에 남아 있는 문항 — **지우지 않고 보고만 한다**
const { data: dbIds, error } = await db.from('csat_items').select('id')
if (error) throw new Error(error.message)
const have = new Set(items.map((i) => i.id))
const orphan = (dbIds ?? []).map((r) => r.id).filter((id) => !have.has(id))
if (orphan.length) {
  console.log(`  ⚠ 코퍼스에 없는 DB 문항 ${orphan.length}개 — 지우지 않았다(분석이 CASCADE 로 사라진다): ${orphan.slice(0, 5).join(' ')}`)
}
console.log('→ csat_types · csat_exams · csat_items 적재 완료')
