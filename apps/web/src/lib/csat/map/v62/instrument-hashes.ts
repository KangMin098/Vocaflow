// apps/web/src/lib/csat/map/v62/instrument-hashes.ts
import { currentItemTask } from '@/lib/knowledge/item-tasks'

/** Request-local cache. A failed item cannot invalidate unrelated annotations. */
export function instrumentHashesFor(
  pairs: readonly (readonly [string, string | null])[],
  lookup: (item: string) => ReturnType<typeof currentItemTask> = currentItemTask,
  onError: (key: string, error: unknown) => void = () => {},
): Record<string, string | null> {
  const hashes: Record<string, string | null> = {}
  const current = new Map<string, ReturnType<typeof currentItemTask>>()
  for (const [taskKey, item] of pairs) {
    if (!item) continue
    const task = taskKey.replace(/-skeleton$/, ''), key = `${task}|${item}`
    if (Object.prototype.hasOwnProperty.call(hashes, key)) continue
    hashes[key] = null
    try {
      // Reuse the grading registry: current skeleton, signature, sentence count,
      // and the one live task selected for this item. Annotation presence alone
      // is not proof that the current grading path accepts this instrument.
      if (!current.has(item)) { current.set(item, null); current.set(item, lookup(item)) }
      const live = current.get(item)
      hashes[key] = live?.def.key === task ? live.def.hash(live.ann) : null
    } catch (error) { onError(key, error) }
  }
  return hashes
}
