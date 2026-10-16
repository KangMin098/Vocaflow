// apps/web/src/lib/csat/map/v62/__tests__/instrument-source-independent.test.ts
import { expect, it, vi } from 'vitest'
import { CURATED } from '@/lib/knowledge/evidence-locate'
import { currentItemTask } from '@/lib/knowledge/item-tasks'
import { anchorGate } from '@/lib/knowledge/product-server'
import { instrumentHashesFor } from '../instrument-hashes'

it.each(['changed', 'query_failure'])('actual anchorGate %s cannot be bypassed by a matching annotation hash', async mode => {
 const item = Object.keys(CURATED).find(id => currentItemTask(id))!
 expect(item).toBeTruthy()
 const live = currentItemTask(item)!, key = `${live.def.key}|${item}`
 const client = { from: () => ({ select() { return this }, eq() { return this }, maybeSingle: async () => mode === 'changed' ? { data: { passage: 'changed source fixture' }, error: null } : { data: null, error: { message: 'injected source read failure' } } }) } as unknown as NonNullable<Parameters<typeof anchorGate>[1]>
 const log = vi.spyOn(console, 'error').mockImplementation(() => {})
 try {
  expect(await anchorGate(item, client)).toBe(false)
  const hashes = await instrumentHashesFor([[live.def.key, item]], id => anchorGate(id, client))
  expect(hashes[key]).toBeNull()
 } finally { log.mockRestore() }
})
it('source gate is checked once per item; throws and false results affect only that item', async () => {
 const items = Object.keys(CURATED).filter(id => currentItemTask(id)).slice(0,3)
 expect(items).toHaveLength(3)
 const pairs = items.map(item => [currentItemTask(item)!.def.key, item] as const)
 const calls: string[] = []
 const hashes = await instrumentHashesFor([...pairs,...pairs], async item => { calls.push(item); if (item === items[1]) throw Error('source unavailable'); return item !== items[2] })
 expect(calls).toHaveLength(3)
 expect(hashes[`${pairs[0]![0]}|${items[0]}`]).toBeTruthy()
 expect(hashes[`${pairs[1]![0]}|${items[1]}`]).toBeNull()
 expect(hashes[`${pairs[2]![0]}|${items[2]}`]).toBeNull()
})
