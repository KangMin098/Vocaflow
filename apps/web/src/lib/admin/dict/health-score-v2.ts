// apps/web/src/lib/admin/dict/health-score-v2.ts
//
// 사전DB 종합 헬스 스코어 v2 — 9 차원 + 4 책임 (R1-R4) readiness.
//
// 흐름:
//   raw: DictSnapshotRaw (queries.ts)
//   → scoreDimensions(raw)       → DimensionScore[9]
//   → scoreResponsibilities(raw) → ResponsibilityReadiness[4]
//   → composeOverall(dims, resp) → DictHealthSnapshot
//
// 차원 가중치 (sum = 100%):
//   volume 5 / coverage 10 / linguistic 10 / learning 15 /
//   vrl_classification 15 / integrity 10 / pipeline_fitness 20 /
//   freshness 5 / schema_evolution 10
//
// 책임 (Pipeline Fitness 내부):
//   R1 라이브러리 추출 / R2 스크립트 추출 / R3 단어장 발행 / R4 사용자 학습
//   기본: 산술 평균 (R3 가중 옵션 — composeOverall 의 R3_BOOST 참고)

import type { DictSnapshotRaw } from './queries'
import type {
  CriticalDefect,
  DictHealthSnapshot,
  DimensionId,
  DimensionScore,
  ResponsibilityFactor,
  ResponsibilityId,
  ResponsibilityReadiness,
  SchemaEvolutionTier,
} from './types'

// ─────────────────────────────────────────────────────────────
// Status threshold
// ─────────────────────────────────────────────────────────────

export type ScoreStatus = 'critical' | 'warning' | 'ok' | 'excellent'

export function statusOf(score: number): ScoreStatus {
  if (score >= 85) return 'excellent'
  if (score >= 65) return 'ok'
  if (score >= 40) return 'warning'
  return 'critical'
}

// ─────────────────────────────────────────────────────────────
// Dimension weights (sum = 1.0)
// ─────────────────────────────────────────────────────────────

export const DIMENSION_WEIGHTS: Record<DimensionId, number> = {
  volume: 0.05,
  coverage: 0.1,
  linguistic: 0.1,
  learning: 0.15,
  vrl_classification: 0.15,
  integrity: 0.1,
  pipeline_fitness: 0.2,
  freshness: 0.05,
  schema_evolution: 0.1,
}

const DIMENSION_LABEL: Record<DimensionId, string> = {
  volume: 'Volume',
  coverage: 'Coverage',
  linguistic: 'Linguistic',
  learning: 'Learning Content',
  vrl_classification: 'VRL Classification',
  integrity: 'Integrity',
  pipeline_fitness: 'Pipeline Fitness',
  freshness: 'Freshness',
  schema_evolution: 'Schema Evolution',
}

// ─────────────────────────────────────────────────────────────
// 차원 점수화 (0~100)
// ─────────────────────────────────────────────────────────────

/**
 * 1. Volume — 단어 수 (35,000+ 충분)
 *   < 5,000 → critical, 5k-15k warning, 15k-30k ok, 30k+ excellent
 */
function scoreVolume(raw: DictSnapshotRaw): number {
  const t = raw.volume.total
  if (t >= 35000) return 100
  if (t >= 25000) return 90
  if (t >= 15000) return 75
  if (t >= 5000) return 55
  return Math.max(20, Math.round((t / 5000) * 55))
}

/**
 * 2. Coverage — 11 컬럼 채움률 평균 (cefr_confidence 포함)
 *   각 ratio * 100 의 가중 평균.
 *   meaning_ko 는 비중 ↑ (필수 핵심 컬럼).
 */
