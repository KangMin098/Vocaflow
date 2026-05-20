-- supabase/migrations/20260518130000_shared_word_sets_category_bridge.sql
--
-- shared_word_sets ↔ dictionary_categories 브릿지 (옵션 A · 최소 외과수술).
--
-- 배경:
--   - dictionary_categories: 566 노드(18/76/472) · taxonomy = semantic 단일
--   - dictionary_word_categories: 28,124 매핑 · FK 정합 100% (orphan 0)
--   - shared_word_sets.category: free-text 8-enum ('elementary'|'middle'|'high'|...)
--     ↑ 위 풍부한 트리와 단절 — WordVault 가 풍부한 필터링 불가.
--
-- 본 마이그레이션은 단일 브릿지 컬럼 추가만 수행:
--   * category_id           : 주 카테고리 (단일 FK)
--   * additional_category_ids : 보조 카테고리 (배열, gin 인덱스)
--   * 기존 category 컬럼은 보존 (단일 'high' row 영향 — Phase 2 폐기 예정)
--
-- 적용 후:
--   - 관리자가 기존 row 의 category_id 를 수동 매핑 (자동 매핑 SQL 미포함 —
--     'high' 같은 학년 enum 은 semantic 트리에 직접 대응 X)
--   - WordVault hub/library/vocab UI 가 category_id 로 풍부한 필터 노출

BEGIN;

ALTER TABLE public.shared_word_sets
  ADD COLUMN IF NOT EXISTS category_id TEXT
    REFERENCES public.dictionary_categories(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS additional_category_ids TEXT[] NOT NULL DEFAULT '{}'::text[];

COMMENT ON COLUMN public.shared_word_sets.category IS
  'DEPRECATED — free-text 8-enum (elementary/middle/high/csat/eng_test/civil/business/themed).
   Phase 2: deprecate in favor of category_id (FK to dictionary_categories).';

COMMENT ON COLUMN public.shared_word_sets.category_id IS
  'Primary category — FK to dictionary_categories.id (semantic taxonomy tree of 566 nodes).';

COMMENT ON COLUMN public.shared_word_sets.additional_category_ids IS
  'Secondary categories — array of dictionary_categories.id. Use gin index for contains queries.
   NOTE: not enforced as FK array (PostgreSQL limitation). Validate at application layer.';

CREATE INDEX IF NOT EXISTS idx_sws_category_id
  ON public.shared_word_sets(category_id) WHERE category_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_sws_additional_categories
  ON public.shared_word_sets USING gin(additional_category_ids);

COMMIT;

-- ── 적용 후 검증 ────────────────────────────────────────
-- SELECT id, title, category, category_id, additional_category_ids
-- FROM shared_word_sets;
--
-- 예상: 기존 row '필수2000' (category='high', category_id=NULL).
-- 관리자가 적절한 dictionary_categories.id 로 UPDATE 필요.
