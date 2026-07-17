-- 챕터 퀴즈 큐(book_quiz_jobs)를 book_curation_jobs 로 통합 (task_type 판별자)
-- Phase 0 — 드레인 큐 단일화 1단계. voice_map(기존 매핑) + quiz_gen(퀴즈) 한 테이블.

-- task_type 판별자 + 퀴즈 전용 컬럼
ALTER TABLE book_curation_jobs
  ADD COLUMN task_type text NOT NULL DEFAULT 'voice_map',
  ADD COLUMN book_v_level smallint,
  ADD COLUMN target_per_chapter int,
  ADD COLUMN chapters_total int,
  ADD COLUMN chapters_done int,
  ADD COLUMN questions_created int;

ALTER TABLE book_curation_jobs
  ADD CONSTRAINT book_curation_jobs_task_type_check
  CHECK (task_type IN ('voice_map','quiz_gen'));

-- mode 는 voice_map 전용 → NULL 허용
ALTER TABLE book_curation_jobs ALTER COLUMN mode DROP NOT NULL;
ALTER TABLE book_curation_jobs DROP CONSTRAINT book_curation_jobs_mode_check;
ALTER TABLE book_curation_jobs
  ADD CONSTRAINT book_curation_jobs_mode_check
  CHECK (mode IS NULL OR mode IN ('dev_process','dev_reprocess'));

-- UNIQUE(book_id) → UNIQUE(book_id, task_type) (책당 task별 1행)
ALTER TABLE book_curation_jobs DROP CONSTRAINT book_curation_jobs_book_uniq;
ALTER TABLE book_curation_jobs
  ADD CONSTRAINT book_curation_jobs_book_task_uniq UNIQUE (book_id, task_type);

-- 기존 퀴즈 잡 이전 (task_type='quiz_gen', mode=NULL)
INSERT INTO book_curation_jobs (
  book_id, task_type, status, mode, book_v_level, target_per_chapter,
  chapters_total, chapters_done, questions_created,
  error, note, claimed_at, created_by, created_at, updated_at)
SELECT book_id, 'quiz_gen', status, NULL, book_v_level, target_per_chapter,
  chapters_total, chapters_done, questions_created,
  error, note, claimed_at, created_by, created_at, updated_at
FROM book_quiz_jobs
ON CONFLICT (book_id, task_type) DO NOTHING;

-- enqueue_quiz_jobs 재정의 → 통합 테이블 (task_type='quiz_gen')
CREATE OR REPLACE FUNCTION public.enqueue_quiz_jobs(p_book_ids uuid[])
RETURNS TABLE(queued integer, skipped integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_queued int:=0; v_skipped int:=0; v_uid uuid:=auth.uid(); r record; v_chapters int;
BEGIN
  IF NOT is_admin_or_curator() THEN RAISE EXCEPTION 'Forbidden: admin or curator only'; END IF;
  FOR r IN SELECT id, status, book_v_level FROM library_books WHERE id = ANY(p_book_ids) LOOP
    SELECT count(*)::int INTO v_chapters FROM library_chapters_master m WHERE m.library_book_id=r.id;
    IF r.status NOT IN ('ready','published') OR v_chapters=0 THEN v_skipped:=v_skipped+1; CONTINUE; END IF;
    INSERT INTO book_curation_jobs (book_id, task_type, status, book_v_level, target_per_chapter,
        chapters_total, chapters_done, questions_created, created_by)
    VALUES (r.id, 'quiz_gen', 'pending', r.book_v_level, quiz_target_per_chapter(r.book_v_level),
        v_chapters, 0, 0, v_uid)
    ON CONFLICT (book_id, task_type) DO UPDATE SET
      status='pending', book_v_level=EXCLUDED.book_v_level, target_per_chapter=EXCLUDED.target_per_chapter,
      chapters_total=EXCLUDED.chapters_total, chapters_done=0, questions_created=0,
      error=NULL, note=NULL, claimed_at=NULL, created_by=EXCLUDED.created_by, updated_at=now();
    v_queued:=v_queued+1;
  END LOOP;
  RETURN QUERY SELECT v_queued, v_skipped;
END $fn$;

-- 구 테이블 제거 (트리거 trg_bqj_updated CASCADE)
DROP TABLE book_quiz_jobs;
