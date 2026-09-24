// scripts/csat/source-round-export.mjs
//
// **보관 판정 회차의 소스별 소량 배치를 뽑는다 — 읽기 전용.**
//
// 기준: docs/source-check/criteria.md §10(반복 루프). 회차마다 **소스당 20건**(사용자 결정 2026-09-24)을
// 무작위로 골라 전 건을 판정하고, 집계·표본·오판 분석으로 기준을 고친다. 대량 판정은 일치율이 안정된 뒤 승인을 받고 한다.
//
// 뽑는 것: 보관 판정(`gate.retain`)이 아직 없는 **원천**(책·장·문서) — 발췌본(`feed_id='plos-extract'`)은 원천이 아니라
// 파생이라 뺀다. 상태는 가리지 않는다(archived 도 원천이다 · 폐기 기록도 남긴다).
// 고르기: `sha256(round:id)` 순서의 앞 N건 — 회차가 같으면 같은 표본, 회차가 바뀌면 다른 표본(재실행 안전).
// 한 소스 = 한 청크(`chunk-<source>.json`). 열 청크마다 하나를 이중 판정 대상으로 표시한다(`double: true` → 두 번째 판정자
// 출력은 `chunk-<source>.b.out.json`) — 판정자 흔들림을 κ 로 잰다(criteria.md §9).
//
// ⚠️ 받는 것은 **이미 GET 해 둔 원문**이다. 새로 GET 하는 소량 배치는 수집기(`collect-daily --per-feed 20`)로 먼저 받는다.
//
// 실행:
//   node --tls-max-v1.2 scripts/csat/source-round-export.mjs --round 1                  # 예행 — 소스별 후보 수만
//   node --tls-max-v1.2 scripts/csat/source-round-export.mjs --round 1 --write [--per 20] [--sources voa,plos]

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

import { CRITERIA_VERSION, derivativeKind } from './gate-rules.mjs'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const ROUND = Number(arg('round', 0))
if (!Number.isInteger(ROUND) || ROUND < 1) throw new Error('--round <n> (1 이상)')
const PER = Number(arg('per', 20))
const WRITE = process.argv.includes('--write')
const ONLY = arg('sources', '') ? new Set(arg('sources', '').split(',')) : null
const OUT = path.resolve(`scripts/csat/source-round/round-${ROUND}`)

const { createScriptClient } = await import('../lib/supabase-client.mjs')
const db = createScriptClient()

// ── 훑기 — 메타만(본문 컬럼을 훑지 않는다) ─────────────────────────────
const bySource = new Map()
const derived = {}
let cursor = '00000000-0000-0000-0000-000000000000'
let seen = 0
for (;;) {
  const { data, error } = await db
    .from('library_articles')
    .select('id,source,source_id,feed_id,rv:csat_fit->gate->retain->>retention')
    .gt('id', cursor)
    .order('id')
    .limit(1000)
  if (error) throw new Error(`훑기 — ${error.message}`)
  if (!data.length) break
  for (const r of data) {
    seen++
    // 파생물(발췌·도입부·개작)은 원천이 아니다 — 원천 단위로 판정한다(gate-rules.derivativeKind · 2026-09-24).
    if (r.rv) continue
    const dk = derivativeKind(r)
    if (dk) { derived[r.source] = (derived[r.source] ?? 0) + 1; continue }
    if (ONLY && !ONLY.has(r.source)) continue
    if (!bySource.has(r.source)) bySource.set(r.source, [])
    bySource.get(r.source).push(r.id)
  }
  cursor = data[data.length - 1].id
  process.stdout.write(`\r  훑음 ${seen.toLocaleString()}`)
}
process.stdout.write('\n')

const order = (id) => crypto.createHash('sha256').update(`${ROUND}:${id}`).digest('hex')
const plan = [...bySource.entries()]
  .map(([source, ids]) => ({ source, pool: ids.length, pick: ids.sort((x, y) => order(x).localeCompare(order(y))).slice(0, PER) }))
  .sort((x, y) => x.source.localeCompare(y.source))
if (Object.keys(derived).length) console.log(`  파생물 제외: ${Object.entries(derived).map(([k, v]) => `${k} ${v}`).join(' · ')}`)
console.log(`  회차 ${ROUND} · 기준 v${CRITERIA_VERSION} · 소스 ${plan.length}곳 · 소스당 ${PER}건`)
for (const p of plan) console.log(`    ${p.source.padEnd(22)} 후보 ${String(p.pool).padStart(6)} → ${p.pick.length}`)
if (!WRITE) {
  console.log('  청크를 만들려면 --write')
  process.exit(0)
}

fs.mkdirSync(OUT, { recursive: true })
let made = 0
for (const [k, p] of plan.entries()) {
  const file = path.join(OUT, `chunk-${p.source}.json`)
  if (fs.existsSync(file)) {
    console.log(`  ${path.relative(process.cwd(), file)} — 이미 있다(건너뜀)`)
    continue
  }
  const rows = []
  for (let i = 0; i < p.pick.length; i += 10) {
    const ids = p.pick.slice(i, i + 10)
    const { data, error } = await db
      .from('library_articles')
      .select('id,title,source,status,feed_id,updated_at,content,word_count,article_v_level,cefr_level,license,license_class,author,published_at,source_url,audio_url,rights:csat_fit->rights')
      .in('id', ids)
    if (error || data.length !== ids.length) throw new Error(`본문 조회 — ${error?.message ?? `${data.length}/${ids.length}`}`)
    rows.push(...data)
  }
  const rank = new Map(p.pick.map((id, i) => [id, i]))
  const items = rows.sort((x, y) => rank.get(x.id) - rank.get(y.id)).map((r) => ({
    id: r.id,
    title: r.title,
    source: r.source,
    feed_id: r.feed_id,
    source_updated_at: r.updated_at,
    body_sha256: crypto.createHash('sha256').update(r.content ?? '').digest('hex'),
    kind: 'retain',
    basis: 'full',
    criteria_version: CRITERIA_VERSION,
    round: ROUND,
    // 등급 보조 — 판정자는 참고만 한다(criteria.md §3-3). 권리 태그는 판정에 반영하지 않는다(§3-4).
    hints: {
      status: r.status, words: r.word_count, v_level: r.article_v_level, cefr: r.cefr_level,
      has_audio: !!r.audio_url, published_at: r.published_at,
      rights: r.rights ?? { license: r.license, class: r.license_class, evidence: 'unverified' },
    },
    content: r.content ?? '',
  }))
  // 열 청크 중 하나(소스 이름 순서로 k % 10 === 0)는 두 번째 판정자가 따로 판정한다.
  const double = k % 10 === 0
  fs.writeFileSync(file, `${JSON.stringify(items, null, 1)}\n`, { flag: 'wx' })
  if (double) fs.writeFileSync(path.join(OUT, `chunk-${p.source}.double`), '두 번째 판정자 출력: chunk-<source>.b.out.json\n', { flag: 'wx' })
  console.log(`  ${path.relative(process.cwd(), file)} — ${items.length}건${double ? ' · 이중 판정' : ''}`)
  made++
}
console.log(`\n  청크 ${made}개 → 판정(criteria.md · csat-source-judge) → gate-reviews-verify → source-round-report --round ${ROUND}`)
