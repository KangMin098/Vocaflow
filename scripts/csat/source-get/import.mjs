// scripts/csat/source-get/import.mjs
//
// **소스GET 3차 원천의 표본 파일을 `library_articles` 에 적재한다** (2026-09-25).
//
// 입력: `<dir>/ft-<source>-samples.json` — 같은 폴더의 `<source>-fetch.mjs` 가 쓴 것.
//   행 = {id, title, url, license, license_evidence, published_at, author, level?, body_text, words}
//
// ── 이 스크립트가 지키는 것 (source-doc-import.mjs 와 같은 규칙) ─────────
// · **`--commit` 없이는 아무것도 쓰지 않는다.**
// · **재실행 안전** — `source_id` 로 이미 있는 것을 먼저 세고 건너뛴다. 건너뛴 수를 출력한다.
// · **빈 본문만 건너뛴다** — 길이로는 버리지 않는다(짧은 원문은 담고 편수만 센다).
// · **`count ?? 0` 을 쓰지 않는다** — 조회 오류를 「이미 있음 0」으로 삼키면 전량 중복 적재된다.
// · **라이선스는 행마다 읽는다.** NC·ND·표기 없음은 버리지 않고 **표기 그대로** 담는다(DD-75) —
//   DB 트리거 `acp_classify_license` 가 restricted 로 분류해 서비스에서 막는다.
//   `license` 칸에 등급 슬러그를 넣지 않는다(트리거가 재파싱한다 — 2026-09-23 재고 80편 사고).
//
// 사용:
//   node --tls-max-v1.2 scripts/csat/source-get/import.mjs --source gdl --dir <폴더>            (dry-run)
//   node --tls-max-v1.2 scripts/csat/source-get/import.mjs --source gdl --dir <폴더> --commit --limit 1
//   node --tls-max-v1.2 scripts/csat/source-get/import.mjs --source gdl --dir <폴더> --commit

import fs from 'node:fs'
import path from 'node:path'

const SOURCES = ['global_voices', 'global_storybooks', 'gdl', 'wikinews', 'openstax']

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const SOURCE = arg('source')
const DIR = arg('dir')
const COMMIT = process.argv.includes('--commit')
const LIMIT = Number(arg('limit') ?? '0')
if (!SOURCES.includes(SOURCE) || !DIR) {
  console.error(`사용: --source <${SOURCES.join('|')}> --dir <폴더> [--commit] [--limit N]`)
  process.exit(1)
}

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const { rightsTag } = await import('../../../packages/library-pipeline/src/ingest-article/rights-tag.ts')

/** 행의 라이선스 표기를 사람이 읽는 꼴로 정규화한다. 개작 가능 여부도 함께 준다. */
function licenseOf(raw) {
  const s = String(raw ?? '').trim()
  const lower = s.toLowerCase()
  if (!s) return { ok: false, license: 'unknown' }
  if (/-nc|noncommercial|non-commercial/.test(lower)) return { ok: false, license: s }
  if (/-nd\b|noderiv/.test(lower)) return { ok: false, license: s }
  if (/\bcc0\b|public domain/.test(lower)) return { ok: true, license: /cc0/.test(lower) ? 'CC0 1.0' : 'Public Domain' }
  // 원천마다 꼴이 다르다: URL(GV 푸터) · `CC-BY`(Global Storybooks) · `cc-by-4-0`(GDL) · `CC BY 2.5`(Wikinews)
  const v = lower.match(/(\d\.\d)/)?.[1] ?? lower.match(/-(\d)-(\d)\b/)?.slice(1, 3).join('.') ?? '4.0'
  if (/by[-_ ]?sa|by-sa/.test(lower)) return { ok: true, license: `CC BY-SA ${v}` }
  if (/creativecommons\.org\/licenses\/by\/|\bcc[-_ ]?by\b|attribution/.test(lower)) return { ok: true, license: `CC BY ${v}` }
  return { ok: false, license: s }
}

const file = path.join(DIR, `ft-${SOURCE}-samples.json`)
if (!fs.existsSync(file)) { console.error(`${file} 없음 — 먼저 ${SOURCE}-fetch.mjs 를 돌린다`); process.exit(1) }
const rows = JSON.parse(fs.readFileSync(file, 'utf8'))
console.log(`${SOURCE} 표본 ${rows.length}편 (${file})`)

const sourceIds = rows.map((r) => `${SOURCE}:${r.id}`)
const existing = new Set()
for (let i = 0; i < sourceIds.length; i += 200) {
  const { data, error } = await db.from('library_articles').select('source_id').eq('source', SOURCE).in('source_id', sourceIds.slice(i, i + 200))
  if (error) throw new Error(`기존 조회 실패 — ${error.message}`)
  for (const r of data ?? []) existing.add(r.source_id)
}
console.log(`이미 있음 ${existing.size}편`)

const W = (t) => (String(t ?? '').match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length
let inserted = 0, skipped = 0, empty = 0, short = 0, restricted = 0, n = 0
const failures = []
for (const r of rows) {
  if (LIMIT && n >= LIMIT) break
  const source_id = `${SOURCE}:${r.id}`
  if (existing.has(source_id)) { skipped++; continue }
  const content = String(r.body_text ?? '').trim()
  if (!content) { empty++; continue }
  if (W(content) < 100) short++
  const lic = licenseOf(r.license)
  if (!lic.ok) restricted++
  const sourceUrl = r.url ? String(r.url) : null
  const evidence = ['api', 'page', 'collection-default'].includes(r.license_evidence) ? r.license_evidence : 'none'
  const row = {
    source: SOURCE,
    source_id,
    title: String(r.title ?? r.id).slice(0, 500),
    author: r.author ?? null,
    source_url: sourceUrl,
    published_at: r.published_at ?? null,
    license: lic.license,
    content,
    audio_url: null,
    feed_id: null,
    status: 'queued',
    csat_fit: {
      rights: rightsTag({ license: lic.license, licenseEvidence: evidence, author: r.author ?? null, publishedAt: r.published_at ?? null, sourceUrl }),
      ...(r.level != null ? { source_level: String(r.level) } : {}),
    },
  }
  n++
  if (!COMMIT) { inserted++; continue }
  const { error } = await db.from('library_articles').insert(row)
  if (error) failures.push(`${source_id}: [${error.code ?? '?'}] ${error.message}`)
  else inserted++
}

console.log(`
${COMMIT ? '적재' : 'dry-run'}   ${inserted}편
건너뜀(이미 있음) ${skipped}편
건너뜀(빈 본문) ${empty}편
100어 미만 ${short}편 (버리지 않음 · 기록용)
라이선스 해소 필요(담음 · restricted) ${restricted}편
실패        ${failures.length}편`)
for (const f of failures.slice(0, 10)) console.log('  ' + f)
if (!COMMIT) console.log('\n※ dry-run 이다. 실제로 쓰려면 --commit')
