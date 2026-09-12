-- supabase/migrations/20260808240000_comic_catalog_p1.sql
--
-- CCP × Library P1 — 카탈로그 큐레이션 + 미등록 프리뷰.
-- 설계: docs/CCP_LIBRARY_INTEGRATION.md §7.1·§7.2 · D4(미등록도 만화를 볼 수 있어야 유입이 성립)
--
-- 해소하는 실측 결함:
--   G3 미등록 학습자 열람 불가 — 리더 라우트가 texts.id(=enroll)를 요구 → preview_book_comic 로 등록 전 3컷 열람
--   G4 노출이 알파벳순 고정   — list_book_comic_catalog 의 ORDER BY b.title → feature_rank/published_at 큐레이션 정렬
--   G5 커버 1장에 전권 payload — select_book_comic_all 을 목록에서 호출하던 것을 RPC 내부 첫 컷 조회로 대체
--
-- 보안: 두 read RPC 모두 SECURITY DEFINER + comic_books/library_books 이중 published 게이트 유지.
--   프리뷰는 anon 허용(등록 전 유입) + 서버측 LIMIT 하드캡(≤5)으로 전권 유출 차단.
-- 적용: 2026-08-09 dev(jajenrevcbmrpaliomxv) apply_migration(comic_catalog_p1) 완료 — 사용자 승인 후.
--   검증: list_comic_catalog 1행(A Christmas Carol · 90컷 · 5챕터 · cover_url 실값)
--        preview_book_comic(p_limit=99) → 5행(서버 하드캡 동작) · 두 함수 anon EXECUTE 확인.
--
-- ⚠️ 적용 중 발견 — Supabase 기본 권한(ALTER DEFAULT PRIVILEGES)이 public 스키마의 새 함수에
--   anon/authenticated EXECUTE 를 자동 부여한다. 그래서 `REVOKE ALL ... FROM PUBLIC` 만으로는
--   anon 이 막히지 않으며, 실제로 select_book_comic_all(전권 90컷 + bubbles + target_vocab)도
--   anon 실행 가능 상태다(마이그레이션 파일엔 authenticated 만 GRANT 했음에도).
--   → 프리뷰 하드캡(5컷)은 전권 유출을 막지 못한다. 후속 마이그레이션에서 명시 REVOKE 필요(승인 대기).

-- ─────────────────────────────────────────────────────────────
-- 1. comic_books — 큐레이션 컬럼
-- ─────────────────────────────────────────────────────────────
ALTER TABLE comic_books ADD COLUMN IF NOT EXISTS feature_rank smallint;
ALTER TABLE comic_books ADD COLUMN IF NOT EXISTS preview_from int NOT NULL DEFAULT 0;

ALTER TABLE comic_books DROP CONSTRAINT IF EXISTS comic_books_preview_from_chk;
ALTER TABLE comic_books
  ADD CONSTRAINT comic_books_preview_from_chk CHECK (preview_from >= 0);

COMMENT ON COLUMN comic_books.feature_rank IS
  '카탈로그 노출 우선순위(작을수록 앞). NULL = 미지정 → published_at DESC 폴백';
COMMENT ON COLUMN comic_books.preview_from IS
  '미등록 프리뷰 시작 컷 오프셋(0=첫 컷). 스포일러/도입부 회피용';

-- ─────────────────────────────────────────────────────────────
-- 2. list_comic_catalog — 학습자 카탈로그(커버 포함, 큐레이션 정렬)
--    RETURNS TABLE 과 실 컬럼 타입이 어긋나면 런타임 에러가 나므로 전부 명시 캐스팅.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.list_comic_catalog()
RETURNS TABLE(
  library_book_id     uuid,
  title               text,
  author              text,
  book_v_level        smallint,
  panels_total        int,
  chapters_total      int,
  cover_url           text,
  genre_norm          text,
  lexical_coverage    jsonb,
  is_picture_book     boolean,
  reading_minutes     int,
  book_chapter_count  int,
  has_audio           boolean,
  feature_rank        smallint,
  published_at        timestamptz
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT
    b.id,
    b.title::text,
    b.author::text,
    cb.book_v_level::smallint,
    cb.panels_total::int,
    (SELECT count(DISTINCT p.chapter_idx)::int
       FROM comic_pages p WHERE p.library_book_id = b.id),
    (SELECT p.image_url::text
       FROM comic_pages p
      WHERE p.library_book_id = b.id
      ORDER BY p.chapter_idx, p.page_order
      LIMIT 1),
    (b.curation_metadata->>'genre_norm')::text,
    b.lexical_coverage::jsonb,
    coalesce(b.is_picture_book, false)::boolean,
    b.reading_minutes::int,
    b.chapter_count::int,
    (b.librivox_audio IS NOT NULL)::boolean,
    cb.feature_rank::smallint,
    cb.published_at
  FROM comic_books cb
  JOIN library_books b ON b.id = cb.library_book_id AND b.status = 'published'
  WHERE cb.status = 'published'
  ORDER BY cb.feature_rank ASC NULLS LAST,
           cb.published_at DESC NULLS LAST,
           cb.panels_total DESC,
           b.title;
$$;
REVOKE ALL ON FUNCTION public.list_comic_catalog() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_comic_catalog() TO authenticated, anon;

-- ─────────────────────────────────────────────────────────────
-- 3. preview_book_comic — 미등록/비로그인 프리뷰 (D4)
--    · published 이중 게이트 유지
--    · 컷 수 서버 하드캡 5 (클라가 큰 값을 보내도 절삭)
--    · target_vocab 미반환 — 프리뷰는 유입용, 학습 자산(정본 vocab)은 리더에서만
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.preview_book_comic(p_book_id uuid, p_limit int DEFAULT 3)
RETURNS TABLE(
  page_order  int,
  chapter_idx int,
  image_url   text,
  bubbles     jsonb,
  stave_label text
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.page_order::int, p.chapter_idx::int, p.image_url::text, p.bubbles::jsonb, p.stave_label::text
  FROM comic_pages p
  JOIN comic_books cb  ON cb.library_book_id = p.library_book_id AND cb.status = 'published'
  JOIN library_books b ON b.id = p.library_book_id AND b.status = 'published'
  WHERE p.library_book_id = p_book_id
  ORDER BY p.chapter_idx, p.page_order
  OFFSET (SELECT greatest(coalesce(cb2.preview_from, 0), 0)
            FROM comic_books cb2 WHERE cb2.library_book_id = p_book_id)
  LIMIT greatest(1, least(coalesce(p_limit, 3), 5));
$$;
REVOKE ALL ON FUNCTION public.preview_book_comic(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.preview_book_comic(uuid, int) TO authenticated, anon;

-- ─────────────────────────────────────────────────────────────
-- 4. 기존 카탈로그 RPC 도 anon 허용 (미로그인 발견 경로 — 게이트는 동일)
-- ─────────────────────────────────────────────────────────────
GRANT EXECUTE ON FUNCTION public.list_book_comic_catalog() TO anon;

COMMENT ON FUNCTION public.list_comic_catalog() IS
  'CCP 학습자 카탈로그 — 발행 이중 게이트 + 첫 컷 커버 + feature_rank 큐레이션 정렬';
COMMENT ON FUNCTION public.preview_book_comic(uuid, int) IS
  'CCP 미등록 프리뷰 — 발행 이중 게이트 + 서버 하드캡 5컷 + preview_from 오프셋';
