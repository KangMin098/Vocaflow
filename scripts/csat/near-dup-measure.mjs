// scripts/csat/near-dup-measure.mjs
//
// **보관 판정 전 근사 중복이 얼마나 되나 — 측정만 한다(읽기 전용 · LLM 0).**
//
// 판정 비용 = 판정할 글 수 × 글당 단가 × 재판정 횟수. 이 스크립트는 첫 항을 얼마나 줄일 수 있는지 잰다.
// 같은 글의 판본·재게재본(VOA·The Conversation 재배포, 같은 논문이 PLOS 와 Europe PMC 에 둘 다 있는 경우 등)이
// 원천 안·원천 사이에 몇 편인지, 그리고 **이미 판정된 중복 쌍의 보관 판정이 서로 같은지**(판정자 흔들림을
// 공짜로 재는 표본)를 낸다. DB 에 아무것도 쓰지 않는다 — 결정은 이 측정을 본 뒤에 한다(AGENTS ④ 측정→기록→결정).
//
// 대상: 파생물(발췌·도입부·개작, `gate-rules.derivativeKind`)을 뺀 **원천** 전부. 상태는 가리지 않는다.
// 방법: `near-dup.mjs` — 낱말 5개 shingle · MinHash 128 · LSH 32×4. 낱말 30개 미만은 비교하지 않는다(따로 센다).
//
// 부하: 본문이 약 1.8GB 다(PLOS 논문이 대부분). 요청은 한 번에 하나, 쪽마다 `--page`(기본 100)행 —
// 무료 등급 PostgREST 포화 사례는 `scripts/lib/supabase-client.mjs` 머리말. 서명은 `--cache` 에 남겨
// 두 번째 실행부터는 DB 를 다시 훑지 않는다(재실행 안전 · `--refresh` 로 다시 훑기).
//
// 실행:
//   node --tls-max-v1.2 scripts/csat/near-dup-measure.mjs --cache /tmp/near-dup.ndjson
//   node --tls-max-v1.2 scripts/csat/near-dup-measure.mjs --cache /tmp/near-dup.ndjson --out docs/reports/near-dup-20260926.json
//     [--min 0.5] [--sources voa,wikinews] [--page 100] [--refresh]

import fs from 'node:fs'
import path from 'node:path'

import { derivativeKind, retainValueOf } from './gate-rules.mjs'
import { words, shingles, signature, nearPairs, clusters, PERMS } from './near-dup.mjs'

// 로컬은 apps/web/.env.local, 클라우드 세션은 환경변수 — 파일이 없어도 멈추지 않는다.
try {
  for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
} catch (e) {
  if (e.code !== 'ENOENT') throw e
}

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const CACHE = arg('cache', '')
if (!CACHE) throw new Error('--cache <path> — 서명 캐시 파일(저장소 밖 경로 권장)')
const OUT = arg('out', '')
const MIN = Number(arg('min', 0.5))
const PAGE = Number(arg('page', 100))
const ONLY = arg('sources', '') ? new Set(arg('sources', '').split(',')) : null
const REFRESH = process.argv.includes('--refresh')
const MIN_WORDS = 30

// ── 1. 서명 모으기 (캐시가 있으면 캐시에서) ─────────────────────────────
const docs = []
const skipped = { derived: 0, short: 0 }

if (!REFRESH && fs.existsSync(CACHE)) {
  for (const line of fs.readFileSync(CACHE, 'utf8').split('\n')) {
    if (!line) continue
    const r = JSON.parse(line)
    if (r.skip) { skipped[r.skip]++; continue }
    docs.push({ ...r, sig: Uint32Array.from(r.sig) })
  }
  console.log(`  캐시에서 ${docs.length.toLocaleString()}편 (파생 ${skipped.derived} · 짧음 ${skipped.short})`)
} else {
  const { createScriptClient } = await import('../lib/supabase-client.mjs')
  const db = createScriptClient()
  fs.mkdirSync(path.dirname(path.resolve(CACHE)), { recursive: true })
  const fd = fs.openSync(CACHE, 'w')
  let cursor = '00000000-0000-0000-0000-000000000000'
  let seen = 0
  const t0 = process.hrtime.bigint()
  for (;;) {
    const { data, error } = await db
      .from('library_articles')
      .select('id,source,source_id,feed_id,status,title,content,derived_from:csat_fit->derived_from,retain:csat_fit->gate->retain')
      .gt('id', cursor)
      .order('id')
      .limit(PAGE)
    if (error) throw new Error(`훑기 — ${error.message}`)
    if (!data.length) break
    let buf = ''
    for (const r of data) {
      seen++
      if (derivativeKind(r)) { skipped.derived++; buf += '{"skip":"derived"}\n'; continue }
      const ws = words(r.content)
      const sig = ws.length >= MIN_WORDS ? signature(shingles(ws)) : null
      if (!sig) { skipped.short++; buf += '{"skip":"short"}\n'; continue }
      const d = {
        id: r.id,
        source: r.source,
        status: r.status,
        title: String(r.title ?? '').slice(0, 100),
        words: ws.length,
        retain: retainValueOf(r.retain) ?? null,
        sig,
      }
      docs.push(d)
      buf += JSON.stringify({ ...d, sig: [...sig] }) + '\n'
    }
    fs.writeSync(fd, buf)
    cursor = data[data.length - 1].id
    const sec = Number(process.hrtime.bigint() - t0) / 1e9
    process.stdout.write(`\r  훑음 ${seen.toLocaleString()} · 서명 ${docs.length.toLocaleString()} · ${Math.round(sec)}초`)
  }
  fs.closeSync(fd)
  process.stdout.write('\n')
}

