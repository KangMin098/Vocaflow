-- ===== [0] 5-0 최우선 한 줄 (S-1)
-- csat_items_public: security_invoker=false 이므로 이 뷰는 csat_items RLS(USING false)를 우회한다.
-- anon 이 정답(answer)을 전량 읽을 수 있었다. /csat* 는 PROTECTED_PREFIXES → 로그인 전 소비자 없음.
-- 주의: authenticated 는 절대 건드리지 않는다(이 뷰가 학습자의 유일한 경로 · db_health_exceptions 면제).
REVOKE SELECT ON TABLE public.csat_items_public FROM anon;

-- ===== [1] 5-1 테이블 묶음
-- T-2 · anon 쓰기 그랜트 전량 회수 (127 관계)
--   근거: public 쓰기 정책 전수 확인 결과 anon 이 만족할 수 있는 정책이 0건.
--        (auth.uid() 계열 · is_admin_or_curator() 계열 · TO service_role 계열뿐)
--        지금 성공하는 anon 쓰기가 없으므로 회수로 깨지는 화면이 없다.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.oid::regclass AS rel
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r','p','v','m')
      AND (has_table_privilege('anon', c.oid, 'INSERT')
        OR has_table_privilege('anon', c.oid, 'UPDATE')
        OR has_table_privilege('anon', c.oid, 'DELETE'))
  LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON TABLE %s FROM anon', r.rel);
  END LOOP;
END $$;

-- ===== [2] 5-1 테이블 묶음
-- T-4 · authenticated 쓰기 그랜트 중 "정책이 절대 허용하지 않는" 것만 회수 (58 관계)
--   근거: polcmd in (a,w,d,*) 이면서 authenticated 또는 PUBLIC 에 적용되는 정책이 0건.
--   주의: 정책이 1건 이상인 관계는 건드리지 않는다 — 학습자·admin 쓰기 경로다.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.oid::regclass AS rel
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r','p','v','m')
      AND (has_table_privilege('authenticated', c.oid, 'INSERT')
        OR has_table_privilege('authenticated', c.oid, 'UPDATE')
        OR has_table_privilege('authenticated', c.oid, 'DELETE'))
      AND NOT EXISTS (
        SELECT 1 FROM pg_policy p
        WHERE p.polrelid = c.oid AND p.polcmd IN ('a','w','d','*')
          AND (p.polroles = ARRAY[0]::oid[]          -- PUBLIC (역할 미지정) 정책
            OR EXISTS (SELECT 1 FROM pg_roles ro
                       WHERE ro.oid = ANY(p.polroles) AND ro.rolname = 'authenticated'))
      )
  LOOP
    EXECUTE format('REVOKE INSERT, UPDATE, DELETE ON TABLE %s FROM authenticated', r.rel);
  END LOOP;
END $$;

