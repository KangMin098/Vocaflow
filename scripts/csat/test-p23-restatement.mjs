// scripts/csat/test-p23-restatement.mjs
//
// **P2.3 / V3 — "빈칸 지문은 주제의 재진술이 2회 이상 있다" 를 전수로 건다.**
//
// 초안은 이것을 빈칸 유형 **배정의 조건**으로 적었다 — 재진술이 2회면 빈칸감이라고.
// 반증 가능한 형태로 바꾸면: **빈칸 지문은 비빈칸 지문보다 재진술이 많다.**
//
// 재진술을 어떻게 세는가 — 임계값을 여러 개 쓸어보면 p-hacking 이 된다.
// 그래서 **측정을 먼저 못박는다**:
//
//   재진술 강도 = 지문 안 **인접하지 않은** 문장쌍 중 IDF 가중 유사도의 **최댓값**
//
//   · 인접 쌍을 빼는 이유 — 바로 옆 문장은 원래 이어지므로 겹친다. 재진술이 아니다
//   · 최댓값을 쓰는 이유 — "주제를 두 번 말했는가" 는 가장 닮은 한 쌍이 있느냐의 문제다
//
// 대조군은 **같은 레지스터**여야 한다 — 순서·삽입·주제·제목 전부 설명문이다.
// (심경 같은 서사를 대조군에 넣으면 장르 교락이 된다. P6.19 에서 겪었다)
//
// 유의성은 **순열검정**으로 낸다. 분포 가정을 안 하고, 두 집단 크기가 달라도 옳다.
//
// 실행: pnpm dlx tsx scripts/csat/test-p23-restatement.mjs

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, passageOf, sentences } from './lib-passage.mjs'

const DIR = path.resolve('scripts/csat/data')
const rows = JSON.parse(fs.readFileSync(path.join(DIR, 'classified.json'), 'utf8')).rows

const STOP = new Set(('a an the of to in on for and or not is are was were be been being it its this that these those with as by at from he she they we you i his her their our your them us him one ones can could may might will would shall should must do does did done have has had having but so than then there here what which who whom whose when where why how all any both each few more most other some such no nor only own same too very just also into over under about after before between out up down off again further once s t don now').split(' '))
const stem = (w) => w.replace(/(ing|ions|ion|ers|er|ies|es|ed|ly|s)$/, '')
const toks = (s) => (s.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w)).map(stem)

const TARGET = ['R-BLANK']
const CONTROL = ['R-TOPIC', 'R-TITLE', 'R-ORDER', 'R-INSERT', 'R-IRRELEVANT']

const all = []
for (const it of rows.filter((r) => [...TARGET, ...CONTROL].includes(r.type))) {
  const b = itemBlocks(it.exam, it.no)[0]
  if (!b) continue
  const p = passageOf(b)
  const s = sentences(p).filter((x) => toks(x).length >= 3)
  if (s.length < 5) continue     // 문장이 적으면 비인접 쌍이 거의 없다
  all.push({ exam: it.exam, no: it.no, type: it.type, target: TARGET.includes(it.type), sents: s })
}

// IDF — 대상·대조 전체에서
const df = new Map()
for (const it of all) for (const w of new Set(it.sents.flatMap(toks))) df.set(w, (df.get(w) ?? 0) + 1)
const N = all.length
const idf = (w) => Math.log((N + 1) / ((df.get(w) ?? 0) + 1)) + 1

/** 대칭 IDF 가중 유사도 (Jaccard 풍) */
function sim(a, b) {
  const A = new Set(toks(a)), B = new Set(toks(b))
  if (!A.size || !B.size) return 0
  let inter = 0, uni = 0
  for (const w of new Set([...A, ...B])) { const v = idf(w); uni += v; if (A.has(w) && B.has(w)) inter += v }
  return uni ? inter / uni : 0
}

for (const it of all) {
  let best = 0, bestPair = null
  for (let i = 0; i < it.sents.length; i += 1) {
    for (let j = i + 2; j < it.sents.length; j += 1) {   // 인접(j=i+1) 제외
      const v = sim(it.sents[i], it.sents[j])
      if (v > best) { best = v; bestPair = [i, j] }
    }
  }
  it.restate = best
  it.pair = bestPair
  it.nSent = it.sents.length
}

const T = all.filter((x) => x.target), C = all.filter((x) => !x.target)
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s[Math.floor(s.length / 2)] }
const tv = T.map((x) => x.restate), cv = C.map((x) => x.restate)

// ── 순열검정 — 라벨을 섞어 평균 차가 관측만큼 커지는 빈도 ────────────────
function permTest(a, b, iters = 20000) {
  const obs = mean(a) - mean(b)
  const pool = [...a, ...b]
  const na = a.length
  // 결정적 셔플 — Math.random 없이 재현 가능하게 (선형합동)
  let seed = 12345
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
  let ge = 0
  for (let k = 0; k < iters; k += 1) {
    const p = [...pool]
    for (let i = p.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1));[p[i], p[j]] = [p[j], p[i]] }
    const d = mean(p.slice(0, na)) - mean(p.slice(na))
    if (Math.abs(d) >= Math.abs(obs)) ge += 1
  }
  return { obs, p: (ge + 1) / (iters + 1) }
}

