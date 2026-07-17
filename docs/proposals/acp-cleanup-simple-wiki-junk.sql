-- docs/proposals/acp-cleanup-simple-wiki-junk.sql
-- ACP §18 보완 — Simple Wikipedia junk(Wikipedia: 네임스페이스 메타페이지) 2건 정리.
-- 미적용 — 승인 후 execute_sql. 근본원인(ingester gcmnamespace=0 누락)은 커밋 62be48a로 수정 완료.
--
-- 대상 2건 (실측):
--   084da1e6… "Wikipedia:Very good articles/by date" (69w) → 단어세트 d1e9c4ca(2 words) + vocab 16
--   3a3caf82… "Wikipedia:Good articles/by date"      (33w) → 단어세트 9a6e888b(1 word)  + vocab 9
-- FK: library_article_vocabularies=CASCADE(자동), seed_catalog=SET NULL, shared_words=수동(FK cascade 없음).
--
-- 삭제 총량: shared_words 3 + shared_word_sets 2 + seed 링크 2 + library_articles 2 (+ vocab 25 cascade).

BEGIN;

-- 1) 사용자 노출 단어 (junk 단어세트 소속) — shared_words FK cascade 없어 명시 삭제
DELETE FROM shared_words
WHERE set_id IN ('d1e9c4ca-2710-461c-898a-fad07bdbc76d',
                 '9a6e888b-0810-4579-98b2-369f9aacf773');

-- 2) junk 단어세트 (사용자 라이브러리 노출분)
DELETE FROM shared_word_sets
WHERE id IN ('d1e9c4ca-2710-461c-898a-fad07bdbc76d',
             '9a6e888b-0810-4579-98b2-369f9aacf773');

-- 3) junk seed 링크 삭제 (재import 방지 — imported 마킹된 junk seed 제거)
DELETE FROM library_article_seed_catalog
WHERE imported_article_id IN ('084da1e6-1a63-404e-bdf3-7ad5eec50ddf',
                              '3a3caf82-ceac-4f0c-90ce-99f3ffa0d3c6');

-- 4) junk 기사 (CASCADE → library_article_vocabularies 25행 자동 삭제)
DELETE FROM library_articles
WHERE id IN ('084da1e6-1a63-404e-bdf3-7ad5eec50ddf',
             '3a3caf82-ceac-4f0c-90ce-99f3ffa0d3c6');

COMMIT;
