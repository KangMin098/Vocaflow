// apps/web/src/components/csat/diagnosis/map/__tests__/evidence-claims-independent.test.tsx
import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { evidenceView } from '@/lib/csat/map/v62/evidence-claims'
import { EvidenceBlock } from '../EvidenceClaims'

it('shared-passage notice preserves current per-item policy without claiming already-deduplicated observations', () => {
 const rows = [1,2].map(n => ({ attemptId: String(n), userId: 'u', itemRef: 'i'+n, taskKey: 'claim-support', phase: 'practice' as const, isCorrect: false, synthetic: true, helpLevel: 'independent', afterViewedFirst: false, afterExplanation: false, activity: 'theater', answeredAt: '2026-10-01T00:00:00Z' }))
 const e = evidenceView({ task: 'r.central_meaning', check: { taskKey: 'claim-support', status: 'verified', independentItems: 2, attemptedItems: 2, verifiedItems: ['i1','i2'], wrongItems: ['i1','i2'], unseen: [], examSeen: [], verifiedAt: '2026-10-01T00:00:00Z' }, firsts: rows, activity: rows.map(r => ({ ...r, contentHash: 'h', passageKey: 'shared', receivedAt: '2026-10-01T00:00:01Z' })), hashes: { 'claim-support|i1': 'h', 'claim-support|i2': 'h' }, transfer: { done: 0, planned: 2 } })
 expect(e.currentCheck.independentItems).toBe(2)
 expect(e.attempts.filter(a => a.claim === 'independent_check')).toHaveLength(2)
 const html = renderToStaticMarkup(<EvidenceBlock e={e} />)
 expect(html).toContain('현재 문항 수에는 포함')
 expect(html).toContain('첫 독립 관찰 중 맞힘 0 · 틀림 2')
 expect(html).toContain('별개 글의 독립 관찰로 해석하지 않아요')
 expect(html).not.toContain('서로 따로 센 확인이 아니에요')
})
