# DB Schema

> Supabase PostgreSQL — `project_id=jajenrevcbmrpaliomxv` (vocaflow-dev).
> 본 문서의 모든 테이블·view·function·migration 카운트는 **DB direct query** 로 검증된 사실. 작성 시점: 2026-06-08.

---

## 요약

- **테이블**: 77 (public schema · +CTP 3종 `reading_fluency_log`·`csat_stage_gates`·`csat_item_attempts` · +추출신뢰 `word_familiarity` · +어원 `word_roots`·`word_root_links` · +추출품질 `extraction_judgments`)
- **Views**: 7 (+`csat_stage_catalog` · +`word_mislevel_signal`)
- **Functions**: 273 (`admin_*` 18 / `auto_*` `compute_*` `collect_*` 9 / `vrl_*` `*diagnostic*` `*promote*` 10 / `quiz_*`·`*chapter_quiz*` 5 (v06.114) / 커버리지 `lookup_word_meaning`(폴백)·`select_book_chapter_coverage`·`select_article_coverage` (v06.271) / 추출해소 `resolve_dict_headword`·`infer_form_pos`·`set_word_familiarity` / 그 외 ~220)
- **Migrations 누적**: 72+ 적용됨 (CTP 데이터모델 3건 + 추출경로 통합/신뢰 8건 + 소스 4건 + 추출품질 2건 포함)

### 📖 커버리지 사전 wire-up — reader 폴백 + 참고 목록 (2026-07-19)

coverage_lexicon(비학습 롱테일)을 학습자에게 연결. **학습 파이프라인 무변경** — 전부 read-only 폴백/목록.

| 객체 | 종류 | 역할 |
|---|---|---|
| `lookup_word_meaning` | 함수(수정) | tier 6·7 추가 — core 5단계 실패 시 `coverage`(한국어)→`coverage_en`(영어 gloss). 반환에 `gloss_en` 컬럼. 굴절 surface도 coverage lemma 해소. migration `lookup_coverage_fallback` |
| `select_book_chapter_coverage`·`select_article_coverage` | 함수(신규) | 텍스트 토큰 ⋈ coverage_lexicon → 챕터/기사별 비학습 롱테일 목록. **고유명사=`first_sentence` 소문자 필터 제외**(P&P 45→19). SECURITY INVOKER(published RLS). migration `coverage_reference_lists` |
| `select_coverage_for_words` | 함수(신규) | 임의 토큰 배열(사용자 스크립트) ⋈ coverage_lexicon(굴절 en_inflection_bases 해소). 고유명사 필터는 클라(원문 소문자 출현). migration `coverage_for_words` |

FE: reader `📖 참고 단어` 토글 + `ChapterCoverageWords` 패널(i+1 학습과 분리) · `/text/new` `ExtractionPanel` `📖 독해 참고 단어` 접힘 섹션 · `WordLookupPopover` 영어 gloss 폴백 + "독해 참고용" 안내.

### 🎯 추출 품질 — 바인딩 수리 + 판정 하네스 (2026-07-18)

P0 심층 평가(`docs/AI_CONTEXT/diagnostics/ext_quality_p0_20260718.md`)로 발견·수리. **표제어 바인딩 결함**: `select_*_vocab` 가 pre-stem 된 `bv.lemma`(파생/부정접두 과잉 축약)를 바인딩 → 학습자에게 반대 뜻 노출(발행 782 오바인딩·36 반의어 플립).

| 객체 | 종류 | 역할 |
|---|---|---|
| `select_book_chapter_vocab`·`select_article_vocab` | 함수(수정) | JOIN 시 **표면형이 자체 quality 표제어이면 그것으로 바인딩**(아니면 `resolve_dict_headword` 폴백). 782/782 재바인딩·+143 회수. migration `fix_extraction_surface_headword_binding` |
| `extraction_judgments` | 테이블(RLS enabled) | Q3/Q5 판정 하네스 골든 라벨. blind in-cap/out-of-cap 판정 + composite/sort_order 스냅샷(가중 변경 회귀 대조). migration `create_extraction_judgments_table` · RLS 정책은 하네스 UI(D3) 착수 시 admin grant |

### 🎯 추출 신뢰 — 학습자 교정 계층 (2026-07-16, 2단계)

3 추출 경로(책 `select_book_chapter_vocab`·글 `select_article_vocab`·BYO `extract_vocabulary_for_user_v2`)를 공유 해소기 `resolve_dict_headword`(direct→cluster→규칙역굴절→파생strip) + `infer_form_pos`(형태→POS sense 선택)로 **통합**. 그 위에 학습자 교정:

