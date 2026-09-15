// scripts/csat/build-trap-atlas.mjs
//
// **오답 지도를 구워 낸다 — 「평가원은 오답을 몇 가지 방법으로 만드는가」.**
//
// ── 무엇을 발견했나 (실측 2026-09-15) ─────────────────────────────────
// `csat_item_analyses.choice_analysis` 는 문항마다 오답 선지를 하나씩 뜯어 **함정 이름**을
// 붙여 두었다. 802문항 × 오답 4개 = **3,208개**. 이름은 513가지로 흩어져 있는 것처럼
// 보이지만 세어 보면 그렇지 않다:
//
//   상위 9가지  = 1,935개 (60.3%) — 그리고 각각이 **26유형 중 13~17유형**에 걸쳐 나온다
//   상위 20가지 = 2,309개 (72.0%)
//   1회뿐인 이름 = 361가지 (11%)
//
// 곧 **함정은 유형의 부속물이 아니라 유형을 가로지르는 기술**이다. 지금 화면은 유형 26개를
// 1급 시민으로 두고 함정을 그 안에 묻어 두는데, 그러면 학습자는 26벌의 절차를 외워야 한다.
// 세어 보면 외울 것은 9개다 (작업기억 ~4항목 · Sweller — 학습과학 원칙 6).
//
// ── 왜 빌드 시점에 굽나 ───────────────────────────────────────────────
// `skeleton-data` 와 같은 이유다. 3,208행을 **매 방문마다** 집계하면 히어로가 느려지고,
// 학습자 경로는 RLS 클라이언트라 페이지네이션 왕복이 여러 번 든다. 구워 두면 왕복 0 ·
// 서버 HTML 에 수치가 남고(I6) · 사람이 산출물을 열어 볼 수 있다.
//
// ⚠️ **상수를 박는 것이 아니다**(CLAUDE.md I5). 이 파일이 DB 에서 세고, `--check` 가
//    낡았는지 본다. 낡으면 exit 1 이고 파일은 안 고친다.
//
// ── 나가는 것 ─────────────────────────────────────────────────────────
// 세어 만든 수치와, **우리가 쓴 해설 문장**(`how_to_reject`·`why_tempting`)의 예시뿐이다.
// 평가원 지문·선지 원문은 나가지 않는다 — 이 두 필드는 분석가가 쓴 한국어 산문이고,
// 그 안의 영어 인용은 이미 문항 화면(`learner.ts`)이 내보내는 것과 같은 범위다.
//
// 재실행 안전하다. 같은 DB 에 대해 몇 번을 돌려도 같은 파일이 나온다(정렬이 전부 결정론적).
//
//   node scripts/csat/build-trap-atlas.mjs            # 예행 — 쓰지 않고 수치만
//   node scripts/csat/build-trap-atlas.mjs --write    # 실제로 쓴다
//   node scripts/csat/build-trap-atlas.mjs --check    # 낡았으면 exit 1 (파일 안 고침)

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
const OUT = path.resolve('apps/web/src/lib/csat/trap-atlas.json')

/** 지도에 이름을 남기는 하한. 이보다 드문 것은 「그 밖」으로 합친다 — 한 번 나온 함정을
 *  이름으로 외우게 하면 26유형을 외우던 문제를 513가지로 옮긴 것뿐이다. */
const MIN_N = 8

/** 「최근」의 경계. 허브 카드가 이미 쓰는 기준과 같다(`learner.ts` 의 `yearOf` ≥ 2023). */
const RECENT_FROM = 2023

/** 함정 하나에 붙이는 실제 기출 예시의 수. 늘리면 파일이 커지고 화면은 셋 넘게 안 쓴다. */
const EXAMPLES = 3

const { createClient } = await import('@supabase/supabase-js')

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ⚠️ 페이징한다 — PostgREST 는 1,000행에서 조용히 끊는다(오류가 아니라 「적게 받음」).
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
  page('csat_exams', 'id, label, year'),
  page('csat_types', 'id, name, status', (q) => q.eq('in_scope', true)),
  page('csat_item_analyses', 'item_id, version, choice_analysis', (q) => q.eq('status', 'published')),
])
console.log(`  문항 ${items.length} · 회차 ${exams.length} · 유형 ${types.length} · 분석행 ${analyses.length}`)

// ── 문항마다 최신 버전 하나만 ────────────────────────────────────────
// ⚠️ 버전을 안 접으면 **같은 오답이 버전 수만큼 세어진다.** 실측: 접기 전 11,788 · 접은 뒤 3,208.
//    세 배 넘게 부풀고, 분석을 많이 고친 문항일수록 크게 세어져 분포 자체가 거짓이 된다.
const latest = new Map()
for (const a of analyses) {
  const prev = latest.get(a.item_id)
  if (!prev || a.version > prev.version) latest.set(a.item_id, a)
}

