// scripts/textbook/store-new-types.mjs
//
// **흐름 무관 · 영작 배열 문항을 `csat_dcp_items` 에 넣는다.**
//
// ── 유일키가 문단당 하나를 강제한다 ──────────────────────────────────
// 유일키는 `(kind, ref_id, type, paragraph_idx)` 다. 순서·삽입은 원래 문단당 하나라
// 문제가 없었는데, **영작 배열은 문단 안 여러 문장이 후보가 된다.** 그래서 문단마다
// 하나만 고른다 — 고르는 기준은 **낱말 수가 그 문단 후보들의 중앙값에 가장 가까운 것**이다
// (가장 대표적인 문장). 동점이면 문장 순서가 앞선 것. 결정론이라 몇 번 돌려도 같다.
//
// 교재에서도 한 지문에 서술형 하나가 맞으므로 이 제한이 손해만은 아니다. 다만 **얼마나
// 버려지는지 숫자로 남긴다** — 나중에 유일키를 넓힐지 판단할 근거가 된다.
//
// ── 재실행 안전 ──────────────────────────────────────────────────────
// 유일키가 중복을 막는다. 이미 있는 조합은 건너뛴다. 기존 문항의 id 를 바꾸지 않으므로
// 학습 기록이 끊기지 않는다. `--commit` 없이는 아무것도 쓰지 않는다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/store-new-types.mjs            # 몇 개 늘지만 본다
//   pnpm dlx tsx scripts/textbook/store-new-types.mjs --commit

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const commit = process.argv.includes('--commit')

const { createClient } = await import('@supabase/supabase-js')
const { buildIrrelevant, buildWordOrder, buildVocabChoice, VOCAB_UNDERLINES } = await import(
  '@vocaflow/library-pipeline'
)

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

const { data: arts, error } = await db
  .from('library_articles')
  .select('id, article_v_level, display_only, content')
  .in('status', ['ready', 'published'])
  .not('content', 'is', null)
  .order('id')
if (error) throw new Error('기사 조회 실패: ' + error.message)
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

// ── 사전 ────────────────────────────────────────────────────────────
const vLevelOf = new Map()
const antOf = new Map()
const posOf = new Map()
for (let from = 0; ; from += 1000) {
  const { data, error: e } = await db
    .from('shared_dictionary')
    .select('word, v_level, antonyms, primary_pos')
    .order('word')
    .range(from, from + 999)
  if (e) throw new Error('사전 조회 실패: ' + e.message)
  if (!data?.length) break
  for (const r of data) {
    const w = String(r.word).toLowerCase()
    vLevelOf.set(w, r.v_level)
    if (Array.isArray(r.antonyms) && r.antonyms.length) antOf.set(w, r.antonyms.map(String))
    if (r.primary_pos) posOf.set(w, String(r.primary_pos))
  }
  if (data.length < 1000) break
}
const MAX_V = Math.max(...[...vLevelOf.values()].filter((v) => v != null))
const isCommon = (w) => vLevelOf.has(w.toLowerCase())
const rarity = (w) => vLevelOf.get(w.toLowerCase()) ?? MAX_V
const lex = {
  antonymsOf: (w) => antOf.get(w.toLowerCase()) ?? [],
  posOf: (w) => posOf.get(w.toLowerCase()) ?? null,
}

// ── 이미 있는 조합 ──────────────────────────────────────────────────
// 1,000행 조용한 절단에 두 번 당했다 — 나눠 받는다.
const existing = new Set()
const ids = usable.map((a) => a.id)
for (let i = 0; i < ids.length; i += 20) {
  const { data } = await db
    .from('csat_dcp_items')
    .select('ref_id, type, paragraph_idx')
    .eq('kind', 'article')
    .in('ref_id', ids.slice(i, i + 20))
    .limit(20000)
  for (const r of data ?? []) existing.add(`${r.ref_id}|${r.type}|${r.paragraph_idx}`)
}

// ── 후보 풀 (같은 밴드 안에서만 빌려 온다) ──────────────────────────
const poolByBand = new Map()
for (const a of usable) {
  const band = a.article_v_level ?? -1
  for (const p of paras(a.content)) {
    for (const s of sents(p)) {
      const n = s.split(/\s+/).length
      if (n < 8 || n > 20) continue
      const arr = poolByBand.get(band) ?? []
      arr.push({ text: s, ref: a.id })
      poolByBand.set(band, arr)
    }
  }
}

// ── 생성 ────────────────────────────────────────────────────────────
const rows = []
let skipped = 0
let woCandidates = 0
let woParagraphs = 0

