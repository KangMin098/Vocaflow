-- supabase/migrations/20260508120000_lcp_v2.sql
-- ═══════════════════════════════════════════════════════════
-- LCP v2.0 — Library Curation Pipeline
-- ═══════════════════════════════════════════════════════════
-- migration : 20260508120000_lcp_v2
-- depends on: 20260504160708_prepare_dictionary_for_seed_import
-- breaking  : NO (모든 변경은 추가 only, 기존 DROP 없음)
-- rollback  : 가능 (CASCADE DROP을 역순으로)
--
-- 적용 전 수정 반영 사항 (사전 점검 결과):
--   1) moddatetime extension 미사용 → public.set_updated_at() 표준 함수 사용
--   2) shared_dictionary.pronunciation 컬럼 부재 → hot_dictionary view에서 제거
--   3) DB timezone=UTC 확인 → cron 식을 UTC로 변환 (의도는 KST)
--   4) 한글 주석은 새로 작성 (mojibake 회피)
--   5) copyright_safe_in_kr: GENERATED ALWAYS는 now() 비-IMMUTABLE 로 거부됨
--      → 일반 BOOLEAN + BEFORE INSERT/UPDATE 트리거로 자동 계산
--      → 연 1회 cron 으로 일괄 재계산 (부동 시간 컷오프 보정)
-- ═══════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────
-- ① Extensions (멱등)
-- ─────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgmq;
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS btree_gin;
-- pgcrypto: 이미 installed (sha256 digest용)
-- vector / pg_partman: 본 마이그레이션에서 미사용, 도입 시점 별도 마이그레이션