| 객체 | 종류 | 역할 |
|---|---|---|
| `word_familiarity` | 테이블(RLS·PK user+lemma) | 학습자 알아요/몰라요 판정 — **lemma 단위**(형태 무관). verdict·판정당시 v_level |
| `set_word_familiarity` | RPC(DEFINER) | `auth.uid()` upsert. authenticated만 |
| `word_mislevel_signal` | VIEW | known_ct/unknown_ct ↔ dict_v_level → 과대/과소난이도 후보 집계 |
| `extract_vocabulary_for_user_v2` | 함수(수정) | `verdict='known'` 단어 추출 제외(BYO) |

### 🏛️ 어원(root) 축 (2026-07-17, migration `20260717140000`)

시중 어원 단어장 대응 + 파생어 인식. 공개 표준 어근(무저작권).

| 객체 | 종류 | 역할 |
|---|---|---|
| `word_roots` | 테이블(RLS 공개읽기) | 라틴/그리스 어근 인벤토리. origin·meaning_en·gloss_ko·variants. **181행 시드** |
| `word_root_links` | 테이블(RLS·PK word+root_id) | 단어↔어근 매핑(멱등·다중 root). affix_type·confidence. **2,767 링크** |
| `shared_word_sets` `etymology-core` | 발행 세트 | "어원으로 익히는 핵심 영단어" 1,500단어·159 어근 챕터(category `etymology` — first-class, migration `20260717150000`) |

> 생성 도구: `scripts/dict/roots-seed.mjs`(어근 시드) · `roots-map.mjs`(파생어 매핑) · `roots-publish-set.mjs`(세트 발행). curation_query `{org:'root'}` 문서화(RPC 실행축 확장은 후속).

### 🧭 CTP — CSAT Track Pipeline 데이터모델 (2026-07-10, migration 3건)

기존 4 파이프라인(LCP·ACP·VCB·VRL) 산출물의 **소비자** 계층. 근거: [ctp_p0_20260709.md](./AI_CONTEXT/diagnostics/ctp_p0_20260709.md).

| 객체 | 종류 | 역할 |
|---|---|---|
| `library_articles/books.syntax_score` | jsonb 컬럼 | ① 구문 난이도(문장 p90·절 깊이) — 자체 정규식 산출 |
| `csat_stage_catalog` | VIEW | ② stage_band(S1–S4) 파생 — article=register 우선, 도서 v7-9=S4. 139항목 |
| `quiz_questions.type` +`order`/`insert` · `+item_role` | CHECK·컬럼 | ③ DCP 결정론 문항(order/insert) + 역할(practice/verify) |
| `reading_fluency_log` | 테이블(RLS) | ④ 유효 WPM(comprehension_ok). ⚠ 기존 `reading_sessions`(읽기플랜)와 별개 |
| `csat_stage_gates` | 테이블 | ⑤ 게이트 임계(stage×metric · is_locked=false 권장값 9행) |
| `csat_item_attempts` | 테이블(RLS) | ⑦ per-item 응답 + error_cause(vocab/parsing/structure/inference/timing) |

> **학습자 stage 는 컬럼 저장 금지** — `csat_stage_gates` 전 지표 통과 최대 단계를 매 요청 실시간 파생(§9 R(t) 동형). stage_band(콘텐츠 메타)만 저장 OK.

### 🔒 RLS 보안 상태 (v06.117 — security advisor ERROR 0)

`public` 스키마 RLS 비활성 8 테이블(전부 anon SELECT+INSERT 권한 노출)을 하드닝. 마이그레이션 `20260703120000_p0_security_rls_hardening` + `20260703120010_p0_drop_p5a_backup_table`.

| 테이블 | 조치 | read 정책 |
|---|---|---|
| `vocaflow_levels`·`vocaflow_tracks`·`vocaflow_domains`·`vocaflow_skills` | RLS on | authenticated read (앱 DiagnosticClient·admin) |
| `vrl_data_integrity_concerns` | RLS on | admin 전용 read (`user_profiles.role='admin'`) |
| `noise_blacklist`·`english_irregular_forms` | RLS on, 정책 없음(락) | 클라이언트 직접 read 없음 — SECURITY DEFINER RPC·service_role bypass |
| `shared_dictionary_p5a_backup_20260620` | **DROP** | 추출 P1~P4 백업본 목적 종료 |

(`archaic_candidates` 는 기존 RLS on·정책 0 유지 — 서비스롤/DEFINER 경유 read.)

