// scripts/textbook/store-new-types.mjs
//
// **교재용 문항(흐름 무관 · 어휘 · 어법 · 영작 배열)을 `csat_dcp_items` 에 넣는다.**
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
// ── 규칙이 엄해지면 먼저 넣은 것이 낡는다 ────────────────────────────
// 인쇄 가능 판정(`isPrintablePassage`)이 나중에 엄해지면 **그 전에 넣은 문항은 새 규칙을
// 못 받는다.** 그래서 매 실행이 기존 문항도 다시 재고, 지금 규칙으로 못 실을 것을 센다.
// **세는 것과 지우는 것은 다른 스위치다** — 지우기는 `--prune` 을 줬을 때만 한다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/store-new-types.mjs            # 몇 개 늘고 몇 개 낡았는지만 본다
//   pnpm dlx tsx scripts/textbook/store-new-types.mjs --commit   # 새 문항 적재
//   pnpm dlx tsx scripts/textbook/store-new-types.mjs --prune    # 낡은 문항 삭제 (되돌릴 수 없다)

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const commit = process.argv.includes('--commit')
// 지우기는 별도 플래그다 — 되돌릴 수 없는 동작을 적재와 같은 스위치에 묶지 않는다.
const prune = process.argv.includes('--prune')

const { createClient } = await import('@supabase/supabase-js')
const {
  buildIrrelevant,
  buildWordOrder,
  buildVocabChoice,
  buildGrammarChoice,
  isPrintablePassage,
  CSAT_ITEM_WORDS,
  GRAMMAR_UNDERLINES,
  VOCAB_UNDERLINES,
} = await import('@vocaflow/library-pipeline')

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

    // ③ 어법 — 문단당 하나
    if (ss.length >= GRAMMAR_UNDERLINES) {
      const item = buildGrammarChoice(ss)
      if (item) {
        const key = `${a.id}|grammar_choice|${pi}`
        if (existing.has(key)) skipped++
        else
          rows.push({
            kind: 'article',
            ref_id: a.id,
            type: 'grammar_choice',
            item_role: 'practice',
            paragraph_idx: pi,
            v_level: a.article_v_level,
            payload: { sentences: item.sentences, underlines: item.underlines },
            answer_key: { position: item.answer, original: item.original, rule: item.rule },
          })
      }
    }

    // ④ 영작 배열 — 문단 안 후보 중 하나만 (유일키 제약)
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

// ── 이미 넣은 것 중 지금 규칙으로는 실을 수 없는 것 ─────────────────
//
// 규칙이 나중에 엄해지면 **먼저 넣은 것이 그 규칙을 못 받는다.** 2026-08-21 에
// 용어풀이 필터(`isPrintablePassage`)를 넣었는데, 그 전에 적재한 어휘 문항 중 일부가
// VOA 기사 끝 용어풀이를 지문에 달고 있었다. 교재에 그대로 인쇄되면 안 된다.
//
// 여기서는 **세기만** 한다. 지우는 것은 `--prune` 을 줬을 때뿐이다.
//
// 낡음의 정의는 **"지금 규칙으로 다시 만들면 다른 것이 나온다"** 이다. 인쇄 가능 여부만
// 보던 첫 판은 좁았다 — 2026-08-21 에 지문을 규격 구간으로 잘라 쓰도록 바꾸자
// **저장본의 지문 자체가 달라졌는데** 그 판정으로는 하나도 안 걸렸을 것이다.
const rebuilders = {
  vocab_choice: (ss) => {
    const it = buildVocabChoice(ss, lex)
    return it && { payload: { sentences: it.sentences, underlines: it.underlines }, answer: it.answer }
  },
  grammar_choice: (ss) => {
    const it = buildGrammarChoice(ss)
    return it && { payload: { sentences: it.sentences, underlines: it.underlines }, answer: it.answer }
  },
}

