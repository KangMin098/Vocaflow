// scripts/textbook/vlevel-estimate-probe.mjs
//
// **적재 전에 칸을 맞힐 수 있는가 — 추정기를 정답과 대 본다.**
//
// ── 왜 필요한가 (2026-09-05 실측) ───────────────────────────────────
// MediaWiki 도입부 36편을 FK(Flesch-Kincaid) 칸으로 조준해 넣었더니 목표였던
// V1~V3 에는 **11편만** 들어갔다(V4 10 · V5 12 · V6 3). FK 는 문장 길이와 음절 수로
// 재고, 사다리의 `article_v_level` 은 `compute_article_vrl` 이 **글에 쓰인 서로 다른
// 낱말의 V-Level 75분위**로 정한다 — **둘은 다른 자다.**
//
// 그래서 조준을 채점자와 같은 자로 바꾸려 한다. 다만 채점자는 적재 → 처리(어휘 추출)
// 뒤에야 값을 내므로, 적재 **전에** 그 값을 맞힐 추정기가 필요하다.
//
// ── 추정기가 정확할 수 없는 이유 ─────────────────────────────────────
// 채점자는 `library_article_vocabularies` 를 쓴다. 그 표는 `extractBookLemmas` 로 뽑은
// lemma 를 `lookupAndEnrich` → `computeLearningValue` 로 한 번 더 거른 것이다.
// 추정기는 앞의 두 단계(추출·사전 조인)까지만 흉내 낸다 — 거르는 단계가 빠지므로
// **다를 수 있고, 얼마나 다른지는 재야 안다.** 이 스크립트가 그 대조다.
//
// 재실행 안전: 읽기만 한다. 아무것도 쓰지 않는다.
//
// 실행:
//   npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/vlevel-estimate-probe.mjs
//   ... --source simple_wikipedia --limit 60

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const SOURCE = arg('source') ?? 'simple_wikipedia'
const LIMIT = Number(arg('limit') ?? 60)

const { createClient } = await import('@supabase/supabase-js')
const { estimateArticleVLevel } = await import('./_vlevel.mjs')
const { extractBookLemmas } = await import(
  '../../packages/library-pipeline/src/analyze/extract-lemmas.ts'
)

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)


const { data: rows, error } = await db
  .from('library_articles')
  .select('id, title, content, article_v_level, vrl_components')
  .eq('source', SOURCE)
  .like('source_id', '%#lead%')
  .not('article_v_level', 'is', null)
  .limit(LIMIT)
if (error) throw new Error(error.message)

console.log(`정답이 있는 ${rows.length}편으로 추정기를 대 본다 (source=${SOURCE})\n`)

let exact = 0
let within1 = 0
const diffs = []
const rowsOut = []

for (const r of rows) {
  const est = await estimateArticleVLevel(db, extractBookLemmas, r.content ?? '')
  const actual = r.article_v_level
  const d = est.vLevel == null ? null : est.vLevel - actual
  if (d === 0) exact++
  if (d != null && Math.abs(d) <= 1) within1++
  if (d != null) diffs.push(d)
  rowsOut.push({ title: r.title, actual, est: est.vLevel, d, matched: est.matched, lemmas: est.lemmas })
}

for (const o of rowsOut.slice(0, 20)) {
  const mark = o.d === 0 ? '✓' : Math.abs(o.d ?? 9) <= 1 ? '~' : '✗'
  console.log(
    `  ${mark} 정답 V${o.actual}  추정 ${o.est == null ? '  -' : `V${o.est}`}  ` +
      `차 ${o.d == null ? ' -' : String(o.d).padStart(2)}  ` +
      `사전적중 ${String(o.matched).padStart(3)}/${String(o.lemmas).padStart(3)}  ${String(o.title).slice(0, 40)}`,
  )
}

const n = diffs.length
const mean = n ? diffs.reduce((a, b) => a + b, 0) / n : 0
console.log(
  `\n표본 ${rows.length} · 추정 성공 ${n}\n` +
    `정확 일치 ${exact} (${((exact / rows.length) * 100).toFixed(1)}%) · ` +
    `±1칸 이내 ${within1} (${((within1 / rows.length) * 100).toFixed(1)}%) · ` +
    `평균 편차 ${mean >= 0 ? '+' : ''}${mean.toFixed(2)}칸`,
)
console.log(
  n
    ? `편차 분포: ${[...new Set(diffs)].sort((a, b) => a - b).map((d) => `${d >= 0 ? '+' : ''}${d}:${diffs.filter((x) => x === d).length}`).join(' · ')}`
    : '추정이 하나도 안 나왔다 — 사전 조인이 비었는지 본다.',
)
