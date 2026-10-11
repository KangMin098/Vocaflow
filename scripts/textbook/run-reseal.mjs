// scripts/textbook/run-reseal.mjs
// A completed, family-reviewed run re-sealed under another trust policy hash (synthetic trust roots hold
// private keys that never leave the process that made them). Passages and items stay exactly as reviewed:
// a cell may move only when its plan is unchanged, and the existing family review must still pass.
import fs from 'node:fs'
import path from 'node:path'
import { exportOrderProductionDrain, importOrderProductionDrain } from '../../packages/library-pipeline/src/textbook/order-production-run.ts'
import { importFamilyReview } from '../../packages/library-pipeline/src/textbook/family-semantic-review.ts'

const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'))

export function resealReviewedRun({ input, runDir, trustHash, trustVersion }) {
  if (!fs.existsSync(path.join(runDir, 'complete.json'))) throw Error('RUN_NOT_COMPLETE')
  const filled = readJson(path.join(runDir, 'drain.out.json'))
  const reviewOut = readJson(path.join(runDir, 'review.out.json'))
  const reviewedDrain = readJson(path.join(runDir, 'drain.json'))
  const sealed = structuredClone(input)
  for (const draft of sealed.drafts) draft.policies.trust = { version: trustVersion, hash: trustHash }
  const drain = exportOrderProductionDrain(sealed)
  const byCell = new Map(filled.cells.map(cell => [cell.cell_id, cell]))
  const planOf = cell => { const { order_hash: _o, cell_hash: _c, ...plan } = cell; return JSON.stringify(plan) }
  const remapped = { cells: drain.cells.map(cell => {
    const old = byCell.get(cell.cell_id)
    const reviewedCell = reviewedDrain.cells.find(row => row.cell_id === cell.cell_id)
    if (!old || !reviewedCell) throw Error(`RUN_CELL_MISSING:${cell.cell_id}`)
    if (planOf(reviewedCell) !== planOf(cell)) throw Error(`RUN_CELL_PLAN_CHANGED:${cell.cell_id}`)
    return { ...old, cell_hash: cell.cell_hash }
  }) }
  const run = importOrderProductionDrain(sealed, remapped)
  if (run.status !== 'assembled') throw Error(`RUN_NOT_ASSEMBLED:${JSON.stringify(run.blockers)}`)
  const reviewed = importFamilyReview(run, reviewOut)
  if (reviewed.status !== 'passed') throw Error(`RUN_REVIEW_NOT_PASSED:${JSON.stringify(reviewed.blockers)}`)
  return { run, reviewOut }
}
