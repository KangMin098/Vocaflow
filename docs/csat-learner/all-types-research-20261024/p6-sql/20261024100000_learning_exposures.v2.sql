-- 제안 마이그레이션(v2 · 미적용): 학습자 노출 원장(P6) — 정답 직접 · 결정적 단서 노출 사건 + 시도 독립 판정
-- 26_P6_RECORD_DESIGN §4(v1) 대비 변경은 28_P6_SQL_V2.md 참조. 개발 DB 적용은 사용자 승인 뒤.
--
-- 계약:
--  · 노출은 사건 단위 append-only. 실학습자 행은 고치지도 지우지도 못한다(합성 행 · 계정 삭제 cascade 만 예외)
--  · 쓰기는 서버(service_role) RPC 만 — 학습자 · 익명은 INSERT/UPDATE/DELETE 권한 없음, 본인 행 SELECT 만
--  · 순서 판정은 서버 시계(clock_timestamp) — 트랜잭션 시작 시각(now())이 아니다
--  · 시도의 「독립」 은 저장하지 않고 조회 때 계산한다(나중 노출이 앞 판정을 바꾸지 못한다 · 동률은 독립 아님)
--  · 추적 시작 이전 시도는 노출 정보가 없으므로 독립으로 세지 않는다(unknown_pre_tracking)

create table public.learning_exposures (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  client_exposure_id uuid not null,
  item_ref text not null check (length(item_ref) between 1 and 120),
  kind text not null check (kind in ('answer_direct', 'decisive_hint')),
  source text not null check (source in ('lecture_until', 'lecture_full', 'lecture_continue', 'judgment_scene', 'reveal_api', 'item_page_render')),
  analysis_version integer check (analysis_version is null or analysis_version >= 0),
  lecture_version integer check (lecture_version is null or lecture_version >= 0),
  lecture_digest text check (lecture_digest is null or lecture_digest ~ '^[0-9a-f]{64}$'),
  cue_id text check (cue_id is null or length(cue_id) between 1 and 40),
  occurred_at timestamptz not null,
  received_at timestamptz not null default clock_timestamp(),
  clock_suspect boolean not null default false,
  synthetic boolean not null default false,
  unique (user_id, client_exposure_id),
  -- 결정적 단서는 강의 재생에서만 생긴다
  constraint learning_exposures_kind_source check (kind = 'answer_direct' or source in ('lecture_until', 'lecture_full', 'lecture_continue'))
);
create index learning_exposures_user_item on public.learning_exposures (user_id, item_ref, received_at);

-- 추적 시작 표식(1행) — 이 시각 이전 시도는 노출 기록이 없어 독립 판정에서 unknown 으로 둔다
create table public.learning_exposure_tracking (
  id smallint primary key default 1 check (id = 1),
  started_at timestamptz not null default clock_timestamp()
);
insert into public.learning_exposure_tracking (id) values (1);

-- 권한: Supabase 새 표 기본 권한을 걷고 필요한 것만 준다
alter table public.learning_exposures enable row level security;
alter table public.learning_exposure_tracking enable row level security;
revoke all on public.learning_exposures, public.learning_exposure_tracking from anon, authenticated;
revoke update, truncate on public.learning_exposures, public.learning_exposure_tracking from service_role;
grant select on public.learning_exposures, public.learning_exposure_tracking to authenticated;
grant select, insert, delete on public.learning_exposures to service_role;
grant select on public.learning_exposure_tracking to service_role;
create policy learning_exposures_own_select on public.learning_exposures for select to authenticated using (user_id = (select auth.uid()));
create policy learning_exposure_tracking_read on public.learning_exposure_tracking for select to authenticated using (true);

-- 불변: UPDATE 전부 거부 · DELETE 는 합성 행이거나 계정이 이미 지워진(cascade) 경우만
-- security definer: auth.users 존재 확인 때문(기존 learning_records_delete_guard 와 같은 이유)
create function public.learning_exposures_append_only() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op = 'UPDATE' then
    raise exception '노출 원장은 고칠 수 없다(append-only)';
  end if;
  if old.synthetic then return old; end if;
  if not exists (select 1 from auth.users u where u.id = old.user_id) then return old; end if;
  raise exception '실제 학습자의 노출 기록은 지울 수 없다 — 합성 기록만 정리할 수 있다';
end $$;
create trigger learning_exposures_append_only before update or delete on public.learning_exposures
  for each row execute function public.learning_exposures_append_only();
revoke all on function public.learning_exposures_append_only() from public, anon, authenticated;

