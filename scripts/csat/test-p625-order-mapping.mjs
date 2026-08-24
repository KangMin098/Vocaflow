// scripts/csat/test-p625-order-mapping.mjs
//
// **P6.25 — "세부사항(25~28)은 선택지가 지문 순서에 1:1로 대응한다" 를 전수로 건다.**
//
// 지금까지 이 명제의 직접 표본은 **손으로 읽은 4문항**뿐이었다.
// 기계로 전수를 걸 수 있다 — 선택지가 한글이어도 **번역을 견디는 닻**이 있기 때문이다.
//
//   숫자(연도·금액·시각·수량) · 라틴문자 고유명사(Zurich · Borden Award · The Fire of Life)
//
// 이 닻들을 지문에서 찾아 위치를 매기면 선택지 → 지문 위치 사상이 나온다.
// 그 사상이 **단조 증가**인지 본다.
//
// 기저 두 가지를 같이 낸다:
//   · 무작위 순열 5개가 단조일 확률 = 1/120 = 0.83%
//   · 인접 쌍이 순서를 지킬 확률 = 0.5 (쌍 4개 → 전부 지킬 확률 6.25%)
//
// ⚠️ 닻을 3개 미만밖에 못 찾은 문항은 **분모에서 빼되 그 수를 반드시 출력한다.**
//    빼고 나서 세면 유리한 쪽만 남는다.
//
// 실행: pnpm dlx tsx scripts/csat/test-p625-order-mapping.mjs

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, passageOf, choicesOf, sentences } from './lib-passage.mjs'
import { binomUpper, report } from './claim-gate.mjs'

const DIR = path.resolve('scripts/csat/data')
const rows = JSON.parse(fs.readFileSync(path.join(DIR, 'classified.json'), 'utf8')).rows
const TYPES = ['R-FACT', 'R-NOTICE', 'R-CHART']

