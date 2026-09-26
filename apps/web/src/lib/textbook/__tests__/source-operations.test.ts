// apps/web/src/lib/textbook/__tests__/source-operations.test.ts
import { describe, expect, it } from 'vitest'
import { buildSourceMetrics, sourceNextAction, SOURCE_QUEUES, type SourceQueue, type SourceOperationRow } from '../source-operations'

const counts = Object.fromEntries((Object.keys(SOURCE_QUEUES) as SourceQueue[]).map(key => [key, 0])) as Record<SourceQueue, number>

describe('source operations contract', () => {
  it('defines denominator, provenance and scope for every displayed count', () => {
    const metrics = buildSourceMetrics({ ...counts, all: 100, eligible: 10, analyzed: 80, p0: 4 }, '2026-09-19T00:00:00Z')
    for (const key of Object.keys(SOURCE_QUEUES) as SourceQueue[]) {
      expect(metrics[key].denominator).toBe(100)
      expect(metrics[key].sourceOfTruth).toContain('csat_source_eligibility')
      expect(metrics[key].definition.length).toBeGreaterThan(15)
      expect(metrics[key].drilldownTarget).toContain(`queue=${key}`)
    }
    expect(metrics.analyzed.definition).toContain('적격이나 사용 가능과는 별개')
    expect(metrics.p0.definition).toContain('실제 노출의 증거가 아닙니다')
    expect(metrics.p0.severity).toBe('critical')
    expect(metrics.review.reasonBreakdown).toBeNull()
  })
  it('puts stale evidence and rejected linked items ahead of generic remediation', () => {
    const row = { linked_items: 3, quality_flags: ['browser-notice'], result: {
      blockers: ['content_rejected', 'excerpt_not_materialized'], status: 'rejected', analysisStatus: 'complete',
    } } as SourceOperationRow
    expect(sourceNextAction(row, true)).toMatchObject({ kind: 'automatic', what: '캐시 재검증 필요' })
    expect(sourceNextAction(row)).toMatchObject({ kind: 'review', what: '반려 원문·문항 연결 검토' })
    expect(sourceNextAction(row).impact).toContain('실제 학습·교재 노출 여부는 별도')
  })
})
