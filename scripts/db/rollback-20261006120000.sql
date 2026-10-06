-- scripts/db/rollback-20261006120000.sql
-- 20261006120000_csat_ec_boundary_detector 되돌리기 — 감지기 객체를 지우고 my_pending_probes(20261005130000) ·
-- add_process_evidence(20261005150000) 정의와 권한을 그대로 되돌린다.
-- 감지기가 이미 돌았으면(실행 기록 · 취소 행 있음) 멈춘다 — 취소 표를 지우면 옛 대기 probe 정의가 취소된 질문을 다시 띄운다.
-- 그 경우는 데이터 처리(신호 보존 · 취소 반영)를 먼저 정하고 되돌린다.
begin;

do $$
begin
  if exists (select 1 from public.csat_ec_detector_run) or exists (select 1 from public.csat_ec_boundary_signal_retraction) then
    raise exception 'rollback-20261006120000: 감지 실행 기록이 있다 — 데이터 처리 결정 뒤 되돌린다';
  end if;
end $$;

drop trigger if exists csat_ec_process_evidence_detect on public.csat_ec_process_evidence;
drop trigger if exists csat_ec_capture_write_guard on public.csat_ec_boundary_signal;
drop function if exists public.csat_ec_detect_boundaries_rerun(uuid, smallint);
drop function if exists public.csat_ec_process_evidence_detect();
drop function if exists public.csat_ec_detect_boundaries(uuid, smallint, uuid);
drop table if exists public.csat_ec_boundary_signal_retraction;
drop table if exists public.csat_ec_detector_run;

create or replace function public.csat_ec_my_pending_probes(p_session uuid)
returns table (item_no smallint, taxonomy_version text, boundary_key text, probe_key text)
language sql stable security definer set search_path = '' as $$
  select distinct s.item_no, s.taxonomy_version, s.boundary_key, b.probe_key
    from public.csat_ec_boundary_signal s
    join public.csat_dx_session ss on ss.id = s.session_id and ss.user_id = (select auth.uid())
    join public.csat_ec_boundary b on b.version = s.taxonomy_version and b.boundary_key = s.boundary_key
   where s.session_id = p_session and s.probe_required and b.probe_key is not null
     and not exists (select 1 from public.csat_ec_process_evidence p
                      where p.session_id = s.session_id and p.item_no = s.item_no and p.kind = 'targeted_probe'
                        and p.value->>'probe_key' = b.probe_key)
$$;

-- 본문은 20261005130000 과 같고, insert 직전에 같은 값 유효 행 반환만 더했다
create or replace function public.csat_ec_add_process_evidence(p_session uuid, p_item_no smallint, p_kind text, p_value jsonb,
                                                               p_supersedes uuid default null)
returns uuid language plpgsql security definer set search_path = '' as $$
declare v_id uuid; v_b public.csat_ec_boundary;
begin
  if not exists (select 1 from public.csat_dx_session s join public.csat_dx_response r on r.session_id = s.id
                  where s.id = p_session and r.item_no = p_item_no and s.user_id = (select auth.uid())) then
    raise exception 'csat_ec: 자기 응답에만 남길 수 있다';
  end if;
  perform 1 from public.csat_dx_session where id = p_session for share;
  perform pg_advisory_xact_lock(hashtextextended('csat_ec_resp|' || p_session::text || '|' || p_item_no::text, 0));
  if exists (select 1 from public.csat_ec_review_round r
              where r.status in ('blind_review', 'reveal', 'adjudication')
                and r.targets @> jsonb_build_array(jsonb_build_object('session_id', p_session, 'item_no', p_item_no))) then
    raise exception 'csat_ec: 검수 중인 문항이라 바꿀 수 없다';
  end if;
  if p_kind = 'blocked_span' then
    if p_value->>'item_id' is distinct from (select r.item_id from public.csat_dx_response r where r.session_id = p_session and r.item_no = p_item_no) then
      raise exception 'csat_ec: 표시한 위치가 이 응답의 문항이 아니다';
    end if;
    if not exists (
        select 1 from public.csat_items i
         where i.id = p_value->>'item_id'
           and length(coalesce(case p_value->>'part' when 'passage' then i.passage when 'stem' then i.stem
                                     else i.choices->>(((p_value->>'option')::int) - 1) end, '')) > 0
           and (p_value->>'end')::int <=
                length(case p_value->>'part' when 'passage' then i.passage when 'stem' then i.stem
                            else i.choices->>(((p_value->>'option')::int) - 1) end)) then
      raise exception 'csat_ec: 표시한 위치가 문항 원문 범위 밖이다';
    end if;
  end if;
  if p_kind = 'targeted_probe' then
    select b.* into v_b from public.csat_ec_boundary b join public.csat_ec_taxonomy_version t on t.version = b.version and t.status = 'sealed'
     where b.version = p_value->>'taxonomy_version' and b.boundary_key = p_value->>'boundary_key';
    if v_b.boundary_key is null or v_b.status <> 'provisional' or v_b.probe_key is distinct from p_value->>'probe_key' then
      raise exception 'csat_ec: 사전에 정의된 미해결 경계의 probe 가 아니다';
    end if;
    if not exists (select 1 from public.csat_ec_boundary_signal s
                    where s.session_id = p_session and s.item_no = p_item_no and s.taxonomy_version = v_b.version
                      and s.boundary_key = v_b.boundary_key and s.probe_required) then
      raise exception 'csat_ec: 이 응답에 요구된 probe 가 아니다';
    end if;
  end if;
  -- 재시도 멱등 — 정정이 아니고 같은 종류 · 같은 값의 유효 행(지금 문항 입력 · 정정되지 않음)이 있으면 그 행
  if p_supersedes is null then
    select p.id into v_id from public.csat_ec_process_evidence p
     where p.session_id = p_session and p.item_no = p_item_no and p.kind = p_kind and p.value = p_value
       and p.item_input_hash = public.csat_ec_item_input_hash(p_session, p_item_no)
       and not exists (select 1 from public.csat_ec_process_evidence q where q.supersedes_id = p.id)
     order by p.created_at, p.id limit 1;
    if v_id is not null then return v_id; end if;
  end if;
  insert into public.csat_ec_process_evidence (session_id, item_no, user_id, kind, value, item_input_hash, supersedes_id)
  values (p_session, p_item_no, (select auth.uid()), p_kind, p_value, public.csat_ec_item_input_hash(p_session, p_item_no), p_supersedes)
  returning id into v_id;
  return v_id;
end $$;

revoke all on function public.csat_ec_my_pending_probes(uuid) from public, anon, authenticated, service_role;
grant execute on function public.csat_ec_my_pending_probes(uuid) to authenticated;
revoke all on function public.csat_ec_add_process_evidence(uuid,smallint,text,jsonb,uuid) from public, anon, authenticated, service_role;
grant execute on function public.csat_ec_add_process_evidence(uuid,smallint,text,jsonb,uuid) to authenticated;

commit;
