// scripts/csat/measure-extract-defects.mjs
//
// **발췌기 결함이 몇 편에 있는지 센다 — 읽기 전용. 고치지 않는다.**
//
// ── 왜 세는가 ────────────────────────────────────────────────────────
// 게이트 판정자 21명이 독립적으로 같은 것을 지목했다(실측 2026-09-07): PLOS 발췌의
// 탈락 사유 대부분이 **원문의 문제가 아니라 잘라 낸 자리의 문제**라는 것이다.
// 그런데 **의견이 갈렸다** — 한쪽은 "기계 규칙으로 잡자", 다른 쪽은 "정상 지문이
// 함께 걸린다, 영향 측정 먼저". 그래서 규칙을 넣기 전에 **적중 편수와 오탐률**을 센다.
//
// ⚠️ **오탐률이 이 파일의 존재 이유다.** 적중 편수만 세면 "1,000편이나 걸린다" 는
//   말이 규칙을 넣을 근거처럼 보인다. 그런데 그중 900편이 이미 `use` 로 판정된
//   멀쩡한 글이면 그 규칙은 **채택량을 900편 깎는다.** 판정 결과와 대조해야만
//   그 사실이 드러난다.
//
// 재실행 안전: 청크 파일만 읽는다. DB 도 안 보고 아무것도 안 쓴다.
//
// 실행: node scripts/csat/measure-extract-defects.mjs [--sample 3]

