// scripts/csat/test-p1c-p24-passage.mjs
//
// **P1c "방향이 있는 지문이 선정된다" · P2.4 "세부사항은 주제문 중요성이 최저" 를 건다.**
//
// 둘 다 **지문의 성질**에 관한 명제라 같은 기계로 잰다.
//
//   P1c  대조·역접 표지 밀도를 **평가원 선정을 안 거친 학술 산문**과 견준다
//        대조군: control-prose2.json (The Conversation 12편 — 레지스터를 맞춘 것)
//        ⚠️ 레지스터를 안 맞추면 장르 차이를 설계로 오독한다. 이 저장소가 이미 겪었다
//
//   P2.4  **주제문 위계의 세기**를 유형군끼리 견준다
//        측정: 문장별 중심성(다른 문장들과의 평균 유사도)에서
//              **최고 문장이 중앙값을 얼마나 앞서는가**
//        주제문이 뚜렷하면 한 문장이 튀고, 없으면 평평하다
//
// 실행: pnpm dlx tsx scripts/csat/test-p1c-p24-passage.mjs

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, passageOf, sentences } from './lib-passage.mjs'
import { fisher } from './claim-gate.mjs'

const DIR = path.resolve('scripts/csat/data')
const rows = JSON.parse(fs.readFileSync(path.join(DIR, 'classified.json'), 'utf8')).rows

const STOP = new Set(('a an the of to in on for and or is are was were be been being it its this that these those with as by at from he she they we you i his her their our your them us him can could may might will would shall should must do does did done have has had having but so than then there here what which who whom whose when where why how all any both each few more most other some such only own same too very just also into over under about after before between out up down off again further once').split(' '))
const stem = (w) => w.replace(/(ing|ions|ion|ers|er|ies|es|ed|ly|s)$/, '')
const toks = (s) => (s.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w)).map(stem)

// ── 방향 표지 — 대조·역접·이항 대립을 세운다 ───────────────────────────
const DIR_MARKERS = [
  'however', 'but', 'yet', 'though', 'although', 'nevertheless', 'nonetheless',
  'rather', 'instead', 'whereas', 'while', 'conversely', 'in contrast', 'on the contrary',
  'on the other hand', 'by contrast', 'unlike', 'despite', 'in spite of', 'even so',
  'not only', 'far from', 'contrary to', 'paradoxically', 'ironically',
]
const dirRe = new RegExp(`\\b(?:${DIR_MARKERS.join('|')})\\b`, 'gi')
const dirCount = (s) => (s.match(dirRe) ?? []).length

/** 문장별 중심성에서 최고가 중앙값을 얼마나 앞서는가 */
function topicDominance(sents, idf) {
  if (sents.length < 4) return null
  const sim = (a, b) => {
    const A = new Set(toks(a)), B = new Set(toks(b))
    if (!A.size || !B.size) return 0
    let i = 0, u = 0
    for (const w of new Set([...A, ...B])) { const v = idf(w); u += v; if (A.has(w) && B.has(w)) i += v }
    return u ? i / u : 0
  }
  const cent = sents.map((s, i) => {
    let t = 0
    sents.forEach((o, j) => { if (i !== j) t += sim(s, o) })
    return t / (sents.length - 1)
  })
  const sorted = [...cent].sort((a, b) => a - b)
  const medv = sorted[Math.floor(sorted.length / 2)]
  const maxv = sorted[sorted.length - 1]
  return medv > 0 ? maxv / medv : null      // 배율 — 길이에 덜 휘둘린다
}

// ── 자료 모으기 ───────────────────────────────────────────────────────
const GROUPS = {
  '대의파악 (23·24·20·22)': ['R-TOPIC', 'R-TITLE', 'R-GIST', 'R-CLAIM'],
  '세부사항 (26)': ['R-FACT'],
  '빈칸 (31~34)': ['R-BLANK'],
  '간접쓰기 (36~39)': ['R-ORDER', 'R-INSERT'],
}
const groupOf = (t) => Object.entries(GROUPS).find(([, v]) => v.includes(t))?.[0] ?? null

const passages = []
for (const r of rows) {
  const g = groupOf(r.type)
  if (!g) continue
  const b = itemBlocks(r.exam, r.no)[0]
  if (!b) continue
  const p = passageOf(b)
  const s = sentences(p).filter((x) => toks(x).length >= 3)
  if (p.length < 150 || s.length < 4) continue
  passages.push({ kind: '기출', group: g, exam: r.exam, no: r.no, type: r.type, text: p, sents: s })
}

// 대조군 — 레지스터를 맞춘 비선정 학술 산문
const ctrl = JSON.parse(fs.readFileSync(path.join(DIR, 'control-prose2.json'), 'utf8')).items
for (const c of ctrl) {
  const s = sentences(c.text).filter((x) => toks(x).length >= 3)
  if (s.length < 4) continue
  passages.push({ kind: '대조', group: '비선정 학술 산문', topic: c.topic, text: c.text, sents: s })
}

// IDF
const df = new Map()
for (const p of passages) for (const w of new Set(toks(p.text))) df.set(w, (df.get(w) ?? 0) + 1)
const N = passages.length
const idf = (w) => Math.log((N + 1) / ((df.get(w) ?? 0) + 1)) + 1

