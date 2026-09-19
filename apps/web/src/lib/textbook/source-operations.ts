// apps/web/src/lib/textbook/source-operations.ts
import type { FinalSourceEligibility, SourceEligibilityInput } from '@vocaflow/library-pipeline'

export const SOURCE_QUEUES = {
  all: '전체 후보', eligible: '적격', conditional: '조건부', review: '검토 필요', rejected: '사용 불가',
  content: '내용 검토', raw: '미절단 원본', analysis: '분석 미완', cefr: 'CEFR 초과', excerpt: '발췌 미완',
  quality: '본문 품질 검토', p0: '반려 원문 · 문항 연결',
  analyzed: '분석 완료', unavailable: '학습·교재 사용 대기',
} as const
export type SourceQueue = keyof typeof SOURCE_QUEUES
export const SOURCE_BREAKDOWN_REASONS = [
  'content_unjudged', 'raw_content_unjudged', 'cefr_above_band', 'excerpt_not_materialized',
  'source_not_ready', 'analysis_missing', 'analysis_invalid', 'content_rejected',
  'publication_gate_missing', 'harmful_genre', 'base_legal', 'base_safety',
] as const
export type SourceBreakdownReason = typeof SOURCE_BREAKDOWN_REASONS[number]
export const isSourceBreakdownReason = (value: string): value is SourceBreakdownReason =>
  (SOURCE_BREAKDOWN_REASONS as readonly string[]).includes(value)

