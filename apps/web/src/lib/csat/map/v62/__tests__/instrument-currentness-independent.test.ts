// apps/web/src/lib/csat/map/v62/__tests__/instrument-currentness-independent.test.ts
import { afterEach, expect, it, vi } from 'vitest'
import * as skeleton from '@/lib/csat/skeleton'
import { annotatedItemIds } from '@/lib/knowledge/claim-support'
import { instrumentHashesFor } from '../instrument-hashes'
afterEach(() => { vi.restoreAllMocks() })
it('an annotation left behind after its skeleton disappears is not a current usable instrument', async () => {
 const item = annotatedItemIds()[0]!
 vi.spyOn(skeleton, 'loadItemSkeleton').mockReturnValue(null)
 expect((await instrumentHashesFor([['claim-support', item]], async () => true))[`claim-support|${item}`]).toBeNull()
})
it('a skeleton/annotation signature mismatch cannot become confirmed by matching only annotation hash', async () => {
 const item = annotatedItemIds()[0]!, original = skeleton.loadItemSkeleton(item)!
 const changed = structuredClone(original)
 changed.sentences[0]!.chars += 1
 vi.spyOn(skeleton, 'loadItemSkeleton').mockReturnValue(changed)
 expect((await instrumentHashesFor([['claim-support', item]], async () => true))[`claim-support|${item}`]).toBeNull()
})
