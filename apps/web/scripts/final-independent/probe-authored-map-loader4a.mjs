// apps/web/scripts/final-independent/probe-authored-map-loader4a.mjs
// Executes frozen loader declarations and merge block with synthetic inputs; no DB or network.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
import { createHash } from 'node:crypto'

const root = path.resolve(import.meta.dirname, '../../../..')
const require = createRequire(path.join(root, 'apps/web/package.json'))
const ts = require('typescript')
const owner964 = process.argv.includes('--owner964')
const head = owner964 ? '9647b45e1db1f719b8f778c22cbefa7e742fc689' : '4a751eeb9215bf4c6e81f8d512b3fff432d18d67'
const read = file => execFileSync('git', ['show', `${head}:${file}`], { cwd: root, encoding: 'utf8', windowsHide: true })
const source = read('apps/web/src/lib/csat/map/load.ts')
const taskSource = read('apps/web/src/lib/knowledge/authored/tasks.ts')
const compile = value => ts.transpileModule(value, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText
const exports = {}
new Function('exports', compile(taskSource))(exports)
const declaration = source.slice(source.indexOf('async function loadAuthoredConfirms('), source.indexOf('/** 창작 자료 첫 시도'))
const start = source.indexOf('  for (const c of await loadAuthoredConfirms(')
const end = source.indexOf('  const findAttempts =', start)
if (!declaration.startsWith('async function loadAuthoredConfirms(') || start < 0 || end < start) throw Error('Frozen source boundary changed')
const block = source.slice(start, end)
if (owner964) {
  const prior = JSON.parse(fs.readFileSync(path.join(root, 'docs/research/final-independent-20261018/authored-owner4a-loader.json'), 'utf8'))
  const mergeBlockSha256 = createHash('sha256').update(block).digest('hex')
  if (mergeBlockSha256 !== prior.mergeBlockSha256) throw Error('Merge block changed: repeat its focused check')
  const deliveries = source.slice(source.indexOf('async function loadAuthoredDeliveries('), source.indexOf('async function loadAuthoredConfirms('))
  const load = new Function(compile(deliveries) + '\nreturn loadAuthoredDeliveries;')()
  const scenarios = [
    { name: 'learner_current', current: { data: true, error: null }, supply: { data: null, error: {} }, count: 1, calls: ['workspace_delivery_current'] },
    { name: 'learner_revoked', current: { data: false, error: null }, supply: { data: true, error: null }, count: 0, calls: ['workspace_delivery_current'] },
    { name: 'service_no_uid', current: { data: null, error: null }, supply: { data: true, error: null }, count: 1, calls: ['workspace_delivery_current', 'supply_delivery_valid'] },
    { name: 'both_rpc_failed', current: { data: null, error: {} }, supply: { data: null, error: {} }, count: 0, calls: ['workspace_delivery_current', 'supply_delivery_valid'] },
  ]
  const observed = []
  for (const scenario of scenarios) {
    const calls = [], filters = []
    const query = { select: () => query, eq: (key, value) => { filters.push([key, value]); return query }, in: async () => ({ data: [{ id: 'synthetic-delivery' }], error: null }) }
    const db = { from: () => query, rpc: async name => { calls.push(name); return name === 'workspace_delivery_current' ? scenario.current : scenario.supply } }
    const rows = await load(db, 'synthetic-learner')
    if (rows.length !== scenario.count || JSON.stringify(calls) !== JSON.stringify(scenario.calls) || !filters.some(([k, v]) => k === 'user_id' && v === 'synthetic-learner')) throw Error('RPC branch changed: ' + scenario.name)
    observed.push({ name: scenario.name, retained: rows.length, calls, ownerFilterPresent: true })
  }
  fs.writeFileSync(path.join(root, 'docs/research/final-independent-20261018/authored-owner964-loader.json'), JSON.stringify({ head, mergeBlockSha256, unchangedMergeDefectReusedFrom: prior.head, scope: 'Actual changed loadAuthoredDeliveries declaration with synthetic query/RPC transports; role grants and actual DB not executed. Unchanged 17-TASK merge defect not rerun.', observed }, null, 2) + '\n')
  console.log(JSON.stringify({ head, rpcBranches: observed.length, unchangedMergeDefectReused: true }))
  process.exit(0)
}
// CommonJS export bindings belong to this isolated module object.
const build = new Function('exports', 'authoredKeysOf', compile(`${declaration}
export async function run(practiceLinks: Record<string, any>, authoredRows: any[]) {
const db = null, userId = 'synthetic-learner';
${block}
return practiceLinks;
}`) + '\nreturn exports.run;')
const run = build({}, exports.authoredKeysOf)
const rows = []
for (const task of exports.AUTHORED_TASKS) {
  const delivery = { id: 'synthetic-delivery', artifact_ref: 'authored:synthetic-unseen', task_id: task, role: 'independent_check' }
  const actual = await run({ 'B6-3': { confirm: [] } }, [delivery])
  const control = await run({ [task]: { confirm: [] } }, [delivery])
  const merged = Object.values(actual).flatMap(x => x.confirm).length
  const controlMerged = Object.values(control).flatMap(x => x.confirm).length
  if (merged !== 0 || controlMerged !== 1) throw Error('Observation changed: ' + task)
  rows.push({ task, validDeliveredInput: 1, merged, artificialSameTaskSlotControl: controlMerged })
}
const report = {
  head, sourceSha256: createHash('sha256').update(source).digest('hex'),
  mergeBlockSha256: createHash('sha256').update(block).digest('hex'),
  scope: 'Actual frozen loadAuthoredConfirms declaration and merge block; qualified rows supplied, DB/RPC/currentness/full loadMapPage not executed. Main and synthetic legacy task map keys differ from canonical authored TASK ids.',
  rows, observedDefect: '17 qualified delivery inputs omitted when a same canonical TASK slot is absent; pre-created slot control accepts each input. PASS means defect reproduction, not product acceptance.'
}
const out = path.join(root, 'docs/research/final-independent-20261018/authored-owner4a-loader.json')
fs.writeFileSync(out, JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ head, tasks: rows.length, omitted: rows.filter(x => x.merged === 0).length, controlsAccepted: rows.filter(x => x.artificialSameTaskSlotControl === 1).length }))
