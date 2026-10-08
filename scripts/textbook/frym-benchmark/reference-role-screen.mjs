// scripts/textbook/frym-benchmark/reference-role-screen.mjs
import { readFileSync, writeFileSync } from 'node:fs'
import { hash } from './benchmark.mjs'
import { assertExternalCandidate } from './local-candidate-path.mjs'
import { assessReferenceRoles } from './reference-roles.mjs'

const fail = code => { throw Error(code) }

export function buildReferenceRoleScreen(input) {
  if (input?.schema !== 'reference-role-screen-input/1' ||
      !Array.isArray(input.candidates) || !input.candidates.length ||
      input.candidates.some(row => !row?.structural || row.admission || row.calibration_evidence))
    fail('REFERENCE_ROLE_SCREEN_INPUT_INVALID')
  const decisions = input.candidates.map(row => assessReferenceRoles({ structural: row.structural }))
  if (new Set(decisions.map(row => row.source_id)).size !== decisions.length)
    fail('REFERENCE_ROLE_DUPLICATE_SOURCE')
  const structural = decisions.filter(row => row.structural_reference === 'eligible')
  const body = { schema: 'reference-role-screen/1', input_hash: hash(input),
    source_count: decisions.length, structural_eligible_n: structural.length,
    calibration_eligible_n: 0, grade_distribution_n: 0,
    structural_corpus: structural.map(row => ({ source_id: row.source_id,
      source_hash: row.source_hash, decision_hash: row.decision_hash })),
    decisions }
  return { ...body, screen_hash: hash(body) }
}

if (process.argv[1]?.endsWith('reference-role-screen.mjs')) {
  const [inputPath, outputPath] = process.argv.slice(2)
  if (!inputPath || !outputPath) fail('USAGE: reference-role-screen.mjs <external-input.json> <external-output.json>')
  assertExternalCandidate(inputPath)
  assertExternalCandidate(outputPath)
  const result = buildReferenceRoleScreen(JSON.parse(readFileSync(inputPath, 'utf8')))
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`, { flag: 'wx' })
  process.stdout.write(`${JSON.stringify({ screen_hash: result.screen_hash,
    source_count: result.source_count, structural_eligible_n: result.structural_eligible_n,
    calibration_eligible_n: result.calibration_eligible_n })}\n`)
}
