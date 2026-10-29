-- mc-story-act-prep-3.apply.sql  (APPROVAL CANDIDATE — 미적용 · 사용자 승인 전 실행 금지 · v2 초안 c1a4e446… 를 보정)
-- 프로젝트: vocaflow-dev jajenrevcbmrpaliomxv · 역할: 함수 소유자(마이그레이션 실행자) · 실행 권한: authenticated 만
-- 목적: Story 발행본의 사실형 근거 선택 활동 하나를 정답 없이 보여 주고(조회), 명시적 제출 1회에 그 활동만 판정해 돌려준다(제출).
-- 이번 UI 연결 범위: live r3 발행본(lsr_58490bbd38131e1b2e536c5fe08179e8)의 why-horner-is-safe 하나.
-- API 적용 범위(함수가 실제로 받는 것): 어떤 live 발행본이든 interaction='choose_evidence' AND answer.basis='factual'
--   AND answer.correct 가 정확히 1개 AND 아래 결속 검사를 모두 통과하는 활동. 현재 live 발행본에서 이를 만족하는 활동은 why-horner-is-safe 1개뿐(2026-10-29 SELECT).
-- 쓰기 0 · 부수 동작 0(INSERT/UPDATE/DELETE/알림/이벤트 없음) · 새 테이블·시도 기록·토큰 없음 · 서비스 키 경로 없음.
-- 실패하면 모두 예외(fail-closed) — 예외 경로는 정답 자료를 돌려주지 않는다.
-- 관문 순서(기존 story_reader_context / story_unit_context_notes 와 같은 결속):
--   ① story.require_learner(로그인·계정 상태) ② live release + source_rights_ok ③ 발행본이 가리키는 불변 판 + 판 내용·활동 정본 해시 재계산·artifact.binding = 발행 결속
--   ④ 활동 id 유일 ⑤ 지원 형태·정답 정확히 1개·정답∈선택지 ⑥ option_id 유일·각 옵션의 unit 이 이 release 에 있고 quote = 이 release 본문의 [start,end) ⑦ 본인 진도 ≥ after_unit
-- 오프셋: 저장 계약은 UTF-16 code unit. PG substr 은 문자(code point) 단위라 보조 평면 문자가 있는 본문에서는 ⑥이 불일치로 닫힌다(정답을 내지 않는 방향).

