// scripts/research/v2-f1/probe-f1.mjs
// Read-only replay of F1 before/after, using private pilot drafts without publishing their contents.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { sourceModule } from '../lm-g1-3a-independent/source-loader.mjs'

const root = path.resolve(import.meta.dirname, '../../..')
process.chdir(root + '/apps/web')
const req = createRequire(root + '/apps/web/package.json')
const ts = req('typescript')
const beforeHead = '9c19f15b1fc911b13040dc01fe5a12fef5af592f'
const file = 'apps/web/src/lib/knowledge/contextual-sense.ts'
const original = execFileSync('git', ['show', beforeHead + ':' + file], { cwd: root, encoding: 'utf8' })
const old = { exports: {} }
new Function('require', 'module', 'exports', ts.transpileModule(original, { compilerOptions: { module: ts.ModuleKind.CommonJS } }).outputText)(req, old, old.exports)
const current = sourceModule(file)
const dir = process.env.V2_PILOT_PRIVATE_DIR ?? 'D:/workspace/Vocaflow-v2-annotation-pilot/scripts/csat/v2-annotation-pilot/private/annotations'
if (!fs.existsSync(dir)) throw Error('Private pilot missing; not a PASS')
const drafts = fs.readdirSync(dir).filter(f => f.endsWith('.draft.json')).map(f => JSON.parse(fs.readFileSync(path.join(dir, f), 'utf8')))
if (drafts.length !== 12) throw Error('Expected 12 private pilot drafts')
const leakCount = panel => drafts.filter(a => a.sense.options.some(s => JSON.stringify(panel(a)).includes(s))).length
const rows = [
  { id: 'prior F1 leakage reproduced on sealed pre-F1 source', expected: 12, actual: leakCount(old.exports.contextualSensePanel) },
  { id: 'current pre-submit projection leaks', expected: 0, actual: leakCount(current.contextualSensePanel) },
  { id: 'wrong B response leaks', expected: 0, actual: drafts.filter(a => JSON.stringify(current.gradeContextualSense(a, { misfit: (a.misfit + 1) % 5, cue: [] })).includes(a.sense.options[0])).length },
  { id: 'correct B offers practice', expected: 12, actual: drafts.filter(a => current.gradeContextualSense(a, { misfit: a.misfit, cue: [] }).followUp !== null).length },
  { id: 'drafts releasable', expected: 0, actual: drafts.filter(current.releasable).length },
]
const registry = sourceModule('apps/web/src/lib/knowledge/item-tasks.ts')
const { CURATED } = sourceModule('apps/web/src/lib/knowledge/evidence-locate.ts')
const cs = registry.taskByKey('contextual-sense'), saved = cs.annotationFor
const providers = []
try {
  for (const id of Object.keys(CURATED)) {
    cs.annotationFor = saved
    const before = registry.currentItemTask(id)
    if (!before) continue
    cs.annotationFor = x => x === id ? before.ann : null
    const after = registry.currentItemTask(id)
    providers.push({ itemId: id, before: before.def.key, after: after?.def.key, pass: before.def.key === after?.def.key })
  }
} finally { cs.annotationFor = saved }
rows.push({ id: 'existing E providers preserved under V2 collision', expected: providers.length, actual: providers.filter(p => p.pass).length })
const result = { beforeHead, currentHead: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), privateDraftCount: drafts.length, draftContentsWritten: false, rows: rows.map(r => ({ ...r, pass: r.expected === r.actual })), providers }
const out = path.resolve(root, process.argv[2] ?? 'tmp/v2-f1-independent-probe.json')
if (fs.existsSync(out)) throw Error('Immutable evidence already exists')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify(result, null, 2))
console.log(JSON.stringify({ checks: rows.length, fail: result.rows.filter(r => !r.pass).length, providers: providers.length, privateDrafts: drafts.length }))
if (result.rows.some(r => !r.pass) || providers.length === 0) process.exitCode = 1
