// scripts/csat/measure-listening.mjs
//
// **듣기 17문항의 설계를 잰다 — 설계도에서 통째로 빠져 있던 34점 구간.**
//
// 세 가지를 잰다:
//   ① **유형별 대본 규모** — 읽기 지문 길이표의 듣기 판. 지금까지 이 표가 없었다
//   ② **듣기 vs 읽기 부담** — 회차당 낱말 수를 견준다
//   ③ **1:1 순서 대응이 듣기에도 성립하는가** — 읽기에서 확인한 P6.25 를 듣기로 확장.
//      선택지가 한글이므로 **번역을 견디는 닻**(숫자·라틴 고유명사)으로 대본 발화에 사상한다.
//      성립하면 I2(①-회피)가 듣기에도 걸리는 **이유**가 설명된다
//
// 실행: pnpm dlx tsx scripts/csat/measure-listening.mjs

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, choicesOf, answerOf } from './lib-passage.mjs'
import { binomUpper } from './claim-gate.mjs'

const DIR = path.resolve('scripts/csat/data')
const L = JSON.parse(fs.readFileSync(path.join(DIR, 'listening-all.json'), 'utf8')).items
const rows = JSON.parse(fs.readFileSync(path.join(DIR, 'classified.json'), 'utf8')).rows
const typeOf = new Map(rows.map((r) => [`${r.exam}#${r.no}`, r.type]))
for (const it of L) it.type = typeOf.get(`${it.exam}#${it.no}`) ?? null

const med = (a) => { const x = [...a].sort((p, q) => p - q); return x.length ? x[Math.floor(x.length / 2)] : 0 }
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0)

// ── ① 유형별 대본 규모 ────────────────────────────────────────────────
console.log('듣기 17문항 계측 — 7개년 119문항 (2017~2023)')
console.log('='.repeat(72))
console.log()
console.log('  ① 유형별 대본 규모')
console.log('  번호  유형            문항  낱말 중앙값  턴 중앙값  대화형')
console.log('  ' + '-'.repeat(66))
const byNo = {}
for (const it of L) (byNo[it.no] ??= []).push(it)
for (const n of Object.keys(byNo).map(Number).sort((a, b) => a - b)) {
  const a = byNo[n]
  const t = a[0].type ?? '?'
  console.log(
    `  ${String(n).padStart(3)}  ${String(t).padEnd(14)} ${String(a.length).padStart(4)} ` +
    `${String(med(a.map((x) => x.words))).padStart(11)} ${String(med(a.map((x) => x.nTurns))).padStart(10)} ` +
    `${String(pct(a.filter((x) => x.isDialogue).length, a.length)).padStart(6)}%`,
  )
}
console.log()

// ── ② 듣기 vs 읽기 부담 ───────────────────────────────────────────────
const perExam = {}
for (const it of L) perExam[it.exam] = (perExam[it.exam] ?? 0) + it.words
const lisPerExam = mean(Object.values(perExam))
console.log('  ② 듣기 vs 읽기 부담 (회차당 영어 낱말)')
console.log('  ' + '-'.repeat(66))
console.log(`    듣기 17문항   ${Math.round(lisPerExam).toLocaleString()} 낱말 (7회차 평균)`)
console.log(`    독해 23문항   2,955 낱말 (CSAT_BLUEPRINT.md §4.1 최근 5회차)`)
console.log(`    합계          약 ${Math.round(lisPerExam + 2955).toLocaleString()} 낱말`)
console.log()
console.log(`    → 듣기는 전체 영어 입력의 **${pct(lisPerExam, lisPerExam + 2955)}%** 를 차지한다.`)
console.log('      다만 듣기는 **속도를 학습자가 못 고른다** — 읽기와 달리 되돌아갈 수 없다.')
console.log()

