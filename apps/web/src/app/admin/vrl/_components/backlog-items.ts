// apps/web/src/app/admin/vrl/_components/backlog-items.ts
//
// Backlog 17 items — 사전DB 모니터링 v3 Section 8 데이터 출처.
// P0 4 / P1 7 / P2 3 / P3 3.

import type { ResponsibilityId, DefectPriority } from '@/lib/admin/dict/types'

export interface BacklogItem {
  id: string
  priority: DefectPriority
  title: string
  /** 한 줄 설명 */
  oneLine: string
  affects: ResponsibilityId[]
  /** 작업량 (예: '2-4 turns', '150+ turns') */
  effort: string
  /** 기대 효과 (예: 'R3 35→75+') */
  value: string
  /** 관련 결함 id (CriticalDefectsSection 연결) */
  defectId?: string
  /** R3 본질 페인 부각 플래그 */
  isCorePain?: boolean
  /** Best ROI 마커 */
  isBestRoi?: boolean
  /** Schema Tier — Migration 항목인 경우 */
  schemaTier?: 1 | 2 | 3 | 4 | 5
}

export const BACKLOG_ITEMS: BacklogItem[] = [
  // ─── P0 (4) ───
  {
    id: 'B1',
    priority: 'P0',
    title: 'VCB-VRL 통합',
    oneLine: 'shared_word_sets 에 target_v_level_range 추가 + VCB run-create 통합',
    affects: ['R3'],
    effort: '6-9 turns',
    value: 'R3 35 → 75+ · V-Level 단어장 자동 발행',
    defectId: 'vcb_vrl_not_integrated',
    isCorePain: true,
  },
  {
    id: 'D1',
    priority: 'P0',
    title: 'cefr_confidence 백필',
    oneLine: 'list_tags + ngsl_sfi 기반 신뢰도 동적 계산 또는 단일값 시드',
    affects: ['R1', 'R3'],
    effort: '2-4 turns',
    value: 'R1 +12 · LV 수식 35% 가중치 활성화',
    defectId: 'cefr_confidence_null',
  },
  {
    id: 'D2',
    priority: 'P0',
    title: 'register Claude batch',
    oneLine: 'business/academic/formal/informal segment 자동 추론 백필',
    affects: ['R3'],
    effort: '8-15 turns',
    value: 'R3 +12 · segment 자동 단어장',
    defectId: 'register_critical_null',
  },
  {
    id: 'V1',
    priority: 'P0',
    title: 'V-Level 분류 잔여 (R7-R10)',
    oneLine: 'L4 / L9 / L10 / L11 reclassification — 27,796 rows 잔여',
    affects: ['R1', 'R3'],
    effort: '150+ turns',
    value: 'VRL 28% → 90%+ · Krashen i+1 활용 가능',
    defectId: 'v_level_majority_unclassified',
  },

  // ─── P1 (7) ───
  {
    id: 'M2',
    priority: 'P1',
    title: 'Tier 2 Migration — Korean Learner',
    oneLine: 'common_errors_ko + usage_warning_ko + konglish_alert 컬럼 추가',
    affects: ['R4'],
    effort: '1-2 turns',
    value: 'Schema +3 cols · 한국 학습자 특화 자산 활성화',
    isBestRoi: true,
    schemaTier: 2,
  },
  {
    id: 'D3',
    priority: 'P1',
    title: 'polysemy enrichment',
    oneLine: '다의어 senses 분할 (Claude pos별 분리)',
    affects: ['R4'],
    effort: '12-25 turns',
    value: 'R4 polysemy 20.6% → 30%+',
    defectId: 'polysemy_underdeveloped',
  },
  {
    id: 'D4',
    priority: 'P1',
    title: 'noun/adj inflections enrichment',
    oneLine: 'plural/possessive + comparative/superlative 추가 (룰 기반)',
    affects: ['R2'],
    effort: '4-8 turns',
    value: 'R2 +5 · lemma 매칭 정확도',
    defectId: 'noun_inflections_gap',
  },
  {
    id: 'D5',
    priority: 'P1',
    title: 'verified 감수 (L9/L10 우선)',
    oneLine: 'L9 41.83% / L10 17.23% — 사람 감수 우선 큐레이션',
    affects: ['R3', 'R1'],
    effort: '20-40 turns',
    value: 'R3 +8 · verified 32% → 60%+',
    defectId: 'verified_low_advanced_levels',
  },
  {
    id: 'D6',
    priority: 'P1',
    title: 'korean_learner_note 백필',
    oneLine: 'Konglish 경고, 한국인 학습자 특이 학습 메모',
    affects: ['R4'],
    effort: '10-15 turns',
    value: 'R4 +5 · 한국인 학습자 특화',
    defectId: 'korean_learner_note_gap',
  },
  {
    id: 'D7',
    priority: 'P1',
    title: 'collocations enrichment',
    oneLine: 'set phrase + collocation (Claude 빈도 상위 우선)',
    affects: ['R4'],
    effort: '15-30 turns',
    value: 'R4 +5 · 자연 결합 학습',
    defectId: 'collocations_underdeveloped',
  },
  {
    id: 'D8',
    priority: 'P1',
    title: 'list_tags NGSL Project 재import',
    oneLine: 'NDL / NAWL / BSL 다중 리스트 batch 재import',
    affects: ['R3'],
    effort: '2-5 turns',
    value: 'R3 +5 · segment 가중치 활성화',
    defectId: 'list_tags_majority_empty',
  },

  // ─── P2 (3) ───
  {
    id: 'D9',
    priority: 'P2',
    title: 'CEFR 분포 재균형',
    oneLine: 'C2 56.2% 일부 → C1 reclassify (Round 후속)',
    affects: ['R1', 'R3'],
    effort: '5-10 turns',
    value: 'CEFR 분포 정규화',
    defectId: 'cefr_c2_overrepresented',
  },
  {
    id: 'M3',
    priority: 'P2',
    title: 'Tier 3 Migration — Vocab Network',
    oneLine: 'related_words + confusion_pairs 컬럼 추가',
    affects: ['R1', 'R4'],
    effort: '1-2 turns',
    value: 'Schema +2 cols · 의미망 활용 기반',
    schemaTier: 3,
  },
  {
    id: 'M4',
    priority: 'P2',
    title: 'Tier 4 Meta Ops 잔여',
    oneLine: 'usage_count_30d + user_difficulty_avg 컬럼 추가',
    affects: ['R3', 'R4'],
    effort: '1-2 turns',
    value: 'Schema +2 cols · 실 사용 데이터 추적',
    schemaTier: 4,
  },

  // ─── P3 (3) ───
  {
    id: 'C1',
    priority: 'P3',
    title: '진단 시스템 시드',
    oneLine: 'vrl_diagnostic_tests + vrl_diagnostic_questions (V-Level별 시그니처 단어)',
    affects: ['R1'],
    effort: '3-5 turns',
    value: '사용자 V-Level 자가 진단 가능',
  },
  {
    id: 'S1',
    priority: 'P3',
    title: 'TTS audio batch',
    oneLine: 'audio_url / audio_url_uk / audio_url_us 값 채움 (Tier 1 컬럼 ✅)',
    affects: ['R4'],
    effort: '1년+ (점진)',
    value: 'R4 +15 · SpellForge/WordBlitz 청각 학습 활성화',
  },
  {
    id: 'M5',
    priority: 'P3',
    title: 'Tier 5 Migration — Content Extension',
    oneLine: 'pronunciation_notes + etymology_brief + contextual_examples',
    affects: ['R4'],
    effort: '1-2 turns',
    value: 'Schema +3 cols · 심화 학습 콘텐츠',
    schemaTier: 5,
  },
]

export interface BacklogSummary {
  total: number
  byPriority: Record<DefectPriority, number>
  byResponsibility: Record<ResponsibilityId, number>
  bestRoi: BacklogItem | null
  corePain: BacklogItem | null
}

export function summarizeBacklog(items: BacklogItem[]): BacklogSummary {
  const byPriority: Record<DefectPriority, number> = { P0: 0, P1: 0, P2: 0, P3: 0 }
  const byResponsibility: Record<ResponsibilityId, number> = {
    R1: 0,
    R2: 0,
    R3: 0,
    R4: 0,
  }
  let bestRoi: BacklogItem | null = null
  let corePain: BacklogItem | null = null

  for (const it of items) {
    byPriority[it.priority] += 1
    for (const r of it.affects) byResponsibility[r] += 1
    if (it.isBestRoi && !bestRoi) bestRoi = it
    if (it.isCorePain && !corePain) corePain = it
  }

  return { total: items.length, byPriority, byResponsibility, bestRoi, corePain }
}
