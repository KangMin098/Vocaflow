# LCP Story S3 — live DB 읽기 감사

> **상태(2026-10-25 · T-0169 보강 회차)**: 별도 PGlite 재현으로 확인된 결함 3건(직접 RPC 의 S2 구조 검증 우회 발행 · 마지막 단위만 기록해 완독 ·
> 권리 보류 뒤 발행 본문 열람)과 배포 위치 · 1회용 승인 티켓 경계, 독립 검토 지적(소유자 세션 증명 · 판본 중복 발행 등)을 같은 작업에서 고쳤다.
> 고친 방식은 아래 D2~D4, 실행 근거는 격리 PGlite · PostgreSQL 17 하네스와 러너 시험이다(작성자 검증과 T-0169 Codex 별도 수용 완료).
> **위 S3 작성·수용 당시에는 공유 DB 미적용이었다.** 후속 사용자 승인 뒤 MCP로 적용했다(아래 「후속 승인 적용」). 러너 TLS preflight는 미실행이며 백엔드 검증 증인 런타임(S4) · 두 번째 인증 스태프 계정(발행 전제)은 남아 있다.

> 이 앞부분(측정 정보 ~ 미확인 · 공백)은 **실측 사실**만 담는다. 결정 · SQL 초안은 이 문서 뒤쪽의 별도 절(작성: 상위 세션)에서 다룬다.
> 각 절은 `work/lcp-story-s3/audit/` 의 원자료 파일(질의 SQL 전문 · `observed_at` · 결과 JSON)을 인용한다. 그 폴더는 `/work/` gitignore 대상이라 커밋되지 않는다.
> 존재 · 정의는 문서나 저장소 마이그레이션이 아니라 live 카탈로그(`to_regclass` · `pg_policies` · `pg_proc` · `pg_trigger` · `pg_constraint` · `information_schema`)로만 판정했다.

## 측정 정보

| 항목 | 값 |
|---|---|
| 측정일 | 2026-10-25 (KST) |
| observed_at 범위 | `2026-10-24T17:42:18Z` ~ `2026-10-25T04:54:18Z` (UTC) |
| 프로젝트 | `jajenrevcbmrpaliomxv` (vocaflow-dev) |
| 도구 | `mcp__claude_ai_Supabase__execute_sql` (`mcp__supabase__*` 는 쓰지 않았다) |
| 접속 신원 | `current_user = postgres` · `session_user = postgres` · `transaction_read_only = off` (01) |
| 읽기 전용 여부 | 실행한 질의는 전부 `SELECT` 다(INSERT/UPDATE/DELETE/DDL/SET/DO/CALL/nextval · 서버 파일 접근 없음). 접속 자체는 쓰기 가능한 세션이므로 읽기 전용은 질의 선택으로만 보장했다. 어떤 DB 쓰기도 하지 않았다 |
| 실행자 | Claude Code DB 감사 서브에이전트 |
| 비고 | 감사 프로세스가 한 번 재시작됐다. 01~04 는 `2026-10-24T17:4xZ`(KST 10-25 02:4x), 05~13 은 `2026-10-25T04:4x~05xZ` 에 관측했다 — 약 11시간 차이다. 두 구간 사이에 다른 세션이 DB 를 바꿨는지는 확인하지 않았다 |
| 갱신 지문 | `20-refresh-fingerprint.json` · `2026-10-25T07:55:59Z`(KST 16:55:59) · 단일 SELECT 1회. S3 SQL 이 기대는 항목만 다시 쟀다: `story` 스키마 · `public.story*` 관계 · 함수 0(충돌 없음) · 선행 `user_profiles(user_id uuid, role text, status text)` · `library_books` · `texts` · `auth.uid()` · 코어 `sha256` 존재 · 역할 anon/authenticated/service_role 존재 · 스태프 admin/active 1 · curator 0 · 기본 격리 `read committed` · 마이그레이션 꼬리 `20261024025906` · S3 버전(`20261025140000/140100`) 이력 없음 · `public` 기본 ACL(아래 §6 과 같음: postgres 가 만드는 새 함수는 service_role 실행이 붙는다). 01~04 의 나머지 항목(열 전체 · 수 · 제약)은 다시 재지 않았다 |

원자료 파일: `01-server-extensions.json` · `02-regclass-collision.json` · `03-columns-constraints.json` · `04-counts.json` · `05-rls-policies.json` · `06-grants.json` ·
`07a-functions-meta.json` · `07b-function-bodies-gates.json` · `07c-function-bodies-bulk-view.json` · `07d-function-bodies-pipeline.json` · `07e-function-scan-content-writers.json` ·
`07f-function-bodies-admin-book.json` · `08a-triggers-truncate.json` · `08b-trigger-function-bodies.json` · `09-funnel-check.json` · `10-cron.json` · `11-migrations.json` ·
`12-views-secdef-exposure.json` · `13-encoding-hash-sample.json`.

## 1. 서버 · 확장 · 해시 함수 — `01-server-extensions.json` · `13-encoding-hash-sample.json`

- `PostgreSQL 17.6 on aarch64-unknown-linux-gnu`. `server_encoding = UTF8` · `lc_collate = en_US.UTF-8`.
- 확장: `pgcrypto 1.3`(스키마 `extensions`) · `pg_cron 1.6.4` · `pg_net 0.20.0`(스키마 `public`) · `pgmq 1.5.1` · `supabase_vault 0.3.1` · `pgsodium 3.1.8` · `uuid-ossp` · `pg_trgm` · `btree_gin` · `fuzzystrmatch` · `pgstattuple` · `pg_stat_statements` · `plpgsql_check` · `pg_graphql`.
- 코어 `sha256(bytea)` 사용 가능: `encode(sha256('abc'::bytea),'hex')` = `ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad`(표준 SHA-256 테스트 벡터와 일치).
- pgcrypto `digest(bytea,text)` · `digest(text,text)` 는 `extensions` 스키마에 있다. `store_content_chunk` 는 `search_path=public, extensions` 로 `digest(p_content,'sha256')` 를 부른다(07b).
- `content_chunks.hash` 표본 검증: hash 순 첫 200행 모두 `hash = encode(sha256(convert_to(content,'UTF8')),'hex')` 이고 길이 64(13). 전수 검증은 하지 않았다.
- 스키마: `auth` · `backup` · `cron` · `csat_ec_private` · `extensions` · `graphql` · `graphql_public` · `net` · `pgbouncer` · `pgmq` · `pgsodium` · `pgsodium_masks` · `public` · `realtime` · `storage` · `supabase_migrations` · `vault` (+ 시스템 스키마).

## 2. 테이블 존재 · 이름 충돌 — `02-regclass-collision.json`

- `to_regclass('public.<t>')` 가 12개 모두 존재를 돌려줬고 전부 `relkind = r`(일반 테이블):
  `library_books` · `library_chapters_master` · `library_book_vocabularies` · `content_chunks` · `texts` · `reading_sessions` · `book_curation_jobs` · `funnel_events` · `user_profiles` · `library_seed_catalog` · `shared_word_sets` · `learning_records`.
- 이름 충돌: `ilike '%story%'` 일치는 모두 `history` 부분 문자열(`csat_source_eligibility_history` 와 그 시퀀스 · 인덱스 · 행 타입 · 정책 `source_eligibility_history_admin_read` · 트리거 `source_eligibility_history` · 함수 `retain_source_eligibility_history()` · 열 `vocabularies.module_history`)이었다.
  단어 경계 정규식 `(^|[^a-z])stor(y|ies)` 로 다시 확인한 결과 relation · 함수 · 타입 · 정책 · 트리거 · public 열 · 제약 · enum 라벨 · storage 버킷 **모두 0건**, `lcp_story%` 접두 객체도 **0건**이다.
- 이름이 비슷한 기존 값: `library_books.source` CHECK 에 `'storyweaver'` 가 있고(도서 20권, §4), 마이그레이션 이력에 `lcp_storyweaver_source` · `lcp_storyweaver_seed_catalog` · `storyweaver_source` 가 있다(§11). 외부 소스 StoryWeaver 이며 LCP Story 와 무관하다.

## 3. 열 · 제약 · 외래 키 — `03-columns-constraints.json`

