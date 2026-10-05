# 함수 EXECUTE 권한 감사 — 2026-10-05

> 계기: Reveal Gate ① 적용 뒤 canary 가 anon 으로 `csat_source_snapshot_take` 를 실행해 1행을 만들었다(기록 `scripts/csat/reveal-gate/canary-incidents.md`).
> 범위: 조사만. **권한은 고치지 않았다.** 수정 SQL 은 `scripts/db/drafts/` 의 초안이며 승인 전 적용하지 않는다.
> 근거는 전부 이날 DB 실측(pg_proc · has_function_privilege · information_schema.routine_privileges · pg_default_acl) + PostgREST 실제 호출.

## A. 함수 identity

| 항목 | 값 |
|---|---|
| 함수 | `public.csat_source_snapshot_take(p_by text)` — overload 없음 |
| OID | 470657 |
| owner | postgres |
| SECURITY DEFINER | 예 |
| proconfig | `search_path=public`, `statement_timeout=60000` |
| 쓰기 | `csat_source_snapshots` INSERT + 60행 초과분 DELETE |

## B. 권한(실측)

| actor | has_function_privilege | 경로 |
|---|---|---|
| PUBLIC | 아니오 | proacl 에 `=X` 없음 — 마이그레이션의 `revoke all ... from public` 은 들었다 |
| anon | **예** | proacl `anon=X/postgres` **직접 GRANT** |
| authenticated | **예** | proacl `authenticated=X/postgres` 직접 GRANT |
| service_role | 예 | 직접 GRANT(의도) |

proacl: `{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}` — routine_privileges 도 같은 네 행.

## C. privilege chain — PUBLIC 이 아니다

1. 함수 생성(2026-09-06 `20260906200000_csat_source_console.sql`) 당시 `pg_default_acl(postgres, public, 'f')` = `{postgres=X, anon=X, authenticated=X, service_role=X}` — Supabase 의 스키마별 기본 권한이 **새 함수마다 anon · authenticated 에 EXECUTE 를 명시 GRANT** 했다.
2. 마이그레이션은 `revoke all ... from public` + `grant ... to service_role` 만 했다. PUBLIC 회수는 anon 의 **직접** GRANT 를 지우지 않는다 → anon 실행 가능.
3. 2026-09-19 `20260919231528`(스키마 기본값에서 anon 회수) · `20260919232557`(전역 PUBLIC 회수)이 원인을 막았지만 **기본 ACL 은 이후 CREATE 되는 함수에만 적용**된다. 기존 함수는 소급 회수하지 않았다.
4. 같은 날 만든 가드 `scripts/db/check-anon-rpc-grants.mjs` 는 당시 anon 실행 가능 definer 함수 84개를 **기준선으로 고정**했다(`anon-executable-functions.json`, 이 함수 포함). 그래서 이후 감사가 이 상태를 「정상」으로 통과시켰다.
5. 지금 기본 ACL 은 `{postgres=X, authenticated=X, service_role=X}` — **authenticated 는 여전히 새 함수마다 자동 GRANT** 된다(아래 E 의 두 번째 표가 그 결과).

`csat_coverage` 는 다른 경로다: 2026-09-02 생성 · 전역 기본값의 `PUBLIC=X` + anon 직접 GRANT 둘 다 남아 있다.

## D. 생긴 시점

- anon 직접 GRANT: 2026-09-06 함수 생성 순간(`20260906200000`). 이 파일 이후 이 함수에 GRANT/REVOKE/ALTER/OWNER 를 바꾼 마이그레이션은 없다.
- 회수 기회: 2026-09-19 기본 권한 조치 — 신규만 막고 기존 84(현재 anon 실행 가능 157 중 definer 다수)는 기준선으로 남겼다.

## E. 전수 결과 (public · 확장 소유 제외 · 2026-10-05)

| 지표 | 수 |
|---|---|
| anon 또는 authenticated 가 실행 가능한 함수 | 276 |
| anon 실행 가능 | 157 (전부 anon 직접 GRANT · 그중 121 은 PUBLIC 도) |
| authenticated 실행 가능 | 276 (전부) |
| 분류 — intended_public / authenticated_only / admin_only / service_only / trigger_only | 2 / 83 / 30 / 132 / 29 |
| unexpected_public_execute(anon, 의도 공개 · 트리거 제외) | 127 |
| 그중 definer + 쓰기 | 17 |
| 서비스 전용인데 authenticated 실행 가능 | 132 |
| 그중 definer + 쓰기 + 본문 권한 검사 없음 | 24 (1개 오탐: `csat_ec_round_create` 5인자판은 4인자판의 `is_admin` 을 탄다) |

