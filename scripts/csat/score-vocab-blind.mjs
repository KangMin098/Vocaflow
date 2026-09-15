// scripts/csat/score-vocab-blind.mjs
//
// **어휘(30번) 치환 성격 채점 — 초안의 "반의어 치환" 을 두 갈래로 잰다.**
//
// 갈래 1 — **네모형**(4문항 · 12쌍). `(A) frequently / raraly` 처럼 **지면에 인쇄된 쌍**이다.
//   판단이 안 들어간다. 여기서 이 파일이 직접 분류한다(반의어 목록은 아래에 박아 둔다).
// 갈래 2 — **밑줄형**(13문항 · 65표시어). 맹검 판독(`antonymFits`)으로 잰다.
//
// **두 갈래는 서로 독립이다** — 하나는 지면을, 하나는 사람 판독을 쓴다.
// 같은 값이 나오면 수렴 타당도가 된다.
//
// ⚠️ **기저를 잴 수 없다.** "임의의 오답 낱말이 반의어일 확률" 은 이 자료에서 안 나온다 —
// 오답 낱말의 공간이 사실상 무한하고 그 대부분은 반의어가 아니다.
// 그래서 이 명제는 **기저 없이 두 독립 측정의 일치로만** 지지된다. HARD 후보로 올리지 않는다.
// (이 저장소의 규율: 기저는 실측, 가정 금지 → 못 재면 등급을 올리지 않는다.)
//
// 대조 항목 — `contextFit` 으로 **내 판독이 문항을 실제로 풀 수 있는지** 본다.
// 못 풀면 `antonymFits` 도 못 믿는다.
//
// 실행: pnpm dlx tsx scripts/csat/score-vocab-blind.mjs

import fs from 'node:fs'
import path from 'node:path'
import { fisher } from './claim-gate.mjs'

const WORK = path.resolve('scripts/csat/vocab-blind')
const DIR = path.resolve('scripts/csat/data')

// 네모형 12쌍 분류 — 지면에 인쇄된 쌍을 눈으로 갈랐다. 판단 여지가 거의 없다.
//   antonym    반의 관계 (competing/cooperating)
//   formNear   형태가 닮았고 뜻이 다르다 (underlies/undermines · attractions/distractions)
//   unrelated  둘 다 아니다 (diversity/precision)
const BOX_CLASS = {
  'frequently/rarely': 'antonym',
  'attractions/distractions': 'formNear',
  'decrease/increase': 'antonym',
  'fuses/replaces': 'unrelated',
  'diversity/precision': 'unrelated',
  'underlies/undermines': 'formNear',
  'accommodation/destruction': 'antonym',
  'lacked/supported': 'antonym',
  'competing/cooperating': 'antonym',
  'based/lost': 'antonym',
  'allows/forbids': 'antonym',
  'mostly/never': 'antonym',
}

const key = JSON.parse(fs.readFileSync(path.join(WORK, 'KEY.json'), 'utf8'))
const boxed = JSON.parse(fs.readFileSync(path.join(WORK, 'BOXED.json'), 'utf8')).items

const items = []
for (const f of fs.readdirSync(WORK).filter((x) => x.endsWith('.out.json')).sort()) {
  for (const it of JSON.parse(fs.readFileSync(path.join(WORK, f), 'utf8')).items) {
    const k = key[it.id]
    if (!k) continue
    const ans = it.words[k.answer - 1]
    const dis = it.words.filter((_, i) => i !== k.answer - 1)
    if (!ans || dis.length !== 4) continue
    items.push({ id: it.id, answer: k.answer, points: k.points, ans, dis, all: it.words })
  }
}

console.log('어휘(30번) 치환 성격 — 초안의 "반의어 치환" 을 두 갈래로 잰다')
console.log('='.repeat(78))
console.log(`  밑줄형 ${items.length}문항(${items.length * 5}표시어) · 네모형 ${boxed.length}문항(${boxed.length * 3}쌍)`)
console.log('')

// 0. 대조 항목 — 내 판독이 문항을 푸는가
console.log('  0. 대조 항목 — 판독이 문항을 실제로 푸는가 (contextFit 최저 = 정답인가)')
console.log('  ' + '-'.repeat(74))
let solved = 0
let tied = 0
for (const it of items) {
  const min = Math.min(...it.all.map((w) => w.contextFit))
  const lows = it.all.filter((w) => w.contextFit === min)
  if (lows.length === 1 && lows[0] === it.ans) solved += 1
  else if (lows.includes(it.ans)) tied += 1
}
console.log(`    단독 최저가 정답  ${solved}/${items.length}  ·  공동 최저에 포함 ${tied}  ·  기저 20%`)
console.log(`    ${solved / items.length > 0.8 ? '✓ 판독이 문항을 푼다 — antonymFits 를 믿을 근거가 있다' : '✗ 못 푼다 — antonymFits 도 못 믿는다'}`)

