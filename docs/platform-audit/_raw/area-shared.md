# 공용 플랫폼 시스템 감사 (area-shared)

- 기준: `D:\workspace\Vocaflow-platform-audit` HEAD `a7c986469` (origin/main) · DB `jajenrevcbmrpaliomxv` SELECT 전용 · 2026-10-09
- 행 수: 핵심 테이블은 `count(*)` 정확값, 나머지는 `pg_class.reltuples` 근사(통계 미갱신 테이블은 0으로 나올 수 있음).
- 실제 사용자: `auth.users` 5 = `user_profiles` 5 (role admin 1 · user 4). 전부 개발·테스트 계정 → VERIFIED_WORKING 은 기능 동작 증거일 뿐 사용 증거가 아니다.

## DB 개관
- public 테이블 약 245 · public 함수(RPC 포함) **585**
- RLS 꺼진 테이블: `textbook_shelf_stats_meta` 1개뿐
- storage 버킷 3: `vocab-sources-raw`(private) · `comic`(public) · `video`(public). 오디오/TTS 버킷 없음.
- 결제 테이블(`subscriptions`·`payments`·`transactions`) 없음 — `apps/web/src/app/admin/billing/page.tsx` 주석이 "PG 미연동" 명시.

## 시스템별 상태

| 시스템 | 상태 | 근거 |
|---|---|---|
| 인증·역할(admin/user) | VERIFIED_WORKING | auth.users 5 / user_profiles 5, role admin1·user4. `app/(auth)`, `api/auth` |
| 교사 역할·B2B 학급 | PARTIAL | `classes` 1 · `class_members` 0 · `class_assignments` 0 · `class_assignment_progress` 0. 화면 `app/(main)/teacher/page.tsx`, `app/(marketing)/join/[code]` 존재. role 값에 teacher 없음(user/admin 만) |
| RLS | VERIFIED_WORKING(구조) | RLS 미적용 1개(`textbook_shelf_stats_meta`, 메타 1행) |
| 학습 기록 코어(learning_records·scores·reading_sessions·daily_activity) | VERIFIED_WORKING(테스트 계정) | 672 · 80 · 287 · 85 행 |
| FSRS | IMPLEMENTED_UNVERIFIED | `lib/srs/fsrs.ts`, `api/srs`. 실사용 규모 미확인 |
| learning_sessions / learning_mutations / word_familiarity | DESIGN_ONLY(빈 테이블) | 정확 count 0·0·0. 코드 참조 5·2·9 파일 → 배선은 있으나 미가동 |
| 레벨·진단(VRL 4축 + 진단 5종) | IMPLEMENTED_UNVERIFIED | `vrl_diagnostic_tests` 5 · 문항 185 · `user_diagnostic_results` 23 · `user_level_snapshots` 22 · 차원표 levels12/tracks6/domains8/skills5 |
| 목표·개인화·i+1 추천 | PARTIAL | `study_plan_items` 6 · `csat_map_goal` 1 · `user_textbook_selections` 2 · `lib/learner/plan-activities.ts`·`prescription-actions.ts` |
| 단어장 소유(vocabularies·shared_word_sets·구독) | VERIFIED_WORKING | vocabularies ~2,269 · shared_word_sets ~11.3k · user_word_set_subscriptions ~276 |
| shared_dictionary 허브 | VERIFIED_WORKING | 49,244 행, 카테고리 566·매핑 28,775, word_roots 510 |
| 분석 funnel_events + events.ts | VERIFIED_WORKING | ~21k 행, 최종 이벤트 2026-10-08. `lib/analytics/{events,funnel,client}.ts` |
| 리텐션 패널 | IMPLEMENTED_UNVERIFIED | `app/admin/page.tsx` 내 retention 참조. 사용자 4명이라 지표 무의미 |
| 통계·리포트(user_stats·weekly_reports) | PARTIAL | 2 · 1 행 |
| 결제·요금제 | DESIGN_ONLY(미구현) | 테이블 없음, billing 화면은 MockDataBanner |
| 알림 | UNKNOWN(사실상 없음) | notification 테이블·푸시 코드 없음(`lib` grep 은 device-prefs 설정만) |
| TTS·오디오 | EXPERIMENTAL | 브라우저 음성합성 계열(`app/dev/tts-probe`, `(main)/settings`, `text/[id]`). 저장 오디오·버킷 없음 |
| 지식 레지스트리 knowledge_* | PARTIAL | items 157 · reviews 171 · evidence 124 · csat_origins 713 (가동) |
| 방법론 레지스트리 methodology_* | DESIGN_ONLY | sources 64 · taxonomy 59 외 claims/methods/evidence 등 8개 0행 (methodology-vnext·knowledge-vnext 두 브랜치 병존 이력) |
| storage | VERIFIED_WORKING(만화·영상) | 3 버킷 |

## 중복·병렬 모델
1. **학습 기록 이원화**: 일반 `learning_records`(672) · `learning_sessions`(0) · `learning_task_attempts`(3) · 모듈별 `dictation_*`·`echo_match_*`·`comic_read_progress` vs CSAT 전용 `csat_item_attempts`(20) · `csat_session_attempts`(1) · `csat_trap_attempts` · `csat_dx_response`(90)·`csat_dx_session` · `csat_learner_state` · `csat_item_state` · `csat_map_task_done`. CSAT 응답이 공용 기록/FSRS 와 합쳐지지 않음.
2. **레벨 모델 이원화**: VRL `user_level_snapshots`/`user_diagnostic_results` vs CSAT `csat_dx_snapshot`·`csat_dx_profile_hist`(0)·`csat_learner_state`.
3. **목표 이원화**: `study_plan_items` vs `csat_map_goal`.
4. **지식 레지스트리 이원화**: `knowledge_*` vs `methodology_*`.
5. **사전 병렬**: `shared_dictionary` vs `shared_words`(~681k, VCB) vs `archaic_dictionary`·`lexicon_clean`(~455k).
6. **단어 숙련 병렬**: learning_records(FSRS) vs `word_familiarity`(0).

