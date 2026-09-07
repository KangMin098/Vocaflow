-- supabase/migrations/20260906031000_db_health_exceptions.sql
--
-- **판정층이 저장소의 결정을 읽게 한다.**
--
-- ── 왜 (2026-09-06, 만든 지 한 시간 만에 드러난 결함) ────────────────────
-- 첫 판정이 `csat_items_public` 뷰의 SECURITY DEFINER 를 critical 로 올렸다.
-- 그런데 이 저장소는 그 결정을 **두 번이나 기록해 두었다**:
--   · 20260903121759 — "csat_items_public 뷰는 건드리지 않는다. advisor 의 유일한 ERROR 지만…"
--   · 20260904084631 — "security_definer_view (ERROR) — 의도된 저작권 경계다. **고치지 말 것.**"
-- 실체도 확인했다 — `csat_items` 는 RLS 가 켜져 있고 정책이 `authenticated` 전용이다.
-- 뷰는 저작권 있는 지문·선지를 뺀 안전한 열만 투영해 학습자에게 준다. `security_invoker=false`
-- 는 실수가 아니라 그 경계를 만드는 장치다. **뒤집으면 공개 CSAT 화면이 빈다.**
--
-- 즉 판정이 틀린 게 아니라 **판정자가 이미 내려진 결정을 못 읽었다.** 그리고 이건 한 번으로
-- 끝나지 않는다 — 다음 주에도, 그 다음 주에도 같은 항목을 critical 로 올린다. 매주 같은
-- 오탐을 보는 화면은 곧 아무도 안 보는 화면이 되고, 그러면 진짜 항목도 같이 묻힌다.
--
-- ── 왜 코드가 아니라 표인가 ──────────────────────────────────────────────
-- 면제를 커맨드 문서에 문장으로 적으면 판정자가 그것을 "읽고 기억"해야 한다. 표에 두면
-- **DB 가 강제**한다. 그리고 화면이 면제 목록을 보여 줄 수 있다 —
-- CLAUDE.md 가 경고하듯 면제 목록은 조용히 자라므로, 안 보이면 커버리지가 아니라 구멍이 된다.
--
-- `expires_at` 을 둔 이유: 영구 면제는 대개 거짓말이다. 「지금은 이렇게 두기로 했다」와
-- 「영원히 괜찮다」는 다르고, 기한이 있으면 그날 다시 판단하게 된다. null 은 허용하되
-- 그때는 `evidence` 에 **어디에 그 결정이 적혀 있는지**를 반드시 남긴다.

create table if not exists db_health_exceptions (
  fingerprint text primary key,
  reason text not null,
  /** 그 결정이 어디에 기록돼 있는가 — 마이그레이션 파일·문서 경로. 근거 없는 면제를 막는다. */
  evidence text not null,
  created_at timestamptz not null default now(),
  /** null = 무기한. 지나면 면제가 풀려 다시 판정 대상이 된다. */
  expires_at timestamptz
);

comment on table db_health_exceptions is
  '판정 면제 — 저장소가 이미 내린 결정을 판정층이 다시 올리지 않게 한다. 면제된 항목은 사라지지 않고 status=excepted 로 남아 화면에 보인다(안 보이는 면제 목록은 구멍이다).';

alter table db_health_exceptions enable row level security;

drop policy if exists db_health_exceptions_admin_read on db_health_exceptions;
create policy db_health_exceptions_admin_read on db_health_exceptions
  for select to authenticated
  using (exists (
    select 1 from user_profiles up
    where up.user_id = auth.uid() and up.role = 'admin'
  ));

-- ── 발견에 4번째 상태를 더한다 ──────────────────────────────────────────
-- 면제를 '해결' 로 적으면 거짓말이다(고쳐지지 않았다). 지우면 왜 안 뜨는지 아무도 모른다.
alter table db_health_findings drop constraint if exists db_health_findings_status_check;
alter table db_health_findings add constraint db_health_findings_status_check
  check (status in ('open', 'ack', 'resolved', 'excepted'));

