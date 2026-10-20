-- scripts/db/factory-i1/d3.sql
-- D3 v1: 검토·격리 검증용 정본. supabase/migrations 자동 적용 대상 밖. 공유 DB 적용은 별도 승인.
-- 기존 _pending_workspace_supply_i1_d3_lineage.sql 초안을 대체하며 함께 적용하지 않는다.
-- 계획 계보 ≠ 적합성/생산 실행/출시/개인 납품. 기존 B/C/D2 함수와 데이터는 변경하지 않는다.
-- service_role은 검증된 서버 게이트의 신뢰 주체다. 일반 admin JWT 직접 RPC 실행은 금지한다.

create function public.factory_lineage_canonical(v jsonb, depth integer default 0)
returns text language plpgsql immutable set search_path to 'public', 'pg_temp' as $$
declare result text; k text;
begin
  if depth > 24 then raise exception 'registry_profile_depth'; end if;
  case jsonb_typeof(v)
    when 'object' then
      for k in select jsonb_object_keys(v) loop
        if k !~ '^[A-Za-z_][A-Za-z0-9_.:-]*$' or k='__proto__' then raise exception 'registry_profile_ascii_key_required'; end if;
      end loop;
      select '{' || coalesce(string_agg(to_jsonb(key)::text || ':' || public.factory_lineage_canonical(value,depth+1), ',' order by key collate "C"),'') || '}' into result from jsonb_each(v);
      return result;
    when 'array' then
      select '[' || coalesce(string_agg(public.factory_lineage_canonical(value,depth+1),',' order by ord),'') || ']' into result from jsonb_array_elements(v) with ordinality a(value,ord);
      return result;
    when 'number' then
      if (v::text)::numeric <> trunc((v::text)::numeric) or abs((v::text)::numeric) > 9007199254740991 then raise exception 'registry_profile_integer_required'; end if;
      return trunc((v::text)::numeric)::text;
    else return v::text;
  end case;
end $$;

create function public.factory_lineage_actor(p_actor uuid, p_write boolean)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select exists(select 1 from public.user_profiles p where p.user_id=p_actor
    and (to_jsonb(p)->>'status') is distinct from 'suspended' and (to_jsonb(p)->>'status') is distinct from 'deleted'
    and case when p_write then p.role='admin' else p.role in ('admin','curator') end)
$$;

create function public.factory_lineage_spec(p_definition text,p_line jsonb)
returns jsonb language sql immutable set search_path to 'public', 'pg_temp' as $$
  select jsonb_build_object('schema','vf.factory-lineage-spec/1','definition',p_definition,'task',p_line->'task','role',p_line->'role',
    'types',(select coalesce(jsonb_agg(x order by x collate "C"),'[]') from (select distinct jsonb_array_elements_text(p_line->'types') x) a),
    'keys',(select coalesce(jsonb_agg(x order by x collate "C"),'[]') from (select distinct jsonb_array_elements_text(p_line->'keys') x) a),
    'requires',p_line->'requires')
$$;

create table public.factory_product_order (
  product_order_id text not null check(product_order_id ~ '^[A-Za-z0-9._:-]{1,200}$'),
  order_revision integer not null check(order_revision>0),
  order_hash text not null check(order_hash ~ '^[0-9a-f]{64}$'),
  canonical_order text not null check(octet_length(canonical_order)<=100000),
  spec jsonb not null,
  spec_hash text not null check(spec_hash ~ '^[0-9a-f]{64}$'),
  quantity integer not null check(quantity between 1 and 10000),
  unit text not null default 'item' check(unit='item'),
  validator text not null default 'factory-sealer@663f2eee8' check(validator='factory-sealer@663f2eee8'),
  reason text not null check(length(btrim(reason)) between 1 and 500),
  registered_by uuid not null references auth.users(id),
  request_key uuid not null unique,
  created_at timestamptz not null default now(),
  primary key(product_order_id,order_revision),
  unique(product_order_id,order_revision,order_hash),
  check(order_hash=encode(sha256(convert_to(canonical_order,'UTF8')),'hex')),
  check(canonical_order=public.factory_lineage_canonical(canonical_order::jsonb)),
  check((canonical_order::jsonb->>'schema')='textbook-product-order/1'),
  check((canonical_order::jsonb->>'product_order_id')=product_order_id),
  check((canonical_order::jsonb->>'order_revision')::integer=order_revision),
  check(spec_hash=encode(sha256(convert_to(public.factory_lineage_canonical(spec),'UTF8')),'hex')),
  check((spec->>'schema')='vf.factory-lineage-spec/1'),
  check((spec->>'role') in ('source_analysis','model_explanation','guided_practice','independent_check','transfer','delayed_check'))
);

