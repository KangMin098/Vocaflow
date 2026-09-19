// apps/web/scripts/csat-lecture/merge-regrade.mts
//
// **재채점 병합** — 재작업한 문항만 새로 채점한 `chunk-X.regrade.json` 을 `chunk-X.grade.json` 에 합친다.
// 재채점 심사관은 기존 grade.json 을 보지 않는다(이전 판정에 끌리지 않게) — 그래서 파일이 따로다.
// 목록에 없는 문항의 채점은 그대로 둔다. 병합한 regrade 파일은 `.merged.json` 으로 옮겨 두 번 합치지 않는다.
//
//   npx tsx scripts/csat-lecture/merge-regrade.mts --chunk X
//
// 재실행 안전: regrade 파일이 없으면 아무것도 하지 않는다.

import fs from 'node:fs'
import path from 'node:path'

import { arg, readJson, WORK, writeJson } from './env.mts'

type Grades = { grader?: string; gradedAt?: string; grades: Record<string, unknown> }

const chunk = arg('chunk')
if (!chunk) throw new Error('--chunk 가 필요하다')
const regradePath = path.join(WORK, `chunk-${chunk}.regrade.json`)
const gradePath = path.join(WORK, `chunk-${chunk}.grade.json`)
if (!fs.existsSync(regradePath)) {
  console.log(`${chunk}: regrade 없음 — 건너뜀`)
  process.exit(0)
}
const regrade = readJson<Grades>(regradePath, { grades: {} })
const grade = readJson<Grades>(gradePath, { grades: {} })
const ids = Object.keys(regrade.grades)
if (!ids.length) throw new Error(`${chunk}: regrade 가 비었다 — 병합하지 않는다`)
for (const id of ids) grade.grades[id] = regrade.grades[id]
grade.gradedAt = regrade.gradedAt ?? new Date().toISOString()
writeJson(gradePath, grade)
fs.renameSync(regradePath, path.join(WORK, `chunk-${chunk}.regrade.merged.json`))
console.log(`${chunk}: 재채점 ${ids.length}문항 병합 (${ids.join(' ')})`)
