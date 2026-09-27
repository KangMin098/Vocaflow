// apps/web/src/lib/textbook/source-operations.ts
import type { FinalSourceEligibility, SourceEligibilityInput } from '@vocaflow/library-pipeline'

export const SOURCE_QUEUES = {
  all: '전체 후보', eligible: '적격', conditional: '조건부', review: '검토 필요', rejected: '사용 불가',
  content: '내용 검토', raw: '미절단 원본', analysis: '분석 미완', cefr: 'CEFR 초과', excerpt: '발췌 미완',
  quality: '본문 품질 검토', p0: '반려 원문 · 문항 연결',
  analyzed: '분석 완료', unavailable: '학습·교재 사용 대기',
  tagged: '교재 재료 실림',
  ready: '적격 · 재료 있음',
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

/* ── 조회 축 (2026-09-23) ────────────────────────────────────────────────────
 * 큐 프리셋 14개는 **조합이 안 된다.** 「usable 인데 문항이 없는 것」·「argument 재료가 있는
 * B1 원문」처럼 실제로 묻고 싶은 것이 프리셋 어디에도 없어서, 관리자가 목록을 눈으로 훑었다.
 * 아래 축들은 서로 곱해서 걸린다(AND).
 *
 * ⚠️ **화면과 API 가 같은 목록을 쓴다.** 한쪽에만 값을 더하면 화면이 보내는 값을 API 가
 *   400 으로 되돌려주고, 그 400 은 목록이 빈 것과 구별이 안 된다. */

/** `evaluateSource` 가 실제로 내는 등급. `excerpt`·`excerpt-blind` 는 DD-79(길이 축 제거)로 더는 생기지 않는다. */
export const SOURCE_GRADES = ['usable', 'blocked', 'unjudged', 'unknown'] as const
export type SourceGrade = typeof SOURCE_GRADES[number]

export const SOURCE_STATUSES = ['eligible', 'conditional', 'review', 'rejected'] as const
export type SourceStatus = typeof SOURCE_STATUSES[number]

/** 정본은 `scripts/csat/gate-rules.mjs` 의 `SOURCE_USES` 다 — 여기 값을 고치면 그쪽도 같이 본다. */
export const SOURCE_USE_TAGS = ['argument', 'structured', 'sequence', 'mood', 'factual', 'vocab', 'grammar', 'spoken'] as const
export type SourceUseTag = typeof SOURCE_USE_TAGS[number]
export const SOURCE_USE_LABELS: Record<SourceUseTag, string> = {
  argument: '논지', structured: '구조', sequence: '시간순', mood: '심경',
  factual: '사실', vocab: '어휘', grammar: '어법', spoken: '구어',
}

export const SOURCE_PAGE_SIZES = [30, 60, 120] as const
export type SourcePageSize = typeof SOURCE_PAGE_SIZES[number]
export const SOURCE_PAGE_SIZE: SourcePageSize = 30

/** 정렬 — 컬럼을 문자열로 받지 않고 **여기 적힌 것만** 쓴다(임의 컬럼을 열면 주입 면이 된다). */
export const SOURCE_LIST_SORTS = {
  items: [['linked_items', false]],
  itemsAsc: [['linked_items', true]],
  recent: [['measured_at', false]],
  oldest: [['measured_at', true]],
  title: [['input->>title', true]],
  source: [['source', true], ['linked_items', false]],
} as const satisfies Record<string, readonly (readonly [string, boolean])[]>
export type SourceListSort = keyof typeof SOURCE_LIST_SORTS
export const SOURCE_LIST_SORT_LABELS: Record<SourceListSort, string> = {
  items: '문항 많은 순', itemsAsc: '문항 적은 순', recent: '최근 판정순', oldest: '오래된 판정순',
  title: '제목순', source: '원천순',
}

/* 「지금 해야 할 작업」의 모델은 여기가 아니라 `source-process.ts` 다(2026-09-24).
 * 여기 있던 `buildSourceWorkQueue` 는 작업 6항목을 각각 5줄 산문으로 냈고, 같은 재고
 * 31,220편을 「미판정 내용 검토」와 「미절단 원본」 두 줄에 겹쳐 **서로 반대되는 처방**을
 * 달고 있었다(앞엣것은 실측 대상이 0편이었다). 순서 있는 관문 모델로 갈음했다. */
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
  tagged: { definition: '교재 재료 태그가 하나 이상 실린 편수. 태그가 없는 것은 「재료가 없다」가 아니라 「아직 판정이 안 내려갔다」입니다.', status: 'context', severity: 'none', recommendedActions: [] },
  ready: { definition: '적격 판정을 통과했고 교재 재료 태그도 실린 편수. 실제로 교재 생성에 넘길 수 있는 유일한 몫입니다.', status: 'ready', severity: 'none', recommendedActions: [] },
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
  /**
   * 이 원문으로 만들 수 있는 교재 재료(`gate-rules.SOURCE_USES`).
   *
   * ⚠️ `null`·`undefined` 와 `[]` 는 다른 뜻이다 — 전자는 **아직 안 실렸다**(마이그레이션
   *   `_pending_csat_source_eligibility_uses.sql` 이전 행이거나 재투영 전), 후자는
   *   **버린 원문이라 재료가 없다**. 없는 것을 빈 것으로 세면 「재료가 하나도 없다」가 된다.
   */
  uses?: string[] | null
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

/** 원문 하나를 열었을 때 그 한 편의 다음 작업이 어떤 성격인가(`sourceNextAction` 이 쓴다). */
export type SourceActionKind = 'automatic' | 'batch' | 'review' | 'investigate' | 'blocked'

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
  if (blockers.includes('raw_content_unjudged')) return { kind: 'batch', what: '보관 판정 먼저', why: '미절단 원본은 본문 전문을 읽고 보관 여부부터 가릅니다. 보관된 원본만 발췌됩니다.',
    impact: '판정 전에는 이 원본이 발췌되지 않습니다. 버린 원본은 다시 읽히지 않습니다.', next: 'plos-raw-triage-export 로 청크를 뽑아 판정하고 gate-mixed-import --input 으로 gate.retain 에 적재합니다.', verify: '적재 후 csat-sources-audit 의 보관 미결정 수가 줄었는지 확인합니다.' }
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
