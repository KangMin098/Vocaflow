-- supabase/migrations/20261004122500_csat_chart_review_assets.sql
-- PENDING USER APPROVAL. Bind a private chart image and its pre-solve observation to review evidence.
-- No original image bytes, answers, or review data are included in this migration.
begin;

create table public.csat_review_visual_assets (
  id uuid primary key default gen_random_uuid(),
  item_id text not null references public.csat_items(id),
  source_input_hash text not null check (source_input_hash ~ '^[a-f0-9]{64}$'),
  pdf_sha256 text not null check (pdf_sha256 ~ '^[a-f0-9]{64}$'),
  pdf_page integer not null check (pdf_page > 0),
  image_png bytea not null check (octet_length(image_png) between 8 and 8388608
    and substring(image_png from 1 for 8) = decode('89504e470d0a1a0a','hex')),
  image_sha256 text generated always as (encode(sha256(image_png),'hex')) stored,
  inspected_by text not null check (length(btrim(inspected_by)) >= 8),
  inspection_note text not null check (length(btrim(inspection_note)) >= 40),
  created_at timestamptz not null default clock_timestamp(),
  unique (item_id,id)
);
create table public.csat_review_visual_heads (
  item_id text primary key references public.csat_items(id),
  asset_id uuid not null,
  activated_at timestamptz not null default clock_timestamp(),
  generation uuid not null default gen_random_uuid(),
  foreign key (item_id,asset_id) references public.csat_review_visual_assets(item_id,id)
);
create table public.csat_review_visual_receipts (
  run_id uuid primary key references public.csat_review_runs(id),
  asset_id uuid not null references public.csat_review_visual_assets(id),
  input_hash text not null check (input_hash ~ '^[a-f0-9]{64}$'),
  units_hash text not null check (units_hash ~ '^[a-f0-9]{64}$'),
  observation text not null check (length(btrim(observation)) >= 40),
  observed_at timestamptz not null default clock_timestamp()
);
create table public.csat_review_visual_deliveries (
  run_id uuid primary key references public.csat_review_runs(id),
  asset_id uuid not null references public.csat_review_visual_assets(id),
  input_hash text not null check (input_hash ~ '^[a-f0-9]{64}$'),
  units_hash text not null check (units_hash ~ '^[a-f0-9]{64}$'),
  delivered_at timestamptz not null default clock_timestamp()
);
-- Keep chart provenance separate: adding a nullable analysis column would change
-- the protected KICE full-row hashes even without updating a single KICE row.
create table public.csat_review_visual_analysis_bindings (
  analysis_id uuid primary key references public.csat_item_analyses(id),
  asset_id uuid not null references public.csat_review_visual_assets(id),
  input_hash text not null check (input_hash ~ '^[a-f0-9]{64}$'),
  units_hash text not null check (units_hash ~ '^[a-f0-9]{64}$'),
  analyst_run text not null,
  bound_at timestamptz not null default clock_timestamp()
);
alter table public.csat_review_visual_assets enable row level security;
alter table public.csat_review_visual_heads enable row level security;
alter table public.csat_review_visual_receipts enable row level security;
alter table public.csat_review_visual_deliveries enable row level security;
alter table public.csat_review_visual_analysis_bindings enable row level security;
revoke all on public.csat_review_visual_assets, public.csat_review_visual_heads,
  public.csat_review_visual_receipts,public.csat_review_visual_deliveries,
  public.csat_review_visual_analysis_bindings from public, anon, authenticated, service_role;
grant select,insert on public.csat_review_visual_assets to service_role;
grant select on public.csat_review_visual_heads to service_role;
grant select on public.csat_review_visual_receipts to service_role;
grant select on public.csat_review_visual_deliveries to service_role;
grant select on public.csat_review_visual_analysis_bindings to service_role;

create function public.csat_item_text_input_hash(p_item text) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select encode(sha256(convert_to(coalesce(passage,'') || E'\x1f' || coalesce(stem,'') || E'\x1f' || coalesce(choices::text,''),'UTF8')),'hex')
    from csat_items where id=p_item
