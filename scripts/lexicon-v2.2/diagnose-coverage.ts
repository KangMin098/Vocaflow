// scripts/lexicon-v2.2/diagnose-coverage.ts
// 진단: 왜 13년 모두 출제된 단어가 0인가?
//
//  - 최다 출현 단어 top 30 (몇 년에 등장했는지 + 어느 연도들)
//  - 2019~2026 만 8년 aggregate 결과
//  - 표기 변형 의심 (같은 stem 의 여러 lemma 검출)

import * as fs from 'node:fs'

const IN_FILE = 'data/import/kice-csat-staging.csv'

function parseCsvLine(line: string): string[] {
  const result: string[] = []
  let cur = ''
  let inQuote = false
  for (let i = 0; i < line.length; i++) {
    const c = line[i]
    if (c === '"' && line[i + 1] === '"') { cur += '"'; i++ }
    else if (c === '"') { inQuote = !inQuote }
    else if (c === ',' && !inQuote) { result.push(cur); cur = '' }
    else cur += c
  }
  result.push(cur)
  return result
}

interface Row { year: number; lemma: string; pos: string }

const text = fs.readFileSync(IN_FILE, 'utf-8')
const rows: Row[] = text.split('\n').filter(l => l.trim()).slice(1).map(l => {
  const [year, lemma, pos] = parseCsvLine(l)
  return { year: parseInt(year, 10), lemma, pos }
})

// 1. (lemma, pos) 별 출현 연도
const groups = new Map<string, Set<number>>()
for (const r of rows) {
  const key = `${r.lemma}|${r.pos}`
  if (!groups.has(key)) groups.set(key, new Set())
  groups.get(key)!.add(r.year)
}

console.log('=== Top 30 most-appearing (lemma, pos) ===')
const ranked = Array.from(groups.entries())
  .map(([k, ys]) => ({ k, count: ys.size, years: Array.from(ys).sort() }))
  .sort((a, b) => b.count - a.count)
console.log('years  lemma|pos                          years_set')
for (const r of ranked.slice(0, 30)) {
  console.log(`${String(r.count).padStart(3)}    ${r.k.padEnd(35)}  [${r.years.join(',')}]`)
}

// 2. (lemma) 만으로 통합 (pos 무시) 시 raw_count 분포
const byLemma = new Map<string, Set<number>>()
for (const r of rows) {
  if (!byLemma.has(r.lemma)) byLemma.set(r.lemma, new Set())
  byLemma.get(r.lemma)!.add(r.year)
}
const byLemmaDist = new Map<number, number>()
for (const ys of byLemma.values()) byLemmaDist.set(ys.size, (byLemmaDist.get(ys.size) ?? 0) + 1)
console.log('\n=== Lemma-only (pos 무시) aggregation ===')
console.log(`  Unique lemmas: ${byLemma.size}`)
for (const c of Array.from(byLemmaDist.keys()).sort((a, b) => b - a)) {
  console.log(`    ${c} years: ${byLemmaDist.get(c)}`)
}

// 3. 2019~2026 (8 modern years) 만 aggregate
const modern = new Map<string, Set<number>>()
for (const r of rows) {
  if (r.year >= 2019) {
    const key = `${r.lemma}|${r.pos}`
    if (!modern.has(key)) modern.set(key, new Set())
    modern.get(key)!.add(r.year)
  }
}
const modernDist = new Map<number, number>()
for (const ys of modern.values()) modernDist.set(ys.size, (modernDist.get(ys.size) ?? 0) + 1)
console.log('\n=== 2019~2026 only (8 modern years, 동일 작성자 추정) ===')
console.log(`  Unique (lemma, pos): ${modern.size}`)
for (const c of Array.from(modernDist.keys()).sort((a, b) => b - a)) {
  console.log(`    ${c} years: ${modernDist.get(c)}`)
}
const aey8 = Array.from(modern.values()).filter(ys => ys.size === 8).length
const tier5_modern = Array.from(modern.values()).filter(ys => ys.size >= 5).length
console.log(`  appears_every_year (8/8): ${aey8}`)
console.log(`  ≥5 of 8 years: ${tier5_modern}`)

// 4. 2014~2018 vs 2019~2026 단어 겹침 분석
const lemmasOld = new Set(rows.filter(r => r.year < 2019).map(r => r.lemma))
const lemmasNew = new Set(rows.filter(r => r.year >= 2019).map(r => r.lemma))
const overlap = Array.from(lemmasOld).filter(l => lemmasNew.has(l)).length
console.log('\n=== Old (2014-2018) vs Modern (2019-2026) lemma overlap ===')
console.log(`  Old (2014-2018) unique lemmas:   ${lemmasOld.size}`)
console.log(`  Modern (2019-2026) unique lemmas: ${lemmasNew.size}`)
console.log(`  Overlap:                          ${overlap}`)
console.log(`  Old-only (modern 에 X):          ${lemmasOld.size - overlap}`)
console.log(`  Modern-only (old 에 X):          ${lemmasNew.size - overlap}`)

// 5. 표기 변형 의심 — 같은 stem 의 multiple lemma (e.g. cooperate vs cooperative)
const stems = new Map<string, Set<string>>()
for (const lemma of byLemma.keys()) {
  if (lemma.includes(' ')) continue  // phrase skip
  // 단순 stem: 4글자 prefix
  const stem = lemma.slice(0, Math.min(5, Math.floor(lemma.length * 0.7)))
  if (!stems.has(stem)) stems.set(stem, new Set())
  stems.get(stem)!.add(lemma)
}
const multiVariant = Array.from(stems.entries())
  .filter(([_, lemmas]) => lemmas.size >= 3)
  .sort((a, b) => b[1].size - a[1].size)
console.log('\n=== Top 15 stems with ≥3 variants (lemmatize 필요 추정) ===')
for (const [stem, lemmas] of multiVariant.slice(0, 15)) {
  console.log(`  ${stem}*: ${Array.from(lemmas).slice(0, 8).join(', ')}${lemmas.size > 8 ? ` … +${lemmas.size - 8}` : ''}`)
}