**v06.148 admin read 정책 4건** (`20260706010000_vrl_admin_read_policies`): `is_admin()` SECURITY DEFINER 헬퍼(자기참조 재귀 방지) 기반으로 `user_level_snapshots`·`user_profiles`·`user_diagnostic_results`·`vrl_diagnostic_tests`(비활성 포함)에 admin SELECT 추가 — `/admin/vrl/*` 하위 페이지 직접 read 정상화. 본인(own) 정책은 유지.

**v06.164 DEFINER 함수 EXECUTE 잠금** (`20260708120000` + `20260708120500`): 보안 advisor 후속 — anon 키 공개로 앱 인증 우회 호출 가능하던 무가드 SECURITY DEFINER 9종 잠금. 쓰기 3종(`enrich_shared_dictionary`·`regenerate_auto_curated_set`·`process_library_pipeline_batch`) → service_role 전용. admin 읽기 6종(`admin_vrl_*`) → anon 회수·authenticated 유지. ⚠️ 함수 EXECUTE 기본 PUBLIC grant라 `REVOKE FROM anon` 무효 → `REVOKE FROM PUBLIC` 필수.

## 도메인별 테이블 분류

각 테이블의 row count + size 는 검증 시점(2026-06-08) 기준 — 운영 중 변동.

### 1️⃣ 사용자·인증 (auth schema 별도)

| 테이블 | rows | size | 비고 |
|---|---:|---:|---|
| `user_profiles` | 2 | 56 kB | role · display_name · locale · theme · tts_voice · daily_word_goal · notify_* · current_v_level · current_track_levels |
| `user_stats` | 0 | 16 kB | mastery_level · total_words · current_streak · fsrs_target_retention · `known_word_count`(P0 · LingQ형 Implicit, stability≥21, flush→refresh_user_known_word_count) (Hub 진입 1쿼리 캐시) |
| `daily_activity` | 0 | 24 kB | (user_id, date) PK · total_minutes · total_words · total_reviews · by_module JSONB · avg_accuracy · **P0 자동 집계**(learning_records→총복습/모듈별 · scores→분/단어 트리거, KST date) |
| `achievements` | 0 | 24 kB | kind · module · value · metadata JSONB · achieved_at |
| `reports` | 0 | 24 kB | kind · subject · message · status · admin_note (admin /reports) |
| `study_plan_items` | 3 | — | **P1(재설계 2026-06-28)** 학습 계획 — material_type(**book/article/word_set/script**) · material_id(다형) · modules text[](활동 10종) · **chapters int[]**(도서 선택 챕터) · **weekdays int[]**(학습 요일 1=월..7=일, 빈=미정) · 본인 RLS 4정책 · updated_at 트리거. **다중 엔트리(2026-07-06 `UNIQUE` 제거)** — 한 자료가 여러 배치(요일×챕터)로 → 챕터=최하위 단위 일별 배치. (수능 `learning_goals` 폐기 / 전역 일정 `study_plan_schedule` 폐기 — 요일은 항목별) |
| `weekly_reports` | 0 | — | **P2** 주간 Report Card — week_start(월,KST) · total_minutes/words/reviews · by_module · empathetic_note(격려 코멘트) · UNIQUE(user_id,week_start) · 본인 RLS · daily_activity 주간 집계 |
| `classes` | 0 | — | **P4.1 L3 B2B 선반영**(화면 Phase 2) — teacher_id · name · invite_code UNIQUE · RLS(교사 전권 + 멤버 읽기) |
| `class_members` | 0 | — | **P4.1** class_id+user_id PK · role(student/assistant) · RLS(본인·교사 읽기, 본인 가입, 교사/본인 삭제) |
| `assignments` | 0 | — | **P4.1** class_id · kind(text/word_set) · ref_id · due_at · RLS(교사 전권 + 멤버 읽기). 순환 차단 헬퍼 `is_class_teacher`/`is_class_member`(SECURITY DEFINER) |

### 2️⃣ 학습 콘텐츠 (사용자 자산)

