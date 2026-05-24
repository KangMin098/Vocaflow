// apps/web/src/lib/admin/dict/schema-presence-static.ts
//
// Schema Evolution Tier 1-5 컬럼 존재 여부 정적 상수.
//
// ⚠️ Migration 적용 시 수동 동기화 필수:
//   1. 마이그레이션 SQL apply (ALTER TABLE ADD COLUMN ...)
//   2. 본 파일 해당 컬럼 false → true 로 변경
//   3. PR + 커밋
//
// 정적 상수 채택 이유:
//   - information_schema.columns 직접 쿼리는 RLS 차단 위험
//   - SECURITY DEFINER RPC 만들어도 현 시점 모두 false 반환 (서버 사전 검증 확인됨)
//   - Schema Evolution 단순 상태이므로 코드 동기화 비용 < RPC migration 비용
//
// 미래 — Tier 1 audio_url 적용 시점에 RPC 업그레이드 검토.

export interface KnownSchemaPresence {
  shared_dictionary: Record<string, boolean>
  shared_word_sets: Record<string, boolean>
}

export const KNOWN_SCHEMA_PRESENCE: KnownSchemaPresence = {
  shared_dictionary: {
    // Tier 1 — 청각 학습 (SpellForge/WordBlitz) — Migration 20260524 적용 ✅
    audio_url: true,
    audio_url_uk: true,
    audio_url_us: true,
    // Tier 1 — 시각/암기 (Flashcard) — Migration 20260524 적용 ✅
    image_url: true,
    mnemonic_ko: true,
    // Tier 1 — 품질 감사 — Migration 20260524 적용 ✅
    last_quality_audit_at: true,
    // Tier 1 — 사용 통계 (미적용)
    usage_count_30d: false,
    // Tier 2 — 학습 보조 (미적용)
    common_errors_ko: false,
    usage_warning_ko: false,
    difficulty_score: false,
    related_words: false,
  },
  shared_word_sets: {
    // VCB-VRL 통합 핵심 컬럼
    target_v_level_range: false,
    target_v_level: false,
    v_level: false,
    target_track_id: false,
    target_domain_id: false,
  },
}

/** shared_dictionary 의 알려진 베이스 컬럼 (코드에서 항상 존재 가정 가능) */
export const KNOWN_SHARED_DICTIONARY_BASE_COLUMNS = [
  'word',
  'meaning_ko',
  'meanings_ko',
  'pos',
  'cefr_level',
  'frequency_rank',
  'example_en',
  'synonyms',
  'antonyms',
  'source',
  'verified',
  'created_at',
  'updated_at',
  'ngsl_sfi',
  'list_tags',
  'ipa',
  'collocations',
  'register',
  'korean_learner_note',
  'frequency_sources',
  'frequency_band',
  'lemma_band',
  'inflections',
  'senses',
  'primary_pos',
  'pos_set',
  'ipa_uk',
  'ipa_us',
  'cefr_confidence',
  // 'pos_all','domain_tags','frequency_score','verified_by','verified_at' — Migration 20260524 DROP
  'v_level_rule_v1',
  'track_levels_rule_v1',
  'domain_levels_rule_v1',
  'skill_type',
  'skill_level_rule_v1',
  'vrl_calculated_at',
  'v_level',
  'track_levels',
  'domain_levels',
  'skill_level',
  'claude_reasoning',
  'classified_by',
  'claude_classified_at',
] as const

export const KNOWN_SHARED_WORD_SETS_BASE_COLUMNS = [
  'id',
  'title',
  'description',
  'category',
  'cefr_level',
  'word_count',
  'is_published',
  'sort_order',
  'cover_emoji',
  'created_at',
  'category_id',
  'additional_category_ids',
] as const

/**
 * 정적 상수에서 컬럼 존재 여부 조회.
 */
export function isColumnPresent(
  table: 'shared_dictionary' | 'shared_word_sets',
  column: string,
): boolean {
  return KNOWN_SCHEMA_PRESENCE[table][column] ?? false
}

/**
 * VCB-VRL 통합 여부 — shared_word_sets 에 V-Level 관련 컬럼 1개 이상 존재 시 true.
 */
export function isVcbVrlIntegrated(): boolean {
  const cols = KNOWN_SCHEMA_PRESENCE.shared_word_sets
  return (
    cols.target_v_level_range ||
    cols.target_v_level ||
    cols.v_level ||
    cols.target_track_id ||
    cols.target_domain_id
  )
}
