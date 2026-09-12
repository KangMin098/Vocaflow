// scripts/textbook/vocab-yield-probe.mjs
//
// **어휘(수능 30번) 수율 + 작동 검증**, 그리고 **영작 배열의 부호 병목 실측**.
//
// ── 어휘 문항에서 검증할 것 ──────────────────────────────────────────
// 이 유형의 실패 모드는 "바꿔 놓았는데 안 틀려 보이는 것" 이다. 문자열로 확인 가능한 것만 본다:
//
//   ① 바뀐 낱말(반대말)이 지문에 **정확히 한 번** 나온다
//   ② 원래 낱말이 지문에 **여전히 남아 있다** — 이것이 모순을 보이게 하는 근거다
//   ③ 밑줄 다섯이 서로 다른 문장에 흩어져 있다 — 한 문장에 몰리면 자리로 찍는다
//   ④ 정답 번호 분포가 한쪽으로 쏠리지 않는다 — 쏠리면 찍어서 맞는다
//
// ── 영작 배열 부호 병목 ──────────────────────────────────────────────
// 버린 이유 1위가 "문장 안에 부호" 70.1% 였다. 쉼표를 허용하면 얼마나 늘어나는지 재고,
// 그 대가(쉼표가 자리를 알려 준다)를 같이 본다. **재기만 한다 — 생성기는 안 바꾼다.**
//
// 재실행 안전: 읽기만 한다.
// 실행: pnpm dlx tsx scripts/textbook/vocab-yield-probe.mjs [--sample]

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const showSample = process.argv.includes('--sample')

const { createClient } = await import('@supabase/supabase-js')
// **생성기와 같은 세는 법을 쓴다** — 다른 자로 재면 검증이 아니라 잡음이다.
const { buildVocabChoice, countWord, VOCAB_UNDERLINES } = await import('@vocaflow/library-pipeline')

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const { data: arts, error } = await db
  .from('library_articles')
  .select('id, title, article_v_level, display_only, content')
  .in('status', ['ready', 'published'])
  .not('content', 'is', null)
  .order('id')
if (error) throw new Error(error.message)
const usable = (arts ?? []).filter((a) => !a.display_only)

// ── 사전 (반대말 + 품사) ────────────────────────────────────────────
const ant = new Map()
const pos = new Map()
for (let from = 0; ; from += 1000) {
  const { data, error: e } = await db
    .from('shared_dictionary')
    .select('word, antonyms, primary_pos')
    .order('word')
    .range(from, from + 999)
  if (e) throw new Error('사전 조회 실패: ' + e.message)
  if (!data?.length) break
  for (const r of data) {
    const w = String(r.word).toLowerCase()
    if (Array.isArray(r.antonyms) && r.antonyms.length) ant.set(w, r.antonyms.map((x) => String(x)))
    if (r.primary_pos) pos.set(w, String(r.primary_pos))
  }
  if (data.length < 1000) break
}
console.log(`사전 — 반대말 보유 ${ant.size} · 품사 보유 ${pos.size}\n`)
const lex = { antonymsOf: (w) => ant.get(w.toLowerCase()) ?? [], posOf: (w) => pos.get(w.toLowerCase()) ?? null }

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

// ── 어휘 문항 ───────────────────────────────────────────────────────
const items = []
let tried = 0
for (const a of usable) {
  for (const p of paras(a.content)) {
    const ss = sents(p)
    if (ss.length < VOCAB_UNDERLINES) continue
    tried++
    const item = buildVocabChoice(ss, lex)
    if (item) items.push({ ...item, band: a.article_v_level ?? -1, title: a.title })
  }
}

let badOnce = 0
let badOriginalGone = 0
let badSameSentence = 0
const answerHist = new Array(VOCAB_UNDERLINES).fill(0)

