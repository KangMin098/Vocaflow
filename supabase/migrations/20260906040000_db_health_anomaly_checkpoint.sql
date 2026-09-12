-- supabase/migrations/20260906040000_db_health_anomaly_checkpoint.sql
--
-- DB 헬스에 **이상 감지**와 **위험 작업 체크포인트**를 더한다.
--
-- ── 왜 (지금 구조의 빈 칸 두 개) ─────────────────────────────────────────
-- 지금 판정은 **규칙이 아는 것만** 잡는다 — cron 미성공 시간, 느린 구문, RLS 누락처럼
-- "무엇을 볼지 미리 정한 것"이다. 그런데 이 저장소의 사고는 대개 **아무도 예상하지 않은 자리**에서
-- 났다: 발행 도서가 12권 → 312권이 되면서 야간 배치가 죽었고(08-29), 통계가 154개 표에서
-- 한 번도 안 잡혀 카운터가 실물과 갈렸다. 둘 다 "평소와 다르다" 는 신호는 있었지만
-- **그 신호를 보는 자가 없었다.**
--
--   ① `db_health_anomalies()` — 어떤 지표든 **자기 이력에서 얼마나 벗어났는지**를 잰다.
--      규칙을 미리 안 정해도 튀는 것이 위로 올라온다.
--   ② `db_health_checkpoints` — 위험한 작업 **앞뒤로** 스냅샷을 찍고 무엇이 바뀌었는지 본다.
--      30일에 마이그레이션 184건인 저장소에서 "이 변경이 무엇을 건드렸나" 는 사후에 알 수 없다.
--
-- ── 여기서도 판정하지 않는다 ────────────────────────────────────────────
-- `db_health_anomalies` 는 **임계값을 돌려주지 않는다.** 편차 숫자만 준다.
-- "robust_z 3.5 가 위험한가" 는 그 지표가 무엇인지에 달렸고(연결 점유율 3.5σ 와 테이블 용량
-- 3.5σ 는 다른 뜻이다), 그 판단은 DB 밖 `/db-health-audit` 의 몫이다.
--
-- ── 왜 표준편차가 아니라 MAD 인가 ───────────────────────────────────────
-- 표본이 적고(수집 며칠치) 이상치가 섞이면 표준편차는 **이상치 자신에게 끌려간다** —
-- 한 번 튄 값이 σ 를 키워서 그 다음부터는 아무것도 이상해 보이지 않는다.
-- 중앙값 절대편차(MAD)는 절반이 오염돼야 무너진다. `1.4826` 은 정규분포에서 MAD 를
-- 표준편차와 같은 눈금으로 맞추는 상수다.
--
-- ⚠️ **표본이 모자라면 숫자를 지어내지 않는다.** `p_min_samples` 미만인 계열은 아예 안 준다.
--    3점으로 계산한 편차는 편차가 아니라 소음이고, 소음을 이상 징후로 인쇄하면
--    그 화면은 곧 꺼진다.

