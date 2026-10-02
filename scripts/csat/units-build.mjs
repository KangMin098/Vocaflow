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
// **경계가 지금 목록과 같으면 새 버전 행을 쓰지 않는다**(v2, 2026-10-01) — 목록 해시에 버전이 들어가므로 버전만 올린 행을 쓰면
// 발행 분석이 전부 자동 보류된다(csat_hold_on_units_change). 규칙이 실제로 바꾼 문항만 새 버전 행을 얻는다.
// 재실행 안전: (문항, 버전, 원문 해시) 행이 이미 있으면 건너뛴다. 같은 키에 다른 목록이 있으면
// (= 같은 버전인데 규칙이 바뀌었다 → UNITS_VERSION 을 안 올렸다) **멈춘다** — 조용히 덮지 않는다.
// 원문이 없는 문항(듣기 등)은 목록을 만들지 않고 수를 출력한다.
//
// ⚠️ 원문과 원문 해시는 **같은 문장**에서 받는다(DB 함수 csat_units_build_input). 예전에는 원문을 먼저 전량 읽고
//    해시를 문항별로 나중에 물어, 그 사이 원문이 바뀌면 옛 원문으로 만든 목록에 새 원문 해시를 붙일 수 있었다
//    (PR #126 리뷰 P1-4). 적재 때는 DB 트리거(csat_item_units_guard)가 지금 원문 해시와 한 번 더 대조한다 —
//    그 사이 바뀐 문항은 건너뛰고 수를 출력한다(다시 돌리면 새 원문으로 만든다).

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

// 학평 문항 — 원문·원문 해시를 한 문장에서
const items = []
for (let f = 0; ; f += 1000) {
  const { data, error } = await db.rpc('csat_units_build_input').range(f, f + 999)
  if (error) throw new Error(error.message)
  items.push(...data)
  if (data.length < 1000) break
}

const have = new Map()
const current = new Map() // (문항|원문 해시) → 가장 높은 버전 행의 경계 서명 — 버전 무관
const sig = (units) => units.map((u) => `${u.start}-${u.end}`).join(',')
for (let f = 0; ; f += 1000) {
  const { data, error } = await db.from('csat_item_units').select('item_id, units_version, input_hash, units_hash, units')
    .order('item_id').order('units_version').order('input_hash').range(f, f + 999)
  if (error) throw new Error(error.message)
  for (const r of data) {
    const key = `${r.item_id}|${r.input_hash}`
    if (r.units_version === UNITS_VERSION) have.set(key, r.units_hash)
    const c = current.get(key)
    if (!c || r.units_version > c.v) current.set(key, { v: r.units_version, sig: sig(r.units) })
  }
  if (data.length < 1000) break
}

let noPassage = 0, same = 0, conflict = 0, unchanged = 0
const toWrite = []
for (const it of items) {
  if (!it.passage?.trim()) { noPassage += 1; continue }
  const built = buildUnits(it.passage, { typeId: it.type_id }) // 자기 검사 실패는 throw — 멈춘다
  const h = unitsHash(built)
  const prev = have.get(`${it.id}|${it.input_hash}`)
  if (prev === h) { same += 1; continue }
  const cur = current.get(`${it.id}|${it.input_hash}`)
  if (!prev && cur && cur.v < UNITS_VERSION && cur.sig === sig(built.units)) { unchanged += 1; continue } // 규칙이 이 문항을 안 바꿨다
  if (prev) { conflict += 1; console.log(`  ✗ ${it.id}: 같은 버전(v${UNITS_VERSION})인데 목록이 다르다 — UNITS_VERSION 을 올려야 한다`); continue }
  toWrite.push({ item_id: it.id, units_version: UNITS_VERSION, input_hash: it.input_hash, units: built.units, units_hash: h })
  if (cur) console.log(`  ↻ ${it.id}: v${cur.v} → v${UNITS_VERSION} 경계 변경`)
}
console.log(`  학평 문항 ${items.length} · 원문 없음 ${noPassage} · 이미 있음 ${same} · 경계 불변(옛 버전 유지) ${unchanged} · 새로 ${toWrite.length} · 충돌 ${conflict} (v${UNITS_VERSION})`)
if (conflict) process.exit(1)
if (!COMMIT) { console.log('  미리보기 — 쓰려면 --commit'); process.exit(0) }

let n = 0, stale = 0
for (let i = 0; i < toWrite.length; i += 200) {
  const part = toWrite.slice(i, i + 200)
  const { error } = await db.from('csat_item_units').insert(part)
  if (!error) { n += part.length; process.stdout.write(`\r  기록 ${n}/${toWrite.length}`); continue }
  // 한 행이라도 원문이 바뀌었으면 묶음 전체가 거부된다 — 한 행씩 다시 넣어 바뀐 것만 건너뛴다
  for (const row of part) {
    const { error: e1 } = await db.from('csat_item_units').insert(row)
    if (!e1) { n += 1; continue }
    if (/원문이 목록을 만든 뒤 바뀌었다/.test(e1.message)) { stale += 1; console.log(`\n  ⚠ ${row.item_id}: 읽은 뒤 원문이 바뀌었다 — 건너뜀`); continue }
    throw new Error(`${row.item_id}: ${e1.message}`)
  }
  process.stdout.write(`\r  기록 ${n}/${toWrite.length}`)
}
process.stdout.write('\n')
if (stale) console.log(`  원문 변경으로 건너뜀 ${stale} — 다시 돌리면 새 원문으로 만든다`)
