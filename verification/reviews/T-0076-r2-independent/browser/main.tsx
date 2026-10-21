import { createRoot } from 'react-dom/client'
import { EvidenceBlock } from '@/components/csat/diagnosis/map/EvidenceClaims'
import { evidenceView } from '@/lib/csat/map/v62/evidence-claims'

const task = 'r.central_meaning' as const, key = 'authored-central-meaning', v = '2026-10-01T00:00:00Z', after = '2026-10-02T00:00:00Z'
const check = { taskKey: key, status: 'verified', independentItems: 2, attemptedItems: 2, verifiedItems: ['authored:probe-ind-1', 'authored:probe-ind-2'], wrongItems: ['authored:probe-ind-1', 'authored:probe-ind-2'], unseen: [], examSeen: [], verifiedAt: v }
const row = (o: Record<string, unknown> = {}) => ({ attemptId: '3', sessionId: 's3', itemRef: 'authored:probe-guide', taskKey: key, phase: 'practice', activity: 'practice', isCorrect: true, answeredAt: after, receivedAt: after, helpLevel: 'viewed_first', synthetic: false, repairRole: 'guided_practice', contentHash: 'h', ...o })
const first = { attemptId: '1', sessionId: 's1', userId: 'fixture', taskKey: key, itemRef: 'authored:probe-ind-1', phase: 'practice', activity: 'theater', isCorrect: false, answeredAt: v, helpLevel: 'independent', synthetic: false, afterViewedFirst: false, afterExplanation: false, contentHash: 'h', expectedContentHash: 'h' }
const f2 = { ...first, attemptId: '2', sessionId: 's2', itemRef: 'authored:probe-ind-2' }
const firstRows = [first, f2].map((f) => row({ ...f, receivedAt: v, repairRole: undefined }))
const view = (a: unknown[] | undefined, o: Record<string, unknown> = {}) => evidenceView({ task, check: check as never, firsts: [first, f2], activity: a, hashes: {}, transfer: { done: 0, planned: 2 }, ...o } as never)
const kc = { ...check, taskKey: 'claim-support', verifiedItems: ['M2609#20'], wrongItems: ['M2609#20'] }
const STATES: [string, ReturnType<typeof evidenceView>][] = [
  ['guided-wrong', view([...firstRows, row({ isCorrect: false })])],
  ['guided-right', view([...firstRows, row({ isCorrect: false, attemptId: '4' }), row({ answeredAt: '2026-10-03T00:00:00Z', receivedAt: '2026-10-03T00:00:00Z' })])],
  ['authored-direct', view(firstRows)],
  ['authored-replay', view([...firstRows, row({ attemptId: '5', itemRef: 'authored:probe-ind-1', activity: 'theater', repairRole: undefined, helpLevel: 'independent' })])],
  ['kice-retry', evidenceView({ task, check: kc as never, firsts: [], activity: [row({ itemRef: 'M2609#20', taskKey: 'claim-support', activity: 'theater', repairRole: undefined })], hashes: {}, transfer: { done: 0, planned: 2 } } as never)],
  ['ledger-unknown', view(undefined)],
]
createRoot(document.getElementById('root')!).render(
  <div style={{ padding: 16, display: 'grid', gap: 16, maxWidth: 520 }}>
    {STATES.map(([id, e]) => (
      <section key={id} data-state={id} aria-labelledby={`h-${id}`} style={{ border: '1px solid #ddd', padding: 12 }}>
        <h3 id={`h-${id}`} tabIndex={0}>기록으로 말할 수 있는 것 — {id}</h3>
        <EvidenceBlock e={e} />
      </section>
    ))}
  </div>,
)
