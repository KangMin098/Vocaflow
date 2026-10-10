// scripts/textbook/frym-benchmark/seed-audit-run.mjs
import { verifySeedAudit } from './seed-audit.mjs'

const path = process.argv[2]
if (!path || process.argv.length !== 3) {
  process.stderr.write('Usage: seed-audit-run.mjs <external-audit.jsonl>\n')
  process.exitCode = 1
} else {
  try {
    const result = verifySeedAudit(path)
    process.stdout.write(`${JSON.stringify(result)}\n`)
    if (!result.valid || result.status !== 'complete') process.exitCode = 1
  } catch (error) {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  }
}
