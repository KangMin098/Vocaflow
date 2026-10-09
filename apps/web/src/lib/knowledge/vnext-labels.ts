// apps/web/src/lib/knowledge/vnext-labels.ts
//
// 학습 원리 vNext 라벨 · 가드(2026-10-08) — 값은 마이그레이션 20261008120000_knowledge_vnext 의 CHECK 와 같다(labels.test 가 대조한다).
// 정본 docs/methodology/VNEXT_ARCHITECTURE.md §3 · §5.
import type { Layer } from './labels'

export const KINDS = ['competency', 'essence_bundle', 'processing_mechanism', 'learning_mechanism', 'method', 'task'] as const
export type Kind = (typeof KINDS)[number]
export const KIND_LABEL: Record<Kind, string> = {
  competency: '역량 목표',
  essence_bundle: '본질 묶음(기존)',
  processing_mechanism: '언어 처리 기제',
  learning_mechanism: '학습 · 기억 기제',
  method: '방법론',
  task: '실행 과제',
}
export const KIND_QUESTION: Record<Kind, string> = {
  competency: '이 영역에서 「잘한다」는 관찰 가능한 수행은 무엇인가',
  essence_bundle: '영역을 가로지르는 묶음 서술 — 역량으로 나눠 다시 쓴다',
  processing_mechanism: '영어를 이해 · 산출할 때 머릿속에서 무엇이 처리되는가',
  learning_mechanism: '왜 그렇게 하면 배워지고 오래 남는가',
  method: '기제를 한 영역 · 조건에 쓰는 절차',
  task: '학습자가 실제로 하는 활동(조건 · 입력 · 정답 판정)',
}
/** 층(layer) ↔ 종류(kind) — DB CHECK knowledge_items_kind_layer_check 와 같다 */
export const KINDS_BY_LAYER: Record<Layer, readonly Kind[]> = {
  essence: ['competency', 'essence_bundle'],
  principle: ['processing_mechanism', 'learning_mechanism'],
  method: ['method'],
  practice: ['task'],
}
export const KIND_ORDER: readonly Kind[] = ['competency', 'processing_mechanism', 'learning_mechanism', 'method', 'task', 'essence_bundle']
export const isKind = (v: unknown): v is Kind => typeof v === 'string' && (KINDS as readonly string[]).includes(v)
export const kindFitsLayer = (layer: Layer, kind: Kind | null) => kind === null || KINDS_BY_LAYER[layer].includes(kind)

export const EVIDENCE_LEVELS = [
  'meta_analysis', 'systematic_review', 'rct', 'quasi_experimental', 'correlational', 'descriptive',
  'exam_observation', 'expert_opinion', 'practitioner_claim', 'not_rated',
] as const
export type EvidenceLevel = (typeof EVIDENCE_LEVELS)[number]
export const EVIDENCE_LEVEL_LABEL: Record<EvidenceLevel, string> = {
  meta_analysis: '메타분석',
  systematic_review: '체계적 문헌고찰',
  rct: '무작위 대조 실험',
  quasi_experimental: '준실험',
  correlational: '상관 연구',
  descriptive: '기술 연구',
  exam_observation: '기출 관찰',
  expert_opinion: '전문가 견해',
  practitioner_claim: '실무자 주장',
  not_rated: '평가 안 함',
}
/** efficacy 를 뒷받침할 수 있는 연구 수준(DB 가드와 같다) */
export const STRONG_LEVELS: readonly EvidenceLevel[] = ['meta_analysis', 'systematic_review', 'rct', 'quasi_experimental']
/** 외부(영상 · 웹) 근거가 가질 수 있는 수준 — 연구 수준은 research 서지로만 */
export const EXTERNAL_LEVELS: readonly EvidenceLevel[] = ['practitioner_claim', 'expert_opinion', 'not_rated']
export const isEvidenceLevel = (v: unknown): v is EvidenceLevel => typeof v === 'string' && (EVIDENCE_LEVELS as readonly string[]).includes(v)

export const APPLICABILITY = ['high', 'partial', 'low', 'unknown'] as const
export type Applicability = (typeof APPLICABILITY)[number]
export const APPLICABILITY_LABEL: Record<Applicability, string> = { high: '높음', partial: '부분', low: '낮음', unknown: '미확인' }
export const isApplicability = (v: unknown): v is Applicability => typeof v === 'string' && (APPLICABILITY as readonly string[]).includes(v)

export const RESEARCH_DESIGNS = ['meta_analysis', 'systematic_review', 'rct', 'quasi_experimental', 'correlational', 'descriptive', 'theoretical', 'expert_opinion'] as const
export type ResearchDesign = (typeof RESEARCH_DESIGNS)[number]
export const RESEARCH_DESIGN_LABEL: Record<ResearchDesign, string> = {
  meta_analysis: '메타분석', systematic_review: '체계적 문헌고찰', rct: '무작위 대조 실험', quasi_experimental: '준실험',
  correlational: '상관 연구', descriptive: '기술 연구', theoretical: '이론 · 개관', expert_opinion: '전문가 견해',
}
export const isResearchDesign = (v: unknown): v is ResearchDesign => typeof v === 'string' && (RESEARCH_DESIGNS as readonly string[]).includes(v)

export const INQUIRY_STATUSES = ['open', 'investigating', 'concluded', 'parked'] as const
export type InquiryStatus = (typeof INQUIRY_STATUSES)[number]
export const INQUIRY_STATUS_LABEL: Record<InquiryStatus, string> = { open: '열림', investigating: '조사 중', concluded: '결론', parked: '보류' }
export const isInquiryStatus = (v: unknown): v is InquiryStatus => typeof v === 'string' && (INQUIRY_STATUSES as readonly string[]).includes(v)