$$;
create function public.csat_current_chart_asset(p_item text) returns uuid
language sql stable security definer set search_path = public, pg_temp as $$
  select a.id from csat_review_visual_heads h join csat_review_visual_assets a on a.id=h.asset_id and a.item_id=h.item_id
    join csat_items i on i.id=h.item_id
    where h.item_id=p_item and csat_is_hakpyeong_item(i.id) and i.type_id='R-CHART'
      and a.source_input_hash=csat_item_text_input_hash(i.id)
$$;
create or replace function public.csat_item_input_hash(p_item text) returns text
language sql stable security definer set search_path = public, pg_temp as $$
  select case when a.id is null then csat_item_text_input_hash(p_item)
    else encode(sha256(convert_to(csat_item_text_input_hash(p_item) || E'\x1f' || a.image_sha256
      || E'\x1f' || h.generation::text,'UTF8')),'hex') end
    from (select csat_current_chart_asset(p_item) id) current_asset
    left join csat_review_visual_assets a on a.id=current_asset.id
    left join csat_review_visual_heads h on h.item_id=p_item and h.asset_id=a.id
$$;

create function public.csat_visual_record_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare r csat_review_runs; a csat_review_visual_assets;
begin
  if tg_op <> 'INSERT' then raise exception '이미지 정본·관찰 기록은 불변이며 삭제하지 않는다'; end if;
  if tg_table_name='csat_review_visual_assets' then
    if new.inspection_note ~ '[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\ufffd]' then
      raise exception '정본 확인 기록의 인코딩이 손상됐다';
    end if;
    perform 1 from csat_items where id=new.item_id and csat_is_hakpyeong_item(id) and type_id='R-CHART' for share;
    if not found or new.source_input_hash is distinct from csat_item_text_input_hash(new.item_id) then
      raise exception '이미지 정본은 현재 학평 도표 텍스트 입력에만 연결한다';
    end if;
    new.created_at := clock_timestamp();
  else
    select * into r from csat_review_runs where id=new.run_id;
    if r.id is null then raise exception '관찰 기록의 검수 실행이 없다'; end if;
    perform pg_advisory_xact_lock(hashtextextended(r.agent_run,0));
    select * into r from csat_review_runs where id=new.run_id for update;
    perform 1 from csat_items where id=r.item_id for share;
    select * into a from csat_review_visual_assets where id=new.asset_id;
    if r.role <> 'reviewer' or r.kind <> 'blind' or r.solve_committed_at is not null or r.revealed_at is not null
      or a.item_id is distinct from r.item_id or a.id is distinct from csat_current_chart_asset(r.item_id)
      or not csat_blind_source_unseen(r.item_id,r.agent_run,clock_timestamp()) then
      raise exception '도표 관찰은 현재 이미지의 독립 풀이 확정·정답 공개 전에 기록한다';
    end if;
    if tg_table_name='csat_review_visual_deliveries' then
      new.input_hash := csat_item_input_hash(r.item_id);
      new.units_hash := csat_current_units_hash(r.item_id);
      new.delivered_at := clock_timestamp();
      return new;
    end if;
    if not exists (select 1 from csat_review_visual_deliveries d where d.run_id=r.id and d.asset_id=a.id
      and d.input_hash=csat_item_input_hash(r.item_id) and d.units_hash=csat_current_units_hash(r.item_id) and d.delivered_at < clock_timestamp()
      and d.delivered_at >= (select activated_at from csat_review_visual_heads where item_id=r.item_id)) then
      raise exception '동일 이미지 입력을 먼저 받아 직접 확인한 뒤 관찰을 기록한다';
    end if;
    if new.observation ~ '[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\ufffd]' then
      raise exception '관찰 근거의 인코딩이 손상됐다';
    end if;
    new.input_hash := csat_item_input_hash(r.item_id);
    new.units_hash := csat_current_units_hash(r.item_id);
    new.observed_at := clock_timestamp();
  end if;
  return new;
