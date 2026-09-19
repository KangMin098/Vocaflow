// scripts/csat/verify-blueprint-items.mjs
//
// **R5 — 설계도대로 만든 문항이 기출 대역 안에 드는가.**
//
// 유형마다 문항 하나를 만들어 `data/blueprint-items.json` 에 넣고, 이 자가 잰다.
// 재는 것은 셋이다:
//
//   ① 계측 5축 — 글자수 · 낱말수 · 문장당 낱말 · 낱말 길이 · 어휘 다양도.
//      기준은 `type-bands-all.json` 의 **수능 14개년(듣기는 대본 7개년) 10~90 분위**.
//   ② 형식 제약 — F1 자리 · F2 배점 · F5 선지 형태 (`type-constraints.json` 의 HARD 만)
//   ③ 가족 제약 — G1·G4 ①회피 · G3 한글 선지 3점 금지
//
// ⚠️ **이 점수가 무엇을 말하고 무엇을 말하지 않는지.**
//   말하는 것: "기출과 같은 **양식**으로 쓸 수 있다."
//   말하지 않는 것: "정답이 맞다." 어휘 유사도로 정답을 고르면 27.3%(기저 20%, 신뢰구간이 기저를 포함)라
//   이 저장소의 도구는 정답성을 모른다(P10.18). 두 축을 곱해 "몇 % 부합" 이라고 적으면 거짓말이 된다.
//
// ⚠️ **겨냥한 축과 아닌 축.** ①은 만들 때 목표로 삼은 값이므로 맞아도 순환이다.
//   ②③은 규칙 준수 확인이다. 둘 다 "설계도를 따랐다" 의 증거이지 품질의 독립 증거가 아니다.
//
// 실행: node scripts/csat/verify-blueprint-items.mjs

import fs from 'node:fs'
import path from 'node:path'

const DIR = path.resolve('scripts/csat/data')
const rd = (f) => JSON.parse(fs.readFileSync(path.join(DIR, f), 'utf8'))

const bands = rd('type-bands-all.json').bands
const cons = rd('type-constraints.json')
const inv = rd('type-inventory.json')
const F = path.join(DIR, 'blueprint-items.json')
const items = fs.existsSync(F) ? JSON.parse(fs.readFileSync(F, 'utf8')) : { types: {} }

