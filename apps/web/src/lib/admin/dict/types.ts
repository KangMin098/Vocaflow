// apps/web/src/lib/admin/dict/types.ts
// 사전DB 종합 모니터링 콘솔 v3 — 타입 정의
//
// 9 차원 × 4 책임 (R1-R4) × Critical Defects × Schema Evolution

// ─────────────────────────────────────────────────────────────
// 1. Volume (총 단어 / POS 분포)
// ─────────────────────────────────────────────────────────────
export interface DictVolumeData {
  total: number
  byPrimaryPos: Array<{ pos: string; count: number }>
  bySource: Array<{ source: string; count: number }>
}

// ─────────────────────────────────────────────────────────────
// 2. Coverage (11 컬럼 채움률)
// ─────────────────────────────────────────────────────────────
export interface DictCoverageMetric {
  /** 채움 row 수 */
  filled: number
  /** total 대비 비율 0~1 */
  ratio: number
}

export interface DictCoverageData {
  total: number
  meaningKo: DictCoverageMetric
  exampleEn: DictCoverageMetric
  ipa: DictCoverageMetric
  cefrLevel: DictCoverageMetric
  cefrConfidence: DictCoverageMetric
  register: DictCoverageMetric
  synonyms: DictCoverageMetric
  antonyms: DictCoverageMetric
  collocations: DictCoverageMetric
  inflections: DictCoverageMetric
  koreanLearnerNote: DictCoverageMetric
  frequencyRank: DictCoverageMetric
  ngslSfi: DictCoverageMetric
  verified: DictCoverageMetric
}

// ─────────────────────────────────────────────────────────────
// 3. Linguistic (inflections by POS, polysemy, IPA UK/US)
// ─────────────────────────────────────────────────────────────
export interface DictLinguisticData {
  inflectionsByPos: Array<{
    primaryPos: string
    total: number
    withInflections: number
    /** total 대비 비율 0~1 */
    ratio: number
  }>
  polysemy: {
    /** senses 배열 1개 (단일 의미) */
    monosemic: number
    /** senses 배열 ≥ 2 (다의어) */
    polysemic: number
    /** total 대비 polysemic 비율 */
    polysemicRatio: number
  }
  ipa: {
    hasAny: number
    hasUk: number
    hasUs: number
    hasBoth: number
  }
}

// ─────────────────────────────────────────────────────────────
// 4. Learning Content (사용자 학습 자산)
// ─────────────────────────────────────────────────────────────
export interface DictLearningData {
  total: number
  exampleEn: DictCoverageMetric
  synonyms: DictCoverageMetric
  collocations: DictCoverageMetric
  koreanLearnerNote: DictCoverageMetric
  ipa: DictCoverageMetric
  /** Schema Evolution 후보 — 현재 컬럼 부재이면 null */
  audioUrl: DictCoverageMetric | null
  imageUrl: DictCoverageMetric | null
  mnemonicKo: DictCoverageMetric | null
}

// ─────────────────────────────────────────────────────────────
// 5. VRL Classification (v_level + rule_v1 비교)
// ─────────────────────────────────────────────────────────────
export interface VrlLevelDistribution {
  level: number
  /** 현재 v_level 채움 row 수 */
  classifiedCount: number
  /** vocaflow_levels.new_words_in_level 목표 */
  targetCount: number | null
  /** vocaflow_levels.cumulative_word_count */
  cumulativeTarget: number | null
}

export interface VrlClassificationStatsData {
  totalClassified: number
  totalUnclassified: number
  classifiedRatio: number
  byLevel: VrlLevelDistribution[]
  /** v_level_rule_v1 와 v_level 이 다른 row 수 (reclassified) */
  reclassifiedCount: number
}

// ─────────────────────────────────────────────────────────────
// 6. Integrity (vrl_data_integrity_concerns)
// ─────────────────────────────────────────────────────────────
export interface IntegrityDefectsData {
  open: number
  resolved: number
  total: number
  byType: Array<{ type: string; total: number; open: number }>
}

// ─────────────────────────────────────────────────────────────
// 7. Freshness (최근 분류/업데이트)
// ─────────────────────────────────────────────────────────────
export interface FreshnessData {
  /** 가장 최근 claude_classified_at */
  lastClassifiedAt: string | null
  /** 최근 7일 분류 row 수 */
  last7d: number
  /** 최근 30일 분류 row 수 */
  last30d: number
  /** 90일 이상 미분류 row 수 (stale) */
  stale90d: number
  /** 가장 최근 updated_at */
  lastUpdatedAt: string | null
}

// ─────────────────────────────────────────────────────────────
// 8. Schema Presence (확장 컬럼 존재 여부)
// ─────────────────────────────────────────────────────────────
export interface SchemaPresenceData {
  /** shared_dictionary 현 보유 컬럼 (소문자) */
  sharedDictionaryColumns: string[]
  /** shared_word_sets 현 보유 컬럼 */
  sharedWordSetsColumns: string[]
  /** Tier 1-5 컬럼별 존재 여부 */
  tierColumns: Record<string, boolean>
  /** VCB-VRL 통합 — shared_word_sets에 target_v_level_range 또는 동등 컬럼 존재 */
  vcbVrlIntegrated: boolean
}

