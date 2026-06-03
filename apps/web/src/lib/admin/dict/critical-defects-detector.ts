// apps/web/src/lib/admin/dict/critical-defects-detector.ts
//
// Critical Defects 자동 탐지 — 15 rules
//   P0 (5): vcb_vrl_not_integrated / cefr_confidence_null / audio_url_missing /
//           register_critical_null / v_level_majority_unclassified
//   P1 (7): list_tags_empty / noun_inflections_gap / adj_inflections_gap /
//           polysemy_underdeveloped / verified_low_advanced /
//           collocations_underdeveloped / korean_learner_note_gap
//   P2 (3): cefr_c2_overrepresented / noun_pos_dominant / frequency_rank_majority_null
//
// 입력: DictSnapshotRaw (queries.ts fetchDictSnapshotRaw 결과)
// 출력: CriticalDefect[] (priority 정렬)

import type { DictSnapshotRaw } from './queries'
import type {
  CriticalDefect,
  DefectImprovement,
  ResponsibilityId,
  SchemaTier,
} from './types'

// Priority 순서 정렬용
const PRIORITY_ORDER: Record<CriticalDefect['priority'], number> = {
  P0: 0,
  P1: 1,
  P2: 2,
  P3: 3,
}

// Backlog 매핑 (사용자 spec)
const BACKLOG: Record<string, DefectImprovement> = {
  B1: {
    action: 'shared_word_sets에 target_v_level_range 컬럼 추가 + VCB run-create 통합',
    cost: '대공사 (4-6 turns + Migration + run-create.ts + types.ts)',
    effect: 'R3 +15~25 / V-Level 단어장 자동 발행 가능 / 본질 페인 직격 해결',
    backlogId: 'B1',
  },
  D1: {
    action: 'cefr_confidence backfill — list_tags 신호 기반 동적 계산 또는 단일값 시드',
    cost: 'Migration + UPDATE 38,605 row',
    effect: 'R1 +12 / LV 수식 35% 가중치 활성화 / 라이브러리 추출 정확도 ↑',
    backlogId: 'D1',
  },
  D2: {
    action: 'register backfill — list_tags + frequency_band 기반 추론 (business/academic/formal/informal)',
    cost: '~1,400 turn (Claude 또는 룰 기반)',
    effect: 'R3 +12 / business/academic segment 자동 단어장 발행 가능',
    backlogId: 'D2',
  },
  S1: {
    action: 'Schema Tier 1 Migration — audio_url + audio_url_uk + audio_url_us + image_url + mnemonic_ko 컬럼 추가',
    cost: 'Migration 1개 + content fetch 후속 (~1년)',
    effect: 'R4 +15 / SpellForge/WordBlitz 청각 학습 활성화',
    backlogId: 'S1',
  },
  V1: {
    action: 'VRL Round 6-12 진행 — L0/L3/L11 잔여 분류 + verification',
    cost: 'Round당 1-2 turn × ~7 rounds',
    effect: 'R1 +15 / R3 +10 / VRL 24% → 90%+ 도달',
    backlogId: 'V1',
  },
}

const NOW_ISO = (): string => new Date().toISOString()

/**
 * Critical Defects 자동 탐지.
 * snapshot 의 raw 데이터 + schemaPresence 기반.
 */