create table public.factory_order_product_link (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.factory_order(id),
  product_order_id text not null,
  order_revision integer not null,
  order_hash text not null,
  demand_signature text not null check(demand_signature ~ '^[0-9a-f]{64}$'),
  snapshot jsonb not null,
  snapshot_hash text not null,
  quantity integer not null check(quantity between 1 and 50),
  reason text not null check(length(btrim(reason)) between 1 and 500),
  linked_by uuid not null references auth.users(id),
  request_key uuid not null unique,
  created_at timestamptz not null default now(),
  unique(order_id,product_order_id,order_revision),
  foreign key(product_order_id,order_revision,order_hash) references public.factory_product_order(product_order_id,order_revision,order_hash),
  check(snapshot_hash=encode(sha256(convert_to(public.factory_lineage_canonical(snapshot),'UTF8')),'hex'))
);

create table public.factory_product_order_withdrawal (
  id uuid primary key default gen_random_uuid(),
  product_order_id text not null,
  order_revision integer not null,
  order_hash text not null,
  reason text not null check(length(btrim(reason)) between 1 and 500),
  withdrawn_by uuid not null references auth.users(id),
  request_key uuid not null unique,
  created_at timestamptz not null default now(),
  unique(product_order_id,order_revision),
  foreign key(product_order_id,order_revision,order_hash) references public.factory_product_order(product_order_id,order_revision,order_hash)
);

create function public.factory_product_order_is_current(p_id text,p_revision integer)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select exists(select 1 from public.factory_product_order f where f.product_order_id=p_id and f.order_revision=p_revision
    and not exists(select 1 from public.factory_product_order n where n.product_order_id=p_id and n.order_revision>p_revision)
    and not exists(select 1 from public.factory_product_order_withdrawal w where w.product_order_id=p_id and w.order_revision=p_revision))
$$;

-- 성공한 자연키 재전송의 별칭 UUID도 보존한다. 모든 action에서 UUID 재사용을 함께 차단한다.
create table public.factory_lineage_request (
  request_key uuid primary key,
  action text not null check(action in ('register','link','withdraw')),
  actor uuid not null references auth.users(id),
  body jsonb not null,
  result text not null,
  created_at timestamptz not null default now()
);
create function public.factory_lineage_replay(p_request uuid,p_action text,p_actor uuid,p_body jsonb)
returns text language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare prev record;
begin
  if p_request is null then raise exception 'lineage: request required'; end if;
  perform pg_advisory_xact_lock(hashtextextended('factory_lineage_request:'||p_request::text,0));
  select * into prev from public.factory_lineage_request where request_key=p_request;
  if found then
    if (prev.action,prev.actor,prev.body) is distinct from (p_action,p_actor,p_body) then raise exception 'lineage: different body' using errcode='23505'; end if;
    return prev.result;
  end if;
  return null;
end $$;

create function public.factory_lineage_snapshot(p_order uuid)
returns jsonb language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select jsonb_build_object('demand_id',d.id::text,'demand_signature',d.signature,'line_id',l.id::text,'line_no',l.line_no,
    'order_id',o.id::text,'order_seq',o.order_seq,'order_quantity',o.quantity,'order_state',o.state,
    'parent_order_id',o.parent_order_id::text,'order_reason',o.reason,'workspace_id',o.workspace_id::text,
    'goal_version',d.goal_version_id,'plan_version',d.plan_version,'definition',d.definition_version)
  from public.factory_order o join public.workspace_content_demand_line l on l.id=o.line_id
    join public.workspace_content_demand d on d.id=l.demand_id where o.id=p_order
$$;

