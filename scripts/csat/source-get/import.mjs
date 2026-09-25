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
//   pnpm dlx tsx scripts/csat/source-get/import.mjs --source gdl --dir <폴더>            (dry-run)
//   pnpm dlx tsx scripts/csat/source-get/import.mjs --source gdl --dir <폴더> --commit --limit 1
//   pnpm dlx tsx scripts/csat/source-get/import.mjs --source gdl --dir <폴더> --commit
//   ⚠️ tsx 로 돈다 — 사전검증(precheck.ts)을 패키지에서 가져온다. 맨 node 는 TS 의 확장자 없는 import 를 못 푼다.
//
// ── 사전검증 (2026-09-25) ──
// 적재 전에 분류·제목·앞부분을 규칙으로 본다(`packages/library-pipeline/src/ingest-article/precheck.ts`).
// 결과는 `csat_fit.precheck` 에 남는다. 원천 정책이 'block' 인 단계에 걸린 글만 건너뛰고 **사유별로 센다.**

import fs from 'node:fs'
import path from 'node:path'

const SOURCES = ['global_voices', 'global_storybooks', 'gdl', 'wikinews', 'openstax', 'eia_kids', 'nih_news_in_health']

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
const { precheckArticle } = await import('@vocaflow/library-pipeline')

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
for (let i = 0; i < sourceIds.length; i += 50) { // 50 — 긴 슬러그 id(nih_news_in_health)는 200개면 URL 이 넘쳐 fetch failed
  const { data, error } = await db.from('library_articles').select('source_id').eq('source', SOURCE).in('source_id', sourceIds.slice(i, i + 50))
  if (error) throw new Error(`기존 조회 실패 — ${error.message}`)
  for (const r of data ?? []) existing.add(r.source_id)
}
console.log(`이미 있음 ${existing.size}편`)

const W = (t) => (String(t ?? '').match(/[A-Za-z][A-Za-z'-]*/g) ?? []).length

/**
 * **끝 문단의 크레디트를 걷는다** — 그림책 원천은 이야기 뒤에 번역자·후원사·제작 워크숍 문단을 붙인다.
 * 본 수집 실측(2026-09-25): global_storybooks 368편 중 57 · gdl 300편 중 64. 지우지 않으면
 * V-Level 이 튄다(gdl 파일럿 최대 V9 — 그림책인데). 뒤에서부터 크레디트 문단만 떼고, 본문 중간은 건드리지 않는다.
 */
const CREDIT = [
  /^\*\s*(Translated|Written|Illustrated|Adapted)\s+By\b/i,
  /^(Generously\s+)?supported by\b/i,
  /\b(Foundation|workshop)\b.*\b(collaboration|conducted|supported|funded|developed)\b/i,
  /\bcollaborated to (write|create|develop)\b/i,
  /^(This (book|story) (was|is)|Published by|Licensed under)\b/i,
  // 문장 중간의 후원 표기 — 「Books in Homes is supported by …」·「In collaboration with and generously supported by …」
  /\bsupported by\b/i,
  /\bFoundation\b.*\b(led|workshops?)\b/i,
  // 작가·삽화가 소개 문단 — 끝이 직함이다(「… Kyung-sil Roh Writer」)
  /\b(Writer|Illustrator|Author|Translator)\.?$/,
]
function stripCredits(text) {
  const paras = String(text).split(/\n{2,}/)
  let removed = 0
  // 90어 상한 — 「supported by」 같은 넓은 규칙이 이야기의 진짜 끝 문단을 떼지 않게 한다(크레디트 문단 실측 ≤ 70어).
  const isCredit = (p) => W(p) <= 90 && CREDIT.some((re) => re.test(p.trim()))
  while (paras.length > 1 && isCredit(paras.at(-1))) { paras.pop(); removed++ }
  return { text: paras.join('\n\n').trim(), removed }
}
const STORYBOOK = new Set(['global_storybooks', 'gdl'])
let creditsStripped = 0
let markup = 0
const blockedBy = {}
let blockedTotal = 0
let flagged = 0
let inserted = 0, skipped = 0, empty = 0, short = 0, restricted = 0, n = 0
const failures = []
for (const r of rows) {
  if (LIMIT && n >= LIMIT) break
  const source_id = `${SOURCE}:${r.id}`
  if (existing.has(source_id)) { skipped++; continue }
  // ⚠️ 그림책 원천에만 — 뉴스·교재의 끝 문단은 본문이다. 처음엔 전 원천에 걸어 wikinews 32편의
  //   마지막 문단(「…supported by the UN」 따위)을 뗐다(2026-09-25, `--repair-content` 로 되돌림).
  const raw = String(r.body_text ?? '').trim()
  const cleaned = STORYBOOK.has(SOURCE) ? stripCredits(raw) : { text: raw, removed: 0 }
  if (cleaned.removed) creditsStripped++
  const content = cleaned.text
  if (!content) { empty++; continue }
  // 위키 표기 잔여(`{{…}}` · `[[…` · 표 파이프) — 덤프 19,486편 중 ~130편. 정제로 안 풀리는 원문 표기 오류라 뺀다.
  if (SOURCE === 'wikinews' && /[{}|]|\[\[/.test(content)) { markup++; continue }
  const pre = precheckArticle({ source: SOURCE, title: r.title, content, categories: r.categories ?? null })
  if (pre.verdict === 'block') {
    blockedTotal++
    for (const reason of pre.reasons) if (pre.blockedBy.includes(reason.split(':')[0])) blockedBy[reason] = (blockedBy[reason] ?? 0) + 1
    continue
  }
  if (pre.verdict === 'flag') flagged++
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
      precheck: pre,
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
건너뜀(위키 표기 잔여) ${markup}편
100어 미만 ${short}편 (버리지 않음 · 기록용)
끝 크레디트 걷음 ${creditsStripped}편
라이선스 해소 필요(담음 · restricted) ${restricted}편
사전검증 막음 ${blockedTotal}편  사유 ${JSON.stringify(blockedBy)}
사전검증 표시만(담음) ${flagged}편
실패        ${failures.length}편`)
for (const f of failures.slice(0, 10)) console.log('  ' + f)
if (!COMMIT) console.log('\n※ dry-run 이다. 실제로 쓰려면 --commit')
