-- enqueue_curation_jobs 의 ON CONFLICT 를 실제 유니크 제약에 맞춘다.
--
-- ── 무엇이 어긋나 있었나 (실측 2026-09-06) ─────────────────────────
-- 함수 본문은 `ON CONFLICT (book_id)` 인데, book_curation_jobs 의 유니크 인덱스는
--   book_curation_jobs_book_task_uniq = (book_id, task_type)
-- 하나뿐이다(그 외는 pkey(id)). 한 열만 적은 ON CONFLICT 는 어떤 유니크 제약과도
-- 맞지 않으므로 Postgres 가 42P10 으로 거절한다:
--   "there is no unique or exclusion constraint matching the ON CONFLICT specification"
--
-- ── 왜 (book_id, task_type) 이 정답인가 ────────────────────────────
-- book_id 단독 유니크로 바꾸는 선택지도 있었지만 **데이터가 그것을 반박한다.**
-- task_type 은 NOT NULL DEFAULT 'voice_map' 이고 현재 3종이 실재한다:
--   quiz_gen 4 · voice_map 2 · vocab_audit 1
-- 즉 한 도서에 종류가 다른 잡을 함께 두는 것이 설계다. book_id 단독 유니크를 걸면
-- 그 설계가 깨진다. 그러므로 제약이 아니라 **함수를 제약에 맞추는 것**이 옳다.
--
-- INSERT 가 task_type 을 명시하지 않아 기본값 'voice_map' 이 들어가고,
-- ON CONFLICT 추론은 제안된 행의 값(= 그 기본값)을 쓰므로 정상 동작한다.
--
-- ── 영향 범위 (처음 기록보다 좁다) ─────────────────────────────────
-- 이 함수는 첫 줄에서 is_admin_or_curator() 를 검사해 아니면 'Forbidden' 으로 끊는다.
-- 따라서 anon 은 42P10 에 닿지 못하고 권한 오류를 받는다 — 깨져 있던 것은
-- **관리자/큐레이터 경로**다. 또 INSERT 는 루프 안에 있으므로, 인자에 처리 대상
-- 상태(queued/ingesting/normalizing/segmenting/analyzing/curating/ready)인 도서가
-- 하나도 없으면 실행되지 않고 정상 반환한다. "호출하면 반드시 죽는다" 가 아니라
-- "처리할 도서가 하나라도 있으면 죽는다" 가 정확하다.
--
-- ── 재검증 (적용 후) ───────────────────────────────────────────────
-- 함수를 직접 호출하는 검증은 막힌다 — 첫 줄 is_admin_or_curator() 가 postgres 롤도
-- Forbidden 으로 끊는다. 그래서 EXPLAIN 으로 실행 없이 계획만 세워 대조했다:
--   새 형식 (book_id, task_type) -> Conflict Arbiter Indexes: book_curation_jobs_book_task_uniq
--   옛 형식 (book_id)            -> 지금도 42P10
-- 수정이 원인을 실제로 제거했다. 제약·테이블·행 변경 없음(7행 그대로).
CREATE OR REPLACE FUNCTION public.enqueue_curation_jobs(p_book_ids uuid[])
 RETURNS TABLE(queued integer, skipped integer)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
    ON CONFLICT (book_id, task_type) DO UPDATE SET
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
END $function$;