// (글, 문단) → 문장들. 재생성 대조에 쓴다.
const paragraphOf = new Map()
for (const a of usable) {
  const ps = paras(a.content)
  for (let pi = 0; pi < ps.length; pi++) paragraphOf.set(`${a.id}|${pi}`, sents(ps[pi]))
}

const stale = []
for (let i = 0; i < ids.length; i += 20) {
  const { data } = await db
    .from('csat_dcp_items')
    .select('id, type, ref_id, paragraph_idx, payload, answer_key')
    .eq('kind', 'article')
    .in('type', ['irrelevant', 'vocab_choice', 'grammar_choice'])
    .in('ref_id', ids.slice(i, i + 20))
    .limit(20000)
  for (const r of data ?? []) {
    const text = [r.payload?.intro, ...(r.payload?.sentences ?? [])].filter(Boolean).join(' ')
    if (text && !isPrintablePassage(text)) {
      stale.push({ id: r.id, type: r.type, why: '인쇄 불가' })
      continue
    }
    // 교재용 유형은 완성본이 수능 지문 규격(90~200어) 안이어야 한다.
    // `irrelevant` 는 재생성 대조를 못 한다(후보 풀이 그때그때 다르다) — 규격으로만 본다.
    const n = text ? text.split(/\s+/).filter(Boolean).length : 0
    if (n && (n < CSAT_ITEM_WORDS.min || n > CSAT_ITEM_WORDS.max)) {
      stale.push({ id: r.id, type: r.type, why: `지문 규격 밖 (${n}어)` })
      continue
    }
    const rebuild = rebuilders[r.type]
    if (!rebuild) continue
    const ss = paragraphOf.get(`${r.ref_id}|${r.paragraph_idx}`)
    if (!ss) continue
    const now = rebuild(ss)
    // 지금 규칙으로는 아예 안 만들어지거나, 만들어도 내용이 다르면 낡은 것이다.
    if (!now) {
      stale.push({ id: r.id, type: r.type, why: '지금 규칙으로는 안 만들어짐' })
    } else if (
      JSON.stringify(now.payload.sentences) !== JSON.stringify(r.payload?.sentences) ||
      now.answer !== r.answer_key?.position
    ) {
      stale.push({ id: r.id, type: r.type, why: '다시 만들면 달라짐' })
    }
  }
}
if (stale.length) {
  const byStaleType = {}
  for (const s of stale) {
    const k = `${s.type} — ${s.why}`
    byStaleType[k] = (byStaleType[k] ?? 0) + 1
  }
  console.log(`\n  ⚠️ 지금 규칙으로 낡은 기존 문항 ${stale.length}건`)
  for (const [k, n] of Object.entries(byStaleType).sort((a, b) => b[1] - a[1])) {
    console.log(`       ${k.padEnd(40)} ${n}`)
  }
  console.log('     --prune 으로 지운 뒤 --commit 으로 다시 넣는다 (지우기는 되돌릴 수 없다).')
}

if (!commit && !prune) {
  console.log('\n  --commit 없이 실행했다. 아무것도 쓰지 않았다.')
  process.exit(0)
}

if (prune && stale.length) {
  for (let i = 0; i < stale.length; i += 200) {
    const chunk = stale.slice(i, i + 200).map((s) => s.id)
    const { error: e } = await db.from('csat_dcp_items').delete().in('id', chunk)
    if (e) throw new Error(`삭제 실패: ${e.message}`)
  }
  console.log(`\n  삭제 완료 ${stale.length}건`)
}

if (!commit) process.exit(0)

let inserted = 0
for (let i = 0; i < rows.length; i += 200) {
  const chunk = rows.slice(i, i + 200)
  const { error: e } = await db.from('csat_dcp_items').insert(chunk)
  // 조용히 삼키지 않는다 — 실패를 못 보면 "넣었다" 고 착각한다.
  if (e) throw new Error(`적재 실패 (${i}~${i + chunk.length}): ${e.message}`)
  inserted += chunk.length
}
console.log(`\n  적재 완료 ${inserted}건`)
