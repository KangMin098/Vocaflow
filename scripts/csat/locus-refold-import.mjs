// scripts/csat/locus-refold-import.mjs
//
// **근거 서술 재작성 드레인 — 3단계(import).** `.out.json` 원장을 DB 로 올린다.
//
// ⚠️ **이 드레인은 덮어쓴다.** `csat_type_reports.answer_locus_pattern` 은 버전 컬럼이 없어서
//    새 행으로 넣을 자리가 없다. 그래서 쓰기 직전에 원본을 `backup-<TYPE>-<시각>.txt` 로
//    남긴다 — 되돌릴 수 있어야 승인할 수 있는 종류의 변경이다.
//
// 게이트는 이 파일 안에 있다(별도 validate 스크립트를 두지 않았다 — 검사가 다섯뿐이고,
// 나누면 "게이트를 안 돌린 채 올리는" 경로가 생긴다):
//   ① 작업 표지가 남아 있으면 막는다 — 재작성의 목적 자체다
//   ② 200자 미만이면 막는다 — 요약으로 뭉갠 것
//   ③ 원본에 없는 문항 id 가 새로 나오면 막는다 — 근거를 지어낸 것
//   ④ 원본과 글자가 똑같으면 막는다 — 안 고친 것
//   ⑤ 원본에 없는 **영어 토막**이 나오면 막는다 — 표지어를 지어낸 것.
//      ③이 못 보는 자리다(실측 2026-09-05: 문항 id 는 전부 맞는데 「too close」·「For example」·
//      「commonly believed」가 새로 생겼다). 학습자는 이 목록을 시험장에서 그대로 찾는다.
//
// 빈 값·짧은 값은 넣지 않는다. 건너뛴 수를 반드시 출력한다(CLAUDE.md §🤖).
//
// 실행:
//   node scripts/csat/locus-refold-import.mjs           (미리보기 — 아무것도 안 쓴다)
//   node scripts/csat/locus-refold-import.mjs --commit

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'

import { citedItemIds, detectAnalystMeta, inventedFragments } from './lib-analyst-markers.mjs'

const COMMIT = process.argv.includes('--commit')
const WORK = path.resolve('scripts/csat/locus-refold')
const MIN_CHARS = 200

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
if (!URL || !KEY) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 를 못 찾았다')
const db = createClient(URL, KEY, { auth: { persistSession: false } })

const files = fs.existsSync(WORK) ? fs.readdirSync(WORK).filter((f) => f.endsWith('.out.json')).sort() : []
if (!files.length) {
  console.log('  .out.json 이 없다 — 먼저 locus-refold-export.mjs 를 돌리고 청크를 채운다')
  process.exit(0)
}

const cur = await db.from('csat_type_reports').select('type_id, answer_locus_pattern').eq('status', 'published')
if (cur.error) throw new Error(`csat_type_reports: ${cur.error.message}`)
const original = new Map((cur.data ?? []).map((r) => [r.type_id, r.answer_locus_pattern ?? '']))

const ready = []
const skipped = []

for (const f of files) {
  let j
  try {
    j = JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8'))
  } catch (e) {
    skipped.push([f, `파싱 실패 — ${e.message}`])
    continue
  }
  const tid = j.type_id
  const text = (j.answer_locus_pattern ?? '').trim()
  if (!tid) { skipped.push([f, 'type_id 가 없다']); continue }
  if (!original.has(tid)) { skipped.push([f, `발행된 유형 리포트가 없다: ${tid}`]); continue }

  const before = original.get(tid)

  // ② 너무 짧다
  if (text.length < MIN_CHARS) { skipped.push([f, `${text.length}자 — ${MIN_CHARS}자 미만은 요약으로 본다`]); continue }
  // ④ 안 고쳤다
  if (text === before.trim()) { skipped.push([f, '원본과 글자가 같다 — 고치지 않았다']); continue }
  // ① 표지가 남았다
  const left = detectAnalystMeta(text)
  if (left.length) { skipped.push([f, `작업 표지가 남았다: ${left.join(', ')}`]); continue }
  // ③ 없던 근거를 만들었다
  const had = citedItemIds(before)
  const invented = [...citedItemIds(text)].filter((id) => !had.has(id))
  if (invented.length) { skipped.push([f, `원본에 없는 문항 id: ${invented.join(' · ')}`]); continue }
  // ⑤ 없던 표지어를 만들었다
  const madeUp = inventedFragments(before, text)
  if (madeUp.length) { skipped.push([f, `원본에 없는 영어 표현: ${madeUp.map((m) => JSON.stringify(m)).join(' · ')}`]); continue }

  ready.push({ file: f, type_id: tid, text, before, note: j.note ?? null })
}

console.log(`\n  청크 ${files.length} · 통과 ${ready.length} · 건너뜀 ${skipped.length}`)
for (const [f, why] of skipped) console.log(`    ✗ ${f} — ${why}`)
for (const r of ready) {
  const pct = Math.round((r.text.length / Math.max(r.before.length, 1)) * 100)
  console.log(`    ✓ ${r.type_id}  ${r.before.length}자 → ${r.text.length}자 (${pct}%)`)
}

if (!ready.length) { console.log('\n  올릴 것이 없다'); process.exit(skipped.length ? 1 : 0) }

if (!COMMIT) {
  console.log('\n  미리보기다 — 아무것도 쓰지 않았다. 올리려면 --commit')
  console.log('  ⚠ --commit 은 answer_locus_pattern 을 **덮어쓴다**. 원본은 backup-<TYPE>-<시각>.txt 로 남는다.')
  process.exit(0)
}

// ── 되돌릴 수 있게 만든 뒤에 쓴다 ────────────────────────────────────
const stamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
let ok = 0
for (const r of ready) {
  const backup = path.join(WORK, `backup-${r.type_id}-${stamp}.txt`)
  fs.writeFileSync(backup, r.before, 'utf8')
  const { error } = await db
    .from('csat_type_reports')
    .update({ answer_locus_pattern: r.text, updated_at: new Date().toISOString() })
    .eq('type_id', r.type_id)
  if (error) {
    console.log(`    ✗ ${r.type_id} 적재 실패 — ${error.message} (원본은 ${path.basename(backup)} 에 있다)`)
    continue
  }
  console.log(`    ↑ ${r.type_id} 적재 · 원본 ${path.basename(backup)}`)
  ok += 1
}

console.log(`\n  적재 ${ok}/${ready.length}. 되돌리려면 backup-<TYPE>-${stamp}.txt 를 그대로 다시 넣는다.`)
console.log('  확인: /admin/csat/evidence → 가이드 원천 → 「학습자 배포 가능 근거 서술」이 올랐는가.')
