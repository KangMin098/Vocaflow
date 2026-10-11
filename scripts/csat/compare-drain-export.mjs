// scripts/csat/compare-drain-export.mjs
//
// **같은 원리 비교 쌍 — 후보를 뽑는다**(지시문 §9 · M4, 2026-10-11). 3단: 이 export → 에이전트 검수(.out.json) → compare-drain-import.
//
// 후보 규칙(자동 · 최종 타당성은 배치 검수가 정한다):
//   같은 유형(평가원) · 서로 다른 회차 · 오답 하나씩이 **같은 함정 라벨**(닫힌 라벨표 — understanding-check 와 같은 표)을 가진 쌍.
//   부정형 선택≠참거짓 유형(오답이 맞는 진술)은 함정이 없으니 뽑지 않는다. 문항마다 후보 최대 2개(최근 회차 우선).
// 청크에는 **지문 · 선지 원문을 싣지 않는다** — 검수자는 두 오답의 분석(함정 · 끌리는 이유 · 지우는 근거)만으로
// 「같은 방식으로 바뀌었나」를 판정한다. 그래서 청크를 커밋해도 원문이 저장소에 들어가지 않는다.
//
// 재실행 안전: 같은 DB 면 같은 후보(결정적 정렬). 이미 검수된 쌍(.out.json 에 있는 pair_id)은 건너뛴다.
//
//   npx tsx scripts/csat/compare-drain-export.mjs [--size 25]

import fs from 'node:fs'
import path from 'node:path'
import { isKiceExam } from './lib-exam-id.mjs'

for (const f of ['apps/web/.env.local', '.env.local']) {
  try {
    for (const line of fs.readFileSync(path.resolve(f), 'utf8').split('\n')) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
    }
  } catch {
    /* 없으면 다음 후보 */
  }
}

const sizeArg = process.argv.indexOf('--size')
const SIZE = sizeArg >= 0 ? Number(process.argv[sizeArg + 1]) : 25
const WORK = path.resolve('scripts/csat/compare-drain')
fs.mkdirSync(WORK, { recursive: true })

const { createClient } = await import('@supabase/supabase-js')
const { PROPOSITION_TRAPS, POSITION_TRAPS } = await import('../../apps/web/src/lib/csat/understanding-check.ts')
const { distractorsAreTrue } = await import('../../apps/web/src/lib/csat/teaching-contract.ts')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// keyset(id) 페이징 — 뒤 페이지가 앞을 다시 훑는 OFFSET 을 쓰지 않는다(offset-paging-budget)
async function page(table, sel, tune = (q) => q) {
  const out = []
  for (let last = null; ; ) {
    let q = tune(db.from(table).select(`id, ${sel}`)).order('id').limit(1000)
    if (last !== null) q = q.gt('id', last)
    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    out.push(...data)
    if (data.length < 1000) break
    last = data[data.length - 1].id
  }
  return out
}

const items = (await page('csat_items', 'exam_id, type_id, in_scope')).filter((r) => isKiceExam(r.exam_id) && r.in_scope)
const rows = await page('csat_item_analyses', 'item_id, version, choice_analysis', (q) => q.eq('status', 'published'))
const latest = new Map()
for (const r of rows) if ((latest.get(r.item_id)?.version ?? -1) < r.version) latest.set(r.item_id, r)

const POSITION = new Set(['R-INSERT', 'R-ORDER', 'R-IRRELEVANT', 'X-ORDER'])
/** 문항 → [{n, trap, why_tempting, how_to_reject}] (라벨표 안 라벨만) */
const lures = new Map()
for (const it of items) {
  const a = latest.get(it.id)
  if (!a || distractorsAreTrue(it.type_id, it.id)) continue
  const table = POSITION.has(it.type_id) ? POSITION_TRAPS : PROPOSITION_TRAPS
  const ds = (a.choice_analysis ?? [])
    .filter((c) => c.verdict === 'distractor' && typeof c.trap === 'string' && table.includes(c.trap.trim()))
    .map((c) => ({ n: c.n, trap: c.trap.trim(), why_tempting: c.why_tempting ?? '', how_to_reject: c.how_to_reject ?? '' }))
  if (ds.length) lures.set(it.id, { type: it.type_id, exam: it.exam_id, ds })
}

const done = new Set()
for (const f of fs.readdirSync(WORK).filter((f) => f.endsWith('.out.json'))) {
  for (const v of JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8')).verdicts ?? []) done.add(v.pair_id)
}

// 최근 회차 먼저 — 학습자가 가장 많이 여는 문항부터 덮는다
const order = (id) => id.split('#')[0].replace(/^M/, '').padStart(4, '0')
const ids = [...lures.keys()].sort((x, y) => order(y).localeCompare(order(x)) || x.localeCompare(y))
const pairs = []
const seen = new Set()
for (const id of ids) {
  const me = lures.get(id)
  let picked = 0
  for (const other of ids) {
    if (picked >= 2) break
    if (other === id) continue
    const you = lures.get(other)
    if (you.type !== me.type || you.exam === me.exam) continue
    for (const d of me.ds) {
      const e = you.ds.find((x) => x.trap === d.trap)
      if (!e) continue
      const pair_id = [`${id}:${d.n}`, `${other}:${e.n}`].sort().join('|')
      if (seen.has(pair_id)) break
      seen.add(pair_id)
      picked += 1
      if (!done.has(pair_id)) pairs.push({ pair_id, type: me.type, trap: d.trap, a: { id, ...d }, b: { id: other, ...e } })
      break
    }
  }
}

const stamp = 'cmp-20261011'
let k = 0
for (let i = 0; i < pairs.length; i += SIZE) {
  k += 1
  const name = `${stamp}-${String(k).padStart(2, '0')}`
  fs.writeFileSync(path.join(WORK, `chunk-${name}.json`), JSON.stringify({ chunk: name, pairs: pairs.slice(i, i + SIZE) }, null, 1) + '\n')
}
console.log(`함정 라벨 있는 문항 ${lures.size} · 후보 쌍 ${seen.size} · 이미 검수 ${done.size} · 새로 뽑음 ${pairs.length} → 청크 ${k}개(${WORK})`)