end $$;
create trigger csat_visual_asset_immutable before insert or update or delete on public.csat_review_visual_assets
  for each row execute function public.csat_visual_record_guard();
create trigger csat_visual_receipt_immutable before insert or update or delete on public.csat_review_visual_receipts
  for each row execute function public.csat_visual_record_guard();
create trigger csat_visual_delivery_immutable before insert or update or delete on public.csat_review_visual_deliveries
  for each row execute function public.csat_visual_record_guard();

create function public.csat_visual_head_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare a csat_review_visual_assets;
begin
  if tg_op='DELETE' then raise exception '이미지 연결 이력을 삭제하지 않는다'; end if;
  if tg_op='UPDATE' and new.item_id is distinct from old.item_id then raise exception '이미지 문항을 바꿀 수 없다'; end if;
  -- Only the nested item-source trigger invalidates an unchanged asset pointer.
  -- Direct service-role head writes are not granted; operator changes use register.
  if tg_op='UPDATE' and new.asset_id is not distinct from old.asset_id and pg_trigger_depth()>1 then
    new.activated_at := clock_timestamp();
    new.generation := gen_random_uuid();
    update csat_item_analyses set status='in_review',updated_at=clock_timestamp()
      where item_id=new.item_id and status='published';
    return new;
  end if;
  perform 1 from csat_items where id=new.item_id for update;
  select * into a from csat_review_visual_assets where id=new.asset_id;
  if a.item_id is distinct from new.item_id or a.source_input_hash is distinct from csat_item_text_input_hash(new.item_id) then
    raise exception '이미지 연결이 현재 문항과 다르다';
  end if;
  if tg_op='INSERT' or new.asset_id is distinct from old.asset_id then
    new.activated_at := clock_timestamp();
    new.generation := gen_random_uuid();
    update csat_item_analyses set status='in_review',updated_at=clock_timestamp()
      where item_id=new.item_id and status='published';
  else
    new.activated_at := old.activated_at;
    new.generation := old.generation;
  end if;
  return new;
end $$;
create trigger csat_visual_head_change before insert or update or delete on public.csat_review_visual_heads
  for each row execute function public.csat_visual_head_guard();

create function public.csat_visual_source_changed() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if old.stem is distinct from new.stem or old.passage is distinct from new.passage
    or old.choices is distinct from new.choices then
    update csat_review_visual_heads set asset_id=asset_id where item_id=new.id;
  end if;
  return new;
end $$;
create trigger csat_visual_source_revision after update of stem,passage,choices on public.csat_items
  for each row execute function public.csat_visual_source_changed();

-- Operator registration is atomic and idempotent. It records the actual inspection
-- attestation; no database can infer that a person looked at the delivered pixels.
create function public.csat_review_visual_register(p_item text,p_source_hash text,p_pdf_sha256 text,
  p_pdf_page integer,p_image_base64 text,p_inspected_by text,p_inspection text,p_expected_asset uuid default null) returns uuid
language plpgsql security definer set search_path = public, pg_temp as $$
declare a uuid; current_head uuid; image bytea;
begin
  perform 1 from csat_items where id=p_item and csat_is_hakpyeong_item(id) and type_id='R-CHART' for update;
  if not found or p_source_hash is distinct from csat_item_text_input_hash(p_item) then
    raise exception '이미지 등록 전에 현재 텍스트 입력을 다시 대조한다';
  end if;
  image := decode(p_image_base64,'base64');
  select asset_id into current_head from csat_review_visual_heads where item_id=p_item;
  select id into a from csat_review_visual_assets where item_id=p_item and source_input_hash=p_source_hash
    and pdf_sha256=p_pdf_sha256 and pdf_page=p_pdf_page and image_png=image
    and inspected_by=p_inspected_by and inspection_note=p_inspection order by created_at limit 1;
  if a is not null then
    if a is distinct from current_head then raise exception '기존 이미지 등록 재시도는 새 정본을 되돌리지 않는다 — 충돌'; end if;
    return a;
  end if;
  if current_head is distinct from p_expected_asset then raise exception '이미지 정본이 확인 뒤 바뀌었다 — 충돌'; end if;
  insert into csat_review_visual_assets(item_id,source_input_hash,pdf_sha256,pdf_page,image_png,inspected_by,inspection_note)
    values(p_item,p_source_hash,p_pdf_sha256,p_pdf_page,image,p_inspected_by,p_inspection) returning id into a;
  insert into csat_review_visual_heads(item_id,asset_id) values(p_item,a)
    on conflict(item_id) do update set asset_id=excluded.asset_id;
  return a;
