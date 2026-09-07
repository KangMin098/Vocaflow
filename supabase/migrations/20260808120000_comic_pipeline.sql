-- supabase/migrations/20260808120000_comic_pipeline.sql
--
-- CCP (Comic Curation Pipeline) — book→comic 파이프라인 저장/큐/발행 계약.
-- 설계: library_chapter_quiz 미러 + (quiz엔 없던) 독립 발행 게이트 헤더 + 지속 QC 판정.
-- 검토 반영:
--   ① comic_books 헤더 = 발행 게이트(draft/published) + qc_verdict 지속 저장
--      (book_curation_jobs.result 는 재적재 시 NULL 소실 → 런 로그 전용, 판정 사본은 헤더로).
--   ② 이미지 = 외부/서명 URL (illustrations 관례) — 공개 버킷 신설 안 함(드래프트 유출·egress 차단).
--   ③ 학습자 RPC 전부 status='published' 게이트(quiz 템플릿엔 필터 없음 → 유출 방지).
--   ④ book_curation_jobs panels_total/panels_done 실 컬럼 신설(questions_created 재활용 금지).
-- 적용: 2026-08-08 dev(jajenrevcbmrpaliomxv) SQL Editor 로 적용 완료 + service_role 검증(테이블 2·RPC 5).

-- ─────────────────────────────────────────────────────────────
-- 1. comic_books — 도서별 만화 헤더(발행 게이트 + QC 판정 사본)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comic_books (
  library_book_id uuid PRIMARY KEY REFERENCES library_books(id) ON DELETE CASCADE,
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','published','archived')),
  style         text,                       -- 'gonick' 등 화풍
  backend       text,                       -- 'gpt-image-2' 등 생성 백엔드
  book_v_level  smallint,                   -- 생성 시점 V-Level 스냅샷
  panels_total  int NOT NULL DEFAULT 0,
  panels_pass   boolean NOT NULL DEFAULT false,  -- QC 게이트 통과(수렴 pass + verbatim=0)
  qc_verdict    jsonb,                       -- 지속 QC 판정 사본 {panels_pass,verbatim_mismatch[],rule_violations[]}
  published_at  timestamptz,
  created_by    uuid,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER trg_comic_books_updated BEFORE UPDATE ON comic_books
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE comic_books ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_curator_comic_books ON comic_books;
CREATE POLICY admin_curator_comic_books ON comic_books FOR ALL
  USING (is_admin_or_curator()) WITH CHECK (is_admin_or_curator());

-- ─────────────────────────────────────────────────────────────
-- 2. comic_pages — 컷(패널) 단위. (library_book_id, chapter_idx, page_order) 자연키.
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS comic_pages (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  library_book_id uuid NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
  chapter_idx     int NOT NULL,
  page_order      int NOT NULL,
  image_url       text NOT NULL,             -- 외부/서명 URL (base64/바이너리 저장 금지)
  bubbles         jsonb NOT NULL DEFAULT '[]',   -- [{speaker,text,kind,pos,verbatim,by,adapted_from}]
  target_vocab    text[] NOT NULL DEFAULT '{}',  -- verbatim=true 버블에서만 표면화(원문 정합)
  stave_label     text,
  book_v_level    smallint,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT comic_pages_uniq UNIQUE (library_book_id, chapter_idx, page_order),
  CONSTRAINT comic_pages_page_order_chk CHECK (page_order >= 0)
);

CREATE INDEX IF NOT EXISTS idx_comic_pages_book_chapter
  ON comic_pages (library_book_id, chapter_idx);

CREATE TRIGGER trg_comic_pages_updated BEFORE UPDATE ON comic_pages
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

ALTER TABLE comic_pages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_curator_comic_pages ON comic_pages;
CREATE POLICY admin_curator_comic_pages ON comic_pages FOR ALL
  USING (is_admin_or_curator()) WITH CHECK (is_admin_or_curator());

-- ─────────────────────────────────────────────────────────────
-- 3. book_curation_jobs — comic_gen task 편입 + 실 진행 컬럼
-- ─────────────────────────────────────────────────────────────
ALTER TABLE book_curation_jobs ADD COLUMN IF NOT EXISTS panels_total int;
ALTER TABLE book_curation_jobs ADD COLUMN IF NOT EXISTS panels_done  int;

ALTER TABLE book_curation_jobs DROP CONSTRAINT IF EXISTS book_curation_jobs_task_type_check;
ALTER TABLE book_curation_jobs
  ADD CONSTRAINT book_curation_jobs_task_type_check
  CHECK (task_type IN ('voice_map','quiz_gen','level_verify','vocab_audit','comic_gen'));

-- ─────────────────────────────────────────────────────────────
-- 4. enqueue_comic_jobs — comic_gen 큐 적재 + comic_books 헤더 보장(draft)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.enqueue_comic_jobs(p_book_ids uuid[])
RETURNS TABLE(queued integer, skipped integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_queued int := 0; v_skipped int := 0; v_uid uuid := auth.uid(); r record;
BEGIN
  IF NOT is_admin_or_curator() THEN RAISE EXCEPTION 'Forbidden: admin or curator only'; END IF;
  FOR r IN SELECT id, status, book_v_level FROM library_books WHERE id = ANY(p_book_ids) LOOP
    IF r.status NOT IN ('ready','published') THEN
      v_skipped := v_skipped + 1; CONTINUE;
    END IF;
    -- 헤더 보장(없으면 draft 생성)
    INSERT INTO comic_books (library_book_id, book_v_level, created_by)
    VALUES (r.id, r.book_v_level, v_uid)
    ON CONFLICT (library_book_id) DO NOTHING;
    -- 큐 적재(멱등 upsert)
    INSERT INTO book_curation_jobs (book_id, task_type, status, book_v_level, created_by)
    VALUES (r.id, 'comic_gen', 'pending', r.book_v_level, v_uid)
    ON CONFLICT (book_id, task_type) DO UPDATE SET
      status='pending', result=NULL, error=NULL, note=NULL, claimed_at=NULL,
      panels_done=NULL, created_by=EXCLUDED.created_by, updated_at=now();
    v_queued := v_queued + 1;
  END LOOP;
  RETURN QUERY SELECT v_queued, v_skipped;
END $fn$;
REVOKE ALL ON FUNCTION public.enqueue_comic_jobs(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.enqueue_comic_jobs(uuid[]) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 5. admin_set_comic_published — 발행/회수(헤더 status + QC 판정 사본 고정)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_comic_published(p_book_id uuid, p_published boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_total int; v_pass boolean;
BEGIN
  IF NOT is_admin_or_curator() THEN RAISE EXCEPTION 'Forbidden: admin or curator only'; END IF;
  IF p_published THEN
    SELECT count(*) INTO v_total FROM comic_pages WHERE library_book_id = p_book_id;
    IF v_total = 0 THEN RAISE EXCEPTION '발행할 컷이 없습니다(comic_pages 0).'; END IF;
    SELECT panels_pass INTO v_pass FROM comic_books WHERE library_book_id = p_book_id;
    IF v_pass IS NOT TRUE THEN RAISE EXCEPTION 'QC 게이트 미통과(panels_pass=false) — 발행 불가.'; END IF;
    UPDATE comic_books
      SET status='published', panels_total=v_total, published_at=now()
      WHERE library_book_id = p_book_id;
  ELSE
    UPDATE comic_books SET status='draft', published_at=NULL WHERE library_book_id = p_book_id;
  END IF;
END $fn$;
REVOKE ALL ON FUNCTION public.admin_set_comic_published(uuid, boolean) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_set_comic_published(uuid, boolean) TO authenticated;

-- ─────────────────────────────────────────────────────────────
-- 6. 학습자 read RPC — 전부 발행 게이트(comic_books + library_books published)
-- ─────────────────────────────────────────────────────────────

-- 6a. 챕터별 컷 로드
CREATE OR REPLACE FUNCTION public.select_book_comic(p_book_id uuid, p_chapter_idx int)
RETURNS TABLE(
  page_order int, chapter_idx int, image_url text,
  bubbles jsonb, target_vocab text[], stave_label text, book_v_level smallint
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p.page_order, p.chapter_idx, p.image_url, p.bubbles, p.target_vocab, p.stave_label, p.book_v_level
  FROM comic_pages p
  JOIN comic_books cb ON cb.library_book_id = p.library_book_id AND cb.status = 'published'
  JOIN library_books b ON b.id = p.library_book_id AND b.status = 'published'
  WHERE p.library_book_id = p_book_id AND p.chapter_idx = p_chapter_idx
  ORDER BY p.page_order;
$$;
REVOKE ALL ON FUNCTION public.select_book_comic(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.select_book_comic(uuid, int) TO authenticated;

-- 6b. 발행 만화 카탈로그(학습자 노출)
CREATE OR REPLACE FUNCTION public.list_book_comic_catalog()
RETURNS TABLE(
  library_book_id uuid, title text, author text, book_v_level smallint, panels_total int
)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT b.id, b.title, b.author, cb.book_v_level, cb.panels_total
  FROM comic_books cb
  JOIN library_books b ON b.id = cb.library_book_id
  WHERE cb.status = 'published' AND b.status = 'published'
  ORDER BY b.title;
$$;
REVOKE ALL ON FUNCTION public.list_book_comic_catalog() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.list_book_comic_catalog() TO authenticated;

-- 6c. 특정 도서 발행 여부(리더 pill 게이트용 · 경량)
CREATE OR REPLACE FUNCTION public.book_comic_available(p_book_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM comic_books cb
    JOIN library_books b ON b.id = cb.library_book_id AND b.status = 'published'
    WHERE cb.library_book_id = p_book_id AND cb.status = 'published'
  );
$$;
REVOKE ALL ON FUNCTION public.book_comic_available(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.book_comic_available(uuid) TO authenticated;

COMMENT ON TABLE comic_books IS 'CCP 도서별 만화 헤더 — 발행 게이트(draft/published) + QC 판정 지속 저장';
COMMENT ON TABLE comic_pages IS 'CCP 컷(패널) — (library_book_id,chapter_idx,page_order) 자연키, image_url 외부 URL';
