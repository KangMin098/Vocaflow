// scripts/dict-status.mjs
//
// shared_dictionary 의 한국어 뜻 채움 진행률 보고.
//
// CEFR 별 total / done / pct + 전체 + NULL CEFR 도 표시.
//
// CLI:
//   node scripts/dict-status.mjs
//   node scripts/dict-status.mjs --json    (기계 가독 형식)

import { argv, exit } from 'node:process'

import { makeClient } from './dict-common.mjs'

const asJson = argv.includes('--json')
const supabase = makeClient()

const CEFR_ORDER = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2', null]

async function counts(cefr) {
  const baseEq = (q) => (cefr === null ? q.is('cefr_level', null) : q.eq('cefr_level', cefr))

  const totalQ = baseEq(
    supabase.from('shared_dictionary').select('word', { count: 'exact', head: true }),
  )
  const doneQ = baseEq(
    supabase
      .from('shared_dictionary')
      .select('word', { count: 'exact', head: true })
      .not('meaning_ko', 'is', null),
  )

  const [tot, done] = await Promise.all([totalQ, doneQ])
  if (tot.error) throw tot.error
  if (done.error) throw done.error
  return { total: tot.count ?? 0, done: done.count ?? 0 }
}

const rows = []
let grandTotal = 0
let grandDone = 0

for (const c of CEFR_ORDER) {
  const { total, done } = await counts(c)
  if (total === 0) continue
  rows.push({ cefr: c ?? 'NONE', total, done, pct: (done / total) * 100 })
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

console.log('shared_dictionary 한국어 뜻 진행률')
console.log('━'.repeat(60))
console.log('CEFR  │   total │    done │    pct │ remaining')
console.log('──────┼─────────┼─────────┼────────┼───────────')
for (const r of rows) {
  const remaining = r.total - r.done
  console.log(
    `${r.cefr.padEnd(5)} │ ${String(r.total).padStart(7)} │ ${String(r.done).padStart(7)} │ ${r.pct.toFixed(1).padStart(5)}% │ ${String(remaining).padStart(9)}`,
  )
}
console.log('──────┼─────────┼─────────┼────────┼───────────')
const grandPct = grandTotal > 0 ? (grandDone / grandTotal) * 100 : 0
const grandRemaining = grandTotal - grandDone
console.log(
  `TOTAL │ ${String(grandTotal).padStart(7)} │ ${String(grandDone).padStart(7)} │ ${grandPct.toFixed(1).padStart(5)}% │ ${String(grandRemaining).padStart(9)}`,
)