end $$;

create function public.csat_chart_receipt_valid(p_run uuid,p_before timestamptz) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select exists (select 1 from csat_review_runs r join csat_review_visual_receipts v on v.run_id=r.id
    join csat_review_visual_assets a on a.id=v.asset_id and a.item_id=r.item_id
    where r.id=p_run and v.observed_at < p_before and v.asset_id=csat_current_chart_asset(r.item_id)
      and v.observed_at >= (select activated_at from csat_review_visual_heads where item_id=r.item_id)
      and v.input_hash=csat_item_input_hash(r.item_id) and v.units_hash=csat_current_units_hash(r.item_id))
$$;
create function public.csat_review_visual_input(p_run uuid)
returns table(asset_id uuid,image_sha256 text,pdf_sha256 text,pdf_page integer,image_base64 text,input_hash text,units_hash text,item jsonb,units jsonb)
language plpgsql security definer set search_path = public, pg_temp as $$
declare r csat_review_runs; u csat_item_units;
begin
  select * into r from csat_review_runs where id=p_run;
  if r.id is null then raise exception '검수 실행이 없다'; end if;
  perform pg_advisory_xact_lock(hashtextextended(r.agent_run,0));
  select * into r from csat_review_runs where id=p_run for update;
  perform 1 from csat_items where id=r.item_id for share;
  if r.role <> 'reviewer' or r.kind <> 'blind' or r.solve_committed_at is not null or r.revealed_at is not null
    or not csat_blind_source_unseen(r.item_id,r.agent_run,clock_timestamp()) then
    raise exception '이미지 입력은 독립 풀이 전에만 받는다';
  end if;
  if csat_current_chart_asset(r.item_id) is null then raise exception '현재 도표 이미지 정본이 없다'; end if;
  if exists(select 1 from csat_review_visual_deliveries d where d.run_id=r.id
    and (d.input_hash is distinct from csat_item_input_hash(r.item_id) or d.units_hash is distinct from csat_current_units_hash(r.item_id))) then
    raise exception '이미지 입력이 받은 뒤 바뀌었다 — 새 독립 검수 문맥이 필요하다';
  end if;
  select u0.* into u from csat_item_units u0 where u0.item_id=r.item_id and u0.input_hash=csat_item_input_hash(r.item_id)
    order by u0.units_version desc limit 1 for share;
  if u.item_id is null then raise exception '현재 도표 연결로 근거 단위 재생성이 필요하다'; end if;
  insert into csat_review_visual_deliveries(run_id,asset_id,input_hash,units_hash)
    values(r.id,csat_current_chart_asset(r.item_id),csat_item_input_hash(r.item_id),u.units_hash) on conflict (run_id) do nothing;
  if not exists (select 1 from csat_review_visual_deliveries d where d.run_id=r.id
    and d.asset_id=csat_current_chart_asset(r.item_id) and d.input_hash=csat_item_input_hash(r.item_id) and d.units_hash=u.units_hash
    and d.delivered_at >= (select activated_at from csat_review_visual_heads where item_id=r.item_id)) then
    raise exception '이미지 입력이 받은 뒤 바뀌었다 — 새 독립 검수 문맥이 필요하다';
  end if;
  return query select a.id,a.image_sha256,a.pdf_sha256,a.pdf_page,encode(a.image_png,'base64'),csat_item_input_hash(r.item_id),u.units_hash,
    jsonb_build_object('id',i.id,'exam_id',i.exam_id,'no',i.no,'type_id',i.type_id,'stem',i.stem,'passage',i.passage,'choices',i.choices),
    jsonb_build_object('units_version',u.units_version,'list',u.units)
    from csat_review_visual_assets a join csat_items i on i.id=a.item_id where a.id=csat_current_chart_asset(r.item_id);
  if not found then raise exception '현재 도표 이미지 정본이 없다'; end if;