## 0행(또는 근사 0) 테이블 — 도메인별
- B2B: class_members, class_assignments, class_assignment_progress
- 공용 학습: learning_sessions, learning_mutations, word_familiarity
- CSAT EC(오답원인): csat_ec_* 대부분(ai_run, boundary*, capture_session, claim, code, judgment, process_evidence, reveal_outbox, session_confirmation, taxonomy_version …)
- CSAT 기타: csat_dx_pool/settings/trap_family/habit_feedback/profile_hist, csat_item_skeletons, csat_map_*_source/settings/task_done, csat_pipeline_approvals, csat_review_queue, csat_review_visual_* 5, csat_source_registry/targets
- 읽기 발행 승격: reading_product_order_revision, reading_production_*, reading_promotion_* (8개 전부 0 — 최근 추가된 `api/admin/articles/reading-promotion`)
- methodology_* 8, knowledge_gaps/research_sources, video_domains/request_*/retirements, vocab_raw_texts, db_health_action_log
- 코드 미참조: 표본 19개 테이블 grep(apps·packages·scripts) 결과 0 파일은 없음. `vocab_collections`·`reading_fluency_log`·`methodology_claims` 는 참조 1파일뿐(약한 배선). 전수 grep 은 미실시.

## 테이블 도메인 목록 (근사 행수)
- **계정/학습자**: user_profiles 5, user_stats 2, user_textbook_selections 2, user_level_snapshots 22, user_diagnostic_results 23, study_plan_items 6, weekly_reports 1
- **학습 기록**: learning_records 672, scores 80, reading_sessions 287, daily_activity 85, learning_task_attempts 3, learning_sessions 0, learning_mutations 0, word_familiarity 0, reading_fluency_log 3, dictation_sessions 15/attempts 6, echo_match_sessions 9/attempts 9, quiz_questions 5
- **B2B**: classes 1, class_members 0, class_assignments 0, class_assignment_progress 0
- **분석/운영**: funnel_events ~21k, quality_metrics 1,460, quality_drift_checks 312, db_health_* (metrics ~10k, findings 66, checkpoints 145)
- **사전/어휘 허브**: shared_dictionary 49,244, dictionary_categories 566, dictionary_word_categories 28,775, word_roots 510, word_root_links 9,468, english_irregular_forms 337, proper_noun_forms 24,300, spelling_norm 312k, dialect_map 161, noise_blacklist 24,729, pending_words 26,322, archaic_dictionary 810, archaic_candidates 34,526, lexicon_* (clean 455k, frequencies 8,424, source_tags 5,421), word_frequency_stats 5,421, frequency_data_sources 12
- **단어장**: vocabularies ~2,269, vocab_collections 1, shared_word_sets ~11.3k, shared_words ~681k, user_word_set_subscriptions 276, VCB vocab_* (runs 2, sources 2, seed_candidates 2,212, enrichment_queue 2,212, dict_hits 2,212, curation_decisions 2,000, raw_texts 0)
- **VRL 분류**: vocaflow_levels 12, tracks 6, domains 8, skills 5, vrl_diagnostic_tests 5, vrl_diagnostic_questions 185, vrl_data_integrity_concerns 82
- **라이브러리(LCP/ACP)**: library_books 401, library_chapters_master 11,161, library_chapter_quiz 2,453, library_book_vocabularies 1.68M, library_articles ~92k, library_article_vocabularies 145k, library_*_seed_catalog, library_source_catalogs 12, book_curation_jobs 7, book_extraction_audit 1,896, extraction_judgments 16, content_chunks 11,239, texts 278, article_compose_* 6, article_fact_* 2, topic_corpus_* (docs 7,713, queue 97k), topic_word_stats 100k, reading_promotion/production_* 8 (0)
- **만화**: pd_comic_* (issues 969, series 101, panels 4,768, kinds 12), comic_books 1, comic_pages 90, comic_panel_events 90, comic_read_progress 2, comic_gen_*, comic_styles 20
- **CSAT**: csat_exams 134, csat_items ~3,700, csat_types 26, csat_item_analyses 7,309, csat_dcp_items ~834k, csat_review_*, csat_source_eligibility 64k(+history 162k), csat_dx_*, csat_ec_*, csat_map_*, csat_item/session/trap_attempts, csat_learner_state, csat_item_state
- **지식/방법론**: knowledge_* 11 테이블, methodology_* 10
- **영상**: video_jobs 73, video_requests 1, 나머지 video_* 0
- **기타/게임/교과서**: sw_players 7, sw_comments 2, st17_timetables 58, textbook_volume_renders 19, textbook_shelf_stats_meta 1

## 핵심 판단
- 공급 측 테이블은 수십만~수백만 행, 수요 측 테이블은 사용자 4명 수준 → 공용 학습자 시스템은 "동작은 하나 사용 검증 없음".
- 0행 테이블 약 70개 — 대부분 최근 설계(EC, reading-promotion, methodology, B2B).
- 가장 큰 구조 위험은 CSAT 학습자 데이터가 공용 learning_records/FSRS/레벨 모델과 분리된 평행 스택이라는 점.