const W = (s) => (s.match(/[A-Za-z][A-Za-z'-]*/g) ?? [])
const S = (s) => s.split(/[.!?]+\s/).filter((x) => x.trim().length > 3)
const AXES = ['chars', 'words', 'sentLen', 'wordLen', 'ttr']

function metrics(p) {
  const w = W(p)
  return {
    chars: p.length,
    words: w.length,
    sentLen: w.length / Math.max(1, S(p).length),
    wordLen: w.reduce((s, x) => s + x.length, 0) / Math.max(1, w.length),
    ttr: new Set(w.map((x) => x.toLowerCase())).size / Math.max(1, w.length),
  }
}

const isKo = (s) => /[가-힣]/.test(s ?? '')

const rows = []
for (const r of inv.rows.filter((x) => x.current)) {
  const t = r.type
  const it = items.types?.[t]
  if (!it) { rows.push({ type: t, has: false }); continue }

  // 지문 — 순서형은 토막이 지문의 일부다
  const body = [it.passage ?? '', ...Object.values(it.blocks ?? {})].join(' ').replace(/\s+/g, ' ').trim()
  const m = metrics(body)
  const b = bands[t]
  const axes = {}
  let inBand = 0, axisN = 0
  if (b?.ok) {
    for (const k of AXES) {
      const band = b[k]
      if (!band) continue
      axisN += 1
      const ok = m[k] >= band.lo && m[k] <= band.hi
      if (ok) inBand += 1
      axes[k] = { v: +m[k].toFixed(3), lo: +band.lo.toFixed(3), hi: +band.hi.toFixed(3), ok }
    }
  }

  // 형식·가족 제약
  const viol = []
  const c = cons.types?.[t] ?? {}
  for (const f of c.format ?? []) {
    if (f.kind !== 'HARD') continue
    if (f.id === 'F1' && f.nos?.length === 1 && it.no !== f.nos[0]) viol.push(`F1 자리 ${it.no} ≠ ${f.nos[0]}`)
    if (f.id === 'F2') {
      const wantHigh = f.hit === f.n && f.n > 0
      const isHigh = it.points === 3
      if (wantHigh !== isHigh) viol.push(`F2 배점 ${it.points} (규칙: ${wantHigh ? '항상 3점' : '3점 없음'})`)
    }
    if (f.id === 'F5') {
      const ch = (it.choices ?? []).map((x) => String(x).trim())
      if (!ch.length) { viol.push('F5 선지 없음'); continue }
      if (f.top === '기호') {
        // 기호형(어법·어휘·무관·삽입·지칭)은 선지가 본문에 찍힌 ①~⑤ 다.
        // 문항 파일에는 **밑줄 친 조각 5개**를 적는다 — 온전한 문장 5개가 오면 유형을 잘못 만든 것이다.
        if (ch.length !== 5) viol.push(`F5 기호형인데 선지 ${ch.length}개`)
        else if (Math.max(...ch.map((x) => x.length)) > 60) viol.push('F5 기호형인데 선지가 문장이다')
      } else {
        const shape = Math.max(...ch.map((x) => x.length)) <= 3 ? '기호'
          : ch.every((x) => /\([ABCD]\)/.test(x)) ? '조합'
            : isKo(ch.join(' ')) ? '한국어' : '영어'
        if (shape !== f.top) viol.push(`F5 선지 형태 ${shape} ≠ ${f.top}`)
      }
    }
  }
  for (const g of c.family ?? []) {
    if (g.kind === 'REJECT') continue
    if ((g.id === 'G1' || g.id === 'G4') && it.answer === 1) viol.push(`${g.id} ①에 정답 (예외 0인 규칙)`)
    if (g.id === 'G3' && it.points === 3) viol.push('G3 한글 선지에 3점')
  }

  const pass = b?.ok && axisN > 0 && inBand === axisN && viol.length === 0
  rows.push({ type: t, has: true, no: it.no, points: it.points, answer: it.answer,
    words: m.words, inBand, axisN, axes, viol, pass })
}

const have = rows.filter((r) => r.has)
const pass = have.filter((r) => r.pass)
const axisTotal = have.reduce((s, r) => s + (r.axisN ?? 0), 0)
const axisOk = have.reduce((s, r) => s + (r.inBand ?? 0), 0)

console.log(`문항 있는 유형 ${have.length}/${rows.length} · 전 축 통과 ${pass.length}/${have.length}`)
console.log(`계측 축 ${axisOk}/${axisTotal} 대역 안 · 제약 위반 ${have.reduce((s, r) => s + r.viol.length, 0)}건`)
console.log('')
console.log(['type', 'no', '점', '답', '낱말', '대역', '위반'].join('\t'))
for (const r of rows) {
  if (!r.has) { console.log([r.type, '—', '', '', '', '문항 없음'].join('\t')); continue }
  const bad = AXES.filter((k) => r.axes[k] && !r.axes[k].ok).map((k) => `${k} ${r.axes[k].v}∉[${r.axes[k].lo},${r.axes[k].hi}]`)
  console.log([r.type, r.no, r.points, r.answer, r.words, `${r.inBand}/${r.axisN}`, [...bad, ...r.viol].join(' · ')].join('\t'))
}

fs.writeFileSync(path.join(DIR, 'blueprint-items-score.json'), JSON.stringify({
  scope: '수능 14개년 대역(듣기는 대본 7개년) · 10~90 분위',
  caveat: '양식 일치의 증거일 뿐 정답성의 증거가 아니다 (P10.18: 어휘 유사도의 정답 적중 27.3%, 기저 20%)',
  typesWithItem: have.length, denominator: rows.length,
  fullPass: pass.length, axisOk, axisTotal,
  rows,
}, null, 1))
console.log(`\n→ ${path.join(DIR, 'blueprint-items-score.json')}`)
