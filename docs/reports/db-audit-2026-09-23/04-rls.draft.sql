-- ===== [0] 1-1. 최우선 — csat_items_public 뷰로 anon 이 평가원 기출 802문항을 쓰고 지울 수 있다
-- 04-rls / SEV-1 : csat_items_public 은 읽기 전용 표면이다
REVOKE INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES, TRIGGER
  ON public.csat_items_public FROM anon, authenticated;
-- SELECT 는 남긴다 — 학습자 화면(lib/csat/browse.ts · learner.ts · heatmap.ts)이 이것만 읽는다.

-- ===== [1] 1-1. 최우선 — csat_items_public 뷰로 anon 이 평가원 기출 802문항을 쓰고 지울 수 있다
-- 자동 갱신 가능 + security_invoker=false + anon 쓰기 권한, 셋이 동시에 성립하면 사고다.
-- 아래 질의가 0행이 아니면 회귀다(통합 테스트에서 이 질의를 쓴다).
SELECT c.relname
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN information_schema.views v ON v.table_schema = n.nspname AND v.table_name = c.relname
WHERE n.nspname = 'public'
  AND c.relkind = 'v'
  AND NOT coalesce((SELECT option_value::boolean FROM pg_options_to_table(c.reloptions)
                    WHERE option_name = 'security_invoker'), false)
  AND (v.is_updatable = 'YES' OR v.is_insertable_into = 'YES')
  AND (has_table_privilege('anon', c.oid, 'UPDATE')
       OR has_table_privilege('anon', c.oid, 'INSERT')
       OR has_table_privilege('anon', c.oid, 'DELETE'));

-- ===== [2] 1-3. 정책이 없어 화면이 조용히 빈 결과를 받는 테이블 — english_irregular_forms 1건
-- 04-rls / SEV-3 : en_inflection_bases(INVOKER)가 실제로 표를 읽게 한다
CREATE POLICY english_irregular_forms_read ON public.english_irregular_forms
  FOR SELECT TO anon, authenticated
  USING (true);

-- ===== [3] 3-0. 먼저 — 죽은 service_role 정책 11개는 고칠 게 아니라 지울 것
-- 04-rls / 3-0 : 아무 행도 주지 않으면서 행마다 auth.jwt() 를 부르는 정책 7개
--   (service_role.rolbypassrls = true 이므로 이 정책이 없어도 service_role 은 전부 본다)
DROP POLICY service_role_all_article_vocab ON public.library_article_vocabularies;  -- 34,061,777행
DROP POLICY service_role_all_vocab        ON public.library_book_vocabularies;      --  1,678,399행
DROP POLICY service_role_all_articles     ON public.library_articles;               --    109,047행
DROP POLICY service_role_all_chunks       ON public.content_chunks;                 --     11,217행
DROP POLICY service_role_all_chapters     ON public.library_chapters_master;        --     11,161행
DROP POLICY service_role_all_books        ON public.library_books;                  --        401행
DROP POLICY service_role_all_catalogs     ON public.library_source_catalogs;        --         12행

-- TO service_role USING (true) — 대상이 이미 RLS 를 우회한다
DROP POLICY "service write dictionary"      ON public.shared_dictionary;
DROP POLICY "service write categories"      ON public.dictionary_categories;
DROP POLICY "service write word categories" ON public.dictionary_word_categories;
DROP POLICY lexicon_frequencies_admin_write ON public.lexicon_frequencies;

-- ===== [4] 3-0. 먼저 — 죽은 service_role 정책 11개는 고칠 게 아니라 지울 것
-- (대안) 지우지 않고 감싸기만 할 경우 — 7건 모두 같은 모양이다
ALTER POLICY service_role_all_article_vocab ON public.library_article_vocabularies
  USING (((( SELECT auth.jwt() AS jwt) ->> 'role'::text) = 'service_role'::text));
-- service_role_all_vocab / _articles / _chunks / _chapters / _books / _catalogs 도 동일하게.

