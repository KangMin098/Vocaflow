// scripts/textbook/run-atomic.mjs
// Operator path from a completed, family-reviewed order-production run to an atomic volume (synthetic trust root).
//   produce --input RUN_INPUT.json --run-dir DIR [--delivery MODE]
//       writes DIR/atomic/{volume.html, volume.json, status.json}; refuses an existing DIR/atomic
//   revise --prior-input FILE --prior-run-dir DIR0 --input FILE --run-dir DIR
//       rebuilds only the changed days of DIR against DIR0, journals each rebuilt day under DIR/atomic/journal,
//       writes DIR/atomic/{volume.html, volume.json, impact.json, status.json}
//   status --run-dir DIR
//       re-checks volume.json/volume.html and every journal, rewrites DIR/atomic/status.json and prints it
// The admin order-runs view reads status.json and marks it stale when the files it fingerprints changed.
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { hash } from './frym-benchmark/benchmark.mjs'
import { assertExternalCandidate } from './frym-benchmark/local-candidate-path.mjs'
import { produceRunAtomicVolume, syntheticTrustRoot } from './run-atomic-bridge.mjs'
import { reviseRunAtomicVolumeJournaled, runRevisionJournalStatus } from './run-revision.mjs'
import { resealReviewedRun } from './run-reseal.mjs'

const usage = 'Usage: pnpm exec tsx scripts/textbook/run-atomic.mjs produce --input FILE --run-dir DIR [--delivery MODE] | ' +
  'revise --prior-input FILE --prior-run-dir DIR --input FILE --run-dir DIR | status --run-dir DIR'
const sha = value => createHash('sha256').update(value).digest('hex')
const readJson = file => JSON.parse(fs.readFileSync(file, 'utf8'))
const journalFiles = dir => fs.readdirSync(dir).filter(file => /^revision-\d{6}\.json$/.test(file)).sort()

/** Re-checks the written volume and journals; never trusts an earlier status.json. */
export function atomicRunStatus(runDir) {
  const atomic = path.join(runDir, 'atomic')
  if (!fs.existsSync(path.join(atomic, 'volume.json'))) return { schema: 'textbook-run-atomic-status/1', state: 'not_produced' }
  const volume = readJson(path.join(atomic, 'volume.json'))
  const { manifest_hash: recorded, ...base } = volume.manifest ?? {}
  const html = fs.existsSync(path.join(atomic, 'volume.html')) ? fs.readFileSync(path.join(atomic, 'volume.html'), 'utf8') : null
  const volumeIntact = recorded === hash(base) && html !== null && sha(html) === volume.manifest.html_sha256 &&
    volume.run_complete_hash === sha(fs.readFileSync(path.join(runDir, 'complete.json')))
  const journalRoot = path.join(atomic, 'journal')
  const journals = fs.existsSync(journalRoot) ? runRevisionJournalStatus(journalRoot).journals.map(row => {
    const files = row.state === 'unreadable' ? [] : journalFiles(path.join(journalRoot, row.journal))
    const latest = files.at(-1)
    return { ...row, latest_file: latest ?? null,
      latest_sha256: latest ? sha(fs.readFileSync(path.join(journalRoot, row.journal, latest))) : null }
  }) : []
  const journalsDone = journals.every(row => row.state === 'complete' && !row.pending_files)
  const state = !volumeIntact ? 'broken' : !journalsDone ? 'revision_incomplete' : 'volume_ready'
  return { schema: 'textbook-run-atomic-status/1', state, volume_intact: volumeIntact,
    volume_manifest_hash: recorded ?? null, html_sha256: volume.manifest?.html_sha256 ?? null,
    days: volume.manifest?.sections?.map(section => ({ day: section.day, snapshot_id: section.snapshot_id,
      grades: section.units.map(unit => unit.grade) })) ?? [],
    delivery_modes: volume.delivery_modes ?? [], revision: volume.revision ?? 1,
    production_verified: false, journals }
}

function writeVolume(runDir, produced, extra) {
  const atomic = path.join(runDir, 'atomic')
  fs.writeFileSync(path.join(atomic, 'volume.html'), produced.volume.html, { flag: 'wx' })
  fs.writeFileSync(path.join(atomic, 'volume.json'), JSON.stringify({ schema: 'textbook-run-atomic-volume/1',
    synthetic_trust_root: true, production_verified: false,
    run_complete_hash: sha(fs.readFileSync(path.join(runDir, 'complete.json'))),
    delivery_modes: [...new Set(produced.days.map(day => day.delivery_mode))],
    manifest: produced.volume.manifest, ...extra }, null, 2) + '\n', { flag: 'wx' })
}

function writeStatus(runDir) {
  const status = atomicRunStatus(runDir)
  fs.writeFileSync(path.join(runDir, 'atomic', 'status.json'), JSON.stringify(status, null, 2) + '\n')
  return status
}

async function main() {
  const [command, ...rest] = process.argv.slice(2)
  const opt = name => { const i = rest.indexOf(name); return i >= 0 ? rest[i + 1] : undefined }
  const dir = name => { const value = opt(name) && path.resolve(opt(name)); if (!value) throw Error(usage); assertExternalCandidate(value); return value }
  if (!['produce', 'revise', 'status'].includes(command)) throw Error(usage)
  const runDir = dir('--run-dir')
  if (command === 'status') {
    if (!fs.existsSync(path.join(runDir, 'atomic'))) { console.log(JSON.stringify(atomicRunStatus(runDir))); return }
    console.log(JSON.stringify(writeStatus(runDir), null, 2)); return
  }
  const input = readJson(path.resolve(opt('--input') ?? (() => { throw Error(usage) })()))
  if (fs.existsSync(path.join(runDir, 'atomic'))) throw Error('RUN_ATOMIC_ALREADY_PRODUCED')
  // One synthetic trust root per process; every run used here is re-sealed under it.
  const trust = syntheticTrustRoot()
  const seal = (sealInput, sealDir) => resealReviewedRun({ input: sealInput, runDir: sealDir,
    trustHash: trust.policy_hash, trustVersion: 'synthetic-trust' }).run
  if (command === 'produce') {
    const produced = await produceRunAtomicVolume({ run: seal(input, runDir), trust, deliveryMode: opt('--delivery') ?? 'auto' })
    fs.mkdirSync(path.join(runDir, 'atomic'))
    writeVolume(runDir, produced, { revision: 1 })
    console.log(JSON.stringify(writeStatus(runDir), null, 2)); return
  }
  const priorDir = dir('--prior-run-dir')
  const priorInput = readJson(path.resolve(opt('--prior-input') ?? (() => { throw Error(usage) })()))
  const priorRun = seal(priorInput, priorDir), nextRun = seal(input, runDir)
  const prior = await produceRunAtomicVolume({ run: priorRun, trust })
  fs.mkdirSync(path.join(runDir, 'atomic'))
  const revised = await reviseRunAtomicVolumeJournaled({ priorRun, nextRun, prior, trust,
    journalRoot: path.join(runDir, 'atomic', 'journal') })
  fs.writeFileSync(path.join(runDir, 'atomic', 'impact.json'), JSON.stringify({ impact: revised.impact,
    journals: revised.journals.map(({ dir: _dir, ...row }) => row) }, null, 2) + '\n', { flag: 'wx' })
  writeVolume(runDir, revised.produced, { revision: 1 + revised.journals.length, prior_run: path.basename(priorDir) })
  console.log(JSON.stringify(writeStatus(runDir), null, 2))
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(new URL(import.meta.url).pathname.replace(/^\/([A-Za-z]:)/u, '$1')))
  await main()