분류 방법: 앱 · 스크립트 · edge 함수의 `.rpc('이름')` 호출부를 client 종류로 나눴다(브라우저 · 사용자 세션 서버 · service · 스크립트). 학습자 경로 호출이 없으면 service_only, 호출이 모두 admin 영역이면 admin_only. 변수 이름 호출 4곳(`api/lcp/*process` · `scripts/lcp/*`)은 모두 service key 라 분류에 영향 없다. 직접 `createClient(url, serviceKey)` 를 쓰는 서버 파일은 user_server 로 잡혀 **보수적으로**(권한을 더 남기는 쪽) 분류된다.

**가장 무거운 것**: 로그인한 아무 학습자가 `insert_book_analysis(아무 book_id, …)` 를 부르면 그 책의 `library_chapters_master` · `library_book_vocabularies` 를 지운다 — 읽기 전용 트랜잭션에서 `set local role authenticated` 로 실행해 본문 DELETE 에 도달함을 확인했다(25006 에서 멈춤, 데이터 무변경). 같은 계열: `purge_ghost_vocab` · `video_job_restart` · `update_user_v_level`(타인 레벨) · `acp_claim_compose_jobs` 등.

## F. PostgREST 실제 호출 (anon 키 · GET = 읽기 전용 트랜잭션, 데이터 무변경)

| RPC | HTTP | code | 뜻 |
|---|---|---|---|
| `csat_source_snapshot_take` | 405 | 25006 | **권한 통과** — 읽기 전용이라 INSERT 에서 멈춤 |
| `csat_coverage` | 200 | — | 실행됨(읽기) |
| `insert_book_analysis` | 401 | 42501 | anon 권한 없음(DB 와 일치) |
| `video_job_restart` | 401 | 42501 | anon 권한 없음(DB 와 일치) |

- OpenAPI(`/rest/v1/`)는 anon 에게 401 — 목록으로는 숨겨져 있지만 **호출은 열려 있다**. 목록 비노출을 보호로 세면 안 된다.
- authenticated 는 임시 계정을 만들지 않고 DB 안에서 역할 전환으로 확인했다(E 참조). API 경로도 같은 역할 권한을 쓰므로 결과가 같다.
- 실제 데이터 영향: 확인 후 snapshot 새 행 0(총 60). API 로그(보존 24시간)에서 위 쓰기 함수 호출은 canary 1회(POST 200 — incident 의 그 행)와 이번 탐침뿐. 24시간보다 오래된 남용은 로그가 없어 **배제할 수 없다**(가입자 4명).

## G. 수정안 (초안 · 미적용)

- `scripts/db/drafts/function-execute-revoke.draft.sql` — 한 트랜잭션:
  1. 서비스 전용 · 트리거 140개: `revoke execute ... from public, anon, authenticated` + `grant ... to service_role`. 정책 · 뷰 · 기본값이 부르는 함수는 이 묶음에서 빠진다. 트리거 함수의 EXECUTE 는 CREATE TRIGGER 때만 검사되므로 발화에는 영향이 없다. cron · definer 내부 호출은 소유자로 돈다.
  2. 학습자 · 관리자 77개(본문이 `auth.uid()`/`is_admin` 을 요구하거나 정책/뷰 의존): `from public, anon` 만 회수 + `authenticated, service_role` 명시 GRANT.
  3. `alter default privileges in schema public revoke execute on functions from authenticated` — 신규 함수가 다시 열리는 경로를 닫는다. 이후 학습자 RPC 는 GRANT 를 명시해야 한다.
- 217 시그니처 모두 `to_regprocedure` 로 실재 확인.
- 정확 복원: `function-execute-revoke.rollback.sql`(지금의 PUBLIC/anon/authenticated 직접 GRANT 를 그대로 되살림 + 기본 ACL 복원).
- **초안에서 뺀 57개(review)** — 사람이 확정해야 한다: 42개는 학습자 경로에서 부르는데 본문 검사가 없어 비로그인 공개 화면(카탈로그 · 만화 서가 등)이 anon 으로 부르는지 라우트별 확인 필요, 15개는 서비스 전용이지만 SECURITY INVOKER 함수가 부른다(그 invoker 함수의 호출자 권한을 따라가야 한다). 아래 표.
- 적용 전 필수: 앱 e2e 스모크(비로그인 공개 화면 · 학습자 · 관리자) — 회수가 정상 화면을 조용히 막는 방향의 실패(42501)를 잡는다.