-- ===== [5] 3-1. 나머지 62건 — ALTER POLICY 로 감싼다 (DROP+CREATE 안 쓴다)
-- 재생성 질의 — 이 문서의 3-1 SQL 을 만든 그 질의(읽기 전용, 언제든 다시 돌려도 안전)
WITH p AS (
  SELECT c.relname AS tbl, pol.polname AS name,
         pg_get_expr(pol.polqual, pol.polrelid)      AS qual,
         pg_get_expr(pol.polwithcheck, pol.polrelid) AS wcheck
  FROM pg_policy pol
  JOIN pg_class c ON c.oid = pol.polrelid
  JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public'
), w AS (
  SELECT tbl, name,
    replace(replace(replace(replace(replace(replace(replace(replace(
      coalesce(qual,''), '( SELECT auth.uid() AS uid)','@@U@@'),
      '( SELECT auth.jwt() AS jwt)','@@J@@'), '( SELECT auth.role() AS role)','@@R@@'),
      'auth.uid()','( SELECT auth.uid() AS uid)'),
      'auth.jwt()','( SELECT auth.jwt() AS jwt)'),
      'auth.role()','( SELECT auth.role() AS role)'),
      '@@U@@','( SELECT auth.uid() AS uid)'),
      '@@J@@','( SELECT auth.jwt() AS jwt)') AS nq,
    replace(replace(replace(replace(replace(replace(replace(replace(
      coalesce(wcheck,''), '( SELECT auth.uid() AS uid)','@@U@@'),
      '( SELECT auth.jwt() AS jwt)','@@J@@'), '( SELECT auth.role() AS role)','@@R@@'),
      'auth.uid()','( SELECT auth.uid() AS uid)'),
      'auth.jwt()','( SELECT auth.jwt() AS jwt)'),
      'auth.role()','( SELECT auth.role() AS role)'),
      '@@U@@','( SELECT auth.uid() AS uid)'),
      '@@J@@','( SELECT auth.jwt() AS jwt)') AS nw
  FROM p
  WHERE (coalesce(qual,'') || ' ' || coalesce(wcheck,''))
        ~ '(?<!SELECT )(auth\.uid|auth\.jwt|auth\.role)\(\)'
)
SELECT format('ALTER POLICY %I ON public.%I%s%s;', name, tbl,
         CASE WHEN nq <> '' THEN E'\n  USING ('  || nq || ')' ELSE '' END,
         CASE WHEN nw <> '' THEN E'\n  WITH CHECK (' || nw || ')' ELSE '' END) AS stmt
FROM w ORDER BY tbl, name;

-- ===== [6] 3-1. 나머지 62건 — ALTER POLICY 로 감싼다 (DROP+CREATE 안 쓴다)
-- ══ 04-rls / 3-1 Tier A · 대형 표 (행 수는 실측 count(*)) ══
ALTER POLICY admin_curator_all_shared_words ON public.shared_words  -- 681,033행 · 별칭 user_profiles
  USING ((EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.user_id = ( SELECT auth.uid() AS uid)) AND (user_profiles.role = ANY (ARRAY['admin'::text, 'curator'::text]))))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.user_id = ( SELECT auth.uid() AS uid)) AND (user_profiles.role = ANY (ARRAY['admin'::text, 'curator'::text]))))));

ALTER POLICY topic_word_stats_admin_all ON public.topic_word_stats  -- 100,261행 · 별칭 up
  USING ((EXISTS ( SELECT 1 FROM user_profiles up WHERE ((up.user_id = ( SELECT auth.uid() AS uid)) AND (up.role = ANY (ARRAY['admin'::text, 'curator'::text]))))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM user_profiles up WHERE ((up.user_id = ( SELECT auth.uid() AS uid)) AND (up.role = ANY (ARRAY['admin'::text, 'curator'::text]))))));

-- topic_corpus_queue_admin_all(97,212행) · topic_corpus_docs_admin_all(7,713행)
-- · topic_corpus_sources_admin_all(28행) 은 위 topic_word_stats 와 글자까지 같은 식이다.
--   테이블 이름만 바꿔 같은 ALTER 를 세 번 더 쓴다.

ALTER POLICY "own pending_words select" ON public.pending_words  -- 26,322행
  USING ((( SELECT auth.uid() AS uid) = user_id));
ALTER POLICY "own pending_words insert" ON public.pending_words
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

