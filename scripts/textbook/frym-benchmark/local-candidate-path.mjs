// scripts/textbook/frym-benchmark/local-candidate-path.mjs
import { realpathSync } from 'node:fs'
import { dirname, isAbsolute, relative, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = fileURLToPath(new URL('../../../', import.meta.url))

export function assertExternalCandidate(path) {
  const location = relative(root, realpathSync(dirname(resolve(path))))
  if (location !== '..' && !location.startsWith(`..${sep}`) && !isAbsolute(location)) throw Error('RAW_CANDIDATES_MUST_STAY_OUTSIDE_REPOSITORY')
}