| 테이블 | rows | size | 비고 |
|---|---:|---:|---|
| `texts` | 238 | 256 kB | 사용자 스크립트 · `library_book_id` (curated) OR `user_book_group_id` (v06.34 신규) 그룹 식별 · CHECK 동시 사용 차단 |
| `vocabularies` | 5,896 | 2.4 MB | 사용자 단어장 (FSRS 6컬럼) · UNIQUE(user_id, word) · `lemma` REFERENCES `shared_dictionary(word)` |
| `learning_records` | 0 | 40 kB | 모든 모듈 공통 — rating SMALLINT 1-4 (FSRS) · is_correct · metadata JSONB |
| `scores` | 0 | 32 kB | 게임 결과 (Flashcard·SpellForge·WordBlitz·PairFlip·ScriptQuiz·Dictation) · metadata JSONB |
| `quiz_questions` | 5 | 24 kB | ScriptQuiz **개인** 문제 (per user+text · type · question/`question_ko`(A3.4b) · options JSONB(textKo) · correct_index · source_snippet) — A3.4 첫 콘텐츠 5문제(Ammachi Ch1) |
| `library_chapter_quiz` | 360 | — | **v06.114** ScriptQuiz **큐레이션 공유** 챕터 퀴즈 (키 library_book_id+chapter_idx+q_order UNIQUE · type · question/question_ko · options JSONB(textKo) · correct_index · source_snippet · book_v_level 스냅샷) · RLS admin-only, 학습자는 `select_book_chapter_quiz` RPC read · 6권 360문항(live-verified) |
| `book_quiz_jobs` | 0 | — | **v06.114** 퀴즈 생성 작업 큐 (book_id UNIQUE · status · book_v_level/target_per_chapter 스냅샷 · chapters_total/done · questions_created) · RLS admin-only · `enqueue_quiz_jobs` 적재 → Claude Code 드레인 갱신 |
| `dictation_sessions` | 0 | 24 kB | Dictation 세션 헤더 (config JSONB) |
| `dictation_items` | 0 | 24 kB | session_id · index · expected_text · user_input · result JSONB |
| `echo_match_sessions` | 2 | 48 kB | v06.33 — avg/best/worst 점수 · retried_sentence_ids TEXT[] |
| `echo_match_attempts` | 5 | 64 kB | 3축 점수 (intonation/stress/rhythm) · duration_ms · idx user_date |
| `reading_sessions` | 217 | 128 kB | LCP v2.0 — 사용자별 chapter 동적 분할 |
| `pending_words` | 0 | 80 kB | TextViewer → WordVault 인계 큐 |

### 3️⃣ 공용 단어장 / 사전 마스터

| 테이블 | rows | size | 비고 |
|---|---:|---:|---|
| `shared_dictionary` | **45,292** | **183 MB** | 영단어 마스터 캐시 — meaning_ko 100% (v06.24) · 11개 통합 컬럼 (Phase 1) · senses/primary_pos/pos_set/ipa_uk/us 100% (Phase 2) · `inflected_forms` text[] GIN (전역 권위화 굴절형 15,210 lemma · 규칙형 검증+권위 불규칙, noise 제거 · `scripts/dict/clean-inflected-forms.mjs` · NULL→규칙 fallback) · **kaikki 보완(v06.269): `homophones`·`rhyme_key`·`derived_forms`·`related_terms` 4컬럼(마이그 `add_kaikki_extra_columns`) + mnemonic_ko 5,062(어원·경선식0)** |
| `coverage_lexicon` | **408,098** | — | **독해 커버리지 참조 사전 (학습 core와 분리, v06.271)** — 도서·스크립트의 비학습 롱테일 단어 뜻 조회용. kaikki 단일어·content POS·form_of(굴절) 제외 벌크(굴절-of-코어 정리 후 408k). `word`(PK)·`pos`·`gloss_en`(즉시 폴백)·`ipa`·`meaning_ko`(**빈도순 77,501 완주**·미랭크 327k 대기)·`frequency_rank`·`source`·`seen_count`(승격 신호). RLS 공개읽기. 마이그 `create_coverage_lexicon`. **학습 로직(단어장·i+1·추천)은 조회 금지** — 오직 reader 폴백(`lookup_word_meaning` tier 6·7 `coverage`/`coverage_en`, 마이그 `lookup_coverage_fallback`). |
| `shared_words` | 13,437 | 46 MB | 공용 단어장 — `source_queue_id` FK to vocab_enrichment_queue (cast-2000 audit) · `source_sentence`(원문 출현 문장 · 도서 단어장 예문, 렌더는 source_sentence→example_en 폴백) · **`chapter` smallint**(세트 내 챕터 1..N, NULL=미분할 — 하나의 세트를 여러 챕터로 내부 구성, 챕터별 발행 아님. idx `set_id,chapter,sort_order`, 2026-07-09) |
| `shared_word_sets` | 277 | 2.8 MB | 단어장 헤더 — category(8 enum)+`category_id`/`additional_category_ids[]` (브릿지) · is_published · curation_query JSONB · **`subscriber_count`**(구독수 denormalized · `user_word_set_subscriptions` INSERT/DELETE 트리거 `trg_maintain_set_subscriber_count` 유지 · 사용빈도/인기 랭킹, RLS 본인전용 집계 회피, 2026-07-09) |
| `user_word_set_subscriptions` | 225 | 104 kB | 다중 구독 · source_book_id ref (자동 import 추적) |
| `dictionary_categories` | 566 | 288 kB | 3계층 카테고리 트리 (H1=18 / H2=76 / H3=472) · self-ref parent_id |
| `dictionary_word_categories` | 28,079 | 7.7 MB | 단어↔카테고리 M:N 매핑 |
| `lexicon_frequencies` | 6,305 | 1.7 MB | Phase 2 사이드카 — KICE+WM+EBS+NGSL+AWL+COCA 다중 출처 |
| `lexicon_source_tags` | 5,421 | 2.8 MB | source 태그 매핑 |
| `word_lexicon` | 5,421 | 1.7 MB | **FROZEN** since 20260520 — Phase E DROP 예정 |
| `word_frequency_stats` | 5,421 | 2.4 MB | 빈도 통계 (legacy) |
| `noise_blacklist` | 24,321 | 3.9 MB | VCB pipeline 필터 |
| `archaic_dictionary` | 810 | 272 kB | 고어 사전 |
| `archaic_candidates` | 32,427 | 9.5 MB | 미바인딩 고어 후보 — `first_seen_book_id` FK SET NULL (v06.34) |
| `english_irregular_forms` | 337 | 80 kB | 불규칙 변화형 |