// ── ③ 1:1 순서 대응이 듣기에도 성립하는가 ─────────────────────────────
const COMMON = new Set(['the', 'and', 'for', 'you', 'your', 'all', 'new', 'day', 'one', 'two', 'not'])
function anchors(s) {
  const out = []
  for (const m of s.matchAll(/\d[\d,.:]*/g)) { const v = m[0].replace(/[,.:]+$/, ''); if (v) out.push({ kind: 'num', v }) }
  for (const m of s.matchAll(/[A-Za-z][A-Za-z'’-]{2,}/g)) { const v = m[0]; if (!COMMON.has(v.toLowerCase())) out.push({ kind: 'word', v }) }
  return out
}
/**
 * 담화 안의 **낱말 오프셋**을 돌려준다.
 * ⚠️ 턴 번호를 쓰면 안 된다 — 16·17 같은 담화형은 발화가 1턴뿐이라
 *    닻이 전부 0 이 되고 **단조성이 자동으로 참**이 된다(첫 판에서 7문항이 그렇게 통과했다).
 *    낱말 오프셋은 담화형에서도 눈금이 잡힌다.
 */
function locate(a, script) {
  const pat = a.kind === 'num'
    ? new RegExp(`(?<![\\d])${a.v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\d])`)
    : new RegExp(`\\b${a.v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
  const m = script.match(pat)
  if (!m || m.index == null) return -1
  return (script.slice(0, m.index).match(/[A-Za-z][A-Za-z'’-]*/g) ?? []).length
}

// 선택지가 담화 순서에 대응할 만한 유형 — 언급되지 않은 것 · 담화 불일치 · 세트 불포함
const ORDER_TYPES = ['L-NOTMENTION', 'L-ANNOUNCE', 'L-SET-NOT', 'L-TABLE']
const res = []
for (const it of L) {
  if (!ORDER_TYPES.includes(it.type)) continue
  const b = itemBlocks(it.exam, it.no)[0]
  const ch = b ? choicesOf(b) : null
  if (!ch) { res.push({ ...it, ok: false, why: '선택지 없음' }); continue }
  const pos = ch.map((c) => {
    const f = anchors(c).map((a) => locate(a, it.script)).filter((x) => x >= 0)
    return f.length ? Math.min(...f) : null
  })
  const known = pos.filter((x) => x != null)
  if (known.length < 3) { res.push({ exam: it.exam, no: it.no, type: it.type, ok: false, why: `닻 ${known.length}개` }); continue }
  // 위치가 전부 같으면 단조성이 자동으로 참이다 — 증거로 세면 안 된다
  if (new Set(known).size < 2) { res.push({ exam: it.exam, no: it.no, type: it.type, ok: false, why: "위치 눈금 없음(전부 동일)" }); continue }
  const seq = pos.map((x, i) => ({ i, x })).filter((y) => y.x != null)
  let pairs = 0, conc = 0
  for (let k = 1; k < seq.length; k += 1) { pairs += 1; if (seq[k].x >= seq[k - 1].x) conc += 1 }
  res.push({ exam: it.exam, no: it.no, type: it.type, ok: true, pos, pairs, conc, mono: conc === pairs })
}

const good = res.filter((r) => r.ok)
const mono = good.filter((r) => r.mono).length
const tp = good.reduce((s, r) => s + r.pairs, 0), tc = good.reduce((s, r) => s + r.conc, 0)

console.log('  ③ 1:1 순서 대응 — 듣기에서도 성립하는가 (P6.25 의 듣기 판)')
console.log('  ' + '-'.repeat(66))
console.log(`    대상 ${res.length}문항 · 판정 가능 ${good.length} · 제외 ${res.length - good.length}`)
for (const r of good) {
  console.log(`      ${r.exam}#${String(r.no).padStart(2)} ${String(r.type).padEnd(13)} [${r.pos.map((x) => (x == null ? ' -' : String(x).padStart(2))).join(' ')}]  ${r.mono ? '✓' : '✗'}`)
}
console.log()
if (good.length) {
  console.log(`    완전 단조 ${mono}/${good.length} = ${pct(mono, good.length)}%   (무작위 순열 기저 0.83%)`)
  console.log(`    인접 쌍 순서 지킴 ${tc}/${tp} = ${pct(tc, tp)}%   (기저 50% → 이항 p = ${binomUpper(tp, tc, 0.5).toExponential(2)})`)
  console.log()
  console.log('    → 성립하면 I2(①-회피)가 듣기 유형에도 걸리는 **이유**가 설명된다:')
  console.log('      선택지가 담화 순서를 따라 늘어서므로 ① 은 담화 맨 앞이고,')
  console.log('      거기서 답이 정해지면 나머지를 들을 이유가 없어진다.')
}

fs.writeFileSync(path.join(DIR, 'listening-measure.json'), JSON.stringify({
  perNo: Object.fromEntries(Object.entries(byNo).map(([k, v]) => [k, { type: v[0].type, n: v.length, words: med(v.map((x) => x.words)), turns: med(v.map((x) => x.nTurns)) }])),
  lisPerExam, order: { n: good.length, mono, pairs: tp, conc: tc, rows: res },
}, null, 1))
console.log(`\n→ ${path.join(DIR, 'listening-measure.json')}`)
