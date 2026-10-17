-- supabase/migrations/_pending_workspace_supply_c_annotation_binding.sql
-- ⚠️ 보류(적용 안 함) — 별도 승인안. C(`_pending_workspace_supply_c_qualification.sql`) **바로 뒤**, B 보다 먼저 적용한다.
-- 근거: docs/research/factory-i2-r5-qualification-20261017/PACKET.md §4 (PR #281 §3-5 — B 의 csat_item revision 에 주석 hash 가 없다).
--
-- 무엇: 자격 행을 「문항 revision」 만이 아니라 「채점 주석 revision」 에도 묶는다.
--   · 채점 주석(claim-support 등)은 DB 가 아니라 코드 파일이다 — SQL 이 스스로 hash 를 계산할 수 없다.
--     그래서 hash 는 기록 시 서버가 넘기고(annotationHash = sha256(JSON.stringify(주석)) · 시도 행 content_hash 와 같은 공식),
--     공급 시점에는 서버가 「지금 살아 있는 주석 hash」 를 넘겨 자격 행과 **같을 때만** 납품한다(B 쪽 비교는 별도 delta).
--   · 주석이 바뀌면 같은 문항 revision 이라도 이전 자격을 상속하지 않는다(새 자격 행 필요).
--   · 주석을 쓰는 평가 · 내용 축(B · C · E)이 pass 인데 annotation_hash 가 없으면 거절한다(결속 없는 pass 금지).
--   · 기존 행은 없다(C 미설치) — 백필 없음.
-- 되돌리기: alter table public.content_qualification drop constraint content_qualification_annotation_bound,
--           drop column annotation_hash, drop column annotation_ref; 그리고 아래 함수를 C 원본 정의로 되돌린다.

alter table public.content_qualification
  add column annotation_ref text check (annotation_ref is null or length(annotation_ref) between 1 and 200),       -- 예: claim-support-2020-24.v1
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
returns uuid language plpgsql security definer set search_path to 'public' as $$
declare v_id uuid; prev record;
begin
  if auth.uid() is null or not public.is_admin_or_curator() then raise exception 'Forbidden' using errcode = '42501'; end if;
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

-- B 쪽 후속(이 파일 범위 밖 · 별도 delta): workspace_delivery_record 가 p_annotation_hash 를 받아
--   qualification.annotation_hash is distinct from p_annotation_hash 이면 'revision_mismatch' 로 거절한다.
--   서버는 그 값을 currentItemTask(itemId) 의 annotationHash 로만 계산한다(클라이언트 입력 금지).
