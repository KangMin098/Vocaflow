// apps/web/src/lib/textbook/source-operations.ts
import type { FinalSourceEligibility, SourceEligibilityInput } from '@vocaflow/library-pipeline'

export const SOURCE_QUEUES = {
  all: '전체 후보', eligible: '적격', conditional: '조건부', review: '검토 필요', rejected: '사용 불가',
  content: '내용 검토', analysis: '분석 미완', cefr: 'CEFR 초과', excerpt: '발췌 미완',
  quality: '본문 품질 검토', p0: '반려 원문 · 문항 연결',
  analyzed: '분석 완료', unavailable: '학습·교재 사용 대기',
  stale: '캐시 재검증',
} as const
export type SourceQueue = keyof typeof SOURCE_QUEUES
export const SOURCE_REASON_LABELS: Record<string, string> = {
  source_not_ready: '사용 준비 상태가 아님', content_rejected: '내용 반려', harmful_genre: '학습용 부적합 소재',
  analysis_missing: '필수 분석 누락', analysis_invalid: '분석값 유효성 오류', content_unjudged: '내용 판정 필요',
  raw_content_unjudged: '미절단 원문 — 발췌 후 내용 판정 필요', cefr_above_band: '해당 학령 CEFR 상한 초과',
  excerpt_not_materialized: '사용할 발췌 문항이 없음', publication_gate_missing: '게시 게이트 미기록',
  base_legal: '라이선스 제한', base_safety: '철회·민감 소재', base_gate: '게시 게이트 제한',
  base_analysis: '분석 보완', base_judgement: '내용 검토', base_format: '지문 규격 미충족', base_vocabulary: '어휘 난도 초과',
  source_quality_unreviewed: '본문 신호는 검토 후보이며 자동 반려가 아님', vocabulary_unmeasured: '어휘 축 미측정',
  legacy_license_unrecorded: '기존 자료의 라이선스 기록 보완 필요', item_integrity_required: '문항 지문·위치·검수 확인 필요',
  source_pass: '원문 정책 통과', source_pass_item_checks_required: '원문 정책 통과 — 문항별 검증 필요',
}
export interface SourceOperationRow {
  article_id: string
  source: string
  source_updated_at: string
  policy_version: number
  input: SourceEligibilityInput
  result: FinalSourceEligibility
  quality_flags: string[]
  excerpt_evidence: { windows: number; invalidRanges: number | null; approved: boolean; contentRevisionRecorded: boolean }
  linked_items: number
  measured_at: string | null
}
/** Live source metadata joined to an optional, revision-checked cache. */
export interface SourceOperationListRow {
  article_id: string
  source: string
  current_title: string
  current_v_level: number | null
  current_cefr: string | null
  cache_state: 'current' | 'stale' | 'missing'
  effective_status: FinalSourceEligibility['status']
  can_use: boolean
  linked_items: number | null
  result: FinalSourceEligibility | null
}
export interface SourceInspectorData {
  row: SourceOperationRow
  current: FinalSourceEligibility
  currentInput: SourceEligibilityInput
  stale: boolean
  content: string
  sourceUrl: string | null
  windows: unknown[]
  items: Array<{ id: string; type: string; paragraph_idx: number }>
  linkedItems: number
  attempts: number | null
  renders: Array<{ series: string; band: number; rendered_at: string }>
  historicalRendersUnknown: boolean
  history: Array<{ id: number; replaced_at: string; previous: Record<string, unknown> }>
}