const examOf = new Map(exams.map((e) => [e.id, e]))
const itemOf = new Map(items.map((i) => [i.id, i]))
const typeRow = new Map(types.map((t) => [t.id, t]))

/** 오답 한 개 = 한 행. 함정 이름이 없는 것(정답 선지 포함)은 빠진다. */
const rows = []
for (const [itemId, a] of latest) {
  const item = itemOf.get(itemId)
  if (!item || !item.type_id) continue
  const exam = examOf.get(item.exam_id)
  const year = exam?.year ?? 0
  for (const ch of Array.isArray(a.choice_analysis) ? a.choice_analysis : []) {
    const trap = typeof ch?.trap === 'string' ? ch.trap.trim() : ''
    if (!trap) continue
    rows.push({
      trap,
      itemId,
      typeId: item.type_id,
      no: item.no,
      examId: item.exam_id,
      examLabel: exam?.label ?? item.exam_id,
      year,
      recent: year >= RECENT_FROM,
      choice: Number(ch.n) || 0,
      reject: typeof ch.how_to_reject === 'string' ? ch.how_to_reject.trim() : '',
      tempting: typeof ch.why_tempting === 'string' ? ch.why_tempting.trim() : '',
    })
  }
}
const allNames = new Set(rows.map((r) => r.trap))
console.log(`  오답 선지 ${rows.length}개 · 함정 이름 ${allNames.size}가지`)

// ── 함정별 집계 ──────────────────────────────────────────────────────
const agg = new Map()
for (const r of rows) {
  let e = agg.get(r.trap)
  if (!e) {
    e = { key: r.trap, n: 0, recent: 0, items: new Set(), types: new Map(), typesRecent: new Map(), cands: [] }
    agg.set(r.trap, e)
  }
  e.n += 1
  if (r.recent) e.recent += 1
  e.items.add(r.itemId)
  e.types.set(r.typeId, (e.types.get(r.typeId) ?? 0) + 1)
  if (r.recent) e.typesRecent.set(r.typeId, (e.typesRecent.get(r.typeId) ?? 0) + 1)
  e.cands.push(r)
}

/**
 * 예시 고르기 — **짧고 최근인 것 먼저**, 그리고 서로 다른 유형에서.
 * 한 유형에서 셋을 뽑으면 「이 함정은 그 유형 것」이라는 잘못된 인상을 준다.
 * 정렬 키가 전부 결정론적이라 재실행해도 같은 셋이 나온다.
 */
function pickExamples(cands) {
  const sorted = [...cands].sort(
    (a, b) =>
      Number(b.recent) - Number(a.recent) ||
      a.reject.length - b.reject.length ||
      (a.itemId < b.itemId ? -1 : a.itemId > b.itemId ? 1 : 0),
  )
  const out = []
  const seenType = new Set()
  for (const pass of [1, 2]) {
    for (const c of sorted) {
      if (out.length >= EXAMPLES) break
      if (pass === 1 && seenType.has(c.typeId)) continue
      if (out.some((o) => o.item_id === c.itemId && o.choice === c.choice)) continue
      if (!c.reject) continue
      seenType.add(c.typeId)
      out.push({
        item_id: c.itemId,
        slug: c.itemId.replace('#', '-'),
        exam_label: c.examLabel,
        no: c.no,
        type_id: c.typeId,
        choice: c.choice,
        tempting: c.tempting,
        reject: c.reject,
      })
    }
  }
  return out
}

const traps = [...agg.values()]
  .filter((e) => e.n >= MIN_N)
  .sort((a, b) => b.n - a.n || (a.key < b.key ? -1 : 1))
  .map((e) => ({
    key: e.key,
    n: e.n,
    recent: e.recent,
    items: e.items.size,
    types: e.types.size,
    by_type: Object.fromEntries([...e.types.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))),
    by_type_recent: Object.fromEntries(
      [...e.typesRecent.entries()].sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)),
    ),
    examples: pickExamples(e.cands),
  }))

const named = traps.reduce((a, t) => a + t.n, 0)
const namedRecent = traps.reduce((a, t) => a + t.recent, 0)

