// apps/web/src/lib/csat/map/v62/__tests__/instrument-hashes.test.ts
import { afterEach, expect, it, vi } from 'vitest'
import { annotatedItemIds } from '@/lib/knowledge/claim-support'
import { currentItemTask, ITEM_TASKS } from '@/lib/knowledge/item-tasks'
import { instrumentHashesFor } from '../instrument-hashes'
afterEach(() => { vi.restoreAllMocks() })

it('12001 repeated rows resolve the actual current grading instrument once per item', async () => {
 const keys = ['claim-support', 'cohesion-link', 'option-restate', 'evidence-locate'], items = annotatedItemIds().slice(0, 6)
 const pairs = Array.from({ length: 12001 }, (_, i) => [keys[i % 4]!, items[Math.floor(i / 4) % 6]!] as const)
 let annotationCalls = 0, hashCalls = 0, lookups = 0
 for (const def of ITEM_TASKS) {
  const annotation = def.annotationFor, hash = def.hash
  vi.spyOn(def, 'annotationFor').mockImplementation(item => { annotationCalls++; return annotation(item) })
  vi.spyOn(def, 'hash').mockImplementation(ann => { hashCalls++; return hash(ann) })
 }
 const result = await instrumentHashesFor(pairs, async () => true, item => { lookups++; return currentItemTask(item) })
 expect(Object.keys(result)).toHaveLength(24)
 expect(lookups).toBe(6); expect(annotationCalls).toBe(6); expect(hashCalls).toBe(6)
 for (const item of items) {
  expect(result[`claim-support|${item}`]).toBeTruthy()
  for (const key of keys.slice(1)) expect(result[`${key}|${item}`]).toBeNull()
 }
})
it('one failed current-instrument lookup or hash does not invalidate unrelated items', async () => {
 const items = annotatedItemIds().slice(0, 3), errors: string[] = []
 const result = await instrumentHashesFor(items.map(item => ['claim-support', item] as const), async () => true, item => {
  if (item === items[1]) throw Error('injected annotation failure')
  return currentItemTask(item)
 }, key => errors.push(key))
 expect(result[`claim-support|${items[0]}`]).toBeTruthy(); expect(result[`claim-support|${items[1]}`]).toBeNull(); expect(result[`claim-support|${items[2]}`]).toBeTruthy()
 expect(errors).toHaveLength(1)
 expect(await instrumentHashesFor([['claim-support', 'missing']], async () => true)).toEqual({ 'claim-support|missing': null })
 const thrown = await instrumentHashesFor([['claim-support', items[0]!]], async () => true, item => { const live = currentItemTask(item)!; return { ...live, def: { ...live.def, hash: () => { throw Error('hash failed') } } } })
 expect(thrown[`claim-support|${items[0]}`]).toBeNull()
})
it('different grading roles keep separate hashes while sharing request-local item lookup', async () => {
 const item = annotatedItemIds()[0]!, pairs = [['claim-support', item], ['claim-support-skeleton', item]] as const
 let n = 0
 const lookup = () => { const live = currentItemTask(item)!; return { ...live, def: { ...live.def, hash: () => String(++n) } } }
 expect(await instrumentHashesFor(pairs, async () => true, lookup)).toEqual({ [`claim-support|${item}`]: '1', [`claim-support-skeleton|${item}`]: null })
 expect(await instrumentHashesFor(pairs, async () => true, lookup)).toEqual({ [`claim-support|${item}`]: '2', [`claim-support-skeleton|${item}`]: null })
})