create function public.factory_lineage_personal_current(p_order uuid)
returns boolean language sql stable security definer set search_path to 'public', 'pg_temp' as $$
  select exists(select 1 from public.factory_order o join public.workspace_content_demand_line l on l.id=o.line_id
    join public.workspace_content_demand d on d.id=l.demand_id join public.learner_workspace w on w.id=o.workspace_id and w.user_id=o.user_id
    join lateral(select p.plan_version,p.goal_version_id from public.learner_workspace_plan p where p.workspace_id=w.id and p.user_id=w.user_id order by p.plan_version desc limit 1) p on true
    where o.id=p_order and w.status='active' and o.state not in ('delivered','partial','failed')
      and d.plan_version=p.plan_version and d.goal_version_id is not distinct from p.goal_version_id
      and d.goal_version_id is not distinct from (select max(g.id) from public.csat_map_goal_version g where g.user_id=o.user_id))
$$;

create function public.factory_product_order_register(p_actor uuid,p_canonical text,p_hash text,p_spec jsonb,p_quantity integer,p_reason text,p_request uuid)
returns text language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare b jsonb:=p_canonical::jsonb; pid text:=b->>'product_order_id'; rev integer:=(b->>'order_revision')::integer; prev record; mx integer; body jsonb; replay text;
begin
  if public.factory_lineage_actor(p_actor,true) is not true then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_request is null or p_canonical is null or p_spec is null or p_hash is null then raise exception 'registration: required body'; end if;
  body:=jsonb_build_array(p_canonical,p_hash,p_spec,p_quantity,p_reason);
  replay:=public.factory_lineage_replay(p_request,'register',p_actor,body);
  if replay is not null then return replay; end if;
  if (b->>'schema') is distinct from 'textbook-product-order/1' or b->>'sealed_at' is null or b->>'created_at' is null then raise exception 'registration: sealed order required'; end if;
  if p_spec is distinct from public.factory_lineage_spec(p_spec->>'definition',jsonb_build_object('task',p_spec->'task','role',p_spec->'role','types',p_spec->'types','keys',p_spec->'keys','requires',p_spec->'requires'))
    or p_spec->>'definition' is null or p_spec->>'task' is null or p_spec->'requires' is null then raise exception 'registration: invalid spec'; end if;
  perform pg_advisory_xact_lock(hashtextextended('factory_lineage:'||pid,0));
  select * into prev from public.factory_product_order where request_key=p_request or (product_order_id=pid and order_revision=rev) order by (request_key=p_request) desc limit 1;
  if found then
    if (prev.registered_by,prev.canonical_order,prev.order_hash,prev.spec,prev.quantity,prev.reason) is distinct from (p_actor,p_canonical,p_hash,p_spec,p_quantity,p_reason) then raise exception 'registration: different body' using errcode='23505'; end if;
    insert into public.factory_lineage_request(request_key,action,actor,body,result) values(p_request,'register',p_actor,body,prev.product_order_id);
    return prev.product_order_id;
  end if;
  select max(order_revision) into mx from public.factory_product_order where product_order_id=pid;
  if rev is distinct from coalesce(mx,0)+1 then raise exception 'registration: next revision required'; end if;
  if mx is not null and exists(select 1 from public.factory_product_order where product_order_id=pid and (spec->>'task',spec->>'role') is distinct from (p_spec->>'task',p_spec->>'role')) then raise exception 'registration: task/role immutable'; end if;
  insert into public.factory_product_order(product_order_id,order_revision,order_hash,canonical_order,spec,spec_hash,quantity,reason,registered_by,request_key)
  values(pid,rev,p_hash,p_canonical,p_spec,encode(sha256(convert_to(public.factory_lineage_canonical(p_spec),'UTF8')),'hex'),p_quantity,p_reason,p_actor,p_request);
  insert into public.factory_lineage_request(request_key,action,actor,body,result) values(p_request,'register',p_actor,body,pid);
  return pid;
end $$;