for (const p of passages) {
  p.dir = p.sents.reduce((s, x) => s + dirCount(x), 0)
  p.dirPerSent = p.dir / p.sents.length
  p.hasDir = p.dir > 0
  p.dom = topicDominance(p.sents, idf)
}

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0 }
const pct = (a, b) => (b ? Math.round((a / b) * 1000) / 10 : 0)

function perm(a, b, iters = 20000) {
  const obs = mean(a) - mean(b)
  const pool = [...a, ...b], na = a.length
  let seed = 424242
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
  let ge = 0
  for (let k = 0; k < iters; k += 1) {
    const q = [...pool]
    for (let i = q.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1));[q[i], q[j]] = [q[j], q[i]] }
    if (Math.abs(mean(q.slice(0, na)) - mean(q.slice(na))) >= Math.abs(obs)) ge += 1
  }
  return { obs, p: (ge + 1) / (iters + 1) }
}

// ── P1c ──────────────────────────────────────────────────────────────
const gichul = passages.filter((p) => p.kind === '기출')
const daejo = passages.filter((p) => p.kind === '대조')

console.log('P1c — 기출 지문이 대조군보다 방향(±)이 뚜렷한가')
console.log('='.repeat(74))
console.log(`  기출 ${gichul.length}편 · 대조(비선정 학술 산문) ${daejo.length}편`)
console.log(`  대조군은 The Conversation — **레지스터를 맞춘** 것이다(NOAA·OWID 해설이 아니라)`)
console.log()
console.log('  집단                    편수   방향표지/문장   표지 있는 글')
console.log('  ' + '-'.repeat(68))
console.log(`  기출 (4유형군)          ${String(gichul.length).padStart(4)} ${mean(gichul.map((p) => p.dirPerSent)).toFixed(4).padStart(11)} ${String(pct(gichul.filter((p) => p.hasDir).length, gichul.length)).padStart(11)}%`)
console.log(`  대조 (비선정 산문)      ${String(daejo.length).padStart(4)} ${mean(daejo.map((p) => p.dirPerSent)).toFixed(4).padStart(11)} ${String(pct(daejo.filter((p) => p.hasDir).length, daejo.length)).padStart(11)}%`)
const p1c = perm(gichul.map((p) => p.dirPerSent), daejo.map((p) => p.dirPerSent))
console.log()
console.log(`  평균 차 ${p1c.obs.toFixed(4)} · 순열검정 p = ${p1c.p.toFixed(4)}`)
const fh = fisher(gichul.filter((p) => p.hasDir).length, gichul.filter((p) => !p.hasDir).length,
  daejo.filter((p) => p.hasDir).length, daejo.filter((p) => !p.hasDir).length)
console.log(`  "표지가 하나라도 있는가" Fisher p = ${fh.toFixed(4)}`)
console.log()

// ── P2.4 ─────────────────────────────────────────────────────────────
console.log('P2.4 — 주제문 위계의 세기 (최고 중심성 ÷ 중앙값)')
console.log('='.repeat(74))
console.log('  집단                          편수    평균 배율   중앙값')
console.log('  ' + '-'.repeat(68))
const stats = {}
for (const g of [...Object.keys(GROUPS), '비선정 학술 산문']) {
  const a = passages.filter((p) => p.group === g && p.dom != null).map((p) => p.dom)
  if (!a.length) continue
  stats[g] = a
  console.log(`  ${g.padEnd(28)} ${String(a.length).padStart(4)} ${mean(a).toFixed(3).padStart(10)} ${med(a).toFixed(3).padStart(9)}`)
}
console.log()

const dae = stats['대의파악 (23·24·20·22)'] ?? []
const seb = stats['세부사항 (26)'] ?? []
if (dae.length && seb.length) {
  const r = perm(dae, seb)
  console.log(`  대의파악 vs 세부사항 — 차 ${r.obs.toFixed(3)} · 순열검정 p = ${r.p.toFixed(4)}`)
  console.log(`  → ${r.p < 0.05
    ? (r.obs > 0 ? '**대의파악의 주제문 위계가 더 세다** — P2.4 지지' : '세부사항이 더 세다 — P2.4 와 반대')
    : '**갈리지 않는다** — 주제문 위계로는 세부사항이 구분되지 않는다'}`)
}
console.log()
console.log('  ⚠️ 레지스터 주의 — 세부사항(26)은 인물 소개문이고 대의파악은 논증문이다.')
console.log('     차이가 나와도 "유형 배정의 기준" 인지 "장르가 원래 다른 것" 인지는 이 자료로 못 가른다.')

fs.writeFileSync(path.join(DIR, 'p1c-p24-passage.json'), JSON.stringify({
  p1c: { gichul: gichul.length, daejo: daejo.length, perm: p1c, fisher: fh,
    gichulDir: mean(gichul.map((p) => p.dirPerSent)), daejoDir: mean(daejo.map((p) => p.dirPerSent)) },
  dominance: Object.fromEntries(Object.entries(stats).map(([k, v]) => [k, { n: v.length, mean: mean(v), median: med(v) }])),
}, null, 1))
console.log(`\n→ ${path.join(DIR, 'p1c-p24-passage.json')}`)
