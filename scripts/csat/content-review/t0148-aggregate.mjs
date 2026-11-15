#!/usr/bin/env node
// scripts/csat/content-review/t0148-aggregate.mjs
//
// T-0148 사람 채점 집계 CLI. 키는 연구 경로에서만 읽는다(apps/web 로 복사하지 않는다).
//   node scripts/csat/content-review/t0148-aggregate.mjs --key <grader_regression_key.json> [--rekey <json>] <human_scores_*.csv>...
// 종료 코드: 0 = RESUME_ALLOWED · 1 = NOT_MET · 2 = INCOMPLETE/사용법 오류. 파일을 쓰지 않는다(stdout JSON 만).

import { readFileSync } from 'node:fs'

import { aggregate, readSheet } from './t0148-aggregate-lib.mjs'

const args = process.argv.slice(2)
let keyPath = null
let rekeyPath = null
const csvs = []
for (let i = 0; i < args.length; i++) {
  if (args[i] === '--key') keyPath = args[++i]
  else if (args[i] === '--rekey') rekeyPath = args[++i]
  else csvs.push(args[i])
}
if (!keyPath || !csvs.length) {
  console.error('사용법: t0148-aggregate.mjs --key <key.json> [--rekey <json>] <csv>...')
  process.exit(2)
}

const key = JSON.parse(readFileSync(keyPath, 'utf8'))
const rekey = rekeyPath ? JSON.parse(readFileSync(rekeyPath, 'utf8')) : {}
const sheets = csvs.map((p) => readSheet(readFileSync(p, 'utf8'), p))
const result = aggregate(sheets, key, rekey)
console.log(JSON.stringify(result, null, 2))
process.exit(result.verdict === 'RESUME_ALLOWED' ? 0 : result.verdict === 'NOT_MET' ? 1 : 2)