- `content_chunks`: `hash text PK` · `content text NOT NULL` · `byte_size int NOT NULL` · `ref_count int NOT NULL default 0` · `created_at`. 도서 id · 상태 열이 **없다** — 본문 행 자체에는 어느 도서 · 발행 상태인지가 없다.
- `library_chapters_master`: `library_book_id uuid NOT NULL`(FK → `library_books` ON DELETE CASCADE) · `chapter_idx` · `content_hash text NOT NULL`(FK → `content_chunks(hash)`, ON DELETE 기본 NO ACTION) · `paragraph_offsets int[]` · `sentence_offsets int[]` · `word_count` · `cefr_level` · `chapter_v_level` 등. `UNIQUE(library_book_id, chapter_idx)`.
- `library_books`: `status text NOT NULL default 'queued'` · CHECK `status ∈ {queued, ingesting, normalizing, segmenting, analyzing, curating, ready, published, archived, failed}` · `copyright_safe_in_kr boolean NOT NULL default false`(트리거가 `license` 로 계산 — §8) · `source` CHECK 14종(`gutenberg` · `standard_ebooks` · `wikisource` · `wikibooks` · `simple_wikipedia` · `openstax` · `open_library` · `hathitrust` · `voa_learning` · `librivox` · `lit2go` · `storyweaver` · `pressbooks` · `manual`) · `UNIQUE(source, source_id)` · `language text NOT NULL default 'en'` · `license text NOT NULL` · `published_at`. 원작 언어 · 번역자 · 판본 · 파생 관계를 담는 열은 없다.
- `texts`: `user_id uuid NOT NULL`(FK → `auth.users` CASCADE) · `content text null` · `library_book_id uuid null`(FK → `library_books`, ON DELETE 기본 NO ACTION) · `chapter_idx` · `status` CHECK `{not_started, in_progress, extracted, conquered, completed}` · `source text_source default 'direct-script'` · CHECK `chk_content_or_library`(content 또는 library_book_id 중 하나 필수) · `texts_book_group_exclusive`(library_book_id 와 user_book_group_id 동시 불가).
- `reading_sessions`: `text_id`(FK → `texts` CASCADE) · `user_id`(FK → `auth.users` CASCADE) · `status ∈ {pending, reading, done}` · `UNIQUE(text_id, session_idx)`. 도서 id 를 직접 갖지 않고 `texts` 를 거친다.
- `funnel_events`: `id bigint` · `occurred_at` · `user_id uuid null` · `event text NOT NULL` · `surface text` · `meta jsonb NOT NULL default '{}'`.
- `user_profiles`: `role text NOT NULL default 'user'` CHECK `role ∈ {user, admin, curator}` · `status text NOT NULL default 'active'` CHECK `status ∈ {active, suspended, deleted}` · `segment` CHECK 8종.
- `book_curation_jobs`: `task_type` CHECK `{voice_map, quiz_gen, level_verify, vocab_audit, comic_gen}` · `status` CHECK `{pending, running, awaiting_mapping, done, failed}` · `mode ∈ {dev_process, dev_reprocess}|null` · `UNIQUE(book_id, task_type)`.
- `library_books` 를 참조하는 FK 19개: `library_chapters_master` · `library_book_vocabularies` · `book_curation_jobs` · `library_chapter_quiz` · `book_extraction_audit` · `quality_drift_checks` · `comic_books` · `comic_pages` · `comic_read_progress` · `comic_gen_runs` · `comic_panel_events`(이상 CASCADE) · `texts`(NO ACTION) · `dictation_sessions` · `echo_match_sessions` · `user_word_set_subscriptions.source_book_id` · `comic_gen_tests` · `library_seed_catalog.imported_book_id` · `archaic_candidates.first_seen_book_id` · `pd_comic_issues`(이상 SET NULL).
- `texts` 를 참조하는 FK 7개: `reading_sessions` · `quiz_questions` · `echo_match_sessions`(CASCADE) · `scores` · `vocabularies` · `dictation_sessions` · `pending_words`(SET NULL).
- `content_chunks` 를 참조하는 FK 는 `library_chapters_master_content_hash_fkey` 하나, `library_chapters_master` 를 참조하는 FK 는 0개다.
- `shared_word_sets` 와 도서의 연결은 FK 가 아니라 `curation_query->>'book_id'`(jsonb 문자열)이다(05 정책 · 07 함수 본문).

## 4. 실측 수 — `04-counts.json`

| 대상 | 값 | 종류 |
|---|---|---|
| `library_books` | 401 = published 312 · archived 83 · ready 5 · failed 1. **모두 `copyright_safe_in_kr = true`**(false 0건) | 정확 |
| `library_books.source` | standard_ebooks 377 · storyweaver 20 · gutenberg 3 · pressbooks 1 | 정확 |
| `library_books.language` | `en` 401 | 정확 |
| published 인데 `published_at` 없음 | 0 | 정확 |
| `library_chapters_master` | 11,642 행 · 도서 322권 · 서로 다른 `content_hash` 11,642 | 정확 |
| `content_chunks` | 11,644 행 · `ref_count = 0` 인 행 2 | 정확 |
| `texts` | 전체 280 · `library_book_id` 있음 269(not_started 207 · extracted 61 · in_progress 1) · 그중 `content` 가 NULL 269 · 도서 6권 · 사용자 2명 | 정확 |
| 미발행 도서를 가리키는 `texts` | 0 | 정확 |
| `reading_sessions` | 287 (전부 도서 texts 에 연결) | 정확 |
| `book_curation_jobs` | quiz_gen done 4 · vocab_audit done 1 · voice_map done 1 · voice_map pending 1 | 정확 |
| `funnel_events` | 50,374 · 사용된 서로 다른 이벤트 이름 57 · (reltuples 추정 47,732) | 정확 + 추정 |
| `library_book_vocabularies` | 약 1,682,239 (reltuples **추정**) · 1.24 GB | 추정 |
| `user_profiles` | 85 = admin/active 1 · user/active 51 · user/suspended 33 · **curator 0** | 정확 |

- 첫 묶음 질의(1.68M 행 count 와 content_chunks 반조인 포함)는 `The operation timed out.` 으로 실패했고 결과가 없다. 나눠서 다시 실행했고 `library_book_vocabularies` 정확 count 는 다시 시도하지 않았다.
- `content_chunks` 의 총 용량은 `pg_total_relation_size` 142,802,944 바이트다(04a).

## 5. RLS — `05-rls-policies.json`

12개 테이블 모두 `relrowsecurity = true`, `relforcerowsecurity = false`, 소유자 `postgres`. 모든 정책의 `roles` 는 `{public}`(= anon · authenticated 모두 해당)이고 PERMISSIVE 다. `service_role` 은 `rolbypassrls = true`(06).

| 테이블 | 정책 | cmd | USING | WITH CHECK |
|---|---|---|---|---|
| `content_chunks` | `authenticated_read_chunks` | SELECT | `(SELECT auth.role()) = 'authenticated'` | — |
| `library_books` | `anyone_read_published_safe` | SELECT | `status = 'published' AND copyright_safe_in_kr = true` | — |
| `library_books` | `admin_curator_all_books` | ALL | `is_admin_or_curator()` | `is_admin_or_curator()` |
| `library_chapters_master` | `read_via_published` | SELECT | 해당 도서가 `published AND copyright_safe_in_kr` 인 EXISTS | — |
| `library_chapters_master` | `admin_curator_read_chapters` | SELECT | `is_admin_or_curator()` | — |
| `library_book_vocabularies` | `read_vocab_via_published` | SELECT | 해당 도서가 `published AND copyright_safe_in_kr` 인 EXISTS | — |
| `library_book_vocabularies` | `admin_curator_read_vocab` | SELECT | `is_admin_or_curator()` | — |
| `texts` | `own data` | ALL | `(SELECT auth.uid()) = user_id` | `(SELECT auth.uid()) = user_id` |
| `reading_sessions` | `users_own_sessions` | ALL | `(SELECT auth.uid()) = user_id` | 없음(USING 이 쓰기 검사에도 쓰인다) |
| `book_curation_jobs` | `admin_curator_bcj` | ALL | `is_admin_or_curator()` | `is_admin_or_curator()` |
| `funnel_events` | `funnel_events_select_own` | SELECT | `user_id = (SELECT auth.uid()) OR is_admin_or_curator()` | — |
| `user_profiles` | `own data` | ALL | `(SELECT auth.uid()) = user_id` | `(SELECT auth.uid()) = user_id` |
| `user_profiles` | `profiles_admin_read` | SELECT | `is_admin()` | — |
| `library_seed_catalog` | `admin read` · `admin write` | SELECT · ALL | `is_admin_or_curator()` | ALL 은 같은 식 |
| `shared_word_sets` | `read published` | SELECT | `is_published AND (category 가 library_book/library_article 이 아니거나, 연결 도서 · 기사가 published AND copyright_safe_in_kr)` | — |
| `shared_word_sets` | `admin_curator_all_shared_word_sets` | ALL | `user_profiles.role ∈ {admin, curator}` EXISTS(헬퍼 함수 아님) | 같은 식 |
| `learning_records` | `own data` | ALL | `(SELECT auth.uid()) = user_id` | 같은 식 |