ALTER POLICY admin_curator_all_shared_word_sets ON public.shared_word_sets  -- 11,312행 · 별칭 user_profiles
  USING ((EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.user_id = ( SELECT auth.uid() AS uid)) AND (user_profiles.role = ANY (ARRAY['admin'::text, 'curator'::text]))))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.user_id = ( SELECT auth.uid() AS uid)) AND (user_profiles.role = ANY (ARRAY['admin'::text, 'curator'::text]))))));

-- content_chunks(11,217행): 감싸기보다 역할 조건으로 옮기는 편이 낫다 → 4절 2-B.
--   그대로 감싸기만 하려면:
ALTER POLICY authenticated_read_chunks ON public.content_chunks
  USING ((( SELECT auth.role() AS role) = 'authenticated'::text));

ALTER POLICY funnel_events_select_own ON public.funnel_events  -- 10,982행 · 둘 다 맨몸이었다
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR ( SELECT is_admin_or_curator() )));

ALTER POLICY db_health_metrics_admin_read ON public.db_health_metrics  -- 2,526행 · role='admin' 단일
  USING ((EXISTS ( SELECT 1 FROM user_profiles up WHERE ((up.user_id = ( SELECT auth.uid() AS uid)) AND (up.role = 'admin'::text)))));
-- quality_metrics_admin_read(1,307행) · db_health_findings_admin_read(57행)
-- · db_health_checkpoints_admin_read(36행) · db_health_action_log_admin_read(5행)
-- · db_health_exceptions_admin_read(3행) 는 위와 글자까지 같은 식이다(테이블만 다름).

ALTER POLICY "own data" ON public.vocabularies  -- 2,269행 · 학습자 · 템플릿 OWN
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

ALTER POLICY admin_curator_all ON public.vocab_dict_hits  -- 2,212행 · 별칭 user_profiles
  USING ((EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.user_id = ( SELECT auth.uid() AS uid)) AND (user_profiles.role = ANY (ARRAY['admin'::text, 'curator'::text]))))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.user_id = ( SELECT auth.uid() AS uid)) AND (user_profiles.role = ANY (ARRAY['admin'::text, 'curator'::text]))))));
-- 정책명이 전부 admin_curator_all 이고 식이 같다. 같은 ALTER 를 아래 테이블에 반복한다:
--   vocab_enrichment_queue(2,212) · vocab_seed_candidates(2,212) · vocab_curation_decisions(2,000)
--   · vocab_runs(2) · vocab_sources(2) · vocab_collections(1) · vocab_raw_texts(0)

ALTER POLICY admin_video_jobs ON public.video_jobs  -- 73행 · role='admin' · 별칭 user_profiles
  USING ((EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.user_id = ( SELECT auth.uid() AS uid)) AND (user_profiles.role = 'admin'::text)))))
  WITH CHECK ((EXISTS ( SELECT 1 FROM user_profiles WHERE ((user_profiles.user_id = ( SELECT auth.uid() AS uid)) AND (user_profiles.role = 'admin'::text)))));

-- ===== [7] 3-1. 나머지 62건 — ALTER POLICY 로 감싼다 (DROP+CREATE 안 쓴다)
-- ══ 04-rls / 3-1 Tier B · 학습자 개인 데이터 (전부 템플릿 OWN) ══
-- 아래는 모두 같은 모양이다. 원문의 좌우 순서를 보존한다:
--   (A) ( SELECT auth.uid() AS uid) = user_id   ← 대부분
--   (B) user_id = ( SELECT auth.uid() AS uid)   ← comic_read_progress · word_familiarity 만

-- (A) USING + WITH CHECK 둘 다 있는 FOR ALL 정책
ALTER POLICY "own data" ON public.learning_records            -- 671행
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
--   같은 식으로: "own data" ON texts(278) · scores(79) · daily_activity(68)
--     · user_diagnostic_results(23) · quiz_questions(5) · user_profiles(4) · user_stats(2)
--   그리고 "own subs" ON user_word_set_subscriptions(277)
--     · cia_owner ON csat_item_attempts(20)
--     · dictation_sessions_own ON dictation_sessions(15)
--     · "own attempts" ON echo_match_attempts(9)
--     · "own sessions" ON echo_match_sessions(9)
--     · dictation_attempts_own ON dictation_attempts(6)
--     · rfl_owner ON reading_fluency_log(3)
--     · "own textbook selections" ON user_textbook_selections(3)
--     · weekly_reports_owner ON weekly_reports(1)

