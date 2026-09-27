// scripts/csat/design-drain-agreement.mjs
//
// **출제 설계 주석 — 두 판정자 일치율.** (기준: docs/csat-learner/design-annotation-criteria.md §검증)
// `chunk-X.out.json`(판정자 A) 와 `chunk-X.b.json`(판정자 B)가 둘 다 있는 청크만 잰다. 읽기만 한다.
//
//   역할(문장 단위): 엄격 일치 · 허용 대안 인정 일치 · Cohen κ(엄격)
//   패턴 · 변환(문항 단위): 일치 비율
// 대량 진행 문턱: 역할 허용 일치 ≥ 0.8 (기준 문서). 못 넘으면 어긋난 역할 쌍 상위를 보고 기준을 고친다.
//
// 실행: node scripts/csat/design-drain-agreement.mjs

import fs from 'node:fs'
import path from 'node:path'

const WORK = path.resolve('scripts/csat/design-drain')
const pairs = fs.readdirSync(WORK).filter((f) => f.endsWith('.b.json')).map((b) => [b.replace('.b.json', '.out.json'), b])

function kappa(xs, ys) {
  const n = xs.length
  if (!n) return null
  const labels = [...new Set([...xs, ...ys])]
  const po = xs.filter((x, i) => x === ys[i]).length / n
  const pe = labels.reduce((s, l) => s + (xs.filter((x) => x === l).length / n) * (ys.filter((y) => y === l).length / n), 0)
  return pe === 1 ? 1 : (po - pe) / (1 - pe)
}

const all = { xs: [], ys: [], lenient: 0, pattern: [0, 0], transform: [0, 0], confusions: new Map() }
for (const [a, b] of pairs) {
  if (!fs.existsSync(path.join(WORK, a))) continue
  const A = new Map(JSON.parse(fs.readFileSync(path.join(WORK, a), 'utf8')).items.map((r) => [r.id, r]))
  const B = JSON.parse(fs.readFileSync(path.join(WORK, b), 'utf8')).items
  const xs = []
  const ys = []
  let lenient = 0
  let pat = 0
  let tr = 0
  let n = 0
  for (const rb of B) {
    const ra = A.get(rb.id)
    if (!ra || ra.roles.length !== rb.roles.length) continue
    n++
    if (ra.pattern === rb.pattern) pat++
    if (ra.transform === rb.transform) tr++
    ra.roles.forEach((x, i) => {
      const y = rb.roles[i]
      xs.push(x)
      ys.push(y)
      const altA = (ra.alternatives ?? []).filter((t) => t.index === i).map((t) => t.role)
      const altB = (rb.alternatives ?? []).filter((t) => t.index === i).map((t) => t.role)
      if (x === y || altA.includes(y) || altB.includes(x)) lenient++
      else {
        const k = [x, y].sort().join(' ↔ ')
        all.confusions.set(k, (all.confusions.get(k) ?? 0) + 1)
      }
    })
  }
  const k = kappa(xs, ys)
  console.log(
    `${a.replace('.out.json', '')} · 문항 ${n} · 문장 ${xs.length} · 역할 엄격 ${(xs.filter((x, i) => x === ys[i]).length / xs.length).toFixed(2)} · 허용 ${(lenient / xs.length).toFixed(2)} · κ ${k?.toFixed(2)} · 패턴 ${pat}/${n} · 변환 ${tr}/${n}`,
  )
  all.xs.push(...xs)
  all.ys.push(...ys)
  all.lenient += lenient
  all.pattern[0] += pat
  all.pattern[1] += n
  all.transform[0] += tr
  all.transform[1] += n
}
if (all.xs.length) {
  const strict = all.xs.filter((x, i) => x === all.ys[i]).length / all.xs.length
  const lenient = all.lenient / all.xs.length
  console.log(
    `\n전체 · 문장 ${all.xs.length} · 역할 엄격 ${strict.toFixed(2)} · 허용 ${lenient.toFixed(2)} · κ ${kappa(all.xs, all.ys)?.toFixed(2)} · 패턴 ${all.pattern[0]}/${all.pattern[1]} · 변환 ${all.transform[0]}/${all.transform[1]}`,
  )
  console.log(`대량 진행 문턱(허용 ≥ 0.80): ${lenient >= 0.8 ? '통과' : '미달 — 기준을 고친다'}`)
  const top = [...all.confusions].sort((a, b) => b[1] - a[1]).slice(0, 8)
  if (top.length) console.log('어긋난 역할 쌍 상위:', top.map(([k, v]) => `${k} ${v}`).join(' · '))
}