- `content_chunks` · `library_chapters_master` · `library_book_vocabularies` · `funnel_events` 에는 SELECT 정책만 있다(쓰기 정책 0개 — 06b).
- `content_chunks` 의 SELECT 조건에는 도서 · 발행 상태가 없다(테이블에 그 열도 없다 — §3).
- `texts` 의 `own data` WITH CHECK 는 `user_id` 만 본다. `library_book_id` 가 가리키는 도서의 상태는 검사하지 않는다.
- `library_books` 의 쓰기는 `admin_curator_all_books`(admin · curator) 정책으로만 열려 있다. 학습자용 쓰기 정책은 없다.
- 저장소와 다른 점: 저장소 `20260508120000_lcp_v2.sql` 은 `content_chunks` 에 `service_role_all_chunks`(`auth.jwt()->>'role' = 'service_role'`) 정책도 만들지만 live 에는 없다. live 의 `authenticated_read_chunks` 식은 `(SELECT auth.role())` 형태다(저장소 원문은 `auth.role()`). 정책 · 함수 중 `auth.jwt()` · `app_metadata` 를 쓰는 것은 0건이다(07e).

## 6. 테이블 · 열 권한 — `06-grants.json` · `08a-triggers-truncate.json`

`has_table_privilege` 기준(S=SELECT · I=INSERT · U=UPDATE · D=DELETE):

| 테이블 | anon | authenticated | service_role |
|---|---|---|---|
| `library_books` · `library_chapters_master` · `library_book_vocabularies` · `content_chunks` · `texts` · `reading_sessions` · `book_curation_jobs` · `funnel_events` · `library_seed_catalog` · `shared_word_sets` · `learning_records` | S,I,U,D | S,I,U,D | S,I,U,D |
| `user_profiles` | S | S (+ 일부 열 INSERT/UPDATE) | S,I,U,D |
| view `v_text_content` | S,I,U,D | S,I,U,D | S,I,U,D |

- 위 12개 테이블 전부에서 anon · authenticated 가 **TRUNCATE** 권한도 가진다(08a). `user_profiles` 의 테이블 단위 권한은 anon · authenticated 모두 `REFERENCES · SELECT · TRIGGER · TRUNCATE` 다.
- `user_profiles` 열 권한(authenticated): INSERT = `avatar_url · cefr_level · daily_word_goal · display_name · learning_goal · locale · notify_email · notify_push · notify_streak_risk · segment · target_track_levels · target_v_level · target_v_level_meta · theme · tts_speed · tts_voice · user_id`, UPDATE = 같은 목록에서 `user_id` 를 빼고 `updated_at` 을 더한 것. **`role` · `status` 는 INSERT · UPDATE 권한이 없다**(`has_column_privilege` false).
- `texts` 열 권한: anon · authenticated 모두 `user_id · library_book_id · chapter_idx · content · status` 에 INSERT · UPDATE 권한이 있다.
- `library_books` 열 권한: anon · authenticated 모두 `status · copyright_safe_in_kr` 에 INSERT · UPDATE 권한이 있다(행 단위로는 §5 정책이 admin · curator 로 제한).
- `content_chunks.content` 는 anon · authenticated 모두 SELECT 권한이 있다(행 단위로는 §5 정책이 authenticated 로 제한).
- `public` 스키마 기본 권한(`pg_default_acl`): `postgres` 가 만드는 새 테이블은 anon · authenticated · service_role 에 `arwdDxtm`(전 권한, TRUNCATE 포함), 새 시퀀스는 `rwU`. `postgres` 가 `public` 에 만드는 새 함수는 `postgres · service_role` 만 EXECUTE(전역 기본값 `{postgres=X/postgres}` 로 PUBLIC 실행 없음). `supabase_admin` 이 만드는 객체는 anon · authenticated 에도 열린다.

## 7. 함수 — `07a`~`07f` · `12-views-secdef-exposure.json`

모두 `public` 스키마, 소유자 `postgres`. `x_*` 는 `has_function_privilege(<role>, oid, 'EXECUTE')`.

