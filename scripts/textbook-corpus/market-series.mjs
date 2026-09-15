// scripts/textbook-corpus/market-series.mjs
//
// **시중이 파는 단위는 「유형 × 학령」이 아니라 시리즈다.**
//
// 카탈로그가 오래 (유형 × 학령) 격자를 그렸는데, 그 축으로는 시장을 못 센다. 서점에서 파는
// 것은 「독해 고1」이 아니라 **「리딩튜터 주니어 Level 2」** 이고, 한 브랜드가 학령 전체를
// 계단으로 잇는다(`series.ts` 머리말이 관측한 그대로다). 그 사다리가 곧 상품 라인이다.
//
// 이 스크립트는 코퍼스 매니페스트에서 **시리즈 축을 실측**해 리포트로 낸다. 화면이 그것을
// 분모로 쓴다 — 「우리 시리즈 N / 시장 시리즈 M」.
//
// ⚠️ **원문은 아무것도 안 담는다.** 대상은 저작권이 존속하는 상업 교재라, 리포트에 들어가는
//   것은 분류축(출판사·시리즈·학교급·역할)과 개수뿐이다.
//
// 쓰는 법:
//   node scripts/textbook-corpus/market-series.mjs            # 훑고 출력
//   node scripts/textbook-corpus/market-series.mjs --write    # docs/reports 에 저장

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const REPO = join(HERE, '..', '..')
const STORE = process.env.TEXTBOOK_CORPUS_STORE ?? 'd:/workspace/textbook-corpus'

const mp = join(STORE, 'manifest.json')
if (!existsSync(mp)) {
  console.error(`코퍼스 매니페스트가 없다: ${mp}`)
  process.exit(1)
}
const m = JSON.parse(readFileSync(mp, 'utf8'))
const all = Array.isArray(m.docs) ? m.docs : Object.values(m.docs)

/**
 * 기출은 시리즈가 아니다 — 평가원 시험지다. 섞으면 「시장 시리즈 수」가 부푼다.
 * 시리즈가 안 붙은 문서(참고자료 등)도 뺀다: 이름이 없는 것을 하나로 셀 수는 없다.
 */
const docs = all.filter((d) => d.category !== '기출' && d.series)

const byId = new Map()
for (const d of docs) {
  const key = `${d.publisher ?? '미상'}|${d.series}`
  if (!byId.has(key)) {
    byId.set(key, {
      publisher: d.publisher ?? '미상',
      series: d.series,
      docs: 0,
      categories: new Set(),
      schools: new Set(),
      roles: new Set(),
      /** 이 시리즈가 실제로 덮는 학년 범위. 사다리가 몇 단인지의 근거다. */
      gradeMin: null,
      gradeMax: null,
    })
  }
  const s = byId.get(key)
  s.docs += 1
  if (d.category) s.categories.add(d.category)
  if (d.school) s.schools.add(d.school)
  if (d.role) s.roles.add(d.role)
  if (typeof d.grade_min === 'number') s.gradeMin = s.gradeMin == null ? d.grade_min : Math.min(s.gradeMin, d.grade_min)
  if (typeof d.grade_max === 'number') s.gradeMax = s.gradeMax == null ? d.grade_max : Math.max(s.gradeMax, d.grade_max)
}

const series = [...byId.values()]
  .map((s) => ({
    publisher: s.publisher,
    series: s.series,
    docs: s.docs,
    categories: [...s.categories].sort(),
    schools: [...s.schools].sort(),
    roles: [...s.roles].sort(),
    gradeMin: s.gradeMin,
    gradeMax: s.gradeMax,
    /** 학년 폭 — 사다리가 넓을수록 한 브랜드가 더 오래 붙잡는다. */
    gradeSpan: s.gradeMin != null && s.gradeMax != null ? s.gradeMax - s.gradeMin + 1 : null,
  }))
  .sort((a, b) => b.docs - a.docs || a.series.localeCompare(b.series))

const byPublisher = new Map()
for (const s of series) {
  if (!byPublisher.has(s.publisher)) byPublisher.set(s.publisher, [])
  byPublisher.get(s.publisher).push(s.series)
}

/** 유형별 시리즈 수 — 카탈로그가 「이 유형에 시장 시리즈가 몇 개인가」를 물을 때 쓴다. */
const byCategory = new Map()
for (const s of series) {
  for (const c of s.categories) {
    if (!byCategory.has(c)) byCategory.set(c, new Set())
    byCategory.get(c).add(`${s.publisher}|${s.series}`)
  }
}

const report = {
  $schema: 'textbook-market-series/1',
  generatedAt: new Date().toISOString(),
  provenance: {
    manifest: mp,
    manifestAt: m.generatedAt ?? null,
    corpusDocuments: all.length,
    rule: '기출(평가원 시험지)과 시리즈명이 없는 문서는 뺀다 — 시리즈로 셀 수 없다.',
    privacy: '원문은 담지 않는다 — 출판사·시리즈명·분류축·개수만.',
  },
  documentsCounted: docs.length,
  seriesCount: series.length,
  publisherCount: byPublisher.size,
  byCategory: [...byCategory]
    .map(([category, set]) => ({ category, series: set.size }))
    .sort((a, b) => b.series - a.series),
  byPublisher: [...byPublisher]
    .map(([publisher, list]) => ({ publisher, series: list.length, names: list }))
    .sort((a, b) => b.series - a.series),
  series,
}

const pad = (s, n) => String(s).padEnd(n)
console.log(`\n시중 시리즈 실측 — 문서 ${docs.length} / 코퍼스 ${all.length}\n`)
console.log(`시리즈 ${series.length}개 · 출판사 ${byPublisher.size}곳\n`)
for (const p of report.byPublisher) {
  console.log(`  ${pad(p.publisher, 8)} ${String(p.series).padStart(2)}개  ${p.names.join(' · ')}`)
}
console.log('\n유형별 시리즈 수 — 카탈로그의 분모:')
for (const c of report.byCategory) console.log(`  ${pad(c.category, 6)} ${c.series}개`)
console.log('\n사다리가 넓은 순 (학년 폭):')
for (const s of [...series].sort((a, b) => (b.gradeSpan ?? 0) - (a.gradeSpan ?? 0)).slice(0, 8)) {
  console.log(
    `  ${pad(s.series, 26)} ${s.gradeMin ?? '?'}~${s.gradeMax ?? '?'}학년 (${s.gradeSpan ?? '?'}년) · ${s.docs}종`,
  )
}

if (process.argv.includes('--write')) {
  const out = join(REPO, 'docs', 'reports', 'textbook-market-series.json')
  writeFileSync(out, JSON.stringify(report, null, 2) + '\n')
  console.log(`\n→ ${out}`)
}
