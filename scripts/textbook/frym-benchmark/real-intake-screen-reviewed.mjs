// scripts/textbook/frym-benchmark/real-intake-screen-reviewed.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { buildReviewedScreening } from './reviewed-intake.mjs'
import { assertExternalCandidate } from './local-candidate-path.mjs'

const [stage1Path, inventoryPath, probePath, reviewedPath, outputPath] = process.argv.slice(2)
if (![stage1Path, inventoryPath, probePath, reviewedPath, outputPath].every(Boolean)) {
  throw Error('USAGE: <stage1> <inventory> <probe> <reviewed-input> <new-screening>')
}
const read = path => JSON.parse(readFileSync(path, 'utf8').replace(/^\uFEFF/, ''))
assertExternalCandidate(reviewedPath)
const screening = buildReviewedScreening(read(stage1Path), read(inventoryPath), read(probePath), read(reviewedPath))
writeFileSync(outputPath, `${JSON.stringify(screening, null, 2)}\n`, { flag: 'wx' })
process.stdout.write(`${JSON.stringify({ revision: screening.revision, eligible_candidates: screening.candidates.length,
  held_unique_files: screening.held_file_hashes.length })}\n`)