| 함수 | SECURITY DEFINER | search_path | anon | authenticated | 게이트(본문 기준) |
|---|---|---|---|---|---|
| `auto_curate_book(uuid)` | 예 | public, extensions | ✗ | ✗ | 호출자 검사 없음(service_role 만 실행 권한). `cefr_confidence ≥ 0.85 AND copyright_safe_in_kr AND chapter_count 1~100 AND word_count ≥ 1000 AND 어휘 ≥ 50` → `status='published', published_at=now()`; `≥ 0.60 AND safe` → `ready`; 그 밖 → `failed` |
| `admin_force_publish_book(uuid)` | 예 | public, extensions | ✗ | ✓ | `is_admin_or_curator()` · `copyright_safe_in_kr` 만 확인 → `status='published', published_at=COALESCE(published_at, now())` |
| `admin_revert_published_book(uuid)` | 예 | public, extensions | ✗ | ✓ | `is_admin_or_curator()` · 현재 published 여야 함 → 그 도서의 `shared_word_sets`(category library_book) **삭제** 후 `status='ready', published_at=NULL`. `texts` 는 건드리지 않는다 |
| `admin_archive_book(uuid)` | 예 | public, extensions | ✗ | ✓ | `is_admin_or_curator()` → `status='archived'`(단어장 · texts 는 건드리지 않는다) |
| `admin_requeue_book(uuid)` | 예 | public, pgmq, extensions | ✗ | ✓ | `is_admin_or_curator()` → `status='queued'`(트리거가 파이프라인에 넣는다) |
| `admin_bulk_requeue_books(uuid[])` | 예 | public, pgmq, extensions | ✗ | ✓ | `is_admin_or_curator()`. 상태 `{queued … ready, failed}` 이고 발행 단어장 · 사용자 texts 가 없을 때만 미발행 단어장 삭제 · 시드 해제 · **도서 행 삭제** |
| `admin_bulk_set_books_curating(uuid[])` | 예 | public, pgmq, extensions | ✗ | ✓ | `is_admin_or_curator()`. `status='ready'` 이고 발행 단어장 · texts 가 없을 때만 미발행 단어장 삭제 후 `status='curating'` |
| `admin_bulk_requeue_articles(uuid[])` | 예 | public, extensions | ✗ | ✓ | `is_admin_or_curator()`(기사 대상, 도서 아님) |
| `enroll_library_book(uuid)` | 예 | public, extensions | ✗ | ✓ | `auth.uid()` 필수 · `status='published' AND copyright_safe_in_kr=true` · `cefr_level ∈ A1~C2` · 챕터 존재. 챕터마다 `texts`(content NULL, `source='library'`) 생성 후 `_enroll_book_subscribe_word_sets`. 이미 등록이면 기존 id 반환 |
| `unenroll_library_book(uuid)` | 예 | public, extensions | ✗ | ✓ | `auth.uid()` 필수. 자기 `texts` · 해당 도서 단어장 구독 · `origin='shared_set'` 어휘를 **삭제**. 도서 상태는 보지 않는다 |
| `get_chapter_content(uuid)` | 예 | public, auth, extensions | ✗ | ✓ | `auth.uid()` 가 `texts.user_id` 와 같아야 한다. **도서 status · copyright_safe_in_kr 를 보지 않는다.** `v_text_content` 의 `content` 반환 |
| `deliver_chapter_vocab(uuid,int)` | 예 | public | ✗ | ✓ | `auth.uid()` 필수 · 본문에 「DEFINER 라 RLS 가 안 걸린다」 주석과 함께 `library_books.status='published' AND copyright_safe_in_kr` 를 직접 건다 |
| `list_book_chapter_quiz_catalog()` | 예 | public | ✗ | ✓ | `status='published' AND copyright_safe_in_kr AND published_at IS NOT NULL` 을 직접 건다 |
| `store_content_chunk(text)` | 예 | public, extensions | ✗ | ✗ | 빈 본문 거부 · `digest(sha256)` hex 를 키로 `ON CONFLICT DO NOTHING`(`ref_count` 0 으로 삽입) |
| `publish_book_word_sets(uuid,int)` | **아니오**(INVOKER) | public, extensions, pg_temp | ✗ | ✗ | `book_v_level` 필수 · `content_gate_publishable('book', id)` 필수. **도서 status 는 보지 않는다.** 챕터별 `shared_word_sets(is_published=true, category='library_book')` 생성 |
| `content_gate_publishable(text,uuid)` | 예 | public · `statement_timeout=60000` | ✗ | ✓ | 먼저 `_assert_admin_or_service()` 를 부른다. `run_content_quality_gates` 의 critical FAIL(I10 제외)이 없으면 true |
| `insert_book_analysis(uuid,jsonb,jsonb)` | 예 | public, extensions · `statement_timeout=240s` | ✗ | ✗ | 호출자 검사 없음. 해당 도서의 `library_chapters_master` · `library_book_vocabularies` 를 **삭제 후 재삽입** |
| `process_library_pipeline_batch(int)` | 예 | public, pgmq, extensions | ✗ | ✗ | `get_lcp_config()` 로 URL · 토큰을 읽어 `pgmq` `library_pipeline` 메시지마다 `net.http_post(<base>/api/lcp/process)` |
| `archive_book_pipeline_messages(uuid)` | 예 | public, pgmq | ✗ | ✓ | `is_admin_or_curator()` → 해당 도서 큐 메시지 archive |
| `_enroll_book_subscribe_word_sets(uuid,uuid)` | 예 | public, extensions | ✗ | ✗ | 발행 단어장 구독 + 어휘 최대 50개 삽입(호출자 검사 없음 — 직접 실행 권한은 없음) |
| `record_funnel_event(text,text,jsonb)` | 예 | public | ✓ | ✓ | `auth.uid()` 가 NULL 이면 조용히 NULL 반환. 아니면 `funnel_events` 삽입(이벤트 이름 검사는 테이블 CHECK 가 한다) |
| `get_lcp_config()` | 예 | public, vault, extensions | ✗ | ✗ | 비밀값(`internal_token`)을 돌려주는 함수 — **본문은 읽지 · 기록하지 않았다**. 서명 · 권한만 기록 |
| `is_admin()` | 예 | public, pg_temp | ✓ | ✓ | `EXISTS(user_profiles WHERE user_id = auth.uid() AND role='admin')` |
| `is_admin_or_curator()` | 예 | public, auth, pg_temp | ✓ | ✓ | `auth.uid()` NULL 이면 false · 아니면 `user_profiles.role ∈ {admin, curator}` |
| `video_is_admin()` | 예 | public | ✓ | ✓ | `is_admin()` 과 같은 식 |
| `_assert_admin_or_service()` | 아니오 | public | ✓ | ✓ | `auth.role() ∈ {anon, authenticated}` 이면서 `is_admin()` 이 아니면 42501 예외 |

- `v_text_content`(view, 소유자 postgres, `security_invoker=true`, anon · authenticated · service_role 모두 SELECT 권한): `texts t LEFT JOIN library_chapters_master lcm ON (library_book_id, chapter_idx) LEFT JOIN content_chunks cc ON cc.hash = lcm.content_hash` 에서 `COALESCE(t.content, cc.content) AS content` 와 오프셋을 낸다. 도서 상태 조건이 없다. `get_chapter_content` 는 SECURITY DEFINER(소유자 postgres) 안에서 이 view 를 읽는다.
  `library_books` · `content_chunks` · `library_chapters_master` · `texts` 를 참조하는 view 는 이것과 `csat_stage_catalog`(security_invoker, `'published'` 조건 있음) 두 개다(12a).
- SECURITY DEFINER 함수: `public` 전체 361개 · authenticated 실행 가능 161개 · anon 실행 가능 21개(12b). anon 실행 가능 중 도서 테이블 이름을 본문에 담은 것은 `list_book_comic_catalog()` · `list_comic_catalog()` · `preview_book_comic(uuid,int)`(만화 라인, 본문 미확인).
  authenticated 실행 가능하고 도서 테이블 이름을 본문에 담은 것 28개 목록은 12b 에 있다. 그중 본문을 읽은 것은 위 표의 함수들이다.
- 스캔(07e)으로 `library_books` 를 UPDATE 하는 함수에는 위 표 외에 `compute_book_cefrj` · `compute_book_coverage` · `compute_book_difficulty` · `compute_book_syntax` · `compute_book_vrl`(모두 anon · authenticated 실행 불가)이 있고, `status='published'` 를 쓰는 함수는 `auto_curate_book` · `admin_force_publish_book` 두 개다.

## 8. 트리거 — `08a-triggers-truncate.json` · `08b-trigger-function-bodies.json`

| 테이블 | 트리거 | 시점 · 이벤트 | 함수(DEFINER 여부) | 동작(본문 기준) |
|---|---|---|---|---|
| `library_books` | `trg_lb_compute_kr_safe` | BEFORE INSERT OR UPDATE OF license | `lb_compute_kr_safe()` (아니오) | `copyright_safe_in_kr := license ILIKE '%public domain%' OR 'PD%' OR 'CC%'` — 입력값을 덮어쓴다 |
| `library_books` | `trg_lb_compute_search_vector` | BEFORE INSERT OR UPDATE OF title, author, category_tags | `lb_compute_search_vector()` (아니오) | 검색 벡터 |
| `library_books` | `trg_lb_enqueue` | AFTER INSERT | `trg_lb_enqueue_pipeline()` (예) | `NEW.status='queued'` 이면 `pgmq.send('library_pipeline', {book_id})` |
| `library_books` | `trg_lb_requeue` | AFTER UPDATE OF status WHEN new='queued' AND old≠'queued' | `trg_lb_enqueue_pipeline()` (예) | 위와 같음 |
| `library_books` | `trg_lb_publish_word_sets` | AFTER UPDATE OF status | `trg_publish_book_word_sets()` (아니오) | `NEW.status='published'` 로 바뀌면 `publish_book_word_sets(NEW.id)` |
| `library_books` | `trg_lb_set_updated_at` | BEFORE UPDATE | `set_updated_at()` | |
| `library_chapters_master` | `trg_lcm_chunk_refs` | AFTER INSERT OR DELETE OR UPDATE | `trg_lcm_chunk_refs()` (아니오) | `content_chunks.ref_count` 를 +1 / −1(0 하한) |
| `library_book_vocabularies` | `lbv_fill_lemma_after_insert` | AFTER INSERT (statement) | `trg_lbv_fill_lemma()` (예) | 본문 미확인 |
| `texts` | `trg_texts_updated` | BEFORE UPDATE | `set_updated_at()` | |
| `user_profiles` | `guard_user_profiles_privileged_columns` | BEFORE UPDATE | 같은 이름 (아니오) | `current_user ∈ {anon, authenticated}` 일 때 `user_id` · `role` · `status` 변경을 42501 로 거부 |
| `user_profiles` | `trg_sync_cefr_from_v_level` · `trg_user_profiles_updated` | BEFORE UPDATE | | |

- `content_chunks` · `shared_word_sets` · `reading_sessions` · `funnel_events` 에는 사용자 정의 트리거가 없다.
- `content_chunks.ref_count` 를 바꾸는 경로는 `trg_lcm_chunk_refs`(lcm 행 증감)와 `incr_chunk_refs` · `decr_chunk_refs`(service_role 전용, 본문 미확인)다.
- `recompute-kr-safe` cron(§10)이 갱신하는 열 `author_death_year` 는 `trg_lb_compute_kr_safe` 의 `UPDATE OF license` 목록에 없다.

