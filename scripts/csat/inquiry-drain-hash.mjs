// scripts/csat/inquiry-drain-hash.mjs
//
// **검수자가 판정에 붙일 내용 해시를 출력한다.** (v3 M2 공개 가드)
// 검수자는 판정마다 `content_hash`(이 출력) · `criteria`(CRITERIA_VERSION) · `reviewer`(자기 run 라벨)를 쓴다 —
// 빌드는 지금 출력의 해시와 같은 판정만 verified 로 본다(lib-inquiry-review.mjs). 읽기만 한다 · 재실행 안전.
//
//   node scripts/csat/inquiry-drain-hash.mjs --chunk inq-01      → {"criteria":"…","items":{"2014A#21":"ab12…", …}}

import fs from 'node:fs'
import path from 'node:path'

import { CRITERIA_VERSION, contentHash } from './lib-inquiry-review.mjs'

const i = process.argv.indexOf('--chunk')
if (i < 0) {
  console.error('사용: node scripts/csat/inquiry-drain-hash.mjs --chunk inq-NN')
  process.exit(2)
}
const name = process.argv[i + 1]
const out = JSON.parse(fs.readFileSync(path.resolve(`scripts/csat/inquiry-drain/chunk-${name}.out.json`), 'utf8'))
const items = Object.fromEntries((out.items ?? []).map((r) => [r.id, { hash: contentHash(r), writer_run: r.writer_run ?? out.writer_run ?? null }]))
console.log(JSON.stringify({ chunk: name, criteria: CRITERIA_VERSION, items }, null, 1))
