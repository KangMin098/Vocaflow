# T-0002 migration reconciliation table (generated)

DB rows: 741 · main files: 535 (distinct versions 504)

MATCH 167 · DB_ONLY_SHIFTED 314 · MAIN_ONLY_SHIFTED 299 · NAME_DIFF 1 · DB_ONLY 259 · MAIN_ONLY 37 · versions with >1 main file 22

| version | DB name | main file name(s) | status | source branch (DB_ONLY) |
|---|---|---|---|---|
| 20251101000001 | init_module_id_enum | init_module_id_enum | MATCH |  |
| 20251101000002 | init_core_tables | init_core_tables | MATCH |  |
| 20251101000003 | dictation_tables | dictation_tables | MATCH |  |
| 20251101000004 | shared_library_tables | shared_library_tables | MATCH |  |
| 20251101000005 | user_stats_table | user_stats_table | MATCH |  |
| 20251101000006 | triggers_and_rls | triggers_and_rls | MATCH |  |
| 20251101000007 | indexes | indexes | MATCH |  |
| 20260504101620 | add_user_profile_role_and_cefr | add_user_profile_role_and_cefr | MATCH |  |
| 20260504104405 | auth_user_profile_trigger | auth_user_profile_trigger | MATCH |  |
| 20260504110406 | update_handle_new_user_oauth_fallback | update_handle_new_user_oauth_fallback | MATCH |  |
| 20260504111203 | handle_new_user_decode_display_name | handle_new_user_decode_display_name | MATCH |  |
| 20260504144011 | add_shared_dictionary | add_shared_dictionary | MATCH |  |
| 20260504154153 | add_dictionary_categories | add_dictionary_categories | MATCH |  |
| 20260504160708 | prepare_dictionary_for_seed_import | prepare_dictionary_for_seed_import | MATCH |  |
| 20260508120000 |  | lcp_v2 | MAIN_ONLY_SHIFTED |  |
| 20260508120100 |  | lcp_v2_helpers | MAIN_ONLY_SHIFTED |  |
| 20260508120200 |  | lcp_v2_analyze | MAIN_ONLY_SHIFTED |  |
| 20260508120300 |  | lcp_v2_worker | MAIN_ONLY_SHIFTED |  |
| 20260508120500 |  | lcp_v2_enroll | MAIN_ONLY_SHIFTED |  |
| 20260508120600 |  | lcp_v2_source_catalogs | MAIN_ONLY_SHIFTED |  |
| 20260508153722 | lcp_v2 |  | DB_ONLY_SHIFTED | same name on main as 20260508120000 |
| 20260508154442 | lcp_v2_helpers |  | DB_ONLY_SHIFTED | same name on main as 20260508120100 |
| 20260508213031 | lcp_v2_analyze |  | DB_ONLY_SHIFTED | same name on main as 20260508120200 |
| 20260508222732 | lcp_v2_worker |  | DB_ONLY_SHIFTED | same name on main as 20260508120300 |
| 20260508224220 | lcp_v2_enroll |  | DB_ONLY_SHIFTED | same name on main as 20260508120500 |
| 20260509001048 | lcp_v2_source_catalogs |  | DB_ONLY_SHIFTED | same name on main as 20260508120600 |
| 20260510154454 | library_books_source_unique |  | DB_ONLY | none (no file in any git ref) |
| 20260511133311 | phase14_1_ngsl_sfi_column |  | DB_ONLY | none (no file in any git ref) |
| 20260511141432 | phase14_5_list_tags_multilist |  | DB_ONLY | none (no file in any git ref) |
| 20260511151401 | phase14_6_user_segment_for_lv_personalization |  | DB_ONLY | none (no file in any git ref) |
| 20260513211749 | fix_set_updated_at_search_path | fix_set_updated_at_search_path | MATCH |  |
| 20260513211824 | vcb_init | vcb_init | MATCH |  |
| 20260513211839 | vcb_seed_origin | vcb_seed_origin | MATCH |  |
| 20260513211905 | vcb_shared_words_extension | vcb_shared_words_extension | MATCH |  |
| 20260514000000 |  | vcb_sources_raw_bucket | MAIN_ONLY_SHIFTED |  |
| 20260514141105 | vcb_sources_raw_bucket |  | DB_ONLY_SHIFTED | same name on main as 20260514000000 |
| 20260516210000 |  | shared_dictionary_extension | MAIN_ONLY_SHIFTED |  |
| 20260516212321 | shared_dictionary_extension |  | DB_ONLY_SHIFTED | same name on main as 20260516210000 |
| 20260517150027 | freq_corpus_columns |  | DB_ONLY_SHIFTED | same name on main as 20260517235907 |
| 20260517235907 |  | freq_corpus_columns | MAIN_ONLY_SHIFTED |  |
| 20260518120000 |  | wikibooks_activation | MAIN_ONLY |  |
| 20260518130000 |  | shared_word_sets_category_bridge | MAIN_ONLY_SHIFTED |  |
| 20260519155302 | lexicon_v2_1_init |  | DB_ONLY_SHIFTED | same name on main as 20260520000000 |
| 20260519155333 | kice_csat_seed_update |  | DB_ONLY_SHIFTED | same name on main as 20260520000100 |
| 20260519155350 | shared_word_sets_curation_cols |  | DB_ONLY_SHIFTED | same name on main as 20260520000200 |
| 20260519155411 | kice_csat_load_history |  | DB_ONLY_SHIFTED | same name on main as 20260520000300 |
| 20260519160302 | curation_regenerate_fn |  | DB_ONLY_SHIFTED | same name on main as 20260520000400 |
| 20260519160408 | kice_curation_seeds_v2 |  | DB_ONLY | none (no file in any git ref) |
| 20260520 |  | 120000_lexicon_phase1_expand | MAIN_ONLY |  |
| 20260520000000 |  | lexicon_v2_1_init | MAIN_ONLY_SHIFTED |  |
| 20260520000100 |  | kice_csat_seed_update | MAIN_ONLY_SHIFTED |  |
| 20260520000200 |  | shared_word_sets_curation_cols | MAIN_ONLY_SHIFTED |  |
| 20260520000300 |  | kice_csat_load_history | MAIN_ONLY_SHIFTED |  |
| 20260520000400 |  | curation_regenerate_fn | MAIN_ONLY_SHIFTED |  |
| 20260520000500 |  | kice_curation_seeds | MAIN_ONLY |  |
| 20260521 |  | 140000_lexicon_phase2_backfill / 200000_pos_normalize_cleanup | MAIN_ONLY |  |
| 20260521143051 | pos_normalize_cleanup |  | DB_ONLY | none (no file in any git ref) |
| 20260521153559 | lexicon_phase2_backfill |  | DB_ONLY | none (no file in any git ref) |
| 20260521154526 | lexicon_phase2_step2b_remediate |  | DB_ONLY | none (no file in any git ref) |
| 20260522 |  | 010000_lexicon_phase2_step2b_remediate | MAIN_ONLY |  |
| 20260523101452 | vrl_v3_infrastructure |  | DB_ONLY | none (no file in any git ref) |
| 20260523102201 | vrl_v3_functions |  | DB_ONLY | none (no file in any git ref) |
| 20260523102552 | vrl_v3_calc_v_level_overtagging_patch |  | DB_ONLY | none (no file in any git ref) |
| 20260523103149 | vrl_v3_classify |  | DB_ONLY | none (no file in any git ref) |
| 20260523110817 | vrl_claude_classify_prep |  | DB_ONLY | none (no file in any git ref) |
| 20260524 |  | 100000_vrl_v3_infrastructure | MAIN_ONLY |  |
| 20260524012046 | vocaflow_levels_classification_meta |  | DB_ONLY | none (no file in any git ref) |
| 20260524012956 | user_profile_v2 |  | DB_ONLY | none (no file in any git ref) |
| 20260524013257 | user_level_snapshots_v2 |  | DB_ONLY | none (no file in any git ref) |
| 20260524013703 | user_level_progress_v2 |  | DB_ONLY | none (no file in any git ref) |
| 20260524014420 | user_level_functions_v2 |  | DB_ONLY | none (no file in any git ref) |
| 20260524015709 | user_level_snapshots_phase15 |  | DB_ONLY | none (no file in any git ref) |
| 20260524015948 | user_level_functions_phase15 |  | DB_ONLY | none (no file in any git ref) |
| 20260524115911 | dict_polysemy_count |  | DB_ONLY | none (no file in any git ref) |
| 20260524120930 | dict_inflections_by_pos |  | DB_ONLY | none (no file in any git ref) |
| 20260524121817 | dict_categorical_distributions |  | DB_ONLY | none (no file in any git ref) |
| 20260524124303 | dict_schema_evolution_tier1 |  | DB_ONLY | none (no file in any git ref) |
| 20260524143239 | drop_unused_tier_a_tables |  | DB_ONLY | none (no file in any git ref) |
| 20260524144132 | drop_unused_shared_dictionary_columns_v2 |  | DB_ONLY | none (no file in any git ref) |
| 20260524155228 | vrl_phase2a2_analyze_diagnostic_result |  | DB_ONLY | none (no file in any git ref) |
| 20260524155848 | vrl_phase2c1_auto_vlevel_word_sets_v2 |  | DB_ONLY | none (no file in any git ref) |
| 20260524160416 | vrl_phase2c1_auto_vlevel_v8_v9 |  | DB_ONLY | none (no file in any git ref) |
| 20260524160806 | vrl_phase2c2_specialty_word_sets |  | DB_ONLY | none (no file in any git ref) |
| 20260524161044 | vrl_phase2c2_replace_finance_with_business |  | DB_ONLY | none (no file in any git ref) |
| 20260524161629 | vrl_phase2d_recommend_word_sets |  | DB_ONLY | none (no file in any git ref) |
| 20260524161724 | vrl_phase2d_recommend_word_sets_fix |  | DB_ONLY | none (no file in any git ref) |
| 20260524162122 | vrl_phase2d2_recommend_with_specialty_optin |  | DB_ONLY | none (no file in any git ref) |
| 20260524162348 | vrl_phase2d2_drop_old_overload_explicit_go |  | DB_ONLY | none (no file in any git ref) |
| 20260524163739 | vrl_phase2e_auto_promote_v_level |  | DB_ONLY | none (no file in any git ref) |
| 20260524165435 | vrl_phase2b2_csat_korean_track_diagnostic |  | DB_ONLY | none (no file in any git ref) |
| 20260524165557 | vrl_phase2b2_csat_questions_strict_filter |  | DB_ONLY | none (no file in any git ref) |
| 20260524170139 | vrl_phase2b3_business_academic_track_diagnostics |  | DB_ONLY | none (no file in any git ref) |
| 20260524171322 | vrl_phase2d3_track_based_recommendations |  | DB_ONLY | none (no file in any git ref) |
| 20260524172155 | vrl_phase2f_track_snapshot_chain_v2 |  | DB_ONLY | none (no file in any git ref) |
| 20260524172420 | vrl_phase2f_track_snapshot_chain_v3 |  | DB_ONLY | none (no file in any git ref) |
| 20260524172525 | vrl_phase2f_track_snapshot_chain_v4 |  | DB_ONLY | none (no file in any git ref) |
| 20260524172634 | vrl_phase2f_track_snapshot_chain_v5 |  | DB_ONLY | none (no file in any git ref) |
| 20260524172738 | vrl_phase2f_track_snapshot_chain_v6 |  | DB_ONLY | none (no file in any git ref) |
| 20260524172846 | vrl_phase2f_track_snapshot_chain_v7 |  | DB_ONLY | none (no file in any git ref) |
| 20260524173324 | vrl_phase2g_pg_cron_auto_promotion |  | DB_ONLY | none (no file in any git ref) |
| 20260524173754 | vrl_phase2h_cron_wrapper_drop_replace |  | DB_ONLY | none (no file in any git ref) |
| 20260524173846 | vrl_phase2h_track_auto_promote_func |  | DB_ONLY | none (no file in any git ref) |
| 20260524174414 | vrl_phase2i_comprehensive_diagnostic |  | DB_ONLY | none (no file in any git ref) |
| 20260524174915 | vrl_phase2j_admin_dashboard_rpcs |  | DB_ONLY | none (no file in any git ref) |
| 20260524175904 | vrl_phase2k_cron_alert_track_dist |  | DB_ONLY | none (no file in any git ref) |
| 20260525 |  | 100000_vrl_v3_functions | MAIN_ONLY |  |
| 20260525015812 | vrl_phase3a_extract_vocabulary_for_user |  | DB_ONLY | none (no file in any git ref) |
| 20260525021235 | vrl_phase3a_v2_text_level_auto_n |  | DB_ONLY | none (no file in any git ref) |
| 20260525021336 | vrl_phase3a_v2_fix_ambiguous |  | DB_ONLY | none (no file in any git ref) |
| 20260525021505 | vrl_phase3a_v3_level_strategy_choice |  | DB_ONLY | none (no file in any git ref) |
| 20260525024953 | vrl_round11a_misclassification_fix_v8_v10_rank_5000 |  | DB_ONLY | none (no file in any git ref) |
| 20260525025305 | vrl_round11e_cefr_mismatch_fix |  | DB_ONLY | none (no file in any git ref) |
| 20260525040714 | inflections_gin_index |  | DB_ONLY | none (no file in any git ref) |
| 20260525041113 | extract_vocabulary_for_user_v2 |  | DB_ONLY | none (no file in any git ref) |
| 20260525041138 | find_unmatched_lemmas |  | DB_ONLY | none (no file in any git ref) |
| 20260525041405 | vrl_round11b_pure_semantic_part1_100row |  | DB_ONLY | none (no file in any git ref) |
| 20260525041700 | vrl_round11b_pure_semantic_part2_100row |  | DB_ONLY | none (no file in any git ref) |
| 20260525041709 | pending_words_table |  | DB_ONLY | none (no file in any git ref) |
| 20260525041944 | vrl_round11b_pure_semantic_part3_100row |  | DB_ONLY | none (no file in any git ref) |
| 20260525044205 | update_pending_word_status_rpc |  | DB_ONLY | none (no file in any git ref) |
| 20260525045546 | extract_vocabulary_v2_dedup_l1_priority |  | DB_ONLY | none (no file in any git ref) |
| 20260525051711 | extract_vocabulary_v2_sigmoid |  | DB_ONLY | none (no file in any git ref) |
| 20260525051928 | extract_vocabulary_v2_zpd_plateau |  | DB_ONLY | none (no file in any git ref) |
| 20260525052843 | extract_vocabulary_v2_pure_threshold_recreate |  | DB_ONLY | none (no file in any git ref) |
| 20260525053644 | extract_vocabulary_v2_no_archaic_cap |  | DB_ONLY | none (no file in any git ref) |
| 20260525054146 | extract_vocabulary_v2_user_limit_param |  | DB_ONLY | none (no file in any git ref) |
| 20260525054409 | vrl_round11b_fanout_c01_p1 |  | DB_ONLY | none (no file in any git ref) |
| 20260525055017 | vrl_round11b_fanout_c01_p2 |  | DB_ONLY | none (no file in any git ref) |
| 20260525083557 | phase_12a_meaning_audit_p1 |  | DB_ONLY | none (no file in any git ref) |
| 20260525083842 | phase_12a_meaning_audit_p2 |  | DB_ONLY | none (no file in any git ref) |
| 20260525084136 | phase_12a_spot_fix_unlike |  | DB_ONLY | none (no file in any git ref) |
| 20260525092529 | phase_12a_bis_meaning_audit_p1 |  | DB_ONLY | none (no file in any git ref) |
| 20260525092834 | phase_12a_bis_meaning_audit_p2 |  | DB_ONLY | none (no file in any git ref) |
| 20260525093122 | phase_12a_bis_meaning_audit_p3 |  | DB_ONLY | none (no file in any git ref) |
| 20260525101334 | phase3_cefrj_multi_source_v1 |  | DB_ONLY | none (no file in any git ref) |
| 20260525103532 | phase3_four_axis_difficulty_v1 |  | DB_ONLY | none (no file in any git ref) |
| 20260525114412 | phase3_compute_book_vrl_function |  | DB_ONLY | none (no file in any git ref) |
| 20260525133520 | shared_word_sets_category_library_book |  | DB_ONLY | none (no file in any git ref) |
| 20260525133533 | shared_words_library_book_vocabulary_ref |  | DB_ONLY | none (no file in any git ref) |
| 20260525133600 | publish_book_word_sets_function |  | DB_ONLY | none (no file in any git ref) |
| 20260525133615 | trigger_publish_book_word_sets |  | DB_ONLY | none (no file in any git ref) |
| 20260525133745 | user_word_set_subscriptions_source_tracking |  | DB_ONLY | none (no file in any git ref) |
| 20260525133801 | shared_word_sets_curation_query_gin |  | DB_ONLY | none (no file in any git ref) |
| 20260526 |  | 100000_vrl_v3_classify | MAIN_ONLY |  |
| 20260526160913 | echo_match_sessions |  | DB_ONLY | none (no file in any git ref) |
| 20260526160932 | echo_match_attempts |  | DB_ONLY | none (no file in any git ref) |
| 20260527 |  | 100000_vrl_claude_classify_prep / 120000_admin_revert_published_book | MAIN_ONLY |  |
| 20260527150152 | admin_revert_published_book |  | DB_ONLY | none (no file in any git ref) |
| 20260527154443 | extract_book_vocabulary_admin |  | DB_ONLY | none (no file in any git ref) |
| 20260527161619 | find_unbound_book_lemmas |  | DB_ONLY | none (no file in any git ref) |
| 20260528 |  | 120000_extract_book_vocabulary_admin / 130000_find_unbound_book_lemmas / 140000_book_extract_spelling_variants | MAIN_ONLY |  |
| 20260528143706 | book_extract_spelling_variants |  | DB_ONLY | none (no file in any git ref) |
| 20260528144320 | find_unbound_book_lemmas_perf |  | DB_ONLY | none (no file in any git ref) |
| 20260528215902 | archaic_dictionary_schema |  | DB_ONLY | none (no file in any git ref) |
| 20260528215924 | collect_archaic_candidates |  | DB_ONLY | none (no file in any git ref) |
| 20260528220302 | find_unbound_skip_archaic |  | DB_ONLY | none (no file in any git ref) |
| 20260528220954 | find_unbound_use_candidates |  | DB_ONLY | none (no file in any git ref) |
| 20260529 |  | 120000_admin_delete_book | MAIN_ONLY |  |
| 20260530003115 | library_seed_catalog |  | DB_ONLY | none (no file in any git ref) |
| 20260530004130 | admin_delete_book |  | DB_ONLY | none (no file in any git ref) |
| 20260530010117 | library_seed_dedup |  | DB_ONLY | none (no file in any git ref) |
| 20260530010158 | library_seed_catalog_view |  | DB_ONLY | none (no file in any git ref) |
| 20260530012315 | library_seed_catalog_enrich_cols |  | DB_ONLY | none (no file in any git ref) |
| 20260530012331 | library_seed_catalog_view_v2 |  | DB_ONLY | none (no file in any git ref) |
| 20260530130159 | shared_dictionary_derivational_columns |  | DB_ONLY | none (no file in any git ref) |
| 20260530130435 | phase1_spelling_normalization |  | DB_ONLY | none (no file in any git ref) |
| 20260530130701 | find_derivational_candidates_v2 |  | DB_ONLY | none (no file in any git ref) |
| 20260530131401 | add_derivational_seed_source |  | DB_ONLY | none (no file in any git ref) |
| 20260530131514 | add_derivational_classifier |  | DB_ONLY | none (no file in any git ref) |
| 20260530132417 | phase3_inflection_recovery |  | DB_ONLY | none (no file in any git ref) |
| 20260530132807 | phase4_archaic_dedup_trigger |  | DB_ONLY | none (no file in any git ref) |
| 20260530133224 | phase5_noise_classifier_fix |  | DB_ONLY | none (no file in any git ref) |
| 20260530133925 | extract_book_vocab_perf |  | DB_ONLY | none (no file in any git ref) |
| 20260530134149 | extract_book_vocab_gin_fix |  | DB_ONLY | none (no file in any git ref) |
| 20260530134437 | find_unbound_gin_fix |  | DB_ONLY | none (no file in any git ref) |
| 20260530134832 | en_derivational_bases_v2 |  | DB_ONLY | none (no file in any git ref) |
| 20260530135022 | en_derivational_bases_v3 |  | DB_ONLY | none (no file in any git ref) |
| 20260530142208 | english_irregular_forms_v2 |  | DB_ONLY | none (no file in any git ref) |
| 20260530142312 | en_inflection_bases_irregular_v2 |  | DB_ONLY | none (no file in any git ref) |
| 20260530145602 | phase25_rescue_first_noise |  | DB_ONLY | none (no file in any git ref) |
| 20260530164045 | en_derivational_bases_v3 |  | DB_ONLY | none (no file in any git ref) |
| 20260531 |  | 120000_unbound_cluster_base / 140000_classify_archaic_candidates / 160000_classify_archaic_candidates_unguard / 170000_classify_archaic_candidates_cron / 180000_find_unbound_morphology_columns / 190000_backfill_book_lemmas_fn | MAIN_ONLY |  |
| 20260531025501 | unbound_cluster_base |  | DB_ONLY | none (no file in any git ref) |
| 20260531031329 | classify_archaic_candidates |  | DB_ONLY | none (no file in any git ref) |
| 20260531050515 | vcb_filter_rpcs_count_sample_distribution |  | DB_ONLY | none (no file in any git ref) |
| 20260531050612 | vcb_filter_rpcs_fix_pos_ambiguity |  | DB_ONLY | none (no file in any git ref) |
| 20260531052619 | classify_archaic_candidates_unguard |  | DB_ONLY | none (no file in any git ref) |
| 20260531052737 | classify_archaic_candidates_cron |  | DB_ONLY | none (no file in any git ref) |
| 20260531064353 | backfill_book_lemmas_fn |  | DB_ONLY | none (no file in any git ref) |
| 20260531064539 | noise_blacklist_add_corrupt_token |  | DB_ONLY | none (no file in any git ref) |
| 20260531073035 | lookup_word_meaning_fn |  | DB_ONLY | none (no file in any git ref) |
| 20260531094352 | stage_book_dict_candidates_fn |  | DB_ONLY | none (no file in any git ref) |
| 20260531104840 | add_word_register |  | DB_ONLY | none (no file in any git ref) |
| 20260531105641 | lookup_word_meaning_add_register |  | DB_ONLY | none (no file in any git ref) |
| 20260531113319 | extract_book_vocab_register_aware |  | DB_ONLY | none (no file in any git ref) |
| 20260531155218 | library_book_curation_metadata |  | DB_ONLY | none (no file in any git ref) |
| 20260531155552 | seed_catalog_curation_metadata |  | DB_ONLY | none (no file in any git ref) |
| 20260531155651 | seed_catalog_view_curation_cols |  | DB_ONLY | none (no file in any git ref) |
| 20260603 |  | 120000_library_chapters_group_label / 130000_find_unbound_perf_prefilter / 140000_extract_book_vocab_cache_fastpath | MAIN_ONLY |  |
| 20260603032813 | derivation_rescue_path_universal |  | DB_ONLY | none (no file in any git ref) |
| 20260603034910 | admin_delete_book_allow_failed_statuses |  | DB_ONLY | none (no file in any git ref) |
| 20260603043731 | v_book_extraction_stats |  | DB_ONLY | none (no file in any git ref) |
| 20260603062141 | compute_book_vrl_type_based_p75 |  | DB_ONLY | none (no file in any git ref) |
| 20260603080414 | archive_book_pipeline_messages |  | DB_ONLY | none (no file in any git ref) |
| 20260603135805 | library_chapters_group_label_comment |  | DB_ONLY | none (no file in any git ref) |
| 20260603143502 | find_unbound_perf_prefilter |  | DB_ONLY | none (no file in any git ref) |
| 20260603145827 | extract_book_vocab_cache_fastpath |  | DB_ONLY | none (no file in any git ref) |
| 20260603154813 | drop_unused_and_duplicate_indexes_v06_34 |  | DB_ONLY | none (no file in any git ref) |
| 20260604142316 | add_simple_wikipedia_source |  | DB_ONLY | none (no file in any git ref) |
| 20260604221512 | copyright_gate_us_license |  | DB_ONLY_SHIFTED | same name on main as 20260605120000 |
| 20260605120000 |  | copyright_gate_us_license | MAIN_ONLY_SHIFTED |  |
| 20260605154321 | enroll_book_auto_subscribe_word_sets |  | DB_ONLY_SHIFTED | same name on main as 20260606120000 |
| 20260605234511 | reattach_publish_book_word_sets_trigger |  | DB_ONLY_SHIFTED | same name on main as 20260606123000 |
| 20260605235722 | add_library_books_librivox_audio |  | DB_ONLY | none (no file in any git ref) |
| 20260606003450 | drop_unused_indexes |  | DB_ONLY_SHIFTED | same name on main as 20260606140000 |
| 20260606020213 | unify_book_vocab_selection |  | DB_ONLY_SHIFTED | same name on main as 20260606140000 |
| 20260606120000 |  | enroll_book_auto_subscribe_word_sets | MAIN_ONLY_SHIFTED |  |
| 20260606123000 |  | reattach_publish_book_word_sets_trigger | MAIN_ONLY_SHIFTED |  |
| 20260606140000 |  | drop_unused_indexes / unify_book_vocab_selection | MAIN_ONLY_SHIFTED |  |
| 20260606140316 | unenroll_library_book |  | DB_ONLY_SHIFTED | same name on main as 20260607120000 |
| 20260606142006 | add_library_books_cover_image_url |  | DB_ONLY | none (no file in any git ref) |
| 20260606225815 | admin_bulk_book_status |  | DB_ONLY_SHIFTED | same name on main as 20260607130000 |
| 20260606231723 | admin_bulk_book_rollback_cascade |  | DB_ONLY_SHIFTED | same name on main as 20260607150000 |
| 20260607005258 | admin_bulk_return_to_source |  | DB_ONLY_SHIFTED | same name on main as 20260607170000 |
| 20260607010118 | archaic_candidates_first_seen_book_set_null |  | DB_ONLY_SHIFTED | same name on main as 20260607180000 |
| 20260607014233 | improve_library_seed_dedup_key_first_author_surname |  | DB_ONLY | none (no file in any git ref) |
| 20260607120000 |  | unenroll_library_book | MAIN_ONLY_SHIFTED |  |
| 20260607130000 |  | admin_bulk_book_status | MAIN_ONLY_SHIFTED |  |
| 20260607150000 |  | admin_bulk_book_rollback_cascade | MAIN_ONLY_SHIFTED |  |
| 20260607170000 |  | admin_bulk_return_to_source | MAIN_ONLY_SHIFTED |  |
| 20260607180000 |  | archaic_candidates_first_seen_book_set_null | MAIN_ONLY_SHIFTED |  |
| 20260608120000 |  | acp_license_register_gate / book_curation_jobs / texts_user_book_group_id | MAIN_ONLY_SHIFTED |  |
| 20260608121000 |  | v_text_content_user_book_group | MAIN_ONLY |  |
| 20260608123000 |  | acp_nd_display_only_gate | MAIN_ONLY_SHIFTED |  |
| 20260608126000 |  | acp_lexical_noise_gate | MAIN_ONLY_SHIFTED |  |
| 20260608221508 | book_curation_jobs |  | DB_ONLY_SHIFTED | same name on main as 20260608120000 |
| 20260608222229 | texts_user_book_group_id |  | DB_ONLY_SHIFTED | same name on main as 20260608120000 |
| 20260608222931 | v_text_content_user_book_group_v2 |  | DB_ONLY | none (no file in any git ref) |
| 20260613022941 | extract_admin_self_heal_lemmas |  | DB_ONLY | none (no file in any git ref) |
| 20260613031420 | library_chapters_source_href |  | DB_ONLY_SHIFTED | same name on main as 20260613120000 |
| 20260613064727 | word_set_source_sentence |  | DB_ONLY_SHIFTED | same name on main as 20260613130000 |
| 20260613112002 | shared_dictionary_inflected_forms |  | DB_ONLY_SHIFTED | same name on main as 20260613140000 |
| 20260613113510 | inflected_forms_irregulars |  | DB_ONLY_SHIFTED | same name on main as 20260613150000 |
| 20260613114332 | resolve_via_inflected_forms |  | DB_ONLY_SHIFTED | same name on main as 20260613160000 |
| 20260613120000 |  | library_chapters_source_href | MAIN_ONLY_SHIFTED |  |
| 20260613123155 | inflected_forms_irregular_complete |  | DB_ONLY_SHIFTED | same name on main as 20260613170000 |
| 20260613124924 | library_source_check_add_lit2go |  | DB_ONLY_SHIFTED | same name on main as 20260614120000 |
| 20260613130000 |  | word_set_source_sentence | MAIN_ONLY_SHIFTED |  |
| 20260613134050 | library_seed_catalog_source_add_lit2go |  | DB_ONLY_SHIFTED | same name on main as 20260614130000 |
| 20260613134317 | acp_article_audio_url |  | DB_ONLY_SHIFTED | same name on main as 20260614130000 |
| 20260613135949 | acp_article_seed_catalog |  | DB_ONLY_SHIFTED | same name on main as 20260614140000 |
| 20260613140000 |  | shared_dictionary_inflected_forms | MAIN_ONLY_SHIFTED |  |
| 20260613150000 |  | inflected_forms_irregulars | MAIN_ONLY_SHIFTED |  |
| 20260613160000 |  | resolve_via_inflected_forms | MAIN_ONLY_SHIFTED |  |
| 20260613170000 |  | inflected_forms_irregular_complete | MAIN_ONLY_SHIFTED |  |
| 20260614011809 | views_security_invoker |  | DB_ONLY_SHIFTED | same name on main as 20260614150000 |
| 20260614013708 | library_articles_admin_rls |  | DB_ONLY_SHIFTED | same name on main as 20260614160000 |
| 20260614030227 | acp_article_word_set_pipeline |  | DB_ONLY_SHIFTED | same name on main as 20260614180000 |
| 20260614040400 | article_v_level_ssot_unify |  | DB_ONLY_SHIFTED | same name on main as 20260614200000 |
| 20260614042635 | shared_word_sets_category_add_library_article |  | DB_ONLY_SHIFTED | same name on main as 20260614210000 |
| 20260614042705 | lcp_storyweaver_source |  | DB_ONLY_SHIFTED | same name on main as 20260614190000 |
| 20260614045253 | lcp_storyweaver_seed_catalog |  | DB_ONLY_SHIFTED | same name on main as 20260614200000 |
| 20260614051303 | acp_license_register_gate |  | DB_ONLY_SHIFTED | same name on main as 20260608120000 |
| 20260614053303 | acp_nd_display_only_gate |  | DB_ONLY_SHIFTED | same name on main as 20260608123000 |
| 20260614061144 | acp_lexical_noise_gate |  | DB_ONLY_SHIFTED | same name on main as 20260608126000 |
| 20260614084117 | acp_admin_revert_delete_article |  | DB_ONLY_SHIFTED | same name on main as 20260614220000 |
| 20260614085157 | fix_bulk_requeue_seed_unlock |  | DB_ONLY_SHIFTED | same name on main as 20260614220000 |
| 20260614090528 | acp_article_source_add_3sources |  | DB_ONLY_SHIFTED | same name on main as 20260614230000 |
| 20260614094734 | acp_remove_arxiv_source |  | DB_ONLY_SHIFTED | same name on main as 20260614240000 |
| 20260614110040 | library_books_is_picture_book |  | DB_ONLY_SHIFTED | same name on main as 20260614200000 |
| 20260614120000 |  | library_source_check_add_lit2go | MAIN_ONLY_SHIFTED |  |
| 20260614130000 |  | acp_article_audio_url / library_seed_catalog_source_add_lit2go | MAIN_ONLY_SHIFTED |  |
| 20260614140000 |  | acp_article_seed_catalog | MAIN_ONLY_SHIFTED |  |
| 20260614150000 |  | views_security_invoker | MAIN_ONLY_SHIFTED |  |
| 20260614160000 |  | library_articles_admin_rls | MAIN_ONLY_SHIFTED |  |
| 20260614180000 |  | acp_article_word_set_pipeline | MAIN_ONLY_SHIFTED |  |
| 20260614190000 |  | lcp_storyweaver_source | MAIN_ONLY_SHIFTED |  |
| 20260614200000 |  | article_v_level_ssot_unify / lcp_storyweaver_seed_catalog / library_books_is_picture_book | MAIN_ONLY_SHIFTED |  |
| 20260614210000 |  | shared_word_sets_category_add_library_article | MAIN_ONLY_SHIFTED |  |
| 20260614220000 |  | acp_admin_revert_delete_article / fix_bulk_requeue_seed_unlock | MAIN_ONLY_SHIFTED |  |
| 20260614230000 |  | acp_article_source_add_3sources / fix_overclassified_concrete_words | MAIN_ONLY_SHIFTED |  |
| 20260614240000 |  | acp_remove_arxiv_source | MAIN_ONLY_SHIFTED |  |
| 20260620030000 |  | extraction_fixed_learnable_floor | MAIN_ONLY_SHIFTED |  |
| 20260620040000 |  | p5a_freq_rank_backfill_from_ext | MAIN_ONLY_SHIFTED |  |
| 20260620050000 |  | p2_composite_redesign | MAIN_ONLY_SHIFTED |  |
| 20260620060000 |  | p3_publish_cap40 | MAIN_ONLY_SHIFTED |  |
| 20260620060529 | extraction_fixed_learnable_floor |  | DB_ONLY_SHIFTED | same name on main as 20260620030000 |
| 20260620061000 |  | p3b_drop_old_publish_overload | MAIN_ONLY_SHIFTED |  |
| 20260620062126 | p5a_freq_rank_backfill_from_ext |  | DB_ONLY_SHIFTED | same name on main as 20260620040000 |
| 20260620063238 | p2_composite_redesign |  | DB_ONLY_SHIFTED | same name on main as 20260620050000 |
| 20260620064003 | p3_publish_cap40 |  | DB_ONLY_SHIFTED | same name on main as 20260620060000 |
| 20260620064254 | p3b_drop_old_publish_overload |  | DB_ONLY_SHIFTED | same name on main as 20260620061000 |
| 20260620064855 | p4_unify_composite_core |  | DB_ONLY_SHIFTED | same name on main as 20260620070000 |
| 20260620070000 |  | p4_unify_composite_core | MAIN_ONLY_SHIFTED |  |
| 20260620080000 |  | republish_library_books_with_p1_p4 | MAIN_ONLY |  |
| 20260621033412 | voa_publish_require_audio_gate |  | DB_ONLY_SHIFTED | same name on main as 20260621120000 |
| 20260621120000 |  | voa_publish_require_audio_gate | MAIN_ONLY_SHIFTED |  |
| 20260628032242 | p6_enroll_subscribe_i_plus_one |  | DB_ONLY_SHIFTED | same name on main as 20260628120000 |
| 20260628032405 | p6_enroll_subscribe_i_plus_one_fix_userid |  | DB_ONLY | none (no file in any git ref) |
| 20260628040945 | p6_6_enroll_v0_undiagnosed_guard |  | DB_ONLY_SHIFTED | same name on main as 20260628130000 |
| 20260628060321 | scriptquiz_question_ko |  | DB_ONLY_SHIFTED | same name on main as 20260628140000 |
| 20260628071513 | p0_daily_activity_agg_known_word_count |  | DB_ONLY_SHIFTED | same name on main as 20260628150000 |
| 20260628072648 | p1_learning_goals |  | DB_ONLY_SHIFTED | same name on main as 20260628160000 |
| 20260628073556 | p2_weekly_reports |  | DB_ONLY_SHIFTED | same name on main as 20260628170000 |
| 20260628075540 | p4_l3_class_data_model |  | DB_ONLY_SHIFTED | same name on main as 20260628180000 |
| 20260628080546 | p4_2_join_class_by_code |  | DB_ONLY_SHIFTED | same name on main as 20260628190000 |
| 20260628111709 | acp_delete_article_seed_unlock | acp_delete_article_seed_unlock | MATCH |  |
| 20260628111753 | acp_bulk_requeue_articles | acp_bulk_requeue_articles | MATCH |  |
| 20260628113320 | p1_redesign_study_plan_items |  | DB_ONLY_SHIFTED | same name on main as 20260628200000 |
| 20260628120000 |  | p6_enroll_subscribe_i_plus_one | MAIN_ONLY_SHIFTED |  |
| 20260628130000 |  | p6_6_enroll_v0_undiagnosed_guard | MAIN_ONLY_SHIFTED |  |
| 20260628131951 | p1_plan_rich_compose |  | DB_ONLY_SHIFTED | same name on main as 20260628210000 |
| 20260628140000 |  | scriptquiz_question_ko | MAIN_ONLY_SHIFTED |  |
| 20260628144302 | p1_plan_weekday_per_item |  | DB_ONLY_SHIFTED | same name on main as 20260628220000 |
| 20260628150000 |  | p0_daily_activity_agg_known_word_count | MAIN_ONLY_SHIFTED |  |
| 20260628160000 |  | p1_learning_goals | MAIN_ONLY_SHIFTED |  |
| 20260628170000 |  | p2_weekly_reports | MAIN_ONLY_SHIFTED |  |
| 20260628180000 |  | p4_l3_class_data_model | MAIN_ONLY_SHIFTED |  |
| 20260628190000 |  | p4_2_join_class_by_code | MAIN_ONLY_SHIFTED |  |
| 20260628200000 |  | p1_redesign_study_plan_items | MAIN_ONLY_SHIFTED |  |
| 20260628210000 |  | p1_plan_rich_compose | MAIN_ONLY_SHIFTED |  |
| 20260628220000 |  | p1_plan_weekday_per_item | MAIN_ONLY_SHIFTED |  |
| 20260701161236 | scriptquiz_curated_chapter_quiz |  | DB_ONLY_SHIFTED | same name on main as 20260702120000 |
| 20260702120000 |  | scriptquiz_curated_chapter_quiz | MAIN_ONLY_SHIFTED |  |
| 20260703120000 |  | p0_security_rls_hardening | MAIN_ONLY_SHIFTED |  |
| 20260703120010 |  | p0_drop_p5a_backup_table | MAIN_ONLY_SHIFTED |  |
| 20260703130635 | p0_security_rls_hardening |  | DB_ONLY_SHIFTED | same name on main as 20260703120000 |
| 20260703130645 | p0_drop_p5a_backup_table |  | DB_ONLY_SHIFTED | same name on main as 20260703120010 |
| 20260704043934 | quality_metrics | quality_metrics | MATCH |  |
| 20260704044208 | lbv_lemma_insert_gate |  | DB_ONLY_SHIFTED | same name on main as 20260704090000 |
| 20260704090000 |  | lbv_lemma_insert_gate | MAIN_ONLY_SHIFTED |  |
| 20260704225928 | quiz_catalog_published_gate |  | DB_ONLY_SHIFTED | same name on main as 20260705100000 |
| 20260704230007 | recommend_book_iplus1_tier |  | DB_ONLY_SHIFTED | same name on main as 20260705101000 |
| 20260704230724 | classified_by_allow_new_models |  | DB_ONLY_SHIFTED | same name on main as 20260705110000 |
| 20260705010607 | acp_library_articles_feed_label |  | DB_ONLY_SHIFTED | same name on main as 20260705120000 |
| 20260705100000 |  | quiz_catalog_published_gate | MAIN_ONLY_SHIFTED |  |
| 20260705101000 |  | recommend_book_iplus1_tier | MAIN_ONLY_SHIFTED |  |
| 20260705110000 |  | classified_by_allow_new_models | MAIN_ONLY_SHIFTED |  |
| 20260705120000 |  | acp_library_articles_feed_label | MAIN_ONLY_SHIFTED |  |
| 20260706000000 | admin_collect_quality_metrics | admin_collect_quality_metrics | MATCH |  |
| 20260706010000 |  | vrl_admin_read_policies | MAIN_ONLY_SHIFTED |  |
| 20260706014210 | unify_quiz_into_curation_jobs |  | DB_ONLY_SHIFTED | same name on main as 20260706120000 |
| 20260706024646 | drain_review_tasks_level_vocab |  | DB_ONLY_SHIFTED | same name on main as 20260706130000 |
| 20260706024846 | p1_plan_multi_entry | p1_plan_multi_entry | MATCH |  |
| 20260706120000 |  | unify_quiz_into_curation_jobs | MAIN_ONLY_SHIFTED |  |
| 20260706130000 |  | drain_review_tasks_level_vocab | MAIN_ONLY_SHIFTED |  |
| 20260706134833 | vrl_admin_read_policies |  | DB_ONLY_SHIFTED | same name on main as 20260706010000 |
| 20260706143010 | vcb_publish_commit_transactional |  | DB_ONLY | none (no file in any git ref) |
| 20260707173715 | drop_vcb_filter_preview_rpcs |  | DB_ONLY | none (no file in any git ref) |
| 20260708120000 |  | acp_source_check_add_owid / advisor_revoke_anon_definer | MAIN_ONLY_SHIFTED |  |
| 20260708120500 |  | advisor_revoke_public_definer | MAIN_ONLY_SHIFTED |  |
| 20260708223730 | acp_source_check_add_owid |  | DB_ONLY_SHIFTED | same name on main as 20260708120000 |
| 20260709120000 |  | library_books_source_add_pressbooks | MAIN_ONLY_SHIFTED |  |
| 20260709130000 |  | acp_source_check_add_factbook | MAIN_ONLY_SHIFTED |  |
| 20260709131533 | library_books_source_add_pressbooks |  | DB_ONLY_SHIFTED | same name on main as 20260709120000 |
| 20260709132237 | advisor_revoke_anon_definer |  | DB_ONLY_SHIFTED | same name on main as 20260708120000 |
| 20260709132429 | advisor_revoke_public_definer |  | DB_ONLY_SHIFTED | same name on main as 20260708120500 |
| 20260709134809 | acp_source_check_add_factbook |  | DB_ONLY_SHIFTED | same name on main as 20260709130000 |
| 20260709135526 | shared_words_chapter_column | shared_words_chapter_column | MATCH |  |
| 20260709140000 |  | acp_source_check_add_elife | MAIN_ONLY_SHIFTED |  |
| 20260709143951 | acp_source_check_add_elife |  | DB_ONLY_SHIFTED | same name on main as 20260709140000 |
| 20260709145433 | lcm_chapter_v_level | lcm_chapter_v_level | MATCH |  |
| 20260709150807 | ctp_catalog_syntax |  | DB_ONLY_SHIFTED | same name on main as 20260710120000 |
| 20260709150823 | ctp_dcp_items |  | DB_ONLY_SHIFTED | same name on main as 20260710120100 |
| 20260709150853 | ctp_runtime_tables |  | DB_ONLY_SHIFTED | same name on main as 20260710120200 |
| 20260709194335 | shared_word_sets_subscriber_count | shared_word_sets_subscriber_count | MATCH |  |
| 20260709194508 | ctp_compute_syntax_score |  | DB_ONLY_SHIFTED | same name on main as 20260710130000 |
| 20260709194527 | compute_book_chapter_v_levels | compute_book_chapter_v_levels | MATCH |  |
| 20260709194848 | ctp_syntax_wire_rpcs |  | DB_ONLY_SHIFTED | same name on main as 20260710140000 |
| 20260709200409 | acp_seed_catalog_source_add_new |  | DB_ONLY_SHIFTED | same name on main as 20260710150000 |
| 20260709201707 | lcp_seed_catalog_source_add_pressbooks |  | DB_ONLY_SHIFTED | same name on main as 20260710160000 |
| 20260709202031 | ctp_dcp_items_table |  | DB_ONLY_SHIFTED | same name on main as 20260710170000 |
| 20260709215040 | acp_source_add_wikipedia |  | DB_ONLY_SHIFTED | same name on main as 20260710210000 |
| 20260709224200 | acp_source_add_plos |  | DB_ONLY_SHIFTED | same name on main as 20260710220000 |
| 20260710120000 |  | ctp_catalog_syntax | MAIN_ONLY_SHIFTED |  |
| 20260710120100 |  | ctp_dcp_items | MAIN_ONLY_SHIFTED |  |
| 20260710120200 |  | ctp_runtime_tables | MAIN_ONLY_SHIFTED |  |
| 20260710130000 |  | ctp_compute_syntax_score | MAIN_ONLY_SHIFTED |  |
| 20260710140000 |  | ctp_syntax_wire_rpcs | MAIN_ONLY_SHIFTED |  |
| 20260710150000 |  | acp_seed_catalog_source_add_new | MAIN_ONLY_SHIFTED |  |
| 20260710160000 |  | lcp_seed_catalog_source_add_pressbooks | MAIN_ONLY_SHIFTED |  |
| 20260710170000 |  | ctp_dcp_items_table | MAIN_ONLY_SHIFTED |  |
| 20260710180000 |  | ctp_derive_learner_stage | MAIN_ONLY |  |
| 20260710190000 |  | ctp_prescribe_today | MAIN_ONLY |  |
| 20260710200000 |  | ctp_grade_dcp_item | MAIN_ONLY |  |
| 20260710210000 |  | acp_source_add_wikipedia | MAIN_ONLY_SHIFTED |  |
| 20260710220000 |  | acp_source_add_plos | MAIN_ONLY_SHIFTED |  |
| 20260710230000 |  | acp_source_add_wikivoyage | MAIN_ONLY_SHIFTED |  |
| 20260711002712 | acp_source_add_wikivoyage |  | DB_ONLY_SHIFTED | same name on main as 20260710230000 |
| 20260711011754 | acp_source_add_usgs |  | DB_ONLY_SHIFTED | same name on main as 20260711120000 |
| 20260711011813 | add_arcade_game_module_ids |  | DB_ONLY_SHIFTED | same name on main as 20260711125000 |
| 20260711105007 | acp_source_add_noaa |  | DB_ONLY_SHIFTED | same name on main as 20260711130000 |
| 20260711120000 |  | acp_source_add_usgs | MAIN_ONLY_SHIFTED |  |
| 20260711125000 |  | add_arcade_game_module_ids | MAIN_ONLY_SHIFTED |  |
| 20260711130000 |  | acp_source_add_noaa | MAIN_ONLY_SHIFTED |  |
| 20260711152319 | ctp_dcp_grade_return_attempt |  | DB_ONLY_SHIFTED | same name on main as 20260712090000 |
| 20260711154915 | ctp_dcp_items_kind_allow_book |  | DB_ONLY_SHIFTED | same name on main as 20260712100000 |
| 20260712090000 |  | ctp_dcp_grade_return_attempt | MAIN_ONLY_SHIFTED |  |
| 20260712100000 |  | ctp_dcp_items_kind_allow_book | MAIN_ONLY_SHIFTED |  |
| 20260712114138 | add_arcade_newconcept_module_ids |  | DB_ONLY_SHIFTED | same name on main as 20260712180000 |
| 20260712115223 | lcp_book_word_set_label_v6_floor |  | DB_ONLY_SHIFTED | same name on main as 20260712180000 |
| 20260712120000 |  | ctp_syntax_score_recalibrate | MAIN_ONLY |  |
| 20260712121244 | vocab_context_pos |  | DB_ONLY_SHIFTED | same name on main as 20260712160000 |
| 20260712140000 |  | compute_book_difficulty_v24 | MAIN_ONLY |  |
| 20260712142750 | ctp_prescribe_today_dcp_band_cumulative |  | DB_ONLY_SHIFTED | same name on main as 20260712190000 |
| 20260712150000 |  | lcp_book_difficulty_functions_record | MAIN_ONLY |  |
| 20260712155138 | ctp_stage_catalog_band_recalibrate |  | DB_ONLY_SHIFTED | same name on main as 20260713090000 |
| 20260712160000 |  | vcb_publish_commit_record / vocab_context_pos | MAIN_ONLY_SHIFTED |  |
| 20260712161051 | add_lexicon_estate_module_id |  | DB_ONLY_SHIFTED | same name on main as 20260713100000 |
| 20260712162044 | sd_word_register_add_noise_categories |  | DB_ONLY | none (no file in any git ref) |
| 20260712165000 |  | vocab_context_sense_matching / vrl_phase2_tables_columns_record | MAIN_ONLY |  |
| 20260712170000 |  | insert_book_analysis_context_pos / vrl_phase2_runtime_functions_record | MAIN_ONLY |  |
| 20260712170553 | add_word_orrery_module_id |  | DB_ONLY_SHIFTED | same name on main as 20260713110000 |
| 20260712180000 |  | add_arcade_newconcept_module_ids / lcp_book_word_set_label_v6_floor | MAIN_ONLY_SHIFTED |  |
| 20260712190000 |  | ctp_prescribe_today_dcp_band_cumulative | MAIN_ONLY_SHIFTED |  |
| 20260713011331 | lookup_derivation_tier |  | DB_ONLY_SHIFTED | same name on main as 20260713150000 |
| 20260713012619 | resolve_dict_headword |  | DB_ONLY_SHIFTED | same name on main as 20260713160000 |
| 20260713012711 | book_extract_resolve_forms |  | DB_ONLY_SHIFTED | same name on main as 20260713160500 |
| 20260713013000 | resolve_dict_headword_v2_conservative |  | DB_ONLY | none (no file in any git ref) |
| 20260713014019 | book_extract_surface_form_display |  | DB_ONLY_SHIFTED | same name on main as 20260713161000 |
| 20260713014758 | book_extract_infer_form_pos |  | DB_ONLY_SHIFTED | same name on main as 20260713161500 |
| 20260713090000 |  | ctp_stage_catalog_band_recalibrate | MAIN_ONLY_SHIFTED |  |
| 20260713100000 |  | add_lexicon_estate_module_id / sd_word_register_noise_categories | MAIN_ONLY_SHIFTED |  |
| 20260713100500 |  | vocab_exclude_noise_registers | MAIN_ONLY |  |
| 20260713110000 |  | add_word_orrery_module_id | MAIN_ONLY_SHIFTED |  |
| 20260713150000 |  | lookup_derivation_tier | MAIN_ONLY_SHIFTED |  |
| 20260713160000 |  | resolve_dict_headword | MAIN_ONLY_SHIFTED |  |
| 20260713160500 |  | book_extract_resolve_forms | MAIN_ONLY_SHIFTED |  |
| 20260713161000 |  | book_extract_surface_form_display | MAIN_ONLY_SHIFTED |  |
| 20260713161500 |  | book_extract_infer_form_pos | MAIN_ONLY_SHIFTED |  |
| 20260713170000 |  | unify_article_extract | MAIN_ONLY_SHIFTED |  |
| 20260713171000 |  | unify_user_extract | MAIN_ONLY_SHIFTED |  |
| 20260713172000 |  | infer_form_pos_helper | MAIN_ONLY_SHIFTED |  |
| 20260713172500 |  | book_article_use_helper | MAIN_ONLY_SHIFTED |  |
| 20260713180000 |  | word_familiarity | MAIN_ONLY_SHIFTED |  |
| 20260713180500 |  | extract_exclude_known | MAIN_ONLY_SHIFTED |  |
| 20260715220545 | unify_article_extract |  | DB_ONLY_SHIFTED | same name on main as 20260713170000 |
| 20260715222833 | infer_form_pos_helper |  | DB_ONLY_SHIFTED | same name on main as 20260713172000 |
| 20260715223406 | book_article_use_helper |  | DB_ONLY_SHIFTED | same name on main as 20260713172500 |
| 20260715223622 | unify_user_extract |  | DB_ONLY_SHIFTED | same name on main as 20260713171000 |
| 20260715224958 | word_familiarity |  | DB_ONLY_SHIFTED | same name on main as 20260713180000 |
| 20260715225103 | extract_exclude_known |  | DB_ONLY_SHIFTED | same name on main as 20260713180500 |
| 20260716152354 | word_roots |  | DB_ONLY_SHIFTED | same name on main as 20260717140000 |
| 20260716233911 | wordset_category_etymology |  | DB_ONLY_SHIFTED | same name on main as 20260717150000 |
| 20260717030653 | recommend_word_sets_redesign_tiers |  | DB_ONLY_SHIFTED | same name on main as 20260717160000 |
| 20260717140000 |  | word_roots | MAIN_ONLY_SHIFTED |  |
| 20260717150000 |  | wordset_category_etymology | MAIN_ONLY_SHIFTED |  |
| 20260717160000 |  | recommend_word_sets_redesign_tiers | MAIN_ONLY_SHIFTED |  |
| 20260718000000 |  | shared_dictionary_source_inflection_seed | MAIN_ONLY_SHIFTED |  |
| 20260718015328 | add_kaikki_extra_columns |  | DB_ONLY | none (no file in any git ref) |
| 20260718020641 | fix_extraction_surface_headword_binding |  | DB_ONLY_SHIFTED | same name on main as 20260718100000 |
| 20260718020703 | create_extraction_judgments_table |  | DB_ONLY_SHIFTED | same name on main as 20260718100010 |
| 20260718022338 | judgment_harness_rpcs |  | DB_ONLY_SHIFTED | same name on main as 20260718100020 |
| 20260718024458 | backfill_kice_freq_rank_proxy |  | DB_ONLY_SHIFTED | same name on main as 20260718100030 |
| 20260718100000 |  | fix_extraction_surface_headword_binding | MAIN_ONLY_SHIFTED |  |
| 20260718100010 |  | create_extraction_judgments_table | MAIN_ONLY_SHIFTED |  |
| 20260718100020 |  | judgment_harness_rpcs | MAIN_ONLY_SHIFTED |  |
| 20260718100030 |  | backfill_kice_freq_rank_proxy | MAIN_ONLY_SHIFTED |  |
| 20260718100040 |  | content_quality_gate_fixes_F | MAIN_ONLY_SHIFTED |  |
| 20260718100050 |  | content_quality_gates_fn | MAIN_ONLY_SHIFTED |  |
| 20260718100060 |  | content_gate_nightly_cron | MAIN_ONLY_SHIFTED |  |
| 20260718100070 |  | republish_and_gate_wire | MAIN_ONLY_SHIFTED |  |
| 20260718100080 |  | g2_publish_gate_wire | MAIN_ONLY_SHIFTED |  |
| 20260718100090 |  | gate_acp_vcb_coverage | MAIN_ONLY_SHIFTED |  |
| 20260718100100 |  | vcb_noise_cleanup | MAIN_ONLY_SHIFTED |  |
| 20260718100110 |  | gate_perf_optimize | MAIN_ONLY_SHIFTED |  |
| 20260718100120 |  | gate_statement_timeout | MAIN_ONLY_SHIFTED |  |
| 20260718100130 |  | select_vocab_statement_timeout | MAIN_ONLY_SHIFTED |  |
| 20260718100140 |  | gate_details_drilldown | MAIN_ONLY_SHIFTED |  |
| 20260718103138 | content_quality_gate_fixes_F |  | DB_ONLY_SHIFTED | same name on main as 20260718100040 |
| 20260718103555 | content_quality_gates_fn |  | DB_ONLY_SHIFTED | same name on main as 20260718100050 |
| 20260718103821 | content_quality_gates_fn_bigint_fix |  | DB_ONLY | none (no file in any git ref) |
| 20260718104613 | content_gate_nightly_cron |  | DB_ONLY_SHIFTED | same name on main as 20260718100060 |
| 20260718104747 | quality_metrics_add_gate_stage |  | DB_ONLY | none (no file in any git ref) |
| 20260718110652 | republish_and_gate_wire |  | DB_ONLY_SHIFTED | same name on main as 20260718100070 |
| 20260718111701 | g2_publish_gate_wire |  | DB_ONLY_SHIFTED | same name on main as 20260718100080 |
| 20260718111834 | create_coverage_lexicon |  | DB_ONLY | none (no file in any git ref) |
| 20260718120133 | gate_acp_vcb_coverage |  | DB_ONLY_SHIFTED | same name on main as 20260718100090 |
| 20260718120313 | vcb_noise_cleanup |  | DB_ONLY_SHIFTED | same name on main as 20260718100100 |
| 20260718122040 | gate_perf_optimize |  | DB_ONLY_SHIFTED | same name on main as 20260718100110 |
| 20260718122255 | gate_statement_timeout |  | DB_ONLY_SHIFTED | same name on main as 20260718100120 |
| 20260718123432 | select_vocab_statement_timeout |  | DB_ONLY_SHIFTED | same name on main as 20260718100130 |
| 20260718195006 | gate_details_drilldown |  | DB_ONLY_SHIFTED | same name on main as 20260718100140 |
| 20260718202313 | shared_dictionary_source_inflection_seed |  | DB_ONLY_SHIFTED | same name on main as 20260718000000 |
| 20260719122849 | lookup_coverage_fallback |  | DB_ONLY | none (no file in any git ref) |
| 20260719143848 | coverage_reference_lists |  | DB_ONLY | none (no file in any git ref) |
| 20260719145412 | coverage_for_words |  | DB_ONLY | none (no file in any git ref) |
| 20260719154456 | extraction_residual_harvest |  | DB_ONLY | none (no file in any git ref) |
| 20260719161409 | 20260720_drop_unused_empty_tables |  | DB_ONLY | none (no file in any git ref) |
| 20260720024707 | coverage_for_words_dedupe |  | DB_ONLY | none (no file in any git ref) |
| 20260720025237 | coverage_lists_inflection |  | DB_ONLY | none (no file in any git ref) |
| 20260720032732 | coverage_lists_core_exclusion |  | DB_ONLY | none (no file in any git ref) |
| 20260720035420 | coverage_book_chapter_param |  | DB_ONLY | none (no file in any git ref) |
| 20260720041329 | coverage_for_words_core_exclusion |  | DB_ONLY | none (no file in any git ref) |
| 20260720120000 |  | shared_dictionary_field_provenance | MAIN_ONLY_SHIFTED |  |
| 20260720234050 | shared_dictionary_field_provenance |  | DB_ONLY_SHIFTED | same name on main as 20260720120000 |
| 20260722035732 | create_lexicon_clean |  | DB_ONLY_SHIFTED | same name on main as 20260722120000 |
| 20260722040934 | lookup_lexicon_clean_rpc |  | DB_ONLY_SHIFTED | same name on main as 20260722130000 |
| 20260722041906 | lookup_word_meaning_lexicon_clean_first |  | DB_ONLY_SHIFTED | same name on main as 20260722140000 |
| 20260722120000 |  | create_lexicon_clean | MAIN_ONLY_SHIFTED |  |
| 20260722130000 |  | lookup_lexicon_clean_rpc | MAIN_ONLY_SHIFTED |  |
| 20260722130549 | lookup_word_meaning_drop_kaikki_tiers |  | DB_ONLY_SHIFTED | same name on main as 20260722150000 |
| 20260722131155 | coverage_functions_repoint_lexicon_clean |  | DB_ONLY_SHIFTED | same name on main as 20260722160000 |
| 20260722131321 | drop_coverage_lexicon_kaikki |  | DB_ONLY | none (no file in any git ref) |
| 20260722140000 |  | lookup_word_meaning_lexicon_clean_first | MAIN_ONLY_SHIFTED |  |
| 20260722142534 | surface_variants_helper |  | DB_ONLY | none (no file in any git ref) |
| 20260722143123 | lookup_word_meaning_surface_variants_tier |  | DB_ONLY | none (no file in any git ref) |
| 20260722145410 | create_proper_noun_gazetteer |  | DB_ONLY | none (no file in any git ref) |
| 20260722150000 |  | lookup_word_meaning_drop_kaikki_tiers | MAIN_ONLY_SHIFTED |  |
| 20260722160000 |  | coverage_functions_repoint_lexicon_clean | MAIN_ONLY_SHIFTED |  |
| 20260722170000 |  | drop_coverage_lexicon | MAIN_ONLY |  |
| 20260722180000 |  | surface_variants_and_normalized_tier | MAIN_ONLY |  |
| 20260722190000 |  | surface_variants_derivational_suffixes | MAIN_ONLY |  |
| 20260722233329 | lexicon_clean_lang_column |  | DB_ONLY | none (no file in any git ref) |
| 20260723014751 | lookup_word_meaning_lang |  | DB_ONLY_SHIFTED | same name on main as 20260723120000 |
| 20260723041050 | surface_variants_in_to_ing |  | DB_ONLY_SHIFTED | same name on main as 20260723130000 |
| 20260723041223 | dialect_map_table |  | DB_ONLY_SHIFTED | same name on main as 20260723131000 |
| 20260723041327 | lookup_word_meaning_dialect_tier |  | DB_ONLY_SHIFTED | same name on main as 20260723132000 |
| 20260723120000 |  | lookup_word_meaning_lang | MAIN_ONLY_SHIFTED |  |
| 20260723130000 |  | surface_variants_in_to_ing | MAIN_ONLY_SHIFTED |  |
| 20260723131000 |  | dialect_map_table | MAIN_ONLY_SHIFTED |  |
| 20260723131813 | surface_variants_dialect_archaic_rules |  | DB_ONLY_SHIFTED | same name on main as 20260723140000 |
| 20260723132000 |  | lookup_word_meaning_dialect_tier | MAIN_ONLY_SHIFTED |  |
| 20260723134743 | spelling_norm_table |  | DB_ONLY_SHIFTED | same name on main as 20260723150000 |
| 20260723134937 | lookup_word_meaning_spelling_tier |  | DB_ONLY_SHIFTED | same name on main as 20260723151000 |
| 20260723140000 |  | surface_variants_dialect_archaic_rules | MAIN_ONLY_SHIFTED |  |
| 20260723140849 | surface_variants_ah_ingly |  | DB_ONLY_SHIFTED | same name on main as 20260723160000 |
| 20260723141000 | dialect_map_negative_contractions |  | DB_ONLY_SHIFTED | same name on main as 20260723161000 |
| 20260723150000 |  | spelling_norm_table | MAIN_ONLY_SHIFTED |  |
| 20260723151000 |  | lookup_word_meaning_spelling_tier | MAIN_ONLY_SHIFTED |  |
| 20260723160000 |  | surface_variants_ah_ingly | MAIN_ONLY_SHIFTED |  |
| 20260723161000 |  | dialect_map_negative_contractions | MAIN_ONLY_SHIFTED |  |
| 20260723162310 | shared_dictionary_dmetaphone_index |  | DB_ONLY_SHIFTED | same name on main as 20260724120000 |
| 20260723162412 | lookup_word_meaning_suggestion_tier |  | DB_ONLY_SHIFTED | same name on main as 20260724121000 |
| 20260724031913 | dialect_map_scots_na |  | DB_ONLY_SHIFTED | same name on main as 20260724130000 |
| 20260724032635 | surface_variants_hyphen_precision |  | DB_ONLY_SHIFTED | same name on main as 20260724140000 |
| 20260724033244 | lookup_word_meaning_dialect_inflection |  | DB_ONLY_SHIFTED | same name on main as 20260724150000 |
| 20260724063044 | surface_variants_h_drop |  | DB_ONLY_SHIFTED | same name on main as 20260724160000 |
| 20260724064853 | lookup_word_meaning_compound_tier |  | DB_ONLY | none (no file in any git ref) |
| 20260724065338 | lookup_word_meaning_compound_precision |  | DB_ONLY | none (no file in any git ref) |
| 20260724065659 | lookup_word_meaning_rollback_compound |  | DB_ONLY | none (no file in any git ref) |
| 20260724090553 | spelling_norm_curated_highfreq |  | DB_ONLY_SHIFTED | same name on main as 20260724170000 |
| 20260724120000 |  | shared_dictionary_dmetaphone_index | MAIN_ONLY_SHIFTED |  |
| 20260724121000 |  | lookup_word_meaning_suggestion_tier | MAIN_ONLY_SHIFTED |  |
| 20260724130000 |  | dialect_map_scots_na | MAIN_ONLY_SHIFTED |  |
| 20260724140000 |  | surface_variants_hyphen_precision | MAIN_ONLY_SHIFTED |  |
| 20260724150000 |  | lookup_word_meaning_dialect_inflection | MAIN_ONLY_SHIFTED |  |
| 20260724160000 |  | surface_variants_h_drop | MAIN_ONLY_SHIFTED |  |
| 20260724170000 |  | spelling_norm_curated_highfreq | MAIN_ONLY_SHIFTED |  |
| 20260804022022 | module_id_add_wordsmith_vigil_morphmerge |  | DB_ONLY | none (no file in any git ref) |
| 20260804022545 | module_id_add_wordfall_cadence |  | DB_ONLY | none (no file in any git ref) |
| 20260808120000 |  | comic_pipeline | MAIN_ONLY |  |
| 20260808140000 |  | comic_pipeline_fixes | MAIN_ONLY |  |
| 20260808154027 | comic_catalog_p1 |  | DB_ONLY_SHIFTED | same name on main as 20260808240000 |
| 20260808160000 |  | comic_read_progress | MAIN_ONLY |  |
| 20260808161400 | pdcp_public_domain_comics | pdcp_public_domain_comics | MATCH |  |
| 20260808162601 | pdcp_queue_states_and_monitoring | pdcp_queue_states_and_monitoring | MATCH |  |
| 20260808180000 |  | comic_gen_observability | MAIN_ONLY |  |
| 20260808200000 |  | comic_gen_models | MAIN_ONLY |  |
| 20260808220000 |  | comic_gen_models_run_envs | MAIN_ONLY |  |
| 20260808240000 |  | comic_catalog_p1 / comic_styles | MAIN_ONLY_SHIFTED |  |
| 20260809015208 | comic_reader_format |  | DB_ONLY_SHIFTED | same name on main as 20260809120000 |
| 20260809015730 | pdcp_adapter_browser_assist_and_term_expired_basis |  | DB_ONLY_SHIFTED | same name on main as 20260809030000 |
| 20260809015801 | add_remaining_arcade_module_ids |  | DB_ONLY_SHIFTED | same name on main as 20260809120000 |
| 20260809022205 | harden_public_reference_tables_and_drop_scratch |  | DB_ONLY_SHIFTED | same name on main as 20260809040000 |
| 20260809030000 |  | pdcp_adapter_browser_assist_and_term_expired_basis | MAIN_ONLY_SHIFTED |  |
| 20260809040000 |  | harden_public_reference_tables_and_drop_scratch | MAIN_ONLY_SHIFTED |  |
| 20260809120000 |  | add_remaining_arcade_module_ids / comic_reader_format | MAIN_ONLY_SHIFTED |  |
| 20260809120419 | lbv_resolution_diagnostics | lbv_resolution_diagnostics | MATCH |  |
| 20260809120437 | v_book_extraction_stats_v2 | v_book_extraction_stats_v2 | MATCH |  |
| 20260809155433 | find_unbound_resolution_aware | find_unbound_resolution_aware | MATCH |  |
| 20260810113051 | vocab_selection_relative_band | vocab_selection_relative_band | MATCH |  |
| 20260810113116 | shared_words_v_level | shared_words_v_level | MATCH |  |
| 20260810115121 | noise_blacklist_is_blocking | noise_blacklist_is_blocking | MATCH |  |
| 20260810115154 | find_unbound_respect_is_blocking | find_unbound_respect_is_blocking | MATCH |  |
| 20260810135205 | lookup_proper_noun_guard_and_tier_order | lookup_proper_noun_guard_and_tier_order | MATCH |  |
| 20260810232100 | dialect_map_verified_eye_dialect | dialect_map_verified_eye_dialect | MATCH |  |
| 20260810233306 | republish_book_word_sets_band_and_vlevel | republish_book_word_sets_band_and_vlevel | MATCH |  |
| 20260810234335 | list_book_support_vocab | list_book_support_vocab | MATCH |  |
| 20260811035506 | views_security_invoker_extraction | views_security_invoker_extraction | MATCH |  |
| 20260811035529 | fix_chapter_html_entities | fix_chapter_html_entities | MATCH |  |
| 20260811035548 | decode_entities_in_stored_sentences | decode_entities_in_stored_sentences | MATCH |  |
| 20260811035618 | pdcp_modernize_stage_and_run_anchor |  | DB_ONLY_SHIFTED | same name on main as 20260811090000 |
| 20260811035656 | fix_chapter_html_entities_qualify_digest |  | DB_ONLY | none (no file in any git ref) |
| 20260811035926 | decode_entities_strip_truncated |  | DB_ONLY | none (no file in any git ref) |
| 20260811040100 | decode_entities_article_sentences | decode_entities_article_sentences | MATCH |  |
| 20260811040303 | decode_entities_hex_lpad_fix |  | DB_ONLY | none (no file in any git ref) |
| 20260811044703 | negation_preserving_binding | negation_preserving_binding | MATCH |  |
| 20260811045255 | extraction_quality_audit | extraction_quality_audit | MATCH |  |
| 20260811045603 | abbrev_binding_and_ghost_purge | abbrev_binding_and_ghost_purge | MATCH |  |
| 20260811045727 | extraction_quality_audit_v2_definitions |  | DB_ONLY | none (no file in any git ref) |
| 20260811053500 | dict_pos_sense_backfill | dict_pos_sense_backfill | MATCH |  |
| 20260811090000 |  | pdcp_modernize_stage_and_run_anchor | MAIN_ONLY_SHIFTED |  |
| 20260811111124 | lemma_dominant_pos_fallback |  | DB_ONLY | none (no file in any git ref) |
| 20260811111430 | lemma_dominant_pos_materialized | lemma_dominant_pos_fallback | NAME_DIFF |  |
| 20260811114612 | blacklist_release_various | blacklist_release_various | MATCH |  |
| 20260811121439 | archaic_tier | archaic_tier | MATCH |  |
| 20260811121523 | archaic_tier_coverage_defer | archaic_tier_coverage_defer | MATCH |  |
| 20260811125842 | en_inflection_men_plural | en_inflection_men_plural | MATCH |  |
| 20260811132526 | en_inflection_men_plural_defer | en_inflection_men_plural_defer | MATCH |  |
| 20260811132640 | deliver_chapter_vocab | deliver_chapter_vocab | MATCH |  |
| 20260811135625 | commit_chapter_vocab | commit_chapter_vocab | MATCH |  |
| 20260811221658 | restore_word_familiarity |  | DB_ONLY_SHIFTED | same name on main as 20260812093000 |
| 20260811224630 | incremental_audit_and_stats_maintenance | incremental_audit_and_stats_maintenance | MATCH |  |
| 20260811231013 | audit_words_column_semantics |  | DB_ONLY | none (no file in any git ref) |
| 20260812025315 | drop_extraction_test_corpus_reclaim_space | drop_extraction_test_corpus_reclaim_space | MATCH |  |
| 20260812025420 | audit_text_presence_cheap | audit_text_presence_cheap | MATCH |  |
| 20260812034100 |  | maintain_stats_readonly_only | MAIN_ONLY_SHIFTED |  |
| 20260812034330 | maintain_stats_readonly_only |  | DB_ONLY_SHIFTED | same name on main as 20260812034100 |
| 20260812034618 | publish_carry_pos_example_ipa |  | DB_ONLY | none (no file in any git ref) |
| 20260812035402 | restore_vocab_raw_texts |  | DB_ONLY_SHIFTED | same name on main as 20260812101500 |
| 20260812042709 | publish_remove_cap_limit |  | DB_ONLY | none (no file in any git ref) |
| 20260812043729 | band_gate_by_headword_v_level |  | DB_ONLY | none (no file in any git ref) |
| 20260812071959 | restore_csat_item_attempts |  | DB_ONLY_SHIFTED | same name on main as 20260812113000 |
| 20260812074137 | restore_class_data_model |  | DB_ONLY_SHIFTED | same name on main as 20260812124500 |
| 20260812081442 | restore_pending_words |  | DB_ONLY_SHIFTED | same name on main as 20260812133000 |
| 20260812091836 | audit_text_presence_hyphen_fix |  | DB_ONLY | none (no file in any git ref) |
| 20260812092104 | audit_text_presence_trim_edges | audit_text_presence_trim_edges | MATCH |  |
| 20260812093000 |  | restore_word_familiarity | MAIN_ONLY_SHIFTED |  |
| 20260812101500 |  | restore_vocab_raw_texts | MAIN_ONLY_SHIFTED |  |
| 20260812103036 | dictation_persistence |  | DB_ONLY_SHIFTED | same name on main as 20260812150000 |
| 20260812111636 | fix_i10_gate_drop_cap40 |  | DB_ONLY_SHIFTED | same name on main as 20260812160000 |
| 20260812113000 |  | restore_csat_item_attempts | MAIN_ONLY_SHIFTED |  |
| 20260812124500 |  | restore_class_data_model | MAIN_ONLY_SHIFTED |  |
| 20260812133000 |  | restore_pending_words | MAIN_ONLY_SHIFTED |  |
| 20260812150000 |  | dictation_persistence | MAIN_ONLY_SHIFTED |  |
| 20260812160000 |  | fix_i10_gate_drop_cap40 | MAIN_ONLY_SHIFTED |  |
| 20260813082830 | scores_content_ref |  | DB_ONLY_SHIFTED | same name on main as 20260813090000 |
| 20260813090000 |  | scores_content_ref | MAIN_ONLY_SHIFTED |  |
| 20260813103000 |  | simplicissimus_unbound_disposition | MAIN_ONLY_SHIFTED |  |
| 20260813104500 |  | foreign_citation_marking | MAIN_ONLY_SHIFTED |  |
| 20260813110729 | word_set_rls_inherit_source_gate | word_set_rls_inherit_source_gate | MATCH |  |
| 20260813110907 | simplicissimus_unbound_disposition |  | DB_ONLY_SHIFTED | same name on main as 20260813103000 |
| 20260813111017 | foreign_citation_marking |  | DB_ONLY_SHIFTED | same name on main as 20260813104500 |
| 20260813111443 | dict_drain_simplicissimus_6 |  | DB_ONLY_SHIFTED | same name on main as 20260813112000 |
| 20260813112000 |  | dict_drain_simplicissimus_6 | MAIN_ONLY_SHIFTED |  |
| 20260813120631 | resolve_dict_headword_meaning_preserving_l5 |  | DB_ONLY | none (no file in any git ref) |
| 20260813120648 | unresolved_dict_words_rpc |  | DB_ONLY | none (no file in any git ref) |
| 20260813120749 | resolve_dict_headword_drop_academic_prefixes |  | DB_ONLY | none (no file in any git ref) |
| 20260813121035 | resolve_dict_headword_orthographic_variants |  | DB_ONLY | none (no file in any git ref) |
| 20260813134158 | resolve_dict_headword_bidirectional_variants |  | DB_ONLY | none (no file in any git ref) |
| 20260813134935 | seed_pronoun_paradigm_inflected_forms |  | DB_ONLY | none (no file in any git ref) |
| 20260813140216 | fix_he_it_pronoun_entries |  | DB_ONLY | none (no file in any git ref) |
| 20260814015130 | quality_metrics_ssot_drift | quality_metrics_ssot_drift | MATCH |  |
| 20260814024656 | rpc_inherit_book_gate | rpc_inherit_book_gate | MATCH |  |
| 20260814030510 | inflection_ves_and_ish_derivation |  | DB_ONLY_SHIFTED | same name on main as 20260814113000 |
| 20260814090000 |  | module_id_echo | MAIN_ONLY |  |
| 20260814113000 |  | inflection_ves_and_ish_derivation | MAIN_ONLY_SHIFTED |  |
| 20260814115338 | user_profiles_privilege_escalation_guard |  | DB_ONLY_SHIFTED | same name on main as 20260814150000 |
| 20260814120132 | 20260814090000_module_id_echo |  | DB_ONLY | none (no file in any git ref) |
| 20260814150000 |  | user_profiles_privilege_escalation_guard | MAIN_ONLY_SHIFTED |  |
| 20260815000509 | close_client_writable_gaps |  | DB_ONLY_SHIFTED | same name on main as 20260815020000 |
| 20260815020000 |  | close_client_writable_gaps | MAIN_ONLY_SHIFTED |  |
| 20260815021834 | i7_phrase_unit_carveout |  | DB_ONLY_SHIFTED | same name on main as 20260815120000 |
| 20260815060000 |  | dictation_session_items | MAIN_ONLY |  |
| 20260815060341 | remove_pdcp_vintage_comic_content |  | DB_ONLY | none (no file in any git ref) |
| 20260815062032 | recommend_by_blueprint |  | DB_ONLY_SHIFTED | same name on main as 20260815150000 |
| 20260815082529 | ngsl_top2000_basic_gaps |  | DB_ONLY_SHIFTED | same name on main as 20260815090000 |
| 20260815082641 | ngsl_basic_gaps_set_classified_by | ngsl_basic_gaps_set_classified_by | MATCH |  |
| 20260815082723 | backup_template_examples_before_purge | backup_template_examples_before_purge | MATCH |  |
| 20260815082752 | 20260815060000_dictation_session_items |  | DB_ONLY | none (no file in any git ref) |
| 20260815082826 | template_examples_remove_and_reauthor |  | DB_ONLY_SHIFTED | same name on main as 20260815093000 |
| 20260815090000 |  | ngsl_top2000_basic_gaps | MAIN_ONLY_SHIFTED |  |
| 20260815092528 | template_examples_residue_escaped_headwords | template_examples_residue_escaped_headwords | MATCH |  |
| 20260815093000 |  | template_examples_remove_and_reauthor | MAIN_ONLY_SHIFTED |  |
| 20260815093406 | word_set_cover_image |  | DB_ONLY_SHIFTED | same name on main as 20260815170000 |
| 20260815120000 |  | i7_phrase_unit_carveout | MAIN_ONLY_SHIFTED |  |
| 20260815150000 |  | recommend_by_blueprint | MAIN_ONLY_SHIFTED |  |
| 20260815170000 |  | word_set_cover_image | MAIN_ONLY_SHIFTED |  |
| 20260815174455 | 20260816030000_dictation_attempt_unique |  | DB_ONLY | none (no file in any git ref) |
| 20260816003000 |  | daily_activity_total_seconds | MAIN_ONLY_SHIFTED |  |
| 20260816030000 |  | dictation_attempt_unique | MAIN_ONLY |  |
| 20260816045450 | publish_lookup_prefers_registered_inflections | publish_lookup_prefers_registered_inflections | MATCH |  |
| 20260816045733 | backfill_published_word_lemma_rebind | backfill_published_word_lemma_rebind | MATCH |  |
| 20260816050001 | daily_activity_total_seconds |  | DB_ONLY_SHIFTED | same name on main as 20260816003000 |
| 20260816050028 | retire_word_lexicon_rpcs |  | DB_ONLY_SHIFTED | same name on main as 20260816140000 |
| 20260816061819 | topic_corpus_ingest |  | DB_ONLY_SHIFTED | same name on main as 20260816160000 |
| 20260816111345 | topic_corpus_local_sources |  | DB_ONLY_SHIFTED | same name on main as 20260816170000 |
| 20260816115133 | fix_topic_corpus_gap_conflict |  | DB_ONLY_SHIFTED | same name on main as 20260816180000 |
| 20260816120106 | topic_corpus_fix_category_mapping |  | DB_ONLY | none (no file in any git ref) |
| 20260816140000 |  | retire_word_lexicon_rpcs | MAIN_ONLY_SHIFTED |  |
| 20260816143227 | pd_comic_taxonomy |  | DB_ONLY_SHIFTED | same name on main as 20260816200000 |
| 20260816160000 |  | topic_corpus_ingest | MAIN_ONLY_SHIFTED |  |
| 20260816170000 |  | topic_corpus_local_sources | MAIN_ONLY_SHIFTED |  |
| 20260816180000 |  | fix_topic_corpus_gap_conflict | MAIN_ONLY_SHIFTED |  |
| 20260816200000 |  | pd_comic_taxonomy | MAIN_ONLY_SHIFTED |  |
| 20260817022616 | pd_comic_dedupe_scans |  | DB_ONLY_SHIFTED | same name on main as 20260817120000 |
| 20260817025708 | topic_corpus_proper_noun_routing |  | DB_ONLY | none (no file in any git ref) |
| 20260817052824 | acp_compose_foundation | acp_compose_foundation | MATCH |  |
| 20260817053009 | acp_compose_batch_regroup | acp_compose_batch_regroup | MATCH |  |
| 20260817055500 |  | acp_compose_source_access_record | MAIN_ONLY_SHIFTED |  |
| 20260817055624 | acp_compose_source_access_record |  | DB_ONLY_SHIFTED | same name on main as 20260817055500 |
| 20260817061500 |  | acp_compose_feeds | MAIN_ONLY_SHIFTED |  |
| 20260817062650 | acp_compose_feeds |  | DB_ONLY_SHIFTED | same name on main as 20260817061500 |
| 20260817064000 |  | acp_compose_jobs | MAIN_ONLY_SHIFTED |  |
| 20260817070000 |  | acp_compose_shelf_candidates | MAIN_ONLY_SHIFTED |  |
| 20260817072513 | acp_compose_jobs |  | DB_ONLY_SHIFTED | same name on main as 20260817064000 |
| 20260817082400 | acp_compose_shelf_candidates |  | DB_ONLY_SHIFTED | same name on main as 20260817070000 |
| 20260817120000 |  | pd_comic_dedupe_scans | MAIN_ONLY_SHIFTED |  |
| 20260817130204 | class_assignments | class_assignments | MATCH |  |
| 20260817153550 | acp_compose_candidates |  | DB_ONLY_SHIFTED | same name on main as 20260818020000 |
| 20260818020000 |  | acp_compose_candidates | MAIN_ONLY_SHIFTED |  |
| 20260818125330 | acp_compose_adaptation |  | DB_ONLY | none (no file in any git ref) |
| 20260821002442 | csat_dcp_items_new_types |  | DB_ONLY_SHIFTED | same name on main as 20260821090000 |
| 20260821005944 | prescribe_today_playable_types |  | DB_ONLY_SHIFTED | same name on main as 20260821093000 |
| 20260821010014 | csat_dcp_items_vocab_choice_type |  | DB_ONLY_SHIFTED | same name on main as 20260821100000 |
| 20260821013337 | csat_dcp_items_grammar_choice_type |  | DB_ONLY_SHIFTED | same name on main as 20260821110000 |
| 20260821090000 |  | csat_dcp_items_new_types | MAIN_ONLY_SHIFTED |  |
| 20260821093000 |  | prescribe_today_playable_types | MAIN_ONLY_SHIFTED |  |
| 20260821100000 |  | csat_dcp_items_vocab_choice_type | MAIN_ONLY_SHIFTED |  |
| 20260821110000 |  | csat_dcp_items_grammar_choice_type | MAIN_ONLY_SHIFTED |  |
| 20260821120000 |  | textbook_shelf_inventory | MAIN_ONLY_SHIFTED |  |
| 20260821134349 | textbook_shelf_inventory |  | DB_ONLY_SHIFTED | same name on main as 20260821120000 |
| 20260821140000 |  | user_textbook_selections | MAIN_ONLY_SHIFTED |  |
| 20260821140214 | csat_dcp_items_generative_types |  | DB_ONLY | none (no file in any git ref) |
| 20260821143943 | user_textbook_selections |  | DB_ONLY_SHIFTED | same name on main as 20260821140000 |
| 20260822005559 | textbook_shelf_sources |  | DB_ONLY_SHIFTED | same name on main as 20260822090000 |
| 20260822005656 | csat_dcp_items_middle_types |  | DB_ONLY | none (no file in any git ref) |
| 20260822005813 | textbook_practice_items_rpc |  | DB_ONLY | none (no file in any git ref) |
| 20260822013136 | dcp_attempts_and_choice_grading | dcp_attempts_and_choice_grading | MATCH |  |
| 20260822013314 | dictionary_categories_public_read |  | DB_ONLY_SHIFTED | same name on main as 20260822100000 |
| 20260822034554 | csat_dcp_items_long_types |  | DB_ONLY_SHIFTED | same name on main as 20260822120000 |
| 20260822053520 | grade_dcp_item_mood |  | DB_ONLY_SHIFTED | same name on main as 20260822140000 |
| 20260822053708 | prescribe_today_textbook_steer |  | DB_ONLY_SHIFTED | same name on main as 20260822110000 |
| 20260822064358 | csat_dcp_items_long_expository |  | DB_ONLY_SHIFTED | same name on main as 20260822160000 |
| 20260822084401 | article_cover_image | article_cover_image | MATCH |  |
| 20260822090000 |  | textbook_shelf_sources | MAIN_ONLY_SHIFTED |  |
| 20260822100000 |  | dictionary_categories_public_read | MAIN_ONLY_SHIFTED |  |
| 20260822110000 |  | prescribe_today_textbook_steer | MAIN_ONLY_SHIFTED |  |
| 20260822120000 |  | csat_dcp_items_long_types | MAIN_ONLY_SHIFTED |  |
| 20260822140000 |  | grade_dcp_item_mood | MAIN_ONLY_SHIFTED |  |
| 20260822160000 |  | csat_dcp_items_long_expository | MAIN_ONLY_SHIFTED |  |
| 20260824224004 | game_ranking |  | DB_ONLY_SHIFTED | same name on main as 20260825120000 |
| 20260824224041 | game_ranking_is_me_not_null |  | DB_ONLY | none (no file in any git ref) |
| 20260824231552 | word_set_example_resync | word_set_example_resync | MATCH |  |
| 20260825094350 | game_ranking_plan_fix |  | DB_ONLY_SHIFTED | same name on main as 20260825140000 |
| 20260825114639 | topic_corpus_language_gate | topic_corpus_language_gate | MATCH |  |
| 20260825120000 |  | game_ranking | MAIN_ONLY_SHIFTED |  |
| 20260825140000 |  | game_ranking_plan_fix | MAIN_ONLY_SHIFTED |  |
| 20260825161641 | funnel_events | funnel_events | MATCH |  |
| 20260825171807 | funnel_first_learn_trigger |  | DB_ONLY | none (no file in any git ref) |
| 20260825230740 | funnel_events_narrow_to_unobservable |  | DB_ONLY | none (no file in any git ref) |
| 20260826091133 | peek_class_by_code |  | DB_ONLY_SHIFTED | same name on main as 20260826120000 |
| 20260826095236 | vocab_origin_assignment |  | DB_ONLY_SHIFTED | same name on main as 20260826123000 |
| 20260826102742 | lcp_requeue_failed | lcp_requeue_failed | MATCH |  |
| 20260826102758 | textfit_resolve_levels | textfit_resolve_levels | MATCH |  |
| 20260826103132 | admin_requeue_book_single_enqueue | admin_requeue_book_single_enqueue | MATCH |  |
| 20260826120000 |  | peek_class_by_code | MAIN_ONLY_SHIFTED |  |
| 20260826123000 |  | vocab_origin_assignment | MAIN_ONLY_SHIFTED |  |
| 20260826130856 | curriculum_bands |  | DB_ONLY_SHIFTED | same name on main as 20260826140000 |
| 20260826131939 | curriculum_bands_derived |  | DB_ONLY | none (no file in any git ref) |
| 20260826140000 |  | curriculum_bands | MAIN_ONLY_SHIFTED |  |
| 20260826145433 | dict_categorical_single_pass |  | DB_ONLY_SHIFTED | same name on main as 20260826160000 |
| 20260826160000 |  | dict_categorical_single_pass | MAIN_ONLY_SHIFTED |  |
| 20260829172439 | add_futurity_to_article_source_check |  | DB_ONLY_SHIFTED | same name on main as 20260830020000 |
| 20260830020000 |  | add_futurity_to_article_source_check | MAIN_ONLY_SHIFTED |  |
| 20260830043445 | add_csat_fit_to_library_articles |  | DB_ONLY_SHIFTED | same name on main as 20260830120000 |
| 20260830043913 | textbook_volume_renders |  | DB_ONLY_SHIFTED | same name on main as 20260830140000 |
| 20260830044325 | tvr_distinct_volumes_nullable |  | DB_ONLY_SHIFTED | same name on main as 20260830141000 |
| 20260830050011 | textbook_vocab_counts_use_gin |  | DB_ONLY_SHIFTED | same name on main as 20260830150000 |
| 20260830073149 | shared_word_sets_category_bridge |  | DB_ONLY_SHIFTED | same name on main as 20260518130000 |
| 20260830073238 | shared_word_sets_brand |  | DB_ONLY_SHIFTED | same name on main as 20260830160000 |
| 20260830095014 | shared_dictionary_example_ko |  | DB_ONLY_SHIFTED | same name on main as 20260830170000 |
| 20260830120000 |  | add_csat_fit_to_library_articles | MAIN_ONLY_SHIFTED |  |
| 20260830124509 | shared_dictionary_archived_flag |  | DB_ONLY | none (no file in any git ref) |
| 20260830124628 | extraction_rpc_exclude_archived_headwords |  | DB_ONLY | none (no file in any git ref) |
| 20260830124942 | resolve_dict_headword_skip_archived |  | DB_ONLY | none (no file in any git ref) |
| 20260830135422 | dcp_items_shelf_aggregate_indexes |  | DB_ONLY_SHIFTED | same name on main as 20260830170000 |
| 20260830140000 |  | textbook_volume_renders | MAIN_ONLY_SHIFTED |  |
| 20260830141000 |  | tvr_distinct_volumes_nullable | MAIN_ONLY_SHIFTED |  |
| 20260830143721 | dcp_items_autovacuum_insert_tuning |  | DB_ONLY_SHIFTED | same name on main as 20260830180000 |
| 20260830144627 | tvr_article_inventory |  | DB_ONLY_SHIFTED | same name on main as 20260830230000 |
| 20260830150000 |  | textbook_vocab_counts_use_gin | MAIN_ONLY_SHIFTED |  |
| 20260830152552 | textbook_shelf_stats_materialized |  | DB_ONLY_SHIFTED | same name on main as 20260831090000 |
| 20260830160000 |  | shared_word_sets_brand | MAIN_ONLY_SHIFTED |  |
| 20260830170000 |  | dcp_items_shelf_aggregate_indexes / shared_dictionary_example_ko | MAIN_ONLY_SHIFTED |  |
| 20260830180000 |  | dcp_items_autovacuum_insert_tuning | MAIN_ONLY_SHIFTED |  |
| 20260830230000 |  | tvr_article_inventory | MAIN_ONLY_SHIFTED |  |
| 20260831032517 | textbook_curriculum_vocab_materialized |  | DB_ONLY_SHIFTED | same name on main as 20260831100000 |
| 20260831090000 |  | textbook_shelf_stats_materialized | MAIN_ONLY_SHIFTED |  |
| 20260831093411 | drop_unused_and_duplicate_indexes | drop_unused_and_duplicate_indexes | MATCH |  |
| 20260831093427 | close_anon_exposure_on_definer_views | close_anon_exposure_on_definer_views | MATCH |  |
| 20260831100000 |  | textbook_curriculum_vocab_materialized | MAIN_ONLY_SHIFTED |  |
| 20260831124820 | unschedule_dead_hot_dictionary_cron | unschedule_dead_hot_dictionary_cron | MATCH |  |
| 20260831130000 |  | quality_drift_rotating_sample | MAIN_ONLY_SHIFTED |  |
| 20260831131623 | quality_drift_rotating_sample |  | DB_ONLY_SHIFTED | same name on main as 20260831130000 |
| 20260901035443 | lav_drop_dead_columns |  | DB_ONLY_SHIFTED | same name on main as 20260901040000 |
| 20260901040000 |  | lav_drop_dead_columns | MAIN_ONLY_SHIFTED |  |
| 20260901044228 | prune_article_vocab_sentences |  | DB_ONLY_SHIFTED | same name on main as 20260901060000 |
| 20260901060000 |  | prune_article_vocab_sentences | MAIN_ONLY_SHIFTED |  |
| 20260901135053 | funnel_events_allow_anonymous |  | DB_ONLY | none (no file in any git ref) |
| 20260901135204 | funnel_events_allow_public_events |  | DB_ONLY | none (no file in any git ref) |
| 20260902055354 | csat_analysis_pipeline | csat_analysis_pipeline | MATCH |  |
| 20260902063650 | csat_coverage_fix_false_positive | csat_coverage_fix_false_positive | MATCH |  |
| 20260902065159 | storyweaver_source |  | DB_ONLY_SHIFTED | same name on main as 20260902160000 |
| 20260902160000 |  | storyweaver_source | MAIN_ONLY_SHIFTED |  |
| 20260903113649 | space_place_source |  | DB_ONLY_SHIFTED | same name on main as 20260903120000 |
| 20260903114408 | shelf_stats_refresh_interval_30min | shelf_stats_refresh_interval_30min | MATCH |  |
| 20260903120000 |  | space_place_source | MAIN_ONLY_SHIFTED |  |
| 20260903121358 | revoke_anon_execute_unguarded_writer_definers | revoke_anon_execute_unguarded_writer_definers | MATCH |  |
| 20260903121759 | revoke_public_execute_unguarded_writer_definers | revoke_public_execute_unguarded_writer_definers | MATCH |  |
| 20260904084631 | revoke_anon_admin_rpcs_and_lemma_pos_mv | revoke_anon_admin_rpcs_and_lemma_pos_mv | MATCH |  |
| 20260904101723 | allow_gutenberg_source |  | DB_ONLY_SHIFTED | same name on main as 20260904120000 |
| 20260904120000 |  | allow_gutenberg_source | MAIN_ONLY_SHIFTED |  |
| 20260904234655 | textfit_resolve_levels_public |  | DB_ONLY_SHIFTED | same name on main as 20260905084613 |
| 20260905021914 | frym_and_ocean_facts_source |  | DB_ONLY_SHIFTED | same name on main as 20260905100000 |
| 20260905071222 | shared_words_pronunciation_sync |  | DB_ONLY_SHIFTED | same name on main as 20260905160000 |
| 20260905071450 | lbv_lemma_prefer_frequent |  | DB_ONLY_SHIFTED | same name on main as 20260905161000 |
| 20260905084613 |  | textfit_resolve_levels_public | MAIN_ONLY_SHIFTED |  |
| 20260905100000 |  | frym_and_ocean_facts_source | MAIN_ONLY_SHIFTED |  |
| 20260905160000 |  | shared_words_pronunciation_sync | MAIN_ONLY_SHIFTED |  |
| 20260905161000 |  | lbv_lemma_prefer_frequent | MAIN_ONLY_SHIFTED |  |
| 20260905225251 | funnel_events_allow_missing_events |  | DB_ONLY_SHIFTED | same name on main as 20260906030000 |
| 20260905225539 | acp_article_rollup | acp_article_rollup | MATCH |  |
| 20260905225559 | csat_dcp_inventory | csat_dcp_inventory | MATCH |  |
| 20260905233859 | admin_rollup_statement_timeout |  | DB_ONLY | none (no file in any git ref) |
| 20260905234137 | acp_article_rollup_published_only |  | DB_ONLY_SHIFTED | same name on main as 20260906000100 |
| 20260905235953 | idx_dcp_items_ref_id | idx_dcp_items_ref_id | MATCH |  |
| 20260906000100 |  | acp_article_rollup_published_only | MAIN_ONLY_SHIFTED |  |
| 20260906001200 |  | drop_csat_dcp_inventory_superseded | MAIN_ONLY_SHIFTED |  |
| 20260906004450 | grade_dcp_item_explain_on_correct |  | DB_ONLY_SHIFTED | same name on main as 20260906093000 |
| 20260906004852 | drop_csat_dcp_inventory_superseded |  | DB_ONLY_SHIFTED | same name on main as 20260906001200 |
| 20260906010000 |  | db_health_metrics | MAIN_ONLY_SHIFTED |  |
| 20260906010500 |  | db_health_integrity | MAIN_ONLY_SHIFTED |  |
| 20260906010709 | db_health_metrics |  | DB_ONLY_SHIFTED | same name on main as 20260906010000 |
| 20260906011000 |  | db_health_advisor_fix | MAIN_ONLY_SHIFTED |  |
| 20260906011127 | db_health_advisor_fix |  | DB_ONLY_SHIFTED | same name on main as 20260906011000 |
| 20260906011156 | db_health_integrity |  | DB_ONLY_SHIFTED | same name on main as 20260906010500 |
| 20260906011427 | db_health_integrity_noise_filter |  | DB_ONLY_SHIFTED | same name on main as 20260906011500 |
| 20260906011500 |  | db_health_integrity_noise_filter | MAIN_ONLY_SHIFTED |  |
| 20260906011926 | db_health_findings |  | DB_ONLY_SHIFTED | same name on main as 20260906020000 |
| 20260906014416 | idx_lbv_word_lemma | idx_lbv_word_lemma | MATCH |  |
| 20260906014442 | 20260906_index_library_articles_feed |  | DB_ONLY | none (no file in any git ref) |
| 20260906014615 | idx_sd_meaning_ko_present | idx_sd_meaning_ko_present | MATCH |  |
| 20260906014754 | fix_analyze_book_vrl_column |  | DB_ONLY_SHIFTED | same name on main as 20260906030000 |
| 20260906015200 |  | lbv_autovacuum_scale_factor | MAIN_ONLY_SHIFTED |  |
| 20260906015322 | db_health_exceptions |  | DB_ONLY_SHIFTED | same name on main as 20260906031000 |
| 20260906015725 | lbv_autovacuum_scale_factor |  | DB_ONLY_SHIFTED | same name on main as 20260906015200 |
| 20260906020000 |  | db_health_findings | MAIN_ONLY_SHIFTED |  |
| 20260906023409 | db_health_anomaly_checkpoint |  | DB_ONLY_SHIFTED | same name on main as 20260906040000 |
| 20260906030000 |  | fix_analyze_book_vrl_column / funnel_events_allow_missing_events | MAIN_ONLY_SHIFTED |  |
| 20260906031000 |  | db_health_exceptions | MAIN_ONLY_SHIFTED |  |
| 20260906040000 |  | db_health_anomaly_checkpoint | MAIN_ONLY_SHIFTED |  |
| 20260906050000 |  | db_health_search_path_scope | MAIN_ONLY_SHIFTED |  |
| 20260906060000 |  | db_health_queue_axis | MAIN_ONLY_SHIFTED |  |
| 20260906061000 |  | db_health_queue_axis_separate | MAIN_ONLY_SHIFTED |  |
| 20260906063831 | idx_la_band_id | idx_la_band_id | MATCH |  |
| 20260906065438 | fix_enqueue_curation_jobs_on_conflict | fix_enqueue_curation_jobs_on_conflict | MATCH |  |
| 20260906071128 | db_health_search_path_scope |  | DB_ONLY_SHIFTED | same name on main as 20260906050000 |
| 20260906073026 | db_health_queue_axis |  | DB_ONLY_SHIFTED | same name on main as 20260906060000 |
| 20260906073520 | db_health_queue_axis_separate |  | DB_ONLY_SHIFTED | same name on main as 20260906061000 |
| 20260906074500 |  | batch_first_sentence_repair | MAIN_ONLY_SHIFTED |  |
| 20260906093000 |  | grade_dcp_item_explain_on_correct | MAIN_ONLY_SHIFTED |  |
| 20260906102655 | textbook_volume_renders_series |  | DB_ONLY_SHIFTED | same name on main as 20260906103500 |
| 20260906103500 |  | textbook_volume_renders_series | MAIN_ONLY_SHIFTED |  |
| 20260906105519 | db_health_live |  | DB_ONLY_SHIFTED | same name on main as 20260906190000 |
| 20260906105612 | db_health_actions |  | DB_ONLY_SHIFTED | same name on main as 20260906190500 |
| 20260906105833 | db_health_live_cron_jobid_fix |  | DB_ONLY | none (no file in any git ref) |
| 20260906105942 | db_health_actions_split_guard |  | DB_ONLY | none (no file in any git ref) |
| 20260906110117 | db_health_actions_log_failures |  | DB_ONLY | none (no file in any git ref) |
| 20260906111534 | csat_source_console |  | DB_ONLY_SHIFTED | same name on main as 20260906200000 |
| 20260906125159 | db_health_live_now_window |  | DB_ONLY_SHIFTED | same name on main as 20260906215000 |
| 20260906190000 |  | db_health_live | MAIN_ONLY_SHIFTED |  |
| 20260906190500 |  | db_health_actions | MAIN_ONLY_SHIFTED |  |
| 20260906200000 |  | csat_source_console | MAIN_ONLY_SHIFTED |  |
| 20260906215000 |  | db_health_live_now_window | MAIN_ONLY_SHIFTED |  |
| 20260907151623 | library_articles_source_add_frontiers_worldbank |  | DB_ONLY | none (no file in any git ref) |
| 20260908035514 | db_health_stats_criterion_pg_statistic | db_health_stats_criterion_pg_statistic | MATCH |  |
| 20260908035616 | lcp_worker_loud_when_blocked | lcp_worker_loud_when_blocked | MATCH |  |
| 20260908041648 | library_articles_source_add_nist |  | DB_ONLY | none (no file in any git ref) |
| 20260908042344 | pin_search_path_public_funcs | pin_search_path_public_funcs | MATCH |  |
| 20260908051907 | idx_shared_words_source_queue_id_partial | idx_shared_words_source_queue_id_partial | MATCH |  |
| 20260912120853 | csat_item_reviews |  | DB_ONLY_SHIFTED | same name on main as 20260912210000 |
| 20260912123325 | batch_first_sentence_repair |  | DB_ONLY_SHIFTED | same name on main as 20260906074500 |
| 20260912131547 | user_textbook_selections_series |  | DB_ONLY_SHIFTED | same name on main as 20260912221500 |
| 20260912210000 |  | csat_item_reviews | MAIN_ONLY_SHIFTED |  |
| 20260912221500 |  | user_textbook_selections_series | MAIN_ONLY_SHIFTED |  |
| 20260912233626 | funnel_events_video |  | DB_ONLY_SHIFTED | same name on main as 20260912235900 |
| 20260912233645 | video_bucket |  | DB_ONLY_SHIFTED | same name on main as 20260913000100 |
| 20260912235900 |  | funnel_events_video | MAIN_ONLY_SHIFTED |  |
| 20260913000100 |  | video_bucket | MAIN_ONLY_SHIFTED |  |
| 20260913013946 | csat_exams_paper_form | csat_exams_paper_form | MATCH |  |
| 20260913080708 | add_europe_pmc_article_source |  | DB_ONLY | none (no file in any git ref) |
| 20260913120000 |  | video_jobs | MAIN_ONLY_SHIFTED |  |
| 20260913133253 | video_jobs |  | DB_ONLY_SHIFTED | same name on main as 20260913120000 |
| 20260914024558 | csat_item_reviews_digest |  | DB_ONLY_SHIFTED | same name on main as 20260914120000 |
| 20260914030146 | csat_item_reviews_item_digest |  | DB_ONLY | none (no file in any git ref) |
| 20260914034429 | drop_duplicate_item_digest_column |  | DB_ONLY | none (no file in any git ref) |
| 20260914042359 | video_job_eval |  | DB_ONLY_SHIFTED | same name on main as 20260914090000 |
| 20260914090000 |  | video_job_eval | MAIN_ONLY_SHIFTED |  |
| 20260914120000 |  | csat_item_reviews_digest | MAIN_ONLY_SHIFTED |  |
| 20260915033000 |  | funnel_allow_csat_evidence_opened | MAIN_ONLY_SHIFTED |  |
| 20260915033331 | funnel_allow_csat_evidence_opened |  | DB_ONLY_SHIFTED | same name on main as 20260915033000 |
| 20260915052123 | funnel_allow_csat_overlay |  | DB_ONLY_SHIFTED | same name on main as 20260915143000 |
| 20260915092613 | csat_dcp_items_missing_explanation_idx |  | DB_ONLY | none (no file in any git ref) |
| 20260915143000 |  | funnel_allow_csat_overlay | MAIN_ONLY_SHIFTED |  |
| 20260915173315 | csat_trap_attempts |  | DB_ONLY_SHIFTED | same name on main as 20260916021500 |
| 20260915181827 | csat_trap_attempts |  | DB_ONLY_SHIFTED | same name on main as 20260916021500 |
| 20260916021500 |  | csat_trap_attempts | MAIN_ONLY_SHIFTED |  |
| 20260916120000 |  | funnel_allow_csat_rest | MAIN_ONLY_SHIFTED |  |
| 20260917005619 | funnel_allow_csat_rest |  | DB_ONLY_SHIFTED | same name on main as 20260916120000 |
| 20260917070408 | funnel_allow_csat_lecture |  | DB_ONLY_SHIFTED | same name on main as 20260917150000 |
| 20260917114953 | funnel_allow_csat_session |  | DB_ONLY_SHIFTED | same name on main as 20260917190000 |
| 20260917115047 | csat_session_records |  | DB_ONLY_SHIFTED | same name on main as 20260917200000 |
| 20260917115404 | csat_session_records_revoke_anon |  | DB_ONLY | none (no file in any git ref) |
| 20260917150000 |  | funnel_allow_csat_lecture | MAIN_ONLY_SHIFTED |  |
| 20260917190000 |  | funnel_allow_csat_session | MAIN_ONLY_SHIFTED |  |
| 20260917200000 |  | csat_session_records | MAIN_ONLY_SHIFTED |  |
| 20260918140000 |  | csat_source_eligibility_cache | MAIN_ONLY_SHIFTED |  |
| 20260918140100 |  | csat_source_eligibility_consumers | MAIN_ONLY_SHIFTED |  |
| 20260918140224 | csat_source_eligibility_cache |  | DB_ONLY_SHIFTED | same name on main as 20260918140000 |
| 20260918141948 | csat_source_eligibility_consumers |  | DB_ONLY_SHIFTED | same name on main as 20260918140100 |
| 20260918222517 | csat_source_cache_freshness |  | DB_ONLY | feat/csat-corpus-expansion feat/csat-source-policy-v3 origin/feat/csat-corpus-expansion origin/feat/csat-source-policy-v3 [file: csat_source_cache_freshness; commit 62c52b106] |
| 20260918232454 | funnel_allow_fit_paint |  | DB_ONLY_SHIFTED | same name on main as 20260919100000 |
| 20260918232551 | csat_source_operations_summary |  | DB_ONLY | feat/csat-corpus-expansion feat/csat-source-policy-v3 origin/feat/csat-corpus-expansion origin/feat/csat-source-policy-v3 [file: csat_source_operations_summary; commit 62c52b106] |
| 20260919023610 | acp_atomic_analysis |  | DB_ONLY | feat/csat-corpus-expansion origin/feat/csat-corpus-expansion [file: acp_atomic_analysis; commit b7f9cf167] |
| 20260919023620 | restore_syntax_score_calibration |  | DB_ONLY | feat/csat-corpus-expansion origin/feat/csat-corpus-expansion [file: restore_syntax_score_calibration; commit b7f9cf167] |
| 20260919023622 | csat_discovery_profiles |  | DB_ONLY | feat/csat-corpus-expansion origin/feat/csat-corpus-expansion [file: csat_discovery_profiles; commit b7f9cf167] |
| 20260919031959 | methodology_intelligence |  | DB_ONLY_SHIFTED | same name on main as 20260919120000 |
| 20260919100000 |  | funnel_allow_fit_paint | MAIN_ONLY_SHIFTED |  |
| 20260919120000 |  | methodology_intelligence | MAIN_ONLY_SHIFTED |  |
| 20260919231528 | default_privileges_revoke_anon_execute | default_privileges_revoke_anon_execute | MATCH |  |
| 20260919231822 | default_privileges_revoke_public_execute | default_privileges_revoke_public_execute | MATCH |  |
| 20260919232557 | default_privileges_global_revoke_public_execute | default_privileges_global_revoke_public_execute | MATCH |  |
| 20260920011614 | grade_dcp_band_is_fit_not_eligibility |  | DB_ONLY_SHIFTED | same name on main as 20260920120000 |
| 20260920014828 | revoke_video_job_writers_from_clients | revoke_video_job_writers_from_clients | MATCH |  |
| 20260920023713 | revoke_csat_source_eligibility_from_anon | revoke_csat_source_eligibility_from_anon | MATCH |  |
| 20260920120000 |  | grade_dcp_band_is_fit_not_eligibility | MAIN_ONLY_SHIFTED |  |
| 20260922004102 | funnel_allow_hub_portal |  | DB_ONLY_SHIFTED | same name on main as 20260922090000 |
| 20260922090000 |  | funnel_allow_hub_portal | MAIN_ONLY_SHIFTED |  |
| 20260923004646 | csat_pipeline_approvals |  | DB_ONLY_SHIFTED | same name on main as 20260923060000 |
| 20260923004729 | csat_drain_runs |  | DB_ONLY_SHIFTED | same name on main as 20260923060100 |
| 20260923004815 | textbook_volume_renders_status |  | DB_ONLY_SHIFTED | same name on main as 20260923060200 |
| 20260923004833 | csat_item_state |  | DB_ONLY_SHIFTED | same name on main as 20260923060300 |
| 20260923004847 | csat_source_eligibility_tally |  | DB_ONLY_SHIFTED | same name on main as 20260923060400 |
| 20260923060000 |  | csat_pipeline_approvals | MAIN_ONLY_SHIFTED |  |
| 20260923060100 |  | csat_drain_runs | MAIN_ONLY_SHIFTED |  |
| 20260923060200 |  | textbook_volume_renders_status | MAIN_ONLY_SHIFTED |  |
| 20260923060300 |  | csat_item_state | MAIN_ONLY_SHIFTED |  |
| 20260923060400 |  | csat_source_eligibility_tally | MAIN_ONLY_SHIFTED |  |
| 20260923103943 | csat_items_public_readonly | csat_items_public_readonly | MATCH |  |
| 20260923104145 | english_irregular_forms_read_policy | english_irregular_forms_read_policy | MATCH |  |
| 20260923104258 | db_efficiency_cron_autovacuum | db_efficiency_cron_autovacuum | MATCH |  |
| 20260923104726 | rls_initplan_and_dead_policies | rls_initplan_and_dead_policies | MATCH |  |
| 20260923105031 | drop_dead_views | drop_dead_views | MATCH |  |
| 20260923115413 | db_health_stale_criterion_fix | db_health_stale_criterion_fix | MATCH |  |
| 20260923205725 | csat_source_eligibility_uses | csat_source_eligibility_uses | MATCH |  |
| 20260923224304 | retire_classic_books_from_articles |  | DB_ONLY | none (no file in any git ref) |
| 20260923232916 | article_word_set_require_vocab | article_word_set_require_vocab | MATCH |  |
| 20260924033904 | eligibility_accept_policy_v4 |  | DB_ONLY_SHIFTED | same name on main as 20260924150000 |
| 20260924034827 | video_requests |  | DB_ONLY_SHIFTED | same name on main as 20260924120000 |
| 20260924035943 | video_requests_format_ids |  | DB_ONLY_SHIFTED | same name on main as 20260924130000 |
| 20260924045957 | video_retire_replace |  | DB_ONLY_SHIFTED | same name on main as 20260924150000 |
| 20260924070635 | drop_dead_dict_mining_rpcs | drop_dead_dict_mining_rpcs | MATCH |  |
| 20260924092020 | eligibility_policy_v4_only |  | DB_ONLY_SHIFTED | same name on main as 20260924170000 |
| 20260924120000 |  | video_requests | MAIN_ONLY_SHIFTED |  |
| 20260924130000 |  | video_requests_format_ids | MAIN_ONLY_SHIFTED |  |
| 20260924142507 | csat_source_live_rollup |  | DB_ONLY_SHIFTED | same name on main as 20260924150000 |
| 20260924145216 | csat_source_inventory_live |  | DB_ONLY_SHIFTED | same name on main as 20260924151000 |
| 20260924150000 |  | csat_source_live_rollup / eligibility_accept_policy_v4 / video_retire_replace | MAIN_ONLY_SHIFTED |  |
| 20260924151000 |  | csat_source_inventory_live | MAIN_ONLY_SHIFTED |  |
| 20260924151501 | csat_learner_state |  | DB_ONLY_SHIFTED | same name on main as 20260925093000 |
| 20260924151509 | funnel_allow_csat_continuity |  | DB_ONLY_SHIFTED | same name on main as 20260925093100 |
| 20260924154748 | csat_source_pipeline_live |  | DB_ONLY_SHIFTED | same name on main as 20260925090000 |
| 20260924170000 |  | eligibility_policy_v4_only | MAIN_ONLY_SHIFTED |  |
| 20260924233604 | csat_source_pipeline_live_fix_pending |  | DB_ONLY_SHIFTED | same name on main as 20260925100000 |
| 20260925032757 | source_get_round3_sources | source_get_round3_sources | MATCH |  |
| 20260925053055 | source_get_round4_pd_sources | source_get_round4_pd_sources | MATCH |  |
| 20260925090000 |  | csat_source_pipeline_live | MAIN_ONLY_SHIFTED |  |
| 20260925093000 |  | csat_learner_state | MAIN_ONLY_SHIFTED |  |
| 20260925093100 |  | funnel_allow_csat_continuity | MAIN_ONLY_SHIFTED |  |
| 20260925100000 |  | csat_source_pipeline_live_fix_pending | MAIN_ONLY_SHIFTED |  |
| 20260925120000 |  | csat_items_public_hide_stem | MAIN_ONLY |  |
| 20260926014105 | spelling_canonical |  | DB_ONLY | none (no file in any git ref) |
| 20260926035521 | video_request_supersede_restore |  | DB_ONLY_SHIFTED | same name on main as 20260926130000 |
| 20260926130000 |  | video_request_supersede_restore | MAIN_ONLY_SHIFTED |  |
| 20260927153152 | csat_exams_hakpyeong | csat_exams_hakpyeong | MATCH |  |
| 20260927161216 | csat_items_public_restore_authenticated_select | csat_items_public_restore_authenticated_select | MATCH |  |
| 20260927171741 | knowledge_registry |  | DB_ONLY_SHIFTED | same name on main as 20260928120000 |
| 20260927172604 | csat_items_public_rehide_stem | csat_items_public_rehide_stem | MATCH |  |
| 20260927182512 | knowledge_evidence_invariants |  | DB_ONLY_SHIFTED | same name on main as 20260928130000 |
| 20260928005032 | knowledge_evidence_concurrency |  | DB_ONLY_SHIFTED | same name on main as 20260928140000 |
| 20260928120000 |  | knowledge_registry | MAIN_ONLY_SHIFTED |  |
| 20260928130000 |  | knowledge_evidence_invariants | MAIN_ONLY_SHIFTED |  |
| 20260928130226 | knowledge_regrade_locks_items |  | DB_ONLY_SHIFTED | same name on main as 20260928150000 |
| 20260928140000 |  | knowledge_evidence_concurrency | MAIN_ONLY_SHIFTED |  |
| 20260928140054 | csat_hakpyeong_hold_self_reviewed | csat_hakpyeong_hold_self_reviewed | MATCH |  |
| 20260928141215 | csat_hakpyeong_independent_review_gate | csat_hakpyeong_independent_review_gate | MATCH |  |
| 20260928141253 | csat_hakpyeong_gate_hygiene | csat_hakpyeong_gate_hygiene | MATCH |  |
| 20260928143924 | csat_hakpyeong_rereview_link | csat_hakpyeong_rereview_link | MATCH |  |
| 20260928150000 |  | knowledge_regrade_locks_items | MAIN_ONLY_SHIFTED |  |
| 20260928152323 | csat_item_units | csat_item_units | MATCH |  |
| 20260930190349 | csat_review_stamp_at_reveal | csat_review_stamp_at_reveal | MATCH |  |
| 20260930190511 | knowledge_evidence_version |  | DB_ONLY_SHIFTED | same name on main as 20261001120000 |
| 20260930203522 | csat_review_ledgers | csat_review_ledgers | MATCH |  |
| 20261001004031 | knowledge_evidence_observed |  | DB_ONLY_SHIFTED | same name on main as 20261001130000 |
| 20261001054511 | csat_diagnosis_mvp |  | DB_ONLY_SHIFTED | same name on main as 20261001150000 |
| 20261001062641 | csat_review_prechecks_input_hash | csat_review_prechecks_input_hash | MATCH |  |
| 20261001063447 | funnel_allow_csat_diagnosis |  | DB_ONLY_SHIFTED | same name on main as 20261001160000 |
| 20261001065734 | csat_diagnosis_atomic_writes |  | DB_ONLY_SHIFTED | same name on main as 20261001170000 |
| 20261001095541 | csat_dx_snapshot_once_per_session |  | DB_ONLY_SHIFTED | same name on main as 20261001180000 |
| 20261001101635 | csat_scope_type_reports_coverage | csat_scope_type_reports_coverage | MATCH |  |
| 20261001110017 | csat_hakpyeong_learner_exposure | csat_hakpyeong_learner_exposure | MATCH |  |
| 20261001120000 |  | knowledge_evidence_version | MAIN_ONLY_SHIFTED |  |
| 20261001130000 |  | knowledge_evidence_observed | MAIN_ONLY_SHIFTED |  |
| 20261001150000 |  | csat_diagnosis_mvp | MAIN_ONLY_SHIFTED |  |
| 20261001160000 |  | funnel_allow_csat_diagnosis | MAIN_ONLY_SHIFTED |  |
| 20261001170000 |  | csat_diagnosis_atomic_writes | MAIN_ONLY_SHIFTED |  |
| 20261001180000 |  | csat_dx_snapshot_once_per_session | MAIN_ONLY_SHIFTED |  |
| 20261002060000 |  | csat_type_reports_scope_pk | MAIN_ONLY_SHIFTED |  |
| 20261002093959 | csat_map |  | DB_ONLY_SHIFTED | same name on main as 20261002120000 |
| 20261002120000 |  | csat_map | MAIN_ONLY_SHIFTED |  |
| 20261002120100 |  | funnel_allow_csat_map | MAIN_ONLY_SHIFTED |  |
| 20261002125415 | csat_type_reports_scope_pk |  | DB_ONLY_SHIFTED | same name on main as 20261002060000 |
| 20261002130000 |  | csat_map_item_rate_ledger | MAIN_ONLY_SHIFTED |  |
| 20261002130915 | csat_map_item_rate_ledger |  | DB_ONLY_SHIFTED | same name on main as 20261002130000 |
| 20261002131012 | funnel_allow_csat_map |  | DB_ONLY_SHIFTED | same name on main as 20261002120100 |
| 20261003230000 | csat_error_evidence | csat_error_evidence | MATCH |  |
| 20261004030405 | csat_review_ledger_atomic | csat_review_ledger_atomic | MATCH |  |
| 20261004030412 | csat_drain_runs_search_path | csat_drain_runs_search_path | MATCH |  |
| 20261004030416 | csat_blind_protocol_holds | csat_blind_protocol_holds | MATCH |  |
| 20261004234255 | csat_chart_review_assets | csat_chart_review_assets | MATCH |  |
| 20261005130000 | csat_ec_pilot_evidence | csat_ec_pilot_evidence | MATCH |  |
| 20261005140000 | csat_ec_taxonomy_v01_restore | csat_ec_taxonomy_v01_restore | MATCH |  |
| 20261005150000 | csat_ec_capture_support | csat_ec_capture_support | MATCH |  |
| 20261005170000 | csat_ec_reveal_gate | csat_ec_reveal_gate | MATCH |  |
| 20261005170100 | csat_ec_reveal_gate_revoke |  | DB_ONLY | docs/ec-detector-design feat/ec-detector feat/ec-pilot-gate feat/ec-reveal-app (+6) [file: csat_ec_reveal_gate_revoke; commit f90479676] |
| 20261006090000 | auto_promote_self_only |  | DB_ONLY | docs/ec-detector-design feat/ec-detector feat/ec-pilot-gate feat/ec-reveal-app (+6) [file: auto_promote_self_only; commit 00a99edab] |
| 20261006100000 | function_exec_policy |  | DB_ONLY | feat/ec-detector feat/ec-pilot-gate feat/ec-smoke test/ec-pilot-e2e (+1) [file: function_exec_policy; commit ab99f119a] |
| 20261006110000 | csat_ec_reveal_gate_revoke_residual |  | DB_ONLY | feat/ec-detector feat/ec-pilot-gate feat/ec-smoke test/ec-pilot-e2e (+1) [file: csat_ec_reveal_gate_revoke_residual; commit 566e99d79] |
| 20261006120000 | csat_ec_boundary_detector |  | DB_ONLY | feat/ec-detector feat/ec-pilot-gate feat/ec-smoke test/ec-pilot-e2e (+1) [file: csat_ec_boundary_detector; commit b589d04a8] |
| 20261007100000 | csat_ec_detector_meaning_rule |  | DB_ONLY | feat/ec-smoke [file: csat_ec_detector_meaning_rule; commit 8989026c2] |
| 20261007102816 | reading_adaptation_promotion_gate |  | DB_ONLY | feat/textbook-factory-main origin/feat/textbook-factory-main [file: reading_adaptation_promotion_gate; commit d5b25ae17] |
| 20261007102922 | reading_gate_pin_search_path |  | DB_ONLY | feat/textbook-factory-main origin/feat/textbook-factory-main [file: reading_gate_pin_search_path; commit d5b25ae17] |
| 20261007205705 | reading_controlled_promotion |  | DB_ONLY | feat/textbook-factory-main origin/feat/textbook-factory-main [file: reading_controlled_promotion; commit d5b25ae17] |
| 20261007211638 | reading_promotion_tables_rls |  | DB_ONLY | feat/textbook-factory-main origin/feat/textbook-factory-main [file: reading_promotion_tables_rls; commit d5b25ae17] |
| 20261007213310 | reading_promotion_explicit_deny_policies |  | DB_ONLY | feat/textbook-factory-main origin/feat/textbook-factory-main [file: reading_promotion_explicit_deny_policies; commit d5b25ae17] |
| 20261008030658 | reading_production_snapshot |  | DB_ONLY | none (no file in any git ref) |
| 20261008120000 | knowledge_vnext | knowledge_vnext | MATCH |  |
| 20261008140000 | knowledge_review_cascade_guard | knowledge_review_cascade_guard | MATCH |  |
| 20261008144206 | knowledge_release_approval | knowledge_release_approval | MATCH |  |
| 20261008150000 | knowledge_statement_review_fix | knowledge_statement_review_fix | MATCH |  |
| 20261008160000 | learning_sessions_integrated | learning_sessions_integrated | MATCH |  |
| 20261008170000 | knowledge_trial_evidence_guard | knowledge_trial_evidence_guard | MATCH |  |
| 20261008180000 | learning_help_timing | learning_help_timing | MATCH |  |
| 20261008190000 | learning_records_append_only | learning_records_append_only | MATCH |  |
| 20261009095727 | 20261009120000_reading_specialized_production_gate |  | DB_ONLY | feat/textbook-factory-main origin/feat/textbook-factory-main [file: reading_specialized_production_gate; commit d5b25ae17] |
| 20261009100000 | learning_cross_session_help | learning_cross_session_help | MATCH |  |
| 20261009104020 | reading_order_production_trace |  | DB_ONLY | feat/textbook-factory-main origin/feat/textbook-factory-main [file: reading_order_production_trace; commit d5b25ae17] |
| 20261010034932 | learning_decisions | learning_decisions | MATCH |  |
| 20261010180218 | map_v4_plan | map_v4_plan | MATCH |  |
| 20261010180916 | map_v4_append_only_search_path | map_v4_append_only_search_path | MATCH |  |
| 20261010181834 | map_v4_plan_conflict_code | map_v4_plan_conflict_code | MATCH |  |
| 20261011022148 | reading_production_volume |  | DB_ONLY | feat/textbook-factory-main origin/feat/textbook-factory-main [file: reading_production_volume; commit 41504630f] |
| 20261011072230 | reading_specialized_production_revalidate |  | DB_ONLY | feat/textbook-factory-main origin/feat/textbook-factory-main [file: reading_specialized_production_revalidate; commit 6965ca7de] |
| 20261011075550 | csat_dcp_items_specialized_types |  | DB_ONLY | feat/textbook-factory-main origin/feat/textbook-factory-main [file: csat_dcp_items_specialized_types; commit b3bbd81d2] |
| 20261011094405 | reading_production_agent_reviewer |  | DB_ONLY | feat/textbook-factory-main origin/feat/textbook-factory-main [file: reading_production_agent_reviewer; commit 1929d890a] |
| 20261014091841 | funnel_allow_csat_meaning | funnel_allow_csat_meaning | MATCH |  |
| 20261017200000 | factory_i1_db1_supply_foundation | factory_i1_db1_supply_foundation | MATCH |  |
| 20261017200100 | factory_i1_db2_partial |  | DB_ONLY | none (no file in any git ref) |
| 20261018120000 | workspace_supply_c_annotation_binding | workspace_supply_c_annotation_binding | MATCH |  |
| 20261018120100 | r5_delivery_g2_binding | r5_delivery_g2_binding | MATCH |  |
| 20261020063000 | factory_product_order_lineage_v1 | factory_product_order_lineage_v1 | MATCH |  |
| 20261021175340 | learning_outcomes_ai_factory_activation_approved_20261022 | learning_outcomes_ai_factory_activation_approved_20261022 | MATCH |  |
| 20261023020321 | csat_item_response_stats | csat_item_response_stats | MATCH |  |
| 20261023043453 | csat_goal_budget | csat_goal_budget | MATCH |  |
| 20261023061401 | csat_goal_budget_conflict | csat_goal_budget_conflict | MATCH |  |
| 20261023082930 | csat_goal_final_assessment | csat_goal_final_assessment | MATCH |  |
| 20261023194123 | learning_exposures |  | DB_ONLY | fix/csat-p6-migrations origin/fix/csat-p6-migrations [file: learning_exposures; commit e9c2fe99c] |
| 20261024012226 | learning_exposures_fix_v3_1 |  | DB_ONLY | fix/csat-p6-migrations origin/fix/csat-p6-migrations [file: learning_exposures_fix_v3_1; commit e9c2fe99c] |
| 20261024025906 | funnel_events_csat_summary | funnel_events_csat_summary | MATCH |  |
| 20261025094450 | lcp_story_s3_schema | lcp_story_s3_schema | MATCH |  |
| 20261025143031 | lcp_story_s5_reader_context | lcp_story_s5_reader_context | MATCH |  |
| 20261026110732 | lcp_story_u1_guidance | lcp_story_u1_guidance | MATCH |  |
| 20261026235109 | lcp_story_w2_context_notes | lcp_story_w2_context_notes | MATCH |  |
| 20261027201035 | r0_article_practice_items_lincoln | r0_article_practice_items_lincoln | MATCH |  |
| 20261027201103 | r0_submit_article_practice | r0_submit_article_practice | MATCH |  |
