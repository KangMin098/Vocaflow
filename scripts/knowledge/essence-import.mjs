// scripts/knowledge/essence-import.mjs
// 영역별 본질 지도(essence-map.json)를 학습 원리 등록부에 「검토 중」 으로 적재한다.
//   L1 본질 4 · L2 원리 새 6(기존 7 은 slug 로 재사용) · L3 방법론 18 → implements 연결
//   L4 공부법(yt-*) 118 → L3 → L2 → L1
// 기본은 미리보기(파일 검증 + DB 대조). --commit 일 때만 쓴다.
// 재실행 안전: 항목은 slug 가 없을 때만 넣고(있으면 건너뜀 — 사람이 고친 문장을 덮지 않는다),
// 연결은 (from,to,kind) 유일 제약에 ignoreDuplicates 로 넣는다. 지운 것은 없다.
// 사용(.env.local 이 있는 저장소 루트에서): node --tls-max-v1.2 <이 파일> [--commit]
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createScriptClient } from '../lib/supabase-client.mjs'

const ENV_FILE = path.resolve('apps/web/.env.local')
if (fs.existsSync(ENV_FILE)) {
  for (const line of fs.readFileSync(ENV_FILE, 'utf8').split(/\r?\n/)) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
  }
}

const COMMIT = process.argv.includes('--commit')
const ACTOR = 'seed:essence-map'
const HERE = path.dirname(fileURLToPath(import.meta.url))
const MAP = JSON.parse(fs.readFileSync(path.join(HERE, 'essence-map.json'), 'utf8'))

// ── 파일 자체 검증 ────────────────────────────────────────────────
const fail = (msg) => { throw new Error(msg) }
const essenceSlugs = new Set(MAP.essence.map((e) => e.slug))
const newPrinciple = new Set(MAP.principles_new.map((p) => p.slug))
const oldPrinciple = new Set(MAP.principles_existing.map((p) => p.slug))
const allPrinciple = new Set([...newPrinciple, ...oldPrinciple])
const methodSlugs = new Set(MAP.methods.map((m) => m.slug))

for (const p of [...MAP.principles_new, ...MAP.principles_existing]) {
  if (!essenceSlugs.has(p.essence)) fail(`원리 ${p.slug} 의 본질 ${p.essence} 가 없다`)
}
for (const m of MAP.methods) {
  if (!m.principles.length) fail(`방법론 ${m.slug} 에 원리가 없다`)
  for (const p of m.principles) if (!allPrinciple.has(p)) fail(`방법론 ${m.slug} 의 원리 ${p} 가 없다`)
}
const practiceOf = new Map()
for (const [method, slugs] of Object.entries(MAP.practice_to_method)) {
  if (!methodSlugs.has(method)) fail(`연결표의 방법론 ${method} 가 정의에 없다`)
  for (const s of slugs) {
    if (practiceOf.has(s)) fail(`공부법 ${s} 가 두 방법론(${practiceOf.get(s)}, ${method})에 들어 있다`)
    practiceOf.set(s, method)
  }
}
for (const m of methodSlugs) if (!MAP.practice_to_method[m]?.length) fail(`방법론 ${m} 에 연결된 공부법이 없다`)

const items = [
  ...MAP.essence.map((e) => ({ layer: 'essence', slug: e.slug, title: e.title, statement: e.statement, skill_ids: e.skills })),
  ...MAP.principles_new.map((p) => ({ layer: 'principle', slug: p.slug, title: p.title, statement: p.statement, skill_ids: [] })),
  ...MAP.methods.map((m) => ({ layer: 'method', slug: m.slug, title: m.title, statement: `${m.statement} (분석자 추론 초안 — 공부법 묶음)`, skill_ids: m.skills })),
].map((i) => ({ ...i, status: 'in_review', created_by: ACTOR, updated_by: ACTOR }))

const links = [
  ...[...practiceOf].map(([from, to]) => ({ from, to, reason: '본질 지도 초안: 공부법을 같은 절차의 방법론으로 묶음(분석자 추론)' })),
  ...MAP.methods.flatMap((m) => m.principles.map((p) => ({ from: m.slug, to: p, reason: '본질 지도 초안: 방법론이 기대는 원리(분석자 추론)' }))),
  ...[...MAP.principles_new, ...MAP.principles_existing].map((p) => ({ from: p.slug, to: p.essence, reason: '본질 지도 초안: 원리가 설명하는 본질 축(분석자 추론)' })),
]

