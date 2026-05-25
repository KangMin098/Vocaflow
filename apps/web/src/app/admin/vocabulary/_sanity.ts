// apps/web/src/app/admin/vocabulary/_sanity.ts
//
// 단어 다차원 정합 자동 검사 — admin 큐레이션 보조.

import type { DictSearchRow, DictWordDetail } from '@/lib/admin/dict/word-search'

export type SanityIssueId =
  | 'v_level_unclassified'
  | 'v_level_reclassified'
  | 'cefr_vlevel_mismatch'
  | 'cefr_confidence_null'
  | 'classified_no_reasoning'
  | 'meaning_empty'
  | 'list_tags_freq_mismatch'
  | 'frequency_rank_null'

export interface SanityIssue {
  id: SanityIssueId
  severity: 'critical' | 'warning' | 'info'
  label: string
  detail: string
}

const SEV_ORDER: Record<SanityIssue['severity'], number> = {
  critical: 0,
  warning: 1,
  info: 2,
}

/**
 * row (table용 슬림) 기준 — 가볍게.
 */
export function inlineSanityIssues(row: DictSearchRow): SanityIssue[] {
  const issues: SanityIssue[] = []

  // 1. v_level 미분류
  if (row.v_level == null) {
    issues.push({
      id: 'v_level_unclassified',
      severity: 'warning',
      label: 'v_level NULL',
      detail: 'VRL 분류 미완료',
    })
  }

  // 2. v_level 변경 (rule_v1 ≠ current)
  if (
    row.v_level != null &&
    row.v_level_rule_v1 != null &&
    row.v_level !== row.v_level_rule_v1
  ) {
    issues.push({
      id: 'v_level_reclassified',
      severity: 'info',
      label: `V${row.v_level_rule_v1}→V${row.v_level}`,
      detail: 'Round 1-6 reclassification 결과',
    })
  }

  // 3. CEFR ↔ V-Level 불일치 (대략적)
  if (row.cefr_level && row.v_level != null) {
    const cefrLowEnd = ['A1', 'A2'].includes(row.cefr_level)
    const cefrHighEnd = ['C1', 'C2'].includes(row.cefr_level)
    if (cefrLowEnd && row.v_level >= 5) {
      issues.push({
        id: 'cefr_vlevel_mismatch',
        severity: 'warning',
        label: `${row.cefr_level}+V${row.v_level}`,
        detail: '초급 CEFR + 중상위 V-Level 불일치 의심',
      })
    } else if (cefrHighEnd && row.v_level <= 4) {
      issues.push({
        id: 'cefr_vlevel_mismatch',
        severity: 'warning',
        label: `${row.cefr_level}+V${row.v_level}`,
        detail: '고급 CEFR + 초중급 V-Level 불일치 의심',
      })
    }
  }

  // 4. meaning_ko 빈
  if (!row.meaning_ko || row.meaning_ko.trim() === '') {
    issues.push({
      id: 'meaning_empty',
      severity: 'critical',
      label: 'meaning_ko 빈',
      detail: '한국어 의미 누락 (R1/R4 영향)',
    })
  }

  // 5. cefr_confidence NULL
  if (row.cefr_confidence == null) {
    issues.push({
      id: 'cefr_confidence_null',
      severity: 'info',
      label: 'cefr_conf NULL',
      detail: 'Phase 2 D1 백필 대상',
    })
  }

  // 6. list_tags 비어있는데 freq_rank 낮은 (NGSL 상위인데 태그 누락)
  if (
    row.frequency_rank != null &&
    row.frequency_rank < 1000 &&
    (!row.list_tags || row.list_tags.length === 0)
  ) {
    issues.push({
      id: 'list_tags_freq_mismatch',
      severity: 'warning',
      label: 'list_tags 빈',
      detail: `NGSL 1000위 안 (rank ${row.frequency_rank}) 인데 list_tags 비어있음`,
    })
  }

  // 7. frequency_rank NULL
  if (row.frequency_rank == null) {
    issues.push({
      id: 'frequency_rank_null',
      severity: 'info',
      label: 'freq_rank NULL',
      detail: 'NGSL 31K 외부 단어',
    })
  }

  return issues.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity])
}

/**
 * 상세 (claude_reasoning 등 추가 컬럼 활용).
 */
export function detailSanityIssues(detail: DictWordDetail): SanityIssue[] {
  const issues = inlineSanityIssues(detail)

  // classified_by='claude' 인데 reasoning 비어있음
  if (
    detail.classified_by === 'claude' &&
    (!detail.claude_reasoning || detail.claude_reasoning.trim() === '')
  ) {
    issues.push({
      id: 'classified_no_reasoning',
      severity: 'warning',
      label: 'reasoning 빈',
      detail: 'classified_by=claude 인데 claude_reasoning 누락',
    })
  }

  return issues.sort((a, b) => SEV_ORDER[a.severity] - SEV_ORDER[b.severity])
}