create function public.factory_order_link_product(p_actor uuid,p_order uuid,p_id text,p_revision integer,p_hash text,p_signature text,p_quantity integer,p_reason text,p_request uuid)
returns uuid language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare o record; f record; d record; l record; prev record; spec jsonb; snap jsonb; assigned integer; result uuid; body jsonb; replay text;
begin
  if public.factory_lineage_actor(p_actor,true) is not true then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_request is null or p_order is null or p_id is null or p_hash is null or p_signature is null then raise exception 'link: required body'; end if;
  body:=jsonb_build_array(p_order,p_id,p_revision,p_hash,p_signature,p_quantity,p_reason);
  replay:=public.factory_lineage_replay(p_request,'link',p_actor,body);
  if replay is not null then return replay::uuid; end if;
  -- 모든 링크는 order 행을 먼저 잠근다. 등록/철회는 product 잠금만 사용하므로 역방향 잠금 없음.
  select * into o from public.factory_order where id=p_order for update;
  if not found then raise exception 'link: order not found'; end if;
  perform pg_advisory_xact_lock(hashtextextended('factory_lineage:'||p_id,0));
  select * into prev from public.factory_order_product_link where request_key=p_request or (order_id=p_order and product_order_id=p_id and order_revision=p_revision) order by (request_key=p_request) desc limit 1;
  if found then
    if (prev.linked_by,prev.order_id,prev.product_order_id,prev.order_revision,prev.order_hash,prev.demand_signature,prev.quantity,prev.reason)
      is distinct from (p_actor,p_order,p_id,p_revision,p_hash,p_signature,p_quantity,p_reason) then raise exception 'link: different body' using errcode='23505'; end if;
    insert into public.factory_lineage_request(request_key,action,actor,body,result) values(p_request,'link',p_actor,body,prev.id::text);
    return prev.id; -- 과거 사실만 반환. 현재성은 reader에서 매번 별도 판정.
  end if;
  if public.factory_lineage_personal_current(p_order) is not true then raise exception 'link: personal order not current'; end if;
  select * into l from public.workspace_content_demand_line where id=o.line_id;
  select * into d from public.workspace_content_demand where id=l.demand_id;
  if d.signature is distinct from p_signature then raise exception 'link: demand signature mismatch'; end if;
  spec:=public.factory_lineage_spec(d.definition_version,d.canonical::jsonb->'lines'->l.line_no);
  select * into f from public.factory_product_order where product_order_id=p_id and order_revision=p_revision;
  if not found then raise exception 'link: product not registered'; end if;
  if f.order_hash is distinct from p_hash then raise exception 'link: order hash mismatch'; end if;
  if public.factory_product_order_is_current(p_id,p_revision) is not true then raise exception 'link: product not current'; end if;
  if f.spec is distinct from spec or (f.spec->>'task',f.spec->>'role') is distinct from (o.task_id,o.role) then raise exception 'link: spec mismatch'; end if;
  select coalesce(sum(x.quantity),0) into assigned from public.factory_order_product_link x
    where x.order_id=p_order and public.factory_product_order_is_current(x.product_order_id,x.order_revision);
  if p_quantity is null or p_quantity<1 or p_quantity>f.quantity or assigned+p_quantity>o.quantity then raise exception 'link: coverage quantity exceeded'; end if;
  snap:=public.factory_lineage_snapshot(p_order);
  insert into public.factory_order_product_link(order_id,product_order_id,order_revision,order_hash,demand_signature,snapshot,snapshot_hash,quantity,reason,linked_by,request_key)
  values(p_order,p_id,p_revision,p_hash,p_signature,snap,encode(sha256(convert_to(public.factory_lineage_canonical(snap),'UTF8')),'hex'),p_quantity,p_reason,p_actor,p_request) returning id into result;
  insert into public.factory_lineage_request(request_key,action,actor,body,result) values(p_request,'link',p_actor,body,result::text);
  return result;
end $$;

create function public.factory_product_order_withdraw(p_actor uuid,p_id text,p_revision integer,p_hash text,p_reason text,p_request uuid)
returns uuid language plpgsql security definer set search_path to 'public', 'pg_temp' as $$
declare prev record; result uuid; body jsonb; replay text;
begin
  if public.factory_lineage_actor(p_actor,true) is not true then raise exception 'Forbidden' using errcode='42501'; end if;
  if p_request is null or p_id is null or p_revision is null or p_hash is null then raise exception 'withdraw: required body'; end if;
  body:=jsonb_build_array(p_id,p_revision,p_hash,p_reason);
  replay:=public.factory_lineage_replay(p_request,'withdraw',p_actor,body);
  if replay is not null then return replay::uuid; end if;
  perform pg_advisory_xact_lock(hashtextextended('factory_lineage:'||p_id,0));
  select * into prev from public.factory_product_order_withdrawal where request_key=p_request or (product_order_id=p_id and order_revision=p_revision) order by (request_key=p_request) desc limit 1;
  if found then
    if (prev.withdrawn_by,prev.product_order_id,prev.order_revision,prev.order_hash,prev.reason) is distinct from (p_actor,p_id,p_revision,p_hash,p_reason) then raise exception 'withdraw: different body' using errcode='23505'; end if;
    insert into public.factory_lineage_request(request_key,action,actor,body,result) values(p_request,'withdraw',p_actor,body,prev.id::text);
    return prev.id;
  end if;
  insert into public.factory_product_order_withdrawal(product_order_id,order_revision,order_hash,reason,withdrawn_by,request_key)
  values(p_id,p_revision,p_hash,p_reason,p_actor,p_request) returning id into result;
  insert into public.factory_lineage_request(request_key,action,actor,body,result) values(p_request,'withdraw',p_actor,body,result::text);
  return result;