-- ── 이상 감지 ───────────────────────────────────────────────────────────
create or replace function db_health_anomalies(
  p_window_days int default 30,
  p_min_samples int default 5
) returns table (
  axis text,
  metric text,
  subject text,
  latest numeric,
  prev numeric,
  median_value numeric,
  mad numeric,
  robust_z numeric,
  pct_change numeric,
  samples int,
  latest_at timestamptz
)
language sql
stable
security invoker
set search_path to 'public'
as $function$
  with pts as (
    select m.axis, m.metric, m.dims->>'table' as subject, m.value, m.measured_at
    from db_health_metrics m
    where m.measured_at > now() - make_interval(days => greatest(p_window_days, 1))
  ),
  agg as (
    select p.axis, p.metric, p.subject,
           count(*)::int as samples,
           max(p.measured_at) as latest_at,
           percentile_cont(0.5) within group (order by p.value) as median_value
    from pts p
    group by 1, 2, 3
  ),
  dev as (
    -- MAD = median(|v - median|). 중앙값을 두 번 쓰므로 조인해서 다시 집계한다.
    select a.axis, a.metric, a.subject, a.samples, a.latest_at, a.median_value,
           percentile_cont(0.5) within group (order by abs(p.value - a.median_value)) as mad
    from agg a
    join pts p on p.axis = a.axis and p.metric = a.metric
              and p.subject is not distinct from a.subject
    group by 1, 2, 3, 4, 5, 6
  ),
  ends as (
    select d.axis, d.metric, d.subject,
           (select p.value from pts p
             where p.axis = d.axis and p.metric = d.metric
               and p.subject is not distinct from d.subject
             order by p.measured_at desc limit 1) as latest,
           (select p.value from pts p
             where p.axis = d.axis and p.metric = d.metric
               and p.subject is not distinct from d.subject
             order by p.measured_at desc offset 1 limit 1) as prev
    from dev d
  ),
  -- ⚠️ percentile_cont 는 double precision 을 돌려주는데 round(double, int) 는 없다
  --    (round 는 numeric 과 double 1인자만 있다). 그래서 ::numeric 캐스트가 붙어 있다.
  -- ⚠️ ORDER BY 에서 출력 별칭을 **식 안에** 쓰면 Postgres 가 거부한다
  --    (`abs(coalesce(pct_change,0))` → column "pct_change" does not exist).
  --    그래서 계산을 서브쿼리로 감싸고 밖에서 정렬한다.
  scored as (
    select d.axis, d.metric, d.subject,
           e.latest,
           e.prev,
           round(d.median_value::numeric, 3) as median_value,
           round(d.mad::numeric, 3) as mad,
           -- MAD = 0 은 "이력이 전부 같은 값" 이다. 그때 편차를 무한대로 쓰면 사소한 변화가
           -- 1위로 올라온다 — 숫자를 주지 않고 null 로 둔다. 변화 여부는 pct_change 가 말한다.
           case when d.mad > 0
                then round((abs(e.latest - d.median_value) / (1.4826 * d.mad))::numeric, 2)
                else null end as robust_z,
           case when e.prev is not null and e.prev <> 0
                then round((100.0 * (e.latest - e.prev) / abs(e.prev))::numeric, 2)
                else null end as pct_change,
           d.samples,
           d.latest_at
    from dev d
    join ends e on e.axis = d.axis and e.metric = d.metric
               and e.subject is not distinct from d.subject
    where d.samples >= greatest(p_min_samples, 2)
  )
  select s.axis, s.metric, s.subject, s.latest, s.prev, s.median_value, s.mad,
         s.robust_z, s.pct_change, s.samples, s.latest_at
  from scored s
  order by s.robust_z desc nulls last, abs(coalesce(s.pct_change, 0)) desc;
$function$;

comment on function db_health_anomalies(int, int) is
  '지표별 자기 이력 대비 편차(MAD 기반 robust z + 직전 대비 변화율). 임계값을 돌려주지 않는다 — 판정은 DB 밖. 표본이 p_min_samples 미만인 계열은 아예 주지 않는다(모자란 표본으로 낸 편차는 소음이다). SECURITY INVOKER 라 RLS 가 그대로 적용된다.';

revoke execute on function db_health_anomalies(int, int) from public, anon;
grant execute on function db_health_anomalies(int, int) to authenticated;

-- ── 위험 작업 체크포인트 ────────────────────────────────────────────────
create table if not exists db_health_checkpoints (
  id bigint generated always as identity primary key,
  /** 무엇을 하는 작업인가 — 마이그레이션 번호·대량 발행 이름 등. before/after 를 잇는 키. */
  label text not null,
  phase text not null check (phase in ('before', 'after')),
  /** 이 체크포인트가 가리키는 스냅샷 시각(db_health_metrics.measured_at). */
  measured_at timestamptz not null,
  note text,
  created_at timestamptz not null default now(),
  unique (label, phase)
);

comment on table db_health_checkpoints is
  '위험 작업 앞뒤의 라벨 붙은 스냅샷. 30일에 마이그레이션 184건인 저장소에서 "이 변경이 무엇을 건드렸나" 는 사후에 알 수 없다 — 앞에서 찍어 둬야 안다.';

create index if not exists db_health_checkpoints_label_idx
  on db_health_checkpoints (label, phase);

alter table db_health_checkpoints enable row level security;

drop policy if exists db_health_checkpoints_admin_read on db_health_checkpoints;
create policy db_health_checkpoints_admin_read on db_health_checkpoints
  for select to authenticated
  using (exists (
    select 1 from user_profiles up
    where up.user_id = auth.uid() and up.role = 'admin'
  ));