-- ─────────────────────────────────────────────
-- ② content_chunks — content-addressed storage
--    동일 chapter 본문을 SHA-256 hash 기반 1회만 저장
--    압축은 Postgres TOAST 자동 처리 (lz4)
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS content_chunks (
  hash         TEXT PRIMARY KEY,
  content      TEXT NOT NULL,
  byte_size    INT  NOT NULL,
  ref_count    INT  NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE content_chunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_all_chunks" ON content_chunks
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

CREATE POLICY "authenticated_read_chunks" ON content_chunks
  FOR SELECT USING (auth.role() = 'authenticated');

COMMENT ON TABLE content_chunks IS
  'LCP v2.0 — 본문 컨텐츠 해시 기반 dedup 저장소. ref_count=0 청크는 pg_cron이 GC.';

-- ─────────────────────────────────────────────
-- ③ library_books — admin curation master
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS library_books (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  -- 출처
  source                TEXT NOT NULL CHECK (source IN ('gutenberg','standard_ebooks','wikisource','manual')),
  source_id             TEXT,
  source_url            TEXT,
  source_fetched_at     TIMESTAMPTZ,

  -- 메타
  title                 TEXT NOT NULL,
  author                TEXT,
  author_birth_year     INT,
  author_death_year     INT,
  language              TEXT NOT NULL DEFAULT 'en',
  original_publish_year INT,

  -- License (KR 안전성: 저자 사후 70년 — BEFORE INSERT/UPDATE 트리거로 계산)
  license               TEXT NOT NULL,
  copyright_safe_in_kr  BOOLEAN NOT NULL DEFAULT false,

  -- 분석 결과
  cefr_level            TEXT,
  cefr_confidence       FLOAT,
  word_count            INT,
  chapter_count         INT,
  reading_minutes       INT,

  -- 큐레이션 메타 (texts 테이블과 컬럼명 일관)
  cover_from            TEXT,
  cover_to              TEXT,
  category_tags         TEXT[] DEFAULT '{}',
  recommended_order     INT DEFAULT 100,

  -- 검색 가속 (BEFORE INSERT/UPDATE 트리거로 갱신 — to_tsvector 가 STABLE 이라 GENERATED 불가)
  search_vector         tsvector,

  -- 파이프라인 상태
  status                TEXT NOT NULL DEFAULT 'queued'
    CHECK (status IN ('queued','ingesting','normalizing','segmenting','analyzing','curating','ready','published','archived','failed')),
  status_message        TEXT,
  llm_cost_usd          NUMERIC(10,6) DEFAULT 0,

  -- 게시
  published_at          TIMESTAMPTZ,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 검색·필터 인덱스
CREATE INDEX IF NOT EXISTS idx_lb_search        ON library_books USING GIN (search_vector);
CREATE INDEX IF NOT EXISTS idx_lb_title_trgm    ON library_books USING GIN (title gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_lb_author_trgm   ON library_books USING GIN (author gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_lb_published_kr  ON library_books (status, cefr_level)
  WHERE status='published' AND copyright_safe_in_kr=true;
CREATE INDEX IF NOT EXISTS idx_lb_pipeline      ON library_books (status, updated_at)
  WHERE status NOT IN ('published','archived');
CREATE INDEX IF NOT EXISTS idx_lb_category      ON library_books USING GIN (category_tags);

-- updated_at 자동 갱신 (프로젝트 표준 함수 사용)
DROP TRIGGER IF EXISTS trg_lb_set_updated_at ON library_books;
CREATE TRIGGER trg_lb_set_updated_at
  BEFORE UPDATE ON library_books
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- copyright_safe_in_kr 자동 계산 (저자 사후 70년 경과 여부)
CREATE OR REPLACE FUNCTION lb_compute_kr_safe() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.copyright_safe_in_kr := (
    NEW.author_death_year IS NOT NULL
    AND NEW.author_death_year < EXTRACT(YEAR FROM CURRENT_DATE)::INT - 70
  );
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_lb_compute_kr_safe ON library_books;
CREATE TRIGGER trg_lb_compute_kr_safe
  BEFORE INSERT OR UPDATE OF author_death_year ON library_books
  FOR EACH ROW EXECUTE FUNCTION lb_compute_kr_safe();

-- search_vector 자동 갱신 (title/author/category_tags 변경 시)
CREATE OR REPLACE FUNCTION lb_compute_search_vector() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('english', coalesce(NEW.title,  '')), 'A') ||
    setweight(to_tsvector('english', coalesce(NEW.author, '')), 'B') ||
    setweight(to_tsvector('english', coalesce(array_to_string(NEW.category_tags, ' '), '')), 'C');
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_lb_compute_search_vector ON library_books;
CREATE TRIGGER trg_lb_compute_search_vector
  BEFORE INSERT OR UPDATE OF title, author, category_tags ON library_books
  FOR EACH ROW EXECUTE FUNCTION lb_compute_search_vector();

ALTER TABLE library_books ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone_read_published_safe" ON library_books FOR SELECT
  USING (status='published' AND copyright_safe_in_kr=true);

CREATE POLICY "service_role_all_books" ON library_books FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

COMMENT ON TABLE library_books IS
  'LCP v2.0 — 라이브러리 책 마스터. admin 큐레이션 전용.';

-- ─────────────────────────────────────────────
-- ④ library_chapters_master — chapter staging with pre-computed metadata
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS library_chapters_master (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_book_id     UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
  chapter_idx         INT  NOT NULL,
  chapter_title       TEXT,

  -- content-addressed 참조
  content_hash        TEXT NOT NULL REFERENCES content_chunks(hash),
  word_count          INT  NOT NULL,
  cefr_level          TEXT,

  -- pre-computed metadata (Workspace mount 시 winkNLP 0회)
  paragraph_offsets   INT[] NOT NULL DEFAULT '{}',
  sentence_offsets    INT[] NOT NULL DEFAULT '{}',

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (library_book_id, chapter_idx)
);

CREATE INDEX IF NOT EXISTS idx_lcm_book ON library_chapters_master (library_book_id, chapter_idx);

ALTER TABLE library_chapters_master ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_via_published" ON library_chapters_master FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM library_books
    WHERE id = library_book_id
      AND status='published'
      AND copyright_safe_in_kr=true
  ));

CREATE POLICY "service_role_all_chapters" ON library_chapters_master FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

COMMENT ON TABLE library_chapters_master IS
  'LCP v2.0 — chapter 정본 staging. 라이브러리 본문의 single source of truth.';

-- ─────────────────────────────────────────────
-- ⑤ library_book_vocabularies — pre-computed word list with LV Score
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS library_book_vocabularies (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  library_book_id       UUID NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
  chapter_idx           INT  NOT NULL,
  word                  TEXT NOT NULL,                 -- shared_dictionary.word matching key

  frequency_in_book     INT  NOT NULL DEFAULT 1,
  frequency_in_chapter  INT  NOT NULL DEFAULT 1,
  first_sentence        TEXT,
  base_learning_value   FLOAT NOT NULL DEFAULT 0,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (library_book_id, word)
);

CREATE INDEX IF NOT EXISTS idx_lbv_chapter_lv
  ON library_book_vocabularies (library_book_id, chapter_idx, base_learning_value DESC);

ALTER TABLE library_book_vocabularies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_vocab_via_published" ON library_book_vocabularies FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM library_books
    WHERE id = library_book_id
      AND status='published'
      AND copyright_safe_in_kr=true
  ));