export type SourceActionKind = 'automatic' | 'batch' | 'review' | 'investigate' | 'blocked'
export interface SourceWorkItem {
  id: string
  queue: SourceQueue
  reason?: SourceBreakdownReason
  priority: 'P0' | 'P1' | 'P2'
  kind: SourceActionKind
  title: string
  count: number
  why: string
  next: string
  verify: string
  dependency: string
}
type SourceCounts = Record<SourceQueue, number>
export interface SourceMetric {
  name: string
  value: number
  denominator: number
  definition: string
  sourceOfTruth: string
  status: 'ready' | 'attention' | 'blocked' | 'context'
  severity: 'critical' | 'high' | 'normal' | 'none'
  reasonBreakdown: null
  recommendedActions: string[]
  drilldownTarget: string
  lastCalculatedAt: string | null
}
const METRIC_DEFINITION: Record<SourceQueue, Pick<SourceMetric, 'definition' | 'status' | 'severity' | 'recommendedActions'>> = {
  all: { definition: '파생 정책 캐시에 저장된 원문 전체. 원천 재고와 측정 범위가 다를 수 있습니다.', status: 'context', severity: 'none', recommendedActions: [] },
  eligible: { definition: '원문 정책을 그대로 통과한 편수. 문항별 검증과 실제 사용은 포함하지 않습니다.', status: 'ready', severity: 'none', recommendedActions: [] },
  conditional: { definition: '원문 정책은 통과했지만 발췌 문항의 지문·위치·검증이 필요한 편수.', status: 'attention', severity: 'normal', recommendedActions: ['item-integrity'] },
  review: { definition: '검토·보완 후 재판정이 필요한 원문. 여러 사유가 한 원문에 겹칩니다.', status: 'attention', severity: 'high', recommendedActions: ['analysis', 'judgment', 'excerpt'] },
  rejected: { definition: '현재 정책에서 학습·교재 사용이 차단된 원문. 영구 제한과 변경 가능한 사유가 섞입니다.', status: 'blocked', severity: 'high', recommendedActions: ['linked-rejected'] },
  content: { definition: '내용 판정이 없는 원문. 미절단 원본과 다른 차단 사유도 포함합니다.', status: 'attention', severity: 'normal', recommendedActions: ['judgment', 'raw'] },
  raw: { definition: '미절단 원본이며 내용 판정이 없는 원문. 발췌·파생 경로가 먼저 필요합니다.', status: 'blocked', severity: 'normal', recommendedActions: ['raw'] },
  analysis: { definition: '필수 분석 필드가 누락되거나 유효하지 않은 원문.', status: 'attention', severity: 'high', recommendedActions: ['analysis'] },
  cefr: { definition: '현재 학령의 CEFR 상한을 넘은 원문. 임의 하향 판정 대상이 아닙니다.', status: 'blocked', severity: 'normal', recommendedActions: [] },
  excerpt: { definition: '긴 원문에 사용할 문항 지문이 없거나 후보 창만 있는 원문.', status: 'attention', severity: 'normal', recommendedActions: ['excerpt'] },
  quality: { definition: '본문 추출 품질 신호가 하나 이상 있는 원문. 오탐을 포함하며 자동 반려 사유가 아닙니다.', status: 'attention', severity: 'high', recommendedActions: ['quality'] },
  p0: { definition: '내용 반려 원문에 문항이 하나 이상 연결된 편수. 연결은 실제 노출의 증거가 아닙니다.', status: 'blocked', severity: 'critical', recommendedActions: ['linked-rejected'] },
  analyzed: { definition: '정책에 필요한 분석 필드가 모두 유효한 원문. 적격이나 사용 가능과는 별개입니다.', status: 'context', severity: 'none', recommendedActions: [] },
  unavailable: { definition: '현재 원문 등급이 조판 가능(usable/excerpt)이 아닌 편수. 사용 이력과 별개입니다.', status: 'blocked', severity: 'high', recommendedActions: [] },
}
export function buildSourceMetrics(counts: SourceCounts, measuredAt: string | null): Record<SourceQueue, SourceMetric> {
  return Object.fromEntries((Object.keys(SOURCE_QUEUES) as SourceQueue[]).map(queue => [queue, {
    name: SOURCE_QUEUES[queue], value: counts[queue], denominator: counts.all,
    ...METRIC_DEFINITION[queue], sourceOfTruth: 'csat_source_eligibility · evaluateSource',
    reasonBreakdown: null, recommendedActions: METRIC_DEFINITION[queue].recommendedActions,
    drilldownTarget: `/admin/csat/sources?view=eligibility&queue=${queue}`,
    lastCalculatedAt: measuredAt,
  }])) as Record<SourceQueue, SourceMetric>
}
/** Counts describe overlapping populations. The order reflects downstream impact and required dependencies. */
export function buildSourceWorkQueue(counts: SourceCounts): SourceWorkItem[] {
  const items: SourceWorkItem[] = [
    { id: 'linked-rejected', queue: 'p0', reason: 'content_rejected', priority: 'P0', kind: 'review',
      title: '반려 원문에 연결된 문항 확인', count: counts.p0,
      why: '반려 원문에 문항이 연결되어 있습니다. 연결은 현재 사용이나 노출의 증거가 아니므로 각 문항의 영향부터 확인합니다.',
      next: '원문과 연결 문항의 지문·앵커·검수 상태를 대조합니다.', verify: '반려 원문이 조판·학습 적격으로 통과하지 않는지 재검증합니다.',
      dependency: '원문과 문항의 현재 revision 확인' },
    { id: 'quality', queue: 'quality', priority: 'P1', kind: 'investigate', title: '본문 품질 신호 검토', count: counts.quality,
      why: '추출 결함 신호는 오탐을 포함하며 본문과 연결 문항에 영향을 줄 수 있습니다.',
      next: '원천별 본문과 문항 지문을 표본 확인한 뒤 해당 추출기를 조사합니다.', verify: '원문·문항 앵커를 다시 확인하고 품질 스캔을 재실행합니다.',
      dependency: '원천별 오탐 확인과 변경 전 백업' },
    { id: 'analysis', queue: 'analysis', priority: 'P1', kind: 'investigate', title: '필수 분석 누락 확인', count: counts.analysis,
      why: '학령·어수·문체·구문 중 필수 측정이 비었거나 유효하지 않습니다.',
      next: '원문 검사에서 누락 필드를 확인하고 기존 어휘·분석 경로 중 필요한 것만 실행합니다.', verify: '분석 상태와 적격 판정을 다시 읽습니다.',
      dependency: '누락 필드와 원문 상태 확인' },
    { id: 'judgment', queue: 'content', priority: 'P2', kind: 'batch', title: '미판정 내용 검토', count: counts.content,
      why: '내용 판정이 없다는 신호입니다. 이 수에는 미절단 원본과 다른 정책에 이미 막힌 원문이 겹칩니다.',
      next: '사유를 좁힌 뒤 UUID·본문 revision·해시를 묶어 판정 청크를 준비합니다.', verify: '판정 import 후 캐시와 차단 사유를 다시 확인합니다.',
      dependency: '미절단 원본과 다른 차단 정책을 먼저 제외' },
    { id: 'raw', queue: 'raw', reason: 'raw_content_unjudged', priority: 'P2', kind: 'blocked', title: '미절단 원본의 발췌 경로 확인', count: counts.raw,
      why: '원본 전체를 내용 판정만 반복해도 교재 지문이 되지 않습니다.',
      next: '수요가 있는 원문에서 발췌본·문항 연결·분석 경로를 먼저 확인합니다.', verify: '파생 원문의 판정과 문항 범위를 확인합니다.',
      dependency: '발췌 수요 및 파생 원문의 독립 판정' },
    { id: 'excerpt', queue: 'excerpt', reason: 'excerpt_not_materialized', priority: 'P2', kind: 'blocked', title: '발췌 문항 준비 확인', count: counts.excerpt,
      why: '긴 원문에 사용할 문항 지문이 없거나 후보 창만 있습니다.',
      next: '승인된 문항 지문을 만들 수 있는지 원문과 유형 수요를 확인합니다.', verify: '문항 지문·앵커·검수 통과 후 재판정합니다.',
      dependency: '내용 판정·학령·문항 수요' },
  ]
  return items.filter(item => item.count > 0)
}
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
  excerpt_evidence: { windows: number; invalidRanges: number; approved: boolean; contentRevisionRecorded: boolean }
  linked_items: number
  measured_at: string
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