import fs from 'node:fs'
import path from 'node:path'

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`)
  return i > 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d
}
const SAMPLE = Number(arg('sample', 2))

const DRAINS = ['scripts/csat/gate-drain', 'scripts/csat/gate-article-drain']
  .map((d) => path.resolve(d))
  .filter((d) => fs.existsSync(d))

/**
 * 결함 탐지기 — 발췌 문자열 하나를 받아 걸리면 true.
 *
 * ⚠️ 각 규칙은 **판정자가 실제로 인용한 사례**에서 뽑았다. 상상해서 만든 규칙은 없다.
 */
const DETECTORS = {
  /**
   * 수식 소실 — 참조 번호만 남고 식이 사라진다.
   * 판정자 인용: `(23)where is the current loop c`, `estimates of and.`,
   *   `The point estimate is, where denotes`, `(9)(10)Where and correspond to`
   * 신호는 둘이다: ① 괄호 숫자 뒤에 바로 where 가 붙음 ② 전치사·관사 뒤가 비어
   *   `of and` `is, where` 처럼 **기호가 있어야 할 자리에 아무것도 없다**.
   */
  'formula-stripped': (s) =>
    /\(\d+\)\s*(?:where|Where)\b/.test(s) ||
    /\b(?:of|is|be|to|than|between)\s+and\b[\s,.]/.test(s) ||
    /\b(?:denotes|equals|represents)\s*[,.]/.test(s),

  /**
   * 축약 학명 절단 — `K. pneumoniae` 의 `K.` 를 문장 끝으로 오인해 자른다.
   * 판정자 인용: `in T.`, `by S. F`, `(hereafter B. Following a tick bite`,
   *   `Xanthomonas citri subsp. Citrus canker`
   * ⚠️ 이 규칙이 가장 위험하다 — 정상 문장의 이니셜(`J. Smith`)·약어(`U.S.`)와 겹친다.
   */
  'species-abbrev-cut': (s) =>
    /\b(?:subsp|var|spp|sp)\.\s+[A-Z]/.test(s) ||
    /\b[A-Z]\.\s+(?:Following|The|In|At|This|These|A|An)\b/.test(s) ||
    /\b(?:in|by|of|with|from)\s+[A-Z]\.\s*$/.test(s),

  /**
   * 초록+서론 접합 — **한 발췌 조각 안에서** 같은 문장이 두 번 나온다.
   * ⚠️ **발췌 조각 사이의 겹침은 결함이 아니다**(슬라이딩 창). 판정자 다수가 이 둘을
   *   섞어 봤다 — 여기서는 **조각 하나 안에서만** 센다.
   */
  'abstract-dup': (s) => {
    const sents = s
      .split(/(?<=[.!?])\s+/)
      .map((x) => x.trim())
      .filter((x) => x.length >= 40)
    return new Set(sents).size < sents.length
  },

  /**
   * 절 제목·캡션 혼입 — 본문 한복판에 절 제목이나 그림 지시가 그대로 남았다.
   * 판정자 인용: `Methodology 2.1 Study area`, `Materials and`,
   *   `(A) The correlation…`, `Data Source: NOAA`, `Note: … Source: Prepared by`
   */
  'section-caption': (s) =>
    /\b(?:Methods?|Methodology|Materials and Methods|Results|Discussion|Introduction)\s+\d+\.\d+\s/.test(s) ||
    /\((?:[A-Ha-h])\)\s+[A-Z]/.test(s) ||
    /\b(?:Data Source|Source:|Note:|Fig\s?\d|Figure\s?\d|Table\s?\d)\b/.test(s),
}

const rows = []
for (const dir of DRAINS) {
  for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.out.json')).sort()) {
    let items
    try {
      items = JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8'))
    } catch {
      continue
    }
    if (!Array.isArray(items)) continue
    for (const it of items) {
      if (!Array.isArray(it.excerpts)) continue
      const hit = {}
      for (const [name, fn] of Object.entries(DETECTORS)) {
        hit[name] = it.excerpts.some((e) => typeof e === 'string' && fn(e))
      }
      rows.push({ file: f, source: it.source ?? '?', verdict: it.verdict, genre: it.genre, book: it.book, hit, ex: it.excerpts })
    }
  }
}

console.log('발췌기 결함 실측 — 읽기 전용, 아무것도 고치지 않는다')
console.log('='.repeat(78))
console.log(`  판정된 글 ${rows.length.toLocaleString()}편 (청크 ${new Set(rows.map((r) => r.file)).size}개)`)

const plos = rows.filter((r) => r.source === 'plos')
console.log(`  그중 plos ${plos.length.toLocaleString()}편 — 아래 표는 plos 만 센다\n`)

const pad = (s, n) => String(s).padEnd(n)
const num = (s, n) => String(s).padStart(n)

console.log(
  `  ${pad('결함', 22)}${num('적중', 7)}${num('그중 reject', 12)}${num('그중 use', 10)}${num('오탐률', 9)}`,
)
console.log('  ' + '-'.repeat(60))

const summary = {}
for (const name of Object.keys(DETECTORS)) {
  const hit = plos.filter((r) => r.hit[name])
  const rej = hit.filter((r) => r.verdict === 'reject')
  const use = hit.filter((r) => r.verdict !== 'reject')
  const fp = hit.length ? ((use.length / hit.length) * 100).toFixed(1) + '%' : '—'
  summary[name] = { hit: hit.length, rej: rej.length, use: use.length }
  console.log(`  ${pad(name, 22)}${num(hit.length.toLocaleString(), 7)}${num(rej.length.toLocaleString(), 12)}${num(use.length.toLocaleString(), 10)}${num(fp, 9)}`)
}

// ── 되살릴 수 있는 몫 ────────────────────────────────────────────────
// 결함 때문에 떨어진 것 = reject 인데 결함 적중. 발췌기를 고치면 이 몫이 후보로 돌아온다.
const rejected = plos.filter((r) => r.verdict === 'reject')
const rescuable = rejected.filter((r) => Object.keys(DETECTORS).some((k) => r.hit[k]))
console.log('')
console.log(`  plos 탈락 ${rejected.length.toLocaleString()}편 중 결함이 잡힌 것 **${rescuable.length.toLocaleString()}편**`)
console.log(`  = 발췌기를 고치면 다시 후보가 될 수 있는 상한 (${((rescuable.length / (rejected.length || 1)) * 100).toFixed(1)}%)`)
console.log(`  나머지 ${(rejected.length - rescuable.length).toLocaleString()}편은 규칙에 안 걸린다 — 고쳐도 안 돌아온다`)

console.log('')
console.log('  ⚠️ 오탐률 = 적중한 것 중 판정자가 "쓸 만하다" 고 한 비율.')
console.log('     이 비율이 높은 규칙을 export 에 넣으면 **멀쩡한 지문이 그만큼 사라진다.**')

if (SAMPLE > 0) {
  console.log('')
  console.log('  실례 (오탐 = use 인데 규칙에 걸린 것)')
  console.log('  ' + '-'.repeat(74))
  for (const name of Object.keys(DETECTORS)) {
    const fps = plos.filter((r) => r.hit[name] && r.verdict !== 'reject').slice(0, SAMPLE)
    if (!fps.length) continue
    console.log(`  · ${name}`)
    for (const r of fps) {
      const e = r.ex.find((x) => DETECTORS[name](x)) ?? ''
      const m = e.slice(0, 110).replace(/\s+/g, ' ')
      console.log(`      ${r.verdict}/${r.genre} — …${m}…`)
    }
  }
}
