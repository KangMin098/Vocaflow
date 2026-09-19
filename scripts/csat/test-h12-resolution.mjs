// scripts/csat/test-h12-resolution.mjs
//
// **H12 — 삽입의 설계 제약은 '지시어의 해소' 인가. 읽기 전용.**
//
// ── 왜 다시 삽입인가 ────────────────────────────────────────────────
// H6 은 "주어진 문장에 후방 지시어가 있는가" 를 물어 96% 를 얻었지만
// base rate 가 71% 라 무효였다. 외부 분석서의 풀이 절차를 읽고 착오가 드러났다 —
// 출제 설계는 **특징(있는가)** 이 아니라 **제약(어디서 해소되는가)** 이다.
//
//   2016 #37 실례: 주어진 문장의 `these dogs` 는 '눈을 쓰는 개들' 이므로
//   그 **앞에는 반드시** 모습 바뀐 주인을 문 개들이 와야 한다 → ⑤ 하나로 잠긴다.
//
// ── 이번에 재는 것 ──────────────────────────────────────────────────
//   주어진 문장에서 지시 표현(this/these/those/such + 명사, 또는 대명사)을 뽑고,
//   **다섯 자리 각각에 대해** 그 앞 문맥이 선행사를 공급하는지 본다.
//   후보가 1~2 자리로 줄면 제약이 자리를 잠근다. 4~5 자리면 H6 과 같은 운명이다.
//
// ⚠️ base rate 는 이번엔 **후보 집합의 크기 자체**다 —
//    무작위로 찍을 때 20%(1/5) 에서 얼마나 올라가는지가 곧 제약의 세기다.
// ⚠️ 기계 판정은 어휘 일치까지다. 의미적 공지시(paraphrase)는 놓친다 → **과소 추정**이다.
//    그래서 후보가 작게 나오면 그건 하한이 아니라 상한 쪽으로 봐야 한다(놓친 자리가 있을 수 있다).
//
// 실행: pnpm dlx tsx scripts/csat/test-h12-resolution.mjs

import fs from 'node:fs'
import path from 'node:path'

const OUT_DIR = path.resolve('scripts/csat/data')
const COL_DIR = path.join(OUT_DIR, 'columns')
const R = (f) => JSON.parse(fs.readFileSync(path.join(OUT_DIR, f), 'utf8'))

const cache = new Map()
const examLines = (e) => {
  if (!cache.has(e)) {
    const p = path.join(COL_DIR, `${e}.txt`)
    cache.set(e, fs.existsSync(p) ? fs.readFileSync(p, 'utf8').replace(/\r/g, '').split('\n') : null)
  }
  return cache.get(e)
}
function itemLines(exam, no) {
  const lines = examLines(exam)
  if (!lines) return null
  const i = lines.findIndex((l) => new RegExp(`^\\s*${no}\\s*\\.`).test(l))
  if (i < 0) return null
  let j = lines.findIndex((l, k) => k > i && new RegExp(`^\\s*${no + 1}\\s*\\.`).test(l))
  if (j < 0 || j - i > 220) j = Math.min(i + 160, lines.length)
  return lines.slice(i, j)
}
const clean = (s) => s.replace(/[^\x00-\x7F]+/g, ' ').replace(/\s*,\s*/g, ', ').replace(/\s+/g, ' ').trim()

