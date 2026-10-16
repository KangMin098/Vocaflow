// apps/web/src/lib/csat/map/v62/__tests__/instrument-hashes.test.ts
import { expect, it } from 'vitest'
import { annotatedItemIds } from '@/lib/knowledge/claim-support'
import { taskByKey } from '@/lib/knowledge/item-tasks'
import { instrumentHashesFor } from '../instrument-hashes'

it('over 1000 repeated rows call the actual registry annotation/hash once per task/item', () => {
 const keys = ['claim-support', 'cohesion-link', 'option-restate', 'evidence-locate']
 const items = annotatedItemIds().slice(0, 6)
 const pairs = Array.from({ length: 12001 }, (_, i) => [keys[i % keys.length]!, items[Math.floor(i / keys.length) % items.length]!] as const)
 const calls: Record<string, number> = {}, hashCalls: Record<string, number> = {}
 const result = instrumentHashesFor(pairs, key => {
  const def = taskByKey(key); if (!def) return null
  return { annotationFor: item => { const p = `${key}|${item}`; calls[p] = (calls[p] ?? 0) + 1; return def.annotationFor(item) }, hash: ann => { hashCalls[key] = (hashCalls[key] ?? 0) + 1; return def.hash(ann) } }
 })
 expect(Object.keys(result)).toHaveLength(24)
 expect(Object.values(calls)).toEqual(Array(24).fill(1))
 expect(Object.values(hashCalls).reduce((a,b) => a+b,0)).toBe(Object.values(result).filter(Boolean).length)
})
it('one missing, failed lookup or failed hash leaves only that item unknown', () => {
 const items = annotatedItemIds().slice(0, 3), errors: string[] = []
 const def = taskByKey('claim-support')!
 const result = instrumentHashesFor(items.map(item => ['claim-support', item] as const), () => ({
  annotationFor: item => { if (item === items[1]) throw Error('injected annotation failure'); return def.annotationFor(item) },
  hash: ann => def.hash(ann),
 }), key => errors.push(key))
 expect(result[`claim-support|${items[0]}`]).toBeTruthy()
 expect(result[`claim-support|${items[1]}`]).toBeNull()
 expect(result[`claim-support|${items[2]}`]).toBeTruthy()
 expect(errors).toHaveLength(1)
 expect(instrumentHashesFor([['absent', 'item']])).toEqual({ 'absent|item': null })
 const thrown = instrumentHashesFor([['claim-support', items[0]!]], () => ({ annotationFor: def.annotationFor, hash: () => { throw Error('hash failed') } }))
 expect(thrown[`claim-support|${items[0]}`]).toBeNull()
})
it('suffix shares the same annotation cache; a new request recalculates current annotations', () => {
 const item = annotatedItemIds()[0]!, pairs = [['claim-support', item], ['claim-support-skeleton', item]] as const
 let n = 0
 const lookup = () => ({ annotationFor: taskByKey('claim-support')!.annotationFor, hash: () => String(++n) })
 expect(instrumentHashesFor(pairs, lookup)).toEqual({ [`claim-support|${item}`]: '1' })
 expect(instrumentHashesFor(pairs, lookup)).toEqual({ [`claim-support|${item}`]: '2' })
})