function scoreCoverage(raw: DictSnapshotRaw): number {
  const c = raw.coverage
  const items: Array<[number, number]> = [
    // [ratio, weight]
    [c.meaningKo.ratio, 0.18],
    [c.exampleEn.ratio, 0.1],
    [c.ipa.ratio, 0.08],
    [c.cefrLevel.ratio, 0.1],
    [c.cefrConfidence.ratio, 0.12], // critical defect 가중
    // register 컬럼은 현재 소비처 없음(segment 발행은 list_tags 경유) — 실자산인 segment 태그 충족률로 대체
    [c.segmentTags.ratio, 0.06],
    [c.synonyms.ratio, 0.06],
    [c.collocations.ratio, 0.08],
    [c.inflections.ratio, 0.08],
    [c.koreanLearnerNote.ratio, 0.06],
    [c.frequencyRank.ratio, 0.08],
  ]
  const sumWeight = items.reduce((s, [, w]) => s + w, 0)
  const weighted = items.reduce((s, [r, w]) => s + r * w, 0)
  return Math.round((weighted / sumWeight) * 100)
}

/**
 * 3. Linguistic — inflections by POS + IPA UK·US + polysemy
 *   가중치: inflections(by pos avg) 50% / IPA both 25% / polysemy 25%
 */
function scoreLinguistic(raw: DictSnapshotRaw): number {
  const l = raw.linguistic
  // inflections by POS — major POS (verb/noun/adj) 평균
  const major = l.inflectionsByPos.filter((p) =>
    ['verb', 'noun', 'adjective'].includes(p.primaryPos),
  )
  const inflRatio =
    major.length > 0 ? major.reduce((s, p) => s + p.ratio, 0) / major.length : 0
  // IPA both
  const ipaBothRatio =
    raw.volume.total > 0 ? l.ipa.hasBoth / raw.volume.total : 0
  // polysemy — 20%+ 면 충분 (실제 영어 다의어 비율 ~25-30%)
  const polysemyRatio = Math.min(1, l.polysemy.polysemicRatio / 0.25)

  return Math.round((inflRatio * 0.5 + ipaBothRatio * 0.25 + polysemyRatio * 0.25) * 100)
}

/**
 * 4. Learning — example/syn/coll/note/ipa + (audio/image/mnemonic if exist)
 *   schema-aware: audio_url 등 컬럼 부재면 해당 metric weight 제외 + 페널티.
 */
function scoreLearning(raw: DictSnapshotRaw): number {
  const l = raw.learning
  const baseItems: Array<[number, number]> = [
    [l.exampleEn.ratio, 0.2],
    [l.synonyms.ratio, 0.15],
    [l.collocations.ratio, 0.15],
    [l.koreanLearnerNote.ratio, 0.15],
    [l.ipa.ratio, 0.15],
  ]
  // schema-aware
  if (l.audioUrl) baseItems.push([l.audioUrl.ratio, 0.1])
  if (l.imageUrl) baseItems.push([l.imageUrl.ratio, 0.05])
  if (l.mnemonicKo) baseItems.push([l.mnemonicKo.ratio, 0.05])

  const sumW = baseItems.reduce((s, [, w]) => s + w, 0)
  const weighted = baseItems.reduce((s, [r, w]) => s + r * w, 0)
  let base = (weighted / sumW) * 100

  // schema penalty — audio_url 부재는 R4 학습 영향 큼 → -8점
  if (!l.audioUrl) base -= 8
  if (!l.imageUrl) base -= 3
  if (!l.mnemonicKo) base -= 2

  return Math.max(0, Math.min(100, Math.round(base)))
}

/**
 * 5. VRL Classification — v_level 채움률 + reclassified ratio
 */
function scoreVrlClassification(raw: DictSnapshotRaw): number {
  const v = raw.vrlClassification
  const fillScore = v.classifiedRatio * 100
  // Reclassified ratio — 분류 정정 활동 신호. 30% 면 amber.
  const reclassRatio =
    v.totalClassified > 0 ? v.reclassifiedCount / v.totalClassified : 0
  const adjustment = reclassRatio > 0.3 ? -5 : reclassRatio > 0.15 ? -2 : 0
  return Math.max(0, Math.min(100, Math.round(fillScore + adjustment)))
}