end $$;
create function public.csat_review_visual_ack(p_run uuid,p_asset uuid,p_sha256 text,p_observation text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r csat_review_runs; a csat_review_visual_assets; v csat_review_visual_receipts;
begin
  select * into r from csat_review_runs where id=p_run;
  if r.id is null then raise exception '검수 실행이 없다'; end if;
  perform pg_advisory_xact_lock(hashtextextended(r.agent_run,0));
  select * into r from csat_review_runs where id=p_run for update;
  perform 1 from csat_items where id=r.item_id for share;
  select * into a from csat_review_visual_assets where id=p_asset;
  if a.id is null or a.item_id is distinct from r.item_id or a.id is distinct from csat_current_chart_asset(r.item_id)
    or a.image_sha256 is distinct from p_sha256 then raise exception '관찰한 이미지 해시·문항이 정본과 다르다'; end if;
  select * into v from csat_review_visual_receipts where run_id=p_run;
  if v.run_id is not null then
    if v.asset_id is distinct from p_asset or v.input_hash is distinct from csat_item_input_hash(r.item_id)
      or v.units_hash is distinct from csat_current_units_hash(r.item_id)
      or v.observation is distinct from p_observation
      or v.observed_at < (select activated_at from csat_review_visual_heads where item_id=r.item_id) then
      raise exception '기존 도표 관찰 기록과 다르다 — 이미지 교체 전 기록은 재사용하지 않는다'; end if;
    return;
  end if;
  insert into csat_review_visual_receipts(run_id,asset_id,input_hash,units_hash,observation)
    values(p_run,p_asset,csat_item_input_hash(r.item_id),csat_current_units_hash(r.item_id),p_observation);
end $$;

revoke all on function public.csat_item_text_input_hash(text),public.csat_current_chart_asset(text),
  public.csat_visual_record_guard(),public.csat_visual_head_guard(),public.csat_visual_source_changed(),public.csat_chart_receipt_valid(uuid,timestamptz),
  public.csat_review_visual_input(uuid),public.csat_review_visual_ack(uuid,uuid,text,text),
  public.csat_review_visual_register(text,text,text,integer,text,text,text,uuid) from public,anon,authenticated;
grant execute on function public.csat_item_text_input_hash(text),public.csat_current_chart_asset(text),
  public.csat_chart_receipt_valid(uuid,timestamptz),public.csat_review_visual_input(uuid),
  public.csat_review_visual_ack(uuid,uuid,text,text),
  public.csat_review_visual_register(text,text,text,integer,text,text,text,uuid) to service_role;
create or replace function public.csat_blind_protocol_valid(p_run uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select r.kind = 'blind' and r.role = 'reviewer' and r.solve_committed_at is not null
    and exists (select 1 from csat_items i where i.id = r.item_id and (i.type_id is distinct from 'R-CHART' or csat_chart_receipt_valid(r.id,r.solve_committed_at)))
    and not exists (select 1 from csat_review_followups f join csat_review_runs bad on f.source = 'blind-invalid:' || bad.id::text
      where bad.id = r.id or (bad.agent_run = r.agent_run and bad.created_at <= r.created_at and csat_review_sources_overlap(r.item_id,bad.item_id)))
    and not exists (select 1 from csat_review_runs x where x.role = 'reviewer' and x.agent_run = r.agent_run
      and x.revealed_at < r.solve_committed_at and csat_review_sources_overlap(r.item_id,x.item_id))
    from csat_review_runs r where r.id = p_run), false)
$$;

