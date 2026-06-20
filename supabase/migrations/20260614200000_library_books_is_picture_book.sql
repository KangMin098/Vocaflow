-- 20260614200000_library_books_is_picture_book.sql
-- ═══════════════════════════════════════════════════════════
-- 그림책(삽화 도서) 감지 플래그 — i+1 추천 삽화 보정용.
--
-- 그림책은 삽화가 의미를 전달(Dual Coding)하므로 텍스트 전용 i+1 임계(95/85)를
-- 그대로 적용하면 한국 학습자에게 과난도로 매핑됨(예: Ammachi V4 81.5% → "어려워요").
-- → judgeIPlusOne 이 is_picture_book 일 때 임계를 −7pp 완화(삽화 ~1 V-Level 보완).
--
-- 정의: 삽화 ≥4장 AND 짧은 텍스트(<5000 단어) — 삽화 많은 장편소설 오탐 회피.
-- GENERATED STORED — 모든 조회가 추가 비용 없이 select (illustrations jsonb 전송 불요).
-- ═══════════════════════════════════════════════════════════

ALTER TABLE library_books
  ADD COLUMN IF NOT EXISTS is_picture_book boolean
  GENERATED ALWAYS AS (
    coalesce(jsonb_array_length(illustrations), 0) >= 4
    AND coalesce(word_count, 0) < 5000
  ) STORED;

COMMENT ON COLUMN library_books.is_picture_book IS
  '그림책 여부(삽화≥4 + 단어<5000). i+1 임계 삽화 보정(judgeIPlusOne illustrated)용.';