/**
 * 6. Integrity — open 결함 0 = 100. 1+ → 비례 감점.
 */
function scoreIntegrity(raw: DictSnapshotRaw): number {
  const open = raw.integrity.open
  if (open === 0) return 100
  if (open <= 5) return 90
  if (open <= 20) return 70
  if (open <= 50) return 50
  return Math.max(20, 100 - open)
}

/**
 * 7. Pipeline Fitness — R1-R4 가중 평균 (산술 + R3 우선).
 *   composeOverall 에서 별도 계산 후 주입.
 */
function scorePipelineFitness(responsibilities: ResponsibilityReadiness[]): number {
  if (responsibilities.length === 0) return 0
  // R3 가중 1.3 (본질 페인 — 단어장 발행)
  const weights: Record<ResponsibilityId, number> = {
    R1: 1.0,
    R2: 1.0,
    R3: 1.3,
    R4: 1.0,
  }
  const sumW = responsibilities.reduce((s, r) => s + weights[r.id], 0)
  const weighted = responsibilities.reduce((s, r) => s + r.score * weights[r.id], 0)
  return Math.round(weighted / sumW)
}

/**
 * 8. Freshness — 최근 30일 분류 활동 + 90일+ stale 감점
 */
function scoreFreshness(raw: DictSnapshotRaw): number {
  const f = raw.freshness
  // 최근 30일 분류 1,000건 이상 = excellent
  let base = Math.min(80, Math.round((f.last30d / 1000) * 80))
  // 최근 7일 활동 + 20
  if (f.last7d > 100) base += 20
  else if (f.last7d > 10) base += 10
  // stale 감점
  if (f.stale90d > 5000) base -= 15
  else if (f.stale90d > 1000) base -= 5
  return Math.max(0, Math.min(100, base))
}

/**
 * 9. Schema Evolution — Tier 1-5 컬럼 보유 비율
 *   Tier 1 (audio_url 등 7개) 가장 중요
 */
function scoreSchemaEvolution(raw: DictSnapshotRaw): number {
  const tc = raw.schemaPresence.tierColumns
  const tier1Cols = [
    'audio_url',
    'audio_url_uk',
    'audio_url_us',
    'image_url',
    'mnemonic_ko',
    'last_quality_audit_at',
    'usage_count_30d',
  ]
  const tier2Cols = ['common_errors_ko', 'usage_warning_ko', 'related_words']
  const tier1Have = tier1Cols.filter((c) => tc[c]).length
  const tier2Have = tier2Cols.filter((c) => tc[c]).length

  const tier1Score = (tier1Have / tier1Cols.length) * 70
  const tier2Score = (tier2Have / tier2Cols.length) * 30
  return Math.round(tier1Score + tier2Score)
}

// ─────────────────────────────────────────────────────────────
// 4 책임 (R1-R4) factor 계산
// ─────────────────────────────────────────────────────────────