// ── 2. 후보 쌍 → 묶음 ──────────────────────────────────────────────────
const pool = ONLY ? docs.filter((d) => ONLY.has(d.source)) : docs
const { pairs, crowded } = nearPairs(pool, { min: MIN })
const groups = clusters(pool.length, pairs)

// 묶음마다 하나만 판정하면 되므로 줄어드는 편수 = Σ(묶음 크기 − 1).
const removable = groups.reduce((s, g) => s + g.length - 1, 0)

const bySource = {}
for (const d of pool) {
  const s = (bySource[d.source] ??= { docs: 0, inGroups: 0, removable: 0, crossSource: 0 })
  s.docs++
}
const bucket = (j) => (j >= 0.9 ? '0.9+' : j >= 0.8 ? '0.8-0.9' : j >= 0.7 ? '0.7-0.8' : j >= 0.6 ? '0.6-0.7' : '0.5-0.6')
const jaccardHist = {}
for (const p of pairs) jaccardHist[bucket(p.jaccard)] = (jaccardHist[bucket(p.jaccard)] ?? 0) + 1

let crossGroups = 0
const verdictCheck = { groupsWithTwoJudged: 0, agree: 0, disagree: 0, examples: [] }
const sizeHist = {}
for (const g of groups) {
  const members = g.map((i) => pool[i])
  sizeHist[g.length > 5 ? '6+' : g.length] = (sizeHist[g.length > 5 ? '6+' : g.length] ?? 0) + 1
  const srcs = new Set(members.map((m) => m.source))
  if (srcs.size > 1) crossGroups++
  // 원천별 몫: 묶음의 첫 편(가장 긴 글)을 남기고 나머지를 그 원천의 제거 가능 수로 센다.
  const keep = members.reduce((a, b) => (b.words > a.words ? b : a))
  for (const m of members) {
    bySource[m.source].inGroups++
    if (m !== keep) bySource[m.source].removable++
    if (srcs.size > 1) bySource[m.source].crossSource++
  }
  const judged = members.filter((m) => m.retain)
  if (judged.length >= 2) {
    verdictCheck.groupsWithTwoJudged++
    const vs = new Set(judged.map((m) => m.retain))
    if (vs.size === 1) verdictCheck.agree++
    else {
      verdictCheck.disagree++
      if (verdictCheck.examples.length < 30) {
        verdictCheck.examples.push(judged.map((m) => ({ id: m.id, source: m.source, retain: m.retain, title: m.title })))
      }
    }
  }
}

// 눈으로 볼 표본 — 자카드 구간마다 최대 8쌍(자동 분류는 표본을 눈으로 본다).
const samples = {}
for (const p of pairs) {
  const k = bucket(p.jaccard)
  samples[k] ??= []
  if (samples[k].length < 8) {
    const a = pool[p.a]
    const b = pool[p.b]
    samples[k].push({
      jaccard: p.jaccard,
      a: { id: a.id, source: a.source, words: a.words, title: a.title },
      b: { id: b.id, source: b.source, words: b.words, title: b.title },
    })
  }
}

const result = {
  measured_at: new Date().toISOString(),
  method: { shingle: 5, perms: PERMS, bands: 32, rows: 4, min_jaccard: MIN, min_words: MIN_WORDS, sources: ONLY ? [...ONLY] : 'all' },
  skipped,
  docs: pool.length,
  pairs: pairs.length,
  crowded_buckets: crowded,
  groups: groups.length,
  groups_cross_source: crossGroups,
  docs_in_groups: groups.reduce((s, g) => s + g.length, 0),
  removable,
  removable_pct: pool.length ? Number(((removable / pool.length) * 100).toFixed(2)) : 0,
  group_size_hist: sizeHist,
  jaccard_hist: jaccardHist,
  verdict_check: verdictCheck,
  by_source: Object.fromEntries(
    Object.entries(bySource)
      .sort((x, y) => y[1].removable - x[1].removable)
      .map(([k, v]) => [k, { ...v, removable_pct: Number(((v.removable / v.docs) * 100).toFixed(2)) }])
  ),
  samples,
}

console.log(`  원천 ${result.docs.toLocaleString()}편 · 쌍 ${result.pairs} · 묶음 ${result.groups}(원천 사이 ${crossGroups})`)
console.log(`  판정에서 뺄 수 있는 편수 ${removable.toLocaleString()} (${result.removable_pct}%)`)
console.log(`  이미 판정된 중복 묶음 ${verdictCheck.groupsWithTwoJudged} — 같음 ${verdictCheck.agree} · 다름 ${verdictCheck.disagree}`)
if (crowded) console.log(`  ⚠️ 한 띠 칸에 200편 넘게 몰린 칸 ${crowded}개 — 상용구 본문, 쌍을 만들지 않았다`)
if (OUT) {
  fs.writeFileSync(path.resolve(OUT), JSON.stringify(result, null, 2) + '\n')
  console.log(`  → ${OUT}`)
}
