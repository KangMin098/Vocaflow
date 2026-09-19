// apps/web/src/lib/csat/__tests__/evidence-operations-loader.test.ts
import { beforeEach, expect, it, vi } from 'vitest'
const { evidence, dissection, client } = vi.hoisted(() => ({
  evidence: vi.fn(),
  dissection: vi.fn(),
  client: {},
}))
vi.mock('server-only', () => ({}))
vi.mock('../client', () => ({ createCsatClient: () => client }))
vi.mock('../evidence', () => ({ loadEvidence: evidence }))
vi.mock('../dissect-catalog', () => ({ loadDissectionCatalog: dissection }))
import { loadEvidenceOperations } from '../evidence-operations-loader'

beforeEach(() => {
  evidence
    .mockReset()
    .mockResolvedValue({ items: [{ id: '2026#31' }], exams: [], types: [], loadError: null })
  dissection
    .mockReset()
    .mockResolvedValue({
      items: [{ id: '2026#31' }],
      audit: { total: 1, fields: {}, excluded: [] },
    })
})
it('관리자 권한의 fresh 조회를 사용하고 학습자 캐시를 재사용하지 않는다', async () => {
  const result = await loadEvidenceOperations()
  expect(dissection).toHaveBeenCalledWith({ db: client, fresh: true })
  expect(result.readiness?.readyIds).toEqual(['2026#31'])
  expect(result.readinessError).toBeNull()
  expect(Number.isNaN(Date.parse(result.generatedAt))).toBe(false)
})
it('문항 수가 같아도 두 원장의 ID가 다르면 배포 판정을 보류한다', async () => {
  dissection.mockResolvedValue({
    items: [{ id: '2026#32' }],
    audit: { total: 1, fields: {}, excluded: [] },
  })
  const result = await loadEvidenceOperations()
  expect(result.readiness).toBeNull()
  expect(result.readinessError).toContain('문항 범위')
})
it('읽기 실패를 준비 0건으로 치환하지 않고 원천 진단은 유지한다', async () => {
  dissection.mockRejectedValue(new Error('unavailable'))
  const result = await loadEvidenceOperations()
  expect(result.items).toHaveLength(1)
  expect(result.readiness).toBeNull()
  expect(result.readinessError).toBe('unavailable')
})
it('원천 조회 실패도 명시적인 오류가 된다', async () => {
  evidence.mockRejectedValue(new Error('source unavailable'))
  expect((await loadEvidenceOperations()).loadError).toBe('source unavailable')
})
