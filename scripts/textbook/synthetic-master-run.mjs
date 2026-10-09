// scripts/textbook/synthetic-master-run.mjs
import fs from 'node:fs'
import path from 'node:path'
import { assertExternalCandidate } from './frym-benchmark/local-candidate-path.mjs'
import { writeAtomicDryRunOutput } from './atomic-production-output.mjs'
import { runSyntheticMasterProduction, SYNTHETIC_MASTER_ORDERS } from './synthetic-master-production.mjs'

const usage = 'Usage: pnpm exec tsx scripts/textbook/synthetic-master-run.mjs --order <m1|h1|m1-m2|all> --out-dir DIR'
if (process.argv.includes('--help')) { console.log(usage); process.exit(0) }
const args = process.argv.slice(2)
if (args.length !== 4 || args[0] !== '--order' || args[2] !== '--out-dir' ||
    ![...SYNTHETIC_MASTER_ORDERS, 'all'].includes(args[1]) || !args[3]) throw Error(usage)
const root = path.resolve(args[3])
assertExternalCandidate(root)
if (fs.existsSync(root)) throw Error('SYNTHETIC_MASTER_OUTPUT_DIRECTORY_EXISTS')
fs.mkdirSync(root)
const receipts = []
for (const order of args[1] === 'all' ? SYNTHETIC_MASTER_ORDERS : [args[1]]) {
  const result = await runSyntheticMasterProduction(order)
  const write = writeAtomicDryRunOutput(path.join(root, `${order}.html`), result.html, result.manifest)
  if (!write.ok) throw Error(`SYNTHETIC_MASTER_OUTPUT_FAILED:${order};LEFTOVERS:${write.leftovers.join(',')}`)
  receipts.push({ order, grades: result.manifest.receipt.grade_scope.grades,
    output_hash: result.manifest.html_sha256, manifest_hash: result.manifest.manifest_hash })
}
const summary = { schema: 'textbook-synthetic-master-run/1', synthetic_fixture: true,
  non_production: true, production_verified: false, status: 'complete', orders: receipts }
fs.writeFileSync(path.join(root, 'run.json'), JSON.stringify(summary, null, 2) + '\n', { flag: 'wx' })
console.log(JSON.stringify(summary, null, 2))
