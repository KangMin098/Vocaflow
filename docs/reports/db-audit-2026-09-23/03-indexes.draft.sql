-- ===== [0] A-1. 뜨거운 표 → CONCURRENTLY 필수 · **MCP 로는 25001 로 거부되므로 psql 필요**
-- psql "postgresql://postgres:<비밀번호>@db.jajenrevcbmrpaliomxv.supabase.co:5432/postgres"
-- 비밀번호: Supabase 대시보드 -> Project Settings -> Database (저장소 .env* 에는 없다)
-- 한 문장씩 실행한다.
set statement_timeout = 0;
set lock_timeout = '30s';

-- shared_dictionary — 분류 스프린트 잔여물 16개 (약 20.2 MB)
--   주의: idx_sd_spelling_variants · idx_sd_dmetaphone · idx_sd_base_word 는 지우지 않는다(§②-A 하단).
drop index concurrently if exists public.idx_sd_domain_levels;                   -- 5656 kB
drop index concurrently if exists public.idx_shared_dictionary_field_provenance; -- 5560 kB
drop index concurrently if exists public.idx_sd_track_levels;                    -- 5496 kB
drop index concurrently if exists public.idx_sd_classified_by;                   --  992 kB
drop index concurrently if exists public.idx_sd_skill_level_rule_v1;             --  976 kB
drop index concurrently if exists public.idx_dict_source;                        --  960 kB
drop index concurrently if exists public.idx_sd_lemma_band;                      --  960 kB
drop index concurrently if exists public.idx_sd_skill_level;                     --  944 kB
drop index concurrently if exists public.idx_sd_v_level_rule_v1;                 --  896 kB
drop index concurrently if exists public.idx_sd_claude_classified_at;            --  784 kB
drop index concurrently if exists public.idx_shared_dictionary_register;         --  776 kB
drop index concurrently if exists public.idx_shared_dict_cefrj_band;             --  200 kB
drop index concurrently if exists public.idx_sd_derivation_suffix;               --  152 kB
drop index concurrently if exists public.idx_shared_dictionary_quality_audit;    --   56 kB
drop index concurrently if exists public.idx_shared_dictionary_archived;         --   16 kB
drop index concurrently if exists public.idx_shared_dictionary_has_audio;        --    8 kB
--   마지막 것은 apps/web/src/lib/admin/dict/schema-evolution-suggestions.ts:266 의
--   제안 문자열도 같은 커밋에서 지운다 — 안 지우면 콘솔이 다시 만들라고 권한다.

-- shared_word_sets — 연산자 클래스가 틀린 GIN (초안 B-2 가 대체한다)
drop index concurrently if exists public.idx_sws_curation_query_book;            --  640 kB

-- library_books — 전문검색·trgm 소비자 0건
drop index concurrently if exists public.idx_lb_title_trgm;                      --  264 kB
drop index concurrently if exists public.idx_lb_author_trgm;                     --  232 kB
drop index concurrently if exists public.idx_lb_search;                          --  152 kB
drop index concurrently if exists public.idx_lb_category;                        --   48 kB

