// scripts/lexicon-v2.2/kice-csat-aggregate.ts
//
// Phase 2 — AGGREGATE
// staging CSV (year별 row) → (lemma, pos) 키로 cross-year 통합
//
// 입력: data/import/kice-csat-staging.csv
// 출력: data/import/kice-csat-aggregated.csv

import * as fs from 'node:fs'

const IN_FILE = 'data/import/kice-csat-staging.csv'
const OUT_FILE = 'data/import/kice-csat-aggregated.csv'

const ALLOWED_POS = new Set(['n','v','adj','adv','prep','conj','pron','det','interj','phrase'])

interface StagingRow {
  year: number
  lemma: string
  pos: string
  meaning_ko: string
  question_nos: number[]
  kice_difficulty: string
}

interface AggregatedRow {
  lemma: string
  pos: string
  meaning_ko: string
  meaning_ko_alt: string[]
  raw_count: number
  normalized_freq: number
  rank_in_source: number
  year_from: number
  year_to: number
  appears_every_year: boolean
  metadata: Record<string, unknown>
}

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

function loadStaging(): StagingRow[] {
  const text = fs.readFileSync(IN_FILE, 'utf-8')
  const lines = text.split('\n').filter(l => l.trim())
  const rows: StagingRow[] = []
  for (let i = 1; i < lines.length; i++) {
    const [year, lemma, pos, meaning, qs, diff] = parseCsvLine(lines[i])
    rows.push({
      year: parseInt(year, 10),
      lemma, pos, meaning_ko: meaning,
      question_nos: qs ? qs.split(';').map(q => parseInt(q, 10)).filter(n => !isNaN(n)) : [],
      kice_difficulty: diff,
    })
  }
  return rows
}

// R1-R4 의미 통합
function mergeMeanings(meaningsByYear: Map<number, string>): { main: string; alt: string[] } {
  const years = Array.from(meaningsByYear.keys()).sort()
  if (years.length === 0) return { main: '', alt: [] }
  if (years.length === 1) return { main: meaningsByYear.get(years[0])!, alt: [] }

  const meanings = years.map(y => meaningsByYear.get(y)!)
  const sets = meanings.map(m => new Set(m.split(',').map(s => s.trim()).filter(s => s)))

  // R1: 모든 set 이 동일
  const firstSet = sets[0]
  const allSame = sets.every(s =>
    s.size === firstSet.size && Array.from(s).every(x => firstSet.has(x))
  )
  if (allSame) return { main: meanings[0], alt: [] }

  // R2: 최신 = superset
  const latestSet = sets[sets.length - 1]
  const isLatestSuperset = sets.every(s =>
    Array.from(s).every(x => latestSet.has(x))
  )
  if (isLatestSuperset) {
    return { main: meanings[meanings.length - 1], alt: [] }
  }

  // R3/R4: 부분 중복 또는 별개 — 최신 채택 + 나머지 alt
  const main = meanings[meanings.length - 1]
  const altSet = new Set<string>()
  for (let i = 0; i < meanings.length - 1; i++) {
    if (meanings[i] !== main) altSet.add(meanings[i])
  }
  return { main, alt: Array.from(altSet) }
}

