// scripts/csat/plos-raw-triage-export.mjs
//
// **PLOS 미절단 원본의 보관 여부 판정 자료를 뽑는다 — 읽기 전용.**
//
// ── 왜 따로 있나 ─────────────────────────────────────────────────────
// `gate-article-export.mjs` 는 `purpose:'raw'` 원본을 일부러 뺀다 — 「논문 전문은 판정해도
// 지문이 안 된다, 그건 발췌(`plos-extract`)가 할 일」이라서다. 그 결과 PLOS 원본 31,220편이
// **보관할지 말지 한 번도 판정받지 않았다**(실측 2026-09-24 · `csat_source_eligibility`).
//
// **전문을 싣는다**(`basis:'full'` · 2026-09-24 사용자 결정 「토큰·비용보다 원문 확보의 정확성」).
// 판정은 **전문 해시에 묶는다** — 적재기(`gate-mixed-import --input`)가 본문 변경을 이걸로 잡는다.
//
// 거쳐 온 길(같은 30편 대조): 앞 800어 판정은 전문이 보관한 17편 중 **12편을 버렸고**, 서론·고찰 판정은
// 버린 것은 0이지만 전문이 버린 5편을 보관했다. 정확성이 기준이므로 전문을 읽힌다.
// 판정자마다 기준이 흔들린다(서론·고찰 800편에서 청크별 보관 75~99%) — 일부 청크를 두 판정자가
// 따로 읽고 `gate-reviews-agreement.mjs` 로 일치도를 잰다(docs/source-check/criteria.md §9).
//
// **순서**: V-Level 낮은 것부터(발췌 수율 V5 46% · V6 20% · V7 2% — yield-funnel-20260924). 순서일 뿐
// 버리지 않는다 — 길이·어휘·V-Level 로 원문을 제외하지 않는다(SOURCE_INTAKE_DESIGN).
//
// ⚠️ 이 판정은 `gate.retain` 에만 들어간다(`kind:"retain"`) — **보관 여부**다. 게시 적격은 발췌본의 판정이 연다.
// 기준: docs/source-check/criteria.md · 절차: scripts/csat/plos-raw-triage-brief.md.
//
// 재실행 안전: 읽기만 한다. 이미 보관 판정(`gate.retain`)이나 전문 내용 판정(`gate.verdict`)이 있는 원본과
//   이미 어떤 청크에 들어간 원본은 건너뛰고, 청크 번호는 비어 있는 가장 작은 번호를 쓴다.
//
// 실행:
//   node --tls-max-v1.2 scripts/csat/plos-raw-triage-export.mjs                 # 예행 — 몇 편인지만
//   node --tls-max-v1.2 scripts/csat/plos-raw-triage-export.mjs --write --max 10

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

import { CRITERIA_VERSION } from './gate-rules.mjs'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const WRITE = process.argv.includes('--write')
// 전문 20편 ≈ 10만 어 — 판정자 하나가 끝까지 읽을 수 있는 양(전문 30편에 약 39만 토큰 · 2026-09-24 실측).
const PER = Math.min(100, Number(arg('per', 20)))
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
    .select('article_id,wc:input->>wordCount,items:input->>hasItems,vl:input->>articleVLevel')
    .eq('source', 'plos')
    .eq('input->>gatePurpose', 'raw')
    .is('input->>gateVerdict', null)
    .gt('article_id', cursor)
    .order('article_id')
    .limit(1000)
  if (error) throw new Error(`후보 조회 — ${error.message}`)
  if (!data.length) break
  for (const r of data) {
    candidates.push({ id: r.article_id, words: Number(r.wc) || null, hasItems: r.items === 'true', v: r.vl == null ? null : Number(r.vl) })
  }
  cursor = data[data.length - 1].article_id
  process.stdout.write(`\r  후보 ${candidates.length.toLocaleString()}편`)
}
process.stdout.write('\n')
// 수율 높은 것부터 — V-Level 오름차순(모름은 맨 뒤), 같으면 id(재실행해도 같은 순서).
candidates.sort((a, b) => (a.v ?? 99) - (b.v ?? 99) || a.id.localeCompare(b.id))

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
// `--v N` — 그 학년만(2026-09-25 · 회차 3 층화 표본). 순서가 V 오름차순이라 지정 없이 --max 로 자르면
//   표본이 전부 V5 가 된다. 버리는 것이 아니라 **이번에 뽑을 범위**만 좁힌다.
const V_ONLY = arg('v', '')
const pending = candidates.filter((c) => !already.has(c.id) && (!V_ONLY || c.v === Number(V_ONLY)))
const totalWords = pending.reduce((n, c) => n + (c.words ?? 0), 0)
const byV = {}
for (const c of pending) byV[`V${c.v ?? '?'}`] = (byV[`V${c.v ?? '?'}`] ?? 0) + 1
console.log(`  이미 청크에 ${already.size.toLocaleString()}편 · 남은 후보 **${pending.length.toLocaleString()}편** (전문 ${totalWords.toLocaleString()}어 · 문항 붙은 것 ${pending.filter((c) => c.hasItems).length.toLocaleString()})`)
console.log(`  V-Level 순서 ${Object.entries(byV).map(([k, n]) => `${k} ${n.toLocaleString()}`).join(' · ')}`)