## H. 회귀 가드 설계

- 매니페스트 `scripts/db/function-exec-manifest.json`(초안 `scripts/db/drafts/function-exec-manifest.draft.json`) — public 함수마다 `class` ∈ {intended_public, authenticated_only, admin_only, service_only, trigger_only}.
- 검사기(기존 `check-anon-rpc-grants.mjs` 를 대체/확장): pg_proc 전수를 읽어
  - 매니페스트에 없는 함수 → **실패**(기본 거부 — Reveal Gate 표면 검사기와 같은 원칙). 새 함수는 사람이 분류를 적어야 통과.
  - 클래스별 기대 권한: service_only/trigger_only = PUBLIC·anon·authenticated false, service_role true · authenticated_only/admin_only = PUBLIC·anon false, authenticated true · intended_public = anon true.
  - 낡은 항목(매니페스트엔 있는데 DB 에 없음) → 실패.
  - 기준선을 「현재 상태」로 올리는 `--update` 는 두지 않는다 — 2026-09-20 가드가 84개 결함을 기준선으로 굳힌 것이 이번 원인 4번이다. 클래스는 사람이 고친다.
- 보조: service_only 함수가 앱 학습자 경로(`lib/supabase/client|server`)에서 `.rpc()` 로 불리면 정적 검사 실패.
- canary 쪽: `csat_source_snapshot_take` 계약을 manifest 에서 `none` 으로 유지(이미 반영) — 쓰기 함수는 탐침하지 않는다.

## 함수 목록

### anon 실행 가능 · definer · 쓰기 — 예상 밖 (17)

| 함수 | 분류 | definer | 쓰기 | anon | 본문 검사 | 조치 |
|---|---|---|---|---|---|---|
| `commit_chapter_vocab(p_book_id uuid, p_chapter_idx integer)` | authenticated_only | Y | Y | Y | uid | revoke_public_anon |
| `csat_source_snapshot_take(p_by text)` | service_only | Y | Y | Y | — | revoke_public_anon_authenticated |
| `enqueue_comic_jobs(p_book_ids uuid[])` | authenticated_only | Y | Y | Y | admin | revoke_public_anon |
| `enqueue_curation_jobs(p_book_ids uuid[])` | service_only | Y | Y | Y | admin | revoke_public_anon_authenticated |
| `enqueue_quiz_jobs(p_book_ids uuid[])` | authenticated_only | Y | Y | Y | admin | revoke_public_anon |
| `enqueue_review_jobs(p_book_ids uuid[], p_task_type text)` | authenticated_only | Y | Y | Y (PUBLIC) | admin | revoke_public_anon |
| `enroll_library_book(p_book_id uuid)` | authenticated_only | Y | Y | Y | uid | revoke_public_anon |
| `grade_dcp_item(p_item_id uuid, p_answer jsonb)` | authenticated_only | Y | Y | Y (PUBLIC) | uid | revoke_public_anon |
| `join_class_by_code(p_code text)` | authenticated_only | Y | Y | Y (PUBLIC) | uid | revoke_public_anon |
| `prescribe_today(p_user_id uuid, p_v_levels integer[])` | authenticated_only | Y | Y | Y (PUBLIC) | admin | revoke_public_anon |
| `save_comic_progress(p_book_id uuid, p_last_index integer, p_total integer, p_completed boolean)` | authenticated_only | Y | Y | Y | uid | revoke_public_anon |
| `set_word_familiarity(p_lemma text, p_verdict text, p_v_level smallint)` | authenticated_only | Y | Y | Y | uid | revoke_public_anon |
| `subscribe_article_word_set(p_article_id uuid)` | authenticated_only | Y | Y | Y (PUBLIC) | uid | revoke_public_anon |
| `sync_published_set_examples(p_set_id uuid)` | service_only | Y | Y | Y (PUBLIC) | admin | revoke_public_anon_authenticated |
| `textbook_practice_items(p_v_level smallint, p_limit integer)` | authenticated_only | Y | Y | Y | uid | revoke_public_anon |
| `unenroll_library_book(p_book_id uuid)` | authenticated_only | Y | Y | Y | uid | revoke_public_anon |
| `update_pending_word_status(p_id uuid, p_status text, p_admin_note text)` | admin_only | Y | Y | Y (PUBLIC) | uid | revoke_public_anon |

