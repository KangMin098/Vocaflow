# 함수 권한 판정표 — review 60 (제안 · 사람이 확정)

> 2026-10-06 작성. 감사 보고서 `function-execute-audit-2026-10-05.md` 의 review 60개. **기준은 「지금 누가 부를 수 있나」가 아니라 「설계상 누가 불러야 하나」.**
> 판정 근거: DB 실측(pg_proc · has_function_privilege) + 호출부 client 추적(서비스 키 / 사용자 세션 / 브라우저, `lib/*` 는 한 단계 위 importer 까지) + 공개 라우트(`lib/auth/protected-routes.ts`: `/library` · `/comics` 비로그인 공개, `/text` · `/wordvault` · `/diagnostic` 로그인).
> 아직 아무 권한도 바꾸지 않았다. 확정 칸을 채운 뒤 allowlist 매니페스트와 마이그레이션 초안을 다시 만든다.

## 등급

| 등급 | 뜻 | 목표 권한 |
|---|---|---|
| PUBLIC_RPC | 비로그인 공개 화면 · 공개 조회의 하위 순수 함수 | anon · authenticated · service_role (PUBLIC 은 명시 회수) |
| AUTH_SELF_RPC | 로그인 사용자 본인 데이터 | authenticated · service_role + **본문 본인 검사** |
| REVIEWER_RPC | 배정된 검수자 | authenticated · service_role + 본문 배정 검사 (DB 역할로는 구분 불가 — 본문이 지킨다) |
| ADMIN_RPC | 관리자 | authenticated · service_role + 본문 is_admin 검사 |
| SERVICE_ONLY | 배치 · 큐 · 유지보수 · 서비스 키 경로 | service_role 만 |

PostgreSQL 역할은 anon / authenticated / service_role 셋뿐이라 REVIEWER · ADMIN 은 **GRANT 로는 authenticated 와 같고 본문 검사가 실제 경계**다. 그래서 그 등급에서 본문 검사가 없으면 판정표에 「본문 수정」으로 적었다.

## 요약

| 등급 | 수 |
|---|---|
| PUBLIC_RPC | 22 |
| AUTH_SELF_RPC | 13 |
| REVIEWER_RPC | 2 |
| ADMIN_RPC | 6 |
| SERVICE_ONLY | 17 |

| 우선순위 | 기준 | 수 |
|---|---|---|
| P0 | SECURITY DEFINER + 쓰기 + PUBLIC/anon 실행 가능 | 1 |
| P1 | 본문 수정 필요(본인 · 관리자 검사 없음 등) | 16 |
| P2 | 권한 차이만 | 40 |
| — | 현재 = 목표 | 3 |

**GRANT 만으로 닫히지 않는 것(P1)**: `p_user_id` · `p_result_id` 를 받는 SECURITY DEFINER 학습자 함수들은 본인 검사가 없어 authenticated 로 좁혀도 **로그인 사용자가 남의 데이터를 읽고 쓴다**. 권한 마이그레이션과 별도로 본문 수정 마이그레이션이 필요하다 — 특히 `auto_promote_v_level_for_user` 는 지금 anon 도 실행 가능해 비로그인 누구나 임의 사용자의 V-Level 을 올릴 수 있다.

## 판정표

