// scripts/textbook/type-spread.mjs
//
// **권당 유형 폭을 시중과 견준다 — 조판 스냅샷에만 묻는다.**
//
// `market-benchmark.mjs` 의 A5 는 창고를 재고, 권 모드에서도 출판사별로는 「못 잼」으로
// 빠진다. 그래서 **권당 유형 폭을 보는 자가 없었다.** 이 스크립트가 그 자리다.
//
// 왜 DB 가 아니라 스냅샷인가: 재려는 것이 「창고에 무엇이 있나」가 아니라
// **「지면에 무엇이 실렸나」**이기 때문이다. 창고 재고는 `type-gap.mjs` 가 잰다.
// 스냅샷(`volume-contents.json`)은 조판과 같은 코드 경로로 조합한 결과이고,
// 학습자 상세면과 관리자 콘솔이 읽는 바로 그 파일이다.
//
// ⚠️ **스냅샷이 낡으면 이 수치도 낡는다.** `generatedAt` 을 함께 찍는다 —
//   낡은 것이 보여야 `contents-snapshot.mjs` 를 다시 돌린다.
//
// **읽기만 한다.** 몇 번을 돌려도 결과가 같다(재실행 안전).
//
// 실행: npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/type-spread.mjs [--json]

import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..')
const read = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'))

const snapshot = read('apps/web/src/lib/textbook/volume-contents.json')
const spec = read('packages/library-pipeline/src/textbook/market-spec.json')

const { measureSpread, SERIES_SPINE, V_TO_MARKET_BUCKET } = await import('@vocaflow/library-pipeline')

/** 시중 **권당** 유형 수 중앙값. 합본 수(16종)가 아니다 — 한 권을 한 권과 견준다. */
const perSchool = spec.typeCoverage?.perDocument?.bySchool ?? {}
const MARKET = {}
for (const k of ['초등', '중등', '고등']) {
  const m = perSchool[k]?.median
  if (typeof m === 'number') MARKET[k] = m
}

const inputs = []
for (const [key, v] of Object.entries(snapshot.volumes ?? {})) {
  const band = Number(key)
  const rung = SERIES_SPINE.find((r) => r.vLevels.includes(band))
  const printed = []
  for (const u of v.units ?? []) for (const t of u.types ?? []) printed.push(t)
  inputs.push({
    band,
    schoolBand: v.schoolBand ?? rung?.schoolBand ?? '?',
    marketBucket: V_TO_MARKET_BUCKET[band] ?? null,
    declaredTypes: rung?.types ?? [],
    printedTypes: printed,
  })
}
inputs.sort((a, b) => a.band - b.band)

const report = measureSpread(inputs, MARKET)

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ generatedAt: snapshot.generatedAt, market: MARKET, ...report }, null, 2))
  process.exit(0)
}

const STATE = { ahead: '✅ 우위', behind: '❌ 미달', unmeasured: '△ 못 잼' }
console.log(`조판 스냅샷 ${snapshot.generatedAt} · 단원/권 ${snapshot.unitsPerVolume}`)
console.log(`시중 권당 유형 수 중앙값 — ${Object.entries(MARKET).map(([k, v]) => `${k} ${v}`).join(' · ')} (market-spec.json)`)
console.log('')
console.log('밴드  학교급        선언  지면  시중  지수    판정')
for (const r of report.volumes) {
  const idx = r.index == null ? '  —  ' : r.index.toFixed(3)
  console.log(
    `V${String(r.band).padEnd(4)}${String(r.schoolBand).padEnd(14)}` +
      `${String(r.declared).padStart(3)}   ${String(r.printed).padStart(3)}   ` +
      `${String(r.market ?? '—').padStart(3)}  ${idx}  ${STATE[r.state]}`,
  )
}
console.log('')
console.log(`우위 ${report.ahead} · 미달 ${report.behind} · 못 잼 ${report.unmeasured}` +
  ` · 평균 지수 ${report.meanIndex == null ? '못 쟀다' : report.meanIndex.toFixed(3)}`)
console.log('')
console.log('— 선언했는데 그 권 지면에 하나도 없는 유형 —')
for (const r of report.volumes) {
  if (r.absent.length === 0) continue
  console.log(`  V${r.band} (${r.absent.length}종): ${r.absent.join(' ')}`)
}
if (report.absentEverywhere.length > 0) {
  console.log('')
  console.log(`⚠️ 어느 권에도 안 실린 유형 ${report.absentEverywhere.length}종: ${report.absentEverywhere.join(' ')}`)
}
const unexpected = report.volumes.filter((r) => r.unexpected.length > 0)
if (unexpected.length > 0) {
  console.log('')
  console.log('⚠️ 사다리가 선언하지 않았는데 실린 유형 — 사다리와 조합기가 어긋난 자국')
  for (const r of unexpected) console.log(`  V${r.band}: ${r.unexpected.join(' ')}`)
}