-- (A) USING 만 있는 것 (SELECT/DELETE 전용, 또는 원래 WITH CHECK 이 없던 FOR ALL)
ALTER POLICY users_own_sessions ON public.reading_sessions    -- 287행 · 원문에 WITH CHECK 없음
  USING ((( SELECT auth.uid() AS uid) = user_id));
ALTER POLICY csat_trap_attempts_own_select ON public.csat_trap_attempts  -- 83행
  USING ((( SELECT auth.uid() AS uid) = user_id));
ALTER POLICY snapshots_select_own ON public.user_level_snapshots         -- 22행
  USING ((( SELECT auth.uid() AS uid) = user_id));
ALTER POLICY study_plan_items_select_own ON public.study_plan_items      -- 6행
  USING ((( SELECT auth.uid() AS uid) = user_id));
ALTER POLICY study_plan_items_delete_own ON public.study_plan_items
  USING ((( SELECT auth.uid() AS uid) = user_id));

-- (A) WITH CHECK 만 있는 것 (INSERT 전용)
ALTER POLICY csat_trap_attempts_own_insert ON public.csat_trap_attempts
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));
ALTER POLICY study_plan_items_insert_own ON public.study_plan_items
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

-- (A) UPDATE (둘 다)
ALTER POLICY study_plan_items_update_own ON public.study_plan_items
  USING ((( SELECT auth.uid() AS uid) = user_id))
  WITH CHECK ((( SELECT auth.uid() AS uid) = user_id));

-- (B) 좌우가 반대였던 둘 — 원문 순서를 보존한다
ALTER POLICY own_comic_progress ON public.comic_read_progress  -- 2행
  USING ((user_id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));