if (!WRITE) {
  console.log(`  청크 ${Math.ceil(pending.length / PER)}개가 만들어진다(청크당 ${PER}편). 실제로 만들려면 --write`)
  console.log('  ⚠️ 캐시(csat_source_eligibility)에서 후보를 고른다 — 새로 수확한 원본은 source-policy-refresh 뒤에 보인다')
  process.exit(0)
}

let next = 1
const freeChunk = () => {
  let file
  do {
    file = path.join(OUT, `chunk-${String(next).padStart(3, '0')}.json`)
    next += 1
  } while (fs.existsSync(file))
  return file
}

let made = 0
let skippedJudged = 0
let skippedStatus = 0
// ⚠️ 청크를 **정해진 편수까지 채운다**(2026-09-25). 예전에는 후보를 PER 편씩 잘라 그 안에서 판정된 것을 뺐다 —
//   캐시(csat_source_eligibility)가 낡으면 청크가 4~13편으로 쪼그라들었다(실측 v7b 두 묶음: 후보 240·280편 중
//   112·269편이 이미 판정). 판정자 한 명이 4편을 읽는 것은 낭비라, 빠진 만큼 다음 후보로 채운다.
let at = 0
while (at < pending.length) {
  if (MAX && made >= MAX) break
  const rows = []
  const meta = new Map()
  let live = 0
  while (live < PER && at < pending.length) {
    const slice = pending.slice(at, at + 10)
    at += slice.length
    const ids = slice.map((c) => c.id)
    const { data, error } = await db
      .from('library_articles')
      .select('id,title,source,status,updated_at,content,gate:csat_fit->gate')
      .in('id', ids)
    if (error || data.length !== ids.length) throw new Error(`본문 조회 — ${error?.message ?? `${data.length}/${ids.length}`}`)
    for (const c of slice) meta.set(c.id, { ...c, k: meta.size })
    for (const r of data) {
      const judged = r.gate?.retain?.retention || r.gate?.retain?.verdict || r.gate?.verdict
      if (!judged && ['ready', 'published'].includes(r.status) && live < PER) { rows.push(r); live += 1 }
      else if (judged) skippedJudged += 1
      else if (!['ready', 'published'].includes(r.status)) skippedStatus += 1
    }
  }
  const items = []
  for (const r of rows.sort((a, b) => meta.get(a.id).k - meta.get(b.id).k)) {
    // 캐시가 낡았을 수 있다 — 판정 여부와 상태는 원본 행에서 다시 본다.
    if (r.gate?.retain?.retention || r.gate?.retain?.verdict || r.gate?.verdict) { skippedJudged += 1; continue }
    if (!['ready', 'published'].includes(r.status)) { skippedStatus += 1; continue }
    const m = meta.get(r.id)
    items.push({
      id: r.id,
      title: r.title,
      source: r.source,
      source_updated_at: r.updated_at,
      body_sha256: crypto.createHash('sha256').update(r.content ?? '').digest('hex'),
      kind: 'retain',
      criteria_version: CRITERIA_VERSION,
      basis: 'full',
      v_level: m.v,
      words: m.words,
      has_items: m.hasItems,
      content: r.content ?? '',
    })
  }
  if (!items.length) continue
  const file = freeChunk()
  fs.writeFileSync(file, `${JSON.stringify(items, null, 1)}\n`, { flag: 'wx' })
  console.log(`  ${path.relative(process.cwd(), file)} — ${items.length}편`)
  made += 1
}
console.log(`\n  청크 ${made}개 · 건너뜀: 이미 판정 ${skippedJudged} · 상태(ready/published 아님) ${skippedStatus}`)
console.log('  각 청크를 판정해 같은 이름 + .out.json 으로 저장 → gate-reviews-verify → gate-mixed-import.mjs --input <out> (예행) → --commit')
