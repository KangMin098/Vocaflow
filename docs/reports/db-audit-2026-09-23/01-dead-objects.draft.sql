-- ===== [0] ①  DROP_SAFE (뷰 6개 · 데이터 손실 0 · 회수 용량 0 KB)
-- 전부 뷰다. drop table 이 아니라 drop view 다.
-- 실행 뒤: packages/types/src/database.ts 를 재생성하고 typecheck 를 돌려야 한다.
drop view if exists public.user_vocab_enriched;
drop view if exists public.word_mislevel_signal;
drop view if exists public.v_dict_pos_sense_gap;
drop view if exists public.v_book_extraction_reasons;
drop view if exists public.v_user_book_progress;
drop view if exists public.v_extraction_quality_audit;

-- ===== [1] ②  DROP_CANDIDATE — 사용자 승인 뒤에만. 참고 초안
-- (ㄱ) methodology 세트 10개 테이블 + 전용 함수 2개 — 736 kB
--      FK 순서대로. 먼저 자식, 마지막에 methodology_batches.
drop table if exists public.methodology_evidence;
drop table if exists public.methodology_relations;
drop table if exists public.methodology_claims;
drop table if exists public.methodology_methods;
drop table if exists public.methodology_sources;
drop table if exists public.methodology_channels;
drop table if exists public.methodology_taxonomy;
drop table if exists public.methodology_experts;
drop table if exists public.methodology_gaps;
drop table if exists public.methodology_batches;
drop function if exists public.methodology_import;
drop function if exists public.methodology_read;

-- (ㄴ) 옛 프로젝트 잔재 3개 — 512 kB
--      같은 커밋에서 apps/web/src/lib/auth/__tests__/rls-surface.integration.test.ts 의
--      ORPHAN_TABLES 배열도 비워야 테스트가 통과한다.
drop table if exists public.sw_comments;
drop table if exists public.sw_players;
drop table if exists public.st17_timetables;

-- (ㄷ) csat 원천 집계 뷰 2개 — 0 KB · 같은 파이프라인이 이번 주 수정 중이므로 맨 마지막에
drop view if exists public.csat_source_operations_summary;
drop view if exists public.csat_source_operations;

-- (ㄹ) 쓰기 전용 테이블 — 120 kB
--      이것만 지우면 cron jobid=12 가 실패한다. collect_quality_metrics() 를 먼저 고칠 것.
-- drop table if exists public.quality_drift_checks;

-- ===== [2] 지우면 안 되는 것 (오판 방지 메모)
-- library_book_vocabularies : mv_lemma_dominant_pos 의 소스 + 함수 25개 + 관리자 화면 페이지네이션
-- mv_lemma_dominant_pos     : idx_scan 726,565 로 실사용. 지우지 말고 refresh 를 배선한다
-- textbook_curriculum_vocab_mv / textbook_shelf_stats_meta : 코드에 이름이 없지만 RPC 경유로 읽힌다
-- archaic_dictionary / dialect_map / reading_fluency_log / vocab_collections : 타입 파일에만 이름이 있고
--   실제로는 lookup_word_meaning · derive_learner_stage · vcb_publish_commit 이 읽는다