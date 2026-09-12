// scripts/csat/trim-export.mjs
//
// **앞을 떼면 살아나는 조각을 뽑는다 — 읽기 전용.**
//
// ── 왜 필요한가 ─────────────────────────────────────────────────────
// L3 판정에서 `not-selfcontained` 로 내려간 조각이 278편이다. 그 코드는 "글이 나쁘다" 가
// 아니라 **"첫 문장이 지문 밖을 가리킨다"** 는 뜻이다. 판정자들이 하나같이 같은 말을 남겼다:
//
//   · Plutarch 습관화 논증 — "\`IV.\` 와 \`Then how is it…\` 만 떼면 최상급 빈칸 지문"
//   · Wells 철도 궤간 — "\`But there was a more obvious path…\` 가 앞 문단을 받는다"
//   · Byzantine 아치 — "\`the lateral wall arches **before us**\` 가 특정 건물을 가리킨다"
//
// 앞 한두 문장을 떼면 나머지는 그대로 선다. 지금은 그 278편이 전부 격리에 있다.
//
// ⚠️ **이건 되찾는 작업이다.** 못 되찾으면 격리에 남을 뿐이고, 잘못 되찾으면 학생에게 간다.
//   그래서 import 쪽에 **잘라내기만 허용하는 자물쇠**를 건다(trim-import 참조).
//
// 실행: node scripts/csat/trim-export.mjs [--per 40]
// 산출: scripts/csat/trim-drain/chunk-NN.json

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
const PER = Number(arg('per', 40))
const OUT = path.resolve('scripts/csat/trim-drain')

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

console.log('손질 대상 export — 앞을 떼면 살아나는 조각')
console.log('='.repeat(78))

const rows = []
let cursor = '00000000-0000-0000-0000-000000000000'
for (;;) {
  const { data } = await retry(
    () =>
      db
        .from('library_articles')
        .select('id,title,content,csat_fit')
        .eq('csat_fit->gate->>by', 'chunk-llm')
        .eq('csat_fit->gate->>genre', 'not-selfcontained')
        .eq('status', 'archived')
        .gt('id', cursor)
        .order('id')
        .limit(200),
    '조회',
  )
  if (!data?.length) break
  cursor = data[data.length - 1].id
  rows.push(...data)
  process.stdout.write(`\r  ${rows.length}편`)
}
console.log(`\n  손질 대상 **${rows.length}편**\n`)
if (!rows.length) process.exit(0)

fs.mkdirSync(OUT, { recursive: true })
// 이미 손질한 것은 다시 안 뽑는다 — 재실행 안전.
const done = new Set()
for (const f of fs.readdirSync(OUT).filter((f) => f.endsWith('.out.json'))) {
  for (const it of JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'))) if (it.trimmed !== '') done.add(it.id)
}
const todo = rows.filter((r) => !done.has(r.id))
console.log(`  이미 손질 ${done.size} · 남은 ${todo.length}\n`)

let n = 0
const existing = fs.readdirSync(OUT).filter((f) => /^chunk-\d+\.json$/.test(f)).length
for (let i = 0; i < todo.length; i += PER) {
  const file = path.join(OUT, `chunk-${String(existing + n + 1).padStart(2, '0')}.json`)
  fs.writeFileSync(
    file,
    JSON.stringify(
      todo.slice(i, i + PER).map((r) => ({
        id: r.id,
        book: String(r.title ?? '').split(' — ')[0].trim(),
        why: r.csat_fit?.gate?.why ?? '',
        text: String(r.content ?? ''),
        // 판정자가 채울 칸. **원문에서 잘라낸 조각이어야 한다** — 한 글자도 못 고친다.
        trimmed: '',
        note: '',
      })),
      null,
      1,
    ),
  )
  console.log(`  ${path.relative(process.cwd(), file)} — ${Math.min(PER, todo.length - i)}편`)
  n += 1
}
console.log(`\n  청크 ${n}개. 각 청크를 손질해 같은 이름 + .out.json 으로 저장할 것.`)
