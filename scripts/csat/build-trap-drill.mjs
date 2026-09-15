// scripts/csat/build-trap-drill.mjs
//
// **오답 감별 훈련의 문제 풀을 구워 낸다.**
//
// ── 왜 빌드 시점인가 ──────────────────────────────────────────────────
// 처음에는 요청마다 DB 에서 골랐다 — `csat_item_analyses` 3,069행의 `choice_analysis`(jsonb)를
// RLS 클라이언트로 **전량** 페이지네이션하는 경로였다. 학습자 화면 한 장을 그리려고 표 하나를
// 통째로 읽는 설계이고, `trap-atlas` 머리말이 이미 같은 이유로 굽기를 택했다:
// "매 방문마다 집계하면 느려지고, 학습자 경로는 RLS 라 왕복이 여러 번 든다."
//
// ⚠️ **한 가지는 분명히 해 둔다.** 그 경로를 처음 열었을 때 화면이 3분을 기다려도 안 떴는데,
//    **같은 시각 이 프로젝트가 Cloudflare 522 를 내고 있었다**(2026-09-15). 그러니 그 3분은
//    이 설계의 증거가 아니다 — 원인을 못 가린 관측이다. 굽기를 택한 근거는 어디까지나
//    「학습자 화면이 표를 통째로 읽는다」 쪽이지 그 3분이 아니다.
//
// 구워 두면: 조회 왕복 **0** · 지문 원문이 런타임 경로에 없다는 것이 **구조로** 보장된다
// (`skeleton.ts` 와 같은 이유) · 사람이 산출물을 열어 볼 수 있다.
//
// ── 나가는 것 ─────────────────────────────────────────────────────────
// 문항 표시(회차·번호·유형)와 **우리가 쓴 오답 해설** 두 줄뿐이다. 평가원 지문·선지 원문은
// 한 글자도 안 들어간다 — 그래서 이 훈련은 저작권 경계를 건드리지 않는다.
//
// ── 고르는 규칙 ───────────────────────────────────────────────────────
//   · 범용 함정 9종만 (유형에 매인 것까지 넣으면 외울 것이 다시 32가지가 된다)
//   · 해설이 너무 짧은 것 제외 (찍기가 된다)
//   · 해설이 **정답 이름을 품은 것** 제외 (읽기 검사가 된다 — 실측 3건)
//   · 함정마다 최대 `PER_TRAP` — 파일이 커지는 것을 막고, 흔한 함정이 풀을 먹지 않게
//
// 재실행 안전하다. 정렬이 전부 결정론적이라 같은 DB 에 대해 같은 파일이 나온다.
//
//   node scripts/csat/build-trap-drill.mjs            # 예행
//   node scripts/csat/build-trap-drill.mjs --write
//   node scripts/csat/build-trap-drill.mjs --check    # 낡았으면 exit 1
//
// ⚠️ 이 머신에서 node 가 Supabase 에 못 붙고 Cloudflare 5xx HTML 을 토해 내면
//    **`node --tls-max-v1.2`** 로 붙는다(실측 2026-09-15 · 같은 시각 `curl` 은 붙었다).
//    그래도 "Could not query the database for the schema cache" 가 나오면 그건 우리 쪽이
//    아니라 프로젝트가 회복 중인 것이다 — 조금 뒤에 다시 돌린다.

import fs from 'node:fs'
import path from 'node:path'

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

const WRITE = process.argv.includes('--write')
const CHECK = process.argv.includes('--check')
const OUT = path.resolve('apps/web/src/lib/csat/drill-data/pool.json')

/** 함정마다 굽는 최대 문제 수. 9종 × 이 값이 풀의 상한이다. */
const PER_TRAP = 120
const MIN_TEMPTING = 20
const MIN_REJECT = 40

const { createClient } = await import('@supabase/supabase-js')
const atlas = JSON.parse(fs.readFileSync(path.resolve('apps/web/src/lib/csat/trap-atlas.json'), 'utf8'))
// 「범용」의 경계는 `trap-atlas.ts` 의 `UNIVERSAL_MIN_TYPES` 와 같아야 한다. 거기서 import 하면
// 그 파일이 JSON 을 **정적 import** 하는 바람에 맨 node 에서 죽는다
// (`ERR_IMPORT_ATTRIBUTE_MISSING` — 번들러가 없으면 `with { type: 'json' }` 이 필요하다 · 실측).
// 그래서 값을 여기 다시 적는다. 두 값이 어긋나면 회귀가 잡는다(`trap-drill-pool.test.ts`).
const UNIVERSAL_MIN_TYPES = 10
const UNIVERSAL = atlas.traps.filter((t) => t.types >= UNIVERSAL_MIN_TYPES)
const { buildOptions, leaksAnswer } = await import('../../apps/web/src/lib/csat/trap-drill.ts')
const { toItemSlug } = await import('../../apps/web/src/lib/csat/item-slug.ts')

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ⚠️ 페이징한다 — PostgREST 는 1,000행에서 조용히 끊는다.
const PAGE = 1000
async function page(table, sel, tune = (q) => q) {
  const out = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await tune(db.from(table).select(sel)).range(from, from + PAGE - 1)
    if (error) {
      console.error(`${table} 조회 실패:`, error.message)
      process.exit(1)
    }
    out.push(...data)
    if (data.length < PAGE) break
  }
  return out
}

console.log('· 읽는 중…')
const [items, exams, types, analyses] = await Promise.all([
  page('csat_items', 'id, exam_id, no, type_id', (q) => q.eq('in_scope', true)),
  page('csat_exams', 'id, label'),
  page('csat_types', 'id, name'),
  page('csat_item_analyses', 'item_id, version, choice_analysis', (q) => q.eq('status', 'published')),
])
console.log(`  문항 ${items.length} · 분석행 ${analyses.length}`)

