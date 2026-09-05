// scripts/textbook/passage-ruler-check.mjs
//
// **집필 중 되먹임 자** — 청크(.out.json)의 지문마다 두 축을 낱말 단위로 보여 준다.
//
// ── 왜 필요한가 (실측 2026-09-05) ────────────────────────────────────
// 집필 명세에 시중 목표(교육과정 밖 비율 ~30%)를 적어 주고 **직접 겨냥해 썼는데도**
// 5편 중 2편이 하한 아래(14.6 · 22.9), ≥60 은 1편, V-Level 적중은 3편 중 1편이었다.
// 저자는 어떤 낱말이 3,000 안인지, 어떤 낱말이 V4 이상인지 **감으로 알 수 없다.**
// 비율·등급만 돌려주면 못 고친다 — **어느 낱말을 바꾸면 되는지**를 보여 줘야 한다.
//
// 이 도구는 적재기(`write-drain-import.mjs`)와 **같은 자**를 쓴다:
//   · 어휘 축: `classifyCurriculumWords` · `marketPercentile` (curriculum.ts)
//   · 밴드 축: `extractBookLemmas` → shared_dictionary v_level → p75 (적재기 계산 그대로)
// 여기서 통과한 것이 적재기에서 떨어지면 자가 갈린 것이다.
//
// 재실행 안전: 읽기만 한다. DB 는 shared_dictionary 조회만.
//
// 실행:
//   pnpm dlx tsx scripts/textbook/passage-ruler-check.mjs --dir scripts/textbook/write-drain/v3 --band 3
//   pnpm dlx tsx scripts/textbook/passage-ruler-check.mjs --file <chunk-00.out.json> --band 3 --aim 60

import fs from 'node:fs'
import path from 'node:path'

import { loadEnv, fetchAllIn } from './volume-pool.mjs'
loadEnv()

const arg = (n) => {
  const i = process.argv.indexOf(`--${n}`)
  return i >= 0 ? process.argv[i + 1] : null
}
const BAND = arg('band') != null ? Number(arg('band')) : null
/** 겨냥하는 시중 자리. 목표 "시중 대비 120%" = 50 × 1.2 = **60**. */
const AIM = Number(arg('aim') ?? 60)
const MIN_MARKET = Number(arg('min-market') ?? 25)
/**
 * `--annotate` — **본문을 등급 표시와 함께 찍는다.**
 *
 * ── 왜 (2026-09-06) ──────────────────────────────────────────────────
 * 세 사이클을 고쳐 쓰고도 겨냥(60)에 못 닿았다. 매번 같은 자리에서 막혔다 —
 * 밖% 를 올리려고 낱말을 바꾸면 V-Level 이나 FK 가 튀고, 되돌리면 밖% 가 내려간다.
 * 진짜 병목은 **쓰는 동안 어느 낱말이 교육과정 안인지 밖인지 안 보인다**는 것이었다.
 * 목록만 봐서는 "이 문장의 이 낱말" 을 못 고른다.
 *
 * 그래서 본문 위에 직접 표시한다:
 *   [낱말]  = 교육과정 **밖** (이미 값에 기여하는 것 — 건드리지 말 것)
 *   ·낱말·  = 교육과정 **안**이면서 내용어 (**바꿀 후보**)
 *   나머지  = 기능어(분모에서 빠진다) — 바꿔도 값이 안 움직인다
 */
const ANNOTATE = process.argv.includes('--annotate')

const dir = path.resolve(arg('dir') ?? '.')
const files = arg('file')
  ? [path.resolve(arg('file'))]
  : fs
      .readdirSync(dir)
      .filter((f) => f.endsWith('.out.json'))
      .sort()
      .map((f) => path.join(dir, f))
if (!files.length) {
  console.log('.out.json 이 없다')
  process.exit(0)
}

const { createScriptClient } = await import('../lib/supabase-client.mjs')
const { readability, bandOf, gradeBand } =
  await import('../../packages/library-pipeline/src/textbook/readability.ts')
