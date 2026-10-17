// scripts/research/factory-i2-r5-qualification/current-annotation-manifest.mts
// Read-only deployment evidence, no DB/RPC calls. Run with NODE_OPTIONS=--conditions=react-server and tsx --tsconfig apps/web/tsconfig.json.
// Output alone does not authorize registry installation or FQ/public/assessment approval.
import path from 'node:path'
// Skeleton loader resolves data from Next's apps/web working directory.
process.chdir(path.resolve(import.meta.dirname, '../../../apps/web'))
const { currentItemTask } = await import('../../../apps/web/src/lib/knowledge/item-tasks')

const items = process.argv.slice(2)
if (!items.length) throw new Error('Explicit item IDs required; no implicit whole-corpus registration')
console.log(JSON.stringify(items.map(item => {
  const live = currentItemTask(item)
  if (!live || live.def.key !== 'claim-support') throw new Error(`${item}: current R5 claim-support unavailable`)
  return { artifact_ref: item, task_id: 'r.central_meaning', annotation_ref: live.ann.version, annotation_hash: live.def.hash(live.ann) }
}), null, 2))