CREATE POLICY "service_role_all_vocab" ON library_book_vocabularies FOR ALL
  USING (auth.jwt()->>'role' = 'service_role');

COMMENT ON TABLE library_book_vocabularies IS
  'LCP v2.0 — chapter별 사전계산 단어 리스트. base_learning_value DESC 정렬.';

-- ─────────────────────────────────────────────
-- ⑥ texts 확장 — 라이브러리 책의 chapter 표현
-- ─────────────────────────────────────────────
ALTER TABLE texts ADD COLUMN IF NOT EXISTS library_book_id        UUID REFERENCES library_books(id);
ALTER TABLE texts ADD COLUMN IF NOT EXISTS chapter_idx            INT;
ALTER TABLE texts ADD COLUMN IF NOT EXISTS chapter_title          TEXT;
ALTER TABLE texts ADD COLUMN IF NOT EXISTS current_paragraph_idx  INT DEFAULT 0;

-- content NULL 허용 (라이브러리 책은 master에서 lazy load)
DO $$
BEGIN
  ALTER TABLE texts ALTER COLUMN content DROP NOT NULL;
EXCEPTION WHEN OTHERS THEN
  NULL;  -- 이미 NULLABLE이면 무시
END $$;

-- 데이터 무결성: 직접입력(content) 또는 라이브러리(library_book_id) 둘 중 하나는 반드시 존재
ALTER TABLE texts DROP CONSTRAINT IF EXISTS chk_content_or_library;
ALTER TABLE texts ADD CONSTRAINT chk_content_or_library
  CHECK (content IS NOT NULL OR library_book_id IS NOT NULL);

CREATE INDEX IF NOT EXISTS idx_texts_library_chapter
  ON texts (library_book_id, chapter_idx)
  WHERE library_book_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_texts_user_library
  ON texts (user_id, library_book_id, chapter_idx)
  WHERE library_book_id IS NOT NULL;

-- ─────────────────────────────────────────────
-- ⑦ reading_sessions — 사용자별 동적 분할
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS reading_sessions (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  text_id              UUID NOT NULL REFERENCES texts(id) ON DELETE CASCADE,
  user_id              UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_idx          INT  NOT NULL,
  start_paragraph_idx  INT  NOT NULL,
  end_paragraph_idx    INT  NOT NULL,
  estimated_minutes    INT,
  status               TEXT NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','reading','done')),
  started_at           TIMESTAMPTZ,
  completed_at         TIMESTAMPTZ,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (text_id, session_idx)
);

CREATE INDEX IF NOT EXISTS idx_rs_user_status
  ON reading_sessions (user_id, status, session_idx);
CREATE INDEX IF NOT EXISTS idx_rs_text
  ON reading_sessions (text_id, session_idx);

ALTER TABLE reading_sessions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_sessions" ON reading_sessions FOR ALL
  USING (auth.uid() = user_id);