### 4️⃣ 라이브러리 도서 (LCP — Library Curation Pipeline)

| 테이블 | rows | size | 비고 |
|---|---:|---:|---|
| `library_books` | 20 | 760 kB | 도서 마스터 — status 10 단계 · 4축 난이도 (book_v_level · cefr_band · cefrj_level · flesch_kincaid_grade) · `librivox_audio` JSONB · `cover_image_url` · `copyright_safe_in_kr` · `is_picture_book` (GENERATED · 삽화≥4+단어<5000 · judgeIPlusOne -7pp 보정) |
| `library_chapters_master` | 1,296 | 1.4 MB | chapter 정본 — `content_hash` ref content_chunks · paragraph_offsets · sentence_offsets · word_count · `group_label` · `source_href`(원본 챕터 deep-link, SE TOC 매핑 · NULL→도서 TOC fallback) · `chapter_v_level`(챕터별 어휘 V-level p75·V11 제외 · 1,295/1,296 · book_v_level 편차 노출 · migration `20260709145433`) |
| `content_chunks` | 1,174 | 13 MB | SHA-256 dedup 본문 저장 — PK=hash only · TOAST 대형 |
| `library_book_vocabularies` | 94,915 | 39 MB | chapter별 사전계산 단어 (v06.34 VACUUM FULL 후 233→39 MB) |
| `library_articles` | 4 | 104 kB | ACP — 짧은 글 · `license_class` / `register` / `lexical_noise` / `display_only` (ACP §18 게이트 · BEFORE INSERT/UPDATE 트리거 `acp_apply_license_gate` 자동 도출 · `trg_la_require_audio` = VOA 발행 시 `audio_url` 필수 게이트, 듣기 정체성) |
| `library_article_vocabularies` | 0 | 40 kB | article 단어 |
| `library_seed_catalog` | 1,843 | 4 MB | seed 후보 — `imported_book_id` FK ON DELETE SET NULL (소스 GET 복귀 핵심) · curation_meta JSONB |
| `library_source_catalogs` | 11 | 80 kB | 9 소스 (gutenberg / standard_ebooks / wikibooks / wikisource / librivox / openstax / open_library / hathitrust / simple_wikipedia) + manual + voa_learning · composite_score · S/A/B/C/M tier |
| `book_curation_jobs` | 1 | 136 kB | v06.34 — admin /curation dev 일괄 처리 큐 |

### 5️⃣ VCB (Vocabulary Curation Build) Pipeline

cast-2000 audit chain — 4 테이블 cascade:

| 테이블 | rows | size | 비고 |
|---|---:|---:|---|
| `vocab_runs` | 1 | 64 kB | run header (cast-2000) |
| `vocab_seed_candidates` | 2,000 | 576 kB | run FK CASCADE |
| `vocab_dict_hits` | 2,000 | 904 kB | seed FK CASCADE |
| `vocab_enrichment_queue` | 2,000 | 4.6 MB | seed FK CASCADE · `shared_words.source_queue_id` 가 역참조 (SET NULL) |
| `vocab_curation_decisions` | 2,000 | 344 kB | queue FK CASCADE |
| `vocab_sources` | 1 | 48 kB | source registry |
| `vocab_collections` | 1 | 64 kB | collection 그룹 |
| `vocab_raw_texts` | 0 | 32 kB | content_hash ref content_chunks |
| `frequency_data_sources` | 11 | 48 kB | 11 출처 메타 |

