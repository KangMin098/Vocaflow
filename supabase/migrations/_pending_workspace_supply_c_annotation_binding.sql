-- supabase/migrations/_pending_workspace_supply_c_annotation_binding.sql
-- ⚠️ 보류(적용 안 함) — 독립 수정 승인안 v2. C → B → I1-S → (선택 P) → 이 파일. 한 트랜잭션.
-- I1-S 뒤에만 적용한다(옛 서명 재생성·search_path/NULL 권한 가드 퇴행 방지). I0 delta와 함께 적용하지 않는다.
-- 근거: docs/research/factory-i2-r5-qualification-20261017/PACKET.md §4 (PR #281 §3-5 — B 의 csat_item revision 에 주석 hash 가 없다).
--
-- 무엇: 자격 행을 「문항 revision」 만이 아니라 「채점 주석 revision」 에도 묶는다.
--   · 채점 주석(claim-support 등)은 DB 가 아니라 코드 파일이다 — SQL 이 스스로 hash 를 계산할 수 없다.
--     그래서 hash 는 기록 시 서버가 넘기고(annotationHash = sha256(JSON.stringify(주석)) · 시도 행 content_hash 와 같은 공식),
--     공급 시점에는 아래 공급 wrapper가 신뢰된 현재 배포 등록부와 ref/hash/문항 revision/TASK를 대조한다.
--   · 주석이 바뀌면 같은 문항 revision 이라도 이전 자격을 상속하지 않는다(새 자격 행 필요).
--   · 주석을 쓰는 평가 · 내용 축(B · C · E)이 pass 인데 annotation_hash 가 없으면 거절한다(결속 없는 pass 금지).
--   · 기존 행은 없다(C 미설치) — 백필 없음.
-- 중단: 현재 주석 등록을 보류하면 모든 csat 신규 공급/현재 충족도는 false. 기존 자격·납품·G2는 보존.
-- 기존 I1 rollback은 이 v2를 알지 못한다. 별도 역순 복원 승인 전 실행하지 않는다. 이력 존재 후 열/표 DROP 금지.
do $$ begin
  if to_regprocedure('public.supply_delivery_valid(uuid)') is null then
    raise exception 'annotation binding v2 requires C -> B -> I1-S first';
  end if;
end $$;

alter table public.content_qualification
  add column annotation_ref text check (annotation_ref is null or length(btrim(annotation_ref)) between 1 and 200),       -- 예: claim-support-2020-24.v1
  add column annotation_hash text check (annotation_hash is null or annotation_hash ~ '^[0-9a-f]{64}$');

-- 주석 기반 과제의 csat_item 자격: 내용(B) · TASK 수행(C) · 평가(E) 중 하나라도 pass 면 주석 결속 필수
alter table public.content_qualification add constraint content_qualification_annotation_bound check (
  artifact_kind <> 'csat_item'
  or not ((axes->'B'->>'state') = 'pass' or (axes->'C'->>'state') = 'pass' or (axes->'E'->>'state') = 'pass')
  or (annotation_ref is not null and annotation_hash is not null)
);

-- 정체성 조회에 주석 hash 포함(같은 문항 revision · 다른 주석 = 다른 자격)
drop index if exists public.content_qualification_identity;
create index content_qualification_identity on public.content_qualification
  (artifact_kind, artifact_ref, artifact_revision, task_id, role, annotation_hash);

-- 기록 함수 — C 원본 인자 + 주석 결속 2개. 이전 서명은 회수한다(주석 없이 기록하는 경로를 남기지 않는다).
revoke all on function public.content_qualification_record(text,text,text,text,text,text,jsonb,text,text,text,text,text,text[],text[],text,uuid) from authenticated;
drop function public.content_qualification_record(text,text,text,text,text,text,jsonb,text,text,text,text,text,text[],text[],text,uuid);

create or replace function public.content_qualification_record(
  p_rules_version text, p_kind text, p_ref text, p_revision text, p_task text, p_role text, p_axes jsonb,
  p_source_revision text, p_source_hash text, p_analysis_revision text, p_gold_revision text, p_gold_hash text,
  p_annotation_ref text, p_annotation_hash text,
  p_defects text[], p_evidence_ids text[], p_method text, p_supersedes uuid default null)
returns uuid language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare v_id uuid; prev record;
begin
  if auth.uid() is null or public.is_admin_or_curator() is not true then raise exception 'Forbidden' using errcode = '42501'; end if;
  perform set_config('vocaflow.supply_writer', 'rpc', true);
  if p_supersedes is not null then
    select * into prev from content_qualification where id = p_supersedes for update;
    if not found then raise exception 'supersedes: not found'; end if;
    if (prev.artifact_kind, prev.artifact_ref, prev.task_id, prev.role) is distinct from (p_kind, p_ref, p_task, p_role) then
      raise exception 'supersedes: identity mismatch';
    end if;
  end if;
  insert into content_qualification (rules_version, artifact_kind, artifact_ref, artifact_revision, task_id, role, axes,
    source_revision, source_hash, analysis_revision, gold_revision, gold_hash, annotation_ref, annotation_hash,
    defects, evidence_ids, method, supersedes, created_by)
  values (p_rules_version, p_kind, p_ref, p_revision, p_task, p_role, p_axes,
    p_source_revision, p_source_hash, p_analysis_revision, p_gold_revision, p_gold_hash, p_annotation_ref, p_annotation_hash,
    coalesce(p_defects, '{}'), coalesce(p_evidence_ids, '{}'), p_method, p_supersedes, auth.uid())
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.content_qualification_record(text,text,text,text,text,text,jsonb,text,text,text,text,text,text,text,text[],text[],text,uuid) from public, anon;
grant execute on function public.content_qualification_record(text,text,text,text,text,text,jsonb,text,text,text,text,text,text,text,text[],text[],text,uuid) to authenticated;

-- 현재 배포 주석의 신뢰 경계. 빈 상태로 설치되며 자격·승인·공급을 만들지 않는다.
-- 배포 소유자만 검증된 서버 manifest(currentItemTask + def.hash)와 원문 revision으로 갱신한다.
-- 관리자/학습자 RPC·클라이언트가 보낸 hash로 이 표를 갱신하면 안 된다. 배포 동기화 승인 전 실공급 BLOCKED.
-- 주석을 삭제/교체하는 배포는 같은 트랜잭션에서 해당 행 삭제/교체. 구 배포와의 동시 운영은 허용하지 않는다.
create table public.supply_current_annotation (
  artifact_ref text not null references public.csat_items(id),
  task_id text not null check (length(btrim(task_id)) > 0),
  artifact_revision text not null check (artifact_revision ~ '^[0-9a-f]{64}$'),
  annotation_ref text not null check (length(btrim(annotation_ref)) between 1 and 200),
  annotation_hash text not null check (annotation_hash ~ '^[0-9a-f]{64}$'),
  primary key (artifact_ref, task_id)
);
alter table public.supply_current_annotation enable row level security;
revoke all on table public.supply_current_annotation from public, anon, authenticated;
-- Supabase service_role도 자동 동기화 권한을 상속하지 않는다. 별도 배포 절차 승인 전 DB 소유자만 가능.
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'service_role') then
    execute 'revoke all on table public.supply_current_annotation from service_role';
  end if;