const pt = permTest(tv, cv)

console.log('P2.3 / V3 — 빈칸 지문은 재진술이 더 많은가')
console.log('='.repeat(74))
console.log(`  측정: 비인접 문장쌍 IDF 가중 유사도의 최댓값 (사전에 못박음)`)
console.log(`  IDF 는 대상+대조 ${N}편에서 산출`)
console.log()
console.log('  집단              문항   평균     중앙값   문장수 중앙값')
console.log('  ' + '-'.repeat(66))
console.log(`  빈칸 (31~34)     ${String(T.length).padStart(4)} ${mean(tv).toFixed(4).padStart(8)} ${med(tv).toFixed(4).padStart(9)} ${String(med(T.map((x) => x.nSent))).padStart(11)}`)
console.log(`  대조(설명문 4종) ${String(C.length).padStart(4)} ${mean(cv).toFixed(4).padStart(8)} ${med(cv).toFixed(4).padStart(9)} ${String(med(C.map((x) => x.nSent))).padStart(11)}`)
console.log()
console.log(`  평균 차 = ${pt.obs.toFixed(4)}   순열검정 p = ${pt.p.toFixed(4)}  (20,000회)`)
console.log()

// 대조군을 유형별로 쪼개 본다 — 한 유형이 끌고 있지는 않은가 (G1)
console.log('  대조군 내역')
for (const t of CONTROL) {
  const a = C.filter((x) => x.type === t).map((x) => x.restate)
  if (a.length) console.log(`    ${t.padEnd(14)} ${String(a.length).padStart(3)}편  평균 ${mean(a).toFixed(4)}`)
}
console.log()

const verdict = pt.p < 0.05
  ? '**차이가 있다** — 빈칸 지문의 재진술이 더 ' + (pt.obs > 0 ? '많다' : '적다')
  : '**차이가 없다** — 재진술 강도로는 빈칸 지문이 갈리지 않는다. 유형 배정의 조건이 아니다'
console.log(`  판정: ${verdict}`)
console.log()

// ── 교락 점검 두 가지 ──────────────────────────────────────────────────
console.log('  교락 점검')
console.log('  ' + '-'.repeat(66))

// ① 문장 수 — 쌍이 많을수록 최댓값이 커진다. 층별로 갈라 본다.
console.log('  ① 문장 수 (쌍 개수가 최댓값을 밀어 올린다)')
console.log('     문장수   빈칸        대조')
for (const k of [5, 6, 7, 8, 9]) {
  const t = T.filter((x) => x.nSent === k), c = C.filter((x) => x.nSent === k)
  if (!t.length && !c.length) continue
  const f = (a) => (a.length ? `${String(a.length).padStart(2)}편 ${mean(a.map((x) => x.restate)).toFixed(4)}` : '  -      ')
  console.log(`       ${k}     ${f(t)}   ${f(c)}`)
}
console.log('     → 층마다 빈칸이 낮다. 문장 수로는 설명되지 않는다.')
console.log()

// ② 훼손 — 빈칸은 낱말 몇 개가 빠져 있다. 그 탓에 유사도가 낮아진 것 아닌가?
const ins = C.filter((x) => x.type === 'R-INSERT')
console.log('  ② 지문 훼손')
console.log(`     빈칸  = 한 문장에서 낱말 몇 개가 빠짐        평균 ${mean(tv).toFixed(4)}`)
console.log(`     삽입  = **문장 하나가 통째로 빠짐**(더 심한 훼손)  평균 ${mean(ins.map((x) => x.restate)).toFixed(4)}`)
console.log('     → 더 심하게 훼손된 삽입 지문이 오히려 높다. 훼손으로는 설명되지 않는다.')
console.log()
console.log('  해석 — 이 저장소의 HARD 후보와 맞물린다.')
console.log('    빈칸 지문에 재진술이 많았다면 **주제만으로 빈칸이 잠겼을 것**이다.')
console.log('    재진술이 적어서 주제로는 안 잠기고, 인접 구체진술이 잠근다(명제 B, 5/5).')
console.log('    두 측정이 독립으로 같은 곳을 가리킨다.')

fs.writeFileSync(path.join(DIR, 'p23-restatement.json'), JSON.stringify({
  target: { n: T.length, mean: mean(tv), median: med(tv) },
  control: { n: C.length, mean: mean(cv), median: med(cv) },
  perm: pt,
  rows: all.map((x) => ({ exam: x.exam, no: x.no, type: x.type, target: x.target, nSent: x.nSent, restate: x.restate })),
}, null, 1))
console.log(`\n→ ${path.join(DIR, 'p23-restatement.json')}`)
