// apps/web/src/lib/csat/map/v62/__tests__/instrument-currentness-independent.test.ts
import { afterEach, expect, it, vi } from 'vitest'
import * as skeleton from '@/lib/csat/skeleton'
import { annotatedItemIds } from '@/lib/knowledge/claim-support'
import { instrumentHashesFor } from '../instrument-hashes'
afterEach(() => { vi.restoreAllMocks() })
it('an annotation left behind after its skeleton disappears is not a current usable instrument', () => {
 const item = annotatedItemIds()[0]!
 vi.spyOn(skeleton, 'loadItemSkeleton').mockReturnValue(null)
 expect(instrumentHashesFor([['claim-support', item]])[`claim-support|${item}`]).toBeNull()
})
it('a skeleton/annotation signature mismatch cannot become confirmed by matching only annotation hash', () => {
 const item = annotatedItemIds()[0]!, original = skeleton.loadItemSkeleton(item)!
 const changed = structuredClone(original)
 changed.sentences[0]!.chars += 1
 vi.spyOn(skeleton, 'loadItemSkeleton').mockReturnValue(changed)
 expect(instrumentHashesFor([['claim-support', item]])[`claim-support|${item}`]).toBeNull()
})
