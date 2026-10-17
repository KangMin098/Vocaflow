// scripts/research/factory-i2-independent/inspect.mts
// Offline independent audit. No DB client, credentials, learner identifiers or writes to product sources.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import assert from 'node:assert/strict'
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const root = path.resolve(import.meta.dirname, '../../..')
const ev = path.join(root, 'docs/research/factory-i2-independent-20261017')
const lib = path.join(root, 'apps/web/src/lib')
// skeleton.ts resolves baked data relative to the web app's working directory.
process.chdir(path.join(root, 'apps/web'))
const read = (p: string) => JSON.parse(fs.readFileSync(path.join(root, p), 'utf8'))
const sha = (s: string | Buffer) => crypto.createHash('sha256').update(s).digest('hex')
const load = (p: string) => import(pathToFileURL(path.join(lib, p)).href)
const { annotatedItemIds, annotationFor, annotationHash, skeletonSig, gradeClaimSupport } = await load('knowledge/claim-support.ts')
const { currentItemTask } = await load('knowledge/item-tasks.ts')
const { resolveStock } = await load('csat/map/v62/factory-bridge/stock-resolver.ts')
const { supplyFor, fulfillmentOf } = await load('csat/map/v62/supply.ts')
const { studyItemsFor } = await load('csat/map/v62/study-items.ts')
const { resolveChain } = await load('knowledge/live-chain.ts')
const v = 'apps/web/src/lib/csat/'
const inquiry = read(v + 'inquiry-data.json').items
const types = new Set(['R-CLAIM', 'R-GIST', 'R-TOPIC', 'R-TITLE'])
const all = fs.readdirSync(path.join(root, v, 'skeleton-data')).flatMap(f => read(v + 'skeleton-data/' + f).items ?? [])
const skeleton = all.filter(i => types.has(i.type_id))
const ids = annotatedItemIds().sort()
const annotations = ids.map((id: string) => {
  const ann = annotationFor(id)
  const sk = all.find(i => i.id === id)
  return { id, version: ann.version, hash: annotationHash(ann), skeletonMatches: skeletonSig(sk.sentences.map(s => s.chars)) === ann.skeletonSig,
    countMatches: ann.sentenceCount === sk.sentences.length, currentTask: currentItemTask(id)?.def.key,
    blind: ann.provenance.reviewerBlind, provenance: ann.provenance, disputed: ann.supportDisputed }
})
const publicIds = skeleton.filter(i => inquiry[i.id]).map(i => i.id).sort()
const fq1 = read(v + 'map/v62/fq1-results.data.json').results
const fq11 = read(v + 'map/v62/fq11-candidates.data.json').selected
const r5Fq = [...fq1, ...fq11].filter(r => r.task === 'r.central_meaning')
const researchSources = [
  ['e5b24b1eb', 'docs/research/factory-qualification/data/qualification-results.json'],
  ['a658fa39a', 'docs/research/factory-qualification-v11/data/final-qualification.json'],
].map(([ref, file]) => {
  const bytes = execFileSync('git', ['show', `${ref}:${file}`], { cwd: root, maxBuffer: 32 * 1024 * 1024 })
  const tasks: string[] = []
  function walk(x: unknown) {
    if (!x || typeof x !== 'object') return
    for (const [key, value] of Object.entries(x)) {
      if (['task', 'taskId', 'task_id'].includes(key) && typeof value === 'string') tasks.push(value)
      else walk(value)
    }
  }
  walk(JSON.parse(bytes.toString('utf8')))
  assert(tasks.length > 0, 'FQ source task extraction must not be vacuous')
  assert(!tasks.includes('r.central_meaning'))
  return { ref, file, sha256: sha(bytes), taskReferences: tasks.length, tasks: [...new Set(tasks)].sort(), r5Results: 0 }
})
assert.equal(ids.length, 13)
assert.equal(publicIds.length, 113)
assert.equal(r5Fq.length, 0)
assert.deepEqual(annotations.filter(a => !a.skeletonMatches || !a.countMatches || a.currentTask !== 'claim-support').map(a => a.id), [])

const line = (role: string) => ({ role, task: 'r.central_meaning', quantity: { n: 1, unit: '문항' }, csatTypes: ['R-TITLE'], taskKeys: ['claim-support'], requires: {}, reason: 'audit fixture' })
const demand = { key: 'fixture', lines: [line('source_analysis'), line('independent_check'), line('transfer')] }
const supplied = supplyFor(demand, { unseenCheckItems: ['2016#20'], transferItems: ['2020#24'], transferDrafts: 0,
  study: { items: [{ item: '2020#24', basis: 'research_case', research: 'direct' }], withheld: 0, sharedPassageUnchecked: true }, factoryStock: null })
const revision = 'fixture-original-item-revision'
const fq = { content: { id: '2020#24', revision }, task: 'r.central_meaning', role: 'transfer', axes: Object.fromEntries('ABCDEFGH'.split('').map(k => [k, { state: 'pass' }])), eligibleRoles: ['transfer'], publicQualified: true, assessmentQualified: true }
const candidate = { artifact: { kind: 'csat_item', ref: '2020#24', contentType: 'transfer_task' }, currentRevision: revision, passage: 'fixture-passage',
  fq, qualificationId: 'fixture-q', approvals: ['public', 'assessment'].map(scope => ({ id: 'fixture-' + scope, qualificationId: 'fixture-q', scope, approverRole: 'admin', revoked: false })), exposure: 'none' }