COMMENT ON TABLE reading_sessions IS
  'LCP v2.0 — 사용자별 chapter 동적 분할. Cold=8분 / Warm=15분 / Hot=25분.';

-- ─────────────────────────────────────────────
-- ⑧ Materialized View — Hot Dictionary (Tier 3 cache)
--    pronunciation 컬럼은 shared_dictionary에 부재 → 제외
-- ─────────────────────────────────────────────
CREATE MATERIALIZED VIEW IF NOT EXISTS hot_dictionary AS
SELECT
  word, meaning_ko, meanings_ko, pos, pos_all,
  cefr_level, frequency_rank, example_en, verified
FROM shared_dictionary
WHERE
  meaning_ko IS NOT NULL AND
  ((frequency_rank IS NOT NULL AND frequency_rank <= 10000)
   OR cefr_level IN ('A1','A2','B1')
   OR verified = true);

CREATE UNIQUE INDEX IF NOT EXISTS idx_hot_dict_word ON hot_dictionary(word);
CREATE INDEX IF NOT EXISTS idx_hot_dict_cefr        ON hot_dictionary(cefr_level);
CREATE INDEX IF NOT EXISTS idx_hot_dict_freq        ON hot_dictionary(frequency_rank);

COMMENT ON MATERIALIZED VIEW hot_dictionary IS
  'LCP v2.0 — Tier 3 cache. ~10K hot words. pg_cron이 매주 일요일 KST 03:00 새로고침.';

-- ─────────────────────────────────────────────
-- ⑨ Views — content + book progress
-- ─────────────────────────────────────────────
CREATE OR REPLACE VIEW v_text_content AS
SELECT
  t.id, t.user_id, t.title, t.cefr_level, t.status, t.progress_percent,
  t.library_book_id, t.chapter_idx, t.chapter_title, t.current_paragraph_idx,
  COALESCE(t.content, cc.content) as content,
  lcm.paragraph_offsets,
  lcm.sentence_offsets,
  lcm.word_count as chapter_word_count
FROM texts t
LEFT JOIN library_chapters_master lcm
  ON lcm.library_book_id = t.library_book_id
  AND lcm.chapter_idx    = t.chapter_idx
LEFT JOIN content_chunks cc
  ON cc.hash = lcm.content_hash;

GRANT SELECT ON v_text_content TO authenticated;

CREATE OR REPLACE VIEW v_user_book_progress AS
SELECT
  t.user_id,
  t.library_book_id,
  lb.title,
  lb.author,
  lb.cover_from,
  lb.cover_to,
  lb.cefr_level,
  COUNT(*) as total_chapters,
  COUNT(*) FILTER (WHERE t.status IN ('completed','conquered','extracted')) as done_chapters,
  ROUND(AVG(t.progress_percent)::numeric, 1) as avg_progress_percent,
  MAX(t.updated_at) as last_activity
FROM texts t
JOIN library_books lb ON lb.id = t.library_book_id
WHERE t.library_book_id IS NOT NULL
GROUP BY t.user_id, t.library_book_id, lb.title, lb.author, lb.cover_from, lb.cover_to, lb.cefr_level;

GRANT SELECT ON v_user_book_progress TO authenticated;

-- ─────────────────────────────────────────────
-- ⑩ pgmq queue
-- ─────────────────────────────────────────────
SELECT pgmq.create('library_pipeline');

-- ─────────────────────────────────────────────
-- ⑪ pg_cron schedules
--    DB timezone=UTC 확인 → 의도(KST) 보존하면서 cron 식을 UTC로 변환
--    KST = UTC + 9
-- ─────────────────────────────────────────────
-- 동명 job 멱등 처리
SELECT cron.unschedule(jobname) FROM cron.job
  WHERE jobname IN ('refresh-hot-dictionary','gc-content-chunks','library-pipeline-worker','archive-stale-drafts','recompute-kr-safe');

