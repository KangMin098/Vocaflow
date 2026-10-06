// scripts/textbook/frym-benchmark/local-admission-run.mjs
import { existsSync, readFileSync, writeFileSync, unlinkSync, realpathSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { prepareAdmission } from './local-admission.mjs'

const [command, protocolPath, candidatesPath, samplesPath, auditPath] = process.argv.slice(2)
if (command !== 'prepare' || !protocolPath || !candidatesPath || !samplesPath || !auditPath || samplesPath === auditPath) {
  process.stderr.write('Usage: local-admission-run.mjs prepare <sealed-protocol.json> <local-candidates.json> <new-metadata-samples.json> <new-admission-audit.json>\n')
  process.exitCode = 1
} else {
  try {
    const root = fileURLToPath(new URL('../../../', import.meta.url))
    const inputLocation = relative(root, realpathSync(dirname(resolve(candidatesPath))))
    if (inputLocation !== '..' && !inputLocation.startsWith(`..${sep}`) && !isAbsolute(inputLocation)) throw Error('RAW_CANDIDATES_MUST_STAY_OUTSIDE_REPOSITORY')
    if (existsSync(samplesPath) || existsSync(auditPath)) throw Error('OUTPUT_EXISTS')
    const protocol = JSON.parse(readFileSync(protocolPath, 'utf8'))
    const candidates = JSON.parse(readFileSync(candidatesPath, 'utf8'))
    const { samples, audit } = prepareAdmission(candidates, protocol)
    writeFileSync(auditPath, `${JSON.stringify(audit, null, 2)}\n`, { flag: 'wx' })
    try { writeFileSync(samplesPath, `${JSON.stringify(samples, null, 2)}\n`, { flag: 'wx' }) }
    catch (error) { unlinkSync(auditPath); throw error }
    process.stdout.write(`admission-pass=${samples.length} admission-hold=${audit.results.filter(row => row.status === 'admission-hold').length} admission-reject=${audit.results.filter(row => row.status === 'admission-reject').length}\n`)
  } catch (error) {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  }
}
