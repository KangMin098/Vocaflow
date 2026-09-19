// scripts/textbook/authored-sweep.mjs
//
// **우리가 쓴 지문 전량 훑기 — 값 말고 나머지를 본다.**
//
// ── 왜 (2026-09-06) ──────────────────────────────────────────────────
// 시중 자리를 올리려고 368편을 전량 훑는 동안, 값과 무관한 결함이 계속 나왔다.
// 표본으로 나온 것이지 세어 본 것이 아니어서 **규모를 모른다.** 여기서 센다.
//
//   ① 규격 — 어수창(100~200)과 문장 하한(≥12)
//      실측 표본 10편 중 **다섯**이 문장 하한 밑이었다. 원인은 조판이다:
//      문장은 `(?<=[.!?])\s+` 로 세므로 **콜론·세미콜론은 문장이 아니다.**
//      한 문장에 44어를 물린 곳이 있었다.
//
//   ② 중복 — 같은 이야기·같은 논지가 여러 편
//      여덟 갈래를 눈으로 찾았다(V4↔V5 짝 · 나방 셋 · 근육통 셋 · …).
//      눈으로 찾은 것은 **한 배치에 우연히 함께 뽑힌 것들뿐**이다.
//
// 재실행 안전: 읽기만 한다. 아무것도 고치지 않는다.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/authored-sweep.mjs
//   pnpm dlx tsx scripts/textbook/authored-sweep.mjs --dup-top 40
//   pnpm dlx tsx scripts/textbook/authored-sweep.mjs --levels   # 사전 조회가 붙어 느리다

import { loadEnv, fetchAllPaged } from './volume-pool.mjs'
loadEnv()

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const DUP_TOP = Number(arg('dup-top') ?? 25)
/**
 * `--levels` — 저장된 `article_v_level` 이 **지금 본문**과 맞는지 잰다.
 *
 * ── 왜 (실측 2026-09-06) ─────────────────────────────────────────────
 * 개정 적재기는 `content` 와 `content_hash` 만 쓴다 — `article_v_level` 도
 * `word_count` 도 갱신하지 않는다. 139편을 고치는 동안 밴드 적중이 0~2/5 였으니
 * 저장값은 그만큼 본문에서 멀어졌다.
 *
 * 실측: 어수창 안 369편 중 **206편(55.8%)** 이 저장값 ≠ 실측값이고, 어긋남은
 * **언제나 위쪽**이다(V3→V4 59 · V3→V5 33 · V4→V5 32 · V4→V6 27 …).
 * 밖 낱말을 넣으면 p75 가 밀리기 때문이다.
 *
 * ⚠️ **그렇다고 바로 재계산하면 안 된다.** 재계산하면 사다리가 이렇게 된다:
 *     V3 125 → **29** · V6 0 → 48 · V7 0 → 25 · V8 0 → 3
 * V3 칸이 무너지고 V6~V8 에 76편이 생긴다. 라벨을 고치는 일이 아니라
 * **어느 계단에 무엇을 둘지** 의 문제다 — 사람이 정한다.
 */
const LEVELS = process.argv.includes('--levels')

const { createScriptClient } = await import('../lib/supabase-client.mjs')
const { PASSAGE_WORDS } = await import('../../packages/library-pipeline/src/textbook/readability.ts')
const { classifyCurriculumWords } =
  await import('../../packages/library-pipeline/src/textbook/curriculum.ts')

const db = createScriptClient({ quiet: true })

// ⚠️ `source_id` 로 정렬한다 — 쓸 수 있는 인덱스가 `(source, source_id)` 뿐이다.
//   `id` 로 정렬하면 계획이 전체 훑기로 바뀐다(실측: 75초 timeout → 1.9초).
const rows = await fetchAllPaged(
  db,
  (d) =>
    d
      .from('library_articles')
      .select('source_id, title, content, article_v_level')
      .eq('source', 'original')
      .is('feed_id', null)
      .order('source_id'),
  200
)

