// apps/web/src/lib/csat/authored/evidence.ts
// FINAL §8 — 창작 자료 첫 시도를 지도 근거로 읽는 규칙(순수). load.ts 와 종단 시험이 같은 함수를 쓴다.
//
// 기출 확인 과제는 코드의 채점 주석 hash 를 「기대 hash」로 대조한다(attemptRole). 창작 자료의 채점 주석은 DB 행이라 코드에 없다 —
// 대신 **DB 결속 원장(workspace_delivery_attempt)** 이 시도 hash = 자격 주석 hash = 현재 Gold hash, 첫 노출, 도움 상태를 이미 판정했다.
// 그래서: 결속이 근거로 센 시도만 기대 hash = 결속 hash(DB 검증값)로 두어 독립 시도 자격을 얻게 하고,
// 결속이 없거나 비근거인 시도는 도움 받은 시도로 바꿔 직접 확인에서 뺀다(기록은 그대로 남는다). 결속 조회 실패 = 비근거(fail-closed).
import type { FindAttemptRow } from '@/lib/knowledge/find-outcome'
import { isAuthoredRef } from '@/lib/knowledge/authored/authored-items'

export interface AuthoredBinding { attemptId: string; evidence: boolean; annotationHash: string; sessionId: string }

export function applyAuthoredBindings(rows: readonly FindAttemptRow[], bindings: readonly AuthoredBinding[] | null): FindAttemptRow[] {
  const ok = new Map((bindings ?? []).filter((b) => b.evidence).map((b) => [b.attemptId, b]))
  return rows.map((r) => {
    if (!isAuthoredRef(r.itemRef)) return r
    const b = r.attemptId ? ok.get(r.attemptId) : undefined
    if (!b || r.contentHash !== b.annotationHash || (r.sessionId && r.sessionId !== b.sessionId)) {
      return { ...r, helpLevel: 'viewed_first', afterViewedFirst: true }
    }
    return { ...r, sessionId: b.sessionId, expectedContentHash: b.annotationHash }
  })
}