end $$;

create function public.supply_annotation_matches(p_qualification uuid)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select exists (
    select 1 from public.content_qualification q where q.id = p_qualification
      and (q.artifact_kind <> 'csat_item' or exists (
        select 1 from public.supply_current_annotation c
        where c.artifact_ref = q.artifact_ref and c.task_id = q.task_id
          and c.artifact_revision = q.artifact_revision
          and c.annotation_ref = q.annotation_ref and c.annotation_hash = q.annotation_hash)))
$$;
revoke all on function public.supply_annotation_matches(uuid) from public, anon, authenticated;

-- I1 검사를 그대로 보존하고 외부 호출 경로만 닫는다. 새 공개 overload는 없다.
alter function public.workspace_delivery_record(uuid,uuid,uuid,uuid,uuid) rename to workspace_delivery_record_i1;
revoke all on function public.workspace_delivery_record_i1(uuid,uuid,uuid,uuid,uuid) from public, anon, authenticated;
create function public.workspace_delivery_record(p_line uuid, p_order uuid, p_qualification uuid, p_approval uuid, p_request_key uuid)
returns uuid language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare q record;
begin
  if auth.uid() is null then raise exception 'Forbidden' using errcode = '42501'; end if;
  -- I1와 같은 줄 잠금. 기존 요청 재전송은 역사 사실 반환이며 현재 자격 재승인이 아니다.
  perform 1 from public.workspace_content_demand_line where id = p_line and user_id = auth.uid() for update;
  if exists (select 1 from public.workspace_content_delivery where user_id = auth.uid() and request_key = p_request_key) then
    return public.workspace_delivery_record_i1(p_line,p_order,p_qualification,p_approval,p_request_key);
  end if;
  select * into q from public.content_qualification where id = p_qualification for share;
  if q.artifact_kind = 'csat_item' then
    -- 배포 교체/삭제와 공급을 직렬화한다. 누락·NULL·다른 ref/hash/TASK/revision은 모두 거절.
    perform 1 from public.supply_current_annotation where artifact_ref = q.artifact_ref and task_id = q.task_id for share;
    if public.supply_annotation_matches(p_qualification) is not true then
      raise exception 'delivery: current annotation revision mismatch or unavailable';
    end if;
  end if;
  return public.workspace_delivery_record_i1(p_line,p_order,p_qualification,p_approval,p_request_key);
end $$;
revoke all on function public.workspace_delivery_record(uuid,uuid,uuid,uuid,uuid) from public, anon;
grant execute on function public.workspace_delivery_record(uuid,uuid,uuid,uuid,uuid) to authenticated;

-- 과거 공급은 삭제/해시 재작성하지 않는다. 현재 부족량 계산만 새 배포 주석과 대조한다.
alter function public.supply_delivery_valid(uuid) rename to supply_delivery_valid_i1;
revoke all on function public.supply_delivery_valid_i1(uuid) from public, anon, authenticated;
create function public.supply_delivery_valid(p_delivery uuid)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select public.supply_delivery_valid_i1(p_delivery) and exists (
    select 1 from public.workspace_content_delivery d where d.id = p_delivery
      and public.supply_annotation_matches(d.qualification_id))
$$;
revoke all on function public.supply_delivery_valid(uuid) from public, anon, authenticated;
