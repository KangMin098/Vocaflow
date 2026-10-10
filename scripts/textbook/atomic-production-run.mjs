// scripts/textbook/atomic-production-run.mjs
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { assertExternalCandidate } from './frym-benchmark/local-candidate-path.mjs'
import { loadEnv } from './volume-pool.mjs'
import { publishAtomicProductionArtifact, runAtomicMultiGradeFactoryDryRun } from './atomic-production-snapshot.mjs'
import { assertAtomicOutputAbsent, writeAtomicDryRunOutput } from './atomic-production-output.mjs'
import { inspectProductionRevisionImpact, validateProductionRevisionManifest } from './production-revision-impact.mjs'
import { beginSyntheticRevisionWorkflow } from './production-revision-workflow.mjs'
import { startRevisionJournal } from './production-revision-journal.mjs'

const usage = 'Usage: pnpm exec tsx scripts/textbook/atomic-production-run.mjs <dry-run|publish> --group-id ID --stages PATH --render PATH [--out PATH (dry-run only)] [--previous-manifest PATH] [--revision-run-dir DIR (dry-run with previous manifest)]'
if (process.argv.includes('--help')) {
  console.log(usage)
  process.exit(0)
}
const [action, ...args] = process.argv.slice(2)
if (!['dry-run', 'publish'].includes(action) || args.length % 2 !== 0) throw Error(usage)
const options = new Map()
for (let index = 0; index < args.length; index += 2) {
  const key = args[index]
  if (!['--group-id', '--stages', '--render', '--out', '--previous-manifest', '--revision-run-dir'].includes(key) || options.has(key) ||
      !args[index + 1] || args[index + 1].startsWith('--')) throw Error(usage)
  options.set(key, args[index + 1])
}
if (!options.get('--group-id') || !options.get('--stages') || !options.get('--render') ||
    (action === 'dry-run' && !options.get('--out')) ||
    (action === 'publish' && (options.has('--out') || options.has('--revision-run-dir'))) ||
    (options.has('--revision-run-dir') && !options.has('--previous-manifest'))) throw Error(usage)
for (const key of ['--stages', '--render', ...(action === 'dry-run' ? ['--out'] : []),
  ...(options.has('--previous-manifest') ? ['--previous-manifest'] : [])])
  assertExternalCandidate(options.get(key))
if (options.has('--revision-run-dir')) assertExternalCandidate(options.get('--revision-run-dir'))
const output = action === 'dry-run' ? path.resolve(options.get('--out')) : null
if (output) assertAtomicOutputAbsent(output)
const stages = JSON.parse(fs.readFileSync(options.get('--stages'), 'utf8'))
const render = JSON.parse(fs.readFileSync(options.get('--render'), 'utf8'))
const previousManifest = options.has('--previous-manifest')
  ? JSON.parse(fs.readFileSync(options.get('--previous-manifest'), 'utf8')) : null
if (options.has('--previous-manifest')) {
  validateProductionRevisionManifest(previousManifest)
  if (previousManifest.group_id !== options.get('--group-id')) throw Error('REVISION_IMPACT_GROUP_MIXED')
}
loadEnv()
if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY)
  throw Error('SUPABASE_SERVICE_CREDENTIALS_MISSING')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } })
const result = await runAtomicMultiGradeFactoryDryRun(db, {
  groupId: options.get('--group-id'), stages, render,
})
const revisionImpact = options.has('--previous-manifest')
  ? inspectProductionRevisionImpact(previousManifest, result.manifest) : null
const revisionWorkflowPreview = action === 'dry-run' && revisionImpact?.affected.length
  ? beginSyntheticRevisionWorkflow(previousManifest, result.manifest) : null
if (action === 'publish') {
  const published = await publishAtomicProductionArtifact(db, result)
  console.log(JSON.stringify({ status: published.status, snapshot_id: published.snapshot_id,
    snapshot_hash: published.snapshot_hash, output_hash: published.output_hash,
    revision_impact: revisionImpact }))
} else {
  const write = writeAtomicDryRunOutput(output, result.html, result.manifest)
  if (!write.ok) throw Error(`ATOMIC_DRY_RUN_WRITE_FAILED_NEW_APPROVAL_REQUIRED:${result.manifest.snapshot_id};LEFTOVERS:${write.leftovers.join(',')}`)
  const revisionJournal = options.has('--revision-run-dir') && revisionWorkflowPreview
    ? startRevisionJournal(options.get('--revision-run-dir'), previousManifest, result.manifest) : null
  console.log(JSON.stringify({ status: 'atomic_snapshot_unpublished', snapshot_id: result.manifest.snapshot_id,
    snapshot_hash: result.manifest.snapshot_hash, output_hash: result.manifest.html_sha256,
    revision_impact: revisionImpact, revision_workflow_preview: revisionWorkflowPreview,
    revision_journal: revisionJournal ? { run_id: revisionJournal.record.run_id,
      journal_hash: revisionJournal.record.journal_hash, state: revisionJournal.record.workflow.state } : null }))
}
