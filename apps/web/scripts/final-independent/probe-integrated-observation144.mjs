// apps/web/scripts/final-independent/probe-integrated-observation144.mjs
// Frozen actual pure modules; synthetic evidence only. No DB, network or product writes.
import fs from 'node:fs'
import path from 'node:path'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'

const root = path.resolve(import.meta.dirname, '../../../..')
const head = '14446db1048258752acb22ba08171196e8b33566'
const require = createRequire(path.join(root, 'apps/web/package.json'))
const ts = require('typescript')
const base = 'apps/web/src/lib/csat/map/v4/'
const sources = new Map()
const cache = new Map()
function load(file) {
  if (cache.has(file)) return cache.get(file).exports
  if (![base + 'observation.ts', base + 'definition.ts', base + 'definition.data.ts', 'apps/web/src/lib/knowledge/authored/tasks.ts'].includes(file)) throw Error('Unexpected runtime dependency: ' + file)
  const source = execFileSync('git', ['show', `${head}:${file}`], { cwd: root, encoding: 'utf8', windowsHide: true })
  sources.set(file, source)
  const loaded = { exports: {} }
  cache.set(file, loaded)
  const compiled = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
  const resolve = spec => {
    if (spec === '@/lib/knowledge/authored/tasks') return load('apps/web/src/lib/knowledge/authored/tasks.ts')
    if (spec.startsWith('./')) return load(path.posix.join(path.posix.dirname(file), spec + '.ts'))
    throw Error('Unexpected import: ' + spec)
  }
  new Function('module', 'exports', 'require', compiled)(loaded, loaded.exports, resolve)
  return loaded.exports
}
const { integratedObservation, OBSERVATION_NOTE } = load(base + 'observation.ts')
const { tasks, partsOf } = load(base + 'definition.ts')
const models = tasks().filter(t => t.kind === 'integrated' && t.status !== 'hold')
assert.deepEqual(models.map(t => t.id).sort(), ['e.o.final_judgment', 'r.o.global_meaning_model', 's.o.sentence_meaning_model'])
const cases = []
for (const model of models) {
  const parts = partsOf(model.id)
  assert.ok(parts.length > 0)
  const make = () => ({ tasks: Object.fromEntries(parts.map(id => [id, { id, status: 'resolved', basis: 'direct_check', check: { taskKey: 'synthetic-check' } }])) })
  const inspect = (name, input, expected, blocker) => {
    const result = integratedObservation(model.id, input)
    assert.equal(result.state, expected, model.id + ': ' + name)
    if (blocker) assert.ok(result.blocking.includes(blocker))
    assert.deepEqual(Object.keys(result).sort(), ['blocking', 'parts', 'state', 'task'])
    cases.push({ task: model.id, scenario: name, state: result.state, blockers: result.blocking })
  }
  inspect('all_children_direct_resolved', make(), 'observable')
  const wrong = make()
  for (const id of parts) wrong.tasks[id].status = 'verified_need'
  inspect('all_children_direct_need_is_observable_not_mastery', wrong, 'observable')
  for (const id of parts) {
    const missing = make()
    delete missing.tasks[id]
    inspect('one_child_missing:' + id, missing, 'unmeasurable', id)
    for (const status of ['observed', 'check_first', 'expired', 'checking', 'unmeasured']) {
      const input = make()
      Object.assign(input.tasks[id], { status, basis: status === 'observed' || status === 'check_first' ? 'axis_proxy' : 'direct_check' })
      inspect('one_child_' + status + ':' + id, input, 'insufficient', id)
    }
    const falseDirect = make()
    falseDirect.tasks[id].basis = 'axis_proxy'
    inspect('resolved_status_without_direct_basis:' + id, falseDirect, 'insufficient', id)
  }
}
assert.equal(integratedObservation('r.central_meaning', { tasks: {} }), null)
assert.equal(integratedObservation('unknown.synthetic', { tasks: {} }), null)
assert.equal(integratedObservation('x.o.whole_test_stability', { tasks: {} }), null)
assert.match(OBSERVATION_NOTE.observable, /숙달 점수는 매기지/)
const report = {
  head, scope: 'Actual frozen observation/definition/authored task modules; synthetic evidence, no UI rendering or actual learner/DB. Readiness of integrated observation is distinct from mastery or demonstrated integrated performance.',
  modules: [...sources].map(([file, source]) => ({ file, sha256: createHash('sha256').update(source).digest('hex') })),
  models: models.map(t => ({ task: t.id, parts: partsOf(t.id) })),
  cases, nullControls: 3, heldProposedRelationsNotCounted: true, masteryScoreAbsent: true, result: 'PASS'
}
fs.writeFileSync(path.join(root, 'docs/research/final-independent-20261018/integrated-observation144.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ head, models: models.length, scenarios: cases.length, nullControls: 3, result: report.result }))