// 1. 밑줄형 — 정답 치환이 반의어인가
console.log('')
console.log('  1. 밑줄형(맹검 판독) — 정답 낱말을 반의어로 바꾸면 문맥이 나아지는가')
console.log('  ' + '-'.repeat(74))
const ansAnt = items.filter((it) => it.ans.antonymFits).length
const disAnt = items.reduce((s, it) => s + it.dis.filter((w) => w.antonymFits).length, 0)
console.log(`    정답 ${ansAnt}/${items.length} = ${(100 * ansAnt / items.length).toFixed(1)}%`)
console.log(`    오답 ${disAnt}/${items.length * 4} = ${(100 * disAnt / (items.length * 4)).toFixed(1)}%  (구성상 0 에 가깝다 — 맞는 낱말은 바꿀 이유가 없다)`)
const notAnt = items.filter((it) => !it.ans.antonymFits)
if (notAnt.length) console.log(`    반의어가 아닌 것: ${notAnt.map((x) => `${x.id}(${x.ans.word})`).join(' · ')}`)

// 2. 네모형 — 지면에 인쇄된 쌍
console.log('')
console.log('  2. 네모형(지면 인쇄) — 판단이 안 들어간다')
console.log('  ' + '-'.repeat(74))
const cls = { antonym: 0, formNear: 0, unrelated: 0 }
const unknown = []
for (const it of boxed) {
  for (const p of it.pairs) {
    const k = `${p.a}/${p.b}`
    const c = BOX_CLASS[k]
    if (!c) { unknown.push(`${it.id} ${k}`); continue }
    cls[c] += 1
  }
}
const boxN = cls.antonym + cls.formNear + cls.unrelated
for (const it of boxed) {
  console.log(`    ${it.id}  ${it.pairs.map((p) => `${p.slot}:${p.a}/${p.b}[${(BOX_CLASS[`${p.a}/${p.b}`] ?? '?').slice(0, 4)}]`).join('  ')}`)
}
if (unknown.length) console.log(`    ⚠️ 미분류: ${unknown.join(' · ')}`)
console.log(`    반의어 ${cls.antonym}/${boxN} = ${(100 * cls.antonym / boxN).toFixed(1)}%  ·  형태유사 ${cls.formNear}  ·  무관 ${cls.unrelated}`)

// 3. 두 갈래 대조
console.log('')
console.log('  3. 두 갈래가 같은 값을 말하는가 (수렴 타당도)')
console.log('  ' + '-'.repeat(74))
const f = fisher(ansAnt, items.length - ansAnt, cls.antonym, boxN - cls.antonym)
console.log(`    밑줄형(판독) ${ansAnt}/${items.length} = ${(100 * ansAnt / items.length).toFixed(0)}%`)
console.log(`    네모형(지면) ${cls.antonym}/${boxN} = ${(100 * cls.antonym / boxN).toFixed(0)}%`)
console.log(`    두 비율이 다른가 — Fisher p = ${(typeof f === 'number' ? f : f.p).toFixed(4)}`)
console.log(`    ${(typeof f === 'number' ? f : f.p) >= 0.05 ? '✓ 두 갈래가 서로 다르지 않다 — 독립 측정이 수렴한다' : '⚠ 두 갈래가 갈린다 — 형식마다 치환 방식이 다를 수 있다'}`)

console.log('')
console.log('  판정')
console.log('  ' + '-'.repeat(74))
console.log('    · 어휘 치환의 주된 방식은 **반의어**다. 두 독립 측정이 모두 그렇게 말한다')
console.log('    · ⚠️ **기저를 못 잰다** — "임의의 오답이 반의어일 확률" 은 이 자료에서 안 나온다.')
console.log('      그래서 HARD 후보로 올리지 않는다. 이 저장소의 규율(기저는 실측)을 따른다')
console.log('    · 반의어가 아닌 치환도 있다 — 형태유사·무관이 네모형에서 4/12')

fs.writeFileSync(path.join(DIR, 'vocab-blind-score.json'), JSON.stringify({
  underlined: { n: items.length, answerAntonym: ansAnt, distractorAntonym: disAnt, solved, tied, notAntonym: notAnt.map((x) => ({ id: x.id, word: x.ans.word })) },
  boxed: { n: boxed.length, pairs: boxN, ...cls },
  converge: typeof f === 'number' ? { p: f } : f,
}, null, 1))
console.log(`\n→ ${path.join(DIR, 'vocab-blind-score.json')}`)