## 9. `funnel_events` 이벤트 CHECK — `09-funnel-check.json`

- CHECK 제약은 `funnel_events_event_check` 하나(정의 길이 2,873자). 허용 이벤트 이름 **96개**.
- 이름 분포: `csat_*` 71 · `fit_*` 8 · `landing_*` 4 · `knowledge_task_*` 2 · `video_*` 2 · `wayfinder_*` 2 · `hub_*` 2 · 그 밖 `catalog_viewed` · `invite_shared` · `screen_viewed` · `teacher_hub_view` · `volume_previewed`.
- `story` 이벤트 0개. `library|read|book|chapter|reader` 정규식 일치는 `csat_paper_read` · `csat_source_ready` 두 개뿐이고 둘 다 도서 · 리더 이벤트가 아니다 — **도서 읽기 이벤트는 허용 목록에 없다**.
- 쓰기 경로: 테이블 INSERT 정책이 없으므로 직접 INSERT 는 RLS 로 막히고, `record_funnel_event`(SECURITY DEFINER, 로그인 필요)가 삽입한다(§7).
- 실제로 쓰인 서로 다른 이벤트 이름은 57개(§4).

## 10. pg_cron — `10-cron.json`

`cron` 스키마가 있고 작업 15개다. 명령 본문에 리터럴 URL · bearer · JWT 가 있는 작업은 0개다(불리언 검사). 도서 · LCP 와 닿는 5개:

| 작업 | 일정(UTC) | active | 명령 요약 |
|---|---|---|---|
| `library-pipeline-worker` | `* * * * *` | **false** | `SELECT process_library_pipeline_batch(5)` |
| `archive-stale-drafts` | `0 17 * * 6` | true | `UPDATE library_books SET status='archived' WHERE status='failed' AND updated_at < now() - 30 days` |
| `gc-content-chunks` | `0 19 * * *` | true | `DELETE FROM content_chunks WHERE ref_count = 0 AND created_at < now() - 7 days` |
| `recompute-kr-safe` | `0 15 31 12 *` | true | `UPDATE library_books SET author_death_year = author_death_year WHERE author_death_year IS NOT NULL` |
| `refresh-textbook-shelf-stats` | `0 */6 * * *` | true | `public.refresh_textbook_shelf_stats()` 호출(본문 미확인) |

- 나머지 10개(`classify-archaic-candidates-daily` · `content-gate-nightly` · `csat-source-snapshot` · `db-health-daily` · `db-health-integrity-weekly` · `db-health-queues-daily` · `purge-cron-history-7d` · `quality-metrics-nightly` · `refresh-lemma-dominant-pos` · `vrl-auto-promote-daily`)는 명령 문자열에 `library|lcp|book|content_chunk|auto_curate|chapter` 가 없다. 명령 본문은 출력하지 않았다.
- `auto_curate_book` 을 직접 부르는 cron 작업은 없다.

## 11. 마이그레이션 이력 — `11-migrations.json`

- `supabase_migrations.schema_migrations` 735행. 열: `version · statements · name · created_by · idempotency_key · rollback`(이 감사는 version · name 만 읽었다).
- 최신 25행의 가장 최근: `20261024025906 funnel_events_csat_summary` · `20261024012226 learning_exposures_fix_v3_1` · `20261023194123 learning_exposures` · `20261023082930 csat_goal_final_assessment` … `20261009095727 20261009120000_reading_specialized_production_gate`(전체 목록은 원자료).
- LCP Story 마이그레이션 **0건**. 이름에 `story` 가 든 3건은 StoryWeaver 소스(`lcp_storyweaver_source` · `lcp_storyweaver_seed_catalog` · `storyweaver_source`)다. 이름에 `lcp` 가 든 행은 12건.
- 저장소와 다른 점(파일 이름만 비교, 내용 diff 안 함):
  - `lcp_v2` 계열 6개는 이름이 같고 version 접두가 다르다 — 저장소 `20260508120000`~`20260508120600`, live `20260508153722`~`20260509001048`. StoryWeaver 3개도 같은 방식으로 다르다.
  - `20260923104726_rls_initplan_and_dead_policies` · `20261024025906_funnel_events_csat_summary` 등은 version 까지 같다.
  - live 의 `learning_exposures`(20261023194123) · `learning_exposures_fix_v3_1`(20261024012226) 은 이 worktree 의 `supabase/migrations` 에 같은 이름 파일이 없다.
  - 정책 차이: §5 마지막 항목(`service_role_all_chunks` 는 저장소에만 있음).

## 12. 관리자 · 큐레이터 판정 — `05` · `06` · `07b` · `08b` · `04`

- DB 의 판정 근거는 `user_profiles.role` 한 열이다(CHECK `{user, admin, curator}`, 기본 `user`).
  - `is_admin()` = `EXISTS(SELECT 1 FROM user_profiles WHERE user_id = auth.uid() AND role = 'admin')`(SQL, STABLE, SECURITY DEFINER, `search_path=public, pg_temp`).
  - `is_admin_or_curator()` = `auth.uid()` 가 NULL 이면 false, 아니면 `role IN ('admin','curator')`(plpgsql, STABLE, SECURITY DEFINER, `search_path=public, auth, pg_temp`).
  - `video_is_admin()` = `is_admin()` 과 같은 식. `_assert_admin_or_service()` = JWT 역할이 anon · authenticated 인데 `is_admin()` 이 아니면 거부(service_role · postgres 등은 통과).
  - `shared_word_sets` 의 관리 정책은 헬퍼 함수 대신 `user_profiles.role ∈ {admin, curator}` 를 직접 쓴다.
- `user_profiles.status`(active/suspended/deleted)는 위 헬퍼 어느 것도 보지 않는다.
- 역할 상승 차단: authenticated 는 `role` · `status` 열에 INSERT · UPDATE 권한이 없고(06b), `guard_user_profiles_privileged_columns` 트리거가 anon · authenticated 의 `user_id` · `role` · `status` 변경을 거부한다(08b). 프로필 직접 INSERT 는 허용 열만 가능하므로 `role` 은 기본값 `user` 가 된다.
- JWT `app_metadata` · `auth.jwt()` 로 역할을 정하는 정책 · 함수는 0건이다(07e).
- 현재 값: admin 1명(active) · curator 0명(04d). 갱신 지문(20, `2026-10-25T07:55:59Z`)에서도 같다.

## 사실에서 바로 나오는 함의

아래는 위 사실의 직접 결과다. 결정 · 설계안이 아니다. 「정의에서 따라 나옴」 표시는 실제 호출로 확인하지 않았다는 뜻이다.

