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
-- 권한(보완 v2 · 2026-10-25 — 학습자에게 새 조회 표면을 만들지 않는다):
--   csat_items RLS 정책 csat_items_read 의 조건은 false(authenticated 0행 · bypassrls 없음). 학습자는 csat_items_public 뷰로만 읽고 그 뷰는 passage · stem 을 주지 않으며 미발행 학평 문항을 뺀다.
--   v1 처럼 지문 키 함수를 authenticated 에 열면 임의 문항 ID(보호 · 미발행 포함)로 지문 존재 · 같은 지문 여부 · 후보 본문 일치(해시 대조)를 알 수 있다 → 열지 않는다.
--   · csat_passage_key: security definer · **service_role 만 실행**(public · anon · authenticated 회수). 학습자는 직접 부를 수 없다.
--   · learning_attempt_independence: **security definer** 로 바꾸고 시도 행을 「본인 시도(auth.uid()) 또는 service_role 호출」로만 연다.
--     정의자 권한으로 csat_passage_key 를 부르므로 학습자 호출에서도 같은 지문을 판정한다. 반환은 지금과 같은 판정 문자열 하나 — 본인 시도 외에는 null(지금 RLS 결과와 같음).
--     정의자 권한은 RLS 를 넘으므로 사용자 결속을 본문이 직접 건다: 시도(a) = 호출자 본인 · 노출(win) = 그 시도의 user_id · 첫 시도 뷰(f) = 그 시도 id.
--     ACL 은 CREATE OR REPLACE 로 유지(authenticated · service_role EXECUTE).
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
revoke all on function public.csat_passage_key(text) from public, anon, authenticated;
grant execute on function public.csat_passage_key(text) to service_role;

create or replace function public.learning_attempt_independence(p_attempt_id bigint) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  with a as (
    select t.id, t.user_id, t.item_ref, t.task_key, t.phase, t.activity, t.session_id, t.is_correct, t.answered_at, t.exposure_order_at,
           public.csat_passage_key(t.item_ref) as pkey
    from public.learning_task_attempts t
    where t.id = p_attempt_id
      -- 정의자 권한은 RLS 를 넘는다 — 본인 시도 또는 서버(service_role) 호출만
      and (t.user_id = (select auth.uid()) or (select auth.role()) = 'service_role')
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
--   select pg_get_expr(polqual, polrelid) from pg_policy where polrelid = 'public.csat_items'::regclass;  -- 현재 false — 학습자는 csat_items 를 못 읽는다
--   select to_regprocedure('auth.uid()'), to_regprocedure('auth.role()');  -- 둘 다 있어야 한다
-- 적용 뒤 확인:
--   service_role: select public.csat_passage_key('2014A#24') = public.csat_passage_key('2014B#23');  -- true(같은 지문 쌍)
--   학습자 세션: select public.csat_passage_key('2014A#24');  -- permission denied(학습자에게 열지 않는다)
--   학습자 세션: 남의 시도 id 로 learning_attempt_independence → null(본인 시도만)
--   select p.proname, p.prosecdef, p.proacl::text from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('learning_attempt_independence','csat_passage_key');
