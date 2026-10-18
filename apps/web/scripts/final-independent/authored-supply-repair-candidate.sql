-- apps/web/scripts/final-independent/authored-supply-repair-candidate.sql
-- REVIEW CANDIDATE ONLY. Apply exclusively to disposable fixtures AFTER the frozen authored SQL.
-- Not a migration, deployment approval, human rights/Gold decision, or proof of product adoption.
-- Covers FI-002/003/004/006. Preserves all original ledger rows, revision hashes and historical replay.

-- Passage identity depends on actual text, not an author-provided group label or Gold/choices.
create function public.authored_passage_fingerprint(p_body jsonb)
returns text language plpgsql immutable set search_path to 'public','pg_temp' as $$
declare v_sentence jsonb; v_text text := ''; v_part text;
begin
  if jsonb_typeof(p_body->'sentences') is distinct from 'array'
     or jsonb_array_length(p_body->'sentences') not between 2 and 30 then return null; end if;
  for v_sentence in select value from jsonb_array_elements(p_body->'sentences') loop
    if jsonb_typeof(v_sentence) is distinct from 'string' then return null; end if;
    v_part := btrim(regexp_replace(lower(v_sentence #>> '{}'), '[[:space:]]+', ' ', 'g'));
    if v_part = '' then return null; end if;
    v_text := v_text || ' ' || v_part;
  end loop;
  return encode(sha256(convert_to(btrim(v_text),'UTF8')),'hex');
end $$;
revoke all on function public.authored_passage_fingerprint(jsonb) from public,anon,authenticated;

create or replace function public.authored_item_register(
  p_ref text,p_task text,p_task_key text,p_role_class text,p_intended_role text,p_group text,
  p_body jsonb,p_gold jsonb,p_annotation_ref text,p_provenance jsonb)
returns text language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare prev record; v_passage text; v_lock bigint;
begin
  if auth.uid() is null or public.is_admin_or_curator() is not true then raise exception 'Forbidden' using errcode='42501'; end if;
  v_passage := public.authored_passage_fingerprint(p_body);
  if v_passage is null then raise exception 'authored: nonempty string sentences required'; end if;
  perform set_config('vocaflow.supply_writer','rpc',true);
  -- Stable global lock order covers ref idempotency, declared groups and equivalent actual text.
  for v_lock in select distinct x from unnest(array[
    hashtextextended('authored-ref|'||coalesce(p_ref,''),0),
    hashtextextended('authored-group|'||coalesce(p_group,''),0),
    hashtextextended('authored-text|'||v_passage,0)]) x order by x loop
    perform pg_advisory_xact_lock(v_lock);
  end loop;
  select * into prev from public.authored_item where ref=p_ref;
  if found then
    if (prev.task_id,prev.task_key,prev.role_class,prev.intended_role,prev.passage_group,prev.body,prev.gold,prev.annotation_ref)
       is distinct from (p_task,p_task_key,p_role_class,p_intended_role,p_group,p_body,p_gold,p_annotation_ref) then
      raise exception 'authored: ref exists with a different body — register a new ref' using errcode='23505';
    end if;
    return prev.ref;
  end if;
  if exists(select 1 from public.authored_item a where a.role_class<>p_role_class
      and (a.passage_group=p_group or public.authored_passage_fingerprint(a.body)=v_passage)) then
    raise exception 'authored: actual passage mixes instruction and assessment';
  end if;
  insert into public.authored_item(ref,task_id,task_key,role_class,intended_role,passage_group,body,gold,annotation_ref,provenance,created_by)
  values(p_ref,p_task,p_task_key,p_role_class,p_intended_role,p_group,p_body,p_gold,p_annotation_ref,p_provenance,auth.uid());
  return p_ref;
end $$;

-- Read-only transitive closure: preserve declared aliases and join text-equivalent aliases.
-- No existing body, group label, key, revision or historical binding is rewritten.
create or replace function public.authored_group_refs(p_ref text)
returns text[] language sql stable security definer set search_path to 'public','pg_temp' as $$
  with recursive linked(ref,passage_group,fingerprint) as (
    select a.ref,a.passage_group,public.authored_passage_fingerprint(a.body) from public.authored_item a where a.ref=p_ref
    union
    select b.ref,b.passage_group,public.authored_passage_fingerprint(b.body)
      from linked a join public.authored_item b on b.passage_group=a.passage_group
          or public.authored_passage_fingerprint(b.body)=a.fingerprint)
  select coalesce(array_agg(ref order by ref),array[p_ref]) from linked
$$;

-- Reject invalid new qualification identity before appending to the qualification ledger.
create function public.authored_qualification_identity_guard()
returns trigger language plpgsql security definer set search_path to 'public','pg_temp' as $$
begin
  if new.artifact_kind='authored_item' and not exists(
    select 1 from public.authored_item a where a.ref=new.artifact_ref and a.task_id=new.task_id
      and a.intended_role=new.role
      and (a.role_class='assessment')=(new.role in ('independent_check','transfer','delayed_check'))
      and a.annotation_ref=new.annotation_ref and public.authored_item_gold_hash(a.ref)=new.annotation_hash
      and (new.gold_hash is null or new.gold_hash=new.annotation_hash)
      and not exists(select 1 from public.authored_item b where b.ref=any(public.authored_group_refs(a.ref))
        and b.role_class<>a.role_class)) then
    raise exception 'qualification: authored TASK/role/annotation identity mismatch';
  end if;
  return new;
end $$;
revoke all on function public.authored_qualification_identity_guard() from public,anon,authenticated;
create trigger authored_qualification_identity before insert on public.content_qualification
  for each row execute function public.authored_qualification_identity_guard();

-- Re-check historical identities without mutating history. Malformed old qualifications are not currently valid.
create or replace function public.supply_annotation_matches(p_qualification uuid)
returns boolean language sql stable security definer set search_path to 'public','pg_temp' as $$
  select case when q.artifact_kind='authored_item' then exists(
    select 1 from public.authored_item a where a.ref=q.artifact_ref and a.task_id=q.task_id
      and a.intended_role=q.role
      and (a.role_class='assessment')=(q.role in ('independent_check','transfer','delayed_check'))
      and a.annotation_ref=q.annotation_ref and public.authored_item_gold_hash(a.ref)=q.annotation_hash
      and (q.gold_hash is null or q.gold_hash=q.annotation_hash)
      and not exists(select 1 from public.authored_item b where b.ref=any(public.authored_group_refs(a.ref))
        and b.role_class<>a.role_class))
    else public.supply_annotation_matches_i2(q.id) end
  from public.content_qualification q where q.id=p_qualification
$$;

-- Rights permission describes actual use. Human Gold's assess scope is never a rights grant.
create or replace function public.supply_human_decisions_ok(p_qualification uuid)
returns boolean language sql stable security definer set search_path to 'public','pg_temp' as $$
  select exists(select 1 from public.content_qualification q where q.id=p_qualification
    and public.content_human_decision_ok('rights',q.artifact_kind,q.artifact_ref,q.artifact_revision,q.artifact_revision,
      case when q.role in ('independent_check','transfer','delayed_check')
           then array['store','display','transmit','assess'] else array['store','display','transmit'] end)
    and (q.artifact_kind<>'authored_item' or q.role not in ('independent_check','transfer','delayed_check')
      or (q.gold_hash is not null and public.content_human_decision_ok('gold',q.artifact_kind,q.artifact_ref,q.artifact_revision,q.gold_hash,array['assess']))))
$$;

create or replace function public.workspace_delivery_record(p_line uuid,p_order uuid,p_qualification uuid,p_approval uuid,p_request_key uuid)
returns uuid language plpgsql security definer set search_path to 'public','pg_temp' as $$
declare q record; v_refs text[];
begin
  if auth.uid() is null then raise exception 'Forbidden' using errcode='42501'; end if;
  -- Snapshot refresh after waiting is necessary. Unsupported transaction isolation fails closed.
  if current_setting('transaction_isolation')<>'read committed' then
    raise exception 'delivery: requires read committed isolation' using errcode='40001';
  end if;
  -- Deliberately coarse per-learner serialization occurs before any line/order lock in this RPC.
  -- Different passages remain legal after the first commit. Existing request receipts still replay.
  perform pg_advisory_xact_lock(hashtextextended('authored-delivery-user|'||auth.uid()::text,0));
  perform 1 from public.workspace_content_demand_line where id=p_line and user_id=auth.uid() for update;
  if exists(select 1 from public.workspace_content_delivery where user_id=auth.uid() and request_key=p_request_key) then
    return public.workspace_delivery_record_i2(p_line,p_order,p_qualification,p_approval,p_request_key);
  end if;
  select * into q from public.content_qualification where id=p_qualification for share;
  if not found then raise exception 'delivery: qualification identity mismatch'; end if;
  if q.artifact_kind='authored_item' then
    perform 1 from public.authored_item where ref=q.artifact_ref for share;
    if public.supply_annotation_matches(q.id) is not true then raise exception 'delivery: authored identity differs from qualification'; end if;
    if q.role in ('independent_check','transfer','delayed_check') then
      v_refs:=public.authored_group_refs(q.artifact_ref);
      if exists(select 1 from public.workspace_content_delivery d where d.user_id=auth.uid()
          and d.artifact_kind='authored_item' and d.artifact_ref=any(v_refs)) then
        raise exception 'delivery: G — actual passage already delivered';
      end if;
    end if;
  end if;
  perform 1 from public.content_human_decision h where h.artifact_kind=q.artifact_kind and h.artifact_ref=q.artifact_ref
    and h.artifact_revision=q.artifact_revision order by h.id for share;
  if public.supply_human_decisions_ok(q.id) is not true then raise exception 'delivery: human rights/gold decision missing or revoked'; end if;
  return public.workspace_delivery_record_i2(p_line,p_order,p_qualification,p_approval,p_request_key);
end $$;
