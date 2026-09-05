// scripts/csat/gate-import.mjs
//
// **게이트 판정을 조각에 적용한다. 기본은 예행(dry) — `--commit` 이 있어야 쓴다.**
//
// ── 무엇을 쓰는가 ───────────────────────────────────────────────────
// ① `csat_fit.gate` (jsonb 키 하나 추가 — 마이그레이션 불필요)
//    { v, publishable, verdict, genre, why, codes[], by, at }
// ② 게시 불가면 `status='archived'` + `status_message`
//
// ⚠️ **지우지 않는다.** `archived` 는 이미 있는 상태값이고 파이프라인이 이미 거른다.
//   되돌릴 수 있게 남기는 쪽을 골랐다 — 판정이 틀렸을 때 원문을 다시 못 구하기 때문이다.
//   진짜 DELETE 는 판정이 굳은 뒤 별도 결정으로 한다.
//
// ⚠️ **csat_fit 을 통째로 덮으면 안 된다.** 그 안에 대역 채점 결과(pass·topic)가 있고
//   덮으면 균형 사정권 계산이 통째로 날아간다. 읽어서 키 하나만 더한다.
//
// 재실행 안전: 같은 판정을 다시 써도 결과가 같다. 이미 같은 값이면 건너뛴다.
//
// 실행: node scripts/csat/gate-import.mjs [--commit]

import fs from 'node:fs'
import path from 'node:path'

import { hardReject } from './gate-rules.mjs'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const COMMIT = process.argv.includes('--commit')
const DRAIN = path.resolve('scripts/csat/gate-drain')

// ── 책 판정 읽기 ────────────────────────────────────────────────────
const book = new Map()
let files = 0
for (const f of fs.readdirSync(DRAIN).filter((f) => f.endsWith('.out.json')).sort()) {
  const arr = JSON.parse(fs.readFileSync(path.join(DRAIN, f), 'utf8'))
  files += 1
  for (const it of arr) {
    if (!it.verdict) continue
    book.set(it.book, { verdict: it.verdict, genre: it.genre ?? '', why: it.why ?? '' })
  }
}
console.log('게이트 적용' + (COMMIT ? ' — **쓴다**' : ' — 예행(쓰지 않는다)'))
console.log('='.repeat(78))
console.log(`  판정 파일 ${files}개 · 책 **${book.size}권**\n`)
if (!book.size) {
  console.error('  ❌ 판정이 없다. 먼저 gate-book-export.mjs 로 뽑고 채울 것.')
  process.exit(1)
}

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const tally = { total: 0, judged: 0, unjudged: 0, pub: 0, quarantine: 0, skipped: 0, wrote: 0 }
const byVerdict = {}
const byCode = {}
const NOW = new Date().toISOString()

let cursor = '00000000-0000-0000-0000-000000000000'
for (;;) {
  const { data, error } = await db
    .from('library_articles')
    .select('id,title,content,status,csat_fit')
    .eq('source', 'gutenberg')
    .gt('id', cursor)
    .order('id')
    .limit(300)
  if (error) {
    console.error('\n  ❌ 조회 실패:', error.message)
    process.exit(1)
  }
  if (!data?.length) break
  cursor = data[data.length - 1].id

  for (const row of data) {
    tally.total += 1
    const key = String(row.title ?? '').split(' — ')[0].trim() || '(무제)'
    const v = book.get(key)
    if (!v) {
      tally.unjudged += 1
      continue
    }
    tally.judged += 1
    byVerdict[v.verdict] = (byVerdict[v.verdict] ?? 0) + 1

    const codes = hardReject(row.content)
    for (const c of codes) byCode[c] = (byCode[c] ?? 0) + 1
    const publishable = v.verdict === 'use' && codes.length === 0
    if (publishable) tally.pub += 1
    else tally.quarantine += 1

    const gate = {
      v: 1,
      publishable,
      verdict: v.verdict,
      genre: v.genre,
      why: v.why,
      codes,
      by: 'book-llm+rule',
      at: NOW,
    }
    const prev = row.csat_fit?.gate
    // 재실행 안전 — 판정이 그대로면 쓰지 않는다(`at` 은 비교에서 뺀다).
    const same =
      prev &&
      prev.publishable === gate.publishable &&
      prev.verdict === gate.verdict &&
      prev.genre === gate.genre &&
      JSON.stringify(prev.codes ?? []) === JSON.stringify(codes)
    if (same) {
      tally.skipped += 1
      continue
    }
    if (!COMMIT) continue

    // ⚠️ 기존 csat_fit 을 읽어 키 하나만 더한다 — 통째로 덮으면 pass·topic 이 날아간다.
    const patch = { csat_fit: { ...(row.csat_fit ?? {}), gate } }
    if (!publishable && row.status !== 'archived') {
      patch.status = 'archived'
      patch.status_message = `게시 게이트: ${v.verdict}${v.genre ? '/' + v.genre : ''}${
        codes.length ? ' · ' + codes.join(',') : ''
      }`
    }
    const { error: uErr } = await db.from('library_articles').update(patch).eq('id', row.id)
    if (uErr) {
      console.error(`\n  ❌ 쓰기 실패 ${row.id}: ${uErr.message}`)
      process.exit(1)
    }
    tally.wrote += 1
  }
  process.stdout.write(`\r  훑음 ${tally.total.toLocaleString()}편 · 쓴 것 ${tally.wrote.toLocaleString()}`)
  if (data.length < 300) break
}

console.log(`\n\n  ${'판정'.padEnd(12)}${'조각'.padStart(9)}`)
console.log('  ' + '-'.repeat(40))
for (const [k, n] of Object.entries(byVerdict).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(12)}${n.toLocaleString().padStart(9)}`)
}
console.log('  ' + '-'.repeat(40))
console.log(`\n  기계 규칙 적중:`)
for (const [k, n] of Object.entries(byCode).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${k.padEnd(16)}${n.toLocaleString().padStart(8)}`)
}
console.log(
  `\n  훑음 ${tally.total.toLocaleString()} · 판정 있음 ${tally.judged.toLocaleString()}` +
    ` · 판정 없음 ${tally.unjudged.toLocaleString()}\n` +
    `  **게시 가능 ${tally.pub.toLocaleString()} · 격리 ${tally.quarantine.toLocaleString()}**` +
    ` · 이미 같음 ${tally.skipped.toLocaleString()} · 쓴 것 ${tally.wrote.toLocaleString()}`,
)
if (!COMMIT) console.log(`\n  예행이었다. 실제로 쓰려면 --commit`)