function r1LibraryExtraction(raw: DictSnapshotRaw): ResponsibilityReadiness {
  const c = raw.coverage
  const v = raw.vrlClassification

  const factors: ResponsibilityFactor[] = [
    {
      label: 'word JOIN 가능 (meaning 채움)',
      score: c.meaningKo.ratio,
      weight: 0.15,
      evidence: `meaning_ko ${(c.meaningKo.ratio * 100).toFixed(1)}%`,
    },
    {
      label: 'meaning 채움',
      score: c.meaningKo.ratio,
      weight: 0.2,
      evidence: `${c.meaningKo.filled.toLocaleString()} / ${c.total.toLocaleString()}`,
    },
    {
      label: 'cefr_confidence (LV 수식 35% 영향)',
      score: c.cefrConfidence.ratio,
      weight: 0.2,
      evidence:
        c.cefrConfidence.ratio === 0
          ? '🚨 100% NULL — LV 수식 무효'
          : `${(c.cefrConfidence.ratio * 100).toFixed(1)}%`,
    },
    {
      label: 'v_level 채움 (Krashen i+1)',
      score: v.classifiedRatio,
      weight: 0.2,
      evidence: `${(v.classifiedRatio * 100).toFixed(1)}% — ${v.totalUnclassified.toLocaleString()} 미분류`,
    },
    {
      label: 'frequency_rank',
      score: c.frequencyRank.ratio,
      weight: 0.15,
      evidence: `${(c.frequencyRank.ratio * 100).toFixed(1)}%`,
    },
    {
      label: 'book_coverage (proxy: verified)',
      score: c.verified.ratio,
      weight: 0.1,
      evidence: `verified=true ${(c.verified.ratio * 100).toFixed(1)}%`,
    },
  ]

  const score = aggregateFactors(factors)
  const affectedByDefects: string[] = []
  if (c.cefrConfidence.ratio === 0) affectedByDefects.push('cefr_confidence_null')
  if (v.classifiedRatio < 0.5) affectedByDefects.push('v_level_unclassified')

  return {
    id: 'R1',
    title: 'R1 — 라이브러리 단어 추출',
    description: 'LCP 책 chapter 진입 시 단어 추출 (adaptive-extract.ts)',
    score,
    status: statusOf(score),
    factors,
    affectedByDefects,
  }
}

function r2ScriptExtraction(raw: DictSnapshotRaw): ResponsibilityReadiness {
  const c = raw.coverage
  const l = raw.linguistic
  // inflections by primary POS — verb/noun/adjective
  const verbInfl = l.inflectionsByPos.find((p) => p.primaryPos === 'verb')?.ratio ?? 0
  const nounInfl = l.inflectionsByPos.find((p) => p.primaryPos === 'noun')?.ratio ?? 0
  const adjInfl = l.inflectionsByPos.find((p) => p.primaryPos === 'adjective')?.ratio ?? 0
  const avgInfl = (verbInfl + nounInfl + adjInfl) / 3

  const factors: ResponsibilityFactor[] = [
    {
      label: 'inflections by POS (lemma matching)',
      score: avgInfl,
      weight: 0.4,
      evidence: `verb ${(verbInfl * 100).toFixed(0)}% · noun ${(nounInfl * 100).toFixed(0)}% · adj ${(adjInfl * 100).toFixed(0)}%`,
    },
    {
      label: 'lemma (word as lemma)',
      score: c.meaningKo.ratio, // surrogate — lemma exists if word row exists
      weight: 0.25,
      evidence: `${c.total.toLocaleString()} entries`,
    },
    {
      label: 'meaning',
      score: c.meaningKo.ratio,
      weight: 0.2,
      evidence: `${(c.meaningKo.ratio * 100).toFixed(1)}%`,
    },
    {
      label: 'pos (POS NOT NULL)',
      score: 1.0, // pos column is NOT NULL by constraint
      weight: 0.15,
      evidence: '100% (NOT NULL 제약)',
    },
  ]

  const score = aggregateFactors(factors)
  const affectedByDefects: string[] = []
  if (nounInfl < 0.7) affectedByDefects.push('noun_inflections_gap')
  if (adjInfl < 0.7) affectedByDefects.push('adj_inflections_gap')

  return {
    id: 'R2',
    title: 'R2 — 스크립트 단어 추출',
    description: '사용자 텍스트 토큰화 후 lemma 매칭 (winkNLP + inflections)',
    score,
    status: statusOf(score),
    factors,
    affectedByDefects,
  }
}