-- 스냅샷을 찍고 그 시각에 라벨을 건다. 같은 (label, phase) 를 다시 찍으면 덮어쓴다
-- — 작업을 다시 시작하는 경우가 실제로 있고, 그때 옛 before 를 남겨 두면 비교가 거짓이 된다.
create or replace function record_db_health_checkpoint(
  p_label text,
  p_phase text,
  p_note text default null
) returns timestamptz
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_at timestamptz;
begin
  if p_phase not in ('before', 'after') then
    raise exception 'phase must be before or after, got %', p_phase;
  end if;
  if coalesce(trim(p_label), '') = '' then
    raise exception 'label is required — 라벨이 없으면 before 와 after 를 이을 수 없다';
  end if;

  perform collect_db_health_metrics();
  select max(measured_at) into v_at from db_health_metrics;

  insert into db_health_checkpoints (label, phase, measured_at, note)
  values (trim(p_label), p_phase, v_at, p_note)
  on conflict (label, phase) do update
    set measured_at = excluded.measured_at,
        note = excluded.note,
        created_at = now();

  return v_at;
end $function$;

comment on function record_db_health_checkpoint(text, text, text) is
  '스냅샷을 찍고 (label, phase) 로 라벨을 건다. 같은 키를 다시 찍으면 덮어쓴다 — 작업을 다시 시작했는데 옛 before 가 남아 있으면 비교가 거짓이 된다.';

revoke execute on function record_db_health_checkpoint(text, text, text) from public, anon, authenticated;

-- ── 앞뒤 비교 ───────────────────────────────────────────────────────────
-- full outer join 인 이유: **사라진 지표가 가장 중요한 신호**다. after 에 없다는 것은
-- 그 축이 통째로 실패했다는 뜻인데(수집기가 축마다 예외를 삼키도록 만들어져 있다),
-- inner join 으로 비교하면 그 줄이 조용히 빠져서 "아무 변화 없음" 으로 보인다.
create or replace function db_health_checkpoint_diff(p_label text)
returns table (
  axis text,
  metric text,
  subject text,
  before_value numeric,
  after_value numeric,
  delta numeric,
  pct numeric,
  status text
)
language sql
stable
security invoker
set search_path to 'public'
as $function$
  with cp as (
    select
      max(measured_at) filter (where phase = 'before') as before_at,
      max(measured_at) filter (where phase = 'after') as after_at
    from db_health_checkpoints where label = p_label
  ),
  b as (
    select m.axis, m.metric, m.dims->>'table' as subject, m.value
    from db_health_metrics m, cp
    where m.measured_at = cp.before_at
  ),
  a as (
    select m.axis, m.metric, m.dims->>'table' as subject, m.value
    from db_health_metrics m, cp
    where m.measured_at = cp.after_at
  )
  select coalesce(b.axis, a.axis) as axis,
         coalesce(b.metric, a.metric) as metric,
         coalesce(b.subject, a.subject) as subject,
         b.value as before_value,
         a.value as after_value,
         case when b.value is not null and a.value is not null
              then a.value - b.value else null end as delta,
         case when b.value is not null and a.value is not null and b.value <> 0
              then round(100.0 * (a.value - b.value) / abs(b.value), 2) else null end as pct,
         case when b.value is null then 'appeared'
              when a.value is null then 'disappeared'
              when a.value = b.value then 'same'
              else 'changed' end as status
  from b
  full outer join a
    on a.axis = b.axis and a.metric = b.metric and a.subject is not distinct from b.subject
  order by
    -- 사라진 것 먼저, 그다음 변화 큰 것. "같음" 은 맨 뒤로.
    case when b.value is null or a.value is null then 0 else 1 end,
    abs(coalesce(case when b.value <> 0 then 100.0 * (a.value - b.value) / abs(b.value) end, 0)) desc;
$function$;

comment on function db_health_checkpoint_diff(text) is
  '체크포인트 라벨의 before/after 스냅샷 비교. full outer join — 사라진 지표(축 실패)가 가장 중요한 신호이고 inner join 은 그 줄을 조용히 없앤다. SECURITY INVOKER.';

revoke execute on function db_health_checkpoint_diff(text) from public, anon;
grant execute on function db_health_checkpoint_diff(text) to authenticated;

-- 화면(admin 세션)에서 체크포인트를 직접 찍을 수 있게 하는 wrapper.
create or replace function admin_record_db_health_checkpoint(
  p_label text,
  p_phase text,
  p_note text default null
) returns timestamptz
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not exists (select 1 from user_profiles where user_id = auth.uid() and role = 'admin') then
    raise exception 'admin only';
  end if;
  return record_db_health_checkpoint(p_label, p_phase, p_note);
end $function$;

comment on function admin_record_db_health_checkpoint(text, text, text) is
  'admin 검사 후 record_db_health_checkpoint 위임. /admin/db 의 체크포인트 버튼.';

revoke execute on function admin_record_db_health_checkpoint(text, text, text) from public, anon;
grant execute on function admin_record_db_health_checkpoint(text, text, text) to authenticated;
