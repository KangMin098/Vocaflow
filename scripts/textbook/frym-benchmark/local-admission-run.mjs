// scripts/textbook/frym-benchmark/local-admission-run.mjs
import { existsSync, readFileSync, writeFileSync, unlinkSync } from 'node:fs'
import { resolve } from 'node:path'
import { dryRunAdmission, prepareSealedAdmission, verifyAdmission } from './local-admission-ledger.mjs'
import { assertExternalCandidate } from './local-candidate-path.mjs'

const [command, ...paths] = process.argv.slice(2)
const read = path => JSON.parse(readFileSync(path, 'utf8'))
const readRealProtocol = path => {
  const protocol = read(path)
  if (protocol?.schema !== 'frym-benchmark/2') throw Error('TWO_STAGE_PROTOCOL_REQUIRED')
  return protocol
}
const writeNewSet = entries => {
  if (new Set(entries.map(([path]) => resolve(path))).size !== entries.length || entries.some(([path]) => existsSync(path))) throw Error('OUTPUT_EXISTS')
  const created = []
  try {
    for (const [path, value] of entries) {
      writeFileSync(path, `${JSON.stringify(value, null, 2)}\n`, { flag: 'wx' })
      created.push(path)
    }
  } catch (error) {
    for (const path of created) unlinkSync(path)
    throw error
  }
}

try {
  if (command === 'dry-run' && paths.length === 2) {
    assertExternalCandidate(paths[1])
    process.stdout.write(`${JSON.stringify(dryRunAdmission(readRealProtocol(paths[0]), read(paths[1])))}\n`)
  } else if (command === 'prepare' && paths.length === 5) {
    assertExternalCandidate(paths[1])
    const { samples, audit, receipt } = prepareSealedAdmission(readRealProtocol(paths[0]), read(paths[1]))
    writeNewSet([[paths[2], samples], [paths[3], audit], [paths[4], receipt]])
    process.stdout.write(`admission-pass=${receipt.counts.pass} admission-hold=${receipt.counts.hold} admission-reject=${receipt.counts.reject} ready-for-build=${receipt.ready_for_build}\n`)
  } else if (command === 'verify' && paths.length === 5) {
    assertExternalCandidate(paths[1])
    const result = verifyAdmission(readRealProtocol(paths[0]), read(paths[1]), read(paths[2]), read(paths[3]), read(paths[4]))
    process.stdout.write(`${JSON.stringify(result)}\n`)
    if (result.status !== 'current') process.exitCode = 1
  } else {
    throw Error('Usage: local-admission-run.mjs dry-run <sealed-protocol.json> <local-candidates.json> | prepare <sealed-protocol.json> <local-candidates.json> <new-metadata-samples.json> <new-admission-audit.json> <new-receipt.json> | verify <sealed-protocol.json> <local-candidates.json> <metadata-samples.json> <admission-audit.json> <receipt.json>')
  }
} catch (error) {
  process.stderr.write(`${error.message}\n`)
  process.exitCode = 1
}
