// apps/web/src/lib/vcb/types.ts
// vcb-curate-core 의 타입을 단일 진실 소스로 삼고 re-export.
// P5a 컴포넌트들이 사용하는 Vcb* alias 는 backwards-compat 유지.

export type {
  RunStatus,
  QueueStatus,
  SeedOrigin,
  Pos,
  Cefr,
  Segment,
  RunSummary,
  RunDetail,
  RunConfig,
  QueueListItem,
  QueueDetail,
  QueuePayload,
  DefinitionKo,
  DefinitionEn,
  ExamplePair,
  DecisionHistoryEntry,
  CurationDecisionKind,
  CurationFilter,
  CurationSort,
  PrecheckResult,
  PrecheckStats,
} from '@vocaflow/vcb-curate-core'

import type {
  RunSummary as _RunSummary,
  RunDetail as _RunDetail,
  QueueListItem as _QueueListItem,
  QueueDetail as _QueueDetail,
  CurationDecisionKind as _CurationDecisionKind,
} from '@vocaflow/vcb-curate-core'

// P5a 컴포넌트 backwards-compat aliases
export type VcbRunSummary = _RunSummary
export type VcbRunDetail = _RunDetail
export type VcbQueueListItem = _QueueListItem
export type VcbQueueDetail = _QueueDetail
export type CurationDecision = _CurationDecisionKind

export interface ServerActionResult<T = unknown> {
  ok: boolean
  data?: T
  error?: string
}
