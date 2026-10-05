// scripts/textbook/frym-validation/f02-pilot-evaluate.mjs
import { readFileSync } from 'node:fs'
import { sha256 } from './f02-pilot-judge.mjs'
import { judgeF02PilotWithV2 } from './f02-v2-bridge.mjs'

const [studyPath, v2Path] = process.argv.slice(2)
if (!studyPath || !v2Path) throw Error('Usage: pnpm exec tsx f02-pilot-evaluate.mjs <ignored-local-study.json> <sealed-v2-bundle.json>')
const freezeBytes = readFileSync(new URL('./f02-calibration-freeze.json', import.meta.url))
const proposed = JSON.parse(readFileSync(new URL('./f02-student-pilot.proposed.json', import.meta.url)))
const study = JSON.parse(readFileSync(studyPath, 'utf8'))
if (study.freeze_sha256 !== sha256(freezeBytes)) throw Error('Frozen F02 pair file changed')
const instrumentFiles = {}
for (const grade of ['middle_1', 'high_1']) {
  if (typeof study.instrument_paths?.[grade] !== 'string') throw Error(`F02 ${grade} instrument file missing`)
  const bytes = readFileSync(study.instrument_paths[grade])
  if (study.instrument_sha256?.[grade] !== sha256(bytes)) throw Error(`F02 ${grade} instrument file changed`)
  instrumentFiles[grade] = JSON.parse(bytes)
}
const result = judgeF02PilotWithV2(study, JSON.parse(freezeBytes), proposed, JSON.parse(readFileSync(v2Path, 'utf8')), instrumentFiles, Date.now())
console.log(JSON.stringify(result, null, 2))