| 우선 | 함수 (OID) | 제안 등급 | 설계상 호출자 | 정의자/쓰기 | 학습자 데이터 | 부작용 | 현재 P/anon/auth/svc | 목표 | 차이 | 근거 | 본문 수정 | 확정 |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| P0 | `auto_promote_v_level_for_user(p_user_id uuid)` (34146) | AUTH_SELF_RPC | 학습자 본인(WordVault 허브) | DEFINER/읽기 | 예 | 없음(읽기) | Y/Y/Y/Y | n/n/Y/Y | PUBLIC Y→n · anon Y→n | VLevelPromotionCheck.tsx 브라우저 · 내부에서 update_user_v_level 로 레벨 쓰기 | 본인 검사 없음 + 지금 anon 도 실행 가능 — 비로그인 누구나 임의 user 레벨을 올릴 수 있다. p_user_id = auth.uid() 강제 | ☐ |
| P1 | `acp_article_rollup()` (453768) | ADMIN_RPC | 관리자 ACP 커버리지 화면 | DEFINER/읽기 | 아니오 | 없음(읽기) | n/Y/Y/Y | n/n/Y/Y | anon Y→n | admin-queries.ts(requireAdmin 뒤 · 사용자 세션 client 경로 있음). 발행분 집계 수치만 | 본문 is_admin 검사 없음 — 로그인 사용자 누구나 직접 RPC 로 부른다. 검사 추가 또는 SERVICE_ONLY 로 내림 | ☐ |
| P1 | `content_gate_publishable(p_scope text, p_id uuid)` (76070) | ADMIN_RPC | 발행 경로(관리자 세션 또는 서비스) | DEFINER/읽기 | 아니오 | 없음(읽기) | n/n/Y/Y | n/n/Y/Y | 없음 | publish_*_word_set(invoker) 하위 · 상위는 발행 트리거가 DML 주체 권한으로 부른다 — 관리자 세션 발행이 있으면 authenticated 필요 | 본문 is_admin 검사 없음 — 로그인 사용자 누구나 직접 RPC 로 부른다. 검사 추가 또는 SERVICE_ONLY 로 내림 | ☐ |
| P1 | `publish_article_word_set(p_article_id uuid, p_cap integer)` (48387) | ADMIN_RPC | 발행 트리거(DML 주체) | invoker/쓰기 | 아니오 | 쓰기: v_art, library_articles, v_set_id, shared_word_sets | Y/Y/Y/Y | n/n/Y/Y | PUBLIC Y→n · anon Y→n | trg_publish_article_word_set(invoker 트리거) 하위 — 관리자 세션 발행이면 authenticated 필요. invoker 라 RLS 가 쓰기를 거른다 | 본문 is_admin 검사 없음 — 로그인 사용자 누구나 직접 RPC 로 부른다. 검사 추가 또는 SERVICE_ONLY 로 내림 | ☐ |
| P1 | `publish_book_word_sets(p_book_id uuid, p_cap integer)` (48386) | ADMIN_RPC | 발행 트리거 | invoker/쓰기 | 아니오 | 쓰기: v_book, library_books, select_book_chapter_vocab, _sel | Y/Y/Y/Y | n/n/Y/Y | PUBLIC Y→n · anon Y→n | 같음 | 본문 is_admin 검사 없음 — 로그인 사용자 누구나 직접 RPC 로 부른다. 검사 추가 또는 SERVICE_ONLY 로 내림 | ☐ |
| P1 | `select_book_chapter_vocab(p_book_id uuid)` (44464) | ADMIN_RPC | 발행 경로 · 스크립트 | invoker/읽기 | 아니오 | 없음(읽기) | Y/Y/Y/Y | n/n/Y/Y | PUBLIC Y→n · anon Y→n | publish_book_word_sets(invoker) 하위 · scripts service · 사전 읽기만 | 본문 is_admin 검사 없음 — 로그인 사용자 누구나 직접 RPC 로 부른다. 검사 추가 또는 SERVICE_ONLY 로 내림 | ☐ |
| P1 | `analyze_and_apply_comprehensive_diagnostic_result(p_result_id uuid)` (34159) | AUTH_SELF_RPC | 진단을 마친 본인(/diagnostic 로그인 화면 브라우저) | DEFINER/쓰기 | 예 | 쓰기: v_user_id, user_diagnostic_results, resp, vrl_diagnostic_questions | n/n/Y/Y | n/n/Y/Y | 없음 | DiagnosticClient.tsx 브라우저 호출 | 본인 검사 없음 — 아무 로그인 사용자가 타인 p_result_id 로 남의 user_profiles 레벨을 덮을 수 있다. auth.uid() = 결과 소유자 검사 추가 | ☐ |
| P1 | `analyze_and_apply_diagnostic_result(p_result_id uuid)` (34110) | AUTH_SELF_RPC | 진단 본인 | DEFINER/쓰기 | 예 | 쓰기: v_est_level, analyze_diagnostic_result, user_diagnostic_results, v_snap_id | n/n/Y/Y | n/n/Y/Y | 없음 | DiagnosticClient.tsx | 같음 — 소유자 검사 추가 | ☐ |
| P1 | `analyze_and_apply_track_diagnostic_result(p_result_id uuid)` (34148) | AUTH_SELF_RPC | 진단 본인 | DEFINER/쓰기 | 예 | 쓰기: v_est_level, analyze_track_diagnostic_result, v_user_id, user_diagnostic_results | n/n/Y/Y | n/n/Y/Y | 없음 | DiagnosticClient.tsx | 같음 — 소유자 검사 추가 | ☐ |
| P1 | `extract_vocabulary_for_user(p_user_id uuid, p_words text[], p_level_strategy text)` (34177) | AUTH_SELF_RPC | 본인(읽기 화면 서버) | DEFINER/읽기 | 예 | 없음(읽기) | Y/Y/Y/Y | n/n/Y/Y | PUBLIC Y→n · anon Y→n | chapter-words-queries ← /text/[id] layout(사용자 세션) | p_user_id 임의 지정 가능 + anon 실행 가능 — 타인 레벨 · 단어장 정보를 읽는다. auth.uid() 로 고정 | ☐ |
| P1 | `extract_vocabulary_for_user_v2(p_user_id uuid, p_words text[], p_level_strategy text, p_limit integer)` (34273) | AUTH_SELF_RPC | 본인(추출 패널 브라우저) | DEFINER/읽기 | 예 | 없음(읽기) | Y/Y/Y/Y | n/n/Y/Y | PUBLIC Y→n · anon Y→n | ExtractionPanel.tsx | 같음 | ☐ |
| P1 | `recommend_word_sets_for_user(p_user_id uuid, p_interests text[])` (34144) | AUTH_SELF_RPC | 본인(/library/vocab · WordVault · 진단) | DEFINER/읽기 | 예 | 없음(읽기) | Y/Y/Y/Y | n/n/Y/Y | PUBLIC Y→n · anon Y→n | library/vocab page(사용자 세션 — /library 공개라 비로그인도 렌더) · hub-query | p_user_id 임의 + anon 실행 — 타인 레벨 기반 추천 노출. auth.uid() 고정, 비로그인은 앱이 부르지 않게 | ☐ |
| P1 | `record_pending_words(p_user_id uuid, p_lemmas text[], p_text_id uuid)` (34242) | AUTH_SELF_RPC | 본인(추출 패널) | DEFINER/쓰기 | 예 | 쓰기: pending_words, input, set, v_recorded | n/n/Y/Y | n/n/Y/Y | 없음 | ExtractionPanel.tsx 브라우저 | p_user_id 임의 지정 쓰기 — auth.uid() 고정 | ☐ |
| P1 | `refresh_user_known_word_count(p_user_id uuid)` (48490) | AUTH_SELF_RPC | 본인(SRS flush 서버 액션) | DEFINER/쓰기 | 예 | 쓰기: v_count, vocabularies, user_stats, set | n/n/Y/Y | n/n/Y/Y | 없음 | srs/flush-actions.ts 사용자 세션 | p_user_id 임의 지정 쓰기 — auth.uid() 고정 | ☐ |
| P1 | `select_book_comic_all(p_book_id uuid)` (116061) | PUBLIC_RPC | 비로그인 /comics 상세 | DEFINER/읽기 | 아니오 | 없음(읽기) | n/Y/Y/Y | n/Y/Y/Y | 없음 | comic/catalog.ts ← /comics/adapted/[bookId](공개) — 발행분 전 컷. 미리보기 5컷 하드캡과 충돌: 공개 화면이 전체를 받는지 확인 필요 | 공개 경로에서 전 컷 노출이 의도인지 확인 | ☐ |
| P1 | `csat_ec_submit_adjudication(p_round bigint, p_session uuid, p_item_no smallint, p_outcome text, p_primary text, p_contributing text[], p_excluded text[], p_note text)` (684125) | REVIEWER_RPC | 배정된 검수자 | DEFINER/읽기 | 아니오 | 없음(읽기) | n/n/Y/n | n/n/Y/Y | service_role n→Y | 8인자 구판 — 본문이 11인자판을 위임 호출(검수자 배정 검사는 11인자판) · 스모크 검수자 JWT | 구판 overload 유지 필요 여부 확인 — 쓰는 곳이 smoke.mjs 뿐이면 제거 후보 | ☐ |
| P1 | `csat_ec_submit_blind(p_round bigint, p_session uuid, p_item_no smallint, p_outcome text, p_primary text, p_contributing text[], p_excluded text[], p_note text)` (684119) | REVIEWER_RPC | 배정된 검수자 | DEFINER/읽기 | 아니오 | 없음(읽기) | n/n/Y/n | n/n/Y/Y | service_role n→Y | 8인자 구판 — 위와 같음 | 같음 | ☐ |
| P2 | `csat_ec_round_create(p_taxonomy text, p_quality_rule text, p_choice_trap_map text, p_eligibility jsonb, p_evidence_profile text)` (688722) | ADMIN_RPC | 관리자(검수 회차 생성) | DEFINER/쓰기 | 아니오 | 쓰기: csat_ec_review_round | n/n/Y/n | n/n/Y/Y | service_role n→Y | 5인자판은 4인자판(is_admin 검사)을 부른다 · 스모크는 관리자 JWT | — | ☐ |
| P2 | `get_comic_format(p_book_id uuid)` (116285) | AUTH_SELF_RPC | 로그인 학습자(/text/[id]/comic) | DEFINER/읽기 | 아니오 | 없음(읽기) | n/Y/Y/Y | n/n/Y/Y | anon Y→n | /text 는 로그인 필수 · 발행 만화 메타만 — 학습자 데이터 아님(AUTH 열람용) | — | ☐ |
| P2 | `select_book_comic(p_book_id uuid, p_chapter_idx integer)` (116034) | AUTH_SELF_RPC | 로그인 학습자(/text/[id]/comic) | DEFINER/읽기 | 아니오 | 없음(읽기) | n/Y/Y/Y | n/n/Y/Y | anon Y→n | /text 로그인 필수 | — | ☐ |
| P2 | `textfit_resolve_levels(p_words text[])` (179419) | AUTH_SELF_RPC | 로그인 학습자(추출 패널) | invoker/읽기 | 아니오 | 없음(읽기) | Y/Y/Y/Y | n/n/Y/Y | PUBLIC Y→n · anon Y→n | textfit/queries ← ExtractionPanel(/text 로그인) · 사전 읽기만 — PUBLIC 으로 둬도 데이터 위험 없음 | — | ☐ |
| P2 | `unresolved_dict_words(p_words text[])` (136307) | AUTH_SELF_RPC | 로그인 학습자 · 관리자 · 스크립트 | invoker/읽기 | 아니오 | 없음(읽기) | Y/Y/Y/Y | n/n/Y/Y | PUBLIC Y→n · anon Y→n | ExtractionPanel(로그인) · admin pending-words(사용자 세션 관리자) · scripts service · 사전 읽기만 | — | ☐ |
| P2 | `_extract_composite_score(p_frequency_rank integer, p_freq_in_unit integer, p_unit_max_freq integer, p_v_level smallint, p_verified boolean, p_example_en text, p_skill_level smallint, p_unit_v_level smallint)` (48388) | PUBLIC_RPC | 공개 어휘 조회의 하위 계산 | invoker/읽기 | 아니오 | 없음(읽기) | Y/Y/Y/Y | n/Y/Y/Y | PUBLIC Y→n | 부작용 없는 순수/사전 조회 보조 함수 — SECURITY INVOKER 상위(공개 조회 함수)가 호출자 권한으로 부르므로 상위와 같은 대상에 열려 있어야 한다 | — | ☐ |
| P2 | `calc_v_level(p_word text)` (30349) | PUBLIC_RPC | 사전 레벨 계산(공개 조회 하위 · 스크립트) | invoker/읽기 | 아니오 | 없음(읽기) | Y/Y/Y/Y | n/Y/Y/Y | PUBLIC Y→n | calc_skill_level(invoker, anon 실행) 하위 · 읽기 전용 | — | ☐ |
| P2 | `compute_frequency_tier(p_raw_count integer)` (29926) | PUBLIC_RPC | 트리거 하위 계산 | invoker/읽기 | 아니오 | 없음(읽기) | Y/Y/Y/Y | n/Y/Y/Y | PUBLIC Y→n | auto_compute_freq_fields(트리거, invoker) 하위 순수 함수 — 트리거는 DML 주체 권한으로 돈다 | — | ☐ |
| P2 | `compute_syntax_score(p_content text)` (49645) | PUBLIC_RPC | 구문 점수 하위 계산 | invoker/읽기 | 아니오 | 없음(읽기) | Y/Y/Y/Y | n/Y/Y/Y | PUBLIC Y→n | compute_article_syntax/compute_book_syntax 하위 순수 함수. 상위를 SERVICE 로 닫으면 이것도 SERVICE 로 내려도 된다(2단계) | — | ☐ |
| P2 | `effective_confidence(p_meta jsonb)` (30793) | PUBLIC_RPC | 복습 일정 계산 하위 | invoker/읽기 | 아니오 | 없음(읽기) | Y/Y/Y/Y | n/Y/Y/Y | PUBLIC Y→n | calculate_next_review_due(invoker) 하위 순수 함수 | — | ☐ |
| P2 | `en_inflection_bases(p text)` (34915) | PUBLIC_RPC | 사전 조회 하위 | invoker/읽기 | 아니오 | 없음(읽기) | Y/Y/Y/Y | n/Y/Y/Y | PUBLIC Y→n | lookup_word_meaning · resolve_dict_headword 등 공개 사전 조회(invoker) 하위 · 사전 읽기만 | — | ☐ |
| P2 | `infer_form_pos(p_surface text, p_base text)` (55572) | PUBLIC_RPC | 어휘 조회 하위 | invoker/읽기 | 아니오 | 없음(읽기) | Y/Y/Y/Y | n/Y/Y/Y | PUBLIC Y→n | select_*_vocab(invoker) 하위 순수 함수 | — | ☐ |
| P2 | `list_book_support_vocab(p_book_id uuid, p_limit integer)` (116886) | PUBLIC_RPC | 비로그인 /library 책 상세 | invoker/읽기 | 아니오 | 없음(읽기) | Y/Y/Y/Y | n/Y/Y/Y | PUBLIC Y→n | BookSupportVocabPanel(공개 책 상세) · 사전 해석 읽기만 | — | ☐ |
| P2 | `list_pd_comic_shelf()` (155001) | PUBLIC_RPC | 비로그인 /comics/restored | DEFINER/읽기 | 아니오 | 없음(읽기) | Y/Y/Y/Y | n/Y/Y/Y | PUBLIC Y→n | pd-comic/queries.ts | — | ☐ |
| P2 | `list_pd_comics(p_series_key text)` (155598) | PUBLIC_RPC | 비로그인 /comics · sitemap(anon 키) | DEFINER/읽기 | 아니오 | 없음(읽기) | Y/Y/Y/Y | n/Y/Y/Y | PUBLIC Y→n | pd-comic/queries.ts · seo/content-entries(anon) | — | ☐ |
| P2 | `lookup_word_meaning(p_surface text)` (99135) | PUBLIC_RPC | 비로그인 /library 책 읽기 · 만화 리더 | invoker/읽기 | 아니오 | 없음(읽기) | Y/Y/Y/Y | n/Y/Y/Y | PUBLIC Y→n | reader-queries ← /library/books/[bookId](공개) · ComicReader | — | ☐ |
| P2 | `resolve_dict_headword(p_surface text)` (55005) | PUBLIC_RPC | 사전 조회 하위 | invoker/읽기 | 아니오 | 없음(읽기) | Y/Y/Y/Y | n/Y/Y/Y | PUBLIC Y→n | select_*_vocab · unresolved_dict_words · textfit(공개/학습자 조회) 하위 · 읽기만 | — | ☐ |
| P2 | `select_pd_comic(p_slug text)` (116266) | PUBLIC_RPC | 비로그인 /comics/restored/[slug] | DEFINER/읽기 | 아니오 | 없음(읽기) | Y/Y/Y/Y | n/Y/Y/Y | PUBLIC Y→n | pd-comic/queries.ts | — | ☐ |
| P2 | `select_pd_comic_info(p_slug text)` (155003) | PUBLIC_RPC | 비로그인 정보 팝업 | DEFINER/읽기 | 아니오 | 없음(읽기) | Y/Y/Y/Y | n/Y/Y/Y | PUBLIC Y→n | api/comics/pd/[slug]/info(사용자 세션 · 공개 경로) | — | ☐ |
| P2 | `surface_variants(s text)` (94982) | PUBLIC_RPC | 사전 조회 하위 | invoker/읽기 | 아니오 | 없음(읽기) | Y/Y/Y/Y | n/Y/Y/Y | PUBLIC Y→n | lookup_word_meaning(공개) 하위 순수 함수 | — | ☐ |
| P2 | `textbook_curriculum_vocab_counts()` (166541) | PUBLIC_RPC | 비로그인 /library/textbooks | DEFINER/읽기 | 아니오 | 없음(읽기) | Y/Y/Y/Y | n/Y/Y/Y | PUBLIC Y→n | shelf-query.ts ← /library/textbooks(공개) · 개수만 | — | ☐ |
| P2 | `textbook_shelf_inventory()` (323866) | PUBLIC_RPC | 비로그인 /library/textbooks | DEFINER/읽기 | 아니오 | 없음(읽기) | Y/Y/Y/Y | n/Y/Y/Y | PUBLIC Y→n | 같음 · 개수만 | — | ☐ |
| P2 | `textbook_shelf_sources()` (323867) | PUBLIC_RPC | 비로그인 /library/textbooks | DEFINER/읽기 | 아니오 | 없음(읽기) | Y/Y/Y/Y | n/Y/Y/Y | PUBLIC Y→n | shelf-query.ts · 개수만 | — | ☐ |
| P2 | `acp_classify_license(p_license text)` (46747) | SERVICE_ONLY | 라이선스 게이트(서비스 배치) | invoker/읽기 | 아니오 | 없음(읽기) | Y/Y/Y/Y | n/n/n/Y | PUBLIC Y→n · anon Y→n · authenticated Y→n | acp_apply_license_gate(트리거/배치) 하위 · 순수 함수. 상위가 서비스 경로뿐 — 다만 상위가 트리거라 DML 주체가 authenticated 면 막힌다: 적용 전 library_articles 쓰기 주체 확인 | — | ☐ |
| P2 | `apply_topic_categories(p_source_id text, p_min_doc_freq integer, p_min_salience numeric, p_max_words integer, p_dry_run boolean)` (149292) | SERVICE_ONLY | 관리자 API 뒤 서비스 client | DEFINER/쓰기 | 아니오 | 쓰기: v_category, topic_corpus_sources, v_topic_word_salience, dictionary_word_categories | n/n/Y/Y | n/n/n/Y | authenticated Y→n | api/topic-corpus/promote: requireAdminApi → createTopicCorpusClient()=createAdminClient | — | ☐ |
| P2 | `auto_curate_book(p_book_id uuid)` (28989) | SERVICE_ONLY | LCP 처리 라우트(서비스 키) | DEFINER/쓰기 | 아니오 | 쓰기: v_book, library_books, v_lbv_count, library_book_vocabularies | n/n/Y/Y | n/n/n/Y | authenticated Y→n | api/lcp/process: serviceKey client | — | ☐ |
| P2 | `claim_topic_corpus_batch(p_source_id text, p_limit integer)` (149288) | SERVICE_ONLY | 관리자 API 뒤 서비스 client | DEFINER/쓰기 | 아니오 | 쓰기: topic_corpus_queue, skip, picked | n/n/Y/Y | n/n/n/Y | authenticated Y→n | topic-corpus/drain → createAdminClient | — | ☐ |
| P2 | `collect_archaic_candidates(p_book_id uuid)` (34696) | SERVICE_ONLY | LCP 처리(서비스 키) | DEFINER/쓰기 | 아니오 | 쓰기: library_book_vocabularies, shared_dictionary, archaic_candidates, unmatched | n/n/Y/Y | n/n/n/Y | authenticated Y→n | api/lcp/(dev-)process serviceKey | — | ☐ |
| P2 | `compute_article_syntax(p_article_id uuid)` (49658) | SERVICE_ONLY | ACP 처리(서비스 키 · 스크립트) | invoker/쓰기 | 아니오 | 쓰기: library_articles | Y/Y/Y/Y | n/n/n/Y | PUBLIC Y→n · anon Y→n · authenticated Y→n | api/acp/dev-process serviceKey · scripts/acp/* service · 상위 commit_article_analysis 는 이미 service 전용 | — | ☐ |
| P2 | `compute_article_vrl(p_article_id uuid)` (46737) | SERVICE_ONLY | ACP 처리 | invoker/쓰기 | 아니오 | 쓰기: v_total_lav, library_article_vocabularies, shared_dictionary, v_p50 | Y/Y/Y/Y | n/n/n/Y | PUBLIC Y→n · anon Y→n · authenticated Y→n | 같음 | — | ☐ |
| P2 | `compute_book_cefrj(p_book_id uuid)` (34314) | SERVICE_ONLY | 배치 | invoker/쓰기 | 아니오 | 쓰기: v_source, library_books, library_source_catalogs | Y/Y/Y/Y | n/n/n/Y | PUBLIC Y→n · anon Y→n · authenticated Y→n | 상위 bulk_compute_cefrj_for_all_sources(초안에서 service 전용) 만 부른다 | — | ☐ |
| P2 | `csat_source_inventory_live()` (611855) | SERVICE_ONLY | 관리자 화면 서버(서비스 client) | invoker/읽기 | 아니오 | 없음(읽기) | n/n/Y/Y | n/n/n/Y | authenticated Y→n | source-live.ts 는 admin/csat/sources page·route(service) 에서만 실행 · 브라우저는 타입 import 뿐 | — | ☐ |
| P2 | `csat_source_live_rollup()` (611854) | SERVICE_ONLY | 같음 | invoker/읽기 | 아니오 | 없음(읽기) | n/n/Y/Y | n/n/n/Y | authenticated Y→n | 같음 | — | ☐ |
| P2 | `csat_source_pipeline_live()` (611904) | SERVICE_ONLY | 같음 | invoker/읽기 | 아니오 | 없음(읽기) | n/n/Y/Y | n/n/n/Y | authenticated Y→n | 같음 | — | ☐ |
| P2 | `enqueue_topic_corpus_docs(p_source_id text, p_docs jsonb)` (149287) | SERVICE_ONLY | 관리자 API 뒤 서비스 client | DEFINER/쓰기 | 아니오 | 쓰기: topic_corpus_sources, topic_corpus_queue, src, v_inserted | n/n/Y/Y | n/n/n/Y | authenticated Y→n | topic-corpus/enqueue → createAdminClient | — | ☐ |
| P2 | `ingest_topic_corpus_doc(p_source_id text, p_external_id text, p_url text, p_content_hash text, p_counts jsonb, p_running_words integer, p_truncated integer, p_title text, p_speaker text, p_published_at timestamp with time zone, p_proper_nouns text[])` (156178) | SERVICE_ONLY | 서비스(코퍼스 수집) | DEFINER/쓰기 | 예 | 쓰기: topic_corpus_sources, v_doc_id, topic_corpus_docs, jsonb_each | n/n/Y/Y | n/n/n/Y | authenticated Y→n | harvest.ts · local-corpus.ts — 앱 내 importer 없음, 스크립트 service | — | ☐ |
| P2 | `pgmq_archive(p_queue_name text, p_msg_id bigint)` (28987) | SERVICE_ONLY | LCP 처리(서비스 키) | DEFINER/읽기 | 아니오 | 없음(읽기) | n/Y/Y/Y | n/n/n/Y | anon Y→n · authenticated Y→n | api/lcp/process serviceKey · 임의 큐 메시지 보관(삭제) 가능 — anon 실행 중 | — | ☐ |
| P2 | `release_topic_corpus_claim(p_id uuid, p_status text, p_error text)` (149289) | SERVICE_ONLY | 관리자 API 뒤 서비스 client | DEFINER/쓰기 | 아니오 | 쓰기: topic_corpus_queue | n/n/Y/Y | n/n/n/Y | authenticated Y→n | topic-corpus/drain → createAdminClient | — | ☐ |
| P2 | `store_content_chunk(p_content text)` (28795) | SERVICE_ONLY | 서비스(본문 저장) | DEFINER/쓰기 | 아니오 | 쓰기: content_chunks | n/n/Y/Y | n/n/n/Y | authenticated Y→n | 함수 주석이 「service_role 전용」 · 앱 importer 없음 | — | ☐ |
| P2 | `textbook_shelf_refreshed_at()` (323868) | SERVICE_ONLY | 서버(서비스) | DEFINER/읽기 | 아니오 | 없음(읽기) | Y/Y/Y/Y | n/n/n/Y | PUBLIC Y→n · anon Y→n · authenticated Y→n | csat/item-count ← textbook/freedom-load(service) 뿐 — 시각 하나라 노출 위험은 낮다 | — | ☐ |
| — | `list_book_comic_catalog()` (116035) | PUBLIC_RPC | 비로그인 /comics 카탈로그 | DEFINER/읽기 | 아니오 | 없음(읽기) | n/Y/Y/Y | n/Y/Y/Y | 없음 | comic/catalog.ts ← /comics/adapted(공개) | — | ☐ |
| — | `list_comic_catalog()` (116207) | PUBLIC_RPC | 비로그인 /comics | DEFINER/읽기 | 아니오 | 없음(읽기) | n/Y/Y/Y | n/Y/Y/Y | 없음 | comic/catalog.ts | — | ☐ |
| — | `preview_book_comic(p_book_id uuid, p_limit integer)` (116208) | PUBLIC_RPC | 비로그인 /comics 미리보기 | DEFINER/읽기 | 아니오 | 없음(읽기) | n/Y/Y/Y | n/Y/Y/Y | 없음 | 서버 하드캡 5컷 · 발행 게이트 | — | ☐ |

## 확정 전에 볼 것 (판정에 영향)

- **트리거 하위 함수**(`acp_classify_license` · `compute_frequency_tier` · `publish_*_word_set` · `content_gate_publishable`): 트리거는 그 행을 쓰는 역할의 권한으로 돈다. `library_articles` · `library_books` 를 관리자 **사용자 세션**으로 고치는 화면이 있으면 그 하위 함수는 authenticated 가 필요하다. 지금 판정은 그 가능성을 남겨 둔 쪽(ADMIN/PUBLIC)이다.
- **`select_book_comic_all`**: 공개 `/comics/adapted/[bookId]` 가 전 컷을 받는다 — 미리보기 함수의 5컷 하드캡과 정책이 충돌한다. 의도면 PUBLIC 유지, 아니면 SELF.
- **`recommend_word_sets_for_user`**: `/library/vocab` 는 공개 경로라 비로그인 렌더가 있다 — 앱이 비로그인일 때 이 RPC 를 부르지 않는지 확인해야 SELF 로 닫을 수 있다.
- **csat_ec 구판 overload 2개**(8인자 `submit_blind` · `submit_adjudication`): 호출자가 스모크뿐 — 유지할지 제거할지.
- 다음 게이트(사용자 지정 순서): 60 확정 · 미분류 0 → live 대비 intended diff → `review.mjs` 전체 → 권한 마이그레이션 + 롤백(PUBLIC 명시 회수 → 필요한 역할만 GRANT) → 격리 PG 권한 매트릭스 → 실제 Supabase anon/authenticated/service_role 스모크 계획.
