// scripts/textbook/multi-grade-factory-dry-run.mjs
import fs from 'node:fs'
import path from 'node:path'
import { runMultiGradeFactoryDryRun } from '@vocaflow/library-pipeline'

const args = process.argv.slice(2)
if (args.length !== 2) throw Error('USAGE: multi-grade-factory-dry-run.mjs <input.json> <new-output-directory>')
const inputPath = path.resolve(args[0])
const outputDir = path.resolve(args[1])
if (fs.existsSync(outputDir)) throw Error('MULTI_GRADE_OUTPUT_EXISTS')
const input = JSON.parse(fs.readFileSync(inputPath, 'utf8'))
const result = runMultiGradeFactoryDryRun(input)
const parent = path.dirname(outputDir)
fs.mkdirSync(parent, { recursive: true })
const staged = fs.mkdtempSync(path.join(parent, '.multi-grade-dry-run-'))
try {
  fs.writeFileSync(path.join(staged, 'volume.html'), result.html, { flag: 'wx' })
  fs.writeFileSync(path.join(staged, 'lineage-manifest.json'), `${JSON.stringify(result.manifest, null, 2)}\n`, { flag: 'wx' })
  if (fs.existsSync(outputDir)) throw Error('MULTI_GRADE_OUTPUT_EXISTS')
  fs.renameSync(staged, outputDir)
} catch (error) {
  for (const name of ['volume.html', 'lineage-manifest.json']) {
    try { fs.unlinkSync(path.join(staged, name)) } catch { /* The write may have failed before this file existed. */ }
  }
  fs.rmdirSync(staged)
  throw error
}
console.log(JSON.stringify({ output_dir: outputDir, group_hash: result.manifest.group_hash,
  manifest_hash: result.manifest.manifest_hash, evidence_level: result.manifest.evidence_level,
  render_eligible: false, seed_eligible: false }))