export interface SourceNextAction {
  kind: SourceActionKind
  what: string
  why: string
  impact: string
  next: string
  verify: string
}
/** Pick one next decision from actual policy evidence. A linked item is an impact clue, not proof of exposure. */
export function sourceNextAction(row: SourceOperationRow, stale = false): SourceNextAction {
  const blockers = row.result.blockers
  const linked = row.linked_items > 0
  if (stale) return { kind: 'automatic', what: '캐시 재검증 필요', why: '원문 revision 또는 정책 버전이 캐시보다 새롭습니다.',
    impact: linked ? `연결 문항 ${row.linked_items}개의 현재 정책 근거를 확인해야 합니다.` : '현재 캐시를 사용 판단의 근거로 삼을 수 없습니다.',
    next: '현재 원문으로 파생 판정만 다시 계산합니다.', verify: '새 캐시의 revision·사유·문항 연결 수를 확인합니다.' }
  if (blockers.includes('content_rejected') && linked) return { kind: 'review', what: '반려 원문·문항 연결 검토',
    why: '내용 반려 판정과 기존 문항 연결이 동시에 있습니다.', impact: `문항 ${row.linked_items}개가 연결되어 있습니다. 실제 학습·교재 노출 여부는 별도 기록으로 확인합니다.`,
    next: '원문과 각 문항의 지문·앵커·검수 상태를 대조합니다.', verify: '원문이 학습·조판 적격을 통과하지 않는지 확인합니다.' }
  if (blockers.includes('base_legal') || blockers.includes('base_safety') || blockers.includes('content_rejected')) return {
    kind: 'blocked', what: '사용 제한 유지', why: '법적·안전·내용 반려 중 하나가 원문을 차단합니다.',
    impact: linked ? `문항 ${row.linked_items}개 연결의 영향 확인이 필요합니다.` : '새 문항·조판·학습 사용 대상이 아닙니다.',
    next: '판정 근거를 원문과 대조하고 연결 문항이 있으면 별도 검토합니다.', verify: '제한된 원문이 적격으로 통과하지 않는지 확인합니다.' }
  if (row.quality_flags.length) return { kind: 'investigate', what: '본문 품질 신호 확인', why: '추출 품질 신호가 기록되어 있습니다. 오탐일 수 있습니다.',
    impact: linked ? `문항 ${row.linked_items}개의 지문·앵커에도 영향을 줄 수 있습니다.` : '본문을 수정하면 뒤따르는 분석과 판정이 달라질 수 있습니다.',
    next: '본문을 읽고 원천 추출기·연결 문항을 점검합니다.', verify: '수정 시 본문 해시·문항 앵커·품질 신호를 재검증합니다.' }
  if (row.result.analysisStatus !== 'complete') return { kind: 'investigate', what: '필수 분석 경로 확인', why: '학령·어수·문체·구문 중 필수 분석이 비었거나 유효하지 않습니다.',
    impact: '원문 적격을 확정할 수 없습니다.', next: '누락 필드와 기존 어휘 자료를 확인한 뒤 필요한 분석만 수행합니다.', verify: '분석 필드와 적격 판정을 다시 확인합니다.' }
  if (blockers.includes('raw_content_unjudged')) return { kind: 'blocked', what: '발췌 경로 먼저 확인', why: '미절단 원본은 그대로 내용 판정만 해도 사용할 지문이 생기지 않습니다.',
    impact: '발췌 파생 원문과 연결 문항이 필요합니다.', next: '수요가 있는 발췌본의 생성·분석·독립 판정 경로를 확인합니다.', verify: '파생 원문의 본문과 판정·문항 범위를 확인합니다.' }
  if (blockers.includes('content_unjudged')) return { kind: 'batch', what: '본문 판정 청크 준비', why: '현재 본문의 내용 판정이 없습니다.',
    impact: '판정 전에는 원문 적격을 확정할 수 없습니다.', next: 'UUID·revision·본문 해시를 묶어 읽고 판정합니다.', verify: '판정 import 후 캐시를 재계산하고 차단 사유를 확인합니다.' }
  if (blockers.includes('cefr_above_band')) return { kind: 'review', what: '학령 배치 검토', why: '측정 CEFR이 현재 학령 상한을 넘습니다.',
    impact: '현재 학령의 교재 지문으로 사용할 수 없습니다.', next: '측정 근거와 다른 학령의 적합성을 확인합니다.', verify: '학령을 임의로 낮추지 않고 새 판정 결과를 확인합니다.' }
  if (blockers.includes('excerpt_not_materialized')) return { kind: 'blocked', what: '문항 지문 준비 확인', why: '긴 원문에 사용할 승인된 문항 지문이 없습니다.',
    impact: '후보 창만으로 학습·교재에 사용할 수 없습니다.', next: '유형 수요와 원문을 확인한 뒤 문항 지문을 검수합니다.', verify: '문항 지문·앵커·검수를 확인하고 재판정합니다.' }
  if (row.result.status === 'conditional') return { kind: 'review', what: '문항별 검증', why: '원문 정책은 통과했지만 발췌 문항은 별도 검증이 필요합니다.',
    impact: `연결 문항 ${row.linked_items}개의 지문·위치·검수 상태가 사용 여부를 정합니다.`, next: '문항 inspector에서 실제 지문과 앵커를 확인합니다.', verify: '문항 검수와 교재 manifest를 대조합니다.' }
  return { kind: 'review', what: row.result.status === 'eligible' ? '사용 전 문항 확인' : '차단 사유 확인',
    why: row.result.status === 'eligible' ? '원문 정책이 통과했습니다.' : '여러 정책 사유가 남아 있습니다.',
    impact: linked ? `문항 ${row.linked_items}개가 연결되어 있습니다.` : '연결 문항은 확인되지 않았습니다.',
    next: row.result.status === 'eligible' ? '문항별 지문·앵커·검수를 확인합니다.' : '판정 근거와 실제 원문을 대조합니다.',
    verify: '원문과 문항의 최신 revision을 다시 확인합니다.' }
}
