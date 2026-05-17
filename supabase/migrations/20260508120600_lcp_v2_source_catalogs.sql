-- ═══════════════════════════════════════════════════════════
-- LCP v2.0 Phase 12 — Source catalogs + admin RLS/RPC
-- ═══════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────
-- ① source enum 확장 (4 → 9)
-- ─────────────────────────────────────────────
ALTER TABLE library_books DROP CONSTRAINT IF EXISTS library_books_source_check;
ALTER TABLE library_books ADD CONSTRAINT library_books_source_check
  CHECK (source IN (
    'gutenberg', 'standard_ebooks', 'wikisource', 'wikibooks',
    'open_library', 'hathitrust', 'voa_learning', 'librivox', 'manual'
  ));

-- ─────────────────────────────────────────────
-- ② library_source_catalogs 신규 테이블
-- ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS library_source_catalogs (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source                   TEXT NOT NULL UNIQUE,
  display_name             TEXT NOT NULL,
  description              TEXT,
  api_endpoint             TEXT,
  catalog_url              TEXT,
  documentation_url        TEXT,

  -- 평가 점수 0.0~5.0
  quality_text             FLOAT NOT NULL CHECK (quality_text BETWEEN 0 AND 5),
  quality_metadata         FLOAT NOT NULL CHECK (quality_metadata BETWEEN 0 AND 5),
  quality_api              FLOAT NOT NULL CHECK (quality_api BETWEEN 0 AND 5),
  quality_learning         FLOAT NOT NULL CHECK (quality_learning BETWEEN 0 AND 5),
  quality_license          FLOAT NOT NULL CHECK (quality_license BETWEEN 0 AND 5),
  quality_volume           FLOAT NOT NULL CHECK (quality_volume BETWEEN 0 AND 5),

  -- 가중 평균 (0.30 + 0.20 + 0.20 + 0.15 + 0.10 + 0.05)
  composite_score          FLOAT NOT NULL DEFAULT 0,

  license_summary          TEXT NOT NULL,
  copyright_safe_in_kr     BOOLEAN NOT NULL,
  catalog_size             INT,
  is_implemented           BOOLEAN NOT NULL DEFAULT false,
  is_enabled               BOOLEAN NOT NULL DEFAULT true,
  notes                    TEXT,

  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- composite_score 자동 계산 트리거
CREATE OR REPLACE FUNCTION lsc_compute_composite()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.composite_score :=
    NEW.quality_text     * 0.30 +
    NEW.quality_metadata * 0.20 +
    NEW.quality_api      * 0.20 +
    NEW.quality_learning * 0.15 +
    NEW.quality_license  * 0.10 +
    NEW.quality_volume   * 0.05;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_lsc_composite ON library_source_catalogs;
CREATE TRIGGER trg_lsc_composite
  BEFORE INSERT OR UPDATE OF
    quality_text, quality_metadata, quality_api,
    quality_learning, quality_license, quality_volume
  ON library_source_catalogs
  FOR EACH ROW EXECUTE FUNCTION lsc_compute_composite();

DROP TRIGGER IF EXISTS trg_lsc_updated_at ON library_source_catalogs;
CREATE TRIGGER trg_lsc_updated_at
  BEFORE UPDATE ON library_source_catalogs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE library_source_catalogs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "anyone_read_enabled_catalogs" ON library_source_catalogs;
CREATE POLICY "anyone_read_enabled_catalogs" ON library_source_catalogs
  FOR SELECT USING (is_enabled = true);

DROP POLICY IF EXISTS "service_role_all_catalogs" ON library_source_catalogs;
CREATE POLICY "service_role_all_catalogs" ON library_source_catalogs
  FOR ALL USING (auth.jwt()->>'role' = 'service_role');

-- ─────────────────────────────────────────────
-- ③ 9 소스 시드
-- ─────────────────────────────────────────────
INSERT INTO library_source_catalogs (
  source, display_name, description,
  api_endpoint, catalog_url, documentation_url,
  quality_text, quality_metadata, quality_api,
  quality_learning, quality_license, quality_volume,
  license_summary, copyright_safe_in_kr,
  catalog_size, is_implemented, is_enabled
) VALUES
('standard_ebooks', 'Standard Ebooks',
 '자원봉사자가 수작업으로 검수한 깔끔한 EPUB 고전. 타이포그래피·메타데이터 최상.',
 'https://standardebooks.org/opds',
 'https://standardebooks.org/ebooks',
 'https://standardebooks.org/contribute',
 5.0, 5.0, 5.0, 4.0, 5.0, 2.0,
 'CC0 (Public Domain Dedication)', true, 700, false, true),

('gutenberg', 'Project Gutenberg',
 '세계 최대 PD 도서 아카이브. 74,000권+. 텍스트 품질 가변적이나 메타 풍부.',
 'https://www.gutenberg.org/cache/epub/feeds/',
 'https://www.gutenberg.org/ebooks/',
 'https://www.gutenberg.org/help/',
 3.0, 4.0, 4.0, 5.0, 5.0, 5.0,
 'PD-US (저자 사후 70년)', true, 74000, true, true),

('wikisource', 'Wikisource (English)',
 '위키 검수 PD 텍스트. 단편/연설/시 등 짧은 콘텐츠가 강점.',
 'https://en.wikisource.org/w/api.php',
 'https://en.wikisource.org/wiki/Main_Page',
 'https://en.wikisource.org/wiki/Help:Contents',
 4.0, 3.0, 4.0, 4.0, 5.0, 4.0,
 'CC-BY-SA + PD', true, 150000, false, true),

('wikibooks', 'Wikibooks',
 '오픈 교재 위키. ESL 교재 (English in Use, Wikijunior 등) 학습 적합도 매우 높음.',
 'https://en.wikibooks.org/w/api.php',
 'https://en.wikibooks.org/wiki/Main_Page',
 'https://en.wikibooks.org/wiki/Help:Contents',
 4.0, 3.0, 4.0, 5.0, 5.0, 2.0,
 'CC-BY-SA', true, 3000, false, true),

('open_library', 'Open Library / Internet Archive',
 '거대 OCR 도서관. OCR 노이즈 많지만 규모 압도적. 후처리 필수.',
 'https://openlibrary.org/api',
 'https://openlibrary.org/',
 'https://openlibrary.org/developers/api',
 2.0, 4.0, 4.0, 3.0, 3.0, 5.0,
 'PD/Borrowable mixed', false, 5000000, false, true),

('hathitrust', 'HathiTrust',
 '미국 학술 도서관 컨소시엄. PD 책 제한적 (미국 IP만 일부) 학술 위주.',
 'https://www.hathitrust.org/data_api',
 'https://www.hathitrust.org/',
 'https://www.hathitrust.org/data',
 3.0, 4.0, 3.0, 3.0, 3.0, 4.0,
 'PD only (제한적)', true, 17000000, false, true),

('voa_learning', 'VOA Learning English',
 'ESL 전용 큐레이션. 레벨별 (Level 1/2/3) 명확. 공식 API 없어 RSS 기반.',
 NULL,
 'https://learningenglish.voanews.com/',
 'https://learningenglish.voanews.com/about',
 5.0, 4.0, 1.0, 5.0, 5.0, 3.0,
 'US Government PD', true, 5000, false, true),

('librivox', 'LibriVox',
 '자원봉사 오디오북. 텍스트는 Gutenberg와 중복이나 오디오 학습용 가치 있음.',
 'https://librivox.org/api/info',
 'https://librivox.org/',
 'https://wiki.librivox.org/index.php?title=LibriVox_API',
 3.0, 3.0, 3.0, 3.0, 5.0, 3.0,
 'PD (audio + text)', true, 17000, false, true),

('manual', '수동 입력',
 'admin이 직접 텍스트를 입력하는 케이스. 검증 admin 책임.',
 NULL, NULL, NULL,
 5.0, 3.0, 1.0, 4.0, 3.0, 1.0,
 'admin 책임', false, NULL, true, true)
ON CONFLICT (source) DO NOTHING;

-- ─────────────────────────────────────────────
-- ④ Admin role helper (user_profiles uses user_id as PK)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION is_admin_or_curator()
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
STABLE
SET search_path = public, auth
AS $$
DECLARE
  v_role TEXT;
BEGIN
  IF auth.uid() IS NULL THEN RETURN false; END IF;
  SELECT role INTO v_role FROM user_profiles WHERE user_id = auth.uid();
  RETURN v_role IN ('admin', 'curator');
END $$;

REVOKE ALL ON FUNCTION is_admin_or_curator() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION is_admin_or_curator() TO authenticated;

DROP POLICY IF EXISTS "admin_curator_all_books" ON library_books;
CREATE POLICY "admin_curator_all_books" ON library_books
  FOR ALL
  USING (is_admin_or_curator())
  WITH CHECK (is_admin_or_curator());

DROP POLICY IF EXISTS "admin_curator_read_chapters" ON library_chapters_master;
CREATE POLICY "admin_curator_read_chapters" ON library_chapters_master
  FOR SELECT USING (is_admin_or_curator());

DROP POLICY IF EXISTS "admin_curator_read_vocab" ON library_book_vocabularies;
CREATE POLICY "admin_curator_read_vocab" ON library_book_vocabularies
  FOR SELECT USING (is_admin_or_curator());

DROP POLICY IF EXISTS "admin_curator_update_catalogs" ON library_source_catalogs;
CREATE POLICY "admin_curator_update_catalogs" ON library_source_catalogs
  FOR UPDATE USING (is_admin_or_curator()) WITH CHECK (is_admin_or_curator());

-- ─────────────────────────────────────────────
-- ⑤ admin_enqueue_book — 책 추가 멱등
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_enqueue_book(
  p_source TEXT,
  p_source_id TEXT,
  p_title TEXT,
  p_author TEXT DEFAULT NULL,
  p_author_birth_year INT DEFAULT NULL,
  p_author_death_year INT DEFAULT NULL,
  p_license TEXT DEFAULT 'PD-US'
) RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq, extensions
AS $$
DECLARE
  v_book_id UUID;
  v_existing UUID;
BEGIN
  IF NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;

  SELECT id INTO v_existing
  FROM library_books
  WHERE source = p_source AND source_id = p_source_id
  LIMIT 1;

  IF v_existing IS NOT NULL THEN
    RETURN v_existing;
  END IF;

  INSERT INTO library_books (
    source, source_id, title, author,
    author_birth_year, author_death_year,
    license, status
  ) VALUES (
    p_source, p_source_id, p_title, p_author,
    p_author_birth_year, p_author_death_year,
    p_license, 'queued'
  ) RETURNING id INTO v_book_id;

  RETURN v_book_id;
END $$;

REVOKE ALL ON FUNCTION admin_enqueue_book(TEXT,TEXT,TEXT,TEXT,INT,INT,TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_enqueue_book(TEXT,TEXT,TEXT,TEXT,INT,INT,TEXT) TO authenticated;

-- ─────────────────────────────────────────────
-- ⑥ admin_requeue_book
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_requeue_book(p_book_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pgmq, extensions
AS $$
BEGIN
  IF NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;

  UPDATE library_books
  SET status = 'queued', status_message = NULL
  WHERE id = p_book_id;

  PERFORM pgmq.send(
    'library_pipeline',
    jsonb_build_object('book_id', p_book_id, 'enqueued_at', now(), 'requeued', true)
  );

  RETURN 'requeued';
END $$;

REVOKE ALL ON FUNCTION admin_requeue_book(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_requeue_book(UUID) TO authenticated;

-- ─────────────────────────────────────────────
-- ⑦ admin_force_publish_book
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_force_publish_book(p_book_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE v_book RECORD;
BEGIN
  IF NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;

  SELECT * INTO v_book FROM library_books WHERE id = p_book_id;
  IF v_book IS NULL THEN
    RAISE EXCEPTION 'Book not found: %', p_book_id;
  END IF;

  IF NOT v_book.copyright_safe_in_kr THEN
    RAISE EXCEPTION 'Cannot publish: copyright_safe_in_kr=false';
  END IF;

  UPDATE library_books
  SET status = 'published',
      published_at = COALESCE(published_at, now())
  WHERE id = p_book_id;

  RETURN 'published';
END $$;

REVOKE ALL ON FUNCTION admin_force_publish_book(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_force_publish_book(UUID) TO authenticated;

-- ─────────────────────────────────────────────
-- ⑧ admin_archive_book
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION admin_archive_book(p_book_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;

  UPDATE library_books
  SET status = 'archived'
  WHERE id = p_book_id;

  RETURN 'archived';
END $$;

REVOKE ALL ON FUNCTION admin_archive_book(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION admin_archive_book(UUID) TO authenticated;

COMMIT;
