-- supabase/migrations/20260906020000_db_health_findings.sql
--
-- DB 헬스 3층 중 **판정층이 결과를 남기는 자리**.
--
-- 왜 테이블이 필요한가:
--   판정은 DB 밖(Claude Code 스케줄 에이전트)에서 한다 — pg_cron 이 죽으면 그 안의 감시자도
--   같이 죽기 때문이다. 그런데 판정이 **대화 안에서만** 살면 다음 실행 때 처음부터 다시 세고,
--   "이건 지난주에 이미 봤다 / 이건 이번에 새로 생겼다" 를 구별하지 못한다.
--   `db_health_metrics` 가 **사실의 이력**이라면 이 표는 **판단의 이력**이다.
--
-- 왜 fingerprint 인가:
--   같은 문제를 매일 새 행으로 쌓으면 화면이 곧 스크롤이 되고 아무도 안 본다.
--   `axis:metric:key` 로 지문을 만들어 **같은 문제는 한 행**으로 유지하고 `occurrences` 만 올린다.
--   "언제 처음 보였나(first_seen_at)" 가 남아야 "이 문제가 얼마나 오래 방치됐나" 를 말할 수 있다.
--
-- 왜 `suggested_sql` 을 실행하지 않는가:
--   CLAUDE.md — 마이그레이션 자동 적용 금지. 조치는 사람이 SQL 을 보고 승인한다.
--   VACUUM FULL · DROP INDEX 는 되돌릴 수 없거나 되돌리는 데 몇 분씩 락을 잡는다.
--   그래서 이 열은 **문자열**이다. 실행 경로가 아예 없다.
--
-- 자동 종료:
--   에이전트가 매 실행 끝에 `close_missing_db_health_findings(본 지문 배열)` 를 부른다.
--   이번 실행에서 안 보인 open 항목은 `resolved` 로 닫힌다 — 고쳐진 문제가 화면에 남아 있으면
--   화면 전체의 신뢰가 떨어지고, 그러면 진짜 문제도 같이 무시된다.

create table if not exists db_health_findings (
  id bigint generated always as identity primary key,
  fingerprint text not null unique,
  axis text not null check (axis in ('capacity','cron','latency','connections','advisor','integrity')),
  severity text not null check (severity in ('critical','warning','info')),
  title text not null,
  detail text not null,
  evidence jsonb not null default '{}'::jsonb,
  suggested_sql text,
  status text not null default 'open' check (status in ('open','ack','resolved')),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  occurrences integer not null default 1,
  resolved_at timestamptz,
  note text
);

comment on table db_health_findings is
  'DB 헬스 판정 결과 — DB 밖 에이전트가 db_health_metrics·advisor 를 읽고 upsert. fingerprint 로 같은 문제는 한 행. suggested_sql 은 실행하지 않는 문자열(조치는 사람 승인).';

create index if not exists db_health_findings_status_idx
  on db_health_findings (status, severity, last_seen_at desc);
create index if not exists db_health_findings_axis_idx
  on db_health_findings (axis, status);

alter table db_health_findings enable row level security;

drop policy if exists db_health_findings_admin_read on db_health_findings;
create policy db_health_findings_admin_read on db_health_findings
  for select to authenticated
  using (exists (
    select 1 from user_profiles up
    where up.user_id = auth.uid() and up.role = 'admin'
  ));
-- 쓰기 정책 없음 — 아래 SECURITY DEFINER RPC 로만 쓴다.

-- ── 판정층이 부르는 쓰기 RPC ────────────────────────────────────────────
-- 에이전트는 MCP 로 postgres 권한에서 실행되므로 auth.uid() 가 없다.
-- 그래서 이 함수는 role 검사를 하지 않고 **권한 자체를 좁혀서** 막는다(anon·authenticated 회수).
create or replace function upsert_db_health_finding(
  p_fingerprint text,
  p_axis text,
  p_severity text,
  p_title text,
  p_detail text,
  p_evidence jsonb default '{}'::jsonb,
  p_suggested_sql text default null
) returns bigint
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_id bigint;
begin
  insert into db_health_findings as f
    (fingerprint, axis, severity, title, detail, evidence, suggested_sql)
  values
    (p_fingerprint, p_axis, p_severity, p_title, p_detail,
     coalesce(p_evidence, '{}'::jsonb), p_suggested_sql)
  on conflict (fingerprint) do update
    set severity = excluded.severity,
        title = excluded.title,
        detail = excluded.detail,
        evidence = excluded.evidence,
        suggested_sql = excluded.suggested_sql,
        last_seen_at = now(),
        occurrences = f.occurrences + 1,
        -- 닫아 둔 문제가 다시 나타나면 다시 연다. 재발은 신규보다 나쁜 신호다.
        status = case when f.status = 'resolved' then 'open' else f.status end,
        resolved_at = case when f.status = 'resolved' then null else f.resolved_at end
  returning f.id into v_id;
  return v_id;
end $function$;

comment on function upsert_db_health_finding(text,text,text,text,text,jsonb,text) is
  '판정층이 발견 1건을 기록. 같은 fingerprint 는 갱신 + occurrences 증가. resolved 였다면 다시 open.';

revoke execute on function upsert_db_health_finding(text,text,text,text,text,jsonb,text)
  from public, anon, authenticated;

-- ── 이번 실행에서 사라진 항목 닫기 ──────────────────────────────────────
create or replace function close_missing_db_health_findings(p_seen text[])
returns integer
language plpgsql
security definer
set search_path to 'public'
as $function$
declare
  v_n integer;
begin
  update db_health_findings
     set status = 'resolved', resolved_at = now()
   where status in ('open', 'ack')
     and not (fingerprint = any(coalesce(p_seen, '{}'::text[])));
  get diagnostics v_n = row_count;
  return v_n;
end $function$;

comment on function close_missing_db_health_findings(text[]) is
  '이번 판정에서 보이지 않은 open/ack 항목을 resolved 로 닫는다. 고쳐진 문제가 화면에 남으면 화면 전체를 못 믿게 된다.';

revoke execute on function close_missing_db_health_findings(text[])
  from public, anon, authenticated;

-- ── 화면에서 사람이 상태를 바꾸는 RPC (admin 검사 있음) ─────────────────
create or replace function admin_set_db_health_finding_status(
  p_id bigint,
  p_status text,
  p_note text default null
) returns void
language plpgsql
security definer
set search_path to 'public'
as $function$
begin
  if not exists (select 1 from user_profiles where user_id = auth.uid() and role = 'admin') then
    raise exception 'admin only';
  end if;
  if p_status not in ('open', 'ack', 'resolved') then
    raise exception 'invalid status: %', p_status;
  end if;
  update db_health_findings
     set status = p_status,
         note = coalesce(p_note, note),
         resolved_at = case when p_status = 'resolved' then now() else null end
   where id = p_id;
end $function$;

comment on function admin_set_db_health_finding_status(bigint,text,text) is
  '/admin/db 에서 발견 항목을 확인(ack)·해결(resolved)로 표시. 조치 SQL 실행은 하지 않는다.';

revoke execute on function admin_set_db_health_finding_status(bigint,text,text) from public, anon;
grant execute on function admin_set_db_health_finding_status(bigint,text,text) to authenticated;
