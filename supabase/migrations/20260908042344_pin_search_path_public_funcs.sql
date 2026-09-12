-- supabase/migrations/20260908042344_pin_search_path_public_funcs.sql
--
-- public 함수 58개에 search_path 를 고정한다 (advisor: function_search_path_mutable).
--
-- 2026-09-08 실측으로 안전을 먼저 확인했다:
--   · 58개 중 SECURITY DEFINER = **0**. 전부 INVOKER 라 권한 상승 경로는 아니고 advisor 위생 항목이다.
--   · extensions · pgmq · net · vault · auth · cron 스키마를 참조하는 함수 = **0**.
--   · similarity · levenshtein · soundex · crypt · digest · unaccent · uuid_generate_v4 등
--     **미자격 확장 함수 호출 = 0**. 고정해도 풀리지 않는 이름이 없다.
--
-- 왜 `public, extensions, pg_temp` 인가:
--   pg_trgm · fuzzystrmatch · btree_gin · pgstattuple · pg_net 은 이 DB 에서 **public 에** 설치돼 있고
--   pgcrypto · uuid-ossp · pg_stat_statements 는 extensions 에 있다. 둘 다 넣어 두면 나중에
--   본문이 확장 함수를 부르게 돼도 조용히 깨지지 않는다.
--   pg_temp 를 **맨 뒤**에 두는 것이 요점이다 — 앞에 있으면 임시 객체가 실제 표를 가릴 수 있다.
--
-- 되돌리기: alter function public.<name>(<args>) reset search_path;

alter function public._extract_composite_score(p_frequency_rank integer, p_freq_in_unit integer, p_unit_max_freq integer, p_v_level smallint, p_verified boolean, p_example_en text, p_skill_level smallint, p_unit_v_level smallint) set search_path = public, extensions, pg_temp;
alter function public.acp_apply_license_gate() set search_path = public, extensions, pg_temp;
alter function public.acp_classify_license(p_license text) set search_path = public, extensions, pg_temp;
alter function public.analyze_book_vrl(p_book_id uuid) set search_path = public, extensions, pg_temp;
alter function public.article_seed_set_updated_at() set search_path = public, extensions, pg_temp;
alter function public.bulk_compute_cefrj_for_all_sources() set search_path = public, extensions, pg_temp;
alter function public.calc_domain_level(p_word text, p_domain text) set search_path = public, extensions, pg_temp;
alter function public.calc_skill_level(p_word text) set search_path = public, extensions, pg_temp;
alter function public.calc_track_level(p_word text, p_track text) set search_path = public, extensions, pg_temp;
alter function public.calc_v_level(p_word text) set search_path = public, extensions, pg_temp;
alter function public.calculate_next_review_due(p_source text, p_activity_score numeric, p_confidence numeric) set search_path = public, extensions, pg_temp;
alter function public.calculate_next_review_due(p_user_id uuid) set search_path = public, extensions, pg_temp;
alter function public.calculate_user_v_level_from_mastery(p_user_id uuid) set search_path = public, extensions, pg_temp;
alter function public.compute_article_syntax(p_article_id uuid) set search_path = public, extensions, pg_temp;
alter function public.compute_article_vrl(p_article_id uuid) set search_path = public, extensions, pg_temp;
alter function public.compute_book_cefrj(p_book_id uuid) set search_path = public, extensions, pg_temp;
alter function public.compute_book_chapter_v_levels(p_book_id uuid) set search_path = public, extensions, pg_temp;
alter function public.compute_book_difficulty(p_book_id uuid) set search_path = public, extensions, pg_temp;
alter function public.compute_book_syntax(p_book_id uuid) set search_path = public, extensions, pg_temp;
alter function public.compute_book_vrl(p_book_id uuid) set search_path = public, extensions, pg_temp;
alter function public.compute_syntax_score(p_content text) set search_path = public, extensions, pg_temp;
alter function public.decode_html_entities(p_text text) set search_path = public, extensions, pg_temp;
alter function public.decr_chunk_refs(p_hashes text[]) set search_path = public, extensions, pg_temp;
alter function public.derive_learner_stage(p_user_id uuid) set search_path = public, extensions, pg_temp;
alter function public.dict_categorical_distributions() set search_path = public, extensions, pg_temp;
alter function public.effective_confidence(p_meta jsonb) set search_path = public, extensions, pg_temp;
alter function public.en_derivational_bases(p text) set search_path = public, extensions, pg_temp;
alter function public.en_inflection_bases(p text) set search_path = public, extensions, pg_temp;
alter function public.en_negation_preserved(p_surface text, p_headword text) set search_path = public, extensions, pg_temp;
alter function public.en_spelling_variants(p text) set search_path = public, extensions, pg_temp;
alter function public.enforce_archaic_not_in_shared() set search_path = public, extensions, pg_temp;
alter function public.enforce_base_word_depth1() set search_path = public, extensions, pg_temp;
alter function public.enforce_domain_levels_keys() set search_path = public, extensions, pg_temp;
alter function public.enforce_track_levels_keys() set search_path = public, extensions, pg_temp;
alter function public.game_rank_alias(p_user_id uuid) set search_path = public, extensions, pg_temp;
alter function public.game_rank_window(p_period text) set search_path = public, extensions, pg_temp;
alter function public.get_category_path(cat_id text) set search_path = public, extensions, pg_temp;
alter function public.incr_chunk_refs(p_hashes text[]) set search_path = public, extensions, pg_temp;
alter function public.infer_form_pos(p_surface text, p_base text) set search_path = public, extensions, pg_temp;
alter function public.is_valid_assignment_words(p_words jsonb) set search_path = public, extensions, pg_temp;
alter function public.lb_compute_kr_safe() set search_path = public, extensions, pg_temp;
alter function public.lb_compute_search_vector() set search_path = public, extensions, pg_temp;
alter function public.library_seed_dedup_key(p_title text, p_author text) set search_path = public, extensions, pg_temp;
alter function public.lookup_lexicon_clean(p_surface text) set search_path = public, extensions, pg_temp;
alter function public.lsc_compute_composite() set search_path = public, extensions, pg_temp;
alter function public.publish_article_word_set(p_article_id uuid, p_cap integer) set search_path = public, extensions, pg_temp;
alter function public.publish_book_word_sets(p_book_id uuid, p_cap integer) set search_path = public, extensions, pg_temp;
alter function public.quiz_target_per_chapter(p_v_level smallint) set search_path = public, extensions, pg_temp;
alter function public.surface_variants(s text) set search_path = public, extensions, pg_temp;
alter function public.sync_cefr_from_v_level() set search_path = public, extensions, pg_temp;
alter function public.tg_study_plan_items_touch() set search_path = public, extensions, pg_temp;
alter function public.trg_lcm_chunk_refs() set search_path = public, extensions, pg_temp;
alter function public.trg_publish_article_word_set() set search_path = public, extensions, pg_temp;
alter function public.trg_publish_book_word_sets() set search_path = public, extensions, pg_temp;
alter function public.trg_require_article_audio() set search_path = public, extensions, pg_temp;
alter function public.trg_require_compose_gates() set search_path = public, extensions, pg_temp;
alter function public.trg_shared_words_sync_pronunciation() set search_path = public, extensions, pg_temp;
alter function public.validate_axis_level_entry(p_axis_type text, p_axis_id text, p_level smallint) set search_path = public, extensions, pg_temp;