function r3WordSetPublish(raw: DictSnapshotRaw): ResponsibilityReadiness {
  const c = raw.coverage
  const v = raw.vrlClassification
  const integrated = raw.schemaPresence.vcbVrlIntegrated
  const hasListTags = c.total > 0 ? 1.0 : 0 // list_tags NOT NULL 제약

  const factors: ResponsibilityFactor[] = [
    {
      label: 'cefr_level 보유',
      score: c.cefrLevel.ratio,
      weight: 0.1,
      evidence: `${(c.cefrLevel.ratio * 100).toFixed(1)}%`,
    },
    {
      // V-Level 단어장 발행 동작 여부 — 구 "스키마 컬럼 존재?"(구조적 항상 0) 대신 실동작 반영.
      //   발행·추천은 slug(auto-vlevel-v*)+curation_query 로 동작 중(2026-07-08 진단) → 발행 성립.
      //   전용 컬럼 부재는 슬러그 결합·인덱스 부재의 견고성 부채(-0.15) 로만 감점, B1 이연.
      label: 'V-Level 단어장 발행 동작',
      score: integrated ? 1.0 : 0.85,
      weight: 0.3,
      evidence: integrated
        ? '✅ shared_word_sets 에 V-Level 전용 컬럼 존재'
        : '동작 중 (auto-vlevel V1~V9 + 도서 챕터 세트) · 전용 컬럼 부재는 견고성 부채(B1)',
    },
    {
      label: 'v_level 채움',
      score: v.classifiedRatio,
      weight: 0.15,
      evidence: `${(v.classifiedRatio * 100).toFixed(1)}%`,
    },
    {
      // segment 자동 단어장은 register 가 아니라 list_tags(bsl/bel/tsl/nawl/moel)로 발행됨
      // — specialty 4종(902 row) 이미 이 경로로 발행 완료. register 백필은 소비처 생길 때(D2 이연).
      label: 'segment 태그 풀 (bsl/nawl/moel 등)',
      score: c.segmentTags.ratio,
      weight: 0.15,
      evidence: `${c.segmentTags.filled.toLocaleString()} row (목표 3,000 대비 ${(c.segmentTags.ratio * 100).toFixed(0)}%)`,
    },
    {
      label: 'list_tags (NGSL/AWL/BSL)',
      score: hasListTags,
      weight: 0.1,
      evidence: 'list_tags NOT NULL',
    },
    {
      label: 'verified=true (감수 완료)',
      score: c.verified.ratio,
      weight: 0.1,
      evidence: `${(c.verified.ratio * 100).toFixed(1)}%`,
    },
    {
      label: 'ipa (발음)',
      score: c.ipa.ratio,
      weight: 0.05,
      evidence: `${(c.ipa.ratio * 100).toFixed(1)}%`,
    },
    {
      label: 'example_en',
      score: c.exampleEn.ratio,
      weight: 0.05,
      evidence: `${(c.exampleEn.ratio * 100).toFixed(1)}%`,
    },
  ]

  const score = aggregateFactors(factors)
  const affectedByDefects: string[] = []
  if (!integrated) affectedByDefects.push('vcb_vrl_not_integrated')
  if (c.segmentTags.ratio < 0.5) affectedByDefects.push('segment_tags_underdeveloped')
  if (v.classifiedRatio < 0.5) affectedByDefects.push('v_level_unclassified')

  return {
    id: 'R3',
    title: 'R3 — 공용 단어장 발행',
    description: 'VCB Pipeline — V-Level/CEFR/Track/Domain 별 단어장 빌드',
    score,
    status: statusOf(score),
    factors,
    affectedByDefects,
  }
}