-- 기록 RPC — 서버가 인증한 사용자 id 를 넘긴다. 같은 client_exposure_id 재전송은 처음 행 id 를 돌려준다(같은 내용이 아니면 거부)
create function public.learning_exposure_record(
  p_user uuid, p_client_exposure_id uuid, p_item_ref text, p_kind text, p_source text,
  p_analysis_version integer, p_lecture_version integer, p_lecture_digest text, p_cue_id text,
  p_occurred_at timestamptz, p_synthetic boolean default false
) returns bigint
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_id bigint;
  v_prev public.learning_exposures;
begin
  if p_user is null or p_client_exposure_id is null or p_occurred_at is null then
    raise exception '사용자 · 요청 id · 발생 시각이 필요하다';
  end if;
  if not exists (select 1 from auth.users u where u.id = p_user) then
    raise exception '없는 사용자다';
  end if;
  -- 같은 학습자 · 문항의 노출 기록을 직렬화(같은 요청 동시 재전송의 경합 · 시각 순서)
  perform pg_advisory_xact_lock(hashtextextended(p_user::text || '|' || coalesce(p_item_ref, ''), 0));
  insert into public.learning_exposures (user_id, client_exposure_id, item_ref, kind, source, analysis_version, lecture_version, lecture_digest, cue_id, occurred_at, clock_suspect, synthetic)
  values (p_user, p_client_exposure_id, p_item_ref, p_kind, p_source, p_analysis_version, p_lecture_version, p_lecture_digest, p_cue_id, p_occurred_at,
          abs(extract(epoch from (clock_timestamp() - p_occurred_at))) > 600, coalesce(p_synthetic, false))
  on conflict (user_id, client_exposure_id) do nothing
  returning id into v_id;
  if v_id is not null then return v_id; end if;
  select * into v_prev from public.learning_exposures where user_id = p_user and client_exposure_id = p_client_exposure_id;
  if v_prev.item_ref is distinct from p_item_ref or v_prev.kind is distinct from p_kind or v_prev.source is distinct from p_source then
    raise exception '같은 요청 id 로 다른 노출을 기록할 수 없다';
  end if;
  return v_prev.id;
end $$;
revoke all on function public.learning_exposure_record(uuid, uuid, text, text, text, integer, integer, text, text, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.learning_exposure_record(uuid, uuid, text, text, text, integer, integer, text, text, timestamptz, boolean) to service_role;

-- 시도 독립 판정(조회 때 계산 · 저장 안 함). security invoker — 학습자는 RLS 로 본인 시도만 판정된다
--   independent           : 추적 시작 이후 · help_level 독립(또는 없음) · 같은 문항의 어떤 노출(새 원장 · 기존 세션의 공개/도움/해설 서버 시각)보다 엄격히 앞섬
--   after_exposure        : 같은 문항 노출이 시도 시각 이전(동률 포함)에 있다 = 해설 후 확인
--   assisted              : 시도 자체가 hint · viewed_first 로 기록됐다
--   repeat                : 노출 전이지만 같은 문항의 두 번째 이후 시도(첫 독립 수행만 독립)
--   synthetic             : 합성 학습자 기록
--   unknown_pre_tracking  : 추적 시작 이전 시도 — 노출 정보가 없어 독립으로 세지 않는다
create function public.learning_attempt_independence(p_attempt_id bigint) returns text
language sql stable security invoker set search_path = public, pg_temp as $$
  with a as (
    select t.id, t.user_id, t.item_ref, t.help_level, t.received_at, t.synthetic from public.learning_task_attempts t where t.id = p_attempt_id
  ), earlier_attempt as (
    -- 같은 문항의 더 앞선 시도가 있으면 이 시도는 첫 독립 수행이 아니다(다시 풀기)
    select 1 as yes from public.learning_task_attempts t, a where t.user_id = a.user_id and t.item_ref = a.item_ref and (t.received_at, t.id) < (a.received_at, a.id) limit 1
  ), first_exposure as (
    select min(x) as at from (
      select e.received_at as x from public.learning_exposures e, a where e.user_id = a.user_id and e.item_ref = a.item_ref
      union all
      select least(s.help_server_at, s.explanation_server_at) from public.learning_sessions s, a where s.user_id = a.user_id and s.item_ref = a.item_ref
    ) q
  )
  select case
    when a.user_id is null then null
    when a.item_ref is null then 'unknown_pre_tracking'
    when a.received_at < (select started_at from public.learning_exposure_tracking where id = 1) then 'unknown_pre_tracking'
    when a.synthetic then 'synthetic'
    when a.help_level in ('hint', 'viewed_first') then 'assisted'
    when (select at from first_exposure) is not null and (select at from first_exposure) <= a.received_at then 'after_exposure'
    when exists (select 1 from earlier_attempt) then 'repeat'
    else 'independent'
  end
  from a
$$;
revoke all on function public.learning_attempt_independence(bigint) from public, anon;
grant execute on function public.learning_attempt_independence(bigint) to authenticated, service_role;
