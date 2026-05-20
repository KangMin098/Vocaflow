// scripts/dict-categories-status.mjs
//
// dictionary_categories.name_ko 채움 진행률 보고 (level=1/2/3 별).
//
// CLI:
//   node scripts/dict-categories-status.mjs
//   node scripts/dict-categories-status.mjs --json

import { argv, exit } from 'node:process'

import { makeClient } from './dict-common.mjs'

const asJson = argv.includes('--json')
const supabase = makeClient()

const LEVELS = [1, 2, 3]

async function counts(level) {
  const totalQ = supabase
    .from('dictionary_categories')
    .select('id', { count: 'exact', head: true })
    .eq('level', level)
  const doneQ = supabase
    .from('dictionary_categories')
    .select('id', { count: 'exact', head: true })
    .eq('level', level)
    .not('name_ko', 'is', null)

  const [tot, done] = await Promise.all([totalQ, doneQ])
  if (tot.error) throw tot.error
  if (done.error) throw done.error
  return { total: tot.count ?? 0, done: done.count ?? 0 }
}

const rows = []
let grandTotal = 0
let grandDone = 0

for (const lv of LEVELS) {
  const { total, done } = await counts(lv)
  if (total === 0) continue
  rows.push({ level: `H${lv}`, total, done, pct: (done / total) * 100 })
  grandTotal += total
  grandDone += done
}

if (asJson) {
  console.log(
    JSON.stringify(
      {
        rows,
        total: grandTotal,
        done: grandDone,
        pct: grandTotal > 0 ? (grandDone / grandTotal) * 100 : 0,
      },
      null,
      2,
    ),
  )
  exit(0)
}

console.log('dictionary_categories.name_ko 진행률')
console.log('━'.repeat(60))
console.log('LEVEL │   total │    done │    pct │ remaining')
console.log('──────┼─────────┼─────────┼────────┼───────────')
for (const r of rows) {
  const remaining = r.total - r.done
  console.log(
    `${r.level.padEnd(5)} │ ${String(r.total).padStart(7)} │ ${String(r.done).padStart(7)} │ ${r.pct.toFixed(1).padStart(5)}% │ ${String(remaining).padStart(9)}`,
  )
}
console.log('──────┼─────────┼─────────┼────────┼───────────')
const grandPct = grandTotal > 0 ? (grandDone / grandTotal) * 100 : 0
const grandRemaining = grandTotal - grandDone
console.log(
  `TOTAL │ ${String(grandTotal).padStart(7)} │ ${String(grandDone).padStart(7)} │ ${grandPct.toFixed(1).padStart(5)}% │ ${String(grandRemaining).padStart(9)}`,
)
