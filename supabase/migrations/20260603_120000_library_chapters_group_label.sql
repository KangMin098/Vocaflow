-- 20260603_120000_library_chapters_group_label.sql
-- library_chapters_master 에 group_label 컬럼 추가.
--
-- 목적: Reader 사이드바 collapsible 그룹용. 같은 Volume/Book/sub-book 에 속하는
--   연속 chapter 를 한 그룹으로 묶기 (예: Pride and Prejudice 의 Volume I/II/III,
--   Frankenstein 의 Letter/Walton's Narrative).
--
-- 기존 chapter row 는 NULL 로 남아 ChapterSidebar 가 평면 fallback (group_label IS
-- NULL 이면 collapsible 비활성, 단순 chapter_idx 순서로 렌더).
--
-- Segmenter 가 차후 본문에서 감지된 Volume/Book 라벨을 INSERT/UPDATE 하면 점차
-- 그룹화 적용. 즉시 일괄 backfill 은 안 함 (책마다 라벨 detection 휴리스틱 필요).

BEGIN;

-- 멱등: 이미 추가된 환경에서도 재실행 안전.
ALTER TABLE library_chapters_master
  ADD COLUMN IF NOT EXISTS group_label TEXT;

COMMENT ON COLUMN library_chapters_master.group_label IS
  '계층 그룹 라벨 (Volume/Book·sub-book) — NULL = 평면 chapter. Reader 사이드바 collapsible 그룹용.';

COMMIT;