end $$;

create function public.factory_lineage_read(p_actor uuid,p_user uuid,p_workspace uuid)
returns jsonb language plpgsql stable security definer set search_path to 'public', 'pg_temp' as $$
declare result jsonb; total integer;
begin
  if public.factory_lineage_actor(p_actor,false) is not true then raise exception 'Forbidden' using errcode='42501'; end if;
  if not exists(select 1 from public.learner_workspace where id=p_workspace and user_id=p_user) then raise exception 'lineage: workspace not owned'; end if;
  select count(*) into total from public.factory_order_product_link l join public.factory_order o on o.id=l.order_id where o.workspace_id=p_workspace and o.user_id=p_user;
  select coalesce(jsonb_agg(row),'[]') into result from (
    select l.id,l.order_id,l.product_order_id,l.order_revision,l.order_hash,l.quantity,l.created_at,
      f.quantity as product_quantity,
      public.factory_product_order_is_current(l.product_order_id,l.order_revision) as product_current,
      public.factory_lineage_personal_current(l.order_id) as personal_current,
      case when exists(select 1 from public.factory_product_order_withdrawal w where w.product_order_id=l.product_order_id and w.order_revision=l.order_revision) then 'withdrawn'
        when not public.factory_product_order_is_current(l.product_order_id,l.order_revision) then 'superseded'
        when not public.factory_lineage_personal_current(l.order_id) then 'personal_order_changed' else 'current' end as status
    from public.factory_order_product_link l join public.factory_order o on o.id=l.order_id
      join public.factory_product_order f using(product_order_id,order_revision,order_hash)
    where o.workspace_id=p_workspace and o.user_id=p_user order by l.created_at desc,l.id limit 100
  ) row;
  return jsonb_build_object('rows',result,'total',total,'limited',total>100);
end $$;

-- 명시적 ACL. default privilege ALL 및 service_role BYPASSRLS에 기대지 않는다.
do $$ declare t text; f record; begin
  foreach t in array array['factory_product_order','factory_order_product_link','factory_product_order_withdrawal','factory_lineage_request'] loop
    execute format('alter table public.%I enable row level security',t);
    execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);
    execute format('grant select on public.%I to authenticated',t);
    execute format('create policy lineage_admin_read on public.%I for select to authenticated using (public.factory_lineage_actor(auth.uid(),false))',t);
    execute format('create trigger lineage_append_only before update or delete on public.%I for each row execute function public.forbid_ledger_mutation()',t);
  end loop;
  for f in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.proname in ('factory_lineage_canonical','factory_lineage_actor','factory_lineage_spec','factory_lineage_snapshot','factory_lineage_personal_current','factory_lineage_replay','factory_product_order_is_current','factory_product_order_register','factory_order_link_product','factory_product_order_withdraw','factory_lineage_read') loop
    execute format('revoke all on function %s from public,anon,authenticated,service_role',f.sig);
  end loop;
end $$;
grant execute on function public.factory_lineage_actor(uuid,boolean) to authenticated;
grant execute on function public.factory_product_order_register(uuid,text,text,jsonb,integer,text,uuid),
  public.factory_order_link_product(uuid,uuid,text,integer,text,text,integer,text,uuid),
  public.factory_product_order_withdraw(uuid,text,integer,text,text,uuid),
  public.factory_lineage_read(uuid,uuid,uuid) to service_role;