function r4UserLearning(raw: DictSnapshotRaw): ResponsibilityReadiness {
  const c = raw.coverage
  const l = raw.linguistic
  const lr = raw.learning

  const factors: ResponsibilityFactor[] = [
    {
      label: 'meaning_ko (필수 핵심)',
      score: c.meaningKo.ratio,
      weight: 0.2,
      evidence: `${(c.meaningKo.ratio * 100).toFixed(1)}%`,
    },
    {
      label: 'ipa (발음)',
      score: c.ipa.ratio,
      weight: 0.1,
      evidence: `${(c.ipa.ratio * 100).toFixed(1)}%`,
    },
    {
      label: 'example_en',
      score: c.exampleEn.ratio,
      weight: 0.1,
      evidence: `${(c.exampleEn.ratio * 100).toFixed(1)}%`,
    },
    {
      label: 'synonyms',
      score: c.synonyms.ratio,
      weight: 0.05,
      evidence: `${(c.synonyms.ratio * 100).toFixed(1)}%`,
    },
    {
      label: 'collocations',
      score: c.collocations.ratio,
      weight: 0.1,
      evidence: `${(c.collocations.ratio * 100).toFixed(1)}%`,
    },
    {
      label: 'korean_learner_note',
      score: c.koreanLearnerNote.ratio,
      weight: 0.1,
      evidence: `${(c.koreanLearnerNote.ratio * 100).toFixed(1)}%`,
    },
    {
      label: 'audio_url (SpellForge/WordBlitz)',
      score: lr.audioUrl?.ratio ?? 0,
      weight: 0.15,
      evidence: lr.audioUrl
        ? `${(lr.audioUrl.ratio * 100).toFixed(1)}%`
        : '🚨 컬럼 부재 (Schema Tier 1 미적용)',
    },
    {
      label: 'inflections',
      score: c.inflections.ratio,
      weight: 0.1,
      evidence: `${(c.inflections.ratio * 100).toFixed(1)}%`,
    },
    {
      label: 'polysemy (senses ≥ 2)',
      score: Math.min(1, l.polysemy.polysemicRatio / 0.25),
      weight: 0.1,
      evidence: `${(l.polysemy.polysemicRatio * 100).toFixed(1)}% (목표 25%)`,
    },
  ]

  const score = aggregateFactors(factors)
  const affectedByDefects: string[] = []
  if (!lr.audioUrl) affectedByDefects.push('audio_url_missing')
  if (c.koreanLearnerNote.ratio < 0.5) affectedByDefects.push('learner_note_gap')

  return {
    id: 'R4',
    title: 'R4 — 사용자 학습 콘텐츠',
    description: 'Flashcard/SpellForge/WordBlitz/Dictation 학습 자산',
    score,
    status: statusOf(score),
    factors,
    affectedByDefects,
  }
}

function aggregateFactors(factors: ResponsibilityFactor[]): number {
  const sumW = factors.reduce((s, f) => s + f.weight, 0)
  if (sumW === 0) return 0
  const weighted = factors.reduce((s, f) => s + f.score * f.weight, 0)
  return Math.max(0, Math.min(100, Math.round((weighted / sumW) * 100)))
}

// ─────────────────────────────────────────────────────────────
// 통합 entry
// ─────────────────────────────────────────────────────────────

export function scoreDimensions(raw: DictSnapshotRaw): DimensionScore[] {
  // Pipeline Fitness 는 책임 점수 의존이므로 마지막에 채움
  const responsibilities = scoreResponsibilities(raw)
  const pipelineFitnessScore = scorePipelineFitness(responsibilities)

  const dimensions: DimensionScore[] = [
    dim('volume', scoreVolume(raw), summaryVolume(raw)),
    dim('coverage', scoreCoverage(raw), summaryCoverage(raw)),
    dim('linguistic', scoreLinguistic(raw), summaryLinguistic(raw)),
    dim('learning', scoreLearning(raw), summaryLearning(raw)),
    dim(
      'vrl_classification',
      scoreVrlClassification(raw),
      summaryVrlClassification(raw),
    ),
    dim('integrity', scoreIntegrity(raw), summaryIntegrity(raw)),
    dim(
      'pipeline_fitness',
      pipelineFitnessScore,
      `R1 ${responsibilities[0]?.score ?? 0} · R2 ${responsibilities[1]?.score ?? 0} · R3 ${responsibilities[2]?.score ?? 0} · R4 ${responsibilities[3]?.score ?? 0}`,
    ),
    dim('freshness', scoreFreshness(raw), summaryFreshness(raw)),
    dim('schema_evolution', scoreSchemaEvolution(raw), summarySchemaEvolution(raw)),
  ]
  return dimensions
}

