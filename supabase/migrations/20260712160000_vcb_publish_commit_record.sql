-- VCB 발행 트랜잭션 RPC 기록 (스키마 드리프트 복구 · 2026-07-12).
--
-- 발견: vcb_publish_commit(발행 전량이 의존, publish.ts + scripts/vcb/08-publish.ts)가
--   committed 마이그레이션에 부재 — 정의가 docs/proposals/vcb-p07-publish-rpc.sql("미적용" 표기)에만 존재했음.
--   DB 실측: 함수가 라이브에 존재(발행 정상 작동). 본 파일은 현 DB 정의를 pg_get_functiondef 로 덤프해
--   마이그레이션 이력에 기록(동작 변경 0 — CREATE OR REPLACE 동일본). 신규 DB 재구축 시 Step8 발행 재현 가능.
--
-- 세트→단어→word_count→컬렉션→run.status='published' 단일 트랜잭션(SECURITY DEFINER).

CREATE OR REPLACE FUNCTION public.vcb_publish_commit(
  p_run_id bigint, p_slug text, p_version integer, p_title text, p_category text,
  p_source_attributions jsonb, p_words jsonb, p_published_by text DEFAULT NULL::text)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare
  v_set_id        uuid;
  v_collection_id bigint;
  v_count         integer;
begin
  insert into shared_word_sets
    (slug, version, title, category, is_published, source_run_id, source_attributions)
  values
    (p_slug, p_version, p_title, p_category, true, p_run_id,
     coalesce(p_source_attributions, '[]'::jsonb))
  returning id into v_set_id;

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

  update shared_word_sets set word_count = v_count where id = v_set_id;

  insert into vocab_collections
    (run_id, slug, title, version, published_word_count, shared_word_set_id, notes)
  values
    (p_run_id, p_slug, p_title, p_version, v_count, v_set_id,
     case when p_published_by is not null then 'published_by=' || p_published_by else null end)
  returning id into v_collection_id;

  update vocab_runs set status = 'published' where id = p_run_id;

  return jsonb_build_object(
    'shared_word_set_id', v_set_id,
    'collection_id',      v_collection_id,
    'published_count',    v_count,
    'version',            p_version
  );
end;
$function$;
