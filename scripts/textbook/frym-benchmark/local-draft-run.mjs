// scripts/textbook/frym-benchmark/local-draft-run.mjs
import { existsSync, realpathSync, writeFileSync } from 'node:fs'
import { dirname, relative, isAbsolute, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { draftLocalCandidates, readLocalDraftInputs } from './local-draft.mjs'

const [command, sourcePath, metaPath, pagesPath, hintsPath, outputPath] = process.argv.slice(2)
if (command !== 'draft' || !sourcePath || !metaPath || !pagesPath || !hintsPath || !outputPath) {
  process.stderr.write('Usage: local-draft-run.mjs draft <local-source-file> <extractor-meta.json> <pages.jsonl> <metadata-hints.json> <new-local-candidates.json>\n')
  process.exitCode = 1
} else {
  try {
    const root = fileURLToPath(new URL('../../../', import.meta.url))
    const parent = realpathSync(dirname(resolve(outputPath)))
    const location = relative(root, parent)
    if (location !== '..' && !location.startsWith(`..${sep}`) && !isAbsolute(location)) throw Error('RAW_CANDIDATES_MUST_STAY_OUTSIDE_REPOSITORY')
    if (existsSync(outputPath)) throw Error('OUTPUT_EXISTS')
    const inputs = readLocalDraftInputs(metaPath, pagesPath, hintsPath)
    const result = draftLocalCandidates(sourcePath, inputs.extractorMeta, inputs.pagesJsonl, inputs.metadataHints)
    writeFileSync(outputPath, `${JSON.stringify(result.candidates, null, 2)}\n`, { flag: 'wx' })
    process.stdout.write(`${JSON.stringify(result.audit)}\n`)
  } catch (error) {
    process.stderr.write(`${error.message}\n`)
    process.exitCode = 1
  }
}
