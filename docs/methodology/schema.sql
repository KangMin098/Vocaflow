-- docs/methodology/schema.sql
-- REVIEW DRAFT: not in supabase/migrations; do not apply before user approval.
-- Immutable research snapshots. Each import is one transaction, replay is a no-op.
-- No raw transcript, excerpt, arbitrary JSON payload, or learner recommendation table.
begin;

create table public.methodology_batches (
  id text primary key check (id ~ '^[a-f0-9]{64}$'),
  verified_at date not null,
  schema_version integer not null check (schema_version = 1),
  imported_by text not null check (length(imported_by) between 1 and 200),
  parent_id text references public.methodology_batches(id),
  created_at timestamptz not null default clock_timestamp()
);
create table public.methodology_taxonomy (
  batch_id text not null references public.methodology_batches(id),
  id text not null, label text not null,
  dimension text not null check (dimension in ('age','proficiency','exam','skill','process','question')),
  "parentId" text,
  primary key(batch_id,id),
  foreign key(batch_id,"parentId") references public.methodology_taxonomy(batch_id,id) deferrable initially deferred
);
create table public.methodology_experts (
  batch_id text not null references public.methodology_batches(id), id text not null,
  name text not null, organization text not null, specialties text[] not null,
  "profileSourceIds" text[] not null,
  "researchStatus" text not null check ("researchStatus" in ('candidate','profile_verified')),
  "verifiedAt" date not null, primary key(batch_id,id)
);
create table public.methodology_channels (
  batch_id text not null references public.methodology_batches(id), id text not null,
  name text not null, url text not null check (url like 'https://%'), "expertIds" text[] not null,
  relationship text not null check (relationship in ('personal','platform','institution','guest','reupload','fan')),
  "verificationSourceIds" text[] not null, "verifiedAt" date not null,
  primary key(batch_id,id)
);
create table public.methodology_sources (
  batch_id text not null references public.methodology_batches(id), id text not null,
  title text not null, url text not null check (url like 'https://%'),
  kind text not null check (kind in ('document','video')), "expertIds" text[] not null,
  "channelId" text, "originGroup" text not null,
  "publishedAt" date, "verifiedAt" date not null, revision text not null,
  access text not null check (access in ('metadata_only','document_read','transcript_read','unavailable')),
  rights text not null check (rights in ('link_only','analysis_permitted')), "rightsBasis" text not null,
  "durationSeconds" double precision check ("durationSeconds" > 0 and "durationSeconds" < 'Infinity'::float8),
  "taxonomyIds" text[] not null, priority text not null check (priority in ('high','normal','low')),
  "priorityReason" text not null,
  primary key(batch_id,id), unique(batch_id,id,revision),
  foreign key(batch_id,"channelId") references public.methodology_channels(batch_id,id),
  check (access <> 'document_read' or kind = 'document'),
  check (access <> 'transcript_read' or (kind = 'video' and rights = 'analysis_permitted' and revision ~ '^sha256:[a-f0-9]{64}$'))
);
create table public.methodology_methods (
  batch_id text not null references public.methodology_batches(id), id text not null,
  statement text not null check (length(statement) between 1 and 1500), "taxonomyIds" text[] not null,
  review text not null check (review in ('extracted','reviewed','rejected')),
  "reviewedBy" text, "reviewedAt" date,
  efficacy text not null check (efficacy = 'not_assessed'), "productApplications" text[] not null,
  primary key(batch_id,id),
  check (review <> 'reviewed' or (length("reviewedBy") > 0 and "reviewedAt" is not null and "reviewedBy" is not null)),
  check (cardinality("productApplications") = 0 or review = 'reviewed')
);
create table public.methodology_claims (
  batch_id text not null references public.methodology_batches(id), id text not null,
  "methodId" text not null,
  kind text not null check (kind in ('principle','condition','procedure','rationale','example','failure','exception','transfer')),
  text text not null check (length(text) between 1 and 1500), ordinal integer not null check (ordinal >= 0),
  attribution text not null check (attribution in ('source_explicit','analyst_inference')),
  primary key(batch_id,id), unique(batch_id,"methodId",kind,ordinal),
  foreign key(batch_id,"methodId") references public.methodology_methods(batch_id,id)
);
create table public.methodology_evidence (
  batch_id text not null references public.methodology_batches(id), id text not null,
  "claimId" text not null, "sourceId" text not null, "sourceRevision" text not null,
  "expertIds" text[] not null, locator jsonb not null,
  stance text not null check (stance in ('supports','qualifies','opposes')),
  note text not null check (length(note) <= 800), primary key(batch_id,id),
  foreign key(batch_id,"claimId") references public.methodology_claims(batch_id,id),
  foreign key(batch_id,"sourceId","sourceRevision") references public.methodology_sources(batch_id,id,revision),
  check (jsonb_typeof(locator) = 'object' and locator->>'kind' in ('section','time')),
  check (((locator->>'kind' = 'section' and locator - array['kind','section'] = '{}'::jsonb and length(locator->>'section') between 1 and 300)
    or (locator->>'kind' = 'time' and locator - array['kind','start','end'] = '{}'::jsonb
      and jsonb_typeof(locator->'start') = 'number' and jsonb_typeof(locator->'end') = 'number'
      and (locator->>'start')::float8 >= 0 and (locator->>'end')::float8 > (locator->>'start')::float8)) is true)
);
create table public.methodology_relations (
  batch_id text not null references public.methodology_batches(id), id text not null,
  "fromId" text not null, "toId" text not null,
  kind text not null check (kind in ('equivalent_candidate','contradicts','context_differs','complements')),
  reason text not null, "evidenceIds" text[] not null check (cardinality("evidenceIds") > 0),
  review text not null check (review in ('extracted','reviewed','rejected')),
  primary key(batch_id,id), check ("fromId" <> "toId"),
  foreign key(batch_id,"fromId") references public.methodology_methods(batch_id,id),
  foreign key(batch_id,"toId") references public.methodology_methods(batch_id,id)
);
create table public.methodology_gaps (
  batch_id text not null references public.methodology_batches(id), id text not null,
  "taxonomyIds" text[] not null, question text not null, "nextAction" text not null,
  primary key(batch_id,id)
);
create index methodology_sources_origin on public.methodology_sources(batch_id,"originGroup");
create index methodology_claims_method on public.methodology_claims(batch_id,"methodId");
create index methodology_evidence_claim on public.methodology_evidence(batch_id,"claimId");
create index methodology_batches_newest on public.methodology_batches(created_at desc,id);

