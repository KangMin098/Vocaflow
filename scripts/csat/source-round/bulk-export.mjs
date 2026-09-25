// scripts/csat/source-round/bulk-export.mjs
//
// 대량 보관 판정 청크 — 현황판 ②「판정 전」과 같은 조건(gate.retain 도 gate.verdict 도 없는 원본)만 뽑는다.
// 소스별로 잘라 chunk-<source>-NN.json. 이미 있는 청크는 건너뛴다(재실행 안전).
// 실행: node --tls-max-v1.2 scripts/csat/source-round/bulk-export.mjs --round 5 [--write] [--exclude plos]
//       [--sources wikinews,gdl] [--max 1000]
//   --sources — 두 회차 연속 통과한 원천만 대량 판정한다(criteria.md §10). 주면 --exclude 는 무시한다.
//   --max     — 원천당 상한. 큰 원천(wikinews 1.9만)은 한 번에 다 뽑지 않고 나눠 돈다 — 다시 돌리면
//               이미 판정된(gate.retain) 것이 빠지므로 다음 몫이 나온다. 고르기는 id 순서다.

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

import { CRITERIA_VERSION, derivativeKind } from '../gate-rules.mjs'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const ROUND = Number(arg('round', 0))
if (!Number.isInteger(ROUND) || ROUND < 1) throw new Error('--round <n>')
const EXCLUDE = new Set(arg('exclude', 'plos').split(','))
const ONLY = arg('sources', '') ? new Set(arg('sources', '').split(',')) : null
const MAX = Number(arg('max', 0))
const WRITE = process.argv.includes('--write')
const OUT = path.resolve(`scripts/csat/source-round/round-${ROUND}`)
// 논문 전문은 길다 — 청크 크기를 줄인다.
const SIZE = { europe_pmc: 12, elife: 12, frontiers: 15, econstor: 8, scielo: 10, olh: 8, openalex: 8 }
const DEFAULT_SIZE = 25

const { createScriptClient } = await import('../../lib/supabase-client.mjs')
const db = createScriptClient()

const bySource = new Map()
let cursor = '00000000-0000-0000-0000-000000000000'
for (;;) {
  const { data, error } = await db
    .from('library_articles')
    .select('id,source,source_id,feed_id,derived_from:csat_fit->derived_from,rv:csat_fit->gate->retain,gv:csat_fit->gate->>verdict')
    .gt('id', cursor).order('id').limit(1000)
  if (error) throw new Error(error.message)
  if (!data.length) break
  for (const r of data) {
    if ((ONLY ? !ONLY.has(r.source) : EXCLUDE.has(r.source)) || r.rv || r.gv || derivativeKind(r)) continue
    if (MAX && (bySource.get(r.source)?.length ?? 0) >= MAX) continue
    if (!bySource.has(r.source)) bySource.set(r.source, [])
    bySource.get(r.source).push(r.id)
  }
  cursor = data[data.length - 1].id
}
let total = 0
for (const [s, ids] of [...bySource].sort()) { console.log(`  ${s.padEnd(20)} ${ids.length}`); total += ids.length }
console.log(`  합계 ${total}`)
if (!WRITE) process.exit(0)

fs.mkdirSync(OUT, { recursive: true })
let made = 0
for (const [source, ids] of bySource) {
  const size = SIZE[source] ?? DEFAULT_SIZE
  for (let c = 0; c * size < ids.length; c++) {
    const file = path.join(OUT, `chunk-${source}-${String(c + 1).padStart(2, '0')}.json`)
    if (fs.existsSync(file)) continue
    const pick = ids.slice(c * size, (c + 1) * size)
    const rows = []
    for (let i = 0; i < pick.length; i += 10) {
      const { data, error } = await db
        .from('library_articles')
        .select('id,title,source,status,feed_id,updated_at,content,word_count,article_v_level,cefr_level,license,license_class,published_at,audio_url,rights:csat_fit->rights')
        .in('id', pick.slice(i, i + 10))
      if (error) throw new Error(error.message)
      rows.push(...data)
    }
    const rank = new Map(pick.map((id, i) => [id, i]))
    const items = rows.sort((x, y) => rank.get(x.id) - rank.get(y.id)).map((r) => ({
      id: r.id, title: r.title, source: r.source, feed_id: r.feed_id,
      source_updated_at: r.updated_at,
      body_sha256: crypto.createHash('sha256').update(r.content ?? '').digest('hex'),
      kind: 'retain', basis: 'full', criteria_version: CRITERIA_VERSION, round: ROUND,
      hints: {
        status: r.status, words: r.word_count, v_level: r.article_v_level, cefr: r.cefr_level,
        has_audio: !!r.audio_url, published_at: r.published_at,
        rights: r.rights ?? { license: r.license, class: r.license_class, evidence: 'unverified' },
      },
      content: r.content ?? '',
    }))
    fs.writeFileSync(file, `${JSON.stringify(items, null, 1)}\n`, { flag: 'wx' })
    made++
  }
}
console.log(`  청크 ${made}개 → ${path.relative(process.cwd(), OUT)}`)
