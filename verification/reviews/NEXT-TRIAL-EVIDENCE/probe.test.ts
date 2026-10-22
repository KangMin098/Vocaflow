import { describe, expect, it } from 'vitest'
import { opsSummary } from 'D:/workspace/Vocaflow-main-serving/apps/web/src/lib/knowledge/vnext-rules'

const app = (trials: unknown[]) => ({ id: 'a', itemId: 'i', status: 'active' as const, surfaceRef: 'fixture', statusReason: null, trials })
function verification(trials: unknown[]) {
  return opsSummary({ items: [], evidence: [], inquiries: [], applications: [app(trials) as Parameters<typeof opsSummary>[0]['applications'][number]], openGaps: 0 }).stages.find(s => s.key === 'verification')!
}
describe('actual main opsSummary, no DB or learner records', () => {
  it('recalculation-required analyzed trial is not current analysis evidence', () => {
    expect(verification([{ status: 'analyzed', synthetic: false, result: 'supported', reviewRequiredAt: '2026-10-22T00:00:00Z' }]).value).toBe(0)
  })
  it('non-synthetic metadata alone does not identify real learners', () => {
    expect(verification([{ status: 'analyzed', synthetic: false, result: 'inconclusive', reviewRequiredAt: null }]).note).not.toContain('실제 학습자')
  })
  it('synthetic analyzed trial remains excluded', () => {
    expect(verification([{ status: 'analyzed', synthetic: true, result: 'supported', reviewRequiredAt: null }]).value).toBe(0)
  })
  it('current analyzed non-synthetic row may remain a descriptive analysis count', () => {
    expect(verification([{ status: 'analyzed', synthetic: false, result: 'inconclusive', reviewRequiredAt: null }]).value).toBe(1)
  })
})
