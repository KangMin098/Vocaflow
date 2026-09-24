// scripts/csat/plos-raw-triage-export.mjs
//
// **PLOS 미절단 원본의 보관 여부 판정 자료를 뽑는다 — 읽기 전용.**
//
// ── 왜 따로 있나 ─────────────────────────────────────────────────────
// `gate-article-export.mjs` 는 `purpose:'raw'` 원본을 일부러 뺀다 — 「논문 전문은 판정해도
// 지문이 안 된다, 그건 발췌(`plos-extract`)가 할 일」이라서다. 그 결과 PLOS 원본 31,220편이
// **보관할지 말지 한 번도 판정받지 않았다**(실측 2026-09-24 · `csat_source_eligibility`).
//
// 전문을 읽히면 1억 5천만 어(편당 평균 4,811어)다. **서론·고찰 절만** 싣는다(`basis:'sections'`,
// 전문의 약 43% · `lib-plos-sections.mjs`). 판정은 여전히 **전문 해시에 묶는다** — 적재기
// (`gate-mixed-import --input`)가 본문 변경을 이걸로 잡는다.
//
// 검증(2026-09-24 · 같은 30편을 세 방식으로): 앞 800어만 읽힌 판정은 전문 판정이 보관한 17편 중
// **12편을 버렸다**. 서론·고찰 판정은 17편을 전부 보관했고, 전문이 경계선에서 버린 5편을 더 보관했다
// (보관 쪽 오류 — 발췌본이 전문 판정을 한 번 더 받으므로 거기서 걸러진다. 버린 쪽 오류는 되돌릴 길이 없다).
//
// ⚠️ 이 판정은 `gate.retain` 에만 들어간다 — **보관 여부**다. 게시 적격은 발췌본의 전문 판정이 연다.
// 판정자 지시: `scripts/csat/plos-raw-triage-brief.md`.
//
// 재실행 안전: 읽기만 한다. 이미 판정된 원본(`csat_fit.gate.verdict` 있음)과 이미 어떤
//   청크에 들어간 원본은 건너뛰고, 청크 번호는 비어 있는 가장 작은 번호를 쓴다.
//
// 실행:
//   node --tls-max-v1.2 scripts/csat/plos-raw-triage-export.mjs                # 예행 — 몇 편인지만
//   node --tls-max-v1.2 scripts/csat/plos-raw-triage-export.mjs --write --max 3
//   node --tls-max-v1.2 scripts/csat/plos-raw-triage-export.mjs --write --per 100

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

import { plosSections } from './lib-plos-sections.mjs'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const WRITE = process.argv.includes('--write')
const PER = Math.min(100, Number(arg('per', 100))) // 적재기 `--input` 한 번의 상한이 100이다
const MAX = Number(arg('max', 0)) // 0 = 제한 없음
const OUT = path.resolve(arg('out', 'scripts/csat/plos-raw-triage'))

const { createScriptClient } = await import('../lib/supabase-client.mjs')
const db = createScriptClient()

console.log('PLOS 원본 보관 판정 자료 export' + (WRITE ? ' — **쓴다**' : ' — 예행'))
console.log('='.repeat(78))

// ── 후보: 적격 캐시에서 메타로만 고른다(본문 컬럼을 훑지 않는다) ─────
const candidates = []
let cursor = '00000000-0000-0000-0000-000000000000'
for (;;) {
  const { data, error } = await db
    .from('csat_source_eligibility')
    .select('article_id,wc:input->>wordCount,items:input->>hasItems')
    .eq('source', 'plos')
    .eq('input->>gatePurpose', 'raw')
    .is('input->>gateVerdict', null)
    .gt('article_id', cursor)
    .order('article_id')
    .limit(1000)
  if (error) throw new Error(`후보 조회 — ${error.message}`)
  if (!data.length) break
  for (const r of data) candidates.push({ id: r.article_id, words: Number(r.wc) || null, hasItems: r.items === 'true' })
  cursor = data[data.length - 1].article_id
  process.stdout.write(`\r  후보 ${candidates.length.toLocaleString()}편`)
}
process.stdout.write('\n')