-- ── 기록할 때 면제를 확인한다 ───────────────────────────────────────────
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
  v_exception db_health_exceptions%rowtype;
  v_status text := 'open';
  v_note text := null;
begin
  select * into v_exception from db_health_exceptions e
  where e.fingerprint = p_fingerprint
    and (e.expires_at is null or e.expires_at > now());

  if found then
    v_status := 'excepted';
    v_note := v_exception.reason || ' (' || v_exception.evidence || ')';
  end if;

  insert into db_health_findings as f
    (fingerprint, axis, severity, title, detail, evidence, suggested_sql, status, note)
  values
    (p_fingerprint, p_axis, p_severity, p_title, p_detail,
     coalesce(p_evidence, '{}'::jsonb), p_suggested_sql, v_status, v_note)
  on conflict (fingerprint) do update
    set severity = excluded.severity,
        title = excluded.title,
        detail = excluded.detail,
        evidence = excluded.evidence,
        suggested_sql = excluded.suggested_sql,
        last_seen_at = now(),
        occurrences = f.occurrences + 1,
        -- 면제는 사람의 ack 보다 세다 — 면제가 살아 있으면 무조건 excepted 로 간다.
        -- 면제가 만료되면 그 다음 판정에서 open 으로 돌아온다(그게 expires_at 의 목적이다).
        status = case
                   when v_status = 'excepted' then 'excepted'
                   when f.status in ('resolved', 'excepted') then 'open'
                   else f.status
                 end,
        note = coalesce(v_note, f.note),
        resolved_at = case when v_status = 'excepted' then null
                           when f.status = 'resolved' then null
                           else f.resolved_at end
  returning f.id into v_id;
  return v_id;
end $function$;

comment on function upsert_db_health_finding(text,text,text,text,text,jsonb,text) is
  '판정층이 발견 1건을 기록. 같은 fingerprint 는 갱신 + occurrences 증가. db_health_exceptions 에 살아 있는 면제가 있으면 status=excepted(사유·근거를 note 에). resolved 였다가 다시 보이면 open.';

revoke execute on function upsert_db_health_finding(text,text,text,text,text,jsonb,text)
  from public, anon, authenticated;

-- ── 자동 종료는 면제를 건드리지 않는다 ──────────────────────────────────
-- 면제 항목은 "이번 판정에서 안 보였다" 가 아니라 "판정을 건너뛰었다" 일 수 있다.
-- resolved 로 닫으면 고쳐진 것처럼 보이고, 다음에 면제가 풀렸을 때 이력이 끊긴다.
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
  '이번 판정에서 보이지 않은 open/ack 항목을 resolved 로 닫는다. excepted 는 건드리지 않는다(안 보인 것이 아니라 건너뛴 것이다).';

revoke execute on function close_missing_db_health_findings(text[])
  from public, anon, authenticated;

-- ── 지금 아는 면제 하나를 등록한다 ──────────────────────────────────────
insert into db_health_exceptions (fingerprint, reason, evidence)
values (
  'advisor:security_definer_view:csat_items_public',
  'csat_items 는 RLS + authenticated 전용 정책이고, 이 뷰는 저작권 있는 지문·선지를 뺀 안전한 열만 투영해 학습자에게 준다. security_invoker=false 가 그 경계를 만드는 장치라 뒤집으면 공개 CSAT 화면이 빈다',
  'supabase/migrations/20260903121759 · 20260904084631 (둘 다 "고치지 말 것" 명시) · apps/web/src/lib/csat/__tests__/copyright-boundary.integration.test.ts'
)
on conflict (fingerprint) do update
  set reason = excluded.reason, evidence = excluded.evidence;

-- 이미 열려 있던 그 발견을 면제 상태로 옮긴다(이력은 남긴다 — 지우지 않는다).
update db_health_findings
   set status = 'excepted',
       resolved_at = null,
       note = (select e.reason || ' (' || e.evidence || ')'
               from db_health_exceptions e
               where e.fingerprint = db_health_findings.fingerprint)
 where fingerprint = 'advisor:security_definer_view:csat_items_public';
