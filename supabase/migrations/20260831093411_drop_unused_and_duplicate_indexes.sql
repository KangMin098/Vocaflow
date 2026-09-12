-- supabase/migrations/20260831093411_drop_unused_and_duplicate_indexes.sql
--
-- 미사용·중복 인덱스 정리 (실측 8,463 MB → 7,665 MB · 798 MB 회수)
--
-- 근거를 세 갈래로 교차 확인했다. 하나만으로는 지우면 안 된다:
--   1) pg_stat_user_indexes.idx_scan — pg_stat_database.stats_reset 이 NULL 이라
--      "0회" 는 DB 생애 전체 누적 0회다(전체 6,034,537 스캔 중). 통계 리셋 탓이 아니다.
--   2) 소비자 본문 — ① 은 library_article_vocabularies 를 읽는 RPC 4개
--      (select_article_vocab · compute_article_vrl · select_article_coverage ·
--       select_extraction_residual) 를 전부 읽고 확인했다.
--   3) 생성 시점 — 전부 2026-05~07 생성. "새 인덱스라 아직 안 쓰인 것" 이 아니다.
--
-- ⚠️ 일부러 남긴 것 — FK 자식 쪽 인덱스 4개(약 56 MB).
--    idx_shared_words_vocab_ref · idx_lbv_lemma · idx_shared_words_lemma ·
--    idx_shared_words_source_run 은 스캔 0회지만 ON DELETE SET NULL 무결성 검사에 쓰인다.
--    지우면 부모 1행 삭제가 자식 전체 seq scan 이 된다
--    (shared_words 664,227행 · library_book_vocabularies 1,678,478행).
--    큐레이션 "→ 소스 GET" 이 library_books 를 DELETE 하는 구조라 실제로 밟는 경로다.
--    **스캔 0회는 그 삭제가 아직 안 일어났다는 뜻이지, 필요 없다는 뜻이 아니다.**
--
-- 되돌리기: 전부 CREATE INDEX 로 복구 가능하다. 다만 ① 은 11,011,463행이라 시간이 걸린다.

-- ① 754 MB. (library_article_id, base_learning_value DESC)
--    base_learning_value 로 정렬하는 소비자가 하나도 없다 — 전부 WHERE library_article_id = X 뿐이고,
--    그 패턴은 형제 UNIQUE(library_article_id, word) 가 3,252,863회 처리 중이다.
--    (스캔 4회는 플래너가 같은 WHERE 에 프리픽스로 잠깐 고른 것 — 제거 후 EXPLAIN 으로
--     UNIQUE 쪽 Index Only Scan · Heap Fetches 0 · 639행 7.2ms 재확인했다)
DROP INDEX IF EXISTS public.idx_lav_lv;

-- ② 17 MB. text_pattern_ops 는 LIKE 'x%' 전용인데 lexicon_clean 에 prefix 질의가 없다.
DROP INDEX IF EXISTS public.idx_lexicon_clean_word_pat;

-- ③ shared_words — 형제 인덱스가 49,201회 쓰이는 동안 0회. 셋 다 FK 없음.
DROP INDEX IF EXISTS public.idx_shared_words_word_pos;  -- 8.9 MB
DROP INDEX IF EXISTS public.idx_shared_words_word;      -- 8.0 MB (위 인덱스의 프리픽스라 중복이기도 하다)
DROP INDEX IF EXISTS public.idx_shared_words_lexicon;   -- 5.6 MB (word_lexicon 은퇴 · lexicon_id 에 FK 없음)

-- ④ 완전 중복 — UNIQUE 제약 인덱스와 컬럼·순서·조건이 같다. 제약 쪽을 남긴다(제약은 못 지운다).
DROP INDEX IF EXISTS public.idx_la_source;              -- 2.3 MB ≡ library_articles_source_source_id_key
DROP INDEX IF EXISTS public.pd_panels_issue_order_idx;  -- 1.0 MB ≡ pd_panels_unique
DROP INDEX IF EXISTS public.idx_lcm_book;               -- 0.8 MB ≡ library_chapters_master_library_book_id_chapter_idx_key
                                                        --   (1,587회 쓰이지만 동일 인덱스라 UNIQUE 쪽이 그대로 받는다)
