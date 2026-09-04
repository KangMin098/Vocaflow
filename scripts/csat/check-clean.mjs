// scripts/csat/check-clean.mjs
//
// **새 정제·배제 규칙을 채택해도 되는가** — 읽기만 하는 등가성 확인.
//
// `lib-clean.mjs` 의 두 함수는 옛 책을 겨냥해 만들었다. 그런데 재고 26,000편은
// 대부분 현대 학술 산문(PLOS)이고, 새 규칙이 그것들을 잘못 걸러 내면 균형 사정권이
// 이유 없이 내려간다. **규칙을 쓰기 전에 그 위험부터 잰다.**
//
// 두 가지를 함께 본다:
//   ① 오탐 — 이미 적합 판정을 받은 기존 원문 중 몇 %가 `looksLikeBookMatter` 에 걸리나.
//            0 에 가까워야 한다. 걸리는 게 있으면 그 본문을 눈으로 보고 규칙을 좁힌다.
//   ② 효과 — Gutenberg 책에서 정제 전후로 적합률과 조각 품질이 어떻게 달라지나.
//
//   node scripts/csat/check-clean.mjs --sample 800
//
// 쓰기는 안 한다.

import fs from 'node:fs'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fitRecord } from './lib-fit.mjs'
import { classify } from './lib-topic.mjs'
import { cleanBookText, looksLikeBookMatter } from './lib-clean.mjs'

const run = promisify(execFile)
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const SAMPLE = Number(arg('sample', 800))

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

console.log(`정제·배제 규칙 등가성 확인\n${'='.repeat(78)}`)

// ── ① 오탐 — 기존 적합 원문에 새 배제 규칙을 대 본다 ──────────────────
console.log(`\n① 오탐 — 이미 적합인 기존 원문 ${SAMPLE}편에 looksLikeBookMatter 를 대 본다`)
const { data, error } = await db
  .from('library_articles')
  .select('id, title, content, source, csat_fit')
  .not('csat_fit', 'is', null)
  .gt('csat_fit->>pass', '0')
  .limit(SAMPLE)
if (error) {
  console.log(`  ❌ 읽기 실패 — ${error.message}`)
  process.exit(1)
}
const rows = (data ?? []).filter((r) => r.content)
let flagged = 0
const samples = []
for (const r of rows) {
  if (looksLikeBookMatter(r.content)) {
    flagged += 1
    if (samples.length < 5) samples.push(r)
  }
}
const rate = rows.length ? (flagged / rows.length) * 100 : 0
console.log(`  표본 ${rows.length}편 · 걸린 것 ${flagged}편 (**${rate.toFixed(2)}%**)`)
console.log(`  기준: 1% 미만이면 채택 가능. 그 위면 규칙이 현대 산문을 잘못 잡고 있다.`)
console.log(`  → ${rate < 1 ? '✅ 채택 가능' : '❌ 규칙을 좁혀야 한다'}`)
for (const s of samples) {
  console.log(`\n    · [${s.source}] ${String(s.title).slice(0, 56)}`)
  console.log(`      ${String(s.content).replace(/\s+/g, ' ').slice(0, 180)} …`)
}

// ── ② 효과 — Gutenberg 책에서 정제 전후 ──────────────────────────────
console.log(`\n\n② 효과 — Gutenberg 3권에서 정제 전후 비교`)
const strip = (t) => {
  const s = t.indexOf('*** START OF')
  const e = t.indexOf('*** END OF')
  let b = t
  if (s > 0) b = b.slice(b.indexOf('\n', s) + 1)
  if (e > 0) b = b.slice(0, b.lastIndexOf('*** END OF'))
  return b
}
const chop = (body, lo = 300, hi = 340) => {
  const ps = body.split(/\n\s*\n/).map((x) => x.replace(/\s+/g, ' ').trim()).filter((x) => x.length > 80 && /[.!?]/.test(x))
  const out = []
  let buf = []
  let n = 0
  for (const p of ps) {
    const w = p.split(/\s+/).length
    if (w > hi) continue
    buf.push(p)
    n += w
    if (n >= lo) {
      if (n <= hi + 60) out.push(buf.join(' '))
      buf = []
      n = 0
    }
  }
  return out
}

console.log(`\n  ${'책'.padEnd(34)} ${'정제 전'.padStart(10)} ${'정제 후'.padStart(10)} ${'배제'.padStart(6)}`)
console.log(`  ${'-'.repeat(66)}`)
let beforeAll = 0
let afterAll = 0
let droppedAll = 0
const topicAfter = {}
for (const id of ['7524', '16351', '67363', '6400', '41775']) {
  let raw
  try {
    const { stdout } = await run('curl', ['-sSL', '--max-time', '90', '-A', 'Mozilla/5.0', '--fail', `https://www.gutenberg.org/cache/epub/${id}/pg${id}.txt`], { maxBuffer: 64 * 1024 * 1024 })
    raw = stdout
  } catch (e) {
    console.log(`  #${id} 실패 — ${String(e.message).slice(0, 40)}`)
    continue
  }
  const title = ((raw.match(/Title:\s*(.+)/) ?? [])[1] ?? `#${id}`).trim().slice(0, 32)
  const before = chop(strip(raw)).filter((c) => fitRecord(c).pass > 0).length
  const cleaned = chop(cleanBookText(strip(raw)))
  const kept = cleaned.filter((c) => !looksLikeBookMatter(c))
  const dropped = cleaned.length - kept.length
  const after = kept.filter((c) => fitRecord(c).pass > 0)
  for (const c of after) {
    const t = classify(c).topic
    topicAfter[t] = (topicAfter[t] ?? 0) + 1
  }
  beforeAll += before
  afterAll += after.length
  droppedAll += dropped
  console.log(`  ${title.padEnd(34)} ${String(before).padStart(10)} ${String(after.length).padStart(10)} ${String(dropped).padStart(6)}`)
}
console.log(`  ${'-'.repeat(66)}`)
console.log(`  ${'합계'.padEnd(34)} ${String(beforeAll).padStart(10)} ${String(afterAll).padStart(10)} ${String(droppedAll).padStart(6)}`)
console.log(`\n  정제 후 소재: ${Object.entries(topicAfter).sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(' · ') || '없음'}`)
console.log(`\n  ⚠️ 적합 편수가 줄어도 그 자체는 나쁜 신호가 아니다 — 배제된 것이 표제지·목차라면`)
console.log(`     줄어든 만큼 품질이 오른 것이다. 늘어났다면 정제가 대역을 넓힌 것이다.`)
