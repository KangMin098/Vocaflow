-- supabase/migrations/20260826103132_admin_requeue_book_single_enqueue.sql
--
-- ✅ 적용 2026-08-26. 직전 마이그레이션(20260826102742)이 만든 구멍을 같은 날 닫는다.
--
-- 무엇이 잘못됐나 — `_pending_lcp_requeue_failed.sql` 의 **전제가 틀렸다.**
--   그 파일은 "status 를 queued 로 되돌려도 큐에 안 들어간다 = 밀 손잡이가 없다" 고 적었는데,
--   `admin_requeue_book` 이 **이미 손잡이였다**. 그 함수는 status 를 바꾸고 직접 pgmq.send 까지
--   한다. 거기에 AFTER UPDATE 트리거가 붙자 같은 도서가 **두 번** 큐에 들어간다.
--   (실측: library_pipeline 으로 보내는 것은 두 함수뿐 — admin_requeue_book ·
--    trg_lb_enqueue_pipeline. `admin_bulk_requeue_books` 는 지금은 status 를 바꾸지 않고
--    행을 삭제하므로 무관하다. 마이그레이션 파일의 옛 정의와 실제 함수가 다르다.)
--
-- 어느 쪽을 없애나 — **트리거를 남긴다.** 규칙이 하나여야 한다: status 가 queued 로 바뀌면
--   큐에 들어간다. 그러면 앞으로 어떤 경로가 status 를 바꾸든 발행을 잊을 수 없다.
--   함수마다 send 를 손으로 붙이는 쪽이 원래 문제였다(트리거가 INSERT 전용이라는 것을
--   아무도 몰랐던 이유이기도 하다).
--
-- 다만 **이미 queued 인 행**은 트리거의 WHEN(OLD.status IS DISTINCT FROM 'queued')에 걸려
-- 발화하지 않는다. 관리자가 누른 "재큐" 가 조용히 아무 일도 안 하면 안 되므로 그때만 직접 넣는다.
-- `requeued: true` 플래그는 소비자가 없다(앱 전체 grep 0건).
--
-- 롤백: 20260508120600 의 정의로 CREATE OR REPLACE (단, 그러면 중복 enqueue 가 돌아온다 —
--       트리거 trg_lb_requeue 도 함께 DROP 해야 한다).

CREATE OR REPLACE FUNCTION public.admin_requeue_book(p_book_id uuid)
RETURNS text
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pgmq', 'extensions'
AS $function$
DECLARE
  v_old text;
BEGIN
  IF NOT is_admin_or_curator() THEN
    RAISE EXCEPTION 'Forbidden: admin or curator only';
  END IF;

  -- 잠그고 읽는다 — 동시에 두 번 누르면 둘 다 "전이 아님" 으로 보고 둘 다 직접 넣을 수 있다.
  SELECT status INTO v_old FROM library_books WHERE id = p_book_id FOR UPDATE;

  -- 없는 도서에 'requeued' 를 돌려주면 화면은 성공으로 표시하고 큐에는 처리할 수 없는
  -- 메시지가 남는다(이전 판이 그랬다).
  IF v_old IS NULL THEN
    RAISE EXCEPTION 'book not found: %', p_book_id;
  END IF;

  UPDATE library_books
  SET status = 'queued', status_message = NULL
  WHERE id = p_book_id;

  -- 전이가 일어났으면 trg_lb_requeue 가 이미 넣었다. 이미 queued 였을 때만 여기서 넣는다.
  IF v_old = 'queued' THEN
    PERFORM pgmq.send(
      'library_pipeline',
      jsonb_build_object('book_id', p_book_id, 'enqueued_at', now(), 'requeued', true)
    );
  END IF;

  RETURN 'requeued';
END $function$;

REVOKE ALL ON FUNCTION public.admin_requeue_book(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_requeue_book(uuid) TO authenticated;
