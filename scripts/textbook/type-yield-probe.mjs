// scripts/textbook/type-yield-probe.mjs
//
// **새 유형 둘이 실제로 몇 문항 나오는가.** 그리고 **그 문항이 작동하는가.**
//
// Cycle 2 의 교훈: 만든 것과 작동하는 것은 다르다. 해설은 커버리지 92.1% 였지만
// 정답을 가리키는 것은 2.6% 였다. 그래서 이 스크립트는 개수만 세지 않고 **검증**한다:
//
//   흐름 무관  정답(남의 문장)이 **본문 어느 문장보다도 덜 붙어 있는가** — 답이 갈리지 않는가
//              그리고 `overlapGap` 분포 — 너무 크면 읽지 않고도 찍는 쉬운 문항이다
//   영작 배열  낱말 뭉치를 다시 세우면 **원문이 되는가**, 낱말이 하나도 늘거나 줄지 않았는가
//              그리고 왜 버려졌는지(사유별 집계) — 재고 병목이 어디인지 봐야 고친다
//
// 재실행 안전: 읽기만 한다. DB 에 아무것도 쓰지 않는다.
// 실행: pnpm dlx tsx scripts/textbook/type-yield-probe.mjs [--sample]

import fs from 'node:fs'
import { fetchAllPaged } from './volume-pool.mjs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const showSample = process.argv.includes('--sample')

