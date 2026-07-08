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
  /** 완료 항목 — 목록 하단 '완료' 그룹으로 이동, 집계 제외 */
  status?: 'open' | 'done'
  /** 완료 근거 한 줄 (실측 수치 포함) */
  doneNote?: string
}

export const BACKLOG_ITEMS: BacklogItem[] = [
  // ─── P0 (4) ───
  {
    id: 'B1',
    priority: 'P3',
    title: 'VCB-VRL 전용 컬럼 (견고성 — 이연)',
    oneLine:
      '2026-07-08 진단: V-Level 발행·추천은 slug(auto-vlevel-v*)+curation_query 로 이미 동작(9+260세트) — 전용 컬럼은 슬러그 결합 해소용. 세트 대량화/슬러그 개편 시 도입',
    affects: ['R3'],
    effort: '6-9 turns (마이그레이션 + run-create + RPC 전환)',
    value: '슬러그 관례 결합 해소 · 인덱스/무결성 (기능 효과는 이미 달성)',
    defectId: 'vcb_vrl_not_integrated',
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
    status: 'done',
    doneNote: '완료 — cefr_confidence 99.6% 채움 (45,496 중 NULL 204 · 2026-07-06 실측)',
  },
  {
    id: 'D2',
    priority: 'P3',
    title: 'register 백필 (소비처 발생 시)',
    oneLine:
      '2026-07-06 진단: segment 발행은 list_tags 로 이미 동작(specialty 4종) · register 는 현재 무소비 컬럼 — 격식 표시 UI 등 소비처 확정 시 재개',
    affects: ['R4'],
    effort: '소비처 확정 후 산정',
    value: '격식(formal/informal) 표시 품질 — 현재 효과 0',
    defectId: 'segment_tags_underdeveloped',
  },
  {
    id: 'V1',
    priority: 'P0',
    title: 'V-Level 분류 (VRL v3 Round 1~10)',
    oneLine: '전 레벨 reclassification + verification (Hybrid 4-step 포함)',
    affects: ['R1', 'R3'],
    effort: '150+ turns',
    value: 'VRL 100% · Krashen i+1 활용 가능',
    defectId: 'v_level_majority_unclassified',
    status: 'done',
    doneNote: '완료 — 45,496 row 100% 분류 (v_level NULL 0 · 2026-07-06 실측)',
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
    value: 'R4 polysemy 17.5% → 25%+',
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
    status: 'done',
    doneNote: '완료 — inflected_forms 전역 권위화 15,210 lemma (규칙형 검증+권위 불규칙 · 도서 회수율 98.75%)',
  },
  {
    id: 'D5',
    priority: 'P1',
    title: 'verified 감수 (상위 V-Level 우선)',
    oneLine: '고급 레벨 우선 사람 감수 큐레이션 (실측 비율은 결함 카드 참조)',
    affects: ['R3', 'R1'],
    effort: '20-40 turns',
    value: 'R3 +8 · verified 26.8% → 60%+',
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
    oneLine: 'C2 ~55% 일부 → C1 reclassify (Round 후속 · 실측은 결함 카드)',
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
    status: 'done',
    doneNote: '완료 — 진단 5종 시드(base·track 3종·comprehensive 135+50문항) + /diagnostic 프런트 wire-up',
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
  /** 미완료(open) 항목 수 — 헤더 카운트의 기준 */
  total: number
  /** 완료 항목 수 */
  done: number
  byPriority: Record<DefectPriority, number>
  byResponsibility: Record<ResponsibilityId, number>
  bestRoi: BacklogItem | null
  corePain: BacklogItem | null
}

/** 완료 항목은 우선순위/책임 집계와 하이라이트에서 제외 — 남은 일만 센다. */
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
  let open = 0
  let done = 0

  for (const it of items) {
    if (it.status === 'done') {
      done += 1
      continue
    }
    open += 1
    byPriority[it.priority] += 1
    for (const r of it.affects) byResponsibility[r] += 1
    if (it.isBestRoi && !bestRoi) bestRoi = it
    if (it.isCorePain && !corePain) corePain = it
  }

  return { total: open, done, byPriority, byResponsibility, bestRoi, corePain }
}
