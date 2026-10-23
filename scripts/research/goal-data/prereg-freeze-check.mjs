// scripts/research/goal-data/prereg-freeze-check.mjs
//
// v2.5 사전 등록 동결 검사 — V2_5_PREREGISTRATION.md §1 표의 파일 sha256 을 작업 트리 바이트와 대조한다.
//   node scripts/research/goal-data/prereg-freeze-check.mjs   (불일치가 하나라도 있으면 exit 1)
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const DOC = path.join(ROOT, 'docs/research/goal-data-batches/D2-task-mapping/V2_5_PREREGISTRATION.md')
const rows = [...fs.readFileSync(DOC, 'utf8').matchAll(/^\| `([^`]+)` \| `([0-9a-f]{64})` \|$/gm)].map((m) => ({ file: m[1], expected: m[2] }))
if (!rows.length) { console.error('동결 표를 찾지 못했다'); process.exit(1) }
let bad = 0
for (const r of rows) {
  const p = path.join(ROOT, r.file)
  const got = fs.existsSync(p) ? crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex') : 'missing'
  const ok = got === r.expected
  if (!ok) bad++
  console.log(`${ok ? 'ok  ' : 'DIFF'} ${r.file}${ok ? '' : ` — 기대 ${r.expected.slice(0, 12)} · 실제 ${got.slice(0, 12)}`}`)
}
console.log(`${new Date().toISOString()} · 동결 ${rows.length} · 불일치 ${bad}`)
process.exit(bad ? 1 : 0)
