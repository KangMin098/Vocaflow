-- =====================================================================
-- KICE 13y sprint #19 — 5종 자동 큐레이션 단어장 시드
--
-- 임계값은 실제 데이터 분포 (max raw_count=9) 에 맞게 재설정:
--   - 원안 #1 'absolute_13y' (=13/13) → 'frequent_8plus' (raw_count≥8, ~15단어)
--   - 원안 #2 'tier5_high_freq' (raw≥10) → 'frequent_tier4' (Tier 4 = raw 4-9, ~382단어)
--   - #3~5 (question_no 기반) 그대로
--
-- subcategory naming 은 데이터 정직성 우선 (수능 영어 13년 중 8년+ 출현).
-- is_published=false 로 시드 — 큐레이터 검토 후 publish.
-- =====================================================================

BEGIN;

-- v2: shared_word_sets.slug (NOT NULL) 컬럼 정합 — origin/main 의 VCB 메타.
INSERT INTO shared_word_sets (
  slug, title, description, category, subcategory,
  auto_curated, curation_query, cover_emoji, is_published
) VALUES
  (
    'kice-frequent-8plus',
    '수능 빈출 8년+ (13개년 중)',
    '2014~2026 수능 영어 13개년 중 8년 이상 출제된 단어. 최고 빈도군.',
    'csat', 'frequent_8plus', true,
    '{"source_key":"kice_csat","filters":{"raw_count_min":8},"version":"1.0"}'::jsonb,
    '🏆', false
  ),
  (
    'kice-frequent-tier4',
    '수능 빈출 4년+ (Tier 4)',
    '13개년 중 4~9년 출제된 고빈도 어휘. frequency_tier 4 = "high".',
    'csat', 'frequent_tier4', true,
    '{"source_key":"kice_csat","filters":{"frequency_tier_min":4},"version":"1.0"}'::jsonb,
    '⭐', false
  ),
  (
    'kice-q31-34-blank',
    '수능 빈칸추론 빈출',
    '빈칸추론 영역(31~34번 문항)에 3회 이상 출제된 핵심 어휘.',
    'csat', 'q31_34_blank', true,
    '{"source_key":"kice_csat","filters":{"question_nos":[31,32,33,34],"min_years":3},"version":"1.0"}'::jsonb,
    '🎯', false
  ),
  (
    'kice-q41-43-long',
    '수능 장문독해 빈출',
    '장문 독해(41~43번)에 3회 이상 출제된 어휘.',
    'csat', 'q41_43_long', true,
    '{"source_key":"kice_csat","filters":{"question_nos":[41,42,43],"min_years":3},"version":"1.0"}'::jsonb,
    '📜', false
  ),
  (
    'kice-q18-24-purpose',
    '수능 글의 목적·요지',
    '글의 목적·요지·주제(18, 22~24번)에 3회 이상 출제된 어휘.',
    'csat', 'q18_24_purpose', true,
    '{"source_key":"kice_csat","filters":{"question_nos":[18,22,23,24],"min_years":3},"version":"1.0"}'::jsonb,
    '💡', false
  )
ON CONFLICT DO NOTHING;

COMMIT;