1. **로그인한 모든 사용자는 `content_chunks` 본문 전체를 읽을 수 있다**: authenticated 에 SELECT 권한(§6)이 있고 정책 `authenticated_read_chunks` 의 조건이 역할뿐이며 테이블에 도서 · 상태 열이 없다(§3 · §5). 해시를 몰라도 전체 조회가 된다. 같은 테이블에 파생 판본 본문을 넣으면 미발행 · 보류 · 철회 판본도 같은 방식으로 읽힌다. anon 은 SELECT 권한이 있으나 정책 조건에 걸려 0행이다.
2. **로그인 사용자는 미발행 도서를 가리키는 `texts` 행을 직접 만들 수 있다(정의에서 따라 나옴)**: authenticated 에 `texts` INSERT · UPDATE 권한과 `library_book_id` · `chapter_idx` 열 권한이 있고(§6), WITH CHECK 는 `user_id` 만 본다(§5). 그 행으로 `get_chapter_content` 를 부르면 SECURITY DEFINER 로 `v_text_content` → `content_chunks` 를 읽어 도서 상태와 무관하게 본문을 돌려준다(§7). `v_text_content` 를 직접 SELECT 하는 경로는 security_invoker 라 `library_chapters_master` 정책에 걸려 미발행 도서 본문이 NULL 이 된다.
3. **anon 은 `status <> 'published'` 인 `library_books` 를 읽을 수 없다**: SELECT 를 허용하는 정책은 `anyone_read_published_safe`(published AND safe)와 `admin_curator_all_books`(anon 은 `auth.uid()` NULL → false) 뿐이다. 챕터 · 어휘도 같은 조건의 EXISTS 정책이다.
4. **철회 · 보관 뒤에도 기존 등록자는 본문을 계속 읽는다(정의에서 따라 나옴)**: `admin_archive_book` · `admin_revert_published_book` · `archive-stale-drafts` 는 `texts` 를 지우지 않고, `get_chapter_content` 는 소유만 확인한다. 반대로 `unenroll_library_book` 은 학습 기록(`texts` → CASCADE 로 `reading_sessions` 등)을 지운다.
5. **`library_books` 행에 자동으로 붙는 동작**: INSERT 시 기본 `status='queued'` 이면 파이프라인 큐 메시지가 생기고(`trg_lb_enqueue`), `copyright_safe_in_kr` 는 입력값과 무관하게 `license` 문자열로 다시 계산된다(`trg_lb_compute_kr_safe`), `published` 로 바뀌면 단어장 발행 트리거가 돈다, `failed` 30일 뒤 `archived`(cron). 발행 전이 경로는 `auto_curate_book`(service_role) · `admin_force_publish_book`(admin · curator, 권리 플래그만 확인) · `admin_curator_all_books` 정책의 직접 UPDATE 다. 파생 판본을 `library_books` 행으로 두면 이 모든 것이 그 행에 적용된다.
6. **발행 트리거와 역할(정의에서 따라 나옴)**: `trg_publish_book_word_sets` → `publish_book_word_sets` → `content_gate_publishable` → `_assert_admin_or_service()` 순서이므로, JWT 역할이 authenticated 인 curator(= `is_admin()` false)의 발행 요청은 트리거 단계에서 42501 로 실패한다. 또 `trg_publish_book_word_sets` 는 INVOKER 이고 `publish_book_word_sets` 의 EXECUTE 가 service_role 에만 있으므로, authenticated 로 `library_books.status` 를 `published` 로 직접 UPDATE 하면(정책상 admin · curator 만 가능) 트리거 안의 `publish_book_word_sets` 호출이 실행 권한 오류로 실패한다. `admin_force_publish_book`(DEFINER) 안에서는 이 권한 검사는 통과한다.
7. **`content_chunks` 에 lcm 참조 없이 넣은 행은 7일 뒤 지워진다**: `ref_count` 는 `library_chapters_master` 증감 트리거로만 오르고(§8), `gc-content-chunks` 가 매일 `ref_count = 0 AND created_at < now() - 7 days` 를 삭제한다(§10). `store_content_chunk` 는 `ref_count = 0` 으로 넣는다.
8. **새 테이블 · 함수의 기본 권한**: `postgres` 가 `public` 에 만드는 새 테이블은 anon · authenticated 에 전 권한(TRUNCATE 포함)이 기본으로 붙고, 새 함수는 `postgres · service_role` 만 실행할 수 있다(§6). TRUNCATE 는 RLS 대상이 아니며, 기존 12개 테이블에도 anon · authenticated TRUNCATE 권한이 있다.
9. **해시 함수**: 코어 `sha256(bytea)` 와 `extensions.digest` 를 모두 쓸 수 있고 DB 인코딩이 UTF8 이다. 기존 `content_chunks.hash` 는 표본 200행에서 `sha256(UTF-8(content))` hex 와 일치했다 — 정본 §8 의 `source_sha256 = sha256(UTF-8(text))` 와 같은 계산식이다(본문이 같으면 같은 값).
10. **이벤트**: 도서 · 리더 · Story 이벤트 이름이 `funnel_events_event_check` 에 없으므로, 새 이벤트를 쓰려면 CHECK 변경(마이그레이션)이 필요하다. 쓰기는 `record_funnel_event` 경유이며 비로그인 호출은 기록되지 않는다.
11. **이름**: `story` · `lcp_story` 이름의 DB 객체 · 마이그레이션은 없다. `storyweaver` 라는 기존 소스 값 · 마이그레이션 이름이 있다.
12. **관리자 신원**: DB 가 인증된 관리자 · 큐레이터로 보는 근거는 `auth.uid()` 의 `user_profiles.role` 뿐이다. curator 는 현재 0명이지만 `is_admin_or_curator()` 로 열리는 모든 경로(도서 ALL 정책 · admin_* RPC)는 curator 에게도 열린다.

## 미확인 · 공백

- `library_book_vocabularies` 정확 count — 첫 묶음 질의가 시간 초과(`The operation timed out.`)로 실패했고 다시 시도하지 않았다. reltuples 추정치만 있다.
- `get_lcp_config()` 본문 — 비밀값(`internal_token`)을 다루는 함수라 의도적으로 읽지 않았다.
- 본문을 읽지 않은 함수: `select_book_chapter_vocab` · `trg_lbv_fill_lemma` · `admin_enqueue_book` · `admin_delete_book` · `enqueue_*_jobs` · `extract_book_vocabulary_admin` · `run_content_quality_gates` · `run_content_quality_gate_details` · `recommend_word_sets_for_user` · 만화 계열(`list_book_comic_catalog` · `list_comic_catalog` · `preview_book_comic` · `select_book_comic*` · `get_comic_format`) · `incr_chunk_refs` · `decr_chunk_refs` · `refresh_textbook_shelf_stats` · `lb_compute_search_vector` · `set_updated_at` · `sync_cefr_from_v_level`. 일부는 정규식 스캔 플래그만 있다(07e · 12b).
- cron 15개 중 도서와 닿는 4개 외에는 명령 본문을 출력하지 않았다(불리언 요약만).
- 「정의에서 따라 나옴」 함의(2 · 4 · 6)는 실제 호출로 확인하지 않았다 — 쓰기가 필요하므로 이 감사 범위 밖이다.
- `content_chunks.hash` 와 본문 해시의 일치는 hash 순 첫 200행 표본만 확인했다(무작위 · 전수 아님).
- 저장소와 live 마이그레이션은 파일 이름 · version 만 비교했다. 내용(`statements`) diff 는 하지 않았다.
- `storage` 버킷 · 객체 정책, `auth` 스키마, `pgmq` 큐 내용(대기 메시지 수)은 감사하지 않았다.
- 01~04 와 05~13 의 관측 사이 약 11시간 동안 다른 세션의 DB 변경 여부는 확인하지 않았다.
- 거부된 도구 호출은 없다. 실패한 질의는 위 시간 초과 1건뿐이다.

---

## S3 결정 — 부모 세션 통합 (2026-10-25)

위 사실 절은 DB 감사 서브에이전트가, 이 절은 부모 세션이 썼다. 코드 경로 근거는 [S3_CODE_PATHS](./S3_CODE_PATHS.md), 계약은 [LCP_STORY §15](../LCP_STORY.md).

### D1. 저장 위치 — 격리 스키마 `story`

- 함의 1 · 2 · 4 · 5 · 8 때문에 Story 판본을 `library_books` · `library_chapters_master` · `content_chunks` · `texts` 에 두지 않는다.
  그 표들에는 검수 없는 발행 경로 · 자동 트리거 · 로그인 사용자 전체 본문 SELECT · 상태 무관 본문 RPC 가 이미 있다.
- 새 스키마 `story`(이름 충돌 0 — §2 · §11, 갱신 지문 20 에서도 0)에 표 12개를 두고, `public` 에는 `story_*` RPC 16개만 둔다. `public` 의 기본 권한(새 표 = anon · authenticated 전 권한,
  새 함수 = service_role 실행, §6)이 Story 에 적용되지 않게 하는 것도 스키마 분리의 이유다. 그래도 SQL 은 스키마(USAGE · CREATE) · 표 · 시퀀스 · 함수 권한을
  PUBLIC · anon · authenticated · service_role 에서 명시적으로 모두 회수하고, RPC 16개도 하나씩 회수한 뒤 필요한 역할에만 준다(Supabase 기본값이 바뀌어도 닫혀 있게).
- 원본 표에 FK 를 걸지 않는다. `library_book` 원천은 등록 RPC 가 `library_books(id, source, source_id)` 를 읽어 대응을 확인하고 그 시점 상태를 기록한다(쓰기 없음).

### D2. 행위자 · 승인 분리

- 관리 행위자 = `auth.uid()` + `user_profiles.role`(admin · curator) + `status='active'`(§12 의 기존 헬퍼는 status 를 보지 않으므로 Story 는 따로 본다).
  service_role(사용자 없음)은 관리 RPC 실행 권한이 없다. 생산자 · 검수자 · 권리 · 출처는 요청 본문의 값을 「주장」으로만 저장하고, 행위자는 DB 가 기록한다.