/** 적재기·자와 **같은** 문장 세기. 콜론·세미콜론은 문장이 아니다. */
const sentences = (c) => c.split(/(?<=[.!?])\s+/).filter((x) => x.trim().length > 1).length
const words = (c) => c.split(/\s+/).filter(Boolean).length
const SENT_MIN = 12

const docs = []
for (const r of rows) {
  const c = String(r.content ?? '')
  if (!c) continue
  const m = /^original:v(\d+)-(\d+)$/.exec(r.source_id ?? '')
  docs.push({
    id: r.source_id,
    band: m ? Number(m[1]) : null,
    slot: m ? Number(m[2]) : null,
    title: String(r.title ?? ''),
    w: words(c),
    s: sentences(c),
    // 중복 판정은 **교육과정 밖 낱말**로 한다. 기능어·일반 낱말은 어느 글에나 있어
    // 겹침을 재는 데 쓸모가 없다 — 소재를 가리키는 것은 밖 낱말이다.
    out: new Set(
      classifyCurriculumWords(c)
        .filter((x) => x.tier === 'outside')
        .map((x) => x.word)
    ),
  })
}

// ── ① 규격 ──────────────────────────────────────────────────────────
const shortSent = docs.filter((d) => d.s < SENT_MIN)
const wideWords = docs.filter((d) => d.w < PASSAGE_WORDS.min || d.w > PASSAGE_WORDS.max)
const bad = new Set([...shortSent, ...wideWords].map((d) => d.id))

console.log(`\n■ 우리 지문 ${docs.length}편 — 규격`)
console.log(
  `  문장 < ${SENT_MIN}       **${shortSent.length}편** (${((shortSent.length / docs.length) * 100).toFixed(1)}%)`
)
console.log(
  `  어수창 밖(${PASSAGE_WORDS.min}~${PASSAGE_WORDS.max})  **${wideWords.length}편**`
)
console.log(`  둘 중 하나라도  **${bad.size}편**`)
const byBand = new Map()
for (const d of docs) {
  const k = d.band ?? 0
  const v = byBand.get(k) ?? { n: 0, bad: 0 }
  v.n++
  if (bad.has(d.id)) v.bad++
  byBand.set(k, v)
}
console.log('\n  밴드별')
for (const k of [...byBand.keys()].sort((a, b) => a - b)) {
  const v = byBand.get(k)
  console.log(`    V${k}  ${String(v.n).padStart(3)}편 중 규격 밖 ${String(v.bad).padStart(3)}편`)
}
console.log(`\n  가장 짧은 문장 수 10편:`)
for (const d of [...shortSent].sort((a, b) => a.s - b.s).slice(0, 10))
  console.log(`    ${d.id.padEnd(18)} ${String(d.s).padStart(2)}문장 ${String(d.w).padStart(3)}어  ${d.title.slice(0, 44)}`)

// ── ② 중복 ──────────────────────────────────────────────────────────
// 밖 낱말 집합의 Jaccard. 같은 소재를 다루면 밖 낱말이 겹친다.
const jac = (a, b) => {
  let inter = 0
  const [s, l] = a.size < b.size ? [a, b] : [b, a]
  for (const x of s) if (l.has(x)) inter++
  return inter / (a.size + b.size - inter)
}
const pairs = []
for (let i = 0; i < docs.length; i++)
  for (let j = i + 1; j < docs.length; j++) {
    if (docs[i].out.size < 5 || docs[j].out.size < 5) continue
    const v = jac(docs[i].out, docs[j].out)
    if (v >= 0.18) pairs.push({ a: docs[i], b: docs[j], v })
  }
pairs.sort((x, y) => y.v - x.v)

const sameBand = pairs.filter((p) => p.a.band === p.b.band)
const twin = pairs.filter((p) => p.a.band !== p.b.band && p.a.slot === p.b.slot)
const cross = pairs.filter((p) => p.a.band !== p.b.band && p.a.slot !== p.b.slot)

