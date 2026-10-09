// scripts/textbook/production-revision-run.mjs
import fs from 'node:fs'
import { assertExternalCandidate } from './frym-benchmark/local-candidate-path.mjs'
import { startRevisionJournal, advanceRevisionJournal, readRevisionJournal,
  recoverRevisionJournal } from './production-revision-journal.mjs'

const usage = 'Usage: pnpm exec tsx scripts/textbook/production-revision-run.mjs <start|advance|status|recover> --run-dir DIR [--prior PATH --next PATH --cause changed|rights_revoked] [--event PATH]'
if (process.argv.includes('--help')) { console.log(usage); process.exit(0) }
const [action, ...args] = process.argv.slice(2)
if (!['start', 'advance', 'status', 'recover'].includes(action) || args.length % 2) throw Error(usage)
const options = new Map()
for (let index = 0; index < args.length; index += 2) {
  if (!['--run-dir', '--prior', '--next', '--cause', '--event'].includes(args[index]) ||
      options.has(args[index]) || !args[index + 1] || args[index + 1].startsWith('--')) throw Error(usage)
  options.set(args[index], args[index + 1])
}
const allowed = action === 'start' ? ['--run-dir', '--prior', '--next', '--cause']
  : action === 'advance' ? ['--run-dir', '--event'] : ['--run-dir']
if (!options.get('--run-dir') || [...options.keys()].some(key => !allowed.includes(key)) ||
    action === 'start' && (!options.get('--prior') || !options.get('--next')) ||
    action === 'advance' && !options.get('--event')) throw Error(usage)
const read = key => {
  const file = options.get(key)
  assertExternalCandidate(file)
  return JSON.parse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, ''))
}
const result = action === 'start'
  ? startRevisionJournal(options.get('--run-dir'), read('--prior'), read('--next'), options.get('--cause') ?? 'changed')
  : action === 'advance' ? advanceRevisionJournal(options.get('--run-dir'), read('--event'))
  : action === 'recover' ? recoverRevisionJournal(options.get('--run-dir')) : readRevisionJournal(options.get('--run-dir'))
console.log(JSON.stringify({ synthetic_fixture: true, non_production: true,
  run_id: result.record?.run_id ?? null, sequence: result.record?.sequence ?? null,
  state: result.record?.workflow.state ?? 'not_started', workflow_hash: result.record?.workflow.workflow_hash ?? null,
  journal_hash: result.record?.journal_hash ?? null, pending_files: result.pending_files,
  recovery: result.recovery ?? null,
  affected: result.record?.workflow.affected ?? [], publish_eligible: false }, null, 2))
