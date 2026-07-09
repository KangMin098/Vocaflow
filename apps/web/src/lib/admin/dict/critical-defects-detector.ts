// apps/web/src/lib/admin/dict/critical-defects-detector.ts
//
// Critical Defects 자동 탐지 — 15 rules
//   P0 (3): audio_url_missing / segment_tags_underdeveloped(구 register_critical_null) /
//           v_level_majority_unclassified   (cefr_confidence_null·vcb_vrl 는 해소/이연 — 아래 참조)
//   P1 (7): list_tags_empty / noun_inflections_gap / adj_inflections_gap /
//           polysemy_underdeveloped / verified_low_advanced /
//           collocations_underdeveloped / korean_learner_note_gap
//   P2 (4): vcb_vrl_not_integrated(2026-07-08 P0→P2, 우회로 동작) / cefr_c2_overrepresented /
//           noun_pos_dominant / frequency_rank_majority_null
//   ※ cefr_confidence_null 룰은 임계(<1%) 유지하나 실데이터 99.6% 채움으로 미발화(D1 done).
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
    action: 'register backfill 은 이연 — segment 발행은 list_tags 로 동작 중. 격식(formal/informal) 표시 UI 등 실소비처 확정 시 재개',
    cost: '소비처 확정 후 산정 (룰 커버 ~2.6K + LLM 잔여)',
    effect: 'register 소비처 활성화 시 R4 표시 품질 (현재 효과 0 — 2026-07-06 진단)',
    backlogId: 'D2',
  },
  S1: {
    action: 'Schema Tier 1 Migration — audio_url + audio_url_uk + audio_url_us + image_url + mnemonic_ko 컬럼 추가',
    cost: 'Migration 1개 + content fetch 후속 (~1년)',
    effect: 'R4 +15 / SpellForge/WordBlitz 청각 학습 활성화',
    backlogId: 'S1',
  },
  V1: {
    action: 'VRL 재분류 라운드 재실행 — 미분류 잔여 해소 (v3 Round 1~10 방법론 재사용)',
    cost: 'Round당 1-2 turn',
    effect: 'R1 +15 / R3 +10 / v_level 채움률 회복 (2026-06 100% 달성 이력 — 재발 시에만 발화)',
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

  // 1. VCB-VRL 전용 컬럼 부재 — 구조 개선 여지(info), 기능 차단 아님
  //    (2026-07-08 진단: V-Level 단어장 발행·추천·구독은 이미 동작 — auto-vlevel V1~V9 9세트 +
  //     도서 챕터 260세트 curation_query.book_v_level. recommend_word_sets_for_user 는 slug 조립으로
  //     세트 조회. 실비용 = 슬러그 네이밍 관례 결합(소비처 RPC 1곳, 사고 0건)뿐 — P0 아님, B1 이연.)
  if (!schema.vcbVrlIntegrated) {
    defects.push({
      id: 'vcb_vrl_not_integrated',
      severity: 'info',
      priority: 'P2',
      title: 'VCB-VRL 전용 컬럼 부재 (V-Level 발행은 우회 경로로 동작 중)',
      description:
        'shared_word_sets 에 target_v_level_range 등 전용 컬럼 부재. V-Level 단어장 발행·추천은 slug(auto-vlevel-v*)·curation_query JSONB(book_v_level) 로 이미 동작 — 기능 차단 아님. 남는 것은 슬러그 네이밍 관례 결합·인덱스/무결성 부재(견고성). 세트가 수천 규모가 되거나 슬러그 리디자인 시 전용 컬럼 도입 권장.',
      evidence: 'shared_word_sets.target_v_level_range 컬럼 부재 (우회: curation_query→book_v_level · slug auto-vlevel-v*)',
      metrics: { current: 'absent', target: 'present', unit: 'column' },
      impactsOn: ['R3'],
      pipelines: ['VCB'],
      remedy: 'B1 — 슬러그 개편/세트 대량화 시 target_v_level 컬럼 도입 (현재 우회로 충분)',
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

  // 4. segment 태그 풀 부족 — segment 자동 단어장의 실제 발행 경로는 list_tags
  //    (구 rule: register NULL. register 컬럼은 소비처가 없어 P0 허위 경고였음 —
  //     specialty 4종은 list_tags 로 이미 발행. register 백필 D2 는 소비처 발생 시 이연.)
  if (c.segmentTags.ratio < 0.5) {
    defects.push({
      id: 'segment_tags_underdeveloped',
      severity: 'critical',
      priority: 'P0',
      title: 'segment 태그 풀 부족 (specialty 단어장 발행 위험)',
      description:
        'list_tags 의 segment 태그(bsl/bel/tsl/nawl/moel) 보유 row 가 목표 풀의 절반 미만 — specialty 단어장 발행·갱신 기반 약화.',
      evidence: `segment 태그 보유: ${c.segmentTags.filled.toLocaleString()} row (목표 3,000)`,
      metrics: {
        current: c.segmentTags.filled,
        target: 3000,
        unit: 'row',
      },
      impactsOn: ['R3'],
      pipelines: ['VCB'],
      remedy: 'segment 리스트 재import (D8) 또는 태그 소스 보강',
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
      severity: 'info',
      priority: 'P2',
      title: 'polysemy 20%+ (다의어 senses 분할 부족 · UI 미렌더)',
      description:
        '실제 영어 다의어 비율 ~25-30% 대비 senses ≥ 2 row 부족. ⚠️ 2026-07-09 진단: senses 는 학습자 UI(카드·툴팁) 미렌더 — 카드가 meaning_ko 단일만 표시. 다의어 카드 UI 선행 필요(D3 이연).',
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
      severity: 'info',
      priority: 'P2',
      title: 'collocations 32%+ 부재 (자연 결합 · UI 미렌더)',
      description:
        'set phrase / collocation 부족. ⚠️ 2026-07-09 진단: collocations 는 학습자 UI 미렌더(admin 패널만) — 카드에 연어 표시 UI 선행 필요(D7 이연).',
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
      severity: 'info',
      priority: 'P2',
      title: 'korean_learner_note 32%+ 부재 (학습 메모 · UI 미렌더)',
      description:
        '한국어 학습자 특이 메모(Konglish 경고 등) 부족. ⚠️ 2026-07-09 진단: 학습자 UI 미렌더(admin 패널만) — 카드 메모 슬롯 UI 선행 필요(D6 이연).',
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

  // 13. CEFR C2 과대표현 — categorical RPC 라이브 값으로 판정 (하드코드 스냅샷 금지)
  const byCefr = raw.categorical?.by_cefr_level
  if (byCefr) {
    const cefrTotal = Object.values(byCefr).reduce((s, n) => s + n, 0)
    const c2Count = byCefr['C2'] ?? 0
    const c2Pct = cefrTotal > 0 ? (c2Count / cefrTotal) * 100 : 0
    if (c2Pct > 40) {
      defects.push({
        id: 'cefr_c2_overrepresented',
        severity: 'info',
        priority: 'P2',
        title: `CEFR C2 과대표현 (전체 ${c2Pct.toFixed(1)}%)`,
        description:
          'C2 비중이 학습자 수준 분포 대비 과대 — CEFR 세분화가 상급에 뭉쳐 레벨 신호로서의 변별력 저하.',
        evidence: `categorical RPC by_cefr_level: C2 ${c2Count.toLocaleString()} / ${cefrTotal.toLocaleString()} (${c2Pct.toFixed(1)}%)`,
        metrics: { current: c2Pct.toFixed(1), target: 30, unit: '%' },
        impactsOn: ['R1', 'R3'],
        pipelines: ['LCP', 'VCB'],
        remedy: 'CEFR 재분류 또는 C2 일부 → C1 reclassify (Round 후속)',
        detectedAt: NOW_ISO(),
      })
    }
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
