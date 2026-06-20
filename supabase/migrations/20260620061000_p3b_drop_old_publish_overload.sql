-- 20260620061000_p3b_drop_old_publish_overload.sql
-- ═══════════════════════════════════════════════════════════
-- P3b — 옛 1-arg publish overload DROP (P3 cap=40 활성화)
--
-- 배경:
--   P3 (20260620060000) 에서 publish_*_word_set 시그니처를
--   (uuid) → (uuid, integer DEFAULT 40) 로 확장.
--   PostgreSQL CREATE OR REPLACE 는 인자 카운트가 다르면 신규 함수로 등록 →
--   옛 1-arg 함수가 그대로 남아 overload 발생.
--
--   호출자 검색 (pg_get_functiondef ILIKE):
--     · trg_publish_book_word_sets()     : PERFORM publish_book_word_sets(NEW.id)   ← 1-arg
--     · trg_publish_article_word_set()   : PERFORM publish_article_word_set(NEW.id) ← 1-arg
--   다른 호출자 없음.
--
--   PostgreSQL exact-match 우선 정책 →
--     1-arg PERFORM 시 옛 1-arg 함수 선택 (cap 미적용) → P3 무력화.
--
-- 해결: 옛 1-arg DROP. PERFORM 시 새 2-arg DEFAULT 매칭 → cap=40 자동 적용.
--   plpgsql 의 함수 호출은 lazy resolution 이라 trigger 본문 변경 불요.
--
-- 검증 (적용 후):
--   pg_proc 에 publish_*_word_set 단일 시그니처 (uuid, integer DEFAULT 40) 만 잔존.
-- ═══════════════════════════════════════════════════════════

DROP FUNCTION IF EXISTS public.publish_book_word_sets(uuid);
DROP FUNCTION IF EXISTS public.publish_article_word_set(uuid);
