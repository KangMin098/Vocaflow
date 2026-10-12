// scripts/csat/meaning-support-hash.mjs
//
// 검수자용 — 작성 결과의 현재 content hash · binding · writer_run 을 출력한다(검수 판정은 이 값에 결속).
//   node scripts/csat/meaning-support-hash.mjs --item 2026#34
//   node scripts/csat/meaning-support-hash.mjs --manifest scripts/csat/meaning-support-drain/pilot-manifest.json
import { readFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

import { supportContentHash } from './lib-meaning-support.mjs'

const ROOT = process.cwd()
const DIR = join(ROOT, 'scripts/csat/meaning-support-drain')
const readJson = (p) => JSON.parse(readFileSync(p, 'utf8'))
const i = process.argv.indexOf('--item')
const m = process.argv.indexOf('--manifest')
const ids = i > 0 ? [process.argv[i + 1]] : readJson(join(ROOT, m > 0 ? process.argv[m + 1] : 'scripts/csat/meaning-support-drain/pilot-manifest.json')).items.map((x) => x.itemId)
for (const id of ids) {
  const p = join(DIR, `support-${id.replace('#', '-')}.out.json`)
  if (!existsSync(p)) { console.log(JSON.stringify({ itemId: id, missing: true })); continue }
  const o = readJson(p)
  console.log(JSON.stringify({ itemId: id, status: o.status, writer_run: o.writer_run, content_hash: o.support ? supportContentHash(o.support) : null, binding: o.support?.binding ?? null, schema: o.support?.schema ?? null }))
}
