// apps/web/src/lib/csat/map/v62/instrument-hashes.ts
import { currentItemTask } from '@/lib/knowledge/item-tasks'

/** Request-local cache. A failed item cannot invalidate unrelated annotations. */
export async function instrumentHashesFor(
  pairs: readonly (readonly [string, string | null])[],
  sourceGate: (item: string) => Promise<boolean>,
  lookup: (item: string) => ReturnType<typeof currentItemTask> = currentItemTask,
  onError: (key: string, error: unknown) => void = () => {},
): Promise<Record<string, string | null>> {
  const hashes: Record<string, string | null> = {}
  const current = new Map<string, ReturnType<typeof currentItemTask>>()
  const keysByItem = new Map<string, Set<string>>()
  for (const [taskKey, item] of pairs) {
    if (!item) continue
    // Practice and theater may share a learning TASK but use different graders.
    const task = taskKey, key = `${task}|${item}`
    if (Object.prototype.hasOwnProperty.call(hashes, key)) continue
    hashes[key] = null
    try {
      // Reuse the grading registry: current skeleton, signature, sentence count,
      // and the one live task selected for this item. Annotation presence alone
      // is not proof that the current grading path accepts this instrument.
      if (!current.has(item)) { current.set(item, null); current.set(item, lookup(item)) }
      const live = current.get(item)
      if (live?.def.key === task) keysByItem.set(item, new Set([...(keysByItem.get(item) ?? []), key]))
    } catch (error) { onError(key, error) }
  }
  const items = [...keysByItem.keys()]
  // Bound concurrency and one source check per item, never one query per row.
  for (let i = 0; i < items.length; i += 8) await Promise.all(items.slice(i, i + 8).map(async (item) => {
    try {
      if (!(await sourceGate(item))) return
      const live = current.get(item)!
      const hash = live!.def.hash(live!.ann)
      for (const key of keysByItem.get(item)!) hashes[key] = hash
    } catch (error) { onError(`source|${item}`, error) }
  }))
  return hashes
}
