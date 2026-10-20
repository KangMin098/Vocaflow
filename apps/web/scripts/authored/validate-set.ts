// apps/web/scripts/authored/validate-set.ts
// 창작 세트 JSON 검증(작성자용) — validateAuthoredSet 그대로. 위반이 있으면 exit 1.
//   pnpm --filter web exec tsx scripts/authored/validate-set.ts <세트.json>
import fs from 'node:fs'

import { validateAuthoredSet, type AuthoredSet } from '../../src/lib/knowledge/authored/authored-items'

const file = process.argv[2]
if (!file) { console.error('세트 파일 경로가 필요하다'); process.exit(2) }
const set = JSON.parse(fs.readFileSync(file, 'utf8')) as AuthoredSet
const errs = validateAuthoredSet(set)
const answers = set.items.map((i) => (i.gold as { answer?: number }).answer).filter((x) => x !== undefined)
console.log(`${set.set} · ${set.items.length}문항 · 위반 ${errs.length} · 정답 분포 ${JSON.stringify(answers)}`)
for (const e of errs) console.log(`  ✗ ${e}`)
process.exit(errs.length ? 1 : 0)