create or replace function public.csat_review_solve(p_run uuid, p_answer smallint, p_note text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare r csat_review_runs;
begin
  select * into r from csat_review_runs where id = p_run;
  if r.id is null or r.role <> 'reviewer' then raise exception '검수 실행이 아니다: %', p_run; end if;
  perform pg_advisory_xact_lock(hashtextextended(r.agent_run,0));
  select * into r from csat_review_runs where id = p_run for update;
  if r.kind <> 'blind' then raise exception '재검수 실행은 풀이를 확정하지 않는다: %', p_run; end if;
  if r.solve_committed_at is not null then raise exception '독립 풀이는 한 번만 확정한다: %', p_run; end if;
  if not csat_blind_source_unseen(r.item_id,r.agent_run,clock_timestamp()) then raise exception '공유 원문 분석을 보기 전에 풀이를 확정해야 한다: %', p_run; end if;
  perform 1 from csat_items where id=r.item_id for share;
  if exists (select 1 from csat_items where id=r.item_id and type_id='R-CHART')
    and not csat_chart_receipt_valid(r.id,clock_timestamp()) then
    raise exception '도표 이미지의 관찰 근거를 풀이 전에 확정해야 한다';
  end if;
  if p_answer is null or p_answer not between 1 and 5 or p_note is null or length(btrim(p_note)) < 20
    or p_note ~ '[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f\ufffd]' then
    raise exception '읽을 수 있는 문항별 풀이 근거와 답이 필요하다';
  end if;
  update csat_review_runs set solve_answer = p_answer, solve_note = p_note,
    solve_input_hash = csat_item_input_hash(r.item_id), solve_answer_hash = csat_item_answer_hash(r.item_id),
    solve_committed_at = clock_timestamp() where id = p_run;
end $$;

create function public.csat_chart_analysis_bindable(p_analysis uuid,p_input_hash text) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select a.created_at >= h.activated_at and a.units_hash is not null
    and a.units_hash = csat_current_units_hash(a.item_id)
    and csat_current_chart_asset(a.item_id) = h.asset_id
    and p_input_hash=csat_item_input_hash(a.item_id)
    and length(btrim(a.analyst_run)) >= 8
    from csat_item_analyses a join csat_review_visual_heads h on h.item_id = a.item_id
    where a.id = p_analysis),false);
$$;
create function public.csat_visual_analysis_binding_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_op <> 'INSERT' then raise exception '도표 분석 입력 연결은 불변이며 삭제하지 않는다'; end if;
  new.bound_at := clock_timestamp();
  return new;
end $$;
create trigger csat_visual_analysis_binding_immutable before insert or update or delete on public.csat_review_visual_analysis_bindings
  for each row execute function public.csat_visual_analysis_binding_guard();
create function public.csat_review_visual_bind_analysis(p_analysis uuid,p_input_hash text) returns void
language plpgsql security definer set search_path = public, pg_temp as $$
declare a csat_item_analyses; b csat_review_visual_analysis_bindings;
begin
  select * into a from csat_item_analyses where id=p_analysis;
  if a.id is null then raise exception '분석이 없다'; end if;
  perform 1 from csat_items where id=a.item_id for update;
  select * into a from csat_item_analyses where id=p_analysis for update;
  if not csat_chart_analysis_bindable(a.id,p_input_hash) then
    raise exception '현재 도표 연결 뒤 새 단위·분석 재작성 먼저';
  end if;
  select * into b from csat_review_visual_analysis_bindings where analysis_id=a.id;
  if b.analysis_id is not null then
    if b.input_hash is distinct from p_input_hash or b.asset_id is distinct from csat_current_chart_asset(a.item_id)
      or b.units_hash is distinct from a.units_hash or b.analyst_run is distinct from a.analyst_run then
      raise exception '기존 도표 분석 연결을 새 입력으로 바꾸지 않는다';
    end if;
    return;
  end if;
  insert into csat_review_visual_analysis_bindings(analysis_id,asset_id,input_hash,units_hash,analyst_run)
    values(a.id,csat_current_chart_asset(a.item_id),p_input_hash,a.units_hash,a.analyst_run);