// ── 이미 청크에 들어간 것은 뺀다 ─────────────────────────────────────
fs.mkdirSync(OUT, { recursive: true })
const already = new Set()
for (const f of fs.readdirSync(OUT)) {
  if (!/^chunk-\d+\.json$/.test(f)) continue
  try {
    for (const it of JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'))) already.add(it.id)
  } catch {
    // 반쯤 쓰인 파일은 이번엔 못 읽는다 — 덮지 않는 쪽이 안전하다.
  }
}
const pending = candidates.filter((c) => !already.has(c.id))
const totalWords = pending.reduce((n, c) => n + (c.words ?? 0), 0)
console.log(`  이미 청크에 ${already.size.toLocaleString()}편 · 남은 후보 **${pending.length.toLocaleString()}편** (전문 ${totalWords.toLocaleString()}어 · 문항 붙은 것 ${pending.filter((c) => c.hasItems).length.toLocaleString()})`)

if (!WRITE) {
  console.log(`  청크 ${Math.ceil(pending.length / PER)}개가 만들어진다(청크당 ${PER}편). 실제로 만들려면 --write`)
  console.log('  ⚠️ 캐시(csat_source_eligibility)에서 후보를 고른다 — 새로 수확한 원본은 source-policy-refresh 뒤에 보인다')
  process.exit(0)
}

let next = 1
const freeChunk = () => {
  let file
  do {
    file = path.join(OUT, `chunk-${String(next).padStart(2, '0')}.json`)
    next += 1
  } while (fs.existsSync(file))
  return file
}

let made = 0
let skippedJudged = 0
let skippedStatus = 0
for (let i = 0; i < pending.length; i += PER) {
  if (MAX && made >= MAX) break
  const slice = pending.slice(i, i + PER)
  const rows = []
  for (let j = 0; j < slice.length; j += 25) {
    const ids = slice.slice(j, j + 25).map((c) => c.id)
    const { data, error } = await db
      .from('library_articles')
      .select('id,title,source,status,updated_at,content,gate:csat_fit->gate')
      .in('id', ids)
    if (error || data.length !== ids.length) throw new Error(`본문 조회 — ${error?.message ?? `${data.length}/${ids.length}`}`)
    rows.push(...data)
  }
  const meta = new Map(slice.map((c) => [c.id, c]))
  const items = []
  for (const r of rows.sort((a, b) => a.id.localeCompare(b.id))) {
    // 캐시가 낡았을 수 있다 — 판정 여부와 상태는 원본 행에서 다시 본다.
    // 보관 판정(`retain`) 또는 옛 전문 판정(`verdict`)이 있으면 이미 가른 것이다.
    if (r.gate?.retain?.verdict || r.gate?.verdict) { skippedJudged += 1; continue }
    if (!['ready', 'published'].includes(r.status)) { skippedStatus += 1; continue }
    items.push({
      id: r.id,
      title: r.title,
      source: r.source,
      source_updated_at: r.updated_at,
      body_sha256: crypto.createHash('sha256').update(r.content ?? '').digest('hex'),
      basis: 'sections',
      words: meta.get(r.id)?.words ?? null,
      has_items: meta.get(r.id)?.hasItems ?? false,
      ...(({ text, found }) => ({ sections_found: found, sections: text }))(plosSections(r.content)),
    })
  }
  if (!items.length) continue
  const file = freeChunk()
  fs.writeFileSync(file, `${JSON.stringify(items, null, 1)}\n`, { flag: 'wx' })
  console.log(`  ${path.relative(process.cwd(), file)} — ${items.length}편`)
  made += 1
}
console.log(`\n  청크 ${made}개 · 건너뜀: 이미 판정 ${skippedJudged} · 상태(ready/published 아님) ${skippedStatus}`)
console.log('  각 청크를 판정해 같은 이름 + .out.json 으로 저장 → gate-mixed-import.mjs --input <out> (예행) → --commit')
