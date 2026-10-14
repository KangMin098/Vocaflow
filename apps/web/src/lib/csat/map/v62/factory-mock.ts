// apps/web/src/lib/csat/map/v62/factory-mock.ts
//
// v6.2 — 연계 계약 시험용 **mock 교재공장**. 실제 공장(드레인 · 조판)을 부르지 않고, 콘텐츠를 만들지 않는다.
// 응답은 모두 mode 'MOCK' · provenance.mock = true — 계약 시험 밖에서 쓰지 않는다. 산출물 id 는 `mock-` 로 시작해 실제 id 와 겹치지 않는다.
import { createHash } from 'node:crypto'

import { FACTORY_MANIFEST_SCHEMA, type FactoryRequest, type FactoryResultManifest, type ManifestArtifact } from './factory-integration'

export type MockScenario =
  | 'test_fixture' // 기존 테스트성 교재처럼 — 생성은 됐으나 제품 아님
  | 'produced_unreviewed' // 생성 완료 · 품질 미검수
  | 'review_failed' // 공장 검수 실패
  | 'unsupported_unit' // 요청 단위 미지원
  | 'factory_failed' // 생산 실패

const h = (s: string) => createHash('sha256').update(s).digest('hex')

function artifact(req: FactoryRequest, k: number, over: Partial<ManifestArtifact> = {}): ManifestArtifact {
  const id = `mock-${req.requestId.slice(0, 8)}-${k}`
  return {
    id, kind: 'dcp_item', revision: 'mock-r1', sha256: h(id), refs: { source: null, analysis: null, gold: null },
    contentType: req.content.factoryTypes[0] ?? 'unknown', tasks: [req.task], roleCandidates: [req.role], access: `mock://${id}`,
    rights: 'unknown', quality: 'unreviewed', provenance: { runId: null, mock: true }, lifecycle: 'product', ...over,
  }
}

export function mockFactory(req: FactoryRequest, scenario: MockScenario): FactoryResultManifest {
  const base = { schema: FACTORY_MANIFEST_SCHEMA, requestId: req.requestId, mode: 'MOCK' as const, runId: null, factory: { name: 'mock-factory', version: '0' } }
  // 공장이 실제로 지원하지 않는 단위면 어떤 시나리오든 미지원으로 답한다(지원하는 척하지 않는다)
  if (req.productionUnit.support !== 'convertible_to_volume' || scenario === 'unsupported_unit') {
    return { ...base, status: 'unsupported', producedCount: 0, artifacts: [], failure: { code: `production_unit_${req.productionUnit.support === 'convertible_to_volume' ? 'unsupported' : req.productionUnit.support}`, reason: req.productionUnit.why } }
  }
  const n = Math.min(req.quantity.n, 3)
  switch (scenario) {
    case 'factory_failed':
      return { ...base, status: 'failed', producedCount: 0, artifacts: [], failure: { code: 'generation_failed', reason: 'mock' } }
    case 'test_fixture': {
      const arts = Array.from({ length: n }, (_, k) => artifact(req, k, { lifecycle: 'test_fixture', quality: 'passed' }))
      return { ...base, status: 'produced', producedCount: arts.length, artifacts: arts, failure: null }
    }
    case 'produced_unreviewed': {
      const arts = Array.from({ length: n }, (_, k) => artifact(req, k))
      return { ...base, status: 'review_pending', producedCount: arts.length, artifacts: arts, failure: null }
    }
    case 'review_failed': {
      const arts = Array.from({ length: n }, (_, k) => artifact(req, k, { quality: 'failed' }))
      return { ...base, status: 'review_failed', producedCount: arts.length, artifacts: arts, failure: null }
    }
  }
}
