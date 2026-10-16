// apps/web/src/lib/csat/map/v62/instrument-hashes.ts
import { taskByKey, type ItemTaskDef } from '@/lib/knowledge/item-tasks'

/** Request-local cache. A failed item cannot invalidate unrelated annotations. */
export function instrumentHashesFor(
  pairs: readonly (readonly [string, string | null])[],
  lookup: (key: string) => Pick<ItemTaskDef, 'annotationFor' | 'hash'> | null = taskByKey,
  onError: (key: string, error: unknown) => void = () => {},
): Record<string, string | null> {
  const hashes: Record<string, string | null> = {}
  for (const [taskKey, item] of pairs) {
    if (!item) continue
    const task = taskKey.replace(/-skeleton$/, ''), key = `${task}|${item}`
    if (Object.prototype.hasOwnProperty.call(hashes, key)) continue
    hashes[key] = null
    try {
      const def = lookup(task), ann = def?.annotationFor(item) ?? null
      hashes[key] = def && ann ? def.hash(ann) : null
    } catch (error) { onError(key, error) }
  }
  return hashes
}