const { createClient } = await import('@supabase/supabase-js')
const { buildIrrelevant, buildWordOrder, cohesionWith, topicalBar, WORD_ORDER_WORDS } = await import(
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

const usable = (arts ?? []).filter((a) => !a.display_only) // ND 는 본문을 못 쓴다
console.log(`글 ${arts?.length ?? 0}편 중 본문 사용 가능 ${usable.length}편\n`)

const paras = (content) =>
  String(content)
    .split(/\n\s*\n+/)
    .map((p) => p.replace(/\s+/g, ' ').trim())
    .filter(Boolean)
const sents = (p) =>
  p
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter(Boolean)

// ── 흐름 무관 후보 풀 — 다른 글의 문장들 ────────────────────────────
// 밴드가 다르면 문체가 달라 겉모습으로 골라진다. **같은 밴드 안에서만** 빌려 온다.
const poolByBand = new Map()
for (const a of usable) {
  const band = a.article_v_level ?? -1
  for (const p of paras(a.content)) {
    for (const s of sents(p)) {
      if (s.split(/\s+/).length < 8 || s.split(/\s+/).length > 20) continue
      const arr = poolByBand.get(band) ?? []
      if (arr.length < 4000) arr.push({ text: s, ref: a.id })
      poolByBand.set(band, arr)
    }
  }
}

// ── 사전 ────────────────────────────────────────────────────────────
// 두 가지에 쓴다: ① 첫 낱말을 소문자로 내려도 되는지(고유명사 보호)
//                ② 낱말의 희소도 — 흔한 낱말의 겹침을 주제 근접으로 착각하지 않기 위해
const vLevelOf = new Map()
for (let from = 0; ; from += 1000) {
  const { data, error: e } = await db
    .from('shared_dictionary')
    .select('word, v_level')
    .order('word')
    .range(from, from + 999)
  if (e) throw new Error(e.message)
  if (!data?.length) break
  for (const r of data) vLevelOf.set(String(r.word).toLowerCase(), r.v_level)
  if (data.length < 1000) break
}
const levels = [...vLevelOf.values()].filter((v) => v != null)
const MAX_V = Math.max(...levels)
console.log(`사전 낱말 ${vLevelOf.size}개 적재 · v_level 최대 ${MAX_V}\n`)

const isCommon = (w) => vLevelOf.has(w.toLowerCase())
// 사전에 없는 낱말은 가장 희귀한 쪽 — 고유명사·전문어라 주제를 가장 강하게 지시한다.
const rarity = (w) => {
  const v = vLevelOf.get(w.toLowerCase())
  return v == null ? MAX_V : v
}

// ── 생성 ────────────────────────────────────────────────────────────
const irrelevant = []
const wordOrder = []
const woReject = { length: 0, repeated: 0, punct: 0, nonword: 0, other: 0 }
let irrParaTried = 0
let woSentTried = 0

for (const a of usable) {
  const band = a.article_v_level ?? -1
  const pool = poolByBand.get(band) ?? []
  const ps = paras(a.content)
  for (let pi = 0; pi < ps.length; pi++) {
    const ss = sents(ps[pi])
    if (ss.length >= 5) {
      irrParaTried++
      const item = buildIrrelevant(ss, pool, a.id, rarity)
      if (item) irrelevant.push({ ...item, ref: a.id, title: a.title, band, paragraph_idx: pi })
    }
    for (let si = 0; si < ss.length; si++) {
      woSentTried++
      const item = buildWordOrder(ss[si], si > 0 ? ss[si - 1] : null, isCommon)
      if (item) {
        wordOrder.push({ ...item, ref: a.id, band, paragraph_idx: pi, sentence_idx: si })
      } else {
        // 왜 버려졌는지 — 재고 병목을 알아야 고친다
        const t = ss[si].trim()
        const toks = t.replace(/[.!?]+$/, '').split(/\s+/).filter(Boolean)
        if (/[,;:—–"“”'‘’()[\]{}]/.test(t)) woReject.punct++
        else if (toks.length < WORD_ORDER_WORDS.min || toks.length > WORD_ORDER_WORDS.max) woReject.length++
        else if (toks.some((x) => !/^[A-Za-z][A-Za-z'-]*$/.test(x))) woReject.nonword++
        else if (new Set(toks.map((x) => x.toLowerCase())).size !== toks.length) woReject.repeated++
        else woReject.other++
      }
    }
  }
}

const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + '%' : '—')
const line = '─'.repeat(72)

// ── 검증: 흐름 무관 ─────────────────────────────────────────────────
let irrBad = 0
const gaps = []
for (const it of irrelevant) {
  const all = it.sentences
  // **생성기와 같은 눈금으로** 재야 검증이 성립한다 — 희소도와 문턱을 그대로 쓴다.
  const bar = topicalBar([it.intro, ...all].join(' '), rarity)
  const cohesions = all.map((s, i) =>
    cohesionWith(s, [it.intro, ...all.filter((_, j) => j !== i)].join(' '), rarity, bar),
  )
  const answerCohesion = cohesions[it.answer - 1]
  // 정답이 **유일하게** 가장 덜 붙어 있어야 한다.
  const minimum = Math.min(...cohesions)
  if (answerCohesion !== minimum || cohesions.filter((c) => c === minimum).length > 1) irrBad++
  gaps.push(it.overlapGap)
}
gaps.sort((a, b) => a - b)
const q = (p) => (gaps.length ? gaps[Math.min(gaps.length - 1, Math.floor(p * gaps.length))] : 0)

console.log(`${line}\n① 흐름 무관 (수능 35번)\n`)
console.log(`  5문장 이상 문단      ${irrParaTried}`)
console.log(`  **생성              ${irrelevant.length}  = ${pct(irrelevant.length, irrParaTried)}**`)
console.log(`  정답이 유일 최소가 아닌 것: ${irrBad}   ← 0 이어야 한다 (답이 갈린다)`)
console.log(`  overlapGap 분포: p25 ${q(0.25)} · 중앙 ${q(0.5)} · p75 ${q(0.75)} · 최대 ${gaps.at(-1) ?? 0}`)
console.log(`    ↳ 클수록 쉬운 문항이다. 1~2 가 실전에 가깝다`)

const irrBand = new Map()
for (const it of irrelevant) irrBand.set(it.band, (irrBand.get(it.band) ?? 0) + 1)
console.log(
  '  밴드별: ' +
    [...irrBand.entries()].sort((a, b) => a[0] - b[0]).map(([b, n]) => `V${b} ${n}`).join(' · '),
)

// ── 검증: 영작 배열 ─────────────────────────────────────────────────
let woBad = 0
for (const it of wordOrder) {
  // `filter(Boolean)` 이 없으면 끝 부호 앞 공백 때문에 빈 토큰이 하나 생긴다 —
  // 생성기와 **같은 방식으로** 쪼개야 비교가 성립한다.
  const original = it.answer.replace(/[.!?]+$/, '').split(/\s+/).filter(Boolean)
  const norm = (arr) => [...arr].map((w) => w.toLowerCase()).sort().join('|')
  if (it.bank.length !== original.length || norm(it.bank) !== norm(original)) woBad++
}

console.log(`\n${line}\n② 영작 배열 (중등 서술형)\n`)
console.log(`  문장 전체            ${woSentTried}`)
console.log(`  **생성              ${wordOrder.length}  = ${pct(wordOrder.length, woSentTried)}**`)
console.log(`  낱말이 늘거나 준 것: ${woBad}   ← 0 이어야 한다`)
console.log('\n  버린 이유')
const rejTotal = Object.values(woReject).reduce((s, n) => s + n, 0)
const REJ_KO = {
  punct: '문장 안에 부호 (자리를 알려 준다)',
  length: `낱말 수 ${WORD_ORDER_WORDS.min}~${WORD_ORDER_WORDS.max} 밖`,
  repeated: '같은 낱말 두 번 (정답이 갈린다)',
  nonword: '숫자·기호 섞임',
  other: '기타',
}
for (const [k, n] of Object.entries(woReject).sort((a, b) => b[1] - a[1])) {
  console.log(`    ${REJ_KO[k].padEnd(34)} ${String(n).padStart(6)}  ${pct(n, rejTotal)}`)
}

const woBand = new Map()
for (const it of wordOrder) woBand.set(it.band, (woBand.get(it.band) ?? 0) + 1)
console.log(
  '\n  밴드별: ' +
    [...woBand.entries()].sort((a, b) => a[0] - b[0]).map(([b, n]) => `V${b} ${n}`).join(' · '),
)

if (showSample) {
  const CIRCLED = ['①', '②', '③', '④', '⑤']
  for (const it of irrelevant.slice(0, 2)) {
    console.log(`\n${line}\n[흐름 무관] ${it.title}  (gap ${it.overlapGap})\n`)
    console.log(`  ${it.intro}\n`)
    it.sentences.forEach((s, i) => console.log(`  ${CIRCLED[i]} ${s}`))
    console.log(`\n  정답 ${CIRCLED[it.answer - 1]}  (출처 ${it.foreign.ref})`)
  }
  for (const it of wordOrder.slice(0, 3)) {
    console.log(`\n${line}\n[영작 배열] V${it.band}`)
    if (it.context) console.log(`  앞 문장: ${it.context}`)
    console.log(`  낱말: ${it.bank.join(' / ')}`)
    console.log(`  정답: ${it.answer}`)
  }
}

if (irrBad || woBad) process.exitCode = 1
