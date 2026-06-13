-- 20260607180000_archaic_candidates_first_seen_book_set_null.sql
--
-- archaic_candidates.first_seen_book_id FK 의 ON DELETE 동작을 SET NULL 로 변경.
--
-- 배경: admin_bulk_requeue_books (소스 GET 복귀) 가 library_books row 를 DELETE 할 때
--   이 FK 가 NO ACTION (default) 이라 자식 row 가 1개라도 있으면 DELETE 차단.
--
-- archaic_candidates 의미: "이 단어를 처음 발견한 도서". 도서가 사라져도 단어 자체는
--   다른 도서에서 재발견될 수 있으므로 SET NULL 이 맞음. CASCADE 는 단어 자산 손실.
--
-- 영향: 도서 삭제 시 그 도서를 first_seen 으로 기록한 archaic candidates 의
--   first_seen_book_id 가 NULL 이 됨. 다음 ingest 에서 같은 단어가 재발견되면
--   해당 collect_archaic_candidates() 가 다시 채움 (best-effort, 멱등).

ALTER TABLE public.archaic_candidates
  DROP CONSTRAINT IF EXISTS archaic_candidates_first_seen_book_id_fkey;

ALTER TABLE public.archaic_candidates
  ADD CONSTRAINT archaic_candidates_first_seen_book_id_fkey
  FOREIGN KEY (first_seen_book_id)
  REFERENCES public.library_books(id)
  ON DELETE SET NULL;