export function scoreResponsibilities(
  raw: DictSnapshotRaw,
): ResponsibilityReadiness[] {
  return [
    r1LibraryExtraction(raw),
    r2ScriptExtraction(raw),
    r3WordSetPublish(raw),
    r4UserLearning(raw),
  ]
}

function dim(
  id: DimensionId,
  score: number,
  summary: string,
): DimensionScore {
  return {
    id,
    label: DIMENSION_LABEL[id],
    score,
    status: statusOf(score),
    weight: DIMENSION_WEIGHTS[id],
    summary,
  }
}

// ─────────────────────────────────────────────────────────────
// 1-line summary helpers (per dimension)
// ─────────────────────────────────────────────────────────────

function summaryVolume(raw: DictSnapshotRaw): string {
  return `${raw.volume.total.toLocaleString()} entries · ${raw.volume.byPrimaryPos[0]?.pos ?? '—'} ${raw.volume.byPrimaryPos[0]?.count ?? 0}`
}
function summaryCoverage(raw: DictSnapshotRaw): string {
  return `meaning ${pct(raw.coverage.meaningKo.ratio)} · example ${pct(raw.coverage.exampleEn.ratio)} · cefr_conf ${pct(raw.coverage.cefrConfidence.ratio)}`
}
function summaryLinguistic(raw: DictSnapshotRaw): string {
  const v = raw.linguistic.inflectionsByPos.find((p) => p.primaryPos === 'verb')
  const n = raw.linguistic.inflectionsByPos.find((p) => p.primaryPos === 'noun')
  return `inflections verb ${pct(v?.ratio ?? 0)} · noun ${pct(n?.ratio ?? 0)} · polysemy ${pct(raw.linguistic.polysemy.polysemicRatio)}`
}
function summaryLearning(raw: DictSnapshotRaw): string {
  const audio = raw.learning.audioUrl ? `audio ${pct(raw.learning.audioUrl.ratio)}` : 'audio_url 컬럼 부재'
  return `note ${pct(raw.learning.koreanLearnerNote.ratio)} · ${audio}`
}
function summaryVrlClassification(raw: DictSnapshotRaw): string {
  return `${raw.vrlClassification.totalClassified.toLocaleString()} / ${(
    raw.vrlClassification.totalClassified + raw.vrlClassification.totalUnclassified
  ).toLocaleString()} (${pct(raw.vrlClassification.classifiedRatio)})`
}
function summaryIntegrity(raw: DictSnapshotRaw): string {
  return `open ${raw.integrity.open} · resolved ${raw.integrity.resolved}`
}
function summaryFreshness(raw: DictSnapshotRaw): string {
  return `최근 7일 ${raw.freshness.last7d} · 30일 ${raw.freshness.last30d} · stale90d ${raw.freshness.stale90d}`
}
function summarySchemaEvolution(raw: DictSnapshotRaw): string {
  const tc = raw.schemaPresence.tierColumns
  const tier1 = ['audio_url', 'image_url', 'mnemonic_ko'].filter((c) => tc[c]).length
  return `Tier 1 보유 ${tier1}/3 (audio/image/mnemonic)`
}

function pct(r: number): string {
  return `${(r * 100).toFixed(1)}%`
}

// ─────────────────────────────────────────────────────────────
// composeOverall — 9 차원 + 4 책임 → 최종 snapshot
// ─────────────────────────────────────────────────────────────

export function composeOverallHealth(
  raw: DictSnapshotRaw,
  defects: CriticalDefect[],
  evolution: SchemaEvolutionTier[],
): DictHealthSnapshot {
  const responsibilities = scoreResponsibilities(raw)
  const dimensions = scoreDimensions(raw)

  // 가중 평균 (0-100)
  const overall = dimensions.reduce((s, d) => s + d.score * d.weight, 0)
  const overallScore = Math.round(overall)

  return {
    overallScore,
    overallStatus: statusOf(overallScore),
    dimensions,
    responsibilities,
    defects,
    evolution,
    raw,
  }
}
