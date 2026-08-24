// scripts/csat/test-p32-blank-distance.mjs
//
// **P3.2 — "빈칸 난도 다이얼 = 빈칸 문장과 근거 문장 사이의 거리" 를 건다.**
//
// 초안은 이것을 [가설] 로 달아 두었다. 반증 가능한 형태:
//   **3점 빈칸은 2점 빈칸보다 근거가 멀리 있다.**
//
// 빈칸 위치를 원문 조판에서 찾아낸다 — 빈칸은 **크게 들여쓴 줄**로 남는다
//   `Because this information was the key to their`
//   `                     , these firms worked in relative secrecy,`
//
// 거리를 두 가지로 잰다. 하나는 정답에 기대고 하나는 기대지 않는다:
//
//   D1 (정답 의존) 정답 선지와 가장 닮은 문장까지의 거리
//                  ⚠️ P4.1 에서 빈칸 정답의 지문 겹침은 기저와 구분이 안 됐다(22%).
//                     그러므로 이 자는 **잡음이 크다** — 검정력을 깎지 편향을 만들지는 않는다
//   D2 (정답 무관) 빈칸 문장과 가장 닮은 **다른 문장**까지의 거리
//                  "빈칸을 떠받치는 것이 얼마나 멀리 있나" 를 정답 없이 잰다
//
// 실행: pnpm dlx tsx scripts/csat/test-p32-blank-distance.mjs

import fs from 'node:fs'
import path from 'node:path'
import { itemBlocks, choicesOf, answerOf, sentences } from './lib-passage.mjs'

const DIR = path.resolve('scripts/csat/data')
const rows = JSON.parse(fs.readFileSync(path.join(DIR, 'classified.json'), 'utf8')).rows

const STOP = new Set(('a an the of to in on for and or not is are was were be been being it its this that these those with as by at from he she they we you i his her their our your them us him one ones can could may might will would shall should must do does did done have has had having but so than then there here what which who whom whose when where why how all any both each few more most other some such no nor only own same too very just also into over under about after before between out up down off again further once s t don now').split(' '))
const stem = (w) => w.replace(/(ing|ions|ion|ers|er|ies|es|ed|ly|s)$/, '')
const toks = (s) => (s.toLowerCase().match(/[a-z]+/g) ?? []).filter((w) => w.length > 2 && !STOP.has(w)).map(stem)

const SENT = 'ZQBLANKQZ'   // 빈칸 자리 표시 — 지문에 없고 sentences() 가 안 먹는 문자열이어야 한다 ( 을 쓰면 문장 분할기가 삼킨다)

/** 본문 줄에서 빈칸 자리를 찾아 표시한 지문을 만든다. 못 찾으면 null */
function passageWithBlank(block) {
  const body = []
  for (const l of block) { if (/^\s*[①②③④⑤]/.test(l)) break; body.push(l) }
  const live = body.filter((l) => l.trim())
  if (live.length < 3) return null
  const inds = live.map((l) => l.match(/^ */)[0].length).sort((a, b) => a - b)
  const base = inds[Math.floor(inds.length / 2)]
  let hit = -1
  for (let i = 1; i < body.length; i += 1) {
    if (!body[i].trim()) continue
    if (/^\s*\d+\s*[.．]/.test(body[i])) continue
    if (body[i].match(/^ */)[0].length >= base + 12) { hit = i; break }
  }
  if (hit < 0) return null
  const out = []
  for (let i = 0; i < body.length; i += 1) {
    const l = body[i].trim()
    if (!l) continue
    if (/^\s*\d+\s*[.．]/.test(body[i])) continue
    out.push(i === hit ? SENT + ' ' + l : l)
  }
  return out.join(' ').replace(/\s+/g, ' ').trim()
}

const idfDf = new Map()
const items = []
for (const it of rows.filter((r) => r.type === 'R-BLANK')) {
  const b = itemBlocks(it.exam, it.no)[0]
  if (!b) continue
  const p = passageWithBlank(b)
  const ch = choicesOf(b)
  const a = answerOf(it.exam, it.no)
  if (!p || !ch || !a || a.answer < 1 || a.answer > 5) continue
  const sents = sentences(p.replace(new RegExp(SENT, 'g'), ''))
  const marked = sentences(p)
  const bi = marked.findIndex((s) => s.includes(SENT))
  if (bi < 0 || marked.length < 5) continue
  items.push({ exam: it.exam, no: it.no, points: a.points, answer: ch[a.answer - 1], sents: marked.map((s) => s.replace(SENT, '').trim()), bi })
  for (const w of new Set(marked.flatMap(toks))) idfDf.set(w, (idfDf.get(w) ?? 0) + 1)
}
const N = items.length
const idf = (w) => Math.log((N + 1) / ((idfDf.get(w) ?? 0) + 1)) + 1
function sim(a, b) {
  const A = new Set(toks(a)), B = new Set(toks(b))
  if (!A.size || !B.size) return 0
  let i = 0, u = 0
  for (const w of new Set([...A, ...B])) { const v = idf(w); u += v; if (A.has(w) && B.has(w)) i += v }
  return u ? i / u : 0
}

