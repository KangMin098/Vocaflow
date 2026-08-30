// scripts/textbook/grammar-yield-probe.mjs
//
// **어법(수능 29번) 수율 + 작동 검증.**
//
// ── 이 유형에서 검증할 것 ────────────────────────────────────────────
// 실패 모드는 둘이다:
//
//   ① **바꿨는데 안 틀린 경우** — 원문이 이미 어긋나 있었으면 교체가 오히려 고친다.
//      생성기가 "원문이 표준형과 맞을 때만" 이라는 조건으로 막고 있는데, 그게 실제로
//      먹히는지 완성본에서 다시 본다: 정답 자리는 표준형을 **어겨야** 하고,
//      나머지 네 자리는 표준형을 **지켜야** 한다.
//   ② **자리로 찍히는 경우** — 정답 번호가 한쪽으로 쏠리면 읽지 않고 맞는다.
//
// 규칙별 분포도 낸다. 한 규칙에 몰리면 학습자가 "밑줄은 늘 관사" 라고 배운다.
//
// 재실행 안전: 읽기만 한다.
// 실행: pnpm dlx tsx scripts/textbook/grammar-yield-probe.mjs [--sample]

import fs from 'node:fs'
import { fetchAllPaged } from './volume-pool.mjs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const showSample = process.argv.includes('--sample')

const { createClient } = await import('@supabase/supabase-js')
// 생성기와 **같은 판정기**를 쓴다 — 다른 자로 재면 검증이 아니라 잡음이다.
const { buildGrammarChoice, GRAMMAR_UNDERLINES, looksPlural, standardArticle } = await import(
  '@vocaflow/library-pipeline'
)

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ⚠️ 페이징 없이 읽으면 1,000행에서 잘려 **리포트 수치가 조용히 틀린다**(원글 6,633편).
const arts = await fetchAllPaged(db, (q) =>
  q
    .from('library_articles')
    .select('id, title, article_v_level, display_only, content')
    .in('status', ['ready', 'published'])
    .not('content', 'is', null)
    .order('id'))
  .order('id')
const usable = (arts ?? []).filter((a) => !a.display_only)

const paras = (c) =>
  String(c)
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
const sents = (p) =>
  p
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)

const items = []
let tried = 0
for (const a of usable) {
  for (const p of paras(a.content)) {
    const ss = sents(p)
    if (ss.length < GRAMMAR_UNDERLINES) continue
    tried++
    const item = buildGrammarChoice(ss)
    if (item) items.push({ ...item, band: a.article_v_level ?? -1, title: a.title })
  }
}

const bare = (t) => String(t).toLowerCase().replace(/[^a-z']/g, '')

/** 이 자리가 표준형을 지키는가. 판정 불가면 null. */
function conforms(sentences, u) {
  const tokens = sentences[u.sentenceIdx].split(/\s+/)
  const w = bare(tokens[u.tokenIdx])
  const next = tokens[u.tokenIdx + 1]
  if (!next) return null
  if (w === 'a' || w === 'an') return standardArticle(bare(next)) === w
  if (['this', 'these', 'that', 'those'].includes(w)) {
    const plural = looksPlural(next)
    if (plural === null) return null
    return plural === (w === 'these' || w === 'those')
  }
  return null
}

let badAnswerNotWrong = 0
let badDecoyWrong = 0
let badUnknown = 0
const answerHist = new Array(GRAMMAR_UNDERLINES).fill(0)
const byRule = new Map()
const byBand = new Map()

for (const it of items) {
  answerHist[it.answer - 1]++
  byRule.set(it.rule, (byRule.get(it.rule) ?? 0) + 1)
  byBand.set(it.band, (byBand.get(it.band) ?? 0) + 1)
  for (let i = 0; i < it.underlines.length; i++) {
    const ok = conforms(it.sentences, it.underlines[i])
    if (ok === null) {
      badUnknown++
      continue
    }
    // 정답 자리는 표준형을 어겨야 하고, 나머지는 지켜야 한다.
    if (i === it.answer - 1) {
      if (ok) badAnswerNotWrong++
    } else if (!ok) badDecoyWrong++
  }
}

const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + '%' : '—')
const line = '─'.repeat(72)
console.log(`${line}\n어법 — 어법상 틀린 것 (수능 29번)\n`)
console.log(`  ${GRAMMAR_UNDERLINES}문장 이상 문단   ${tried}`)
console.log(`  **생성            ${items.length}  = ${pct(items.length, tried)}**`)
console.log(`\n  검증 (모두 0 이어야 한다)`)
console.log(`    정답 자리가 안 틀린 것        ${badAnswerNotWrong}`)
console.log(`    오답 자리가 틀려 있는 것      ${badDecoyWrong}   ← 답이 둘이 된다`)
console.log(`    판정 불가한 자리              ${badUnknown}`)
console.log(
  `\n  정답 번호 분포: ${answerHist.map((n, i) => `${['①', '②', '③', '④', '⑤'][i]} ${n}`).join(' · ')}`,
)
const maxShare = items.length ? Math.max(...answerHist) / items.length : 0
console.log(`    최다 번호 비중 ${(100 * maxShare).toFixed(1)}%  (고르면 20%)`)

const RULE_KO = { article: '부정관사 a/an', demonstrative: '지시사 수일치' }
console.log('\n  규칙별')
for (const [r, n] of [...byRule.entries()].sort((a, b) => b[1] - a[1])) {
  console.log(`    ${RULE_KO[r].padEnd(20)} ${String(n).padStart(5)}  ${pct(n, items.length)}`)
}
console.log(
  '\n  밴드별: ' + [...byBand.entries()].sort((a, b) => a[0] - b[0]).map(([b, n]) => `V${b} ${n}`).join(' · '),
)

if (showSample) {
  for (const it of items.slice(0, 3)) {
    console.log(`\n${line}\n[어법] ${it.title}  (V${it.band} · ${RULE_KO[it.rule]})\n`)
    for (let i = 0; i < it.sentences.length; i++) {
      const marks = it.underlines.filter((u) => u.sentenceIdx === i)
      const tag = marks.map((m) => `${m.label} ${m.word}`).join(' / ')
      console.log(`  ${it.sentences[i]}${tag ? `\n      └ ${tag}` : ''}`)
    }
    console.log(`\n  정답 ${['①', '②', '③', '④', '⑤'][it.answer - 1]}  (원래: ${it.original})`)
  }
}

if (badAnswerNotWrong || badDecoyWrong) process.exitCode = 1