// 문항마다 최신 버전 하나 — 안 접으면 같은 오답이 버전 수만큼 나와 훈련에 되풀이된다.
const latest = new Map()
for (const a of analyses) {
  const prev = latest.get(a.item_id)
  if (!prev || a.version > prev.version) latest.set(a.item_id, a)
}

const examLabel = new Map(exams.map((e) => [e.id, e.label]))
const typeName = new Map(types.map((t) => [t.id, t.name]))
const universal = new Set(UNIVERSAL.map((t) => t.key))

const all = []
let dropShort = 0
let dropLeak = 0
for (const item of items) {
  if (!item.type_id) continue
  const a = latest.get(item.id)
  if (!a || !Array.isArray(a.choice_analysis)) continue
  for (const ch of a.choice_analysis) {
    const trap = typeof ch?.trap === 'string' ? ch.trap.trim() : ''
    if (!universal.has(trap)) continue
    const tempting = typeof ch.why_tempting === 'string' ? ch.why_tempting.trim() : ''
    const reject = typeof ch.how_to_reject === 'string' ? ch.how_to_reject.trim() : ''
    if (tempting.length < MIN_TEMPTING || reject.length < MIN_REJECT) {
      dropShort += 1
      continue
    }
    if (leaksAnswer(tempting, reject, trap)) {
      dropLeak += 1
      continue
    }
    const choice = Number(ch.n) || 0
    const id = `${item.id}:${choice}`
    all.push({
      id,
      item_id: item.id,
      slug: toItemSlug(item.id),
      exam_label: examLabel.get(item.exam_id) ?? item.exam_id,
      no: item.no,
      type_id: item.type_id,
      type_name: typeName.get(item.type_id) ?? item.type_id,
      choice,
      tempting,
      reject,
      answer: trap,
      // 보기 순서는 **문제 id 로만** 정해진다 — 구울 때 정해 두면 런타임이 순수해진다.
      options: buildOptions(trap, item.type_id, id, atlas.traps),
    })
  }
}

// ── 함정마다 상한 ────────────────────────────────────────────────────
// **문항이 고르게 섞이도록** 정렬한다. `item_id` 순으로 자르면 앞 회차만 남는다.
const byTrap = new Map()
for (const c of all.sort((x, y) => (hash(x.id) < hash(y.id) ? -1 : hash(x.id) > hash(y.id) ? 1 : 0))) {
  const arr = byTrap.get(c.answer) ?? []
  if (arr.length < PER_TRAP) arr.push(c)
  byTrap.set(c.answer, arr)
}
function hash(s) {
  let h = 2166136261
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return (h >>> 0).toString(16).padStart(8, '0')
}

const cards = [...byTrap.values()].flat().sort((a, b) => (a.id < b.id ? -1 : 1))

// ── 유출 검사 ────────────────────────────────────────────────────────
// 나가는 두 줄은 우리가 쓴 한국어다. 영어가 통째로 나가면 원문 복제로 읽힐 수 있으므로,
// 연속 영어가 길면 **아무것도 쓰지 않는다** — 부분 산출물을 남기면 다음 사람이 정상으로 여긴다.
const LEAK = 200
const leaks = []
for (const c of cards) {
  for (const field of ['tempting', 'reject']) {
    for (const m of String(c[field]).matchAll(/[A-Za-z][A-Za-z ,.;:'’“”"()\-]{80,}/g)) {
      if (m[0].length >= LEAK) leaks.push(`${c.id} / ${field} / ${m[0].length}자`)
    }
  }
}
if (leaks.length) {
  console.error(`유출 의심 ${leaks.length}건 — 아무것도 쓰지 않는다:`)
  for (const l of leaks.slice(0, 10)) console.error('  ' + l)
  process.exit(1)
}

const pool = {
  built_at: new Date().toISOString().slice(0, 10),
  per_trap: PER_TRAP,
  /** 거르기 전 쓸 수 있었던 전체 — 화면이 「무엇에서 골랐는지」 말할 수 있게 */
  eligible: all.length,
  cards,
}

console.log('')
console.log(`  쓸 수 있는 오답 ${all.length} (너무 짧아 제외 ${dropShort} · 정답 누설 제외 ${dropLeak})`)
for (const [k, v] of [...byTrap.entries()].sort((a, b) => b[1].length - a[1].length)) {
  console.log(`   ${k.padEnd(14)} ${String(v.length).padStart(4)}`)
}
console.log(`  구운 문제 ${cards.length}`)
console.log('')

const json = JSON.stringify(pool, null, 1) + '\n'

if (CHECK) {
  let cur = null
  try {
    cur = fs.readFileSync(OUT, 'utf8')
  } catch {
    /* 없으면 낡은 것과 같이 본다 */
  }
  const strip = (s) => (s ?? '').replace(/"built_at": "[^"]*",?\n/, '')
  if (strip(cur) === strip(json)) {
    console.log('최신이다.')
    process.exit(0)
  }
  console.error('낡았다 — node scripts/csat/build-trap-drill.mjs --write')
  process.exit(1)
}

if (!WRITE) {
  console.log(`예행이다. 쓰려면 --write (대상 ${path.relative(process.cwd(), OUT)}, ${json.length.toLocaleString()}자)`)
  process.exit(0)
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, json)
console.log(`→ ${path.relative(process.cwd(), OUT)} (${json.length.toLocaleString()}자)`)
