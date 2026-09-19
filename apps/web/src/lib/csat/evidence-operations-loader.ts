// apps/web/src/lib/csat/evidence-operations-loader.ts
import 'server-only'
import { createCsatClient } from './client'
import { loadDissectionCatalog } from './dissect-catalog'
import { loadEvidence } from './evidence'
import type { OperationsData, ReadinessAudit } from './evidence-operations'

/** Admin entry points must authenticate first. Neither reads nor writes the learner process cache. */
export async function loadEvidenceOperations(): Promise<OperationsData> {
  const [evidence, dissection] = await Promise.allSettled([
    loadEvidence(),
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
  return { ...data, generatedAt: new Date().toISOString(), readiness, readinessError }
}