console.log(`\n■ 중복 후보 (밖 낱말 Jaccard ≥ 0.18) — ${pairs.length}쌍`)
console.log(`  같은 밴드 안        **${sameBand.length}쌍**  ← 설계가 아니다`)
console.log(`  V4↔V5 같은 슬롯(짝)  ${twin.length}쌍  ← 설계`)
console.log(`  밴드 다름·슬롯 다름   ${cross.length}쌍`)
console.log(`\n  겹침이 큰 ${DUP_TOP}쌍:`)
for (const p of pairs.slice(0, DUP_TOP)) {
  const tag = p.a.band === p.b.band ? '같은밴드' : p.a.slot === p.b.slot ? '짝    ' : '교차  '
  console.log(
    `    ${p.v.toFixed(2)} ${tag} ${p.a.id.padEnd(17)} ${p.a.title.slice(0, 30).padEnd(31)}| ${p.b.id.padEnd(17)} ${p.b.title.slice(0, 30)}`
  )
}

// ── ③ 저장된 레벨이 본문과 맞는가 (--levels) ────────────────────────
if (LEVELS) {
  const { fetchAllIn } = await import('./volume-pool.mjs')
  const { extractBookLemmas } = await import('@vocaflow/library-pipeline')
  const inWin = rows.filter((r) => {
    const w = words(String(r.content ?? ''))
    return /^original:v\d+-\d+$/.test(r.source_id ?? '') && w >= PASSAGE_WORDS.min && w <= PASSAGE_WORDS.max
  })
  const per = inWin.map((r) => {
    const c = String(r.content)
    const idx = extractBookLemmas([
      { chapter_idx: 1, content: c, word_count: words(c), paragraph_offsets: [0], sentence_offsets: [0] },
    ])
    return { r, lemmas: [...idx.bookFrequency.keys()] }
  })
  const all = [...new Set(per.flatMap((d) => d.lemmas))]
  const lv = new Map()
  for (const d of await fetchAllIn(db, 'shared_dictionary', 'word, v_level', 'word', all, ['word']))
    if (d.v_level != null && Number(d.v_level) !== 11) lv.set(d.word, Number(d.v_level))
  const pct = (s2, q) =>
    s2.length ? s2[Math.max(0, Math.min(s2.length - 1, Math.ceil(q * s2.length) - 1))] : null
  let same = 0
  let diff = 0
  const before = new Map()
  const after = new Map()
  for (const { r, lemmas } of per) {
    const vs = lemmas.map((w) => lv.get(w)).filter(Number.isFinite).sort((a, b) => a - b)
    const p75 = pct(vs, 0.75)
    const b = r.article_v_level ?? 'null'
    before.set(b, (before.get(b) ?? 0) + 1)
    after.set(p75 ?? 'null', (after.get(p75 ?? 'null') ?? 0) + 1)
    if (p75 == null) continue
    if (r.article_v_level === p75) same++
    else diff++
  }
  console.log('')
  console.log(`■ 저장된 article_v_level vs 지금 본문 (어수창 안 ${inWin.length}편)`)
  console.log(`  일치 ${same} · **불일치 ${diff}** (${((diff / (same + diff)) * 100).toFixed(1)}%)`)
  console.log('')
  console.log('  재계산하면 사다리가 이렇게 바뀐다 — **적용 전에 사람이 볼 것**')
  const keys = [...new Set([...before.keys(), ...after.keys()])].sort(
    (x, y) => (x === 'null' ? 99 : x) - (y === 'null' ? 99 : y)
  )
  console.log('    레벨   지금    재계산 후')
  for (const k of keys)
    console.log(
      `    V${String(k).padEnd(4)} ${String(before.get(k) ?? 0).padStart(5)}  →  ${String(after.get(k) ?? 0).padStart(5)}`
    )
}