console.log(`파일 검증 통과 — 항목 ${items.length}(본질 ${MAP.essence.length} · 원리 새 ${newPrinciple.size} · 방법론 ${methodSlugs.size}) · 연결 ${links.length}(공부법→방법론 ${practiceOf.size})`)

// ── DB 대조 ───────────────────────────────────────────────────────
if (!process.env.SUPABASE_SERVICE_ROLE_KEY && !COMMIT) {
  console.log('자격 없음 — DB 대조 없이 미리보기 끝')
  process.exit(0)
}
const db = createScriptClient()

const practiceRows = []
// keyset(slug > 마지막) — OFFSET 페이징 예산 회귀를 늘리지 않는다
for (let last = ''; ; ) {
  const { data, error } = await db.from('knowledge_items').select('id,slug').eq('layer', 'practice').gt('slug', last).order('slug').limit(1000)
  if (error) fail(`공부법 읽기 실패: ${error.message}`)
  practiceRows.push(...data)
  if (data.length < 1000) break
  last = data[data.length - 1].slug
}
const dbPractice = new Set(practiceRows.map((r) => r.slug))
const missing = [...practiceOf.keys()].filter((s) => !dbPractice.has(s))
const unmapped = [...dbPractice].filter((s) => !practiceOf.has(s))
if (missing.length) fail(`연결표에 있는데 DB 에 없는 공부법 ${missing.length}: ${missing.slice(0, 5).join(', ')}`)
console.log(`DB 공부법 ${dbPractice.size} · 연결표 ${practiceOf.size} · 연결 안 된 공부법 ${unmapped.length}${unmapped.length ? ' — ' + unmapped.slice(0, 5).join(', ') : ''}`)

const { data: oldRows, error: e0 } = await db.from('knowledge_items').select('slug,layer').in('slug', [...oldPrinciple])
if (e0) fail(e0.message)
const badOld = [...oldPrinciple].filter((s) => !oldRows.some((r) => r.slug === s && r.layer === 'principle'))
if (badOld.length) fail(`재사용할 기존 원리가 없다: ${badOld.join(', ')}`)

const { data: haveRows, error: e1 } = await db.from('knowledge_items').select('slug,layer').in('slug', items.map((i) => i.slug))
if (e1) fail(e1.message)
const clash = haveRows.filter((r) => items.find((i) => i.slug === r.slug).layer !== r.layer)
if (clash.length) fail(`같은 slug 가 다른 층으로 이미 있다: ${clash.map((r) => r.slug).join(', ')}`)
const have = new Set(haveRows.map((r) => r.slug))
const fresh = items.filter((i) => !have.has(i.slug))
console.log(`항목 새로 ${fresh.length} · 이미 있음 ${have.size}(건너뜀)`)

if (!COMMIT) {
  console.log('미리보기 끝 — 쓰려면 --commit')
  process.exit(0)
}

if (fresh.length) {
  const { error } = await db.from('knowledge_items').upsert(fresh, { onConflict: 'slug', ignoreDuplicates: true })
  if (error) fail(`항목 적재 실패: ${error.message}`)
}

const slugs = [...new Set(links.flatMap((l) => [l.from, l.to]))]
const idOf = new Map()
for (let i = 0; i < slugs.length; i += 200) {
  const { data, error } = await db.from('knowledge_items').select('id,slug').in('slug', slugs.slice(i, i + 200))
  if (error) fail(error.message)
  for (const r of data) idOf.set(r.slug, r.id)
}
const lost = slugs.filter((s) => !idOf.has(s))
if (lost.length) fail(`연결할 항목 id 를 못 찾음 ${lost.length}: ${lost.slice(0, 5).join(', ')}`)

const rows = links.map((l) => ({ from_id: idOf.get(l.from), to_id: idOf.get(l.to), kind: 'implements', reason: l.reason, created_by: ACTOR }))
let written = 0
for (let i = 0; i < rows.length; i += 100) {
  // implements 층 검사는 DB 트리거가 한다 — 위반이면 여기서 멈춘다(앞 묶음은 이미 들어갔고, 재실행하면 이어서 넣는다)
  const { data, error } = await db.from('knowledge_links').upsert(rows.slice(i, i + 100), { onConflict: 'from_id,to_id,kind', ignoreDuplicates: true }).select('id')
  if (error) fail(`연결 적재 실패 (${i}~): ${error.message}`)
  written += data.length
}
console.log(`연결 새로 ${written} · 이미 있음 ${rows.length - written}(건너뜀)`)