- DB 가 강제하는 분리는 정확히 이것이다: 검수 계정 ≠ 판본 제출 계정(검수자 세션 주장 ≠ 생산자 세션 주장도) · 발행자 = admin 이고 판본 제출 계정이 아니다 ·
  권리 결정 · 철회 = admin. **검수자와 발행 admin 은 같은 계정이어도 된다** — 정본은 생산과 검수만 나누며, 세 사람(생산 · 검수 · 발행 모두 다름)을 요구하지 않는다.
  그래서 실제 발행에 필요한 인증 계정은 **최소 2개**다(예: curator 제출 + admin 검수 · 발행).
- 현재 운영 계정은 admin 1 · curator 0(§12 · 갱신 지문 20)이라 이 조건을 지금은 채울 수 없다. 두 번째 인증 스태프 계정은 **실제 발행 · 운영의 전제**이며
  빈 스키마 설치(적용)의 전제는 아니다(SQL · preflight 는 계정 수를 검사하지 않는다). T-0169 는 역할을 만들거나 부여하지 않았고 그런 승인도 없다.
  로컬 AI 세션 id 를 스태프 계정으로 쓰지 않는다(세션 id 는 주장일 뿐이다).
- **검증 증인(service_role)** 은 행위자가 아니다: 검증 증명 RPC 2개만 실행할 수 있고, `action_log` 에 `actor_kind='service_validator'` · `actor` 없음으로 남는다.
  생산자 · 검수자 · 권리 결정자 · 발행자로 기록되지 않는다.

### D3. 결속 · 발행 · 철회 · 진도

- DB 가 본문 해시 · 원천 판본 정체 · 기준 · 목표 · 판본 · 활동 · 검수 · release_key 를 S2 와 같은 정본 직렬화로 다시 계산한다(호출자 해시를 믿지 않는다). 함의 9 의 `sha256(UTF-8)` 식과 같다.
- **S2 구조 검증은 SQL 로 다시 구현하지 않는다**(앵커의 UTF-16 구간 · 인용 · 정렬 누락 · 보존 요소 · 변경 기록 · 진입 장면 · 요청 활동). 제출 RPC 의 일부 검사는 방어용일 뿐 S2 검증이 아니며,
  초안 · 검수는 검증 없이 저장된다(학습자에게 보이지 않는다). 대신 발행은 **보호된 검증 증명**(`story.validation_attestations`)을 요구한다:
  백엔드 서비스 주체가 `story_service_validation_input` 으로 저장값 그대로를 받아 S2 어댑터(`packages/library-pipeline/src/story/attest.ts` — `validateSnapshot` ·
  `validatePolicy` · `validateEdition` · 모든 검수 `validateReview`)로 검사하고 `story_service_attest_validation` 으로 쓴다. DB 는 결속(원천 · 정체 · 기준 · 목표 · 판본 · 활동 ·
  그 판의 검수 해시 전부)을 저장값에서 다시 계산해 대조한다. 클라이언트가 보낸 `validated=true` 같은 값은 어디에서도 믿지 않는다. 증명 뒤 검수가 더해지면 결속이 바뀌어 다시 증명해야 한다.
  authenticated · curator · admin 은 증명을 쓸 수 없고(실행 권한 없음 · 표 권한 없음), 증인 RPC 는 JWT 역할 주장이 실제로 `service_role` 이어야 해서
  주장 없는 소유자 · SQL 편집기 · MCP SQL 세션(감사 도구가 쓰는 postgres 세션 포함)도 증명을 쓸 수 없다. 백엔드 어댑터가 배포되지 않은 환경에서는 발행이 막힌다(fail closed).
  증명은 「service_role 자격을 가진 백엔드가 S2 통과를 주장했다」는 신뢰 기록이지 S2 실행의 암호학적 증거가 아니다. 발행은 현재 검증기 계약판
  (`story.current_validator()`)의 증명만 인정하므로, S2 규칙을 올리면 그 함수와 어댑터를 함께 올리는 새 승인 마이그레이션으로 옛 증명을 무효로 만든다.
  `validated_at` 은 DB 시계보다 30초 넘게 앞서면 거부한다(백엔드 시계 동기화 계약).
- 발행 조건: 최신 판(판본 자리 잠금을 쥔 채 계산한 max(seq)) · 그 판의 검수 전부 적격(승인 · 필수 항목 pass · 열린 critical/major 없음) · 발행 admin ≠ 판본 제출자 ·
  원문(+번역) 권리 결정 최신값 confirmed · 자산 없음 · 합성 아님 · **같은 원천 · 같은 판본 키**에 살아 있는 발행본 없음(편집 기준을 다시 등록해 자리가 새로 생겨도) ·
  현재 결속 · 현재 계약판의 검증 증명 있음.
  보류 · 수정 요청 검수가 하나라도 있으면 발행되지 않는다(관리자 초안으로만 남는다).
- **잠금 순서**(관리 · 증인 변경 RPC): `story.sources` → `story.edition_slots` → `story.releases`(FOR UPDATE). 판 제출 · 검수 · 검증 증명 · 발행은 원천 → 자리, 권리 결정은 원천,
  철회는 원천 → 자리 → 발행본. 원천 등록은 잠글 행이 없어 고유 키 충돌을 기존 행 반환으로 처리하고(동시 등록 멱등), 학습자 위치 · 완료 RPC 는 외래 키 KEY SHARE 만 잡는다. 그래서 권리 결정 · 새 판 · 새 검수와 발행이 한 줄로 서고, 발행 · 증명은 READ COMMITTED 에서만 실행돼(`story:read_committed_required`)
  잠금을 얻은 뒤 최신 판 · 검수 · 권리를 새 스냅숏으로 읽는다.
- **권리는 열람 때마다 본다**: 「이용 가능」 = `withdrawn_at is null AND story.source_rights_ok(source_id)` — 필요 권리(source_text, 그리고 원작 언어 ≠ 본문 언어이거나 스냅숏이
  translation 권리를 주장하면 translation)의 최신 인증 결정이 모두 confirmed. 서가 · 본문 · 위치 · 완료 · 내 진도(`release_available`) · 발행이 모두 이 판정을 쓴다.
  나중의 hold · rejected 는 발행본 행을 바꾸지 않고 즉시 열람을 닫으며(이력 · 진도 보존) 다시 confirmed 면 열린다. 쓰지 않는 오디오 · 삽화 결정은 본문을 막지 않는다.
  로컬 plan 의 권리 `hold` 는 스냅숏 주장에서 나온 별개 판정이다 — DB 권리 결정이 그 주장을 고쳐 쓰거나 원천 정체를 바꾸지 않는다(정체 해시는 스냅숏 그대로).
- 철회는 철회 칸만 한 번 채운다(내용 불변). 서가 · 본문 · 진도 기록은 막히고 진도 행 · 기록은 남는다. 같은 내용을 다시 내려면 새 검수가 필요하다(같은 release_key 재사용 불가).
- **위치 ≠ 완료**: `story_record_position` 은 이동(last · furthest)만 기록하고 단위 완료 · 발행본 완료를 만들지 않는다. `story_complete_unit` 은 학습자가 단위 하나를
  명시적으로 「읽었다」고 표시한다(중복 무해, 위치도 그 단위로 옮긴다). 발행본 완료(`completed_at`)는 0..unit_count-1 모든 단위에 완료 기록이 있을 때 한 번만 찍힌다 —
  마지막 단위로 건너뛰거나 중간이 빠지면 완료가 아니다. 진도는 `(user_id, release_id)` 로만 쌓이고 원본 `texts` · 숙달 · FSRS 표를 건드리지 않으며 다른 판본 · 발행본으로 승계하지 않는다.
  완료 이름은 각색 전권/각색 일부이며 원문 완독이 아니다(`counts_as_original_text_completion=false`).

### D4. 영향 · 권한 · 복구 · 적용 전제