**발행 RPC** `vcb_publish_commit(p_run_id, p_slug, p_version, p_title, p_category, p_source_attributions jsonb, p_words jsonb, p_published_by)` — 세트→단어→컬렉션→`vocab_runs.status='published'` 를 단일 트랜잭션으로 원자 발행(실패 시 전량 롤백, orphan 불가). `SECURITY DEFINER` · `search_path=public` · 실행권한 `service_role` 한정. (P0-7 트랜잭션화)

### 6️⃣ VRL (Vocabulary Reading Level) 분류 시스템

| 테이블 | rows | size | 비고 |
|---|---:|---:|---|
| `vocaflow_levels` | 12 | 64 kB | V-Level 0-11 |
| `vocaflow_tracks` | 6 | 32 kB | 영역 중립 트랙 ID |
| `vocaflow_domains` | 8 | 32 kB | 도메인 |
| `vocaflow_skills` | 5 | 32 kB | 스킬 |
| `vrl_diagnostic_tests` | 5 | 32 kB | base + csat + business + academic + comprehensive |
| `vrl_diagnostic_questions` | 185 | 64 kB | 40 base + 31 csat + 32 biz + 32 acad + 50 comprehensive |
| `vrl_data_integrity_concerns` | 82 | 120 kB | 분류 정합 의심 row |
| `user_diagnostic_results` | 6 | 56 kB | 진단 결과 |
| `user_level_progress` | 0 | 32 kB | 학습 진행 |
| `user_level_snapshots` | 5 | 96 kB | audit chain — taken_reason · snapshot_type · snapshot_meta JSONB |

---

## Views (5)

| view | 용도 |
|---|---|
| `v_text_content` | `texts` + `library_chapters_master` + `content_chunks` JOIN — 워크스페이스 본문 fetch (v06.34: `user_book_group_id` 컬럼 추가) |
| `v_book_extraction_stats` | 도서별 추출 어휘 / lemma bound/unbound / coverage % 집계 |
| `v_user_book_progress` | 사용자별 도서 진행도 |
| `library_seed_catalog_view` | seed catalog UI 용 가공 |
| `user_vocab_enriched` | 사용자 단어장 + 사전 메타 enriched |

**보안 옵션 (v06.47)**: 5 view 모두 `SECURITY INVOKER` (`ALTER VIEW ... SET (security_invoker = true)`) — 호출자 권한으로 기반 테이블 RLS 적용. SECURITY DEFINER (PG15 default) 의 RLS 우회 위험 차단. Supabase advisor "Security Definer View" 경고 해결 migration `20260614150000_views_security_invoker`.

---

## Functions (요약)

222 함수. 카테고리별:

### admin_* (18)

| 함수 | 시그니처 | 용도 |
|---|---|---|
| `admin_enqueue_book(source, source_id, title, ...)` | RETURNS uuid | BulkFetch / ID 입력으로 도서 큐 등록 |
| `admin_requeue_book(p_book_id uuid)` | RETURNS text | 단일 도서 → queued + pgmq |
| `admin_bulk_set_books_curating(uuid[])` | RETURNS (updated, skipped, sets_deleted, blocked_users, blocked_published) | ready → curating, draft 단어장만 삭제 |
| `admin_bulk_requeue_books(uuid[])` | RETURNS (deleted, skipped, sets_deleted, **seed_unlocked**, blocked_users, blocked_published) | (ready ∪ in_progress) → DELETE library_books (소스 GET 복귀) — v06.34 시맨틱 |
| `admin_delete_book(p_book_id uuid)` | RETURNS table | 실패 도서 영구 삭제 (제한 status) |
| `admin_force_publish_book(p_book_id uuid)` | RETURNS void | cefr_confidence 낮아도 강제 publish |
| `admin_revert_published_book` | — | published 되돌리기 |
| `admin_requeue_article` | — | ACP article requeue |
| `unenroll_library_book(p_book_id uuid)` | RETURNS (texts_deleted, subs_deleted, vocabs_deleted) | 사용자 enroll 해제 (도서 단위 unenroll) |
| 나머지 | … | (admin_bulk_* / admin_pending_* / admin_concerns_* / VRL 분류 등) |

### Pipeline RPC