-- csat_* — 접두사 중복 (UNIQUE 쪽이 같은 패턴을 받는다 · §③ #3 #5 #7)
drop index concurrently if exists public.csat_reviews_analysis_idx;              --  272 kB
drop index concurrently if exists public.csat_analyses_item_idx;                 --   88 kB
drop index concurrently if exists public.csat_item_reviews_item_idx;             --   40 kB

-- ===== [1] A-2. 차가운 표 → 평범한 `DROP INDEX` (마이그레이션·MCP 로 가능)
-- supabase/migrations/<ts>_drop_unused_indexes_20260923.sql
-- 근거: db-audit/03-indexes.md §② §③
--   통계 창 2026-09-15 13:35 ~ 09-23 (7.39일) · 창 내 public 인덱스 스캔 7,470만
--   + 코드·pg_proc 소비자 전수 확인 + 생성 시점 2주 초과 확인 (3중 근거)
-- 되돌리기: 전부 CREATE INDEX 로 복구 가능(정의는 그 문서의 표에 그대로 있다).

begin;

-- topic_word_stats — 소비자는 upsert(UNIQUE)와 전량 집계뿐 (seq 55회 / 523만행)
drop index if exists public.idx_tws_df;                    -- 2696 kB
drop index if exists public.idx_tws_word;                  -- 1968 kB

-- lexicon_clean — lang 은 쓰기 전용 (표 idx_scan 3)
drop index if exists public.idx_lexicon_clean_lang;        -- 1280 kB

-- dictionary_word_categories — (word) 는 PK (word, category_id) 의 접두사 · cefr 는 선두 불일치
drop index if exists public.idx_word_cat_word;             -- 1432 kB
drop index if exists public.idx_word_cat_cefr;             --  712 kB

-- funnel_events — 유일 소비자가 WHERE 없이 전량 읽는다 (seq 302회 / 185만행)
drop index if exists public.funnel_events_user_idx;        --  728 kB

-- topic_corpus_docs — harvested_at 정렬 소비자 없음 (idx_tcd_hash 는 남긴다)
drop index if exists public.idx_tcd_source;                --  560 kB

-- word_frequency_stats — 표 전체 idx_scan 3 · 쓰기 0 · idx_freq_lexicon 은 UNIQUE 접두사
drop index if exists public.idx_freq_metadata_gin;         --  360 kB
drop index if exists public.idx_freq_lexicon;              --  224 kB
drop index if exists public.idx_freq_source_rank;          --  184 kB
drop index if exists public.idx_freq_source_tier;          --   64 kB
drop index if exists public.idx_freq_every_year;           --    8 kB

-- 접두사 중복 나머지 (§③ #2 #6 #8 #9 #10 #11 #12 #13)
drop index if exists public.idx_freq_lemma;                --  344 kB  <- (lemma, source_id)
drop index if exists public.idx_lcq_book_chapter;          --   80 kB  <- library_chapter_quiz_uniq
drop index if exists public.idx_compose_sources_batch;     --   16 kB  <- uq_compose_source_url
drop index if exists public.idx_compose_jobs_batch;        --   16 kB  <- uq_compose_job
drop index if exists public.idx_comic_pages_book_chapter;  --   16 kB  <- comic_pages_uniq
drop index if exists public.methodology_claims_method;     --   16 kB  <- 4컬럼 UNIQUE
drop index if exists public.idx_article_seed_source;       --   16 kB  <- (source, source_id) UNIQUE
drop index if exists public.idx_vocab_raw_run;             --    8 kB  <- (run_id, content_hash) UNIQUE

commit;

-- ===== [2] B-1. 최우선 — CONCURRENTLY 필수 · **MCP 로는 25001 로 거부되므로 psql 필요**
-- psql 세션 모드(:5432) · 한 문장씩
set statement_timeout = 0;
set lock_timeout = '30s';

-- 근거: pg_stat_statements 1위 (16,413회 · 13,897초 = 3.9h · 평균 847ms)
--       호출자 scripts/textbook/explain-fill.mjs:132 · explain-discriminate.mjs:64
--       현재: 흔한 유형 = pkey 스캔+Filter(263ms) / 드문 유형 = UNIQUE 전량+Sort(1,483ms · 9,162 buffers)
--       기대: Index Cond(type=X AND id>Y) · Sort 제거 · buffers 두 자리
-- 비용: 약 35~45 MB · 880,760행 · 인덱스 6->7 (non-HOT UPDATE 282,987건에 +17% 항목 삽입)
--       평범한 CREATE INDEX 로 만들면 빌드 동안 이 표의 쓰기가 잠긴다 —
--       해설 드레인이 단건 UPDATE 를 계속 넣는 표다. CONCURRENTLY 로만 만든다.
create index concurrently if not exists idx_dcp_items_type_id
  on public.csat_dcp_items (type, id);

-- 확인 ①: indisvalid = false 인 잔여물이 없어야 한다 (0행이어야 정상)
select c.relname, i.indisvalid from pg_index i
  join pg_class c on c.oid = i.indexrelid
  join pg_class t on t.oid = i.indrelid
 where t.relname = 'csat_dcp_items' and not i.indisvalid;

-- 확인 ②: 같은 파라미터로 재측정 (Sort 가 사라지고 Index Cond 에 두 조건이 들어와야 한다)
explain (analyze, buffers) select id, type, payload, answer_key from public.csat_dcp_items
 where type = 'long_order' and id > '00000000-0000-0000-0000-000000000000'::uuid
 order by id asc limit 200;

-- ===== [3] B-2 · B-3. 작은 표 → 마이그레이션·MCP 로 가능 (락이 ms 단위)
-- supabase/migrations/<ts>_index_curation_query_book_and_fk_children.sql
-- 근거: db-audit/03-indexes.md §④-2 · §④-3
begin;

-- ① 학습자 화면 4곳이 Seq Scan 805ms (11,312행 전량 Filter) 중이다.
--    기존 GIN(jsonb_path_ops)은 ->> 등호를 원리적으로 못 받는다 -> 초안 A-1 에서 지운다.
--    호출자: (main)/text/[id]/layout.tsx:271 · (main)/wordvault/browse/page.tsx:81
--            lib/comic/vocab-integrity.ts:81 · lib/dictation/source.ts:385
create index if not exists idx_sws_curation_book_id
  on public.shared_word_sets ((curation_query->>'book_id'));

-- ② FK 자식 인덱스 4개 — 부모 삭제가 실제로 일어나는 경로만.
--    admin_delete_book RPC 가 library_books 를 DELETE 하고(큐레이션 "-> 소스 GET"),
--    shared_word_sets 는 창 안에서 n_tup_del = 124 로 실제 삭제된다.
create index if not exists idx_archaic_candidates_first_book
  on public.archaic_candidates (first_seen_book_id);          -- 자식 10 MB · SET NULL
create index if not exists idx_lsc_imported_book
  on public.library_seed_catalog (imported_book_id);          -- 자식 2872 kB · SET NULL
create index if not exists idx_sws_parent_version
  on public.shared_word_sets (parent_version_id);             -- 자식 8352 kB · 자기참조 SET NULL
create index if not exists idx_vocabularies_shared_set
  on public.vocabularies (shared_set_id);                     -- 자식 2592 kB · SET NULL

commit;