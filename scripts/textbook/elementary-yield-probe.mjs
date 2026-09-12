// scripts/textbook/elementary-yield-probe.mjs
//
// **초등 3종 수율 + 작동 검증.** 재료는 2022 개정 교육과정 기본어휘 별표(`kcurr2022_*`).
//
// ── 검증할 것 ────────────────────────────────────────────────────────
//   운율     보기 중 제시어와 **소리가 같은 것이 정확히 하나**인가
//   뜻       보기 넷의 뜻이 서로 다르고, 정답이 제시어의 뜻인가
//   철자     빈칸을 채우면 원문이 되고, **그 꼴에 맞는 사전 낱말이 하나뿐**인가
//
// 그리고 세 유형 다 **정답 번호가 한쪽으로 쏠리지 않는지** 본다.
//
// 밴드별로 따로 낸다 — 초등(kcurr2022_1)이 주 대상이지만 중등(_2)·고등(_0)에도 쓸 수 있다.
//
// 재실행 안전: 읽기만 한다.
// 실행: pnpm dlx tsx scripts/textbook/elementary-yield-probe.mjs [--sample]

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const showSample = process.argv.includes('--sample')

const { createClient } = await import('@supabase/supabase-js')
const { buildRhyme, buildWordMeaning, buildSpellBlank, countMatching, ELEMENTARY_CHOICES } =
  await import('@vocaflow/library-pipeline')

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})

// ── 사전 전체 (철자 완성의 유일성 판정에 쓴다) ──────────────────────
const allWords = new Set()
const rows = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from('shared_dictionary')
    .select('word, meaning_ko, rhyme_key, synonyms, list_tags')
    .order('word')
    .range(from, from + 999)
  if (error) throw new Error('사전 조회 실패: ' + error.message)
  if (!data?.length) break
  for (const r of data) {
    const w = String(r.word).toLowerCase()
    allWords.add(w)
    if ((r.list_tags ?? []).some((t) => String(t).startsWith('kcurr2022'))) rows.push(r)
  }
  if (data.length < 1000) break
}

// 별표 3단 — 저장소 문서(`wordset_pipeline_v2_p0_20260717.md`)가 확정한 대응이다:
//   kcurr2022_1 초등 · kcurr2022_2 중등 · kcurr2022_0 고등
const BAND = { kcurr2022_1: '초등', kcurr2022_2: '중등', kcurr2022_0: '고등' }
const pools = new Map()
for (const r of rows) {
  for (const t of r.list_tags ?? []) {
    if (!BAND[t]) continue
    const arr = pools.get(t) ?? []
    arr.push({
      word: String(r.word).toLowerCase(),
      meaningKo: String(r.meaning_ko ?? ''),
      rhymeKey: r.rhyme_key || null,
      synonyms: r.synonyms ?? [],
    })
    pools.set(t, arr)
  }
}

console.log(`사전 ${allWords.size} 낱말 · 교육과정 별표 ${rows.length} 낱말\n`)

const pct = (a, b) => (b ? ((100 * a) / b).toFixed(1) + '%' : '—')
const line = '─'.repeat(72)
const samples = { rhyme: [], word_meaning: [], spell_blank: [] }

for (const [tag, label] of Object.entries(BAND)) {
  const pool = (pools.get(tag) ?? []).filter((x) => /^[a-z]{2,12}$/.test(x.word) && x.meaningKo)
  if (!pool.length) continue

  const keyOf = new Map(pool.map((x) => [x.word, x.rhymeKey]))
  const stat = {
    rhyme: { n: 0, bad: 0, hist: new Array(ELEMENTARY_CHOICES).fill(0) },
    word_meaning: { n: 0, bad: 0, hist: new Array(ELEMENTARY_CHOICES).fill(0) },
    spell_blank: { n: 0, bad: 0 },
  }

  for (const p of pool) {
    // ① 운율
    const r = buildRhyme(p, pool)
    if (r) {
      stat.rhyme.n++
      stat.rhyme.hist[r.answer - 1]++
      const matching = r.choices.filter((c) => keyOf.get(c.text) === p.rhymeKey)
      if (matching.length !== 1 || r.choices[r.answer - 1].text !== r.answerText) stat.rhyme.bad++
      if (showSample && samples.rhyme.length < 3) samples.rhyme.push({ label, p, r })
    }
    // ② 뜻
    const m = buildWordMeaning(p, pool)
    if (m) {
      stat.word_meaning.n++
      stat.word_meaning.hist[m.answer - 1]++
      const texts = m.choices.map((c) => c.text)
      if (new Set(texts).size !== texts.length || m.choices[m.answer - 1].text !== m.answerText)
        stat.word_meaning.bad++
      if (showSample && samples.word_meaning.length < 3) samples.word_meaning.push({ label, p, r: m })
    }
    // ③ 철자
    const s = buildSpellBlank(p, allWords)
    if (s) {
      stat.spell_blank.n++
      const pattern = s.stem.split(' ').join('')
      const at = pattern.indexOf('_')
      const filled = pattern.slice(0, at) + s.answerText[at] + pattern.slice(at + 1)
      // 빈칸을 채우면 원문이 되어야 하고, 그 꼴에 맞는 낱말이 하나뿐이어야 한다.
      if (filled !== s.answerText || countMatching(pattern, allWords) !== 1) stat.spell_blank.bad++
      if (showSample && samples.spell_blank.length < 3) samples.spell_blank.push({ label, p, r: s })
    }
  }

  console.log(`${line}\n${label} (${tag}) — 어휘 ${pool.length}개\n`)
  const NAME = { rhyme: '파닉스 운율', word_meaning: '낱말 뜻', spell_blank: '철자 완성' }
  for (const [k, v] of Object.entries(stat)) {
    const extra =
      v.hist != null
        ? `  정답 번호 ${v.hist.map((n, i) => `${['①', '②', '③', '④'][i]} ${n}`).join(' · ')}` +
          ` (최다 ${pct(Math.max(...v.hist), v.n || 1)})`
        : '  (단답 — 번호 없음)'
    console.log(
      `  ${NAME[k].padEnd(12)} ${String(v.n).padStart(4)}  = ${pct(v.n, pool.length).padStart(6)}` +
        `   결함 ${v.bad}${extra}`,
    )
  }
  console.log()
}

if (showSample) {
  for (const [k, list] of Object.entries(samples)) {
    for (const { label, r } of list) {
      console.log(`${line}\n[${k}] ${label}\n`)
      console.log(`  ${r.promptKo}`)
      if (r.choices.length) {
        console.log(`    ${r.choices.map((c) => `${c.label} ${c.text}`).join('   ')}`)
        console.log(`\n  정답 ${['①', '②', '③', '④'][r.answer - 1]} ${r.answerText}`)
      } else {
        console.log(`    ${r.stem}`)
        console.log(`\n  정답 ${r.answerText}`)
      }
      console.log()
    }
  }
}
