// apps/web/src/lib/knowledge/__tests__/decision-log.test.ts
// 결정 기록 — 같은 근거의 같은 결정은 같은 fingerprint · 근거가 바뀌면 다른 fingerprint
import { describe, expect, it, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase/admin', () => ({ createAdminClient: () => ({}) }))

import { decisionFingerprint } from '../decision-log-server'
import { findOutcome } from '../find-outcome'
import { decideStep } from '../learning-decision'

const CHAIN = { task: { id: 't', slug: 't', version: 1 }, method: { id: 'm', slug: 'm', version: 1 }, principle: { id: 'p', slug: 'p', version: 1 } }
const confirm = ['2022#20', '2025#20', '2016#20'].map((itemRef) => ({ itemRef, href: itemRef, label: itemRef }))
const row = (itemRef: string, isCorrect: boolean) => ({ itemRef, taskKey: 'claim-support', userId: 'u', phase: 'practice' as const, isCorrect, synthetic: true, helpLevel: 'independent', afterViewedFirst: false, afterExplanation: false })
const decide = (rows: ReturnType<typeof row>[], chain = CHAIN) =>
  decideStep({ stepKey: 'structure', findTaskId: 'B6-3', outcome: findOutcome(confirm.map((c) => ({ itemRef: c.itemRef, taskKey: 'claim-support' })), rows), chain, confirm, triedItems: rows.map((r) => r.itemRef), practiceHref: '/csat/practice/claim-support' })
const app = { id: 'a', version: 1, audience: {} }

describe('decisionFingerprint', () => {
  it('같은 근거 → 같은 값(화면을 다시 열어도 한 번만 기록)', () => {
    const rows = [row('2022#20', false), row('2025#20', false)]
    expect(decisionFingerprint({ decision: decide(rows), application: app })).toBe(decisionFingerprint({ decision: decide(rows), application: app }))
  })
  it('관찰 · 원리 버전 · 적용 버전이 바뀌면 새 기록', () => {
    const base = decisionFingerprint({ decision: decide([row('2022#20', false), row('2025#20', false)]), application: app })
    expect(decisionFingerprint({ decision: decide([row('2022#20', false), row('2025#20', true)]), application: app })).not.toBe(base)
    expect(decisionFingerprint({ decision: decide([row('2022#20', false), row('2025#20', false)], { ...CHAIN, method: { ...CHAIN.method, version: 2 } }), application: app })).not.toBe(base)
    expect(decisionFingerprint({ decision: decide([row('2022#20', false), row('2025#20', false)]), application: { ...app, version: 2 } })).not.toBe(base)
  })
})

describe('재확인 근거도 fingerprint 에 들어간다', () => {
  it('첫 처방과 「재확인 실패 뒤 재연습」은 다른 기록', () => {
    const first = decide([row('2022#20', false), row('2025#20', false)])
    const after = decide([
      { ...row('2022#20', false), answeredAt: '2026-10-10T01:00:00Z', activity: 'theater' },
      { ...row('2025#20', false), answeredAt: '2026-10-10T01:01:00Z', activity: 'theater' },
      { ...row('2025#20', false), isCorrect: null as unknown as boolean, answeredAt: '2026-10-10T02:00:00Z', activity: 'practice' },
      { ...row('2016#20', false), answeredAt: '2026-10-10T03:00:00Z', activity: 'theater' },
    ] as unknown as ReturnType<typeof row>[])
    expect(after.action).toBe('practice_method')
    expect(decisionFingerprint({ decision: after, application: app })).not.toBe(decisionFingerprint({ decision: first, application: app }))
  })
})