const { classifyCurriculumWords, curriculumOutsideWords, marketPercentile, CURRICULUM_SPEC } =
  await import('../../packages/library-pipeline/src/textbook/curriculum.ts')
const { extractBookLemmas } = await import('@vocaflow/library-pipeline')

const rows = files.flatMap((f) => JSON.parse(fs.readFileSync(f, 'utf8')))
console.log(
  `지문 ${rows.length}편 · 겨냥 시중 자리 ≥ ${AIM} · 하한 ${MIN_MARKET}${BAND != null ? ` · 목표 밴드 V${BAND}` : ''}\n`
)

// ── 밴드 축: 사전 V-Level 을 한 번에 받아 둔다 (적재기와 같은 계산) ──
const per = rows.map((r) => {
  const c = String(r.content ?? '')
  const idx = extractBookLemmas([
    {
      chapter_idx: 1,
      content: c,
      word_count: c.split(/\s+/).filter(Boolean).length,
      paragraph_offsets: [0],
      sentence_offsets: [0],
    },
  ])
  return { r, lemmas: [...idx.bookFrequency.keys()] }
})
const lv = new Map()
if (per.some((d) => d.lemmas.length)) {
  const db = createScriptClient({ quiet: true })
  const all = [...new Set(per.flatMap((d) => d.lemmas))]
  for (const d of await fetchAllIn(db, 'shared_dictionary', 'word, v_level', 'word', all, [
    'word',
  ])) {
    if (d.v_level != null && Number(d.v_level) !== 11) lv.set(d.word, Number(d.v_level))
  }
}
const pct = (s, q) =>
  s.length ? s[Math.max(0, Math.min(s.length - 1, Math.ceil(q * s.length) - 1))] : null

/** 시중 자리 → 그 학교급에서 필요한 밖% (`marketPercentile` 의 역함수 · 구간 선형). */
function outsideForPercentile(target, school) {
  const d = CURRICULUM_SPEC.outside[school]
  const P = [5, 25, 50, 75, 90, 95]
  const X = P.map((p) => d[`p${String(p).padStart(2, '0')}`])
  if (target <= P[0]) return +((target / P[0]) * X[0]).toFixed(1)
  for (let i = 1; i < P.length; i++) {
    if (target <= P[i]) {
      const t = (target - P[i - 1]) / (P[i] - P[i - 1])
      return +(X[i - 1] + t * (X[i] - X[i - 1])).toFixed(1)
    }
  }
  return X[X.length - 1]
}

