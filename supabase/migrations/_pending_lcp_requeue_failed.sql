-- supabase/migrations/<ts>_lcp_requeue_failed.sql
--
-- LCP: 실패한 도서를 **다시 큐에 넣을 방법이 없다** — 83권이 그래서 죽어 있다.
--
-- 실측(2026-08-26): library_books 401권 중 status='failed' 83권.
--   실패 사유가 하나뿐이다 — 82권 "fetch failed" + 1권 "store_content_chunk failed: TypeError: fetch failed".
--   전부 standard_ebooks(377권 중 83권 = 22%). 콘텐츠도 파싱도 아닌 **일시적 네트워크 오류**를
--   영구 실패로 기록한 것이다.
--
-- 왜 되살릴 수 없었나 — 세 겹이 겹쳤다:
--   1. api/lcp/process 가 catch 에서 status='failed' 로 박고
--   2. 큐 메시지는 pgmq_archive 로 치운다 (주석: "재시도 무한루프 방지 — admin 이 수동 검토")
--   3. 그런데 enqueue 트리거가 `AFTER INSERT` 전용이라
--      **status 를 queued 로 되돌려도 큐에 들어가지 않는다.**
--   설계는 "사람이 다시 민다" 였는데 밀 수 있는 손잡이가 없었다.
--
-- 고치는 것: 재큐 경로 하나. `trg_lb_enqueue_pipeline()` 은 이미 `NEW.status='queued'` 만 보므로
-- 함수는 그대로 두고 UPDATE 트리거를 하나 더 건다.
--
-- WHEN 절이 핵심이다 — `UPDATE OF status` 는 SET 목록에 status 가 있기만 하면 값이 같아도 발화한다.
-- 가드가 없으면 queued 인 행을 건드릴 때마다 중복 메시지가 쌓인다.
--
-- 발행 트리거와 충돌하지 않는 것을 확인했다: `trg_publish_book_word_sets()` 는
-- `NEW.status='published' AND OLD.status != 'published'` 일 때만 동작하므로
-- failed→queued 전이는 발행을 건드리지 않는다.

CREATE TRIGGER trg_lb_requeue
  AFTER UPDATE OF status ON public.library_books
  FOR EACH ROW
  WHEN (NEW.status = 'queued' AND OLD.status IS DISTINCT FROM 'queued')
  EXECUTE FUNCTION trg_lb_enqueue_pipeline();

-- ── 덤: 발행 트리거가 둘이다 ──────────────────────────────────────────
-- trg_lb_publish_word_sets 와 trg_publish_book_word_sets_t 는 정의가 **완전히 동일**하다
-- (둘 다 AFTER UPDATE OF status, 둘 다 trg_publish_book_word_sets()).
-- 그래서 발행 전이마다 publish_book_word_sets() 가 두 번 돈다. 하나는 잉여다.
-- 이름이 덜 서술적인 쪽(_t 접미사)을 뗀다.
DROP TRIGGER IF EXISTS trg_publish_book_word_sets_t ON public.library_books;