end $$;
create function public.csat_chart_analysis_ready(p_analysis uuid) returns boolean
language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce((select csat_chart_analysis_bindable(a.id,b.input_hash)
    and b.asset_id=csat_current_chart_asset(a.item_id) and b.units_hash=a.units_hash and b.analyst_run=a.analyst_run
    from csat_item_analyses a join csat_review_visual_analysis_bindings b on b.analysis_id=a.id
    where a.id=p_analysis),false)
$$;
create function public.csat_chart_review_run_guard() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform 1 from csat_items where id=new.item_id and csat_is_hakpyeong_item(id) and type_id='R-CHART' for share;
  if found and new.role='reviewer' and not csat_chart_analysis_ready(new.analysis_id) then
    raise exception '현재 도표 연결 뒤 새 단위·분석 재작성 먼저';
  end if;
  return new;
end $$;
create trigger csat_chart_review_run_current_analysis before insert on public.csat_review_runs
  for each row execute function public.csat_chart_review_run_guard();
revoke all on function public.csat_chart_analysis_ready(uuid),public.csat_chart_analysis_bindable(uuid,text),
  public.csat_review_visual_bind_analysis(uuid,text),public.csat_visual_analysis_binding_guard(),public.csat_chart_review_run_guard() from public,anon,authenticated;
grant execute on function public.csat_chart_analysis_ready(uuid),public.csat_chart_analysis_bindable(uuid,text),
  public.csat_review_visual_bind_analysis(uuid,text) to service_role;

create or replace function public.csat_guard_published() returns trigger
language plpgsql security definer set search_path = public, pg_temp as $$
declare n_pass int; t text; ps text[]; actor text;
begin
  if new.status <> 'published' then return new; end if;
  if not csat_is_hakpyeong_item(new.item_id) then
    select count(distinct persona) into n_pass from csat_analysis_reviews where analysis_id = new.id and verdict = 'pass';
    if n_pass < 3 then raise exception '분석 %: 서로 다른 페르소나 3인의 pass 가 필요하다 (현재 %)', new.item_id,n_pass using errcode = 'check_violation'; end if;
    return new;
  end if;
  for actor in select distinct actors.agent_run from (
    select run.agent_run from csat_independent_reviews review join csat_review_runs run on run.id = review.review_run_id where review.analysis_id = new.id
    union
    select par.agent_run from csat_independent_reviews review join csat_review_runs run on run.id = review.review_run_id
      join csat_review_runs par on par.id = run.parent_run_id where review.analysis_id = new.id
  ) actors order by actors.agent_run loop
    perform pg_advisory_xact_lock(hashtextextended(actor,0));
  end loop;
  select type_id into t from csat_items where id = new.item_id for share;
  if t = 'R-CHART' and csat_current_chart_asset(new.item_id) is null then raise exception '학평 분석 %: 도표 이미지 근거 없음 — 발행 보류',new.item_id using errcode = 'check_violation'; end if;
  if t = 'R-CHART' and (new.created_at < (select h.activated_at from csat_review_visual_heads h where h.item_id=new.item_id)
    or new.units_hash is null or new.units_hash is distinct from csat_current_units_hash(new.item_id)
    or not csat_chart_analysis_ready(new.id)) then
    raise exception '학평 분석 %: 현재 도표 연결 뒤 새 단위·분석 재작성 먼저',new.item_id using errcode = 'check_violation';
  end if;
  if new.units_hash is not null and csat_current_units_hash(new.item_id) is distinct from new.units_hash then
    raise exception '학평 분석 %: 근거 단위 목록이 현재 목록과 다르다',new.item_id using errcode = 'check_violation';
  end if;
  ps := csat_valid_review_personas_row(new);
  if coalesce(array_length(ps,1),0) < 3 then
    raise exception '학평 분석 %: 유효한 독립 검수 3인이 필요하다 — 현재 %',new.item_id,coalesce(array_length(ps,1),0) using errcode = 'check_violation';
  end if;
  return new;
end $$;

commit;