-- Service-only SQL boundary. Application/CLI validateBundle is mandatory before calling.
-- Snapshot id is generated by Postgres from jsonb canonical text, preventing caller hash collisions.
create function public.methodology_import(p_bundle jsonb, p_actor text, p_parent text default null)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_id text; v_key text; v_rows jsonb; v_added integer; v_bad boolean; v_ref record; v_head text;
begin
  if jsonb_typeof(p_bundle) is distinct from 'object' or p_bundle->>'schemaVersion' is distinct from '1'
    or p_bundle - array['schemaVersion','verifiedAt','experts','channels','sources','methods','claims','evidence','relations','taxonomy','gaps'] <> '{}'::jsonb then
    raise exception 'Invalid methodology bundle';
  end if;
  -- sha256(bytea) is built into supported PostgreSQL; no pgcrypto dependency.
  v_id := encode(sha256(convert_to(p_bundle::text,'UTF8')),'hex');
  perform pg_advisory_xact_lock(hashtextextended('methodology_import',0));
  if exists(select 1 from public.methodology_batches where id=v_id) then
    return jsonb_build_object('id',v_id,'status','already_imported');
  end if;
  select id into v_head from public.methodology_batches order by created_at desc,id limit 1;
  if v_head is distinct from p_parent then raise exception 'Snapshot head changed; rebase onto current snapshot before import'; end if;
  insert into public.methodology_batches(id,verified_at,schema_version,imported_by,parent_id)
  values (v_id,(p_bundle->>'verifiedAt')::date,1,p_actor,p_parent) on conflict do nothing;
  get diagnostics v_added = row_count;
  if v_added = 0 then return jsonb_build_object('id',v_id,'status','already_imported'); end if;
  foreach v_key in array array['taxonomy','experts','channels','sources','methods','claims','evidence','relations','gaps'] loop
    if jsonb_typeof(p_bundle->v_key) is distinct from 'array' then raise exception 'Missing array: %',v_key; end if;
    if jsonb_array_length(p_bundle->v_key) > 5000 then raise exception 'Batch limit exceeded: %',v_key; end if;
    select coalesce(jsonb_agg(value || jsonb_build_object('batch_id',v_id)),'[]'::jsonb) into v_rows from jsonb_array_elements(p_bundle->v_key);
    -- Reject unknown fields rather than silently persisting/ignoring a transcript payload.
    if exists (
      select 1 from jsonb_array_elements(v_rows) r, lateral jsonb_object_keys(r) k
      where not exists (select 1 from information_schema.columns c where c.table_schema='public' and c.table_name='methodology_'||v_key and c.column_name=k)
    ) then raise exception 'Unknown fields in %',v_key; end if;
    execute format('insert into public.%I select * from jsonb_populate_recordset(null::public.%I,$1)', 'methodology_'||v_key,'methodology_'||v_key) using v_rows;
  end loop;
  -- Array references are checked in the same atomic transaction (no orphan ids).
  for v_ref in select * from (values
    ('experts','profileSourceIds','sources'),('channels','expertIds','experts'),('channels','verificationSourceIds','sources'),
    ('sources','expertIds','experts'),('sources','taxonomyIds','taxonomy'),('methods','taxonomyIds','taxonomy'),
    ('evidence','expertIds','experts'),('relations','evidenceIds','evidence'),('gaps','taxonomyIds','taxonomy')
  ) x(src,col,dest) loop
    execute format('select exists(select 1 from public.%I a cross join lateral unnest(a.%I) r(id) where a.batch_id=$1 and not exists(select 1 from public.%I b where b.batch_id=$1 and b.id=r.id))',
      'methodology_'||v_ref.src,v_ref.col,'methodology_'||v_ref.dest) into v_bad using v_id;
    if v_bad then raise exception 'Broken reference %.%',v_ref.src,v_ref.col; end if;
  end loop;
  if exists (select 1 from public.methodology_claims c where c.batch_id=v_id and not exists (
    select 1 from public.methodology_evidence e where e.batch_id=v_id and e."claimId"=c.id and e.stance='supports'
  )) then raise exception 'Claim without supporting evidence'; end if;
  if exists (select 1 from public.methodology_methods m where m.batch_id=v_id and not exists (
    select 1 from public.methodology_claims c where c.batch_id=v_id and c."methodId"=m.id and c.kind='principle' and c.text=m.statement and c.attribution='source_explicit'
  )) then raise exception 'Canonical principle without explicit claim'; end if;
  if exists (
    select 1 from public.methodology_evidence e join public.methodology_sources s on s.batch_id=e.batch_id and s.id=e."sourceId"
    where e.batch_id=v_id and (s.access not in ('document_read','transcript_read') or not e."expertIds" <@ s."expertIds"
      or (e.locator->>'kind'='section' and s.access<>'document_read')
      or (e.locator->>'kind'='time' and (s.access<>'transcript_read' or s."durationSeconds" is null or (e.locator->>'end')::float8>s."durationSeconds")))
  ) then raise exception 'Evidence access, attribution or time range invalid'; end if;
  if exists (
    select 1 from public.methodology_relations r cross join lateral unnest(array[r."fromId",r."toId"]) endpoint(id)
    where r.batch_id=v_id and not exists (
      select 1 from public.methodology_evidence e join public.methodology_claims c on c.batch_id=e.batch_id and c.id=e."claimId"
      where e.batch_id=v_id and e.id=any(r."evidenceIds") and c."methodId"=endpoint.id
    )
  ) then raise exception 'Relation requires evidence for both methods'; end if;
  if exists (
    with recursive ancestry as (
      select id,"parentId",dimension,array[id] as path,false as cycle from public.methodology_taxonomy where batch_id=v_id
      union all
      select a.id,p."parentId",a.dimension,a.path||p.id,p.id=any(a.path)
      from ancestry a join public.methodology_taxonomy p on p.batch_id=v_id and p.id=a."parentId" where not a.cycle
    ) select 1 from ancestry where cycle
  ) then raise exception 'Taxonomy cycle'; end if;
  if exists (
    select 1 from public.methodology_taxonomy c join public.methodology_taxonomy p on p.batch_id=c.batch_id and p.id=c."parentId"
    where c.batch_id=v_id and c.dimension<>p.dimension
  ) then raise exception 'Taxonomy dimension mismatch'; end if;
  return jsonb_build_object('id',v_id,'status','imported');
