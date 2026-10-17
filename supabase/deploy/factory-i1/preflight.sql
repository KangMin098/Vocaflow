-- supabase/deploy/factory-i1/preflight.sql — 생성물. 적용 전 checkpoint(읽기 전용 · JSON 한 행)
select json_build_object(
  'measured_at', now(),
  'server_version', current_setting('server_version'),
  'database', current_database(),
  'current_user', current_user,
  'history', json_build_object(
    'table', to_regclass('supabase_migrations.schema_migrations') is not null,
    'count', (select count(*) from supabase_migrations.schema_migrations),
    'max_version', (select max(version) from supabase_migrations.schema_migrations),
    'versions_after_20261014091841', (select coalesce(json_agg(version order by version), '[]') from supabase_migrations.schema_migrations where version > '20261014091841'),
    'db1', (select json_build_object('version', version, 'sha256', encode(sha256(convert_to(array_to_string(statements, ''), 'UTF8')), 'hex'))
            from supabase_migrations.schema_migrations where version = '20261017200000'),
    'db2', (select json_build_object('version', version, 'sha256', encode(sha256(convert_to(array_to_string(statements, ''), 'UTF8')), 'hex'))
            from supabase_migrations.schema_migrations where version = '20261017200100')),
  'targets_present', (select coalesce(json_agg(n order by n), '[]') from unnest(array['content_qualification', 'content_release_approval', 'content_release_revocation', 'workspace_content_demand', 'workspace_content_demand_line', 'factory_order', 'factory_order_event', 'workspace_content_delivery', 'factory_product_order', 'factory_order_product_link']::text[]) n where to_regclass('public.'||n) is not null),
  'target_functions_present', (select coalesce(json_agg(distinct proname), '[]') from pg_proc where pronamespace = 'public'::regnamespace
     and proname = any(array['forbid_ledger_mutation', 'fq_axes_valid', 'fq_role_ok', 'content_qualification_record', 'content_release_approve', 'content_release_revoke', 'ledger_writer_guard', 'factory_order_state_guard', 'workspace_demand_record', 'factory_order_open', 'factory_order_transition', 'supply_artifact_revision', 'supply_learner_exposure', 'workspace_delivery_record', 'supply_writer_guard', 'supply_delivery_valid', 'workspace_line_fulfillment', 'factory_product_order_is_current', 'factory_product_order_register', 'factory_order_link_product']::text[])),
  'partial_state', (select coalesce(bool_or(pg_get_constraintdef(oid) like '%partial%'), false) from pg_constraint where conname = 'factory_order_state_check'),
  'prereq_missing', (select coalesce(json_agg(x), '[]') from unnest(array['auth.users', 'public.learner_workspace', 'public.learner_workspace_plan', 'public.csat_map_goal_version', 'public.csat_items', 'public.csat_dcp_items', 'public.csat_dx_response', 'public.csat_dx_session', 'public.learning_task_attempts', 'public.learning_sessions', 'public.csat_trap_attempts', 'public.csat_session_attempts', 'public.csat_review_queue', 'public.csat_item_attempts']::text[]) x where to_regclass(x) is null),
  'prereq_fn_missing', (select coalesce(json_agg(x), '[]') from unnest(array['auth.uid()', 'public.is_admin()', 'public.is_admin_or_curator()', 'public.csat_source_is_eligible(uuid)', 'public.csat_ec_embargoed_items(text[])']::text[]) x where to_regprocedure(x) is null),
  'helpers', (select json_object_agg(proname, json_build_object('proconfig', proconfig::text, 'prosecdef', prosecdef, 'prosrc_md5', md5(prosrc), 'proacl', proacl::text))
     from pg_proc where pronamespace = 'public'::regnamespace and proname = any(array['is_admin', 'is_admin_or_curator']::text[]) and pronargs = 0),
  'composite_keys_present', (select coalesce(json_agg(conname), '[]') from pg_constraint where conname in
     ('learner_workspace_id_user_key','csat_map_goal_version_id_user_key','learner_workspace_plan_ws_ver_user_key')),
  'writer_privileges', json_build_object(
    'create_on_public', has_schema_privilege(current_user, 'public', 'CREATE'),
    'insert_history', case when to_regclass('supabase_migrations.schema_migrations') is null then null
                      else has_table_privilege(current_user, 'supabase_migrations.schema_migrations', 'INSERT') end,
    'owns_helpers', (select bool_and(pg_has_role(current_user, proowner, 'USAGE')) from pg_proc
                     where pronamespace = 'public'::regnamespace and proname = any(array['is_admin', 'is_admin_or_curator']::text[]) and pronargs = 0),
    'owns_dependency_tables', (select bool_and(pg_has_role(current_user, relowner, 'USAGE')) from pg_class
                     where oid in (to_regclass('public.learner_workspace'), to_regclass('public.learner_workspace_plan'), to_regclass('public.csat_map_goal_version')))),
  'ledger_rows', (select json_object_agg(t, (xpath('/row/c/text()', query_to_xml(format('select count(*) c from public.%I', t), false, true, '')))[1]::text::bigint)
     from unnest(array['learning_task_attempts', 'learning_sessions', 'csat_dx_response', 'csat_dx_session', 'csat_trap_attempts', 'csat_session_attempts', 'csat_review_queue', 'csat_item_attempts']::text[]) t where to_regclass('public.'||t) is not null),
  'g2_distinct_pairs', (select count(*) from (select distinct user_id, item_ref from public.learning_task_attempts where item_ref is not null) x),
  'g2_pairs_unresolved', (select count(*) from (select distinct user_id, item_ref from public.learning_task_attempts where item_ref is not null) x where not exists (select 1 from public.csat_items i where i.id = x.item_ref)),
  'history_columns', (select coalesce(json_agg(column_name order by column_name), '[]') from information_schema.columns where table_schema = 'supabase_migrations' and table_name = 'schema_migrations'),
  'workspace_rows', (select count(*) from public.learner_workspace),
  'event_triggers', (select coalesce(json_agg(json_build_object('name', evtname, 'event', evtevent, 'tags', evttags) order by evtname), '[]') from pg_event_trigger where evtenabled <> 'D'),
  'seclabels', (select coalesce(json_agg(json_build_object('provider', provider, 'class', classoid::regclass::text, 'objoid_is_pgsodium_key',
                  objoid = coalesce(to_regclass('pgsodium.key'), 0::oid))), '[]') from pg_seclabel),
  'blocking_locks_on_dependencies', (select count(*) from pg_locks l where l.granted and l.mode in ('AccessExclusiveLock','ExclusiveLock','ShareRowExclusiveLock')
     and l.relation in (to_regclass('public.learner_workspace'), to_regclass('public.learner_workspace_plan'), to_regclass('public.csat_map_goal_version'))),
  'catalog', (select json_build_object('rows', count(*), 'md5', md5(string_agg(k||':'||name||'='||fp, E'\n' order by k, name))) from (select 'rel'::text k, n.nspname||'.'||c.relname name,
  c.relkind::text||'|'||coalesce(c.relacl::text,'')||'|'||c.relrowsecurity||'|'||c.relforcerowsecurity||'|'||coalesce(case when c.relkind = 'i' then pg_get_indexdef(c.oid) end,'')
  ||'|'||c.relowner::regrole::text||'|'||coalesce(c.reloptions::text,'')||'|'||coalesce(case when c.relkind in ('v','m') then md5(pg_get_viewdef(c.oid)) end,'') fp
  from pg_class c join pg_namespace n on n.oid = c.relnamespace where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%' and c.relkind <> 't'
union all
select 'col', n.nspname||'.'||c.relname||'.'||a.attname,
  format_type(a.atttypid, a.atttypmod)||'|'||a.attnotnull||'|'||coalesce(pg_get_expr(d.adbin, d.adrelid),'')||'|'||coalesce(a.attacl::text,'')
  from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
  left join pg_attrdef d on d.adrelid = a.attrelid and d.adnum = a.attnum
  where a.attnum > 0 and not a.attisdropped and c.relkind in ('r','p','v','m','f') and n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%'
union all
select 'typ', n.nspname||'.'||t.typname, t.typtype::text||'|'||t.typowner::regrole::text||'|'||coalesce(t.typacl::text,'')||'|'||format_type(t.typbasetype, t.typtypmod)||'|'||t.typnotnull
  ||'|'||coalesce((select string_agg(e.enumlabel, ',' order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid),'')
  ||'|'||coalesce((select string_agg(pg_get_constraintdef(o.oid), ',' order by o.conname) from pg_constraint o where o.contypid = t.oid),'')
  from pg_type t join pg_namespace n on n.oid = t.typnamespace
  where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%' and (t.typtype in ('e','d','r','m') or (t.typtype = 'c' and (select relkind from pg_class where oid = t.typrelid) = 'c'))
union all
select 'dacl', coalesce(d.defaclrole::regrole::text,'')||'.'||coalesce(d.defaclnamespace::regnamespace::text,'*')||'.'||d.defaclobjtype::text, coalesce(d.defaclacl::text,'') from pg_default_acl d
union all
select 'ext', x.extname, x.extversion||'|'||x.extnamespace::regnamespace::text||'|'||x.extowner::regrole::text from pg_extension x
union all
select 'evt', e.evtname, e.evtevent||'|'||e.evtfoid::regproc::text||'|'||e.evtenabled::text||'|'||coalesce(e.evttags::text,'') from pg_event_trigger e
union all
select 'cmt', 'all', coalesce(md5(string_agg(d.classoid::regclass::text||':'||d.objoid||':'||d.objsubid||'='||d.description, E'\n' order by d.classoid, d.objoid, d.objsubid)),'') from pg_description d
union all
select 'con', n.nspname||'.'||c.relname||'.'||o.conname, pg_get_constraintdef(o.oid)
  from pg_constraint o join pg_class c on c.oid = o.conrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%'
union all
select 'fn', n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')',
  md5(coalesce(p.prosrc,''))||'|'||coalesce(p.proconfig::text,'')||'|'||coalesce(p.proacl::text,'')||'|'||p.prosecdef||'|'||p.provolatile::text||'|'||p.prokind::text||'|'||p.proowner::regrole::text
  from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%'
union all
select 'pol', n.nspname||'.'||c.relname||'.'||p.polname,
  p.polcmd::text||'|'||p.polpermissive||'|'||p.polroles::text||'|'||coalesce(pg_get_expr(p.polqual, p.polrelid),'')||'|'||coalesce(pg_get_expr(p.polwithcheck, p.polrelid),'')
  from pg_policy p join pg_class c on c.oid = p.polrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%'
union all
select 'trg', n.nspname||'.'||c.relname||'.'||t.tgname, pg_get_triggerdef(t.oid)||'|'||t.tgenabled::text
  from pg_trigger t join pg_class c on c.oid = t.tgrelid join pg_namespace n on n.oid = c.relnamespace where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%' and not t.tgisinternal
union all
select 'nsp', n.nspname, coalesce(n.nspacl::text,'')||'|'||n.nspowner::regrole::text from pg_namespace n where n.nspname not in ('pg_catalog','information_schema','pg_toast') and n.nspname not like 'pg\_temp\_%' and n.nspname not like 'pg\_toast\_temp\_%') c)
) as preflight;
