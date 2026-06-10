-- 20260608120000_book_curation_jobs.sql
-- 큐레이션 도서 일괄 dev 처리 — 작업 큐 + 양 소스(도서·LibriVox) 챕터 적재 + Claude Code 매핑 결과.
--
-- 흐름: /admin/curation Curated Books 에서 처리중/검토대기 도서를 다건 선택 → enqueue.
--   - 처리중(queued/ingesting/.../curating) → mode='dev_process'
--   - 검토대기(ready)                        → mode='dev_reprocess' (+ 현재 챕터 스냅샷)
-- 드레인(= Claude Code 배치, MCP+스크립트)이 책별로: source/librivox 챕터 적재 → 매핑
--   (로직 불가분만 Claude 확정) → chapter_definition/librivox_mapping 기록 → 적용 → done.
-- 이 마이그레이션은 큐 '계약'(테이블 + enqueue RPC)만 만든다. 드레인 자동화는 별도.

BEGIN;

CREATE TABLE IF NOT EXISTS book_curation_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  book_id uuid NOT NULL REFERENCES library_books(id) ON DELETE CASCADE,
  -- 처리중→dev_process · 검토대기→dev_reprocess
  mode text NOT NULL CHECK (mode IN ('dev_process', 'dev_reprocess')),
  status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'running', 'awaiting_mapping', 'done', 'failed')),
  -- 적재(로직): 도서 소스 / LibriVox 챕터 정보
  source_chapters jsonb,
  librivox_chapters jsonb,
  -- 산출(Claude Code 매핑): 최종 챕터 정의 + 도서챕터↔LibriVox 매핑(없는 챕터 제외)
  chapter_definition jsonb,
  librivox_mapping jsonb,
  error text,
  note text,
  claimed_at timestamptz,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  -- 책당 1 활성 작업 (재투입 시 reset upsert)
  CONSTRAINT book_curation_jobs_book_uniq UNIQUE (book_id)
);

CREATE INDEX IF NOT EXISTS idx_bcj_status ON book_curation_jobs(status);
CREATE INDEX IF NOT EXISTS idx_bcj_updated ON book_curation_jobs(updated_at DESC);

-- updated_at 자동 갱신 (기존 공용 함수 재사용)
DROP TRIGGER IF EXISTS trg_bcj_updated ON book_curation_jobs;
CREATE TRIGGER trg_bcj_updated BEFORE UPDATE ON book_curation_jobs
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- RLS — admin/curator 전용 (기존 admin 테이블 정합)
ALTER TABLE book_curation_jobs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_curator_bcj ON book_curation_jobs;
CREATE POLICY admin_curator_bcj ON book_curation_jobs FOR ALL
  USING (is_admin_or_curator()) WITH CHECK (is_admin_or_curator());

-- ── enqueue RPC ──────────────────────────────────────────────
-- 선택 도서들을 status 로 mode 판정해 pending 으로 upsert. 검토대기 책은
-- library_chapters_master 현재 챕터를 source_chapters 로 즉시 스냅샷(DB 내, 저렴).
-- 자격 외 status(published/archived/failed 등)는 skip 카운트.
CREATE OR REPLACE FUNCTION enqueue_curation_jobs(p_book_ids uuid[])
RETURNS TABLE(queued int, skipped int)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_queued int := 0;
  v_skipped int := 0;
  v_uid uuid := auth.uid();
  r record;
  v_mode text;
  v_snapshot jsonb;
BEGIN
  IF NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;

  FOR r IN
    SELECT id, status FROM library_books WHERE id = ANY(p_book_ids)
  LOOP
    IF r.status IN ('queued', 'ingesting', 'normalizing', 'segmenting', 'analyzing', 'curating') THEN
      v_mode := 'dev_process';
    ELSIF r.status = 'ready' THEN
      v_mode := 'dev_reprocess';
    ELSE
      v_skipped := v_skipped + 1;
      CONTINUE;
    END IF;

    v_snapshot := NULL;
    IF v_mode = 'dev_reprocess' THEN
      SELECT jsonb_agg(
               jsonb_build_object(
                 'chapter_idx', m.chapter_idx,
                 'title', m.chapter_title,
                 'group', m.group_label,
                 'word_count', m.word_count
               ) ORDER BY m.chapter_idx)
        INTO v_snapshot
        FROM library_chapters_master m
       WHERE m.library_book_id = r.id;
    END IF;

    INSERT INTO book_curation_jobs (book_id, mode, status, source_chapters, created_by)
    VALUES (r.id, v_mode, 'pending', v_snapshot, v_uid)
    ON CONFLICT (book_id) DO UPDATE SET
      mode = EXCLUDED.mode,
      status = 'pending',
      source_chapters = EXCLUDED.source_chapters,
      librivox_chapters = NULL,
      chapter_definition = NULL,
      librivox_mapping = NULL,
      error = NULL,
      note = NULL,
      claimed_at = NULL,
      created_by = EXCLUDED.created_by,
      updated_at = now();

    v_queued := v_queued + 1;
  END LOOP;

  RETURN QUERY SELECT v_queued, v_skipped;
END $$;

REVOKE ALL ON FUNCTION enqueue_curation_jobs(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION enqueue_curation_jobs(uuid[]) TO authenticated;

COMMIT;