const want = { task: 'r.central_meaning', role: 'transfer', requested: 1 }
const test = (over: object) => resolveStock(want, 'ok', [{ ...candidate, ...over }])
const annotationChange = { ...annotationFor('2020#24'), support: [3, 4] }
const mutation = {
  originalAnnotationHash: annotationHash(annotationFor('2020#24')), changedAnnotationHash: annotationHash(annotationChange),
  unchangedBRevisionInput: true,
  resolverWithoutReaderBinding: test({}),
  resolverWithChangedRevision: test({ currentRevision: 'changed-composite-revision' }),
}
assert.notEqual(mutation.originalAnnotationHash, mutation.changedAnnotationHash)
assert.equal(mutation.resolverWithoutReaderBinding.eligible.length, 1)
assert.equal(mutation.resolverWithChangedRevision.eligible.length, 0)
const attempt = gradeClaimSupport(annotationFor('2020#24'), { claim: 2, support: [3, 4, 5], relation: 'reason' })
assert.equal(attempt.isCorrect, true)

const dbPath = path.join(ev, 'DB-INDEPENDENT.json')
assert(fs.existsSync(dbPath), 'The independent SELECT snapshot is required')
const exposure = JSON.parse(fs.readFileSync(path.join(ev, 'DB-EXPOSURE.json'), 'utf8'))
const alternative = exposure.trapDetail.find(i => i.item === '2021#24')
assert(alternative.trapOnlyLearners > 0, 'Recheck the omitted exposure finding if live evidence changes')
assert.equal(exposure.exposureByItem.filter(i => i.item === '2020#24').length, 1)
const first = exposure.exposureByItem.find(i => i.item === '2020#24')
assert(['g2Attempts', 'allSessions', 'trapAttempts', 'paperAttempts', 'reviewQueue', 'dxResponses', 'dxExamSessions'].every(k => first[k] === 0))
let dbChecks: unknown = null
let workspaceStudy: unknown = null
if (fs.existsSync(dbPath)) {
  const db = JSON.parse(fs.readFileSync(dbPath, 'utf8'))
  const apps = db.applications.filter(a => a.surface_ref.startsWith('claim-support:'))
  const live = apps.map(a => ({ ref: a.surface_ref, ...resolveChain(a.item_id, db.graph.items, db.graph.links) }))
  assert(live.every(a => a.live))
  assert.deepEqual(db.publicBodies.ids, publicIds)
  assert.equal(db.normalizedShared.filter(r => r.otherItems.length > 0).length, 0)
  const checks = apps.filter(a => a.audience.role !== 'transfer').map(a => a.audience.item)
  const transfers = apps.filter(a => a.audience.role === 'transfer').map(a => a.audience.item)
  const study = studyItemsFor('r.central_meaning', { unseen: checks }, checks.map(target => ({ target })), transfers.map(target => ({ target })))
  workspaceStudy = { fixture: 'new learner with all nine checks unseen; no individual data', ...study,
    publicExplanationIds: study.items.filter(i => inquiry[i.item]).map(i => i.item) }
  dbChecks = { liveApplicationChains: live.map(a => ({ ref: a.ref, live: a.live, path: a.path.map(i => ({ slug: i.slug, layer: i.layer, status: i.status })) })),
    publicBodies: db.publicBodies, item2026Task: currentItemTask('2026#23')?.def.key, normalizedShared: db.normalizedShared }
}
const report = { schema: 'vf.factory-i2-independent/1', head: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(),
  offlineChecksDoNotCreateQualifications: true, ids, publicIds, heldIds: skeleton.filter(i => !inquiry[i.id]).map(i => i.id).sort(), annotations, workspaceStudy,
  exposureCoverage: { firstCandidate: first, omittedTrapExposures: exposure.trapDetail.filter(i => i.trapRows > 0) },
  fqEvidence: { fq1Total: fq1.length, fq11Total: fq11.length, r5Results: r5Fq.length, researchSources },
  supply: supplied.lines.map(l => ({ ...l, fulfillment: fulfillmentOf(l) })), mutation, gradingControl: attempt, dbChecks,
  productSourceHashes: Object.fromEntries(['knowledge/product-server.ts', 'knowledge/practice-server.ts', 'knowledge/claim-support.ts', 'knowledge/item-tasks.ts', 'csat/map/v62/supply.ts', 'csat/map/v62/qualification.ts', 'csat/map/v62/factory-bridge/stock-resolver.ts'].map(p => [p, sha(fs.readFileSync(path.join(lib, p)))])) }
fs.mkdirSync(ev, { recursive: true })
fs.writeFileSync(path.join(ev, 'INSPECT.json'), JSON.stringify(report, null, 2) + '\n')
console.log(JSON.stringify({ ids, publicIds: publicIds.length, r5Fq: r5Fq.length, allAnnotationsMatch: true, supply: report.supply.map(l => ({ role: l.role, state: l.state, teaching: l.qualification.teaching, fulfillment: l.fulfillment })), dbChecked: dbChecks !== null }))
