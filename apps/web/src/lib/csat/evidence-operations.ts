// apps/web/src/lib/csat/evidence-operations.ts
// Operational projections of existing gates. Never substitutes quality defects for learner readiness.
import {
  AXES,
  MEASURES,
  applyFilter,
  filterFromQuery,
  filterToQuery,
  type AxisContext,
  type AxisId,
  type DefectCode,
  type EvidenceData,
  type EvidenceItem,
  type Filter,
  type Measure,
} from './evidence-fold'

export interface ReadinessAudit {
  total: number
  fields: Record<string, number>
  excluded: { id: string; missing: string[] }[]
  readyIds: string[]
}
export interface OperationsData extends EvidenceData {
  readiness: ReadinessAudit | null
  readinessError: string | null
}
export const LEARNER_FIELDS: Record<string, string> = {
  answer: '정답',
  evidence: '근거 설명',
  intent: '출제 의도',
  anchor: '정답 앵커',
  distractor: '오답 근거 연결',
  intentOptions: '의도 보기',
  trapOptions: '함정 보기',
  topic: '소재',
  format: '형식',
  formula: '공식·마무리',
  history: '형식 이력',
  catalog: '학습 카탈로그',
  'ready-check': '최종 일관성',
}
export const FIELD_GROUPS = [
  { label: '핵심 분석', fields: ['answer', 'evidence', 'intent'] },
  { label: '근거·보기 연결', fields: ['anchor', 'distractor', 'intentOptions', 'trapOptions'] },
  { label: '학습 메타데이터', fields: ['topic', 'format', 'formula', 'history'] },
  { label: '학습 진입', fields: ['catalog'] },
]
export interface WorkIssue {
  id: string
  label: string
  priority: 1 | 2 | 3 | 4
  stage: string
  severity: '원천 검토' | '학습 후보 제외' | '보고서 점검'
  why: string
  action: string
  location: string
  technical: string
  defect?: DefectCode
  field?: string
}
const QUALITY_ISSUES: WorkIssue[] = [
  {
    id: 'body',
    defect: 'body',
    label: '지문 잘림',
    priority: 1,
    stage: '원문·추출',
    severity: '원천 검토',
    why: '원문 일부가 누락되어 분석의 신뢰성을 먼저 확인해야 합니다.',
    action: '원본 대조 → 추출 복구 → 변경 문항 재분석 → 재검증',
    location: 'scripts/csat/build-corpus.mjs · corpus-sync.mjs',
    technical:
      '원장을 비교한 뒤 corpus-sync 미리보기를 검토합니다. 원문이 바뀐 문항은 analysis-drain-export.mjs --redo로 다시 분석합니다. 원문 변경만으로 기존 분석은 복구되지 않습니다.',
  },
  {
    id: 'answerKey',
    defect: 'answerKey',
    label: '복수 정답',
    priority: 1,
    stage: '채점',
    severity: '원천 검토',
    why: '복수 정답과 단일 정답 채점의 호환을 확인해야 합니다.',
    action: '공식 정답표 대조 → 채점 지원 확인 → 재검증',
    location: 'csat_items.answers · 학습자 채점',
    technical:
      '정당한 복수 정답을 데이터 오류로 지우지 않습니다. 이 항목은 자동 수정 대상이 아닙니다.',
  },
  {
    id: 'scoring',
    defect: 'scoring',
    label: '배점 모순',
    priority: 1,
    stage: '원문·추출',
    severity: '원천 검토',
    why: '3점 표시와 실제 배점이 달라 배점 집계가 왜곡됩니다.',
    action: '원본 배점 확인 → 코퍼스 정합 수정 → 재검증',
    location: 'scripts/csat/corpus-sync.mjs',
    technical: 'points와 high_score를 공식 문제지와 대조하고 sync 미리보기 후 반영합니다.',
  },
  {
    id: 'quote',
    defect: 'quote',
    label: '인용 미정착',
    priority: 2,
    stage: '근거 연결',
    severity: '원천 검토',
    why: '현재 지문에서 분석이 인용한 문장을 찾을 수 없습니다.',
    action: '원문·인용 대조 → 대상 문항 재분석 → 앵커 재생성 → 재검증',
    location: 'scripts/csat/analysis-drain-export.mjs · build-skeleton-data.mjs',
    technical:
      '지문 변경으로 예전 인용이 무효가 될 수 있습니다. 대상 --redo 청크를 분석·검수하고 validate 통과 후 import합니다.',
  },
  {
    id: 'reportText',
    defect: 'reportText',
    label: '리포트 작업 로그',
    priority: 4,
    stage: '유형 보고서',
    severity: '보고서 점검',
    why: '유형 설명에 내부 작업 용어가 남아 있습니다. 현재 해부 학습 후보 판정과는 별도입니다.',
    action: '유형 리포트 확인 → 학습자 서술 재작성 → 검증',
    location: 'scripts/csat/locus-refold-export.mjs · locus-refold-import.mjs',
    technical:
      'locus-refold --commit은 answer_locus_pattern을 덮어씁니다. 백업 확인 후 한 번만 반영합니다(재실행 안전하지 않음). failure_modes·procedure_steps의 표지도 별도 검토합니다.',
  },
  {
    id: 'reportCount',
    defect: 'reportCount',
    label: '리포트 계수 불일치',
    priority: 4,
    stage: '유형 보고서',
    severity: '보고서 점검',
    why: '리포트의 분석 문항 수와 실제 유형별 문항 수가 다릅니다.',
    action: '유형 범위·분석 버전 확인 → 리포트 재집계 → 재검증',
    location: 'csat_type_reports.n_analyzed · analysis-drain-import.mjs',
    technical:
      '현재 항목 수를 기계적으로 덮어쓰기 전에 리포트가 다루는 범위를 확인합니다. DB 자동 수정은 수행하지 않습니다.',
  },
]
export const WORK_ISSUES: WorkIssue[] = [
  ...QUALITY_ISSUES,
  ...Object.entries(LEARNER_FIELDS).map(([field, label]): WorkIssue => {
    const metadata = ['topic', 'format', 'formula', 'history'].includes(field)
    const linking = ['anchor', 'distractor', 'intentOptions', 'trapOptions'].includes(field)
    return {
      id: `field:${field}`,
      field,
      label: `${label} 부족`,
      priority: metadata ? 3 : 2,
      stage: metadata ? '학습 메타데이터' : linking ? '근거·보기 연결' : '분석·검증',
      severity: '학습 후보 제외',
      why: `${label} 조건을 충족하지 않아 현재 해부 학습 후보에서 제외됩니다.`,
      action: metadata
        ? '검토된 소재·형식·공식과 이력 확인 → 메타데이터 보완 → 재검증'
        : linking
          ? '현재 분석·문장 좌표 대조 → 근거와 보기 보완 → 재검증'
          : '최신 분석·학습 후보 조건 확인 → 부족 항목 보완 → 재검증',
      location: metadata
        ? 'apps/web/src/lib/csat/dissect-metadata.ts · lecture 데이터'
        : linking
          ? 'dissect-catalog.ts · dissect-anchors.json · skeleton-data'
          : 'dissect-catalog.ts · csat_item_analyses',
      technical: metadata
        ? '이력은 같은 형식의 검토된 다른 문항이 필요합니다. 임시 문구로 채우지 않습니다. 정적 파일은 코드 배포 후 재검증에 반영됩니다.'
        : '분석은 최신 published 버전을 사용합니다. 앵커 생성은 scripts/csat/build-skeleton-data.mjs와 apps/web/scripts/csat-learner/build-dissect-anchors.mts를 검토합니다. 보기 개수와 의도 길이 조건은 학습자 판정식과 같습니다.',
    }
  }),
]
export const VIEWS = { overview: '운영 현황', issues: '작업 큐', questions: '문항 탐색' } as const
export const STATUSES = {
  all: '전체 상태',
  ready: '학습 준비',
  blocked: '학습 후보 제외',
  quality: '원천 검토 필요',
  clean: '원천 결함 없음',
} as const
export const SORTS = {
  priority: '조치 우선순',
  recent: '최근 분석순',
  exam: '최근 회차순',
} as const
export interface OperationsState {
  view: keyof typeof VIEWS
  status: keyof typeof STATUSES
  sort: keyof typeof SORTS
  q: string
  issue: string
  stage: string
  item: string
  page: number
  matrix: boolean
  filter: Filter
  row: AxisId
  col: AxisId
  measure: Measure
  intersection: { axis: AxisId; keys: [string, string] } | null
}
type Params = URLSearchParams | Record<string, string | string[] | undefined>
export function parseOperationsState(params: Params = {}): OperationsState {
  const get = (key: string) => {
    const v = params instanceof URLSearchParams ? params.get(key) : params[key]
    return (Array.isArray(v) ? v[0] : v) ?? ''
  }
  const one = <T extends string>(value: string, values: readonly T[], fallback: T): T =>
    values.includes(value as T) ? (value as T) : fallback
  const filter = filterFromQuery(params)
  const legacy = Boolean(get('row') || get('col') || Object.keys(filter).length)
  return {
    view: one(
      get('view'),
      Object.keys(VIEWS) as (keyof typeof VIEWS)[],
      legacy ? 'questions' : 'overview'
    ),
    status: one(get('status'), Object.keys(STATUSES) as (keyof typeof STATUSES)[], 'all'),
    sort: one(get('sort'), Object.keys(SORTS) as (keyof typeof SORTS)[], 'priority'),
    q: get('q').slice(0, 100),
    issue: WORK_ISSUES.some((i) => i.id === get('issue')) ? get('issue') : '',
    stage: PIPELINE.some((s) => s.id === get('stage')) ? get('stage') : '',
    item: get('item').slice(0, 100),
    page: Math.max(1, Math.min(10000, Math.trunc(Number(get('page'))) || 1)),
    matrix: get('matrix') === '1' || (!get('view') && legacy),
    filter,
    row: one(
      get('row'),
      AXES.map((a) => a.id),
      'defect'
    ),
    col: one(
      get('col'),
      AXES.map((a) => a.id),
      'type'
    ),
    measure: one(
      get('m'),
      MEASURES.map((m) => m.id),
      'items'
    ),
    intersection:
      AXES.some((a) => a.id === get('cellAxis')) && get('cellRow') && get('cellCol')
        ? { axis: get('cellAxis') as AxisId, keys: [get('cellRow'), get('cellCol')] }
        : null,
  }
}
export function operationsHref(state: OperationsState): string {
  const sp = filterToQuery(state.filter)
  sp.set('view', state.view)
  for (const key of ['q', 'issue', 'stage', 'item'] as const)
    if (state[key]) sp.set(key, state[key])
  if (state.status !== 'all') sp.set('status', state.status)
  if (state.sort !== 'priority') sp.set('sort', state.sort)
  if (state.page > 1) sp.set('page', String(state.page))
  if (state.matrix) sp.set('matrix', '1')
  if (state.intersection) {
    sp.set('cellAxis', state.intersection.axis)
    sp.set('cellRow', state.intersection.keys[0])
    sp.set('cellCol', state.intersection.keys[1])
  }
  if (state.matrix || state.row !== 'defect' || state.col !== 'type' || state.measure !== 'items') {
    sp.set('row', state.row)
    sp.set('col', state.col)
    sp.set('m', state.measure)
  }
  return `/admin/csat/evidence?${sp}`
}
export function readinessIndex(audit: ReadinessAudit | null) {
  return {
    ready: new Set(audit?.readyIds ?? []),
    missing: new Map(audit?.excluded.map((i) => [i.id, i.missing]) ?? []),
  }
}
export type ReadinessIndex = ReturnType<typeof readinessIndex>
export function hasIssue(item: EvidenceItem, issue: WorkIssue, index: ReadinessIndex): boolean {
  return issue.defect
    ? item.defects.includes(issue.defect)
    : (index.missing.get(item.id) ?? []).includes(issue.field ?? '')
}
export function workQueue(items: EvidenceItem[], index: ReadinessIndex) {
  return WORK_ISSUES.map((issue) => ({
    ...issue,
    count: items.filter((i) => hasIssue(i, issue, index)).length,
  }))
    .filter((i) => i.count > 0)
    .sort((a, b) => a.priority - b.priority || b.count - a.count || a.id.localeCompare(b.id))
}
export const PIPELINE = [
  { id: 'analysis', label: '핵심 분석', fields: ['answer', 'evidence', 'intent'] },
  { id: 'linking', label: '근거 연결', fields: ['anchor', 'distractor'] },
  { id: 'options', label: '학습 보기', fields: ['intentOptions', 'trapOptions'] },
  { id: 'metadata', label: '학습 메타', fields: ['topic', 'format', 'formula', 'history'] },
  { id: 'delivery', label: '최종 검증', fields: ['catalog', 'ready-check'] },
]
export function firstBlockedStage(id: string, index: ReadinessIndex): string | null {
  if (index.ready.has(id)) return null
  const missing = index.missing.get(id)
  if (!missing) return 'unknown'
  return PIPELINE.find((s) => s.fields.some((f) => missing.includes(f)))?.id ?? 'delivery'
}
export function pipelineHealth(items: EvidenceItem[], index: ReadinessIndex) {
  let remaining = items.filter((i) => index.ready.has(i.id) || index.missing.has(i.id))
  return PIPELINE.map((stage) => {
    const blocked = remaining.filter((i) => firstBlockedStage(i.id, index) === stage.id)
    remaining = remaining.filter((i) => !blocked.includes(i))
    return { ...stage, blocked: blocked.length, passed: remaining.length }
  })
}
export function filterOperations(
  items: EvidenceItem[],
  state: OperationsState,
  ctx: AxisContext,
  index: ReadinessIndex
): EvidenceItem[] {
  const issue = WORK_ISSUES.find((i) => i.id === state.issue)
  const q = state.q.trim().toLocaleLowerCase()
  const score = (item: EvidenceItem) =>
    Math.min(9, ...WORK_ISSUES.filter((i) => hasIssue(item, i, index)).map((i) => i.priority))
  return applyFilter(items, state.filter, ctx)
    .filter(
      (i) =>
        (!state.intersection ||
          state.intersection.keys.every(
            (key) => applyFilter([i], { [state.intersection!.axis]: [key] }, ctx).length > 0
          )) &&
        (!q || `${i.id} ${i.examLabel} ${i.typeName} ${i.no}번`.toLocaleLowerCase().includes(q)) &&
        (!issue || hasIssue(i, issue, index)) &&
        (!state.stage || firstBlockedStage(i.id, index) === state.stage) &&
        (state.status === 'all' ||
          (state.status === 'ready' && index.ready.has(i.id)) ||
          (state.status === 'blocked' && index.missing.has(i.id)) ||
          (state.status === 'quality' && i.defects.length > 0) ||
          (state.status === 'clean' && i.defects.length === 0))
    )
    .sort(
      (a, b) =>
        (state.sort === 'priority'
          ? score(a) - score(b)
          : state.sort === 'recent'
            ? (b.analysisUpdatedAt ?? '').localeCompare(a.analysisUpdatedAt ?? '')
            : 0) ||
        b.year - a.year ||
        a.examId.localeCompare(b.examId) ||
        a.no - b.no
    )
}
export function makeWorkPackage(
  items: EvidenceItem[],
  state: OperationsState,
  generatedAt: string,
  index = readinessIndex(null)
) {
  const ids = items.map((i) => i.id)
  const safeIds = ids.every((id) => /^(?:\d{4}[AB]?|M\d{4})#\d{1,2}$/.test(id))
  const issues = WORK_ISSUES.filter(
    (i) => i.id === state.issue || items.some((it) => hasIssue(it, i, index))
  )
  const analysisNeeded = issues.some(
    (i) =>
      i.defect === 'body' ||
      i.defect === 'quote' ||
      ['answer', 'evidence', 'intent'].includes(i.field ?? '')
  )
  return {
    generatedAt,
    scope: operationsHref(state),
    count: ids.length,
    itemIds: ids,
    action: '작업 대상 내보내기 — 재분석은 아직 실행되지 않았습니다.',
    issues: issues.map((i) => ({
      label: i.label,
      action: i.action,
      location: i.location,
      caution: i.technical,
    })),
    commands:
      analysisNeeded && safeIds && ids.length
        ? {
            export: `node scripts/csat/analysis-drain-export.mjs --redo '${ids.join(',')}'`,
            validate: 'node scripts/csat/analysis-drain-validate.mjs',
            preview: 'node scripts/csat/analysis-drain-import.mjs',
          }
        : null,
    procedure: [
      '원문·정답과 수정 범위를 확인합니다.',
      'export 청크를 에이전트가 분석하고 서로 다른 3인 관점으로 검수합니다.',
      'validate 통과와 import 미리보기를 확인한 뒤 승인된 범위만 반영합니다.',
      '앵커·메타데이터를 포함한 코드 변경은 배포 후 Evidence에서 재검증합니다.',
    ],
  }
}
