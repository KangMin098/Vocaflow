// scripts/csat/gate-mixed-export.mjs
//
// **L3 — 책 단위로 못 가른 책의 조각을 하나씩 판정하러 뽑는다. 읽기 전용.**
//
// ── 왜 필요한가 ─────────────────────────────────────────────────────
// L2(책 단위)는 "같은 책의 조각은 장르가 같다" 는 가정 위에 서 있다. 판정자가 발췌 3개를
// 보고 서로 다르다고 답하면 `mixed` 인데, 그건 **가정이 깨진 책**이라는 뜻이다.
// 실측 2026-09-05: 49권 · 조각 **1,343편**. 지금은 전부 격리돼 있다 —
// 즉 이 작업은 위험을 줄이는 것이 아니라 **잘못 묶여 내려간 공급을 되찾는 것**이다.
//
// ⚠️ 그래서 기본값이 다르다. L2 는 "애매하면 버린다" 였고 여기도 그대로다 —
//   되찾지 못한 조각은 격리에 남을 뿐이고, 잘못 살린 조각은 학생에게 간다.
//
// 실행: node scripts/csat/gate-mixed-export.mjs [--per 60]
// 산출: scripts/csat/gate-mixed/chunk-NN.json

import fs from 'node:fs'
import path from 'node:path'

import { curlFetch } from './lib-curl-fetch.mjs'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const PER = Number(arg('per', 60))
const DRAIN = path.resolve('scripts/csat/gate-drain')
const OUT = path.resolve('scripts/csat/gate-mixed')

// ── mixed 로 판정된 책 목록 (로컬 파일에서 읽는다 — DB 왕복이 필요 없다) ──
const mixed = new Set()
for (const f of fs.readdirSync(DRAIN).filter((f) => f.endsWith('.out.json'))) {
  for (const it of JSON.parse(fs.readFileSync(path.join(DRAIN, f), 'utf8'))) {
    if (it.verdict === 'reject' && it.genre === 'mixed') mixed.add(it.book)
  }
}
console.log('L3 조각 판정 자료 export')
console.log('='.repeat(78))
console.log(`  mixed 책 **${mixed.size}권**\n`)
if (!mixed.size) {
  console.log('  판정할 것이 없다.')
  process.exit(0)
}

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
  ...(process.argv.includes('--curl') ? { global: { fetch: curlFetch } } : {}),
})
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
async function retry(fn, what, attempt = 0) {
  try {
    const r = await fn()
    if (r?.error) throw new Error(r.error.message)
    return r
  } catch (e) {
    if (attempt >= 4) throw new Error(`${what} — ${String(e.message).slice(0, 80)}`)
    await sleep(1500 * 2 ** attempt)
    return retry(fn, what, attempt + 1)
  }
}

// ── 해당 책의 조각을 모은다 ─────────────────────────────────────────
const rows = []
let cursor = '00000000-0000-0000-0000-000000000000'
let seen = 0
for (;;) {
  const { data } = await retry(
    () =>
      db
        .from('library_articles')
        .select('id,title,content')
        .eq('source', 'gutenberg')
        .gt('id', cursor)
        .order('id')
        .limit(400),
    '조회',
  )
  if (!data?.length) break
  cursor = data[data.length - 1].id
  seen += data.length
  for (const r of data) {
    const book = String(r.title ?? '').split(' — ')[0].trim()
    if (mixed.has(book)) rows.push({ id: r.id, book, content: r.content })
  }
  process.stdout.write(`\r  훑음 ${seen.toLocaleString()}편 · 해당 ${rows.length.toLocaleString()}`)
}
console.log(`\n  판정할 조각 **${rows.length.toLocaleString()}편**\n`)

fs.mkdirSync(OUT, { recursive: true })
// 이미 판정한 조각은 다시 안 뽑는다 — 재실행 안전.
const done = new Set()
for (const f of fs.readdirSync(OUT).filter((f) => f.endsWith('.out.json'))) {
  for (const it of JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'))) if (it.verdict) done.add(it.id)
}
const todo = rows.filter((r) => !done.has(r.id))
console.log(`  이미 판정 ${done.size} · 남은 ${todo.length}\n`)

const excerpt = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 900)
let n = 0
const existing = fs.readdirSync(OUT).filter((f) => /^chunk-\d+\.json$/.test(f)).length
for (let i = 0; i < todo.length; i += PER) {
  const file = path.join(OUT, `chunk-${String(existing + n + 1).padStart(2, '0')}.json`)
  fs.writeFileSync(
    file,
    JSON.stringify(
      todo.slice(i, i + PER).map((r) => ({ id: r.id, book: r.book, text: excerpt(r.content), verdict: '', genre: '', why: '' })),
      null,
      1,
    ),
  )
  console.log(`  ${path.relative(process.cwd(), file)} — ${Math.min(PER, todo.length - i)}편`)
  n += 1
}
console.log(`\n  청크 ${n}개. 각 청크를 판정해 같은 이름 + .out.json 으로 저장할 것.`)