### authenticated 실행 가능 · 서비스 전용 · definer · 쓰기 · 본문 검사 없음 (24)

| 함수 | 분류 | definer | 쓰기 | anon | 본문 검사 | 조치 |
|---|---|---|---|---|---|---|
| `acp_claim_compose_jobs(p_worker text, p_limit integer, p_stale_minutes integer)` | service_only | Y | Y |  | — | revoke_public_anon_authenticated |
| `acp_prune_compose_candidates(p_days integer)` | service_only | Y | Y |  | — | revoke_public_anon_authenticated |
| `apply_diagnostic_result(p_diagnostic_id uuid)` | service_only | Y | Y |  | — | revoke_public_anon_authenticated |
| `audit_book_extraction(p_book_id uuid)` | service_only | Y | Y |  | — | revoke_public_anon_authenticated |
| `auto_promote_track_level_for_user(p_user_id uuid, p_track_id text)` | service_only | Y | Y |  | — | revoke_public_anon_authenticated |
| `collect_content_gate_metrics()` | service_only | Y | Y |  | — | revoke_public_anon_authenticated |
| `compute_book_coverage(p_book_id uuid)` | service_only | Y | Y |  | — | revoke_public_anon_authenticated |
| `csat_ec_round_create(p_taxonomy text, p_quality_rule text, p_choice_trap_map text, p_eligibility jsonb, p_evidence_profile text)` | service_only | Y | Y |  | — | revoke_public_anon_authenticated |
| `csat_source_snapshot_take(p_by text)` | service_only | Y | Y | Y | — | revoke_public_anon_authenticated |
| `decode_entities_in_stored_sentences(p_book_id uuid)` | service_only | Y | Y |  | — | revoke_public_anon_authenticated |
| `fill_lbv_resolution(p_book_id uuid, p_only_new boolean)` | service_only | Y | Y |  | — | revoke_public_anon_authenticated |
| `fix_chapter_html_entities(p_book_id uuid)` | service_only | Y | Y |  | — | revoke_public_anon_authenticated |
| `insert_book_analysis(p_book_id uuid, p_chapters jsonb, p_words jsonb)` | service_only | Y | Y |  | — | revoke_public_anon_authenticated |
| `purge_ghost_vocab(p_book_id uuid)` | service_only | Y | Y |  | — | revoke_public_anon_authenticated |
| `refresh_textbook_shelf_stats()` | service_only | Y | Y |  | — | revoke_public_anon_authenticated |
| `republish_article_word_set(p_article_id uuid, p_cap integer)` | service_only | Y | Y |  | — | revoke_public_anon_authenticated |
| `republish_book_word_sets(p_book_id uuid, p_cap integer)` | service_only | Y | Y |  | — | revoke_public_anon_authenticated |
| `update_user_v_level(p_user_id uuid, p_new_level smallint, p_source text, p_confidence numeric, p_reason text, p_diagnostic_id uuid, p_triggered_by text, p_trigger_details jsonb)` | service_only | Y | Y |  | — | revoke_public_anon_authenticated |
| `video_job_restart(p_video_id text, p_kind text)` | service_only | Y | Y |  | — | revoke_public_anon_authenticated |
| `video_request_add_revision(p_id uuid, p_plan jsonb, p_design jsonb, p_checks jsonb, p_author text)` | service_only | Y | Y |  | — | revoke_public_anon_authenticated |
| `video_request_advance(p_id uuid, p_phase text, p_video_id text, p_error text)` | service_only | Y | Y |  | — | revoke_public_anon_authenticated |
| `video_request_record_evaluation(p_id uuid, p_spec jsonb, p_outcome jsonb)` | service_only | Y | Y |  | — | revoke_public_anon_authenticated |
| `video_retire_mark_purged(p_video_id text)` | service_only | Y | Y |  | — | revoke_public_anon_authenticated |
| `video_retire_rerendered(p_video_id text)` | service_only | Y | Y |  | — | revoke_public_anon_authenticated |

### 사람이 확정할 항목(review) (57)