ALTER POLICY wf_own ON public.word_familiarity                 -- 0행
  USING ((user_id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((user_id = ( SELECT auth.uid() AS uid)));

-- ===== [8] 3-1. 나머지 62건 — ALTER POLICY 로 감싼다 (DROP+CREATE 안 쓴다)
-- ══ 04-rls / 3-1 Tier D · 학급(교사 채널) 0~1행 ══
-- ⚠️ is_class_member/teacher 의 **첫 인자는 감싸지 않는다**(행마다 다른 컬럼이다).
--    두 번째 인자의 auth.uid() 만 감쌌다.
ALTER POLICY classes_teacher_all ON public.classes
  USING ((teacher_id = ( SELECT auth.uid() AS uid)))
  WITH CHECK ((teacher_id = ( SELECT auth.uid() AS uid)));
ALTER POLICY classes_member_read ON public.classes
  USING (is_class_member(id, ( SELECT auth.uid() AS uid)));
ALTER POLICY cm_self_read ON public.class_members
  USING ((user_id = ( SELECT auth.uid() AS uid)));
ALTER POLICY cm_teacher_read ON public.class_members
  USING (is_class_teacher(class_id, ( SELECT auth.uid() AS uid)));
ALTER POLICY cm_delete ON public.class_members
  USING (((user_id = ( SELECT auth.uid() AS uid)) OR is_class_teacher(class_id, ( SELECT auth.uid() AS uid))));
ALTER POLICY ca_member_read ON public.class_assignments
  USING (is_class_member(class_id, ( SELECT auth.uid() AS uid)));
ALTER POLICY ca_teacher_all ON public.class_assignments
  USING (is_class_teacher(class_id, ( SELECT auth.uid() AS uid)))
  WITH CHECK ((is_class_teacher(class_id, ( SELECT auth.uid() AS uid)) AND (created_by = ( SELECT auth.uid() AS uid))));
ALTER POLICY cap_own_all ON public.class_assignment_progress
  USING ((user_id = ( SELECT auth.uid() AS uid)))
  WITH CHECK (((user_id = ( SELECT auth.uid() AS uid)) AND (EXISTS ( SELECT 1 FROM class_assignments a WHERE ((a.id = class_assignment_progress.assignment_id) AND is_class_member(a.class_id, ( SELECT auth.uid() AS uid)))))));
ALTER POLICY cap_teacher_read ON public.class_assignment_progress
  USING ((EXISTS ( SELECT 1 FROM class_assignments a WHERE ((a.id = class_assignment_progress.assignment_id) AND is_class_teacher(a.class_id, ( SELECT auth.uid() AS uid))))));

-- ===== [9] 3-2. advisor 가 놓친 같은 결함 — 맨몸 is_admin*() 35건
-- ══ 04-rls / 3-2 : 맨몸 is_admin*() 을 InitPlan 으로 (행 수 큰 것부터) ══
ALTER POLICY admin_curator_read_vocab ON public.library_book_vocabularies  -- 1,678,399행
  USING (( SELECT is_admin_or_curator() ));
ALTER POLICY dcp_admin ON public.csat_dcp_items  -- 880,342행
  USING (( SELECT is_admin_or_curator() ))
  WITH CHECK (( SELECT is_admin_or_curator() ));
ALTER POLICY admin_curator_all_articles ON public.library_articles  -- 109,047행
  USING (( SELECT is_admin_or_curator() ))
  WITH CHECK (( SELECT is_admin_or_curator() ));
ALTER POLICY source_eligibility_admin_read ON public.csat_source_eligibility  -- 87,720행
  USING (( SELECT is_admin_or_curator() ));
ALTER POLICY admin_curator_read_chapters ON public.library_chapters_master  -- 11,161행
  USING (( SELECT is_admin_or_curator() ));
ALTER POLICY admin_curator_lcq ON public.library_chapter_quiz  -- 2,453행
  USING (( SELECT is_admin_or_curator() ))
  WITH CHECK (( SELECT is_admin_or_curator() ));
ALTER POLICY book_extraction_audit_admin_read ON public.book_extraction_audit  -- 1,896행
  USING (( SELECT is_admin_or_curator() ));
ALTER POLICY "admin write" ON public.library_seed_catalog  -- 1,870행
  USING (( SELECT is_admin_or_curator() ))
  WITH CHECK (( SELECT is_admin_or_curator() ));
ALTER POLICY compose_candidates_admin_all ON public.article_compose_candidates  -- 1,663행
  USING (( SELECT is_admin_or_curator() ))
  WITH CHECK (( SELECT is_admin_or_curator() ));
ALTER POLICY admin_curator_all_books ON public.library_books  -- 401행
  USING (( SELECT is_admin_or_curator() ))
  WITH CHECK (( SELECT is_admin_or_curator() ));
ALTER POLICY source_eligibility_history_admin_read ON public.csat_source_eligibility_history  -- 343행
  USING (( SELECT is_admin_or_curator() ));
ALTER POLICY tvr_select_admin ON public.textbook_volume_renders  -- 19행
  USING (( SELECT is_admin_or_curator() ));
ALTER POLICY profiles_admin_read ON public.user_profiles  -- 4행
  USING (( SELECT is_admin() ));
ALTER POLICY diagnostic_results_admin_read ON public.user_diagnostic_results  -- 23행
  USING (( SELECT is_admin() ));

-- 100행 미만 · USING + WITH CHECK 둘 다 ( SELECT is_admin_or_curator() ) 로 같은 모양:
--   compose_batches_admin_all(article_compose_batches, 87)
--   compose_gates_admin_all(article_compose_gates, 45)
--   fact_attestation_admin_all(article_fact_attestation, 44)
--   compose_feeds_admin_all(article_compose_feeds, 35)
--   article_seed_admin_all(library_article_seed_catalog, 135)
--   fact_ledger_admin_all(article_fact_ledger, 22)
--   comic: admin_curator_comic_pages(90) · admin_curator_cpe(90) · admin_curator_comic_styles(20)
--          · admin_curator_cgm_models(17) · admin_curator_cgr(10) · admin_curator_cgt(7)
--          · admin_curator_comic_books(1)
--   ej_admin_all(extraction_judgments, 16)
--   compose_jobs_admin_all(article_compose_jobs, 9)
--   compose_sources_admin_all(article_compose_sources, 8)
--   admin_curator_bcj(book_curation_jobs, 7)
--   admin_curator_update_catalogs(library_source_catalogs, 12)

-- ⚠️ 감싸지 말고 다른 조치를 할 것:
--   "admin read" ON library_seed_catalog        → 4절 1-a 에서 DROP (admin write 가 덮는다)
--   snapshots_admin_read ON user_level_snapshots → 4절 2-c 에서 병합
--   diagnostic_tests_admin_read_all ON vrl_diagnostic_tests → 4절 2-d 에서 병합

-- ===== [10] ① 완전히 같은 정책의 중복 / 포함 → 합친다
DROP POLICY "admin read" ON public.library_seed_catalog;  -- admin write(FOR ALL) 가 같은 qual 로 덮는다

-- ===== [11] ① 완전히 같은 정책의 중복 / 포함 → 합친다
DROP POLICY "anon read active categories" ON public.dictionary_categories;
ALTER POLICY "authenticated read categories" ON public.dictionary_categories
  TO anon, authenticated
  USING ((is_active = true));

-- ===== [12] ② OR 로 합칠 수 있다 (둘 다 단일 명령 · 같은 역할)
-- 전: admin_curator_read_vocab (SELECT, is_admin_or_curator())
--     read_vocab_via_published  (SELECT, EXISTS(published + copyright_safe))
--     service_role_all_vocab    (ALL, 죽음 → 3-0 에서 DROP)
DROP POLICY admin_curator_read_vocab ON public.library_book_vocabularies;
ALTER POLICY read_vocab_via_published ON public.library_book_vocabularies
  USING (
    ( SELECT is_admin_or_curator() )
    OR EXISTS ( SELECT 1 FROM library_books
                 WHERE library_books.id = library_book_vocabularies.library_book_id
                   AND library_books.status = 'published'::text
                   AND library_books.copyright_safe_in_kr = true )
  );

-- ===== [13] ② OR 로 합칠 수 있다 (둘 다 단일 명령 · 같은 역할)
DROP POLICY admin_curator_read_chapters ON public.library_chapters_master;
ALTER POLICY read_via_published ON public.library_chapters_master
  USING (
    ( SELECT is_admin_or_curator() )
    OR EXISTS ( SELECT 1 FROM library_books
                 WHERE library_books.id = library_chapters_master.library_book_id
                   AND library_books.status = 'published'::text
                   AND library_books.copyright_safe_in_kr = true )
  );

-- ===== [14] ② OR 로 합칠 수 있다 (둘 다 단일 명령 · 같은 역할)
DROP POLICY snapshots_admin_read ON public.user_level_snapshots;
ALTER POLICY snapshots_select_own ON public.user_level_snapshots
  USING ((( SELECT auth.uid() AS uid) = user_id) OR ( SELECT is_admin() ));

-- ===== [15] ② OR 로 합칠 수 있다 (둘 다 단일 명령 · 같은 역할)
DROP POLICY diagnostic_tests_admin_read_all ON public.vrl_diagnostic_tests;
ALTER POLICY "read active" ON public.vrl_diagnostic_tests
  USING ((is_active = true) OR ( SELECT is_admin() ));

-- ===== [16] ② OR 로 합칠 수 있다 (둘 다 단일 명령 · 같은 역할)
DROP POLICY cm_teacher_read ON public.class_members;
ALTER POLICY cm_self_read ON public.class_members
  USING ((user_id = ( SELECT auth.uid() AS uid))
         OR is_class_teacher(class_id, ( SELECT auth.uid() AS uid)));
-- 결과 qual 이 기존 cm_delete 와 같아진다(읽기와 삭제의 경계가 한 식으로 통일).

-- ===== [17] ② OR 로 합칠 수 있다 (둘 다 단일 명령 · 같은 역할)
ALTER POLICY authenticated_read_chunks ON public.content_chunks
  TO authenticated
  USING (true);

-- ===== [18] 5. mv_lemma_dominant_pos 판정 — anon 은 이미 회수됐다. authenticated 는 남겨야 한다
-- 04-rls / 5 : 권한은 아무 것도 바꾸지 않는다. 판정만 코멘트로 남긴다.
COMMENT ON MATERIALIZED VIEW public.mv_lemma_dominant_pos IS
  'select_book_chapter_vocab(SECURITY INVOKER)가 호출자 권한으로 읽는다. '
  'authenticated SELECT 를 회수하면 도서 발행 게이트가 permission denied 로 죽는다. '
  'anon SELECT 는 20260904084631 에서 이미 회수됐다 — advisor 문구를 anon 노출로 읽지 말 것.';

-- ===== [19] 6. csat_items_public SECURITY DEFINER 판정 — 뒤집지 말 것. 대신 쓰기 권한을 걷는다
SELECT id, exam_id, no, section, in_scope, type_id, stem, answer, points, high_score
FROM csat_items;

-- ===== [20] 7-2. 동적 — 실행 전후 스냅샷 대조 (권장 절차)
SELECT c.relname, p.polname, p.polcmd, p.polpermissive,
       coalesce((SELECT string_agg(r.rolname, ',' ORDER BY r.rolname)
                 FROM pg_roles r WHERE r.oid = ANY (p.polroles)), 'PUBLIC') AS roles,
       pg_get_expr(p.polqual, p.polrelid)      AS qual,
       pg_get_expr(p.polwithcheck, p.polrelid) AS wcheck
FROM pg_policy p
JOIN pg_class c ON c.oid = p.polrelid
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public'
ORDER BY c.relname, p.polname;

-- ===== [21] 7-2. 동적 — 실행 전후 스냅샷 대조 (권장 절차)
-- 한 트랜잭션 안에서만 역할을 바꾼다. ROLLBACK 으로 끝낸다(쓰기 없음).
BEGIN;
  SET LOCAL ROLE authenticated;
  -- 실제 검증 계정의 uid 를 넣는다(공유 DB 이므로 남의 계정을 쓰지 않는다)
  SET LOCAL request.jwt.claims = '{"sub":"<검증계정 uuid>","role":"authenticated"}';
  SELECT 'learning_records' AS t, count(*) FROM learning_records
  UNION ALL SELECT 'texts',                     count(*) FROM texts
  UNION ALL SELECT 'vocabularies',              count(*) FROM vocabularies
  UNION ALL SELECT 'reading_sessions',          count(*) FROM reading_sessions
  UNION ALL SELECT 'daily_activity',            count(*) FROM daily_activity
  UNION ALL SELECT 'scores',                    count(*) FROM scores
  UNION ALL SELECT 'funnel_events',             count(*) FROM funnel_events
  UNION ALL SELECT 'shared_word_sets',          count(*) FROM shared_word_sets
  UNION ALL SELECT 'shared_words',              count(*) FROM shared_words
  UNION ALL SELECT 'library_books',             count(*) FROM library_books
  UNION ALL SELECT 'library_articles',          count(*) FROM library_articles
  UNION ALL SELECT 'library_chapters_master',   count(*) FROM library_chapters_master
  UNION ALL SELECT 'library_book_vocabularies', count(*) FROM library_book_vocabularies
  UNION ALL SELECT 'library_seed_catalog',      count(*) FROM library_seed_catalog
  UNION ALL SELECT 'library_source_catalogs',   count(*) FROM library_source_catalogs
  UNION ALL SELECT 'dictionary_categories',     count(*) FROM dictionary_categories
  UNION ALL SELECT 'shared_dictionary',         count(*) FROM shared_dictionary
  UNION ALL SELECT 'content_chunks',            count(*) FROM content_chunks
  UNION ALL SELECT 'user_profiles',             count(*) FROM user_profiles
  UNION ALL SELECT 'user_level_snapshots',      count(*) FROM user_level_snapshots
  UNION ALL SELECT 'vrl_diagnostic_tests',      count(*) FROM vrl_diagnostic_tests
  UNION ALL SELECT 'csat_items',                count(*) FROM csat_items
  UNION ALL SELECT 'csat_items_public',         count(*) FROM csat_items_public
  UNION ALL SELECT 'csat_dcp_items',            count(*) FROM csat_dcp_items
  ORDER BY 1;
ROLLBACK;

-- ===== [22] 7-2. 동적 — 실행 전후 스냅샷 대조 (권장 절차)
BEGIN;
  SET LOCAL ROLE authenticated;
  SET LOCAL request.jwt.claims = '{"sub":"<uuid>","role":"authenticated"}';
  EXPLAIN (ANALYZE, BUFFERS) SELECT count(*) FROM shared_words;
ROLLBACK;