export const INQUIRY_ROLES = ['candidate', 'support', 'counter', 'uncertain'] as const
export type InquiryRole = (typeof INQUIRY_ROLES)[number]
export const INQUIRY_ROLE_LABEL: Record<InquiryRole, string> = { candidate: '결론 후보', support: '지지', counter: '반례 · 반대', uncertain: '불확실' }
export const isInquiryRole = (v: unknown): v is InquiryRole => typeof v === 'string' && (INQUIRY_ROLES as readonly string[]).includes(v)

export const APP_SURFACES = ['csat_item_task', 'learning_map_find', 'module_task'] as const
export type AppSurface = (typeof APP_SURFACES)[number]
export const APP_SURFACE_LABEL: Record<AppSurface, string> = { csat_item_task: '기출 문항 과제', learning_map_find: '학습 지도 확인하기', module_task: '학습 모듈 과제' }
export const isAppSurface = (v: unknown): v is AppSurface => typeof v === 'string' && (APP_SURFACES as readonly string[]).includes(v)

export const APP_STATUSES = ['draft', 'active', 'paused', 'rolled_back'] as const
export type AppStatus = (typeof APP_STATUSES)[number]
export const APP_STATUS_LABEL: Record<AppStatus, string> = { draft: '초안', active: '학습자에게 적용 중', paused: '중단', rolled_back: '롤백' }
export const isAppStatus = (v: unknown): v is AppStatus => typeof v === 'string' && (APP_STATUSES as readonly string[]).includes(v)
/** 적용 상태 전이(화면 규칙 — DB 는 채택 · trial · 이유를 따로 지킨다) */
export const APP_TRANSITIONS: Record<AppStatus, readonly AppStatus[]> = {
  draft: ['active', 'rolled_back'],
  active: ['paused', 'rolled_back'],
  paused: ['active', 'rolled_back'],
  rolled_back: [],
}

export const TRIAL_STATUSES = ['planned', 'running', 'analyzed', 'stopped'] as const
export type TrialStatus = (typeof TRIAL_STATUSES)[number]
export const TRIAL_STATUS_LABEL: Record<TrialStatus, string> = { planned: '계획', running: '진행 중', analyzed: '분석 완료', stopped: '중지' }
export const TRIAL_RESULTS = ['supported', 'mixed', 'not_supported', 'inconclusive'] as const
export type TrialResult = (typeof TRIAL_RESULTS)[number]
export const TRIAL_RESULT_LABEL: Record<TrialResult, string> = { supported: '효과 지지', mixed: '혼재', not_supported: '효과 없음', inconclusive: '판단 불가' }

/** 관리자 5개 업무 공간(정본 §5) — 기존 8 라우트는 탭으로 흡수(URL 보존) */
export interface WorkspaceTab { href: string; label: string }
export interface Workspace { key: 'ops' | 'map' | 'lab' | 'design' | 'product'; href: string; label: string; question: string; tabs: readonly WorkspaceTab[] }
export const WORKSPACES: readonly Workspace[] = [
  { key: 'ops', href: '/admin/knowledge', label: '원리 운영실', question: '지금 어디가 막혔고 무엇부터 처리하나', tabs: [] },
  {
    key: 'map', href: '/admin/knowledge/map', label: '역량 · 원리 지도', question: '역량 · 기제 · 방법 · 과제가 어떻게 이어지나',
    tabs: [
      { href: '/admin/knowledge/map', label: '관계 지도' },
      { href: '/admin/knowledge/principles', label: '본질 · 원리 목록' },
      { href: '/admin/knowledge/methods', label: '방법론 · 과제 목록' },
    ],
  },
  {
    key: 'lab', href: '/admin/knowledge/lab', label: '탐구 · 근거 연구소', question: '무엇을 알고 싶고, 근거는 어디까지 말하나',
    tabs: [
      { href: '/admin/knowledge/lab', label: '탐구 질문' },
      { href: '/admin/knowledge/lab/research', label: '연구 서지' },
      { href: '/admin/knowledge/lab/compare', label: '원리 근거 비교' },
      { href: '/admin/knowledge/review', label: '검토 대기' },
      { href: '/admin/knowledge/sources', label: '근거 · 출처' },
      { href: '/admin/knowledge/sources/csat', label: '기출 원천' },
      { href: '/admin/knowledge/experts', label: '전문가 · 채널' },
      { href: '/admin/knowledge/gaps', label: '공백' },
      { href: '/admin/methodology', label: '가져오기 원장' },
    ],
  },
  { key: 'design', href: '/admin/knowledge/design', label: '학습 설계 · 검증', question: '원리를 어떤 과제로 만들고 효과를 어떻게 잴까', tabs: [] },
  {
    key: 'product', href: '/admin/knowledge/product', label: '제품 적용 · 품질', question: '학습자에게 무엇이 나가 있고 결과는 어떤가',
    tabs: [
      { href: '/admin/knowledge/product', label: '적용 · 배포' },
      // 트랙 E(2026-10-08) — 학습 결과 → 원리 · 방법 재검토 신호(읽기 전용)
      { href: '/admin/knowledge/signals', label: '성과 검토 신호' },
    ],
  },
]
export function workspaceOf(pathname: string): Workspace | null {
  // 항목 상세는 지도의 노드 판이다
  if (pathname.startsWith('/admin/knowledge/item/')) return WORKSPACES.find((w) => w.key === 'map') ?? null
  const hit = WORKSPACES.find((w) => w.tabs.some((t) => t.href === pathname))
  if (hit) return hit
  return [...WORKSPACES].sort((a, b) => b.href.length - a.href.length).find((w) => pathname === w.href || pathname.startsWith(`${w.href}/`)) ?? null
}
