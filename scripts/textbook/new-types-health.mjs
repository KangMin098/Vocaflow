// scripts/textbook/new-types-health.mjs
//
// **새로 만든 5유형의 품질을 잰다 — 지금까지는 수율만 알고 결함률을 몰랐다.**
//
// ── 수율과 품질은 다른 것이다 ────────────────────────────────────────
// Cycle 4~6 에서 다섯 유형을 만들고 수율을 실측했다(55.8% · 18.6% · 63.3% · 22.1% · —).
// 그런데 수율은 "문항이 나온다" 이지 "문항이 좋다" 가 아니다. 나온 문항이
// 읽지 않고 찍어서 맞거나, 정답이 둘이거나, 한 밴드에만 쏠려 있으면 재고가 아니라 부채다.
//
// ── 무엇을 재는가 ────────────────────────────────────────────────────
//   ① 정답 번호 쏠림   `assessStock` 의 카이제곱 (객관식 3종)
//   ② 지문 규격 이탈   중등 규격 40~120어 밖 (객관식 2종)
//   ③ 밴드 분포        비어 있는 학년이 곧 못 만드는 교재다
//   ④ **빈칸 단서의 유일성**  ← 여기가 핵심이다
//
// ④ 를 따로 재는 이유: `buildBlankWord` 는 "첫 글자 + 우리말 뜻이 붙으면 답이 하나로
// 좁혀진다" 는 **가정 위에 서 있는데, 그 가정을 잰 적이 없다.** 사전에 같은 첫 글자 ·
// 같은 첫 뜻을 가진 낱말이 둘 이상이면 학습자가 맞는 답을 써도 틀렸다고 채점된다.
// 사전으로 확인할 수 있는 것을 확인 안 하고 두면, `elementary.ts` 의 철자 완성이
// `c_t`(cat·cot·cut) 를 걸러 내는 것과 같은 실수를 반복하는 것이다.
//
// 재실행 안전: 읽기만 한다. 문항을 저장하지 않는다.
//
// 실행: pnpm dlx tsx scripts/textbook/new-types-health.mjs

import fs from 'node:fs'
import path from 'node:path'

for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}

const { createClient } = await import('@supabase/supabase-js')
const {
  buildBlankWord,
  buildGrammarFix,
  buildUnitVocab,
  buildUnitGrammar,
  buildListenChoose,
  assessStock,
  MIDDLE_ITEM_WORDS,
} = await import('@vocaflow/library-pipeline')

const db = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

/** 뜻의 첫 갈래 — `elementary.ts` 의 `firstSense` 와 같은 규칙을 쓴다. */
const firstSense = (s) => String(s).split(/[;,·/]|\s\d[.)]/)[0].trim()

// ── 사전 ────────────────────────────────────────────────────────────
const byWord = new Map()
const pool = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await db
    .from('shared_dictionary')
    .select('word, meaning_ko, list_tags')
    .not('meaning_ko', 'is', null)
    .range(from, from + 999)
  if (error) throw new Error('사전 조회 실패: ' + error.message)
  if (!data?.length) break
  for (const r of data) {
    const w = String(r.word ?? '').toLowerCase()
    if (!w || byWord.has(w)) continue
    const e = { word: w, meaningKo: String(r.meaning_ko), rhymeKey: null, tags: r.list_tags ?? [] }
    byWord.set(w, e)
    pool.push(e)
  }
  if (data.length < 1000) break
}
console.log(`사전 ${pool.length.toLocaleString()} 낱말\n`)

/**
 * **④ 빈칸 단서의 유일성** — 첫 글자 + 첫 뜻이 같은 낱말이 사전에 몇 개인가.
 * 1 이면 단서가 답을 확정한다. 2 이상이면 채점이 갈릴 수 있다.
 */
const hintIndex = new Map()
for (const e of pool) {
  const key = `${e.word[0]}|${firstSense(e.meaningKo)}`
  hintIndex.set(key, (hintIndex.get(key) ?? 0) + 1)
}
const hintUnique = (word, meaning) => (hintIndex.get(`${word[0]}|${meaning}`) ?? 0) <= 1
const hintAmbiguity = (word) => hintIndex.get(`${word[0]}|${firstSense(byWord.get(word).meaningKo)}`) ?? 0

const meaningOf = (w) => (byWord.has(w) ? firstSense(byWord.get(w).meaningKo) : null)
const lookup = (w) => byWord.get(w) ?? null

// ── 지문 ────────────────────────────────────────────────────────────
const { data: arts, error } = await db
  .from('library_articles')
  .select('id, article_v_level, display_only, content')
  .not('content', 'is', null)
if (error) throw new Error('지문 조회 실패: ' + error.message)

const items = []
const ambiguous = []
let blankTotal = 0
let blankAmbiguous = 0

