-- docs/csat-learner/k6a-unified-exposure-proposal.sql
-- 제안(미적용 · 사용자 승인 전 실행 금지): K6-a 앱 ↔ DB 독립 판정 노출 기준 통일.
--
-- 문제: learning_attempt_independence 는 노출 조건이 e.item_ref = a.item_ref 뿐이다. 앱(exposure-ledger · bridge/exposure-consumer)은
--       같은 정규화 지문을 쓰는 다른 문항의 노출도 노출로 본다. 개발 DB 실측(2026-10-24): csat_items 3,714 중 641문항(254 지문 묶음)이 지문 공유.
-- 통일 계약: 시도 a 의 노출 창 = 같은 학습자의 노출 e 중 received_at <= a.exposure_order_at 이고
--            (e.item_ref = a.item_ref  또는  두 문항의 정규화 지문 키가 같음). 지문 키를 구할 수 없으면(문항 없음 · 지문 비어 있음) 그 시도는 passage_unknown.
-- 정규화 지문 키 = 앱 normalizedPassageKey 와 같은 규칙: 소문자 · 공백 묶음 → ' ' · 앞뒤 공백 제거 → JSON 문자열 인코딩 → sha256 hex.
--   주의: JS \s 와 Postgres \s 의 유니코드 공백 범위가 다를 수 있다 → 적용 전 검증 질의(파일 끝)로 앱 키와 전수 일치를 확인한다.
-- 영향 범위: 함수 2개(새 csat_passage_key · learning_attempt_independence 본문 교체). 표 · 열 · 데이터 · 권한 · 서명 변경 없음.
--   반환값에 'passage_unknown' 이 새로 생긴다 → 앱 parseIndependence 는 모르는 값을 null(보류)로 처리하므로 안전(공급 안 됨).
-- 복구: 파일 끝 ROLLBACK 블록(원래 v3 본문 그대로)을 실행하면 이전 동작으로 돌아간다. 데이터 변경이 없으므로 데이터 복구는 필요 없다.

create or replace function public.csat_passage_key(p_item_ref text) returns text
language sql stable security invoker set search_path = public, pg_temp as $$
  select case when k is null or k = '' then null
              else encode(sha256(convert_to(to_jsonb(k)::text, 'UTF8')), 'hex') end
  from (
    select btrim(regexp_replace(lower(ci.passage), '\s+', ' ', 'g')) as k
    from public.csat_items ci
    where ci.exam_id = split_part(p_item_ref, '#', 1)
      and ci.no::text = split_part(p_item_ref, '#', 2)
    limit 1
  ) s
$$;
revoke all on function public.csat_passage_key(text) from public, anon;
grant execute on function public.csat_passage_key(text) to authenticated, service_role;

create or replace function public.learning_attempt_independence(p_attempt_id bigint) returns text
language sql stable security invoker set search_path = public, pg_temp as $$
  with a as (
    select t.id, t.user_id, t.item_ref, t.task_key, t.phase, t.activity, t.session_id, t.is_correct, t.answered_at, t.exposure_order_at,
           public.csat_passage_key(t.item_ref) as pkey
    from public.learning_task_attempts t where t.id = p_attempt_id
  ), f as (
    select v.* from public.learning_first_attempts v, a where v.attempt_id = a.id
  ), win as (
    select e.item_ref, public.csat_passage_key(e.item_ref) as pkey from public.learning_exposures e, a
    where e.user_id = a.user_id and e.received_at <= a.exposure_order_at
  ), exposed as (
    select 1 as yes from win, a where win.item_ref = a.item_ref or (a.pkey is not null and win.pkey = a.pkey) limit 1
  ), unknown_passage as (
    select 1 as yes from win, a where win.item_ref <> a.item_ref and (a.pkey is null or win.pkey is null) limit 1
  )
  select case
    when a.id is null then null
    when a.exposure_order_at is null or a.item_ref is null then 'legacy_unknown'
    when a.activity is distinct from 'theater' or a.phase <> 'practice' then 'not_check_phase'
    when not exists (select 1 from f) then 'repeat'
    when (select after_viewed_first or after_explanation or help_level is distinct from 'independent' from f) then 'helped'
    when exists (select 1 from exposed) then 'after_exposure'
    when exists (select 1 from unknown_passage) then 'passage_unknown'
    when (select timing_uncertain from f) then 'timing_held'
    when a.session_id is null then 'unbound'
    when a.is_correct is null or a.answered_at is null then 'ungraded'
    else 'independent_candidate'
  end
  from (select 1) one left join a on true
$$;

-- 검증(적용 전 · 읽기 전용): 앱 키와 SQL 키 전수 비교는 scripts 쪽에서 csat_items 를 읽어 normalizedPassageKey 와 대조한다.
--   select exam_id || '#' || no as ref, public.csat_passage_key(exam_id || '#' || no) from public.csat_items;  -- 적용 뒤에만 가능
--   적용 전 대체: select encode(sha256(convert_to(to_jsonb(btrim(regexp_replace(lower(passage), '\s+', ' ', 'g')))::text,'UTF8')),'hex') from public.csat_items;

-- ROLLBACK(이전 v3 동작 복원):
-- drop function if exists public.csat_passage_key(text);
-- create or replace function public.learning_attempt_independence(p_attempt_id bigint) returns text ... (20261023194123_learning_exposures.sql 의 본문 그대로)
