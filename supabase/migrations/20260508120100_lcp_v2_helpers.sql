-- supabase/migrations/20260508120100_lcp_v2_helpers.sql
-- ═══════════════════════════════════════════════════════════
-- LCP v2.0 — Content storage helper functions (Phase 2)
-- ═══════════════════════════════════════════════════════════
-- depends on: 20260508120000_lcp_v2 (content_chunks, texts.library_book_id, v_text_content)
--
-- 보완 사항:
--   - SECURITY DEFINER 함수에 SET search_path 명시
--   - pgcrypto.digest 가 extensions 스키마이므로 search_path 에 extensions 포함
--   - get_chapter_content 는 auth.uid 호출 → search_path 에 auth 추가
-- ═══════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────
-- store_content_chunk — 본문 저장 (SHA-256 dedup)
-- 동일 hash 존재 시 ON CONFLICT DO NOTHING (ref_count 는 트리거가 관리)
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION store_content_chunk(p_content TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_hash TEXT;
BEGIN
  IF p_content IS NULL OR length(btrim(p_content)) = 0 THEN
    RAISE EXCEPTION 'store_content_chunk: empty content';
  END IF;

  v_hash := encode(digest(p_content, 'sha256'), 'hex');

  INSERT INTO content_chunks (hash, content, byte_size, ref_count)
  VALUES (v_hash, p_content, octet_length(p_content), 0)
  ON CONFLICT (hash) DO NOTHING;

  RETURN v_hash;
END $$;

REVOKE ALL ON FUNCTION store_content_chunk(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION store_content_chunk(TEXT) TO service_role;

COMMENT ON FUNCTION store_content_chunk(TEXT) IS
  'LCP v2.0 Phase 2 — 본문 SHA-256 dedup 저장. service_role 전용.';

-- ─────────────────────────────────────────────
-- get_chapter_content — texts row 의 본문 조회 (RLS 우회 + 권한 검증)
-- 라이브러리 책 chapter 면 v_text_content 의 COALESCE 로 content_chunks 에서 lazy load
-- 직접입력 텍스트면 texts.content 에서 그대로
-- ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_chapter_content(p_text_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
DECLARE
  v_content TEXT;
  v_user_id UUID;
  v_caller  UUID;
BEGIN
  v_caller := auth.uid();

  SELECT user_id INTO v_user_id FROM texts WHERE id = p_text_id;
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Text not found: %', p_text_id;
  END IF;
  IF v_caller IS NULL OR v_user_id <> v_caller THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  SELECT content INTO v_content FROM v_text_content WHERE id = p_text_id;
  RETURN v_content;
END $$;

REVOKE ALL ON FUNCTION get_chapter_content(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION get_chapter_content(UUID) TO authenticated;

COMMENT ON FUNCTION get_chapter_content(UUID) IS
  'LCP v2.0 Phase 2 — 본인 텍스트 본문 조회. 라이브러리 책 chapter 는 master 에서 lazy load.';