for (const it of items) {
  const body = it.sentences.join(' ')
  const swapped = it.underlines[it.answer - 1].word.toLowerCase().replace(/[^a-z']/g, '')
  if (countWord(body, swapped) !== 1) badOnce++
  if (countWord(body, it.original) < 1) badOriginalGone++
  if (new Set(it.underlines.map((u) => u.sentenceIdx)).size !== it.underlines.length) badSameSentence++
  answerHist[it.answer - 1]++
}

const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + '%' : '—')
const line = '─'.repeat(72)
console.log(`${line}\n① 어휘 — 문맥에 맞지 않는 낱말 (수능 30번)\n`)
console.log(`  ${VOCAB_UNDERLINES}문장 이상 문단   ${tried}`)
console.log(`  **생성            ${items.length}  = ${pct(items.length, tried)}**`)
console.log(`\n  검증 (모두 0 이어야 한다)`)
console.log(`    바뀐 낱말이 한 번이 아닌 것      ${badOnce}`)
console.log(`    원래 낱말이 사라진 것            ${badOriginalGone}`)
console.log(`    밑줄이 같은 문장에 겹친 것       ${badSameSentence}`)
console.log(
  `\n  정답 번호 분포: ${answerHist.map((n, i) => `${['①', '②', '③', '④', '⑤'][i]} ${n}`).join(' · ')}`,
)
const maxShare = items.length ? Math.max(...answerHist) / items.length : 0
console.log(`    최다 번호 비중 ${(100 * maxShare).toFixed(1)}%  (고르면 20%. 40% 넘으면 찍어서 맞는다)`)

const byBand = new Map()
for (const it of items) byBand.set(it.band, (byBand.get(it.band) ?? 0) + 1)
console.log(
  '  밴드별: ' + [...byBand.entries()].sort((a, b) => a[0] - b[0]).map(([b, n]) => `V${b} ${n}`).join(' · '),
)

// ── 영작 배열 부호 병목 ─────────────────────────────────────────────
// 생성기는 그대로 두고, **규칙을 느슨하게 했을 때 얼마나 늘어나는지만** 센다.
const STRICT = /[,;:—–"“”'‘’()[\]{}]/
const COMMA_OK = /[;:—–"“”'‘’()[\]{}]/
let nStrict = 0
let nCommaOk = 0
let nSent = 0
let commaLeak = 0
for (const a of usable) {
  for (const p of paras(a.content)) {
    for (const s of sents(p)) {
      nSent++
      const toks = s.replace(/[.!?]+$/, '').split(/\s+/).filter(Boolean)
      if (toks.length < 6 || toks.length > 12) continue
      if (toks.some((x) => !/^[A-Za-z][A-Za-z'-]*$/.test(x.replace(/,$/, '')))) continue
      const keys = toks.map((x) => x.toLowerCase().replace(/[^a-z']/g, ''))
      if (new Set(keys).size !== keys.length) continue
      if (!STRICT.test(s)) nStrict++
      else if (!COMMA_OK.test(s)) {
        nCommaOk++
        // 쉼표가 몇 번째 낱말에 붙는지 — 붙은 자리가 곧 힌트다.
        if (/,/.test(s)) commaLeak++
      }
    }
  }
}
console.log(`\n${line}\n② 영작 배열 — 쉼표를 허용하면?\n`)
console.log(`  문장 전체              ${nSent}`)
console.log(`  지금 규칙(부호 전면 금지) ${nStrict}`)
console.log(`  쉼표만 허용 시 추가      +${nCommaOk}  (${pct(nCommaOk, nStrict || 1)} 증가)`)
console.log(
  `\n  대가: 추가분 ${commaLeak}개 전부가 **쉼표 붙은 낱말이 그 자리를 알려 준다**.` +
    `\n  시중 교재도 쉼표를 붙여 주지만, 우리는 정답이 하나로 확정되는 것을 우선해 왔다.` +
    `\n  판단은 사람 몫이라 여기서는 숫자만 남긴다.`,
)

if (showSample) {
  for (const it of items.slice(0, 3)) {
    console.log(`\n${line}\n[어휘] ${it.title}  (V${it.band})\n`)
    for (let i = 0; i < it.sentences.length; i++) {
      const marks = it.underlines.filter((u) => u.sentenceIdx === i)
      const tag = marks.map((m) => `${m.label} ${m.word}`).join(' / ')
      console.log(`  ${it.sentences[i]}${tag ? `\n      └ ${tag}` : ''}`)
    }
    console.log(`\n  정답 ${['①', '②', '③', '④', '⑤'][it.answer - 1]}  (원래 낱말: ${it.original})`)
  }
}

if (badOnce || badOriginalGone || badSameSentence) process.exitCode = 1