let aimHit = 0
let floorFail = 0
let bandHit = 0
for (const { r, lemmas } of per) {
  const c = String(r.content ?? '')
  const m = readability(c)
  const bandId = m ? bandOf(m.fk) : '알 수 없음'
  const band = gradeBand(bandId)
  const words = classifyCurriculumWords(c)
  const n = words.length
  const outside = words.filter((w) => w.tier === 'outside').length
  const outsidePct = n ? +((outside / n) * 100).toFixed(1) : null
  const pos = band && outsidePct != null ? marketPercentile(outsidePct, band.school) : null
  // 고유명사를 뺀 값 — **이름이 만든 자리인지 가른다.**
  // 실측(2026-09-06): simple_wikipedia 79.5 → 52.0(-27.5)로 시중 중앙이었다("HBO"·"B'z"
  // 같은 백과 도입부). space_place 는 67.5 → 63.5 로 남는다. 두 값을 함께 봐야
  // "어려운 낱말" 과 "이름 덩어리" 를 가를 수 있다.
  const wordsNP = classifyCurriculumWords(c, { excludeProperNouns: true })
  const posNP =
    band && wordsNP.length
      ? marketPercentile(
          +((wordsNP.filter((w) => w.tier === 'outside').length / wordsNP.length) * 100).toFixed(1),
          band.school
        )
      : null

  console.log(`━━ 슬롯 ${r.slot ?? '?'} — ${String(r.title ?? '').slice(0, 60)}`)
  console.log(
    `   ${m?.words ?? '-'}어 · FK ${m?.fk ?? '-'} → ${bandId}` +
      (band
        ? ` (${band.school === 'elementary' ? '초등' : '중등'} 자)`
        : ' — 밴드 밖이라 시중 자리를 못 잰다')
  )
  if (band && pos != null) {
    const need = outsideForPercentile(AIM, band.school)
    const dWords = Math.ceil(((need - outsidePct) / 100) * n)
    const verdict =
      pos < MIN_MARKET
        ? '✗ 하한 미만 — 적재기가 거른다'
        : pos >= AIM
          ? '✓ 겨냥 도달'
          : '△ 하한은 넘었으나 겨냥 미달'
    if (pos >= AIM) aimHit++
    if (pos < MIN_MARKET) floorFail++
    console.log(
      `   어휘: 내용어 ${n} · 밖 ${outside} (${outsidePct}%) → 시중 자리 **${pos}**` +
        ` (이름 제외 ${posNP ?? '—'})   ${verdict}` +
        (pos < AIM
          ? `\n         겨냥 ${AIM} 에 닿으려면 밖% ${need} 필요 → 안 낱말 **약 ${Math.max(0, dWords)}개를 밖 낱말로** 바꾼다`
          : '')
    )
    const out = curriculumOutsideWords(c)
    console.log(
      `   밖 낱말(${out.length}종): ${out.map((x) => (x.n > 1 ? `${x.word}×${x.n}` : x.word)).join(' · ')}`
    )
  }
  if (ANNOTATE) {
    // 같은 토큰화를 쓴다 — 표시와 판정이 갈리면 표시를 믿을 수 없다.
    const tier = new Map()
    for (const x of words) if (!tier.has(x.word)) tier.set(x.word, x.tier)
    const marked = c.replace(/[A-Za-z][A-Za-z'-]*/g, (w) => {
      const t = tier.get(w.toLowerCase())
      if (t == null) return w // 기능어 — 분모 밖이다
      return t === 'outside' ? `[${w}]` : `·${w}·`
    })
    console.log('   ── 본문 ([밖] · ·안·(바꿀 후보) · 나머지는 기능어) ──')
    console.log(
      marked
        .split('\n')
        .map((l) => '   ' + l)
        .join('\n')
    )
    const inside = new Map()
    for (const x of words)
      if (x.tier !== 'outside') inside.set(x.word, (inside.get(x.word) ?? 0) + 1)
    const cand = [...inside.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    console.log(
      `   바꿀 후보(안 내용어 ${cand.length}종): ` +
        cand.map(([w, k]) => (k > 1 ? `${w}×${k}` : w)).join(' · ')
    )
  }

  // 밴드 축
  const levels = lemmas.map((w) => [w, lv.get(w)]).filter(([, v]) => Number.isFinite(v))
  const p75 = pct(
    levels.map(([, v]) => v).sort((a, b) => a - b),
    0.75
  )
  if (BAND != null && p75 === BAND) bandHit++
  const tail = levels.filter(([, v]) => BAND != null && v > BAND).sort((a, b) => b[1] - a[1])
  console.log(
    `   밴드: 사전 적중 ${levels.length}/${lemmas.length} 낱말 · p75 = V${p75 ?? '-'}` +
      (BAND != null
        ? ` ${p75 === BAND ? '✓' : `✗ (목표 V${BAND})`} · V${BAND + 1}+ 꼬리 ${tail.length}개: ${
            tail.map(([w, v]) => `${w}(V${v})`).join(' · ') || '없음'
          }`
        : '')
  )
  console.log()
}
console.log(
  `겨냥 ≥${AIM} 도달 ${aimHit}/${rows.length} · 하한 미만 ${floorFail}/${rows.length}` +
    (BAND != null ? ` · 밴드 V${BAND} 적중 ${bandHit}/${rows.length}` : '')
)
