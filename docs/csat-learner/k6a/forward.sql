-- docs/csat-learner/k6a/forward.sql
-- K6-a 앱 ↔ DB 독립 판정 노출 기준 통일(제안 · 미적용 · 사용자 승인 전 실행 금지). 복구는 recovery.sql.
--
-- 통일 계약(앱 exposure-ledger · bridge/exposure-consumer 와 같은 기준):
--   시도 a 의 노출 창 = 같은 학습자의 노출 e 중 received_at <= a.exposure_order_at(동률 포함)이고
--   (e.item_ref = a.item_ref 또는 두 문항의 정규화 지문 키가 같음) → after_exposure.
--   창 안에 다른 문항 노출이 있는데 어느 한쪽 지문 키를 구할 수 없으면 → passage_unknown(독립으로 올리지 않는다).
-- 정규화 지문 키 = 앱 normalizedPassageKey: lower → \s+ 를 ' ' 로 → 앞뒤 공백 제거 → JSON 문자열 인코딩 → sha256 hex. 빈 값 = 키 없음.
--   개발 DB 3,714문항 전수 대조 일치(2026-10-25 · 정렬 다이제스트 md5 be10b1f65c4969ce43bf218ec12bab2e, 양쪽 동일 · 키 없음 0).
-- 범위: 새 함수 1(csat_passage_key) · learning_attempt_independence 본문 교체. 표 · 열 · 트리거 · 데이터 · RLS 무변경.
--   learning_attempt_independence 는 CREATE OR REPLACE → 기존 ACL(authenticated · service_role EXECUTE) · security invoker · STABLE · search_path 유지.
--   csat_passage_key 는 **security definer**(소유자 권한으로 csat_items 를 읽는다). 이유: csat_items RLS 정책 csat_items_read 의 조건이 false 라
--     학습자(authenticated) 호출에서 invoker 로는 한 줄도 못 읽어 모든 지문 키가 null → 같은 지문을 못 잡고 다른 문항 노출마다 passage_unknown 이 된다(2026-10-25 확인).
--     반환은 정규화 본문의 sha256 해시뿐(본문 · 정답 · 다른 칸 없음) — 학습자가 알 수 있는 것은 두 문항의 지문이 같은지뿐이다. search_path 고정 · anon 회수.
-- 새 반환값 passage_unknown: 저장소 소비자는 bridge/exposure-reader(parseIndependence) 하나 — 모르는 값은 null(보류)로 다루므로 공급되지 않는다.
--   적용 시 bridge/exposure-consumer.ts 의 IndependenceStatus 에 'passage_unknown' 을 더해 보류 사유를 명시하는 앱 변경을 함께 낸다(없어도 안전).

begin;

create or replace function public.csat_passage_key(p_item_ref text) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select case when s.k is null or s.k = '' then null
              else encode(sha256(convert_to(to_jsonb(s.k)::text, 'UTF8')), 'hex') end
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

commit;

-- 적용 전 확인(읽기 전용):
--   select pg_get_expr(polqual, polrelid) from pg_policy where polrelid = 'public.csat_items'::regclass;  -- false 이면 definer 가 필요하다(현재 false)
--   적용 뒤 학습자 세션으로: select public.csat_passage_key('2014A#24') = public.csat_passage_key('2014B#23');  -- true(같은 지문 쌍)
--   select p.proacl::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname='learning_attempt_independence';
