// scripts/csat/gate-book-export.mjs
//
// **책 단위 장르 판정용 자료를 뽑는다 — 읽기 전용.**
//
// ── 왜 책 단위인가 ──────────────────────────────────────────────────
// Gutenberg 조각 28,015편을 하나씩 판정하는 것은 규모가 감당되지 않는다. 그런데
// **같은 책에서 나온 조각은 장르가 같다** — 전기는 끝까지 전기고, 교리서는 끝까지
// 교리서다. 책 793권을 판정하면 조각 28,015편이 따라온다. 판정 수가 35배 준다.
//
// ⚠️ 이 가정이 깨지는 경우가 있다: 논설과 서사가 섞인 여행기, 부록에 표가 붙은 교과서.
//   그래서 책마다 **서로 떨어진 위치의 발췌 3개**를 준다. 발췌끼리 장르가 다르면
//   판정자가 `mixed` 로 답하고, 그 책은 조각 단위 판정으로 넘어간다.
//
// 실행: node scripts/csat/gate-book-export.mjs [--per 45]
// 산출: scripts/csat/gate-drain/chunk-NN.json (재실행하면 이미 채운 것은 건너뛴다)

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const PER = Number(arg('per', 45))
const OUT = path.resolve('scripts/csat/gate-drain')

const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

console.log('책 단위 판정 자료 export')
console.log('='.repeat(78))

// ── 조각을 훑어 책별로 모은다 ────────────────────────────────────────
const books = new Map()
let cursor = '00000000-0000-0000-0000-000000000000'
let seen = 0
for (;;) {
  const { data, error } = await db
    .from('library_articles')
    .select('id,title,source_url,content')
    .eq('source', 'gutenberg')
    .gt('id', cursor)
    .order('id')
    .limit(500)
  if (error) {
    console.error('\n  ❌ 조회 실패:', error.message)
    process.exit(1)
  }
  if (!data?.length) break
  for (const r of data) {
    const key = String(r.title ?? '').split(' — ')[0].trim() || '(무제)'
    if (!books.has(key)) books.set(key, { book: key, url: r.source_url ?? null, rows: 0, pool: [] })
    const b = books.get(key)
    b.rows += 1
    // 조각마다 넣지 않고 앞·중간·뒤가 골고루 잡히도록 저수지 표본을 쓴다.
    if (b.pool.length < 24) b.pool.push(r.content)
    else {
      const j = Math.floor(Math.random() * b.rows)
      if (j < 24) b.pool[j] = r.content
    }
  }
  cursor = data[data.length - 1].id
  seen += data.length
  process.stdout.write(`\r  훑음 ${seen.toLocaleString()}편 · 책 ${books.size}권`)
  if (data.length < 500) break
}
console.log(`\n  책 **${books.size}권** · 조각 ${seen.toLocaleString()}편\n`)

const excerpt = (s) => String(s ?? '').replace(/\s+/g, ' ').trim().slice(0, 420)
const items = [...books.values()]
  .sort((a, b) => b.rows - a.rows)
  .map((b) => {
    const p = b.pool
    const pick = [p[0], p[Math.floor(p.length / 2)], p[p.length - 1]].filter(Boolean).map(excerpt)
    return { book: b.book, url: b.url, rows: b.rows, excerpts: [...new Set(pick)], verdict: '', genre: '', why: '' }
  })

fs.mkdirSync(OUT, { recursive: true })
// ⚠️ **이미 판정한 책은 다시 내보내지 않는다** — 재실행 안전. 몇 번 돌려도 결과가 같아야 한다.
const done = new Set()
for (const f of fs.readdirSync(OUT).filter((f) => f.endsWith('.out.json'))) {
  for (const it of JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'))) {
    if (it.verdict) done.add(it.book)
  }
}
const todo = items.filter((it) => !done.has(it.book))
console.log(`  이미 판정 ${done.size}권 · 남은 ${todo.length}권\n`)

let n = 0
const existing = fs.readdirSync(OUT).filter((f) => /^chunk-\d+\.json$/.test(f)).length
for (let i = 0; i < todo.length; i += PER) {
  const file = path.join(OUT, `chunk-${String(existing + n + 1).padStart(2, '0')}.json`)
  fs.writeFileSync(file, JSON.stringify(todo.slice(i, i + PER), null, 1))
  console.log(`  ${path.relative(process.cwd(), file)} — ${Math.min(PER, todo.length - i)}권`)
  n += 1
}
console.log(`\n  청크 ${n}개. 각 청크를 판정해 같은 이름 + .out.json 으로 저장할 것.`)