| 함수 | 용도 |
|---|---|
| `process_library_pipeline_batch(p_batch_size int)` | pg_cron worker — pgmq read N → POST /api/lcp/process (dev 환경에선 `get_lcp_config()` NULL → early return 0) |
| `archive_book_pipeline_messages(p_book_id uuid)` | dev-process 후 pgmq archive |
| `auto_curate_book(p_book_id uuid)` | RETURNS 'auto_publish' / 'admin_review' / 'reject' — cefr_confidence 게이트 (0.85 / 0.60) |
| `compute_book_vrl(p_book_id uuid)` | V-Level type-based p75 centroid (v06.34: token → type) |
| `compute_book_cefrj(p_book_id uuid)` | CEFR-J 12-band (internal heuristic) + cefr_band auto |
| `compute_book_coverage(p_book_id uuid)` | 레벨별 기지어 커버리지 (i+1 판정) |
| `backfill_book_lemmas(p_book_id uuid)` | direct-bind / 추출 / percentile 정상화 게이트 |
| `collect_archaic_candidates(p_book_id uuid)` | 미바인딩 단어를 archaic_candidates 로 수집 |
| `classify_archaic_candidates()` | 재출현 게이트 — derivational / inflection / variant 분류 |

### VRL RPC

| 함수 | 용도 |
|---|---|
| `analyze_diagnostic_result` / `analyze_and_apply_diagnostic_result` | base V-Level 진단 분석 + apply (snapshot + Krashen i+1) |
| `analyze_track_diagnostic_result` / `analyze_and_apply_track_diagnostic_result` | track 진단 (csat/biz/academic) |
| `analyze_and_apply_comprehensive_diagnostic_result` | 4축 동시 분석 (base + 3 tracks) |
| `recommend_word_sets_for_user(uuid, text[])` | 6-tier 추천 (primary/stretch/review + track + specialty + book_iplus1: lexical_coverage 85~95% 도서 입문 챕터 세트, v06.129) |
| `auto_promote_v_level_for_user(uuid)` | i+1 zone ≥20 mastered → V+1 |
| `auto_promote_track_level_for_user(uuid, text)` | track promote (threshold 15) |
| `cron_auto_promote_all_users()` | pg_cron 새벽 03 KST 일괄 promote |

### Workflow / RLS Helper

| 함수 | 용도 |
|---|---|
| `is_admin_or_curator()` | RLS / SECURITY DEFINER 게이트 |
| `get_lcp_config()` | vercel_base_url + internal_token (dev 환경에선 NULL) |
| `enroll_library_book(p_book_id uuid)` | 사용자 enroll + 챕터 단어장 auto-subscribe + vocabulary auto-import |
| `extract_vocabulary_for_user(uuid, text[], text)` | Phase 3A 다축 추출 — user/text/auto level 선택 + composite scoring |
| `publish_book_word_sets(p_book_id uuid)` | 챕터 단어장 일괄 발행 trigger |

---

## Critical FK & Cascade 정합

도서 큐레이션 사이클의 핵심 cascade:

```
library_books (DELETE)
  ├─→ library_book_vocabularies (CASCADE)
  ├─→ library_chapters_master (CASCADE)
  ├─→ library_seed_catalog.imported_book_id (SET NULL — seed unlock!)
  ├─→ user_word_set_subscriptions.source_book_id (SET NULL)
  ├─→ echo_match_sessions.library_book_id (SET NULL)
  ├─→ archaic_candidates.first_seen_book_id (SET NULL — v06.34)
  └─→ texts.library_book_id (NO ACTION — RPC 안전 가드로 차단)

shared_word_sets (DELETE)
  ├─→ shared_words (CASCADE)
  └─→ user_word_set_subscriptions (CASCADE)

vocab_runs (DELETE)
  └─→ vocab_seed_candidates (CASCADE)
       ├─→ vocab_dict_hits (CASCADE)
       └─→ vocab_enrichment_queue (CASCADE)
            ├─→ vocab_curation_decisions (CASCADE)
            └─→ shared_words.source_queue_id (SET NULL — cast-2000 lineage)
```

---

## ENUM / CHECK constraints (선별)

```sql
-- module_id ENUM (학습 모듈 9 + 베타)
CREATE TYPE module_id AS ENUM (
  'flashcard','spellforge','wordblitz','pairflip',
  'scriptquiz','dictation','wordvault','workspace','textviewer',
  'pirate-quest'
);

-- text_source ENUM
CREATE TYPE text_source AS ENUM ('library','direct-script','direct-file','shared-set');

-- library_books.status TEXT CHECK
'queued','ingesting','normalizing','segmenting','analyzing','curating',
'ready','published','archived','failed',
-- + 세분화 실패: fetch_failed / preview_failed / ingest_failed / enrich_failed

-- texts.user_book_group_id mutual exclusive (v06.34)
CONSTRAINT texts_book_group_exclusive
  CHECK (library_book_id IS NULL OR user_book_group_id IS NULL);

-- texts.cefr_level (A1-C2)
-- vocabularies.difficulty REAL CHECK BETWEEN 1.0 AND 10.0
-- learning_records.rating SMALLINT CHECK BETWEEN 1 AND 4 (FSRS)
-- user_profiles.role text DEFAULT 'user' (admin / curator / user)
-- user_profiles.theme TEXT CHECK ('light','dark','system')
-- user_profiles.locale TEXT CHECK ('ko','en')
-- shared_word_sets.category TEXT CHECK (8 enum)
-- vrl_diagnostic_tests.test_type TEXT (base_v_level / track / comprehensive)
```