for (const it of items) {
  // D1 — 정답과 가장 닮은 문장까지의 거리
  let best = -1, bv = -1
  it.sents.forEach((s, i) => { if (i === it.bi) return; const v = sim(it.answer, s); if (v > bv) { bv = v; best = i } })
  it.d1 = Math.abs(best - it.bi)
  // D2 — 빈칸 문장과 가장 닮은 다른 문장까지의 거리
  let best2 = -1, bv2 = -1
  it.sents.forEach((s, i) => { if (i === it.bi) return; const v = sim(it.sents[it.bi], s); if (v > bv2) { bv2 = v; best2 = i } })
  it.d2 = Math.abs(best2 - it.bi)
  it.rel = it.sents.length > 1 ? it.bi / (it.sents.length - 1) : 0
  it.nSent = it.sents.length
}

const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : 0)
const med = (a) => { const s = [...a].sort((x, y) => x - y); return s.length ? s[Math.floor(s.length / 2)] : 0 }

function perm(a, b, iters = 20000) {
  const obs = mean(a) - mean(b)
  const pool = [...a, ...b], na = a.length
  let seed = 987654321
  const rnd = () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648 }
  let ge = 0
  for (let k = 0; k < iters; k += 1) {
    const p = [...pool]
    for (let i = p.length - 1; i > 0; i -= 1) { const j = Math.floor(rnd() * (i + 1));[p[i], p[j]] = [p[j], p[i]] }
    if (Math.abs(mean(p.slice(0, na)) - mean(p.slice(na))) >= Math.abs(obs)) ge += 1
  }
  return { obs, p: (ge + 1) / (iters + 1) }
}

const t3 = items.filter((x) => x.points === 3), t2 = items.filter((x) => x.points === 2)

console.log('P3.2 — 빈칸 난도 다이얼: 3점은 근거가 더 먼가')
console.log('='.repeat(72))
console.log(`  R-BLANK 55문항 중 빈칸 자리를 조판에서 찾은 것 ${items.length}문항`)
console.log(`  (조판에서 빈칸이 큰 들여쓰기로 남지 않는 문항은 제외 — 분모에서 뺀 수를 여기 적는다)`)
console.log()
console.log('  측정                        3점(n=' + t3.length + ')   2점(n=' + t2.length + ')   차   순열 p')
console.log('  ' + '-'.repeat(68))
for (const [name, key] of [['D1 정답↔근거 거리 (문장)', 'd1'], ['D2 빈칸↔최유사 문장 거리', 'd2'], ['빈칸의 상대 위치', 'rel'], ['지문 문장 수', 'nSent']]) {
  const a = t3.map((x) => x[key]), b = t2.map((x) => x[key])
  const r = perm(a, b)
  console.log(`  ${name.padEnd(26)} ${mean(a).toFixed(2).padStart(6)} ${mean(b).toFixed(2).padStart(9)} ${r.obs.toFixed(2).padStart(7)} ${r.p.toFixed(4).padStart(9)}`)
}
console.log()
console.log(`  중앙값 — D1 3점 ${med(t3.map((x) => x.d1))} vs 2점 ${med(t2.map((x) => x.d1))} · D2 3점 ${med(t3.map((x) => x.d2))} vs 2점 ${med(t2.map((x) => x.d2))}`)
console.log()

const d1p = perm(t3.map((x) => x.d1), t2.map((x) => x.d1)).p
const d2p = perm(t3.map((x) => x.d2), t2.map((x) => x.d2)).p
console.log('  판정')
console.log('  ' + '-'.repeat(68))
if (d1p < 0.05 || d2p < 0.05) {
  console.log('  → 거리가 3점/2점을 가른다는 증거가 있다.')
} else {
  console.log('  → **거리로는 3점/2점이 갈리지 않는다.** 난도 다이얼이 거리라는 가설은 지지되지 않는다.')
  console.log(`     D1 p=${d1p.toFixed(3)} · D2 p=${d2p.toFixed(3)}`)
  console.log('     ⚠️ D1 은 원래 잡음이 크다(P4.1: 빈칸 정답의 지문 겹침이 기저와 구분 안 됨).')
  console.log('        그러나 정답에 기대지 않는 D2 도 함께 null 이므로, 검정력 부족만으로 돌리기 어렵다.')
}

fs.writeFileSync(path.join(DIR, 'p32-blank-distance.json'), JSON.stringify({
  n: items.length, n3: t3.length, n2: t2.length, d1p, d2p,
  rows: items.map((x) => ({ exam: x.exam, no: x.no, points: x.points, bi: x.bi, nSent: x.nSent, d1: x.d1, d2: x.d2, rel: x.rel })),
}, null, 1))
console.log(`\n→ ${path.join(DIR, 'p32-blank-distance.json')}`)