| 함수 | 분류 | definer | 쓰기 | anon | 본문 검사 | 조치 |
|---|---|---|---|---|---|---|
| `_extract_composite_score(p_frequency_rank integer, p_freq_in_unit integer, p_unit_max_freq integer, p_v_level smallint, p_verified boolean, p_example_en text, p_skill_level smallint, p_unit_v_level smallint)` | service_only |  |  | Y (PUBLIC) | — | review(invoker 함수가 부름) |
| `acp_article_rollup()` | authenticated_only | Y |  | Y | — | review(비로그인 공개 경로 확인) |
| `acp_classify_license(p_license text)` | service_only |  |  | Y (PUBLIC) | — | review(invoker 함수가 부름) |
| `analyze_and_apply_comprehensive_diagnostic_result(p_result_id uuid)` | authenticated_only | Y | Y |  | — | review(비로그인 공개 경로 확인) |
| `analyze_and_apply_diagnostic_result(p_result_id uuid)` | authenticated_only | Y | Y |  | — | review(비로그인 공개 경로 확인) |
| `analyze_and_apply_track_diagnostic_result(p_result_id uuid)` | authenticated_only | Y | Y |  | — | review(비로그인 공개 경로 확인) |
| `apply_topic_categories(p_source_id text, p_min_doc_freq integer, p_min_salience numeric, p_max_words integer, p_dry_run boolean)` | authenticated_only | Y | Y |  | — | review(비로그인 공개 경로 확인) |
| `auto_curate_book(p_book_id uuid)` | authenticated_only | Y | Y |  | — | review(비로그인 공개 경로 확인) |
| `auto_promote_v_level_for_user(p_user_id uuid)` | authenticated_only | Y |  | Y (PUBLIC) | — | review(비로그인 공개 경로 확인) |
| `calc_v_level(p_word text)` | service_only |  |  | Y (PUBLIC) | — | review(invoker 함수가 부름) |
| `claim_topic_corpus_batch(p_source_id text, p_limit integer)` | authenticated_only | Y | Y |  | — | review(비로그인 공개 경로 확인) |
| `collect_archaic_candidates(p_book_id uuid)` | authenticated_only | Y | Y |  | — | review(비로그인 공개 경로 확인) |
| `compute_article_syntax(p_article_id uuid)` | authenticated_only |  | Y | Y (PUBLIC) | — | review(비로그인 공개 경로 확인) |
| `compute_article_vrl(p_article_id uuid)` | authenticated_only |  | Y | Y (PUBLIC) | — | review(비로그인 공개 경로 확인) |
| `compute_book_cefrj(p_book_id uuid)` | service_only |  | Y | Y (PUBLIC) | — | review(invoker 함수가 부름) |
| `compute_frequency_tier(p_raw_count integer)` | service_only |  |  | Y (PUBLIC) | — | review(invoker 함수가 부름) |
| `compute_syntax_score(p_content text)` | service_only |  |  | Y (PUBLIC) | — | review(invoker 함수가 부름) |
| `content_gate_publishable(p_scope text, p_id uuid)` | service_only | Y |  |  | — | review(invoker 함수가 부름) |
| `csat_source_inventory_live()` | authenticated_only |  |  |  | — | review(비로그인 공개 경로 확인) |
| `csat_source_live_rollup()` | authenticated_only |  |  |  | — | review(비로그인 공개 경로 확인) |
| `csat_source_pipeline_live()` | authenticated_only |  |  |  | — | review(비로그인 공개 경로 확인) |
| `effective_confidence(p_meta jsonb)` | service_only |  |  | Y (PUBLIC) | — | review(invoker 함수가 부름) |
| `en_inflection_bases(p text)` | service_only |  |  | Y (PUBLIC) | — | review(invoker 함수가 부름) |
| `enqueue_topic_corpus_docs(p_source_id text, p_docs jsonb)` | authenticated_only | Y | Y |  | — | review(비로그인 공개 경로 확인) |
| `extract_vocabulary_for_user(p_user_id uuid, p_words text[], p_level_strategy text)` | authenticated_only | Y |  | Y (PUBLIC) | — | review(비로그인 공개 경로 확인) |
| `extract_vocabulary_for_user_v2(p_user_id uuid, p_words text[], p_level_strategy text, p_limit integer)` | authenticated_only | Y |  | Y (PUBLIC) | — | review(비로그인 공개 경로 확인) |
| `get_comic_format(p_book_id uuid)` | authenticated_only | Y |  | Y | — | review(비로그인 공개 경로 확인) |
| `infer_form_pos(p_surface text, p_base text)` | service_only |  |  | Y (PUBLIC) | — | review(invoker 함수가 부름) |
| `ingest_topic_corpus_doc(p_source_id text, p_external_id text, p_url text, p_content_hash text, p_counts jsonb, p_running_words integer, p_truncated integer, p_title text, p_speaker text, p_published_at timestamp with time zone, p_proper_nouns text[])` | authenticated_only | Y | Y |  | — | review(비로그인 공개 경로 확인) |
| `list_book_comic_catalog()` | authenticated_only | Y |  | Y | — | review(비로그인 공개 경로 확인) |
| `list_book_support_vocab(p_book_id uuid, p_limit integer)` | authenticated_only |  |  | Y (PUBLIC) | — | review(비로그인 공개 경로 확인) |
| `list_comic_catalog()` | authenticated_only | Y |  | Y | — | review(비로그인 공개 경로 확인) |
| `list_pd_comic_shelf()` | authenticated_only | Y |  | Y (PUBLIC) | — | review(비로그인 공개 경로 확인) |
| `list_pd_comics(p_series_key text)` | authenticated_only | Y |  | Y (PUBLIC) | — | review(비로그인 공개 경로 확인) |
| `lookup_word_meaning(p_surface text)` | authenticated_only |  |  | Y (PUBLIC) | — | review(비로그인 공개 경로 확인) |
| `pgmq_archive(p_queue_name text, p_msg_id bigint)` | authenticated_only | Y |  | Y | — | review(비로그인 공개 경로 확인) |
| `preview_book_comic(p_book_id uuid, p_limit integer)` | authenticated_only | Y |  | Y | — | review(비로그인 공개 경로 확인) |
| `publish_article_word_set(p_article_id uuid, p_cap integer)` | service_only |  | Y | Y (PUBLIC) | — | review(invoker 함수가 부름) |
| `publish_book_word_sets(p_book_id uuid, p_cap integer)` | service_only |  | Y | Y (PUBLIC) | — | review(invoker 함수가 부름) |
| `recommend_word_sets_for_user(p_user_id uuid, p_interests text[])` | authenticated_only | Y |  | Y (PUBLIC) | — | review(비로그인 공개 경로 확인) |
| `record_pending_words(p_user_id uuid, p_lemmas text[], p_text_id uuid)` | authenticated_only | Y | Y |  | — | review(비로그인 공개 경로 확인) |
| `refresh_user_known_word_count(p_user_id uuid)` | authenticated_only | Y | Y |  | — | review(비로그인 공개 경로 확인) |
| `release_topic_corpus_claim(p_id uuid, p_status text, p_error text)` | authenticated_only | Y | Y |  | — | review(비로그인 공개 경로 확인) |
| `resolve_dict_headword(p_surface text)` | service_only |  |  | Y (PUBLIC) | — | review(invoker 함수가 부름) |
| `select_book_chapter_vocab(p_book_id uuid)` | service_only |  |  | Y (PUBLIC) | — | review(invoker 함수가 부름) |
| `select_book_comic(p_book_id uuid, p_chapter_idx integer)` | authenticated_only | Y |  | Y | — | review(비로그인 공개 경로 확인) |
| `select_book_comic_all(p_book_id uuid)` | authenticated_only | Y |  | Y | — | review(비로그인 공개 경로 확인) |
| `select_pd_comic(p_slug text)` | authenticated_only | Y |  | Y (PUBLIC) | — | review(비로그인 공개 경로 확인) |
| `select_pd_comic_info(p_slug text)` | authenticated_only | Y |  | Y (PUBLIC) | — | review(비로그인 공개 경로 확인) |
| `store_content_chunk(p_content text)` | authenticated_only | Y | Y |  | — | review(비로그인 공개 경로 확인) |
| `surface_variants(s text)` | service_only |  |  | Y (PUBLIC) | — | review(invoker 함수가 부름) |
| `textbook_curriculum_vocab_counts()` | authenticated_only | Y |  | Y (PUBLIC) | — | review(비로그인 공개 경로 확인) |
| `textbook_shelf_inventory()` | authenticated_only | Y |  | Y (PUBLIC) | — | review(비로그인 공개 경로 확인) |
| `textbook_shelf_refreshed_at()` | authenticated_only | Y |  | Y (PUBLIC) | — | review(비로그인 공개 경로 확인) |
| `textbook_shelf_sources()` | authenticated_only | Y |  | Y (PUBLIC) | — | review(비로그인 공개 경로 확인) |
| `textfit_resolve_levels(p_words text[])` | authenticated_only |  |  | Y (PUBLIC) | — | review(비로그인 공개 경로 확인) |
| `unresolved_dict_words(p_words text[])` | authenticated_only |  |  | Y (PUBLIC) | — | review(비로그인 공개 경로 확인) |