CREATE OR REPLACE FUNCTION public.story_unit_activity(p_release_key text, p_activity_id text, p_choice text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = pg_catalog, pg_temp
AS $fn$
declare
  v_user uuid := story.require_learner();
  v_release story.releases;
  v_artifact jsonb;
  v_act jsonb;
  v_act_count integer;
  v_correct jsonb;
  v_after_index integer;
  v_furthest integer;
  v_options jsonb;
  v_opt_count integer;
  v_opt_distinct integer;
  v_bad integer;
begin
  if p_activity_id is null or pg_catalog.btrim(p_activity_id) = '' then
    raise exception 'story:activity_not_found';
  end if;
  if p_choice is not null and pg_catalog.btrim(p_choice) = '' then
    raise exception 'story:activity_bad_choice';
  end if;

  select * into v_release from story.releases rl where rl.release_key = p_release_key and rl.withdrawn_at is null;
  if not found or not story.source_rights_ok(v_release.source_id) then
    raise exception 'story:release_unavailable';
  end if;

  -- ③ 발행본이 가리키는 불변 판 · 판 내용 해시 · 활동 해시 · binding = 발행 결속
  select ev.artifact into v_artifact from story.edition_versions ev
   where ev.id = v_release.edition_version_id and ev.slot_id = v_release.slot_id
     and ev.edition_sha256 = v_release.edition_sha256 and ev.activities_sha256 = v_release.activities_sha256
     and ev.unit_count = v_release.unit_count;
  if not found
     or v_artifact ->> 'edition_key' is distinct from v_release.edition_key
     or v_artifact ->> 'kind' is distinct from v_release.kind
     or story.canonical_sha256(v_artifact - 'activities') is distinct from v_release.edition_sha256
     or story.canonical_sha256(v_artifact -> 'activities') is distinct from v_release.activities_sha256
     or (v_artifact -> 'binding') is distinct from pg_catalog.jsonb_build_object(
          'source_sha256', v_release.source_text_sha256,
          'source_identity_sha256', v_release.source_identity_sha256,
          'policy_sha256', v_release.policy_sha256,
          'target_sha256', v_release.target_sha256)
     or pg_catalog.jsonb_typeof(v_artifact -> 'activities') is distinct from 'array' then
    raise exception 'story:activity_mismatch' using detail = 'edition';
  end if;

  -- ④ 활동 id 유일
  select pg_catalog.count(*)::integer into v_act_count
    from pg_catalog.jsonb_array_elements(v_artifact -> 'activities') as t(a) where a ->> 'activity_id' = p_activity_id;
  if v_act_count = 0 then
    raise exception 'story:activity_not_found';
  elsif v_act_count > 1 then
    raise exception 'story:activity_mismatch' using detail = 'activity_id';
  end if;
  select a into v_act from pg_catalog.jsonb_array_elements(v_artifact -> 'activities') as t(a) where a ->> 'activity_id' = p_activity_id;

  -- ⑤ 지원 형태 · 정답 정확히 1개(문자열)
  v_correct := v_act #> '{task,answer,correct}';
  if v_act #>> '{task,interaction}' is distinct from 'choose_evidence'
     or v_act #>> '{task,answer,basis}' is distinct from 'factual'
     or pg_catalog.jsonb_typeof(v_correct) is distinct from 'array'
     or pg_catalog.jsonb_array_length(v_correct) <> 1
     or pg_catalog.jsonb_typeof(v_correct -> 0) is distinct from 'string'
     or pg_catalog.jsonb_typeof(v_act #> '{task,options}') is distinct from 'array'
     or pg_catalog.jsonb_array_length(v_act #> '{task,options}') = 0 then
    raise exception 'story:activity_unsupported';
  end if;

  -- ⑥ 선택지 결속: option_id 문자열·유일 · unit 이 이 release 에 있음 · offset 정수 · quote = 이 release 본문 구간
  select pg_catalog.count(*)::integer, pg_catalog.count(distinct o ->> 'option_id')::integer
    into v_opt_count, v_opt_distinct
    from pg_catalog.jsonb_array_elements(v_act #> '{task,options}') as t(o);
  select pg_catalog.count(*)::integer into v_bad
    from pg_catalog.jsonb_array_elements(v_act #> '{task,options}') as t(o)
    left join story.release_units ru on ru.release_id = v_release.id and ru.unit_id = o ->> 'unit_id'
   where pg_catalog.jsonb_typeof(o -> 'option_id') is distinct from 'string'
      or pg_catalog.jsonb_typeof(o -> 'quote') is distinct from 'string' or o ->> 'quote' = ''
      or ru.unit_index is null
      or (o ->> 'start') !~ '^(0|[1-9][0-9]{0,8})$' or (o ->> 'end') !~ '^[1-9][0-9]{0,8}$'
      or (o ->> 'start')::integer >= (o ->> 'end')::integer
      or pg_catalog.substr(ru.body, (o ->> 'start')::integer + 1, (o ->> 'end')::integer - (o ->> 'start')::integer) is distinct from (o ->> 'quote');
  if v_bad > 0 or v_opt_count <> v_opt_distinct then
    raise exception 'story:activity_mismatch' using detail = 'options';
  end if;
  if not exists (select 1 from pg_catalog.jsonb_array_elements(v_act #> '{task,options}') as t(o) where o ->> 'option_id' = v_correct ->> 0) then
    raise exception 'story:activity_mismatch' using detail = 'answer';
  end if;

  -- ⑦ 노출: after_unit 이 이 release 에 있고 본인 진도가 그 위치 이상(위치 조건일 뿐 읽음·이해 증거 아님)
  select ru.unit_index into v_after_index from story.release_units ru
   where ru.release_id = v_release.id and ru.unit_id = v_act ->> 'after_unit_id';
  if v_after_index is null then
    raise exception 'story:activity_mismatch' using detail = 'after_unit';
  end if;
  select rp.furthest_unit_index into v_furthest from story.reading_progress rp
   where rp.user_id = v_user and rp.release_id = v_release.id;
  if v_furthest is null or v_furthest < v_after_index then
    raise exception 'story:activity_locked';
  end if;

  -- 선택지 투영 — 이 release 의 unit_index 로만(다른 release/unit 의 본문은 쓰지 않는다). 정답 키 없음.
  select pg_catalog.jsonb_agg(pg_catalog.jsonb_build_object(
           'option_id', o -> 'option_id',
           'unit_index', ru.unit_index,
           'start', o -> 'start', 'end', o -> 'end', 'quote', o -> 'quote') order by t.n)
    into v_options
    from pg_catalog.jsonb_array_elements(v_act #> '{task,options}') with ordinality as t(o, n)
    join story.release_units ru on ru.release_id = v_release.id and ru.unit_id = o ->> 'unit_id';

  if p_choice is null then
    return pg_catalog.jsonb_build_object(
      'release_key', v_release.release_key,
      'activity_id', v_act -> 'activity_id',
      'prompt', v_act -> 'prompt',
      'claim', v_act #> '{task,claim}',
      'options', v_options,
      'offset_unit', 'utf16_code_unit');
  end if;

  if not exists (select 1 from pg_catalog.jsonb_array_elements(v_options) as x(o) where o ->> 'option_id' = p_choice) then
    raise exception 'story:activity_bad_choice';
  end if;
  return pg_catalog.jsonb_build_object(
    'release_key', v_release.release_key,
    'activity_id', v_act -> 'activity_id',
    'choice', p_choice,
    'correct', (v_correct ->> 0) = p_choice,
    'chosen', (select o from pg_catalog.jsonb_array_elements(v_options) as x(o) where o ->> 'option_id' = p_choice),
    'registered_evidence', (select o from pg_catalog.jsonb_array_elements(v_options) as x(o) where o ->> 'option_id' = v_correct ->> 0),
    'offset_unit', 'utf16_code_unit');
end
$fn$;

REVOKE ALL ON FUNCTION public.story_unit_activity(text, text, text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.story_unit_activity(text, text, text) FROM anon;
GRANT EXECUTE ON FUNCTION public.story_unit_activity(text, text, text) TO authenticated;