---

## RLS 정책 요약

모든 사용자 데이터 테이블 (`texts`, `vocabularies`, `learning_records`, `scores`, `dictation_*`, `echo_match_*`, `user_*`, `achievements`, `daily_activity`, `user_word_set_subscriptions`):

```sql
CREATE POLICY "own data" ON {table}
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
```

공용 자원 (`shared_word_sets`, `shared_words`, `shared_dictionary`, `dictionary_*`, `library_*`, `vocaflow_*`):
- 모든 인증 사용자 SELECT 가능
- INSERT/UPDATE/DELETE 는 admin/curator 만 (SECURITY DEFINER RPC + `is_admin_or_curator()`)

`reports`: 본인 INSERT/SELECT, admin UPDATE.

---

## 최근 마이그레이션 (20개)

```
20260608222931  v_text_content_user_book_group_v2          ← v06.34
20260608222229  texts_user_book_group_id
20260608221508  book_curation_jobs
20260607014233  improve_library_seed_dedup_key_first_author_surname
20260607010118  archaic_candidates_first_seen_book_set_null
20260607005258  admin_bulk_return_to_source                ← DELETE 시맨틱
20260606231723  admin_bulk_book_rollback_cascade
20260606225815  admin_bulk_book_status
20260606142006  add_library_books_cover_image_url
20260606140316  unenroll_library_book
20260606020213  unify_book_vocab_selection
20260606003450  drop_unused_indexes
20260605235722  add_library_books_librivox_audio
20260605234511  reattach_publish_book_word_sets_trigger
20260605154321  enroll_book_auto_subscribe_word_sets
20260604221512  copyright_gate_us_license
20260604142316  add_simple_wikipedia_source
20260603154813  drop_unused_and_duplicate_indexes_v06_34
20260603145827  extract_book_vocab_cache_fastpath
20260603143502  find_unbound_perf_prefilter
```

전체 누적 115건 (파일 기준 실측 2026-06-28). 디렉토리: `supabase/migrations/`. (최신: `20260628220000_p1_plan_weekday_per_item` — study_plan_items weekdays int[] 추가 + study_plan_schedule DROP(요일을 항목별로·시간 제거) · 직전: `20260628210000_p1_plan_rich_compose`)

v06.140 이후 추가: `20260706000000_admin_collect_quality_metrics` — `admin_collect_quality_metrics()` RPC(SECURITY DEFINER, role='admin' 검사 후 `collect_quality_metrics()` 위임, EXECUTE→authenticated). `/admin/quality` 수동 수집 버튼용.

---

## DB 사이즈 현황 (v06.34 VACUUM FULL 후, 2026-06-08)

| 카테고리 | 사용 | 비고 |
|---|---:|---|
| 전체 DB | **350 MB** | (이전 606 MB → 42% 감소) |
| shared_dictionary | 183 MB | 마스터 사전 (45,292 row · 100% meaning_ko) |
| shared_words | 46 MB | 공용 단어장 |
| library_book_vocabularies | 39 MB | VACUUM FULL 후 (233→39) |
| content_chunks | 13 MB | (58→13) — orphan 정리 + TOAST |
| archaic_candidates | 9.5 MB | (21→9.5) |
| dictionary_word_categories | 7.7 MB | M:N 28k 매핑 |

---

## 검증 방법

본 문서의 사실은 다음 SQL 로 재현 가능 (Supabase MCP `execute_sql`):

```sql
-- 테이블 + row + size
SELECT c.relname, s.n_live_tup, pg_size_pretty(pg_total_relation_size(c.oid))
FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
LEFT JOIN pg_stat_user_tables s ON s.relid=c.oid
WHERE c.relkind='r' AND n.nspname='public' ORDER BY c.relname;

-- 함수 카운트
SELECT COUNT(*) FROM pg_proc p JOIN pg_namespace n ON n.oid=p.pronamespace
WHERE n.nspname='public';

-- 마이그레이션 이력
SELECT version, name FROM supabase_migrations.schema_migrations
ORDER BY version DESC LIMIT 20;
```