end;
$$;

create function public.methodology_read(p_id text default null)
returns jsonb language plpgsql security invoker set search_path = public, pg_temp as $$
declare v_batch public.methodology_batches; v_key text; v_rows jsonb; v_bundle jsonb;
begin
  select * into v_batch from public.methodology_batches where p_id is null or id=p_id order by created_at desc,id limit 1;
  if not found then return null; end if;
  v_bundle := jsonb_build_object('schemaVersion',v_batch.schema_version,'verifiedAt',v_batch.verified_at);
  foreach v_key in array array['taxonomy','experts','channels','sources','methods','claims','evidence','relations','gaps'] loop
    execute format('select coalesce(jsonb_agg(to_jsonb(t)-''batch_id'' order by id),''[]''::jsonb) from public.%I t where batch_id=$1','methodology_'||v_key) into v_rows using v_batch.id;
    v_bundle := v_bundle || jsonb_build_object(v_key,v_rows);
  end loop;
  return jsonb_build_object('id',v_batch.id,'importedAt',v_batch.created_at,'bundle',v_bundle);
end;
$$;

do $$ declare v_table text; begin
  foreach v_table in array array['batches','taxonomy','experts','channels','sources','methods','claims','evidence','relations','gaps'] loop
    execute format('alter table public.%I enable row level security','methodology_'||v_table);
    execute format('revoke all on public.%I from anon, authenticated','methodology_'||v_table);
    execute format('grant select, insert on public.%I to service_role','methodology_'||v_table);
  end loop;
end $$;
revoke all on function public.methodology_import(jsonb,text,text) from public, anon, authenticated;
revoke all on function public.methodology_read(text) from public, anon, authenticated;
grant execute on function public.methodology_import(jsonb,text,text) to service_role;
grant execute on function public.methodology_read(text) to service_role;
commit;
