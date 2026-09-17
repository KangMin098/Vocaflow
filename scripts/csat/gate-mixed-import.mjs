// scripts/csat/gate-mixed-import.mjs
//
// **L3 조각 판정을 적용한다. 기본은 예행 — `--commit` 이 있어야 쓴다.**
//
// L2 가 `mixed` 로 답한 책의 조각은 지금 전부 격리돼 있다. 여기서 하는 일은
// **잘못 묶여 내려간 것을 되찾는 것**이고, 되찾지 못한 것은 격리에 그대로 남는다.
//
// ⚠️ `gate-import.mjs` 가 나중에 다시 돌면 책 판정(`mixed`)을 보고 이 결과를 **덮는다.**
//   그래서 조각 판정은 `gate.by = 'chunk-llm'` 으로 표시하고, `gate-import` 는 그 표시가
//   있는 행을 건드리지 않는다. 두 층이 같은 칸을 쓰면 마지막에 돈 쪽이 이긴다.
//
// 실행: node scripts/csat/gate-mixed-import.mjs [--commit] [--curl]

import fs from 'node:fs'
import path from 'node:path'

import { hardReject, purposeOf, decide, PURPOSE_RULE } from './gate-rules.mjs'
import { curlFetch } from './lib-curl-fetch.mjs'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const COMMIT = process.argv.includes('--commit')
const DRAIN = path.resolve('scripts/csat/gate-mixed')

const judged = new Map()
let files = 0
// ⚠️ **빈 판정을 조용히 건너뛰고 있었다** (감사 2026-09-16). 건너뛴 것이 안 찍히면 다음 export 가
//   그 조각을 어떻게 세는지와 무관하게 **사람은 구멍이 있는 줄 모른다** — CLAUDE.md 가 「건너뛴 수를
//   반드시 출력한다」고 요구하는 이유다.
//   판정 값이 낯선 것(오타 · 새 값)은 **건너뛰지 않는다** — `decide()` 가 그런 값을 차단으로
//   적용하도록 이미 짜여 있고(`blockedBy: verdict:<값>`), 건너뛰면 그 기록이 사라진다. 경고만 한다.
const KNOWN_VERDICTS = new Set(['use', 'narrative', 'reject'])
let skippedEmpty = 0
const unknownVerdicts = {}
for (const f of fs.readdirSync(DRAIN).filter((f) => f.endsWith('.out.json')).sort()) {
  files += 1
  for (const it of JSON.parse(fs.readFileSync(path.join(DRAIN, f), 'utf8'))) {
    if (!it.verdict) {
      skippedEmpty += 1
      continue
    }
    if (!KNOWN_VERDICTS.has(it.verdict)) unknownVerdicts[it.verdict] = (unknownVerdicts[it.verdict] ?? 0) + 1
    judged.set(it.id, { verdict: it.verdict, genre: it.genre ?? '', why: it.why ?? '' })
  }
}
console.log('L3 조각 판정 적용' + (COMMIT ? ' — **쓴다**' : ' — 예행'))
console.log(`  건너뜀 — 판정이 비어 있음 ${skippedEmpty}`)
for (const [v, n] of Object.entries(unknownVerdicts))
  console.log(`  ⚠ 낯선 판정 「${v}」 ${n} — decide() 가 차단(verdict:${v})으로 적용한다. 오타면 청크를 고친다`)
console.log('='.repeat(78))
console.log(`  판정 파일 ${files}개 · 조각 **${judged.size.toLocaleString()}편**\n`)
if (!judged.size) {
  console.error('  ❌ 판정이 없다. 먼저 gate-mixed-export.mjs 로 뽑고 채울 것.')
  process.exit(1)
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

const byVerdict = {}
const byBlock = {}
let seen = 0
let restored = 0
let wrote = 0
const ids = [...judged.keys()]
const NOW = new Date().toISOString()

for (let i = 0; i < ids.length; i += 40) {
  const batch = ids.slice(i, i + 40)
  const { data } = await retry(
    () => db.from('library_articles').select('id,content,status,status_message,feed_id,source,csat_fit').in('id', batch),
    '조회',
  )
  for (const row of data ?? []) {
    seen += 1
    const v = judged.get(row.id)
    byVerdict[v.verdict] = (byVerdict[v.verdict] ?? 0) + 1
    const purpose = purposeOf(row)
    const codes = hardReject(row.content)
    const { publishable, blockedBy } = decide({ purpose, verdict: v.verdict, genre: v.genre, codes })
    if (blockedBy) byBlock[blockedBy] = (byBlock[blockedBy] ?? 0) + 1
    if (publishable && row.status === 'archived') restored += 1
    if (!COMMIT) continue

    const gate = {
      v: 2,
      publishable,
      purpose,
      blockedBy,
      verdict: v.verdict,
      genre: v.genre,
      why: v.why,
      codes,
      // ⚠️ 이 표시가 `gate-import.mjs` 에게 "책 판정으로 덮지 말라" 고 말한다.
      by: 'chunk-llm',
      at: NOW,
    }
    const patch = { csat_fit: { ...(row.csat_fit ?? {}), gate } }
    if (publishable && row.status === 'archived' && String(row.status_message ?? '').startsWith('게시 게이트:')) {
      patch.status = 'queued'
      patch.status_message = null
    } else if (!publishable && row.status !== 'archived') {
      patch.status = 'archived'
      patch.status_message = `게시 게이트: ${PURPOSE_RULE[purpose]?.label ?? purpose} · ${blockedBy}`
    }
    await retry(() => db.from('library_articles').update(patch).eq('id', row.id), `쓰기 ${row.id}`)
    wrote += 1
  }
  process.stdout.write(`\r  ${seen.toLocaleString()}편 · 되살림 ${restored.toLocaleString()} · 쓴 것 ${wrote.toLocaleString()}`)
}

console.log(`\n\n  ${'판정'.padEnd(12)}${'조각'.padStart(8)}`)
console.log('  ' + '-'.repeat(34))
for (const [k, n] of Object.entries(byVerdict).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${k.padEnd(12)}${n.toLocaleString().padStart(8)}`)
}
console.log('  ' + '-'.repeat(34))
console.log(`\n  차단 사유:`)
for (const [k, n] of Object.entries(byBlock).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${k.padEnd(20)}${n.toLocaleString().padStart(7)}`)
}
console.log(`\n  **격리에서 되살릴 것 ${restored.toLocaleString()}편** · 쓴 것 ${wrote.toLocaleString()}`)
if (!COMMIT) console.log(`\n  예행이었다. 실제로 쓰려면 --commit`)
