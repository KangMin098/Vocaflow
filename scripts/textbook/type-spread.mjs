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
// ⚠️⚠️ **선언과 지면은 서로 다른 시점에서 온다.** 선언은 지금 코드(`SERIES_SPINE`)에서,
//   지면은 스냅샷에서 읽는다. 스냅샷이 사다리보다 낡으면 그 차이는 **결함이 아니라 시차**다.
//   2026-09-13 에 실제로 그렇게 틀렸다(「19종 선언 · 4종 실림」 — 스냅샷 시점의 선언은 4종이었다).
//   그래서 사다리가 마지막으로 바뀐 시각을 git 에서 읽어 함께 낸다.
//
// ⚠️ **스냅샷이 낡으면 이 수치도 낡는다.** `generatedAt` 을 함께 찍는다 —
//   낡은 것이 보여야 `contents-snapshot.mjs` 를 다시 돌린다.
//
// **읽기만 한다.** 몇 번을 돌려도 결과가 같다(재실행 안전).
//
// 실행: npx tsx --tsconfig apps/web/tsconfig.json scripts/textbook/type-spread.mjs [--json]

import { execFileSync } from 'node:child_process'
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

/**
 * 사다리가 마지막으로 바뀐 시각 — git 에서 읽는다.
 *
 * 왜 파일에 상수로 안 적는가: 사람이 손으로 적는 날짜는 고칠 때 같이 안 고쳐진다.
 * git 은 고칠 때마다 자동으로 맞다. 못 읽으면 `null` — **0 이나 「지금」으로 때우지 않는다**
 * (때우면 시차가 없다고 말하게 되고, 그것이 바로 한 번 틀린 자리다).
 */
function spineChangedAt() {
  try {
    return execFileSync(
      'git',
      ['log', '-1', '--format=%cI', '--', 'packages/library-pipeline/src/textbook/series.ts'],
      { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    ).trim() || null
  } catch {
    return null
  }
}

const report = measureSpread(inputs, MARKET, {
  printedAt: snapshot.generatedAt ?? null,
  declaredAt: spineChangedAt(),
})

if (process.argv.includes('--json')) {
  console.log(JSON.stringify({ generatedAt: snapshot.generatedAt, market: MARKET, ...report }, null, 2))
  process.exit(0)
}

const STATE = { ahead: '✅ 우위', behind: '❌ 미달', unmeasured: '△ 못 잼' }
console.log(`조판 스냅샷 ${snapshot.generatedAt} · 단원/권 ${snapshot.unitsPerVolume}`)
if (report.skew == null) {
  console.log('△ 사다리가 언제 바뀌었는지 못 읽었다 — 선언·지면 차이를 시차와 못 가른다')
} else if (report.skew.stale) {
  console.log(`⚠️ 사다리 변경 ${report.skew.declaredAt} — **스냅샷이 그보다 낡았다.**`)
  console.log('   아래 「선언했는데 없는 유형」은 조합기의 결함이 아니라 시차일 수 있다.')
  console.log('   가르려면 스냅샷을 다시 굽는다: contents-snapshot.mjs --bands 1,2,3,4,5,6,7')
} else {
  console.log(`사다리 변경 ${report.skew.declaredAt} — 스냅샷이 그보다 새롭다(시차 없음)`)
}
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
console.log(
  report.skew?.stale
    ? '— 선언했는데 그 권 지면에 없는 유형 (⚠️ 스냅샷이 낡아 시차일 수 있다) —'
    : '— 선언했는데 그 권 지면에 하나도 없는 유형 —',
)
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
