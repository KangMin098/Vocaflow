// scripts/csat/units-build.mjs
//
// **근거 단위 목록을 DB(csat_item_units)에 만든다** — 분석 export·검수 CLI·validator 가 읽는 정본.
// 목록은 **DB 의 원문**(csat_items.passage)에서 lib-evidence-units.mjs 로 만들고, 원문 해시는 DB 함수
// (csat_item_input_hash)가 계산한 값을 쓴다 — 파일 코퍼스와 DB 원문이 어긋나도 목록은 DB 원문에 맞는다.
//
// 실행:
//   node --tls-max-v1.2 scripts/csat/units-build.mjs --set hakpyeong            (미리보기)
//   node --tls-max-v1.2 scripts/csat/units-build.mjs --set hakpyeong --commit
//
// 재실행 안전: (문항, 버전, 원문 해시) 행이 이미 있으면 건너뛴다. 같은 키에 다른 목록이 있으면
// (= 같은 버전인데 규칙이 바뀌었다 → UNITS_VERSION 을 안 올렸다) **멈춘다** — 조용히 덮지 않는다.
// 원문이 없는 문항(듣기 등)은 목록을 만들지 않고 수를 출력한다.

import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { SET } from './lib-drain-set.mjs'
import { buildUnits, unitsHash, UNITS_VERSION } from './lib-evidence-units.mjs'

const COMMIT = process.argv.includes('--commit')

function env(name) {
  if (process.env[name]) return process.env[name]
  for (const f of ['.env.local', '.env', 'apps/web/.env.local', 'apps/web/.env']) {
    if (!fs.existsSync(f)) continue
    const m = fs.readFileSync(f, 'utf8').match(new RegExp(`^${name}\\s*=\\s*(.+)$`, 'm'))
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  }
  return null
}
const SUPA_URL = env('NEXT_PUBLIC_SUPABASE_URL') ?? env('SUPABASE_URL')
const KEY = env('SUPABASE_SERVICE_ROLE_KEY') ?? env('SUPABASE_SERVICE_KEY')
if (!SUPA_URL || !KEY) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 를 못 찾았다')
const db = createClient(SUPA_URL, KEY, { auth: { persistSession: false } })

if (SET !== 'hakpyeong') {
  // 평가원 학습자 화면은 sentence_index 가 아니라 인용으로 위치를 찾는다(passage-skeleton.ts) — 지금은 학평 드레인만 쓴다
  console.log('  지금은 --set hakpyeong 만 지원한다(평가원은 인용 기반 UI 라 목록을 쓰지 않는다)')
  process.exit(1)
}

// 학평 문항 — 집합은 DB 의 organizer 로 가른다
const items = []
for (let f = 0; ; f += 1000) {
  const { data, error } = await db.from('csat_items')
    .select('id, type_id, passage, csat_exams!inner(organizer)').eq('csat_exams.organizer', 'edu_office')
    .order('id').range(f, f + 999)
  if (error) throw new Error(error.message)
  items.push(...data)
  if (data.length < 1000) break
}

const have = new Map()
for (let f = 0; ; f += 1000) {
  const { data, error } = await db.from('csat_item_units').select('item_id, units_version, input_hash, units_hash')
    .eq('units_version', UNITS_VERSION).range(f, f + 999)
  if (error) throw new Error(error.message)
  for (const r of data) have.set(`${r.item_id}|${r.input_hash}`, r.units_hash)
  if (data.length < 1000) break
}

let noPassage = 0, same = 0, conflict = 0, toWrite = []
const hashOf = async (id) => {
  const { data, error } = await db.rpc('csat_item_input_hash', { p_item: id })
  if (error) throw new Error(`${id}: ${error.message}`)
  return data
}
const queue = items.filter((it) => {
  if (!it.passage?.trim()) { noPassage += 1; return false }
  return true
})
for (let i = 0; i < queue.length; i += 16) {
  await Promise.all(queue.slice(i, i + 16).map(async (it) => {
    const built = buildUnits(it.passage, { typeId: it.type_id }) // 자기 검사 실패는 throw — 멈춘다
    const h = unitsHash(built)
    const ih = await hashOf(it.id)
    const prev = have.get(`${it.id}|${ih}`)
    if (prev === h) { same += 1; return }
    if (prev) { conflict += 1; console.log(`  ✗ ${it.id}: 같은 버전(v${UNITS_VERSION})인데 목록이 다르다 — UNITS_VERSION 을 올려야 한다`); return }
    toWrite.push({ item_id: it.id, units_version: UNITS_VERSION, input_hash: ih, units: built.units, units_hash: h })
  }))
  process.stdout.write(`\r  계산 ${Math.min(i + 16, queue.length)}/${queue.length}`)
}
process.stdout.write('\n')
console.log(`  학평 문항 ${items.length} · 원문 없음 ${noPassage} · 이미 있음 ${same} · 새로 ${toWrite.length} · 충돌 ${conflict} (v${UNITS_VERSION})`)
if (conflict) process.exit(1)
if (!COMMIT) { console.log('  미리보기 — 쓰려면 --commit'); process.exit(0) }

let n = 0
for (let i = 0; i < toWrite.length; i += 200) {
  const { error } = await db.from('csat_item_units').insert(toWrite.slice(i, i + 200))
  if (error) throw new Error(error.message)
  n += Math.min(200, toWrite.length - i)
  process.stdout.write(`\r  기록 ${n}/${toWrite.length}`)
}
process.stdout.write('\n')
