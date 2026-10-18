// apps/web/src/components/csat/diagnosis/map/__tests__/evidence-claims-independent.test.tsx
import { expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { evidenceView } from '@/lib/csat/map/v62/evidence-claims'
import { EvidenceBlock } from '../EvidenceClaims'

it('shared-passage notice preserves current per-item policy without claiming already-deduplicated observations', () => {
 const rows = [1,2].map(n => ({ attemptId: String(n), userId: 'u', itemRef: 'i'+n, taskKey: 'claim-support', phase: 'practice' as const, isCorrect: false, synthetic: true, helpLevel: 'independent', afterViewedFirst: false, afterExplanation: false, sessionId: 'fixture-session', contentHash: 'h', expectedContentHash: 'h', activity: 'theater', answeredAt: '2026-10-01T00:00:00Z' }))
 const e = evidenceView({ task: 'r.central_meaning', check: { taskKey: 'claim-support', status: 'verified', independentItems: 2, attemptedItems: 2, verifiedItems: ['i1','i2'], wrongItems: ['i1','i2'], unseen: [], examSeen: [], verifiedAt: '2026-10-01T00:00:00Z' }, firsts: rows, activity: rows.map(r => ({ ...r, contentHash: 'h', passageKey: 'shared', receivedAt: '2026-10-01T00:00:01Z' })), hashes: { 'claim-support|i1': 'h', 'claim-support|i2': 'h' }, transfer: { done: 0, planned: 2 } })
 expect(e.currentCheck.independentItems).toBe(2)
 expect(e.attempts.filter(a => a.claim === 'independent_check')).toHaveLength(2)
 const html = renderToStaticMarkup(<EvidenceBlock e={e} />)
 expect(html).toContain('현행 도구 독립 확인 집계에 2문항 포함')
 expect(html).toContain('첫 독립 관찰 중 맞힘 0 · 틀림 2')
 expect(html).toContain('별개 글의 독립 관찰로 해석하지 않아요')
 expect(html).not.toContain('서로 따로 센 확인이 아니에요')
})

it('shared helped attempts are not described as included independent observations', () => {
 const rows = [1,2].map(n => ({ attemptId: String(n), userId: 'u', itemRef: 'i'+n, taskKey: 'claim-support', phase: 'practice' as const, isCorrect: true, synthetic: true, helpLevel: 'viewed_first', afterViewedFirst: true, afterExplanation: false, sessionId: 'fixture-session', contentHash: 'h', expectedContentHash: 'h', activity: 'theater', answeredAt: '2026-10-01T00:00:00Z' }))
 const e = evidenceView({ task: 'r.central_meaning', check: null, firsts: rows, activity: rows.map(r => ({ ...r, contentHash: 'h', passageKey: 'shared', receivedAt: '2026-10-01T00:00:01Z' })), hashes: { 'claim-support|i1': 'h', 'claim-support|i2': 'h' }, transfer: { done: 0, planned: 2 } })
 expect(e.sharedPassageGroups).toHaveLength(1)
 expect(e.attempts.filter(a => a.claim === 'independent_check')).toHaveLength(0)
 expect(renderToStaticMarkup(<EvidenceBlock e={e} />)).toContain('현행 도구 독립 확인 집계에 0문항 포함')
})

it('a stale current instrument does not erase an independently observed historical first outcome', () => {
 const first = { attemptId: '1', userId: 'u', itemRef: 'i1', taskKey: 'claim-support', phase: 'practice' as const, isCorrect: false, synthetic: true, helpLevel: 'independent', afterViewedFirst: false, afterExplanation: false, sessionId: 'fixture-session', contentHash: 'old', expectedContentHash: 'new', activity: 'theater', answeredAt: '2026-10-01T00:00:00Z' }
 const e = evidenceView({ task: 'r.central_meaning', check: null, firsts: [first], activity: [{ ...first, contentHash: 'old', receivedAt: '2026-10-01T00:00:01Z' }], hashes: { 'claim-support|i1': 'new' }, transfer: { done: 0, planned: 2 } })
 expect(e.attempts[0]!.claim).toBe('performed_only')
 const html = renderToStaticMarkup(<EvidenceBlock e={e} />)
 expect(html).toContain('현행 도구 독립 확인 문항 0개')
 expect(html).toContain('기록에서 확인된 독립 첫 관찰 1개')
 expect(html).toContain('첫 독립 관찰 중 맞힘 0 · 틀림 1')
})
