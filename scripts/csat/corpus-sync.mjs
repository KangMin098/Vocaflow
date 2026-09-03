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
// 딱 하나 예외가 `--prune-listening` 이다 — **듣기 행을 지운다.** 사용자가 「듣기는 전체에서
// 제외」를 지시했고(2026-09-03), 듣기에는 분석이 한 건도 없어 CASCADE 로 잃을 것이 없다.
// 그래도 **지우기 전에 다시 센다**: 듣기 문항에 분석이 하나라도 붙어 있거나, 듣기가 아닌 문항이
// 듣기 유형을 물고 있으면 **아무것도 지우지 않고 멈춘다.** 지시가 옳아도 전제가 바뀌었을 수 있고,
// 그때 지우면 되돌릴 수 없다. 플래그를 따로 둔 이유도 같다 — 평상시 동기화에 삭제가 묻어가면 안 된다.
// (원장 `corpus.json` 에는 듣기 문항이 그대로 남는다. 되살리려면 여기서 다시 올리면 된다.)
//
// 실행:
//   node scripts/csat/corpus-sync.mjs            (미리보기 — 쓰지 않는다)
//   node scripts/csat/corpus-sync.mjs --commit
//   node scripts/csat/corpus-sync.mjs --commit --prune-listening

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

const COMMIT = process.argv.includes('--commit')
const PRUNE_LISTENING = process.argv.includes('--prune-listening')
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
// ⚠️ **듣기는 DB 로 올리지 않는다** (사용자 지시 2026-09-03 「듣기는 전체에서 제외」).
//    올려 두면 `csat_items` 를 세는 모든 화면·질의가 우리가 손대지도 않는 520문항을 함께 세고,
//    유형 목록에는 학습자가 영원히 못 볼 듣기 유형 18개가 남는다.
//    원장(corpus.json)에는 남겨 둔다 — 거기서는 "45문항 중 28을 떴다" 를 확인하는 자리 표시다.
const scopeItems = corpus.items.filter((i) => i.in_scope)
const usedTypes = new Set(scopeItems.map((i) => i.type_id).filter(Boolean))
const recentTypes = new Set(scopeItems.filter((i) => i.year >= 2023 && i.type_id).map((i) => i.type_id))
const types = typeTable
  .filter((t) => t.sec !== '듣기')
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
const items = scopeItems.map((it) => ({
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

console.log(`  유형 ${types.length} · 회차 ${exams.length} · 사정권 문항 ${items.length} (듣기 ${corpus.items.length - items.length}문항 제외)`)
console.log(`  정답 보유 ${items.filter((i) => i.answer != null).length}`)
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

// 이번에 안 올린 DB 문항 — **지우지 않고 보고만 한다.** 갈래가 둘이고 뜻이 다르다:
//   · 듣기(`section='듣기'`) — 이제 안 올린다. 분석이 0건이라 지워도 잃을 것이 없지만,
//     **삭제는 사용자 확인이 필요한 동작**이라 여기서 하지 않는다.
//   · 그 밖 — 코퍼스에서 빠진 문항이다. 지우면 딸린 분석이 CASCADE 로 함께 사라진다.
// ⚠️ **페이지를 넘겨 가며 읽는다.** PostgREST 는 한 번에 1,000행까지만 준다 —
//    그냥 `select` 하면 1,350행 중 1,000행만 와서 "남은 문항 406개" 같은 **틀린 수**를 보고한다
//    (실측 2026-09-03. 잘린 줄 모르고 그 수를 믿을 뻔했다).
const dbIds = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from('csat_items').select('id, section').range(from, from + 999)
  if (error) throw new Error(error.message)
  dbIds.push(...(data ?? []))
  if ((data ?? []).length < 1000) break
}
const have = new Set(items.map((i) => i.id))
const stale = (dbIds ?? []).filter((r) => !have.has(r.id))
const listening = stale.filter((r) => r.section === '듣기')
const gone = stale.filter((r) => r.section !== '듣기')
if (listening.length) {
  console.log(`  · DB 에 남은 듣기 문항 ${listening.length}개 — 이제 올리지 않는다. 지우려면 사용자 확인 뒤 삭제할 것`)
}
if (gone.length) {
  // **분석이 붙었는지 실제로 세어 말한다.** "분석이 CASCADE 로 사라진다" 를 무조건 적어 두면
  // 그 경고가 참인지 거짓인지 아무도 모르게 되고, 정말 위험한 날에도 똑같이 읽힌다.
  const ids = gone.map((r) => r.id)
  let withAnalyses = 0
  for (let i = 0; i < ids.length; i += 200) {
    const { count, error: aErr } = await db
      .from('csat_item_analyses')
      .select('*', { count: 'exact', head: true })
      .in('item_id', ids.slice(i, i + 200))
    if (aErr) throw new Error(aErr.message)
    withAnalyses += count ?? 0
  }
  const risk = withAnalyses > 0 ? `분석 ${withAnalyses}건이 딸려 있다 — 지우면 CASCADE 로 사라진다` : '딸린 분석 0건 — 지워도 잃을 것이 없다'
  console.log(`  ⚠ 코퍼스에 없는 DB 문항 ${gone.length}개 (${risk}): ${gone.slice(0, 5).map((r) => r.id).join(' ')}`)
}
// ── 듣기 행 삭제 (--prune-listening) ─────────────────────────────────
if (PRUNE_LISTENING) {
  // 전제를 **지금 다시 잰다.** 예전에 0이었다는 것은 근거가 아니다.
  const countOf = async (table, build) => {
    const { count, error } = await build(db.from(table).select('*', { count: 'exact', head: true }))
    if (error) throw new Error(`${table}: ${error.message}`)
    return count ?? 0
  }
  const listeningItems = await countOf('csat_items', (q) => q.eq('section', '듣기'))
  const listeningTypes = await countOf('csat_types', (q) => q.eq('section', '듣기'))
  const stuckInScope = await countOf('csat_items', (q) => q.eq('section', '듣기').eq('in_scope', true))

  // 듣기 문항에 붙은 분석 — 하나라도 있으면 멈춘다(CASCADE 로 사라진다)
  const { data: lIds, error: lErr } = await db.from('csat_items').select('id').eq('section', '듣기')
  if (lErr) throw new Error(lErr.message)
  let attached = 0
  for (let i = 0; i < (lIds ?? []).length; i += 200) {
    attached += await countOf('csat_item_analyses', (q) =>
      q.in('item_id', lIds.slice(i, i + 200).map((r) => r.id)),
    )
  }
  // 듣기가 아닌 문항이 듣기 유형을 물고 있으면 유형 삭제가 FK 로 막힌다(NO ACTION)
  const { data: lTypeIds, error: tErr } = await db.from('csat_types').select('id').eq('section', '듣기')
  if (tErr) throw new Error(tErr.message)
  const orphanRisk = (lTypeIds ?? []).length
    ? await countOf('csat_items', (q) => q.in('type_id', lTypeIds.map((r) => r.id)).neq('section', '듣기'))
    : 0

  console.log(`
  듣기 삭제 예정 — 문항 ${listeningItems} · 유형 ${listeningTypes}`)
  const blockers = []
  if (attached > 0) blockers.push(`듣기 문항에 분석 ${attached}건이 붙어 있다 (CASCADE 로 사라진다)`)
  if (stuckInScope > 0) blockers.push(`듣기인데 in_scope=true 인 문항 ${stuckInScope}개 — 경계가 어긋나 있다`)
  if (orphanRisk > 0) blockers.push(`듣기 유형을 문 비듣기 문항 ${orphanRisk}개 — 유형 삭제가 막힌다`)
  if (blockers.length) {
    console.log('  ✗ 아무것도 지우지 않았다:')
    for (const b of blockers) console.log(`      · ${b}`)
    process.exit(1)
  }

  // 문항 → 유형 순서. 반대로 하면 `csat_items.type_id` FK(NO ACTION)에 막힌다.
  const di = await db.from('csat_items').delete().eq('section', '듣기').select('id')
  if (di.error) throw new Error(`문항 삭제: ${di.error.message}`)
  const dt = await db.from('csat_types').delete().eq('section', '듣기').select('id')
  if (dt.error) throw new Error(`유형 삭제: ${dt.error.message}`)
  console.log(`  · 삭제 완료 — 문항 ${di.data?.length ?? 0} · 유형 ${dt.data?.length ?? 0}`)
}

console.log('→ csat_types · csat_exams · csat_items 적재 완료')
