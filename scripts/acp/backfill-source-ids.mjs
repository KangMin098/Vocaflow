// scripts/acp/backfill-source-ids.mjs
//
// **열쇠 백필** — `sourceKey()` 규약 이전에 들어간 `source_id` 를 규약 꼴로 고친다.
//
// ── 왜 (실측 2026-09-07) ──────────────────────────────────────────────
// VOA 249행이 전부 base36 해시(`voa:ewolkz`)다. 적재기의 슬러그 정규식이
// `…/7886988.html` 에 안 맞아 해시로 물러섰기 때문이고, 목록기와 seed_catalog(30행)는
// `voa:7886988` 을 쓰고 있었다. **한 건도 겹치지 않으니 중복 차단이 한 번도 작동하지 않았다.**
// 코드를 고쳐도 기존 249행이 옛 꼴이면 검사는 여전히 0건이다 — 그래서 백필한다.
//
// Wikipedia 92행은 이미 `wikipedia:<pageid>` 라 **고칠 것이 없다**(정찰 보고와 DB 실측 일치).
// 그래서 여기서 다루는 것은 VOA 뿐이고, `--source` 로 확장 가능하게 열어 둔다.
//
// ── 되돌릴 수 있게 ────────────────────────────────────────────────────
// 새 컬럼을 만들지 않는다(마이그레이션 승인 사항). 대신 **정정 전 값을 파일로 남긴다** —
//   scripts/acp/data/backfill-source-ids-<source>-<타임스탬프>.json
//   [{ id, before, after }, …]
// 되돌리기: `--revert <그 파일>`. 파일이 곧 롤백 스크립트다.
//
// ⚠️ **`adapt:` 로 시작하는 행은 건드리지 않는다** — 재저작본이고 열쇠 규약이 다르다
//    (VOA 266행 중 17행. 이걸 같이 고치면 원본과 각색본이 한 열쇠로 뭉친다).
// ⚠️ 충돌하면 멈춘다 — 정정 결과가 이미 있는 열쇠와 겹치면 그 행은 건드리지 않고 센다.
//
// 재실행 안전: **그렇다.** 이미 규약 꼴인 행은 건너뛴다(건너뛴 수를 출력한다).
// 기본은 dry-run. `--commit` 이 있어야 쓴다.
//
// 실행:
//   pnpm dlx tsx scripts/acp/backfill-source-ids.mjs                    # 셈만
//   pnpm dlx tsx scripts/acp/backfill-source-ids.mjs --commit
//   pnpm dlx tsx scripts/acp/backfill-source-ids.mjs --revert scripts/acp/data/backfill-….json --commit

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const COMMIT = process.argv.includes('--commit')
const SOURCE = arg('source') ?? 'voa'
const REVERT = arg('revert')

const { createClient } = await import('@supabase/supabase-js')
const { sourceKey, isCanonicalSourceKey, GOVERNED_SOURCES } = await import(
  '../../packages/library-pipeline/src/index.ts'
)

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ── 되돌리기 ──────────────────────────────────────────────────────────
if (REVERT) {
  const log = JSON.parse(fs.readFileSync(path.resolve(REVERT), 'utf8'))
  console.log(`되돌리기 ${log.length}행 (${REVERT})${COMMIT ? '' : ' — dry-run'}`)
  let done = 0
  for (const r of log) {
    if (!COMMIT) continue
    const { error } = await db.from('library_articles').update({ source_id: r.before }).eq('id', r.id)
    if (error) {
      console.log(`  ✗ ${r.id}: ${error.message.slice(0, 60)}`)
      continue
    }
    done++
  }
  console.log(`되돌린 행 ${done}`)
  process.exit(0)
}

if (!GOVERNED_SOURCES.includes(SOURCE)) {
  console.error(`규약 소스가 아니다: ${SOURCE} — ${GOVERNED_SOURCES.join(' · ')}`)
  process.exit(1)
}

// ── 셈 ────────────────────────────────────────────────────────────────
const rows = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from('library_articles')
    .select('id, source_id, source_url')
    .eq('source', SOURCE)
    .range(from, from + 999)
  if (error) throw new Error('조회 실패: ' + error.message)
  rows.push(...(data ?? []))
  if (!data || data.length < 1000) break
}

const plan = []
let already = 0
let derived = 0 // 재저작본 등 — 규약 대상 아님
let underivable = 0
for (const r of rows) {
  // `adapt:` 재저작본은 규약 밖이다. 손대면 원본과 각색본이 한 열쇠로 뭉친다.
  if (/^adapt:/.test(r.source_id ?? '')) {
    derived++
    continue
  }
  if (isCanonicalSourceKey(SOURCE, r.source_id ?? '')) {
    already++
    continue
  }
  let after
  try {
    after = sourceKey(SOURCE, { url: r.source_url })
  } catch {
    underivable++
    continue
  }
  plan.push({ id: r.id, before: r.source_id, after })
}

// 정정 결과끼리 · 기존 행과 충돌하는가 — 겹치면 그 행은 두고 센다.
const taken = new Set(rows.map((r) => r.source_id))
const seenAfter = new Set()
const collide = []
const apply = []
for (const p of plan) {
  if (seenAfter.has(p.after) || (taken.has(p.after) && p.after !== p.before)) {
    collide.push(p)
    continue
  }
  seenAfter.add(p.after)
  apply.push(p)
}

console.log(
  `${SOURCE} ${rows.length}행 — 이미 규약 ${already} · 재저작본(건드리지 않음) ${derived} · ` +
    `유도 불가 ${underivable} · **정정 대상 ${apply.length}** · 충돌 ${collide.length}`,
)
for (const p of apply.slice(0, 5)) console.log(`   ${p.before}  →  ${p.after}`)
if (apply.length > 5) console.log(`   … 외 ${apply.length - 5}행`)
for (const p of collide) console.log(`  ⚠ 충돌(그대로 둔다) ${p.before} → ${p.after}`)

if (!COMMIT) {
  console.log('\ndry-run 이었다. 실제로 고치려면 --commit.')
  process.exit(0)
}
if (apply.length === 0) process.exit(0)

// ── 정정 전 값을 먼저 남긴다 ──────────────────────────────────────────
// **쓰기 전에** 파일을 만든다. 중간에 죽어도 되돌릴 수 있어야 한다.
const stamp = new Date().toISOString().replace(/[:.]/g, '-')
const logFile = path.resolve(`scripts/acp/data/backfill-source-ids-${SOURCE}-${stamp}.json`)
fs.mkdirSync(path.dirname(logFile), { recursive: true })
fs.writeFileSync(logFile, JSON.stringify(apply, null, 2) + '\n', 'utf8')
console.log(`\n정정 전 값 ${apply.length}행 → ${logFile}`)

let ok = 0
const failures = []
for (const p of apply) {
  const { error } = await db.from('library_articles').update({ source_id: p.after }).eq('id', p.id)
  if (error) {
    failures.push(`${p.id}: ${error.message.slice(0, 60)}`)
    continue
  }
  ok++
}
console.log(`정정 ${ok}행 · 실패 ${failures.length}`)
for (const f of failures.slice(0, 10)) console.log(`  ✗ ${f}`)
console.log(`되돌리려면: pnpm dlx tsx scripts/acp/backfill-source-ids.mjs --revert ${logFile} --commit`)
