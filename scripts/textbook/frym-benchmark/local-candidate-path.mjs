// scripts/textbook/frym-benchmark/local-candidate-path.mjs
import { existsSync, realpathSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../', import.meta.url))

export function assertExternalCandidate(path) {
  const absolute = resolve(path)
  for (const candidate of [realpathSync(dirname(absolute)), ...(existsSync(absolute) ? [realpathSync(absolute)] : [])]) {
    const location = relative(root, candidate)
    if (location !== '..' && !location.startsWith(`..${sep}`) && !isAbsolute(location)) throw Error('RAW_CANDIDATES_MUST_STAY_OUTSIDE_REPOSITORY')
  }
}