for (const a of arts ?? []) {
  if (a.display_only) continue
  const v = a.article_v_level ?? null
  for (const para of String(a.content).split(/\n+/)) {
    const sents = para.split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter(Boolean)
    if (sents.length < 2) continue

    // 객관식 2종 — 답지 4개라 쏠림을 잴 수 있다.
    const uv = buildUnitVocab(sents, lookup, pool.slice(0, 400))
    if (uv) {
      items.push({
        id: `uv:${a.id}:${uv.target}`,
        type: 'unit_vocab',
        answer: uv.answer,
        choiceCount: 4,
        passageWords: uv.sentences.join(' ').split(/\s+/).filter(Boolean).length,
        vLevel: v,
      })
    }
    const ug = buildUnitGrammar(sents)
    if (ug) {
      items.push({
        id: `ug:${a.id}:${ug.answer}`,
        type: 'unit_grammar',
        answer: ug.answer,
        choiceCount: 4,
        passageWords: ug.sentences.join(' ').split(/\s+/).filter(Boolean).length,
        vLevel: v,
      })
    }

    // 단답 2종 — 정답 번호가 없으므로 쏠림 대신 **단서 유일성**을 본다.
    for (let i = 0; i < sents.length; i++) {
      const ctx = i > 0 ? sents[i - 1] : null
      const bw = buildBlankWord(sents[i], ctx, meaningOf, hintUnique)
      if (bw) {
        blankTotal++
        const n = hintAmbiguity(bw.answerText)
        if (n > 1 && ambiguous.length < 10) ambiguous.push({ word: bw.answerText, n, hint: bw.hint })
        if (n > 1) blankAmbiguous++
        items.push({
          id: `bw:${a.id}:${i}`,
          type: 'blank_word',
          answer: 0,
          choiceCount: 0,
          passageWords: null,
          vLevel: v,
        })
      }
      const gf = buildGrammarFix(sents[i], ctx)
      if (gf) {
        items.push({
          id: `gf:${a.id}:${i}`,
          type: 'grammar_fix',
          answer: 0,
          choiceCount: 0,
          passageWords: null,
          vLevel: v,
        })
      }
    }
  }
}

// ── 듣고 고르기 — 교육과정 초등 어휘로만 만든다(지문과 무관) ──────────
const elementary = pool.filter((e) => (e.tags ?? []).includes('kcurr2022_1'))
// 실제 음원 존재 확인은 media-probe 가 했다(94.2%). 여기서는 **문항 모양**만 본다 —
// 있다고 가정하고 만들면 쏠림·중복 같은 구조 결함이 드러난다.
const fakeAudio = (w) => ({ url: `https://example/En-us-${w}.ogg`, attribution: 'Commons · CC BY-SA 3.0' })
let listenMade = 0
for (const e of elementary) {
  const it = buildListenChoose(e, elementary, fakeAudio)
  if (!it) continue
  listenMade++
  items.push({ id: `lc:${e.word}`, type: 'listen_choose', answer: it.answer, choiceCount: 4, passageWords: null, vLevel: 2 })
}

// ── 판정 ────────────────────────────────────────────────────────────
const health = assessStock(items, MIDDLE_ITEM_WORDS)
const pad = (s, n) => String(s).padEnd(n)
console.log(pad('유형', 16) + pad('문항', 9) + pad('정답 쏠림', 26) + pad('규격 밖', 12) + '밴드')
console.log('─'.repeat(104))
for (const t of health.byType) {
  const bias = t.answerBias
    ? t.answerBias.biased
      ? `⚠ 쏠림 χ²=${t.answerBias.chi2.toFixed(1)} 최다 ${(100 * t.answerBias.maxShare).toFixed(1)}%`
      : `정상 (최다 ${(100 * t.answerBias.maxShare).toFixed(1)}%)`
    : '— (단답)'
  const oos = t.outOfSpecPassage == null ? '—' : `${t.outOfSpecPassage} (${((100 * t.outOfSpecPassage) / t.count).toFixed(1)}%)`
  const bands = Object.entries(t.byLevel).sort().map(([k, n]) => `${k}:${n}`).join(' ')
  console.log(pad(t.type, 16) + pad(t.count.toLocaleString(), 9) + pad(bias, 26) + pad(oos, 12) + bands.slice(0, 46))
}
console.log('─'.repeat(104))
console.log(`합계 ${health.total.toLocaleString()} · 실사용 관측 ${health.noObservations ? '없음 (csat_item_attempts 0행)' : '있음'}`)

console.log(`\n④ 빈칸 단서의 유일성 — 첫 글자 + 첫 뜻이 답을 하나로 좁히는가`)
console.log(`   빈칸 문항 ${blankTotal.toLocaleString()} 중 단서가 겹치는 것 ${blankAmbiguous.toLocaleString()} (${((100 * blankAmbiguous) / Math.max(1, blankTotal)).toFixed(2)}%)`)
for (const a of ambiguous) console.log(`     · ${a.word} — 같은 단서 낱말 ${a.n}개 · 단서 "${a.hint}"`)

console.log(`\n듣고 고르기 — 교육과정 초등 어휘 ${elementary.length}개 중 ${listenMade}개 생성 (${((100 * listenMade) / Math.max(1, elementary.length)).toFixed(1)}%)`)

fs.writeFileSync(
  'scripts/textbook/new-types-health.json',
  JSON.stringify(
    { measured_at: new Date().toISOString(), health, blank: { total: blankTotal, ambiguous: blankAmbiguous, samples: ambiguous }, listen: { pool: elementary.length, made: listenMade } },
    null,
    2,
  ),
)
console.log('\n→ scripts/textbook/new-types-health.json')