-- 매주 일요일 KST 03:00 = 매주 토요일 UTC 18:00
SELECT cron.schedule(
  'refresh-hot-dictionary',
  '0 18 * * 6',
  $$REFRESH MATERIALIZED VIEW CONCURRENTLY hot_dictionary$$
);

-- 매일 KST 04:00 = 매일 UTC 19:00
SELECT cron.schedule(
  'gc-content-chunks',
  '0 19 * * *',
  $$DELETE FROM content_chunks
    WHERE ref_count = 0 AND created_at < now() - INTERVAL '7 days'$$
);

-- 매주 일요일 KST 02:00 = 매주 토요일 UTC 17:00
SELECT cron.schedule(
  'archive-stale-drafts',
  '0 17 * * 6',
  $$UPDATE library_books SET status='archived'
    WHERE status='failed' AND updated_at < now() - INTERVAL '30 days'$$
);

-- 매년 1월 1일 KST 00:00 = 12월 31일 UTC 15:00 — copyright_safe_in_kr 일괄 재계산
SELECT cron.schedule(
  'recompute-kr-safe',
  '0 15 31 12 *',
  $$UPDATE library_books SET author_death_year = author_death_year
    WHERE author_death_year IS NOT NULL$$
);

-- worker job은 Phase 7에서 함수 정의 후 등록

-- ─────────────────────────────────────────────
-- ⑫ Helper functions — content_chunks ref counting
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION incr_chunk_refs(p_hashes TEXT[])
RETURNS VOID LANGUAGE sql AS $$
  UPDATE content_chunks
  SET ref_count = ref_count + 1
  WHERE hash = ANY(p_hashes);
$$;

CREATE OR REPLACE FUNCTION decr_chunk_refs(p_hashes TEXT[])
RETURNS VOID LANGUAGE sql AS $$
  UPDATE content_chunks
  SET ref_count = GREATEST(ref_count - 1, 0)
  WHERE hash = ANY(p_hashes);
$$;

-- chapter INSERT/UPDATE/DELETE 시 ref_count 자동 동기화
CREATE OR REPLACE FUNCTION trg_lcm_chunk_refs() RETURNS TRIGGER
LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE content_chunks SET ref_count = ref_count + 1 WHERE hash = NEW.content_hash;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE content_chunks SET ref_count = GREATEST(ref_count - 1, 0) WHERE hash = OLD.content_hash;
  ELSIF TG_OP = 'UPDATE' AND OLD.content_hash <> NEW.content_hash THEN
    UPDATE content_chunks SET ref_count = GREATEST(ref_count - 1, 0) WHERE hash = OLD.content_hash;
    UPDATE content_chunks SET ref_count = ref_count + 1                WHERE hash = NEW.content_hash;
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;

DROP TRIGGER IF EXISTS trg_lcm_chunk_refs ON library_chapters_master;
CREATE TRIGGER trg_lcm_chunk_refs
  AFTER INSERT OR UPDATE OR DELETE ON library_chapters_master
  FOR EACH ROW EXECUTE FUNCTION trg_lcm_chunk_refs();

COMMIT;

-- ═══════════════════════════════════════════════════════════
-- 적용 후 검증 쿼리 (수동 실행 권장)
-- ═══════════════════════════════════════════════════════════
-- SELECT COUNT(*) FROM library_books;                           -- 0
-- SELECT COUNT(*) FROM hot_dictionary;                          -- ~10000
-- SELECT jobname, schedule FROM cron.job ORDER BY jobname;      -- 3 jobs (worker는 Phase 7)
-- SELECT EXISTS(SELECT 1 FROM pgmq.list_queues() WHERE queue_name='library_pipeline');  -- true
-- SELECT column_name FROM information_schema.columns
--   WHERE table_name='texts'
--     AND column_name IN ('library_book_id','chapter_idx','chapter_title','current_paragraph_idx');  -- 4 rows
-- SELECT pg_get_constraintdef(oid) FROM pg_constraint WHERE conname='chk_content_or_library';  -- CHECK 표시