- 영향: 원본 행 0 · 원본 객체 변경 0. 새 객체 = 스키마 1 · 표 12 · 함수 32(내부 16 + RPC 16) · 트리거 24 · 명시 색인 5 · identity 시퀀스 3. 적용 러너가 트랜잭션 안에서 원본 지문
  (`library_books` · `user_profiles` · `texts` · `content_chunks` · `reading_sessions`)을 본문 전후로 재고 다르면 전체 롤백한다. 재는 범위는 러너 `FINGERPRINT_SCOPE` 가 정본이다:
  표마다 행 수 + 정렬한 행별 `md5(row::text)` 의 md5(모든 사용자 열 — 행 추가 · 삭제 · 값 변경을 잡지만 같은 값으로 다시 쓰는 UPDATE 는 못 잡는다)와
  카탈로그 원 열 정의(pg_class · pg_attribute · 기본값 · 제약 · 트리거 · 정책 · 색인 · 규칙 · 권한). 복구 단계는 여기에 `story` 표 12개와 Story 함수 정의를 더한다.
  전 · 후 지문은 쓰기 트랜잭션 안의 한 REPEATABLE READ 스냅숏에서 읽는다(무관한 동시 커밋은 보이지 않는다). 그보다 넓게 주장하지 않는다.
- 적용 경로: 단계 SQL 본문과 원장(`supabase_migrations.schema_migrations`) 행을 한 트랜잭션으로 적용하고 실패하면 전부 되돌린다. 1회용 승인 티켓은 TTY 여부와 관계없이 항상 필요하며
  (위치 · 해시 · 정적 SQL 정책 · 커밋 상태 검사와 읽기 전용 preflight 를 통과한 뒤에만 소비), main-serving(`dev-mode.json` 의 `main_worktree` realpath) 밖에서는 적용을 거절한다.
- 권한 행렬: 관리 RPC 9 = authenticated(내부 역할 검사) · 검증 증인 RPC 2 = service_role 만 · 서가 1 = anon + authenticated · 학습 RPC 4 = authenticated ·
  service_role 은 증인 RPC 2개 외 실행 0 · `story` 스키마/표/시퀀스/함수 = 클라이언트 역할(PUBLIC · anon · authenticated · service_role) 0.
- 복구: `_pending_lcp_story_s3_quarantine.sql` — 모든 `public.story_*` 실행 회수(표 · 이력 보존, DROP 없음). 완전 제거(DROP SCHEMA)는 이력 삭제라 별도 명시 승인 대상.
  다시 열기는 러너에 단계가 없다 — 새 SQL 파일 · 새 러너 단계 · 새 사용자 승인이 필요하다.
- 적용 전제: 사용자 대화 승인(SQL 전문 · 전체 SHA-256 · 영향 · 복구) → 러너 · SQL 이 main 에 통합된 뒤 main-serving(`main` 브랜치)에서
  `scripts/db/lcp-story-s3/deploy.mjs preflight|apply|verify`(`VF_DEPLOY_DB_URL` · `--deps <pg 폴더>` · 필요하면 `--ca <Supabase 루트 PEM>` — 인증서 검증은 끌 수 없다) ·
  승인 전 실제 TLS preflight(아직 미실행) · S4 에서 anon 실행 기준선(`pnpm db:anon-grants:update`, `story_catalog` 1개 증가)을 같은 커밋에 갱신.
  (두 번째 스태프 계정은 적용이 아니라 실제 발행의 전제다 — D2.)

### D5. 이 결정이 고치지 않는 것

- 함의 1 · 2 · 4(원본 `content_chunks` 전체 SELECT · `get_chapter_content` 상태 무관 · 철회 뒤 기존 등록자 열람)는 **원본 LCP 의 기존 노출**이다. Story 는 그 경로를 쓰지 않아 영향을 받지 않지만,
  원본 쪽 결함 자체는 남는다. 고치려면 원본 정책 · 함수 변경(기존 학습 이력 · 리더 동작 영향)이 필요해 별도 작업 · 승인 대상이다.
- DB 는 원문 앵커의 UTF-16 오프셋 · 인용을 다시 검증하지 않는다(Postgres 문자 단위와 JS UTF-16 단위가 다르다). 그 검사는 S2 어댑터가 하고 DB 는 증명을 요구한다(D3).
  **어댑터를 실제로 돌리는 백엔드 런타임(service_role 로 두 증인 RPC 를 부르는 서버 경로)은 아직 없다** — S4 범위이며, 그 전까지 공유 DB 에 적용돼도 발행은 막힌다.
- 계정이 사람인지 에이전트인지는 DB 가 구분하지 않는다(`human_review` 는 여전히 주장). 사람 검수 여부를 근거로 쓰려면 계정 분류 기록이 따로 필요하다.
- Story 위치 · 단위 완료 기록을 지우는 경로가 없다(불변 트리거 · `auth.users` FK 없음). 계정 삭제 때의 처리는 정하지 않았다 — 별도 승인 설계 대상이다.
- 단위 완료는 학습자의 명시 표시다(`story_read_unit` 호출과 묶지 않는다). `completed_at` 을 「실제로 읽었다」의 증거로 S7 측정에 쓰지 않는다.


## 후속 승인 적용 — 2026-10-25

사용자는 SQL 전문·전체 SHA·영향·복구를 확인하고 “승인함.”으로 승인한 뒤 “Supabase MCP 읽기 전용-> 권한 부여 하는 것으로 진행해줘.”로 MCP 쓰기 연결을 명시적으로 요청했다. 중앙 정책·정본 MCP 설정·Claude 네이티브 확인 훅을 이 지시에 맞췄다. 러너 티켓이나 AI-Control의 사람 전용 승인을 만들지 않았다.

첫 MCP 적용 요청은 이전 완료 CSAT 작업의 `.agent-goal.md` 승인 파일 경로가 남아 있어 Codex 작업 게이트에서 차단됐다. SELECT로 Story 스키마·이력이 없음을 확인하고 이전 문서를 보존한 뒤 실제 대화 승인과 현재 파일/SHA를 연결했다. 게이트 코드·환경·캐시를 바꾸지 않았으며 동일 검사 통과 뒤 다시 요청했다.

- 서버 원장: `20261025094450` · `lcp_story_s3_schema` · 저장 statements 1개. 저장 SQL SHA-256 = `09fb0dc48e49530c50f8fbe0cb1f06ef128fc5be9be103b1bdc6e8b3d85b560c`(승인 원본과 정확히 일치). 적용 응답 success=true.
- 사후 검사: 러너의 `VERIFY_SQL.schema`를 그대로 SELECT로 실행, **15 통과 · 실패 0**. 표 12개 RLS·초기 행 0 · RPC 16개 · 스키마/표/시퀀스 권한 · 역할별 실행 권한 · definer/search_path · 가드/계약 열을 확인했다.
- 원본 5표(`library_books`, `user_profiles`, `texts`, `content_chunks`, `reading_sessions`)의 전체 행 내용 및 원시 정의 지문 **10개 모두 적용 전후 동일**. 측정 범위를 다른 표·기능으로 넓혀 주장하지 않는다.
- 승인된 SQL 파일을 서버 원장 버전의 파일명으로 옮겼으며 바이트·SHA는 보존했다. SQL 안 보류/옛 경로 주석은 승인 당시 원문이다. 러너 STAGES 및 격리 하네스 경로도 실제 버전에 맞췄다.
- 복구 SQL은 **미적용**. 실제 공유 DB에서 러너 apply/TLS 경로, 인증된 제작·검수·발행, 실제 학습자 파일럿은 실행하지 않았다. MCP API의 본문+원장 원자성은 이 성공 결과만으로 별도 증명했다고 주장하지 않는다.
- 원자료: AI-Control `runtime/lcp-story-20261025/mcp-schema-before-bound.json`, `mcp-schema-after.json`, `mcp-permission-approved-context.json`, `mcp-schema-ledger.json`.
- 최종 파일 경로·실제 원장 버전 반영 뒤 검증: PostgreSQL 17.10 격리 하네스 **59 통과 · 실패 0 · not_run 0**, 결과의 입력 경로도 적용 파일과 일치(`mcp-final-pg17.json`). 훅/설정 테스트 15 · 러너 테스트 26 · 설정 검사 13을 통과했다. 독립 검토의 유일한 지적(하네스 결과가 삭제된 보류 경로를 출력)은 수정 후 별도 재확인했다. `pnpm.cmd docs:db-stats`도 실행해 자동 생성 블록을 갱신했다.