// 번역을 견디는 닻만 뽑는다
const COMMON = new Set(['the', 'and', 'for', 'you', 'your', 'all', 'new', 'day', 'one', 'two', 'not'])
function anchors(s) {
  const out = []
  for (const m of s.matchAll(/\d[\d,.:]*/g)) {
    const v = m[0].replace(/[,.:]+$/, '')
    if (v.length >= 1) out.push({ kind: 'num', v })
  }
  for (const m of s.matchAll(/[A-Za-z][A-Za-z'’-]{2,}/g)) {
    const v = m[0]
    if (!COMMON.has(v.toLowerCase())) out.push({ kind: 'word', v })
  }
  return out
}

/** 닻이 지문의 몇 번째 문장에 있는가 — 가장 이른 위치 */
function locate(a, sents) {
  const pat = a.kind === 'num'
    ? new RegExp(`(?<![\\d])${a.v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(?![\\d])`)
    : new RegExp(`\\b${a.v.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i')
  for (let i = 0; i < sents.length; i += 1) if (pat.test(sents[i])) return i
  return -1
}

const res = []
for (const it of rows.filter((r) => TYPES.includes(r.type))) {
  const b = itemBlocks(it.exam, it.no)[0]
  if (!b) { res.push({ exam: it.exam, no: it.no, type: it.type, ok: false, why: '블록 없음' }); continue }
  const ch = choicesOf(b)
  // ⚠️ 위치의 단위를 **문장이 아니라 줄**로 잡는다.
  //    안내문·도표는 목록·표라서 마침표로 안 끊긴다("• Date: Nov 5" · "• Fee: $10").
  //    문장 분할을 쓰면 목록 전체가 한 덩어리가 되어 닻 위치가 전부 같아진다
  //    (첫 판에서 54문항 중 44개가 이 탓에 판정 불가였다).
  const sents = b
    .map((l) => l.trim())
    .filter((l) => l && !/^[①②③④⑤]/.test(l) && !/^\s*\d+\s*[.．]/.test(l) && /[A-Za-z0-9]/.test(l))
  if (!ch || sents.length < 3) { res.push({ exam: it.exam, no: it.no, type: it.type, ok: false, why: '추출 실패' }); continue }
  const pos = ch.map((c) => {
    const found = anchors(c).map((a) => locate(a, sents)).filter((x) => x >= 0)
    return found.length ? Math.min(...found) : null
  })
  const known = pos.filter((x) => x != null)
  if (known.length < 3) { res.push({ exam: it.exam, no: it.no, type: it.type, ok: false, why: `닻 ${known.length}개`, pos }); continue }
  // 알려진 위치들만으로 단조 증가인지
  const seq = pos.map((x, i) => ({ i, x })).filter((y) => y.x != null)
  let pairs = 0, conc = 0
  for (let k = 1; k < seq.length; k += 1) { pairs += 1; if (seq[k].x >= seq[k - 1].x) conc += 1 }
  res.push({
    exam: it.exam, no: it.no, type: it.type, ok: true,
    pos, nKnown: known.length, pairs, conc, mono: conc === pairs, nSent: sents.length,
  })
}

const good = res.filter((r) => r.ok)
const bad = res.filter((r) => !r.ok)
const mono = good.filter((r) => r.mono).length
const totPairs = good.reduce((s, r) => s + r.pairs, 0)
const totConc = good.reduce((s, r) => s + r.conc, 0)
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0)

console.log('P6.25 — 세부사항 선택지가 지문 순서에 대응하는가 (전수)')
console.log('='.repeat(76))
console.log(`  대상 ${res.length}문항 · 판정 가능 ${good.length} · 제외 ${bad.length}`)
if (bad.length) {
  const why = {}
  for (const r of bad) why[r.why] = (why[r.why] ?? 0) + 1
  console.log(`    제외 사유 — ${Object.entries(why).map(([k, v]) => `${k}: ${v}`).join(' · ')}`)
}
console.log()
console.log('  회차   번호 유형        선택지→지문 문장       단조')
console.log('  ' + '-'.repeat(72))
for (const r of good) {
  console.log(
    `  ${r.exam.padEnd(6)} ${String(r.no).padStart(3)}  ${r.type.padEnd(9)} ` +
    `[${r.pos.map((x) => (x == null ? ' -' : String(x).padStart(2))).join(' ')}]   ${r.mono ? '✓' : '✗'}`,
  )
}
console.log()
console.log(`  완전 단조: ${mono}/${good.length} = ${pct(mono, good.length)}%`)
console.log(`  인접 쌍 순서 지킴: ${totConc}/${totPairs} = ${pct(totConc, totPairs)}%   (기저 50%)`)
console.log()
console.log(`  기저 ① 무작위 순열이 단조일 확률 0.83% → 이항 p = ${binomUpper(good.length, mono, 1 / 120).toExponential(2)}`)
console.log(`  기저 ② 후하게 20% 로 잡아도      → 이항 p = ${binomUpper(good.length, mono, 0.2).toExponential(2)}`)
console.log(`  쌍 단위 (기저 50%)               → 이항 p = ${binomUpper(totPairs, totConc, 0.5).toExponential(2)}`)
console.log()

const byType = {}
for (const r of good) { const t = (byType[r.type] ??= { n: 0, m: 0 }); t.n += 1; if (r.mono) t.m += 1 }
console.log('  유형별')
for (const [t, v] of Object.entries(byType)) console.log(`    ${t.padEnd(10)} ${v.m}/${v.n} = ${pct(v.m, v.n)}%`)
console.log()

const exams = [...new Set(good.map((r) => r.exam))]
report({
  name: 'P6.25 — 세부사항 선택지는 지문 순서에 단조 대응한다  [전수 검사]',
  hit: mono, n: good.length, baseRate: 0.2, shape: 'count-vs-baserate',
  falsifier: '선택지→지문 위치 사상이 뒤섞이면(단조가 아니면) 깨진다. 무작위 순열이면 0.83% 만 단조다',
  subgroups: Object.entries(byType).map(([label, v]) => ({ label, hit: v.m, n: v.n })),
  perExam: exams.map((e) => ({
    exam: e,
    hit: good.filter((r) => r.exam === e && r.mono).length,
    n: good.filter((r) => r.exam === e).length,
  })),
})

fs.writeFileSync(path.join(DIR, 'p625-order-mapping.json'), JSON.stringify({ n: good.length, excluded: bad.length, mono, totPairs, totConc, rows: res }, null, 1))
console.log(`→ ${path.join(DIR, 'p625-order-mapping.json')}`)