const STOP = new Set(`a an the of to in on at by for with from into over under and or but if then than that this these those
it its their our your his her they we you he she as is are was were be been being do does did have has had thing things
can could will would shall should may might must not no nor so such very more most much many few less least own way ways
what which who whom whose when where why how all any both each other others same too only just also there here one`.split(/\s+/))
const words = (s) => (s.toLowerCase().match(/[a-z][a-z'-]+/g) ?? [])
const content = (s) => words(s).filter((w) => w.length > 2 && !STOP.has(w))
/** 아주 거친 단수·복수 통합 */
const stem = (w) => w.replace(/(ies)$/, 'y').replace(/(ses|xes|zes|ches|shes)$/, '').replace(/s$/, '')

/** 주어진 문장에서 앞을 가리키는 표현을 뽑는다 */
function anaphors(given) {
  const out = []
  for (const m of given.matchAll(/\b(this|these|those|such)\s+([a-z]+(?:\s+[a-z]+)?)/gi)) {
    const heads = content(m[2]).map(stem)
    if (heads.length) out.push({ kind: 'dem', text: m[0], heads })
  }
  // 문두 대명사 — 선행사 명사를 특정할 수 없으므로 '아무 명사라도 있으면 해소' 로 관대하게 본다
  const pm = given.match(/^\s*(they|them|their|it|its|he|she|his|her)\b/i)
  if (pm) out.push({ kind: 'pro', text: pm[1], heads: [] })
  return out
}

const classified = R('classified.json')
const answers = R('answers.json').answers
const key = new Map(answers.map((a) => [`${a.exam}#${a.no}`, a]))

const rows = []
let skipped = 0
for (const q of classified.rows.filter((r) => r.exam !== '2014A' && r.type === 'R-INSERT')) {
  const L = itemLines(q.exam, q.no)
  if (!L) { skipped += 1; continue }
  const blocks = []; let cur = []
  for (const raw of L.slice(1)) { if (!raw.trim()) { if (cur.length) { blocks.push(cur); cur = [] } } else cur.push(raw) }
  if (cur.length) blocks.push(cur)
  const en = blocks.filter((b) => /[A-Za-z]{3,}/.test(b.join(' ')))
  if (en.length < 2) { skipped += 1; continue }
  const given = clean(en[0].join(' '))
  const passageRaw = en.slice(1).join(' ').replace(/\s+/g, ' ')
  if (!/\(\s*①\s*\)/.test(passageRaw)) { skipped += 1; continue }
  const at1 = passageRaw.search(/\(\s*①\s*\)/)
  const lead = clean(passageRaw.slice(0, at1))
  let rest = passageRaw.slice(at1)
  const ci = rest.search(/①\s*$|①\s+②/)
  if (ci > 0) rest = rest.slice(0, ci)
  const marked = rest.replace(/\*.*$/, '').split(/\(\s*[①②③④⑤]\s*\)/)
  if (marked.length !== 6) { skipped += 1; continue }
  const ans = key.get(`${q.exam}#${q.no}`)?.answer
  if (!ans) { skipped += 1; continue }

  const an = anaphors(given)
  if (!an.length) { skipped += 1; continue }

  // 자리 i 의 앞 문맥 = lead + marked[1..i-1] 을 이은 것
  const before = []
  for (let i = 1; i <= 5; i += 1) {
    before[i] = clean([lead, ...marked.slice(1, i)].join(' '))
  }

  // 각 자리에서 지시 표현이 해소되는가
  const ok = []
  for (let i = 1; i <= 5; i += 1) {
    const pool = new Set(content(before[i]).map(stem))
    const solved = an.every((a) => (a.kind === 'pro' ? pool.size > 0 : a.heads.some((h) => pool.has(h))))
    if (solved) ok.push(i)
  }
  rows.push({ id: `${q.exam}#${q.no}`, ans, ok, n: ok.length, hit: ok.includes(ans), an: an.map((a) => a.text) })
}

const n = rows.length
const mean = rows.reduce((s, r) => s + r.n, 0) / n
const hit = rows.filter((r) => r.hit).length
const locked = rows.filter((r) => r.n === 1)
const lockedRight = locked.filter((r) => r.hit).length

console.log('H12  삽입의 제약은 "지시어의 해소" 인가')
console.log('─'.repeat(74))
console.log(`  대상 ${n}문항 (제외 ${skipped})`)
console.log('')
console.log(`  해소되는 자리 수 (5자리 중)      평균 ${mean.toFixed(2)}`)
console.log(`  실제 정답이 그 안에 있는가        ${hit}/${n} = ${(100 * hit / n).toFixed(1)}%`)
console.log(`  한 자리로 잠긴 문항               ${locked.length}/${n}  그중 정답 일치 ${lockedRight}/${locked.length || 1}`)
console.log('')
console.log(`  찍기 확률 20.0% → ${(100 * hit / n / mean).toFixed(1)}%   (제약을 걸고 남은 후보에서 균등하게 찍을 때)`)
console.log('')
const dist = [0, 0, 0, 0, 0, 0]
for (const r of rows) dist[r.n] += 1
console.log('  후보 수 분포')
for (let i = 0; i <= 5; i += 1) if (dist[i]) console.log(`    ${i}자리  ${String(dist[i]).padStart(2)}문항  ${'█'.repeat(dist[i] * 2)}`)

console.log('')
if (mean <= 2.2 && hit / n >= 0.8) {
  console.log('  판정: **제약이 자리를 잠근다.** H6(특징)과 달리 후보가 실제로 줄고 정답을 놓치지 않는다.')
  console.log('        13번째 만에 처음으로 살아남는 제약이다.')
} else if (mean > 3.5) {
  console.log('  판정: 후보가 거의 안 줄어든다 — H6 과 같은 운명. 해소도 특징에 지나지 않는다.')
} else {
  console.log('  판정: 부분적으로 좁힌다. 아래 잔여를 읽어 기계 판정의 한계인지 제약의 한계인지 가른다.')
}

console.log('')
console.log('  정답을 놓친 문항 (기계가 선행사를 못 찾은 것 — 의미적 공지시일 수 있다)')
for (const r of rows.filter((x) => !x.hit).slice(0, 8)) {
  console.log(`    ${r.id} 정답 ${r.ans} · 해소 자리 [${r.ok.join(',') || '없음'}] · 지시 표현 ${r.an.join(' / ')}`)
}

fs.writeFileSync(path.join(OUT_DIR, 'h12-resolution.json'), JSON.stringify({ n, mean, hit, locked: locked.length, lockedRight, dist, rows }, null, 1))
console.log(`\n→ ${path.join(OUT_DIR, 'h12-resolution.json')}`)
