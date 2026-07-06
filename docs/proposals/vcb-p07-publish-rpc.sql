-- docs/proposals/vcb-p07-publish-rpc.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- P0-7 완전 트랜잭션 publish — **검토용 초안 (미적용)**.
-- 메모리 규칙: 마이그레이션은 SQL 보여주고 승인 후 apply_migration. 이 파일은 리뷰 아티팩트.
--
-- 목적:
--   현재 publish.ts 는 shared_word_sets → shared_words → vocab_collections → run status
--   를 JS 에서 순차 insert 한다(비원자적). 중간 실패 시 부분 상태(orphan 발행 세트)가 남는다.
--   (커밋 679bd70 이 JS 보상 롤백으로 완화했으나, delete 자체 실패/경합 시 완벽하지 않음.)
--   본 RPC 는 전체를 **단일 함수(=단일 트랜잭션)** 로 묶어 실패 시 전량 롤백 → orphan 원천 차단.
--   덤으로 shared_word_sets.word_count 를 실제 삽입 수로 동기화(기존 JS 경로는 0 방치 → 캐시 불일치 경고).
--
-- 보안:
--   실행 권한을 service_role 로만 제한(REVOKE public/anon/authenticated).
--   서버(publish.ts)가 requireAdmin 통과 후 service_role 클라이언트(createAdminClient)로 rpc 호출 →
--   일반 사용자의 PostgREST 직접 호출 차단. SECURITY DEFINER + search_path 고정.
--
-- 적용 후 publish.ts 변경(별도, 이 SQL 승인·적용 시 함께):
--   try 블록의 3개 insert + 2개 status update → 아래 한 줄로 치환:
--     const { data, error } = await client.rpc('vcb_publish_commit', {
--       p_run_id: runId, p_slug: run.collection_slug, p_version: nextVersion,
--       p_title: run.collection_title, p_category: category,
--       p_source_attributions: await buildSourceAttributions(client, runId),
--       p_words: items.map((it, idx) => ({ ...shared_words 컬럼... , sort_order: idx })),
--       p_published_by: ctx.published_by ?? null,
--     })
--   status='publishing' 세팅은 유지, catch 는 status='curating' 리셋만(보상 롤백 제거 — RPC 가 원자적).
-- ─────────────────────────────────────────────────────────────────────────────

create or replace function public.vcb_publish_commit(
  p_run_id              bigint,
  p_slug                text,
  p_version             integer,
  p_title               text,
  p_category            text,
  p_source_attributions jsonb,
  p_words               jsonb,          -- shared_words row 배열 (JS 가 구성)
  p_published_by        text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_set_id        uuid;
  v_collection_id bigint;
  v_count         integer;
begin
  -- 1) 발행 세트
  insert into shared_word_sets
    (slug, version, title, category, is_published, source_run_id, source_attributions)
  values
    (p_slug, p_version, p_title, p_category, true, p_run_id,
     coalesce(p_source_attributions, '[]'::jsonb))
  returning id into v_set_id;

  -- 2) 단어 (JSONB 배열 → 행). text[] 컬럼은 jsonb 배열 → array 변환.
  insert into shared_words
    (set_id, word, meaning_ko, example_en, pronunciation, part_of_speech,
     cefr_level, sort_order, ipa, definitions_ko_full, definitions_en_full,
     examples_full, synonyms, antonyms, collocations, korean_learner_note,
     confidence, source_run_id, source_queue_id)
  select
    v_set_id,
    w->>'word',
    coalesce(w->>'meaning_ko', ''),
    w->>'example_en',
    w->>'pronunciation',
    w->>'part_of_speech',
    w->>'cefr_level',
    coalesce((w->>'sort_order')::int, 0),
    w->>'ipa',
    w->'definitions_ko_full',
    w->'definitions_en_full',
    w->'examples_full',
    array(select jsonb_array_elements_text(coalesce(w->'synonyms', '[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(w->'antonyms', '[]'::jsonb))),
    array(select jsonb_array_elements_text(coalesce(w->'collocations', '[]'::jsonb))),
    w->>'korean_learner_note',
    (w->>'confidence')::numeric,
    p_run_id,
    (w->>'source_queue_id')::bigint
  from jsonb_array_elements(p_words) as w;

  get diagnostics v_count = row_count;
  if v_count = 0 then
    raise exception 'no publishable words';
  end if;

  -- 3) word_count 캐시 동기화 (기존 JS 경로는 0 방치 → "캐시 불일치" 경고 원인)
  update shared_word_sets set word_count = v_count where id = v_set_id;

  -- 4) 컬렉션 레코드
  insert into vocab_collections
    (run_id, slug, title, version, published_word_count, shared_word_set_id, notes)
  values
    (p_run_id, p_slug, p_title, p_version, v_count, v_set_id,
     case when p_published_by is not null then 'published_by=' || p_published_by else null end)
  returning id into v_collection_id;

  -- 5) run 상태 전이
  update vocab_runs set status = 'published' where id = p_run_id;

  return jsonb_build_object(
    'shared_word_set_id', v_set_id,
    'collection_id',      v_collection_id,
    'published_count',    v_count,
    'version',            p_version
  );
  -- 예외 발생 시 함수 전체 롤백 → 부분 상태/ orphan 불가 (별도 exception 핸들러 불필요).
end;
$$;

-- 실행 권한: 서버(service_role)만. 일반 사용자 직접 호출 차단.
revoke all on function public.vcb_publish_commit(bigint, text, integer, text, text, jsonb, jsonb, text) from public;
revoke all on function public.vcb_publish_commit(bigint, text, integer, text, text, jsonb, jsonb, text) from anon;
revoke all on function public.vcb_publish_commit(bigint, text, integer, text, text, jsonb, jsonb, text) from authenticated;
grant execute on function public.vcb_publish_commit(bigint, text, integer, text, text, jsonb, jsonb, text) to service_role;