// ─────────────────────────────────────────────────────────────
// 8b. Categorical Distributions (dict_categorical_distributions RPC)
// ─────────────────────────────────────────────────────────────
export interface DictCategoricalDistributions {
  by_primary_pos: Record<string, number>
  by_v_level: Record<string, number>
  by_v_level_rule_v1: Record<string, number>
  by_source: Record<string, number>
  by_cefr_level: Record<string, number>
  by_frequency_band: Record<string, number>
  verified_by_v_level: Record<
    string,
    { total: number; verified: number; pct: number }
  >
}

// ─────────────────────────────────────────────────────────────
// 9. Schema Evolution (Tier 1-5 제안)
// ─────────────────────────────────────────────────────────────
export type SchemaTier = 1 | 2 | 3 | 4 | 5

export interface SchemaEvolutionTier {
  tier: SchemaTier
  label: string
  rationale: string
  columns: Array<{
    name: string
    type: string
    nullable: boolean
    purpose: string
    /** 현재 존재 여부 */
    present: boolean
  }>
  /** Migration 권장 우선순위 (작을수록 우선) */
  priority: number
}

// ─────────────────────────────────────────────────────────────
// Pipeline Fitness — 4 책임 (R1-R4)
// ─────────────────────────────────────────────────────────────
export type ResponsibilityId = 'R1' | 'R2' | 'R3' | 'R4'

export interface ResponsibilityFactor {
  label: string
  /** 0~1 점수 */
  score: number
  /** factor 가중치 (sum = 1.0 권장) */
  weight: number
  /** 평가 근거 (실측 메트릭) */
  evidence: string
}

export interface ResponsibilityReadiness {
  id: ResponsibilityId
  title: string
  description: string
  /** 0~100 종합 점수 (가중 평균 × 100) */
  score: number
  /** 상태 라벨 */
  status: 'critical' | 'warning' | 'ok' | 'excellent'
  factors: ResponsibilityFactor[]
  /** 본 책임에 영향 주는 Critical Defect id 목록 */
  affectedByDefects: string[]
}

// ─────────────────────────────────────────────────────────────
// Critical Defects (자동 탐지)
// ─────────────────────────────────────────────────────────────
export type DefectPriority = 'P0' | 'P1' | 'P2' | 'P3'

export interface DefectMetrics {
  current: number | string
  target?: number | string
  unit: string
}

export interface DefectImprovement {
  action: string
  cost: string
  effect: string
  /** Backlog 항목 id (B1/D1/S1/V1 등) */
  backlogId?: string
}

export interface CriticalDefect {
  id: string
  severity: 'critical' | 'warning' | 'info'
  /** 우선순위 (P0 가장 시급) */
  priority: DefectPriority
  title: string
  /** 1줄 상세 설명 */
  description?: string
  /** 실측 evidence 한 줄 */
  evidence: string
  /** 정량 메트릭 (current vs target) */
  metrics?: DefectMetrics
  /** 영향받는 책임 id */
  impactsOn: ResponsibilityId[]
  /** 영향 받는 파이프라인명 (LCP/TextViewer/VCB/Flashcard 등) */
  pipelines?: string[]
  /** 정정 권장안 (한 줄 요약) */
  remedy: string
  /** 정정 작업 상세 (action/cost/effect/backlog) */
  improvement?: DefectImprovement
  /** Schema Evolution Tier 와 연결 (옵션) */
  schemaTier?: SchemaTier
  /** 탐지 시각 ISO string */
  detectedAt?: string
}

// ─────────────────────────────────────────────────────────────
// 9 Dimensions Score
// ─────────────────────────────────────────────────────────────
export type DimensionId =
  | 'volume'
  | 'coverage'
  | 'linguistic'
  | 'learning'
  | 'vrl_classification'
  | 'integrity'
  | 'pipeline_fitness'
  | 'freshness'
  | 'schema_evolution'

export interface DimensionScore {
  id: DimensionId
  label: string
  /** 0~100 점수 */
  score: number
  status: 'critical' | 'warning' | 'ok' | 'excellent'
  /** 가중치 0~1 */
  weight: number
  /** 핵심 1줄 요약 */
  summary: string
}

// ─────────────────────────────────────────────────────────────
// Health Snapshot — 페이지 진입점이 받는 통합 데이터
// ─────────────────────────────────────────────────────────────
export interface DictHealthSnapshot {
  /** 전체 헬스 스코어 0~100 (가중 평균) */
  overallScore: number
  overallStatus: 'critical' | 'warning' | 'ok' | 'excellent'

  dimensions: DimensionScore[]
  responsibilities: ResponsibilityReadiness[]
  defects: CriticalDefect[]
  evolution: SchemaEvolutionTier[]

  /** raw 데이터 — 차트/표 렌더용 */
  raw: {
    volume: DictVolumeData
    coverage: DictCoverageData
    linguistic: DictLinguisticData
    learning: DictLearningData
    vrlClassification: VrlClassificationStatsData
    integrity: IntegrityDefectsData
    freshness: FreshnessData
    schemaPresence: SchemaPresenceData
    /** dict_categorical_distributions RPC 결과 — Step 8 Distribution Section */
    categorical?: DictCategoricalDistributions | null
    /** Phase 2.6 — fetch 별 실패 메시지 (silent failure 가시화) */
    _errors?: string[]
  }
}