-- ===== [3] 5-1 테이블 묶음
-- T-3 · anon SELECT 그랜트 중 "정책이 절대 허용하지 않는" 것만 회수 (49 관계)
--   근거: anon 을 허용하는 SELECT 정책이 0건 → 지금도 0행.
--   주의: shared_dictionary · english_irregular_forms 는 제외한다.
--        lookup_word_meaning / en_inflection_bases 가 SECURITY INVOKER 로 이 두 테이블을 읽고,
--        공개 만화 리더(/comics/*)가 anon 으로 호출한다. 그랜트를 빼면 "0행" 이
--        "permission denied for table shared_dictionary" 로 바뀐다.
--        두 함수를 SECURITY DEFINER 로 전환한 뒤 별 건으로 회수한다.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.oid::regclass AS rel
    FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public'
      AND c.relkind IN ('r','p','v','m')
      AND has_table_privilege('anon', c.oid, 'SELECT')
      AND c.relname NOT IN ('shared_dictionary','english_irregular_forms')   -- 보류
      AND NOT EXISTS (
        SELECT 1 FROM pg_policy p
        WHERE p.polrelid = c.oid AND p.polcmd IN ('r','*')
          AND (p.polroles = ARRAY[0]::oid[]
            OR EXISTS (SELECT 1 FROM pg_roles ro
                       WHERE ro.oid = ANY(p.polroles) AND ro.rolname = 'anon'))
      )
  LOOP
    EXECUTE format('REVOKE SELECT ON TABLE %s FROM anon', r.rel);
  END LOOP;
END $$;

-- ===== [4] 5-1 테이블 묶음
-- T-5 · authenticated SELECT 죽은 그랜트 (english_irregular_forms 보류 → 7건)
REVOKE SELECT ON TABLE
  public.archaic_candidates,
  public.csat_analysis_reviews,
  public.csat_item_reviews,
  public.csat_source_registry,
  public.csat_source_snapshots,
  public.csat_source_targets,
  public.noise_blacklist
FROM authenticated;

-- ===== [5] 5-2 함수 묶음
-- F-1 + F-2 · 트리거 함수 29개 — anon·authenticated EXECUTE 회수
--   근거: PostgreSQL 은 트리거 발화 시 EXECUTE 를 검사하지 않는다(CREATE TRIGGER 시점만).
--        rpc 호출처 0건. 회수해도 트리거는 그대로 돈다.
--   무위험 묶음 — 여기서 시작한다.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS fn
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public'
      AND p.prorettype = 'trigger'::regtype
      AND (has_function_privilege('anon', p.oid, 'EXECUTE')
        OR has_function_privilege('authenticated', p.oid, 'EXECUTE'))
  LOOP
    EXECUTE format('REVOKE EXECUTE ON FUNCTION %s FROM anon, authenticated', r.fn);
  END LOOP;
END $$;

-- ===== [6] 5-2 함수 묶음
-- F-3 · 관리자·파이프라인 SECURITY DEFINER 33개 — anon EXECUTE 회수
--   근거: 호출처가 전부 /admin/* 서버 액션 · createAdminClient() · scripts/**(service_role).
--        12개는 저장소 전체에 rpc 호출처가 0건.
REVOKE EXECUTE ON FUNCTION
  public.acp_article_rollup(),
  public.analyze_diagnostic_result(uuid),
  public.analyze_track_diagnostic_result(uuid),
  public.archive_book_pipeline_messages(uuid),
  public.auto_promote_v_level_for_user(uuid),
  public.book_comic_available(uuid),
  public.book_quiz_coverage(uuid),
  public.cron_auto_promote_all_users(),
  public.csat_source_rollup(),
  public.csat_source_snapshot_take(text),
  public.dict_inflections_by_pos(),
  public.dict_polysemy_count(),
  public.enqueue_comic_jobs(uuid[]),
  public.enqueue_curation_jobs(uuid[]),
  public.enqueue_quiz_jobs(uuid[]),
  public.enqueue_review_jobs(uuid[], text),
  public.extract_book_vocabulary_admin(uuid, smallint),
  public.find_derivational_candidates(),
  public.find_unbound_book_lemmas(uuid, integer),
  public.find_unmatched_lemmas(text[]),
  public.funnel_summary(integer),
  public.get_lcp_config(),
  public.list_book_chapter_quiz_catalog(),
  public.maintain_reference_stats(),
  public.pgmq_archive(text, bigint),
  public.refresh_lemma_dominant_pos(),
  public.run_content_quality_gate_details(text, uuid),
  public.select_book_chapter_quiz(uuid, integer),
  public.sync_published_set_examples(uuid),
  public.topic_corpus_overview(),
  public.update_pending_word_status(uuid, text, text),
  public.video_eval_overview(),
  public.video_jobs_overview()
FROM anon;

-- ===== [7] 5-2 함수 묶음
-- F-4 · 위 중 service_role 로만 읽는 17개 — authenticated EXECUTE 도 회수
--   근거: 호출처가 createAdminClient() · scripts/** · pg_cron 뿐.
--   주의: /admin 화면이 브라우저 anon-key 클라이언트로 부르는 것(admin_* 계열 ·
--         run_content_quality_gate_details · get_judgment_sample 등)은 여기 없다 — authenticated 유지.
REVOKE EXECUTE ON FUNCTION
  public.analyze_diagnostic_result(uuid),
  public.analyze_track_diagnostic_result(uuid),
  public.archive_book_pipeline_messages(uuid),
  public.auto_promote_v_level_for_user(uuid),
  public.book_comic_available(uuid),
  public.book_quiz_coverage(uuid),
  public.cron_auto_promote_all_users(),
  public.csat_source_rollup(),
  public.find_derivational_candidates(),
  public.find_unmatched_lemmas(text[]),
  public.funnel_summary(integer),
  public.get_lcp_config(),
  public.maintain_reference_stats(),
  public.pgmq_archive(text, bigint),
  public.refresh_lemma_dominant_pos(),
  public.sync_published_set_examples(uuid),
  public.video_eval_overview()
FROM authenticated;

-- ===== [8] 5-2 함수 묶음
-- F-5 + F-6 · 학습자 전용 SECURITY DEFINER 21개 — anon EXECUTE 만 회수
--   근거: 호출처가 모두 PROTECTED_PREFIXES 화면(/hub · /wordvault · /library/vocab · /text ·
--        /diagnostic · /practice · /csat) 또는 /admin/*. authenticated 는 유지한다.
--   save_comic_progress 는 공개 리더에서 불리지만 호출부가 오류를 삼키고(ComicReader.tsx:133)
--   anon 은 auth.uid()=NULL 이라 지금도 저장되지 않는다 → 동작 동일.
REVOKE EXECUTE ON FUNCTION
  public.commit_chapter_vocab(uuid, integer),
  public.csat_coverage(),
  public.deliver_chapter_vocab(uuid, integer),
  public.enroll_library_book(uuid),
  public.extract_vocabulary_for_user(uuid, text[], text),
  public.extract_vocabulary_for_user_v2(uuid, text[], text, integer),
  public.get_chapter_content(uuid),
  public.grade_dcp_item(uuid, jsonb),
  public.join_class_by_code(text),
  public.prescribe_today(uuid, integer[]),
  public.recommend_word_sets_for_user(uuid, text[]),
  public.save_comic_progress(uuid, integer, integer, boolean),
  public.set_word_familiarity(text, text, smallint),
  public.subscribe_article_word_set(uuid),
  public.textbook_curriculum_vocab_counts(),
  public.textbook_practice_items(smallint, integer),
  public.textbook_shelf_inventory(),
  public.textbook_shelf_refreshed_at(),
  public.textbook_shelf_sources(),
  public.unenroll_library_book(uuid)
FROM anon;

-- ===== [9] 5-2 함수 묶음
-- F-7 · pgstattuple 확장 함수 9개 — 물리 통계를 비로그인자가 읽을 수 있었다
--   근거: 저장소에서 직접 부르는 코드 0건(db_health 계열은 전용 RPC 로 감싼다).
--   확장을 extensions 로 옮기는 것보다 이 회수가 먼저다(3장 참조).
REVOKE EXECUTE ON FUNCTION
  public.pgstattuple(text),
  public.pgstattuple(regclass),
  public.pgstattuple_approx(regclass),
  public.pgstatindex(text),
  public.pgstatindex(regclass),
  public.pgstatginindex(regclass),
  public.pgstathashindex(regclass),
  public.pg_relpages(text),
  public.pg_relpages(regclass)
FROM anon, authenticated;

-- ===== [10] 5-3 재발 방지 — TABLES 기본 권한
-- 세 마이그레이션은 FUNCTIONS 의 기본값만 고쳤다. TABLES/SEQUENCES 의 기본값은 그대로다
-- (그래서 새로 만드는 테이블마다 anon 전권이 다시 붙는다 → 위 회수가 주기적으로 되살아난다).
-- 주의: 영향 범위가 넓다 — 적용 전 롤백 트랜잭션 안에서 탐침 테이블로 검증할 것.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  REVOKE INSERT, UPDATE, DELETE ON TABLES FROM anon;
-- 되돌리기: ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT INSERT, UPDATE, DELETE ON TABLES TO anon;