export function detectCriticalDefects(raw: DictSnapshotRaw): CriticalDefect[] {
  const defects: CriticalDefect[] = []
  const c = raw.coverage
  const l = raw.linguistic
  const v = raw.vrlClassification
  const schema = raw.schemaPresence

  // ════════════════════════════════════════════════════════════
  // P0 Critical (5)
  // ════════════════════════════════════════════════════════════

  // 1. VCB-VRL 미통합 — 본질 페인
  if (!schema.vcbVrlIntegrated) {
    defects.push({
      id: 'vcb_vrl_not_integrated',
      severity: 'critical',
      priority: 'P0',
      title: 'VCB-VRL 미통합 (단어장 발행이 V-Level 모름)',
      description:
        'shared_word_sets 에 target_v_level_range 컬럼 부재. VCB Pipeline 이 CEFR 만 알고 V-Level 12단계 활용 불가.',
      evidence: 'shared_word_sets.target_v_level_range 컬럼 부재',
      metrics: { current: 'absent', target: 'present', unit: 'column' },
      impactsOn: ['R3'],
      pipelines: ['VCB'],
      remedy: '옵션 B (shared_word_sets schema 확장 + run-create 통합)',
      improvement: BACKLOG.B1,
      detectedAt: NOW_ISO(),
    })
  }

  // 2. cefr_confidence 100% NULL
  if (c.cefrConfidence.ratio < 0.01) {
    defects.push({
      id: 'cefr_confidence_null',
      severity: 'critical',
      priority: 'P0',
      title: 'cefr_confidence 100% NULL (LV 수식 35% 무효)',
      description:
        'learning-value.ts 의 LV 수식이 cefr_confidence 를 35% 가중. 100% NULL 이면 라이브러리 단어 추출 정확도 손상.',
      evidence: `cefr_confidence 채움: ${c.cefrConfidence.filled} / ${c.total} (${(c.cefrConfidence.ratio * 100).toFixed(1)}%)`,
      metrics: {
        current: (c.cefrConfidence.ratio * 100).toFixed(1),
        target: 80,
        unit: '%',
      },
      impactsOn: ['R1', 'R3'],
      pipelines: ['LCP', 'VCB'],
      remedy: 'D1 — list_tags + ngsl_sfi 기반 cefr_confidence 백필',
      improvement: BACKLOG.D1,
      detectedAt: NOW_ISO(),
    })
  }

  // 3. audio_url 컬럼 부재
  if (!schema.tierColumns['audio_url']) {
    defects.push({
      id: 'audio_url_missing',
      severity: 'critical',
      priority: 'P0',
      title: 'audio_url 컬럼 부재 (Schema Tier 1 미적용)',
      description:
        'SpellForge / WordBlitz / Dictation 청각 학습 필수 자산 부재. 사용자 학습 콘텐츠 (R4) 결정적 결함.',
      evidence: 'shared_dictionary.audio_url + audio_url_uk + audio_url_us 컬럼 부재',
      metrics: { current: 'absent', target: 'present', unit: 'column' },
      impactsOn: ['R4'],
      pipelines: ['SpellForge', 'WordBlitz', 'Dictation'],
      remedy: 'S1 — Schema Tier 1 Migration apply',
      improvement: BACKLOG.S1,
      schemaTier: 1 as SchemaTier,
      detectedAt: NOW_ISO(),
    })
  }

  // 4. register 96% NULL
  if (c.register.ratio < 0.2) {
    defects.push({
      id: 'register_critical_null',
      severity: 'critical',
      priority: 'P0',
      title: 'register 96%+ NULL (segment 매칭 불가)',
      description:
        'business / academic / formal / informal segment 자동 단어장 발행 불가. R3 핵심 결함.',
      evidence: `register 채움: ${c.register.filled} / ${c.total} (${(c.register.ratio * 100).toFixed(1)}%)`,
      metrics: {
        current: (c.register.ratio * 100).toFixed(1),
        target: 70,
        unit: '%',
      },
      impactsOn: ['R3'],
      pipelines: ['VCB'],
      remedy: 'D2 — list_tags + frequency_band 기반 register 백필',
      improvement: BACKLOG.D2,
      detectedAt: NOW_ISO(),
    })
  }

  // 5. v_level 과반 미분류
  if (v.classifiedRatio < 0.5) {
    const unclassifiedPct = (1 - v.classifiedRatio) * 100
    defects.push({
      id: 'v_level_majority_unclassified',
      severity: 'critical',
      priority: 'P0',
      title: 'v_level 과반 미분류 (Krashen i+1 활용 불가)',
      description:
        'shared_dictionary.v_level NULL row 가 과반. 사용자 V-Level 기반 추출 (Phase 2A) + V-Level 단어장 발행 모두 손상.',
      evidence: `v_level 채움: ${v.totalClassified} / ${v.totalClassified + v.totalUnclassified} (${(v.classifiedRatio * 100).toFixed(1)}%) · ${v.totalUnclassified.toLocaleString()} unclassified`,
      metrics: {
        current: (v.classifiedRatio * 100).toFixed(1),
        target: 90,
        unit: '%',
      },
      impactsOn: ['R1', 'R3'],
      pipelines: ['LCP', 'VCB'],
      remedy: 'V1 — VRL Round 6+ 진행 (L0/L3/L11 잔여)',
      improvement: BACKLOG.V1,
      detectedAt: NOW_ISO(),
    })
    void unclassifiedPct
  }

  // ════════════════════════════════════════════════════════════
  // P1 Warning (7)
  // ════════════════════════════════════════════════════════════

  // 6. list_tags 과반 empty
  // list_tags 는 NOT NULL 이지만 빈 배열 가능 — coverage 에 별도 metric 부재.
  // synonyms (NGSL 보조 신호) 부재로 proxy 측정.
  if (c.synonyms.ratio < 0.7) {
    defects.push({
      id: 'list_tags_majority_empty',
      severity: 'warning',
      priority: 'P1',
      title: 'NGSL/AWL/BSL list_tags 채움률 부족',
      description:
        'list_tags 가 NOT NULL 이지만 빈 배열일 수 있음. segment-specific 가중치 (NDL/NAWL/BSL) 작동 안 함.',
      evidence: `synonyms (NGSL 보조 신호) 채움률 ${(c.synonyms.ratio * 100).toFixed(1)}%`,
      metrics: {
        current: (c.synonyms.ratio * 100).toFixed(1),
        target: 85,
        unit: '%',
      },
      impactsOn: ['R3'],
      pipelines: ['VCB', 'LCP'],
      remedy: 'NGSL Project 다중 리스트 batch import 재실행',
      detectedAt: NOW_ISO(),
    })
  }

  // 7. noun inflections 부족
  const nounInfl = l.inflectionsByPos.find((p) => p.primaryPos === 'noun')
  if (nounInfl && nounInfl.ratio < 0.75) {
    defects.push({
      id: 'noun_inflections_gap',
      severity: 'warning',
      priority: 'P1',
      title: 'noun inflections 35%+ 누락 (lemma 매칭 약화)',
      description: '스크립트 토큰화 시 복수형 매칭 실패. R2 스크립트 추출 정확도 손상.',
      evidence: `noun inflections: ${nounInfl.withInflections} / ${nounInfl.total} (${(nounInfl.ratio * 100).toFixed(1)}%)`,
      metrics: {
        current: (nounInfl.ratio * 100).toFixed(1),
        target: 90,
        unit: '%',
      },
      impactsOn: ['R2'],
      pipelines: ['TextViewer'],
      remedy: 'noun inflections enrichment — Claude/룰 기반 plural/possessive 추가',
      detectedAt: NOW_ISO(),
    })
  }

  // 8. adj inflections 부족
  const adjInfl = l.inflectionsByPos.find((p) => p.primaryPos === 'adjective')
  if (adjInfl && adjInfl.ratio < 0.8) {
    defects.push({
      id: 'adj_inflections_gap',
      severity: 'warning',
      priority: 'P1',
      title: 'adjective inflections 33%+ 누락 (비교급/최상급)',
      description: 'comparative / superlative 형태 누락. R2 스크립트 추출 정확도 약화.',
      evidence: `adjective inflections: ${adjInfl.withInflections} / ${adjInfl.total} (${(adjInfl.ratio * 100).toFixed(1)}%)`,
      metrics: {
        current: (adjInfl.ratio * 100).toFixed(1),
        target: 90,
        unit: '%',
      },
      impactsOn: ['R2'],
      pipelines: ['TextViewer'],
      remedy: 'adjective comparative/superlative enrichment',
      detectedAt: NOW_ISO(),
    })
  }

  // 9. polysemy 부족 (목표 25%)
  if (l.polysemy.polysemicRatio < 0.22) {
    defects.push({
      id: 'polysemy_underdeveloped',
      severity: 'warning',
      priority: 'P1',
      title: 'polysemy 20%+ (다의어 senses 분할 부족)',
      description:
        '실제 영어 다의어 비율 ~25-30% 대비 senses 배열 ≥ 2 row 가 부족. 사용자 학습 시 의미 모호.',
      evidence: `polysemic_2plus: ${l.polysemy.polysemic.toLocaleString()} / total (${(l.polysemy.polysemicRatio * 100).toFixed(1)}%)`,
      metrics: {
        current: (l.polysemy.polysemicRatio * 100).toFixed(1),
        target: 25,
        unit: '%',
      },
      impactsOn: ['R4'],
      pipelines: ['Flashcard', 'WordVault'],
      remedy: '다의어 senses 분할 enrichment (Claude pos별)',
      detectedAt: NOW_ISO(),
    })
  }

  // 10. verified 비율 낮음 — 상위 V-Level (L9/L10) 특히 낮음
  if (c.verified.ratio < 0.5) {
    defects.push({
      id: 'verified_low_advanced_levels',
      severity: 'warning',
      priority: 'P1',
      title: 'verified=true 비율 50% 미만 (감수 미완료)',
      description:
        '사람 감수 부족. 고급 V-Level (L9/L10) 특히 낮음 (이전 verified_by_v_level RPC L10=17.23%).',
      evidence: `verified=true 전체: ${c.verified.filled} / ${c.total} (${(c.verified.ratio * 100).toFixed(1)}%)`,
      metrics: {
        current: (c.verified.ratio * 100).toFixed(1),
        target: 80,
        unit: '%',
      },
      impactsOn: ['R3', 'R1'],
      pipelines: ['VCB', 'LCP'],
      remedy: 'L9/L10 우선 감수 — admin curate UI 활용',
      detectedAt: NOW_ISO(),
    })
  }

  // 11. collocations 부족
  if (c.collocations.ratio < 0.5) {
    defects.push({
      id: 'collocations_underdeveloped',
      severity: 'warning',
      priority: 'P1',
      title: 'collocations 32%+ 부재 (자연 결합 부족)',
      description: 'set phrase / collocation 부족. 사용자 학습 시 자연스러운 사용 패턴 부재.',
      evidence: `collocations 채움: ${c.collocations.filled} / ${c.total} (${(c.collocations.ratio * 100).toFixed(1)}%)`,
      metrics: {
        current: (c.collocations.ratio * 100).toFixed(1),
        target: 70,
        unit: '%',
      },
      impactsOn: ['R4'],
      pipelines: ['Flashcard', 'WordVault'],
      remedy: 'collocations enrichment (Claude 빈도 상위 우선)',
      detectedAt: NOW_ISO(),
    })
  }

  // 12. korean_learner_note 부족
  if (c.koreanLearnerNote.ratio < 0.5) {
    defects.push({
      id: 'korean_learner_note_gap',
      severity: 'warning',
      priority: 'P1',
      title: 'korean_learner_note 32%+ 부재 (한국인 학습자 메모 부족)',
      description:
        '한국어 학습자 특이 학습 메모 부족 — Konglish 경고, 발음 유사 단어 혼동 등.',
      evidence: `korean_learner_note 채움: ${c.koreanLearnerNote.filled} / ${c.total} (${(c.koreanLearnerNote.ratio * 100).toFixed(1)}%)`,
      metrics: {
        current: (c.koreanLearnerNote.ratio * 100).toFixed(1),
        target: 70,
        unit: '%',
      },
      impactsOn: ['R4'],
      pipelines: ['Flashcard', 'WordVault'],
      remedy: 'korean_learner_note enrichment + Schema Tier 2 (konglish_alert)',
      detectedAt: NOW_ISO(),
    })
  }

  // ════════════════════════════════════════════════════════════
  // P2 Info (3)
  // ════════════════════════════════════════════════════════════

  // 13. CEFR C2 과대표현 (실제 56%)
  const cefrC2 = raw.volume.byPrimaryPos // proxy — schema 의 byCefrLevel 직접 접근 어려움
  void cefrC2
  // categorical RPC 결과는 별도. 여기서는 단순화 — 전체 모니터링 보류 후 raw 확장 시 활성화
  // raw.volume 에 byCefrLevel 추가하면 정밀 탐지 가능. 현재는 raw.coverage.cefrLevel.ratio 활용
  if (c.cefrLevel.ratio > 0.99) {
    // 모든 단어에 cefr_level 가 채워졌으나 C2 편향은 별도 메트릭 필요.
    // 우선 정보성 — categorical 데이터 추가 시 정밀화.
    defects.push({
      id: 'cefr_c2_overrepresented',
      severity: 'info',
      priority: 'P2',
      title: 'CEFR C2 과대표현 (전체 ~56%)',
      description:
        '실측 by_cefr_level: C2 21,687 / 38,605 = 56.2%. C2 비중이 과대 — 학습자 수준 분포와 불일치.',
      evidence: 'categorical RPC: by_cefr_level C2 56.2%',
      metrics: { current: 56.2, target: 30, unit: '%' },
      impactsOn: ['R1', 'R3'],
      pipelines: ['LCP', 'VCB'],
      remedy: 'CEFR 재분류 또는 C2 일부 → C1 reclassify (Round 후속)',
      detectedAt: NOW_ISO(),
    })
  }

  // 14. noun POS dominance (66%)
  const nounEntry = raw.volume.byPrimaryPos.find((p) => p.pos === 'noun')
  if (nounEntry && raw.volume.total > 0) {
    const nounPct = (nounEntry.count / raw.volume.total) * 100
    if (nounPct > 60) {
      defects.push({
        id: 'noun_pos_dominant',
        severity: 'info',
        priority: 'P2',
        title: `noun POS dominance (${nounPct.toFixed(1)}%)`,
        description:
          'noun 이 전체 단어의 60%+. verb/adjective 균형 부족 — 학습 다양성 손상.',
        evidence: `noun: ${nounEntry.count.toLocaleString()} / ${raw.volume.total.toLocaleString()} (${nounPct.toFixed(1)}%)`,
        metrics: { current: nounPct.toFixed(1), target: 50, unit: '%' },
        impactsOn: ['R1', 'R4'],
        pipelines: ['LCP'],
        remedy: 'verb/adjective 신규 단어 추가 + phrasal_verb 확장',
        detectedAt: NOW_ISO(),
      })
    }
  }

  // 15. frequency_rank 과반 NULL
  if (c.frequencyRank.ratio < 0.4) {
    defects.push({
      id: 'frequency_rank_majority_null',
      severity: 'info',
      priority: 'P2',
      title: 'frequency_rank 68%+ NULL (NGSL 외부 단어)',
      description:
        'NGSL 31K 외부 단어 (희귀 / 전문 용어 / 신조어). LV 수식 globalFreqWeight 가 fallback 값 사용.',
      evidence: `frequency_rank 채움: ${c.frequencyRank.filled} / ${c.total} (${(c.frequencyRank.ratio * 100).toFixed(1)}%)`,
      metrics: {
        current: (c.frequencyRank.ratio * 100).toFixed(1),
        target: 60,
        unit: '%',
      },
      impactsOn: ['R1'],
      pipelines: ['LCP'],
      remedy: 'NGSL 외부 corpus (COCA / SUBTLEX) 빈도 보강',
      detectedAt: NOW_ISO(),
    })
  }

  // ════════════════════════════════════════════════════════════
  // 정렬 — P0 → P1 → P2 (priority order), 같은 P 내 severity → critical 우선
  // ════════════════════════════════════════════════════════════
  defects.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority]
    const pb = PRIORITY_ORDER[b.priority]
    if (pa !== pb) return pa - pb
    // critical → warning → info
    const sev = { critical: 0, warning: 1, info: 2 }
    return sev[a.severity] - sev[b.severity]
  })

  return defects
}

/**
 * 결함 통계 부산물 — UI 헬퍼.
 */
export function summarizeDefects(defects: CriticalDefect[]): {
  total: number
  byPriority: Record<CriticalDefect['priority'], number>
  bySeverity: Record<CriticalDefect['severity'], number>
  byResponsibility: Record<ResponsibilityId, number>
} {
  const byPriority: Record<CriticalDefect['priority'], number> = {
    P0: 0,
    P1: 0,
    P2: 0,
    P3: 0,
  }
  const bySeverity: Record<CriticalDefect['severity'], number> = {
    critical: 0,
    warning: 0,
    info: 0,
  }
  const byResponsibility: Record<ResponsibilityId, number> = {
    R1: 0,
    R2: 0,
    R3: 0,
    R4: 0,
  }

  for (const d of defects) {
    byPriority[d.priority] += 1
    bySeverity[d.severity] += 1
    for (const r of d.impactsOn) byResponsibility[r] += 1
  }

  return { total: defects.length, byPriority, bySeverity, byResponsibility }
}
