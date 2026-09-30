// scripts/methodology/drain.mts
import { readFile, writeFile } from 'node:fs/promises'
import { resolve } from 'node:path'
import { createHash } from 'node:crypto'
import { researchSeed } from '../../apps/web/src/lib/methodology/research-seed.ts'
import { assertBundle, compareMethods, duplicateCandidates, researchCoverage } from '../../apps/web/src/lib/methodology/core.ts'
import { digest, parseCaptions, segmentCaptions } from '../../apps/web/src/lib/methodology/transcript.ts'
import type { Permission } from '../../apps/web/src/lib/methodology/transcript.ts'

const [command, path, ...flags] = process.argv.slice(2)
const json = async (file: string) => JSON.parse(await readFile(resolve(file), 'utf8')) as unknown
const canonical = (value: unknown): string => {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`
  if (value && typeof value === 'object') return `{${Object.entries(value).sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) => `${JSON.stringify(k)}:${canonical(v)}`).join(',')}}`
  return JSON.stringify(value)
}
async function main() {
  if (command === 'captions') {
    if (!path || flags.length !== 1) throw new Error('Usage: captions <permitted.vtt|srt> <permission.json>; output is transient stdout')
    const raw = await readFile(resolve(path), 'utf8')
    const permission = await json(flags[0]) as Permission
    const segments = segmentCaptions(parseCaptions(raw, permission))
    console.log(JSON.stringify({ sourceId: permission.sourceId, sourceUrl: permission.sourceUrl, revision: digest(raw), instruction: 'Meaning/topic boundaries require agent review. Return derived claims and exact ranges only; no transcript copies.', segments }, null, 2))
    return
  }
  if (!['seed', 'validate', 'report', 'prepare', 'import'].includes(command)) throw new Error('Commands: seed <output.json> | validate <bundle.json> | report <bundle.json> | prepare <bundle.json> | import <bundle.json> [--commit --actor=<name> --parent=<snapshot-id>] | captions <file> <permission.json>')
  if (!path || (command !== 'import' && flags.length)) throw new Error('Exactly one path required')
  if (command === 'import' && flags.some(f => f !== '--commit' && !f.startsWith('--actor=') && !f.startsWith('--parent='))) throw new Error('Unknown import flag')
  const bundle = command === 'seed' ? structuredClone(researchSeed) : await json(path)
  assertBundle(bundle)
  if (command === 'seed') {
    await writeFile(resolve(path), `${JSON.stringify(bundle, null, 2)}\n`, { flag: 'wx' })
    console.log('Created derived research bundle. Existing output is never overwritten.'); return
  }
  if (command === 'validate') { console.log(`Valid: ${bundle.methods.length} methods, ${bundle.claims.length} claims, ${bundle.evidence.length} evidence links`); return }
  if (command === 'report') {
    console.log(JSON.stringify({ coverage: researchCoverage(bundle), comparisons: compareMethods(bundle, bundle.methods.map(m => m.id)), duplicateCandidates: duplicateCandidates(bundle.methods) }, null, 2)); return
  }
  if (command === 'import' && flags.includes('--commit')) {
    const actor = flags.find(f => f.startsWith('--actor='))?.slice(8).trim()
    if (!actor || actor.length > 200) throw new Error('--actor=<name> required for audit')
    const parent = flags.find(f => f.startsWith('--parent='))?.slice(9) ?? null
    if (parent && !/^[a-f0-9]{64}$/.test(parent)) throw new Error('--parent must be a snapshot id')
    const { createScriptClient } = await import('../lib/supabase-client.mjs')
    const client = createScriptClient()
    const { data, error } = await client.rpc('methodology_import', { p_bundle: bundle, p_actor: actor, p_parent: parent })
    if (error) throw new Error(`Import failed; do not assume zero writes. Verify batch before retry: ${error.message}`)
    console.log(JSON.stringify(data, null, 2)); return
  }
  // Postgres calculates its own canonical jsonb hash; this fingerprint identifies local input only.
  const inputFingerprint = createHash('sha256').update(canonical(bundle)).digest('hex')
  console.log(JSON.stringify({ status: 'prepared_not_imported', inputFingerprint, schemaVersion: bundle.schemaVersion, rows: Object.fromEntries(Object.entries(bundle).filter(([, v]) => Array.isArray(v)).map(([k, v]) => [k, (v as unknown[]).length])), nextAction: 'Review docs/methodology/schema.sql and approve migration before running import --commit. Replay of identical input is safe.' }, null, 2))
}
main().catch(error => { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1 })
