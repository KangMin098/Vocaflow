-- ============================================================
-- Migration: 20260504154153_add_dictionary_categories.sql
-- Source: 영단어 카테고리 트리 (Oxford Topic 기반 18→76→472 3계층)
-- Created: 2026-05-04
-- ============================================================
--
-- shared_dictionary 단어를 토픽으로 분류하는 트리 + M:N 매핑.
--
-- 데이터 구조:
--   dictionary_categories: 566개 노드 (계층적)
--     - H1 (Level 1): 18개 (People, Travel, ...)
--     - H2 (Level 2): 76개 (Education, Family, ...)
--     - H3 (Level 3): 472개 (Brave, Adults, ...)
--
--   dictionary_word_categories: 29,339개 (word ↔ category)
--     - 한 단어가 여러 카테고리 가능 (다의어 대응)
--     - 모든 단어는 H3 leaf 카테고리에 매핑됨 (외부 시드 특성)
--
-- 활용:
--   - WordVault 라이브러리 토픽 필터
--   - TextViewer AI 추출 시 카테고리 자동 매핑
--   - Flashcard SRS 큐의 토픽별 학습 모드
--
-- 의존성:
--   - shared_dictionary (20260504144011_add_shared_dictionary.sql) — FK
--   - set_updated_at()  (20251101000006_triggers_and_rls.sql)
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1) dictionary_categories — 카테고리 트리
-- ────────────────────────────────────────────────────────────
CREATE TABLE dictionary_categories (
  -- 계층적 ID — 'people', 'people-personal-qualities', 'people-personal-qualities-brave' 식
  -- slug 형식 (lowercase, hyphen, 영문만)
  id TEXT PRIMARY KEY,

  -- 표시명
  name_en TEXT NOT NULL,                    -- 'Brave', 'Personal qualities', 'People'
  name_ko TEXT,                             -- 한국어 번역 (Phase 4-4에서 채움)

  -- 계층 정보
  level INT NOT NULL CHECK (level IN (1, 2, 3)),  -- 1=H1, 2=H2, 3=H3
  parent_id TEXT REFERENCES dictionary_categories(id) ON DELETE CASCADE,

  -- 표시·정렬
  sort_order INT DEFAULT 0,
  cover_emoji TEXT,                         -- '🎭', '🌍' 등 (선택)

  -- 통계 캐시 (트리거로 자동 갱신 — Phase 2)
  word_count INT DEFAULT 0,

  -- 운영
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX idx_categories_parent ON dictionary_categories(parent_id);
CREATE INDEX idx_categories_level ON dictionary_categories(level, sort_order);

CREATE TRIGGER trg_dictionary_categories_updated
  BEFORE UPDATE ON dictionary_categories
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- ────────────────────────────────────────────────────────────
-- 2) dictionary_word_categories — M:N 매핑
-- ────────────────────────────────────────────────────────────
CREATE TABLE dictionary_word_categories (
  word TEXT NOT NULL REFERENCES shared_dictionary(word) ON DELETE CASCADE,
  category_id TEXT NOT NULL REFERENCES dictionary_categories(id) ON DELETE CASCADE,

  -- 카테고리 내 단어의 추가 정보
  pos_in_context TEXT,                      -- 이 카테고리에서의 품사 (다의어 다른 POS)
  cefr_in_context TEXT CHECK (cefr_in_context IN ('A1','A2','B1','B2','C1','C2')),

  -- 카테고리 내 정렬 (alphabetical 또는 빈도순)
  rank_in_category INT,

  -- 출처 추적
  source TEXT NOT NULL DEFAULT 'imported'
    CHECK (source IN ('imported','manual','ai-suggested')),

  added_at TIMESTAMPTZ DEFAULT now(),

  PRIMARY KEY (word, category_id)
);

CREATE INDEX idx_word_cat_category ON dictionary_word_categories(category_id, rank_in_category);
CREATE INDEX idx_word_cat_word ON dictionary_word_categories(word);
CREATE INDEX idx_word_cat_cefr ON dictionary_word_categories(cefr_in_context, category_id)
  WHERE cefr_in_context IS NOT NULL;

-- ────────────────────────────────────────────────────────────
-- 3) RLS
-- ────────────────────────────────────────────────────────────
ALTER TABLE dictionary_categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE dictionary_word_categories ENABLE ROW LEVEL SECURITY;

-- 모든 인증 사용자 SELECT 가능 (공유 데이터)
CREATE POLICY "authenticated read categories"
  ON dictionary_categories
  FOR SELECT
  TO authenticated
  USING (is_active = true);

CREATE POLICY "authenticated read word categories"
  ON dictionary_word_categories
  FOR SELECT
  TO authenticated
  USING (true);

-- 쓰기는 service_role 만 (Route Handler / Server Action 의 service client)
CREATE POLICY "service write categories"
  ON dictionary_categories
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "service write word categories"
  ON dictionary_word_categories
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- ────────────────────────────────────────────────────────────
-- 4) 헬퍼 함수 — 카테고리 풀 패스 조회
-- ────────────────────────────────────────────────────────────
-- 사용 예: SELECT get_category_path('people-personal-qualities-brave')
-- 결과:    ['People', 'Personal qualities', 'Brave']
CREATE OR REPLACE FUNCTION get_category_path(cat_id TEXT)
RETURNS TEXT[] AS $$
WITH RECURSIVE path AS (
  SELECT id, parent_id, name_en, level
  FROM dictionary_categories WHERE id = cat_id
  UNION ALL
  SELECT c.id, c.parent_id, c.name_en, c.level
  FROM dictionary_categories c
  JOIN path p ON c.id = p.parent_id
)
SELECT array_agg(name_en ORDER BY level)
FROM path;
$$ LANGUAGE sql STABLE;