function main(): void {
  const staging = loadStaging()
  console.log(`[Phase 2] Loaded ${staging.length} staging rows`)

  // 알 수 없는 pos 진단
  const posCount = new Map<string, number>()
  for (const r of staging) posCount.set(r.pos, (posCount.get(r.pos) ?? 0) + 1)
  const unknownPos: string[] = []
  for (const [p, c] of posCount) {
    if (!ALLOWED_POS.has(p)) unknownPos.push(`${p}(${c})`)
  }
  if (unknownPos.length > 0) {
    console.warn(`  ⚠️ Unknown POS tokens (not in v2.1 CHECK constraint):`)
    for (const u of unknownPos) console.warn(`     - ${u}`)
  }
  console.log(`  POS distribution:`)
  for (const [p, c] of Array.from(posCount.entries()).sort((a, b) => b[1] - a[1])) {
    console.log(`    ${p}: ${c}`)
  }

  // (lemma, pos) 그룹핑
  const groups = new Map<string, StagingRow[]>()
  for (const r of staging) {
    const key = `${r.lemma}|${r.pos}`
    if (!groups.has(key)) groups.set(key, [])
    groups.get(key)!.push(r)
  }

  console.log(`\n  Unique (lemma, pos): ${groups.size}`)

  const allYears = Array.from(new Set(staging.map(r => r.year))).sort()
  const yearFrom = allYears[0]
  const yearTo = allYears[allYears.length - 1]
  const totalYears = yearTo - yearFrom + 1

  const aggregated: AggregatedRow[] = []
  for (const [key, rows] of groups) {
    const [lemma, pos] = key.split('|')
    const yearsAppeared = Array.from(new Set(rows.map(r => r.year))).sort()
    const rawCount = yearsAppeared.length

    const meaningsByYear = new Map<number, string>()
    const questionHistory: Record<string, number[]> = {}
    const difficultyByYear: Record<string, string> = {}

    for (const r of rows) {
      if (!meaningsByYear.has(r.year) && r.meaning_ko) {
        meaningsByYear.set(r.year, r.meaning_ko)
      }
      if (!questionHistory[r.year]) questionHistory[r.year] = []
      questionHistory[r.year].push(...r.question_nos)
      questionHistory[r.year] = Array.from(new Set(questionHistory[r.year])).sort((a, b) => a - b)
      if (r.kice_difficulty) difficultyByYear[r.year] = r.kice_difficulty
    }

    const { main: mergedMain, alt } = mergeMeanings(meaningsByYear)

    const meaningsByYearObj: Record<string, { ko: string; pos: string }> = {}
    for (const [y, m] of meaningsByYear) {
      meaningsByYearObj[y] = { ko: m, pos }
    }

    aggregated.push({
      lemma, pos,
      meaning_ko: mergedMain,
      meaning_ko_alt: alt,
      raw_count: rawCount,
      normalized_freq: (rawCount / totalYears) * 10000,
      rank_in_source: 0,
      year_from: yearFrom,
      year_to: yearTo,
      appears_every_year: rawCount === totalYears,
      metadata: {
        years_appeared: yearsAppeared,
        first_year: yearsAppeared[0],
        last_year: yearsAppeared[yearsAppeared.length - 1],
        question_history: questionHistory,
        kice_difficulty_per_year: difficultyByYear,
        meanings_by_year: meaningsByYearObj,
        etl_version: '2.0',
      },
    })
  }

  // rank_in_source 부여 (raw_count DESC, lemma ASC)
  aggregated.sort((a, b) =>
    b.raw_count - a.raw_count || a.lemma.localeCompare(b.lemma)
  )
  aggregated.forEach((r, i) => { r.rank_in_source = i + 1 })

  // 통계
  const tierDist: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0 }
  for (const r of aggregated) {
    let tier = 2
    if (r.raw_count >= 10) tier = 5
    else if (r.raw_count >= 4) tier = 4
    else if (r.raw_count >= 2) tier = 3
    tierDist[tier]++
  }
  const aey = aggregated.filter(r => r.appears_every_year).length
  const rcDist = new Map<number, number>()
  for (const r of aggregated) rcDist.set(r.raw_count, (rcDist.get(r.raw_count) ?? 0) + 1)

  console.log(`\n  Tier distribution (raw_count 기반, 트리거 v2.1 정합):`)
  console.log(`    Tier 5 (≥10): ${tierDist[5]}`)
  console.log(`    Tier 4 (4-9): ${tierDist[4]}`)
  console.log(`    Tier 3 (2-3): ${tierDist[3]}`)
  console.log(`    Tier 2 (1):   ${tierDist[2]}`)
  console.log(`\n  raw_count breakdown:`)
  for (const rc of Array.from(rcDist.keys()).sort((a, b) => b - a)) {
    console.log(`    ${rc} years: ${rcDist.get(rc)}`)
  }
  console.log(`\n  appears_every_year=true (13/13): ${aey}`)
  console.log(`  meaning_ko_alt 가 있는 row: ${aggregated.filter(r => r.meaning_ko_alt.length > 0).length}`)

  // CSV 출력
  const header = 'lemma,pos,meaning_ko,meaning_ko_alt,raw_count,normalized_freq,rank_in_source,year_from,year_to,appears_every_year,metadata'
  const csv = [header, ...aggregated.map(r => {
    const main = r.meaning_ko.replace(/"/g, '""')
    const alt = JSON.stringify(r.meaning_ko_alt).replace(/"/g, '""')
    const meta = JSON.stringify(r.metadata).replace(/"/g, '""')
    return `"${r.lemma}",${r.pos},"${main}","${alt}",${r.raw_count},${r.normalized_freq.toFixed(2)},${r.rank_in_source},${r.year_from},${r.year_to},${r.appears_every_year},"${meta}"`
  })].join('\n')

  fs.writeFileSync(OUT_FILE, csv, 'utf-8')
  console.log(`\n✅ Wrote ${aggregated.length} rows to ${OUT_FILE}`)
}

main()