// ── 유형별 요약 ──────────────────────────────────────────────────────
// 칩이 「비어 있는 유형」을 내밀지 않으려면 유형마다 오답이 몇 개인지 알아야 한다.
const typeAgg = new Map()
for (const r of rows) {
  let e = typeAgg.get(r.typeId)
  if (!e) e = { id: r.typeId, n: 0, recent: 0, items: new Set() }
  e.n += 1
  if (r.recent) e.recent += 1
  e.items.add(r.itemId)
  typeAgg.set(r.typeId, e)
}
const typeList = [...typeAgg.values()]
  .map((e) => ({
    id: e.id,
    name: typeRow.get(e.id)?.name ?? e.id,
    status: typeRow.get(e.id)?.status === 'retired' ? 'retired' : 'active',
    distractors: e.n,
    recent: e.recent,
    items: e.items.size,
    /** 이 유형 안에서 「이름 붙은 함정」이 덮는 비율 — 나머지는 그 밖이다. */
    named: traps.reduce((a, t) => a + (t.by_type[e.id] ?? 0), 0),
  }))
  .sort((a, b) => Number(a.status === 'retired') - Number(b.status === 'retired') || b.recent - a.recent || b.n - a.n)

const atlas = {
  // 언제 센 것인지 화면이 말할 수 있어야 한다 — 「최근 4개년」이 언제 기준인지 모르면 수치가 뜬다.
  built_at: new Date().toISOString().slice(0, 10),
  recent_from: RECENT_FROM,
  min_n: MIN_N,
  corpus: {
    exams: exams.length,
    items: items.length,
    analyzed: latest.size,
    distractors: rows.length,
    distinct_traps: allNames.size,
    named,
    named_recent: namedRecent,
    recent: rows.filter((r) => r.recent).length,
    year_min: Math.min(...exams.map((e) => e.year)),
    year_max: Math.max(...exams.map((e) => e.year)),
  },
  types: typeList,
  traps,
}

// ── 유출 검사 ────────────────────────────────────────────────────────
// 예시로 나가는 것은 **우리가 쓴 한국어 해설**이다. 영어가 통째로 나가면 원문 복제로 읽힐 수
// 있으므로, 예시 한 개 안의 연속 영어가 길면 쓰지 않는다. 임계는 분석 산문의 실측 분포에서
// 잡았다(인용은 짧은 조각으로 들어간다 — 평균 134자 문장 안의 인용).
const LEAK = 200
const leaks = []
for (const t of atlas.traps) {
  for (const ex of t.examples) {
    for (const field of ['tempting', 'reject']) {
      for (const m of String(ex[field] ?? '').matchAll(/[A-Za-z][A-Za-z ,.;:'’“”"()\-]{80,}/g)) {
        if (m[0].length >= LEAK) leaks.push(`${t.key} / ${ex.item_id} / ${field} / ${m[0].length}자`)
      }
    }
  }
}
if (leaks.length) {
  console.error(`유출 의심 ${leaks.length}건 — 아무것도 쓰지 않는다:`)
  for (const l of leaks.slice(0, 10)) console.error('  ' + l)
  process.exit(1)
}

// ── 보고 ─────────────────────────────────────────────────────────────
const pct = (n) => ((100 * n) / rows.length).toFixed(1) + '%'
console.log('')
console.log(`  이름 붙은 함정 ${traps.length}가지 = ${named} / ${rows.length} (${pct(named)})`)
let cum = 0
for (const [i, t] of traps.slice(0, 12).entries()) {
  cum += t.n
  console.log(
    `   ${String(i + 1).padStart(2)}. ${t.key.padEnd(14)} ${String(t.n).padStart(4)}  ${t.types}유형  누적 ${pct(cum)}`,
  )
}
console.log('')

const json = JSON.stringify(atlas, null, 2) + '\n'

if (CHECK) {
  let cur = null
  try {
    cur = fs.readFileSync(OUT, 'utf8')
  } catch {
    /* 없으면 낡은 것과 같이 취급 */
  }
  // `built_at` 은 도는 날마다 달라지므로 견주지 않는다 — 수치가 같으면 낡지 않은 것이다.
  const strip = (s) => (s ?? '').replace(/"built_at": "[^"]*",?\n/, '')
  if (strip(cur) === strip(json)) {
    console.log('최신이다.')
    process.exit(0)
  }
  console.error(`낡았다 — 다시 구워야 한다:\n  node scripts/csat/build-trap-atlas.mjs --write`)
  process.exit(1)
}

if (!WRITE) {
  console.log(`예행이다. 쓰려면 --write (대상 ${path.relative(process.cwd(), OUT)}, ${json.length.toLocaleString()}자)`)
  process.exit(0)
}

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, json)
console.log(`→ ${path.relative(process.cwd(), OUT)} (${json.length.toLocaleString()}자)`)
