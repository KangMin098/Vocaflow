// apps/web/src/lib/csat/evidence-operations-loader.ts
import 'server-only'
import { createCsatClient } from './client'
import { loadDissectionCatalog } from './dissect-catalog'
import { loadEvidence } from './evidence'
import type { OperationsData, ReadinessAudit } from './evidence-operations'
import { KICE_SCOPE, type EvidenceScope } from './evidence-fold'
import { loadHakpyeongReview } from './hakpyeong-review-loader'

/** Admin entry points must authenticate first. Neither reads nor writes the learner process cache. */
export async function loadEvidenceOperations(scope: EvidenceScope = KICE_SCOPE): Promise<OperationsData> {
  // 학평은 학습자 배포 대상이 아니다 — 준비도(해부 카탈로그 대조)를 재지 않는다
  if (scope.set !== 'kice') {
    const data = await loadEvidence(scope).catch((e: unknown) => ({
      items: [], exams: [], types: [], generatedAt: '',
      loadError: e instanceof Error ? e.message : '데이터를 읽지 못했습니다.',
    }))
    // 학평 독립 검수 모니터 — 읽기 실패는 review.error 로 화면에 드러난다(0건으로 삼키지 않는다)
    const review = data.loadError ? null : await loadHakpyeongReview(scope.grade, data.items.map((i) => ({ id: i.id, typeId: i.typeId })))
    return { ...data, generatedAt: new Date().toISOString(), readiness: null, readinessError: null, scope, review }
  }
  const [evidence, dissection] = await Promise.allSettled([
    loadEvidence(scope),
    Promise.resolve().then(() => loadDissectionCatalog({ db: createCsatClient(), fresh: true })),
  ])
  const error = (reason: unknown) =>
    reason instanceof Error ? reason.message : '데이터를 읽지 못했습니다.'
  const data =
    evidence.status === 'fulfilled'
      ? evidence.value
      : {
          items: [],
          exams: [],
          types: [],
          generatedAt: '',
          loadError: error(evidence.reason),
        }
  let readiness: ReadinessAudit | null =
    dissection.status === 'fulfilled'
      ? {
          ...dissection.value.audit,
          readyIds: dissection.value.items.map((i) => i.id),
        }
      : null
  let readinessError = dissection.status === 'rejected' ? error(dissection.reason) : null
  if (readiness && !data.loadError) {
    const ids = new Set([...readiness.readyIds, ...readiness.excluded.map((i) => i.id)])
    if (
      readiness.total !== data.items.length ||
      readiness.readyIds.length + readiness.excluded.length !== readiness.total ||
      ids.size !== data.items.length ||
      data.items.some((i) => !ids.has(i.id))
    ) {
      readinessError = '원천과 학습자 조회의 문항 범위가 다릅니다. 다시 검증해 주세요.'
      readiness = null
    }
  }
  return { ...data, generatedAt: new Date().toISOString(), readiness, readinessError, scope }
}
