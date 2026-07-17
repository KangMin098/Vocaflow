-- 드레인 큐에 검토 task 추가 (Phase 1): level_verify + vocab_audit + result 컬럼
-- Claude Code 드레인이 생성/매핑을 넘어 품질 검토(레벨·어휘)까지 수행하도록 확장.

-- task_type 확장 (검토 2종)
ALTER TABLE book_curation_jobs DROP CONSTRAINT book_curation_jobs_task_type_check;
ALTER TABLE book_curation_jobs
  ADD CONSTRAINT book_curation_jobs_task_type_check
  CHECK (task_type IN ('voice_map','quiz_gen','level_verify','vocab_audit'));

-- 검토 결과(verdict/corrections) 저장 컬럼
ALTER TABLE book_curation_jobs ADD COLUMN result jsonb;

-- 검토 잡 적재 RPC (task_type 별 자격 판정)
--   level_verify: ready/published(분석 텍스트 존재). vocab_audit: published(단어장 존재)만.
CREATE OR REPLACE FUNCTION public.enqueue_review_jobs(p_book_ids uuid[], p_task_type text)
RETURNS TABLE(queued integer, skipped integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $fn$
DECLARE v_queued int:=0; v_skipped int:=0; v_uid uuid:=auth.uid(); r record;
BEGIN
  IF NOT is_admin_or_curator() THEN RAISE EXCEPTION 'Forbidden: admin or curator only'; END IF;
  IF p_task_type NOT IN ('level_verify','vocab_audit') THEN
    RAISE EXCEPTION 'invalid review task_type: %', p_task_type;
  END IF;
  FOR r IN SELECT id, status FROM library_books WHERE id = ANY(p_book_ids) LOOP
    IF r.status NOT IN ('ready','published')
       OR (p_task_type='vocab_audit' AND r.status <> 'published') THEN
      v_skipped:=v_skipped+1; CONTINUE;
    END IF;
    INSERT INTO book_curation_jobs (book_id, task_type, status, created_by)
    VALUES (r.id, p_task_type, 'pending', v_uid)
    ON CONFLICT (book_id, task_type) DO UPDATE SET
      status='pending', result=NULL, error=NULL, note=NULL, claimed_at=NULL,
      created_by=EXCLUDED.created_by, updated_at=now();
    v_queued:=v_queued+1;
  END LOOP;
  RETURN QUERY SELECT v_queued, v_skipped;
END $fn$;