for (const a of usable) {
  const band = a.article_v_level ?? -1
  const pool = poolByBand.get(band) ?? []
  const ps = paras(a.content)

  for (let pi = 0; pi < ps.length; pi++) {
    const ss = sents(ps[pi])

    // ① 흐름 무관 — 문단당 하나
    if (ss.length >= 5) {
      const item = buildIrrelevant(ss, pool, a.id, rarity)
      if (item) {
        const key = `${a.id}|irrelevant|${pi}`
        if (existing.has(key)) skipped++
        else
          rows.push({
            kind: 'article',
            ref_id: a.id,
            type: 'irrelevant',
            item_role: 'practice',
            paragraph_idx: pi,
            v_level: a.article_v_level,
            payload: { intro: item.intro, sentences: item.sentences },
            answer_key: {
              position: item.answer,
              foreign_ref: item.foreign.ref,
              overlap_gap: item.overlapGap,
            },
          })
      }
    }

    // ② 어휘 — 문단당 하나
    if (ss.length >= VOCAB_UNDERLINES) {
      const item = buildVocabChoice(ss, lex)
      if (item) {
        const key = `${a.id}|vocab_choice|${pi}`
        if (existing.has(key)) skipped++
        else
          rows.push({
            kind: 'article',
            ref_id: a.id,
            type: 'vocab_choice',
            item_role: 'practice',
            paragraph_idx: pi,
            v_level: a.article_v_level,
            payload: { sentences: item.sentences, underlines: item.underlines },
            answer_key: { position: item.answer, original: item.original },
          })
      }
    }

    // ③ 영작 배열 — 문단 안 후보 중 하나만 (유일키 제약)
    const cands = []
    for (let si = 0; si < ss.length; si++) {
      const item = buildWordOrder(ss[si], si > 0 ? ss[si - 1] : null, isCommon)
      if (item) cands.push({ item, si })
    }
    woCandidates += cands.length
    if (cands.length) {
      woParagraphs++
      // 가장 대표적인 문장 = 낱말 수가 후보 중앙값에 가장 가까운 것. 동점이면 앞선 문장.
      const lens = cands.map((c) => c.item.bank.length).sort((x, y) => x - y)
      const mid = lens[Math.floor(lens.length / 2)]
      cands.sort(
        (x, y) => Math.abs(x.item.bank.length - mid) - Math.abs(y.item.bank.length - mid) || x.si - y.si,
      )
      const { item, si } = cands[0]
      const key = `${a.id}|word_order|${pi}`
      if (existing.has(key)) skipped++
      else
        rows.push({
          kind: 'article',
          ref_id: a.id,
          type: 'word_order',
          item_role: 'practice',
          paragraph_idx: pi,
          v_level: a.article_v_level,
          payload: { bank: item.bank, context: item.context, sentence_idx: si },
          answer_key: { sentence: item.answer },
        })
    }
  }
}

const byType = {}
for (const r of rows) byType[r.type] = (byType[r.type] ?? 0) + 1

console.log('─'.repeat(72))
console.log(`글 ${usable.length}편 (ND 제외)\n`)
console.log(`  새로 넣을 문항  ${rows.length}`)
for (const [t, n] of Object.entries(byType)) console.log(`    ${t.padEnd(12)} ${n}`)
console.log(`  이미 있어 건너뜀 ${skipped}`)
console.log(
  `\n  영작 배열 — 후보 ${woCandidates}개가 문단 ${woParagraphs}개에 흩어져 있다.` +
    `\n    유일키가 문단당 하나만 받으므로 **${woCandidates - woParagraphs}개를 못 넣는다**` +
    ` (${((100 * (woCandidates - woParagraphs)) / (woCandidates || 1)).toFixed(1)}%).` +
    `\n    한 지문에 서술형 하나는 교재로서 자연스럽다. 더 필요해지면 유일키를 넓혀야 한다.`,
)

if (!commit) {
  console.log('\n  --commit 없이 실행했다. 아무것도 쓰지 않았다.')
  process.exit(0)
}

let inserted = 0
for (let i = 0; i < rows.length; i += 200) {
  const chunk = rows.slice(i, i + 200)
  const { error: e } = await db.from('csat_dcp_items').insert(chunk)
  // 조용히 삼키지 않는다 — 실패를 못 보면 "넣었다" 고 착각한다.
  if (e) throw new Error(`적재 실패 (${i}~${i + chunk.length}): ${e.message}`)
  inserted += chunk.length
}
console.log(`\n  적재 완료 ${inserted}건`)
