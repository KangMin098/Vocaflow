// scripts/db/factory-i1/sql.mjs
//
// Factory I1 배포 — 읽기 전용 SQL(적용 전 checkpoint · 적용 직후 검증). 러너와 MCP execute_sql 이 같은 본문을 쓴다.
// 모두 SELECT 뿐이다(read only 트랜잭션에서 돈다). 학습자 ID · 이메일 · 원문은 내보내지 않는다 — 수와 해시만.
import { CATALOG_SQL } from './catalog.mjs'
import { STAGES, HELPERS, DB1_TARGET_TABLES, DB1_TARGET_FUNCTIONS, FOREIGN_TARGETS, WRITER_RPCS, REQUIRED_RELATIONS, REQUIRED_FUNCTIONS } from './spec.mjs'

const lit = (s) => `'${String(s).replaceAll("'", "''")}'`
const arr = (xs) => `array[${xs.map(lit).join(', ')}]::text[]`
const EXPOSURE_LEDGERS = ['learning_task_attempts', 'learning_sessions', 'csat_dx_response', 'csat_dx_session', 'csat_trap_attempts',
  'csat_session_attempts', 'csat_review_queue', 'csat_item_attempts']

/** 적용 전 checkpoint — JSON 한 행. preflight 판정의 입력이자 인계 기록 */
export const PREFLIGHT_SQL = `select json_build_object(
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
            from supabase_migrations.schema_migrations where version = ${lit(STAGES.db1.version)}),
    'db2', (select json_build_object('version', version, 'sha256', encode(sha256(convert_to(array_to_string(statements, ''), 'UTF8')), 'hex'))
            from supabase_migrations.schema_migrations where version = ${lit(STAGES.db2.version)})),
  'targets_present', (select coalesce(json_agg(n order by n), '[]') from unnest(${arr([...DB1_TARGET_TABLES, ...FOREIGN_TARGETS])}) n where to_regclass('public.'||n) is not null),
  'target_functions_present', (select coalesce(json_agg(distinct proname), '[]') from pg_proc where pronamespace = 'public'::regnamespace
     and proname = any(${arr([...DB1_TARGET_FUNCTIONS, 'workspace_line_fulfillment', 'factory_product_order_is_current', 'factory_product_order_register', 'factory_order_link_product'])})),
  'partial_state', (select coalesce(bool_or(pg_get_constraintdef(oid) like '%partial%'), false) from pg_constraint where conname = 'factory_order_state_check'),
  'prereq_missing', (select coalesce(json_agg(x), '[]') from unnest(${arr(REQUIRED_RELATIONS)}) x where to_regclass(x) is null),
  'prereq_fn_missing', (select coalesce(json_agg(x), '[]') from unnest(${arr(REQUIRED_FUNCTIONS)}) x where to_regprocedure(x) is null),
  'helpers', (select json_object_agg(proname, json_build_object('proconfig', proconfig::text, 'prosecdef', prosecdef, 'prosrc_md5', md5(prosrc), 'proacl', proacl::text))
     from pg_proc where pronamespace = 'public'::regnamespace and proname = any(${arr(Object.keys(HELPERS))}) and pronargs = 0),
  'composite_keys_present', (select coalesce(json_agg(conname), '[]') from pg_constraint where conname in
     ('learner_workspace_id_user_key','csat_map_goal_version_id_user_key','learner_workspace_plan_ws_ver_user_key')),
  'writer_privileges', json_build_object(
    'create_on_public', has_schema_privilege(current_user, 'public', 'CREATE'),
    'insert_history', case when to_regclass('supabase_migrations.schema_migrations') is null then null
                      else has_table_privilege(current_user, 'supabase_migrations.schema_migrations', 'INSERT') end,
    'owns_helpers', (select bool_and(pg_has_role(current_user, proowner, 'USAGE')) from pg_proc
                     where pronamespace = 'public'::regnamespace and proname = any(${arr(Object.keys(HELPERS))}) and pronargs = 0),
    'owns_dependency_tables', (select bool_and(pg_has_role(current_user, relowner, 'USAGE')) from pg_class
                     where oid in (to_regclass('public.learner_workspace'), to_regclass('public.learner_workspace_plan'), to_regclass('public.csat_map_goal_version')))),
  'ledger_rows', (select json_object_agg(t, (xpath('/row/c/text()', query_to_xml(format('select count(*) c from public.%I', t), false, true, '')))[1]::text::bigint)
     from unnest(${arr(EXPOSURE_LEDGERS)}) t where to_regclass('public.'||t) is not null),
  'g2_distinct_pairs', (select count(*) from (select distinct user_id, item_ref from public.learning_task_attempts where item_ref is not null) x),
  'g2_pairs_unresolved', (select count(*) from (select distinct user_id, item_ref from public.learning_task_attempts where item_ref is not null) x where not exists (select 1 from public.csat_items i where i.id = x.item_ref)),
  'history_columns', (select coalesce(json_agg(column_name order by column_name), '[]') from information_schema.columns where table_schema = 'supabase_migrations' and table_name = 'schema_migrations'),
  'workspace_rows', (select count(*) from public.learner_workspace),
  'event_triggers', (select coalesce(json_agg(json_build_object('name', evtname, 'event', evtevent, 'tags', evttags) order by evtname), '[]') from pg_event_trigger where evtenabled <> 'D'),
  'seclabels', (select coalesce(json_agg(json_build_object('provider', provider, 'class', classoid::regclass::text, 'objoid_is_pgsodium_key',
                  objoid = coalesce(to_regclass('pgsodium.key'), 0::oid))), '[]') from pg_seclabel),
  'blocking_locks_on_dependencies', (select count(*) from pg_locks l where l.granted and l.mode in ('AccessExclusiveLock','ExclusiveLock','ShareRowExclusiveLock')
     and l.relation in (to_regclass('public.learner_workspace'), to_regclass('public.learner_workspace_plan'), to_regclass('public.csat_map_goal_version'))),
  'catalog', (select json_build_object('rows', count(*), 'md5', md5(string_agg(k||':'||name||'='||fp, E'\\n' order by k, name))) from (${CATALOG_SQL}) c)
) as preflight`

/** 적용 직후 검증 — (check, ok, detail) 행. 하나라도 ok=false 면 검증 실패 */
export function verifySql(stage) {
  const st = STAGES[stage]
  const rows = [
    `select 'history_row' as chk, exists (select 1 from supabase_migrations.schema_migrations where version = ${lit(st.version)}
       and encode(sha256(convert_to(array_to_string(statements, ''), 'UTF8')), 'hex') = $1) as ok,
       (select coalesce(name, '') from supabase_migrations.schema_migrations where version = ${lit(st.version)}) as detail`,
  ]
  if (stage === 'db1') {
    rows.push(
      `select 'tables_rls_on', bool_and(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.'||t)), false)), string_agg(t, ',') filter (where to_regclass('public.'||t) is null)
         from unnest(${arr(DB1_TARGET_TABLES)}) t`,
      `select 'tables_empty', bool_and((xpath('/row/c/text()', query_to_xml(format('select count(*) c from public.%I', t), false, true, '')))[1]::text::bigint = 0), null
         from unnest(${arr(DB1_TARGET_TABLES)}) t where to_regclass('public.'||t) is not null`,
      `select 'table_privileges', not bool_or(has_table_privilege('anon', 'public.'||t, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
           or has_table_privilege('authenticated', 'public.'||t, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
           or not has_table_privilege('authenticated', 'public.'||t, 'SELECT')), null
         from unnest(${arr(DB1_TARGET_TABLES)}) t where to_regclass('public.'||t) is not null`,
      `select 'policies_select_only', count(*) = 8 and bool_and(cmd = 'SELECT'), string_agg(tablename||'.'||policyname||':'||cmd||':'||roles::text, ',')
         from pg_policies where schemaname = 'public' and tablename = any(${arr(DB1_TARGET_TABLES)})`,
      `select 'helper_search_path', bool_and(coalesce(p.proconfig::text, 'NULL') = h.want), string_agg(h.f||'='||coalesce(p.proconfig::text, 'NULL'), ',')
         from (values ${Object.entries(HELPERS).map(([f, h]) => `(${lit(f)}, ${lit(h.after)})`).join(', ')}) h(f, want)
         left join pg_proc p on p.pronamespace = 'public'::regnamespace and p.proname = h.f and p.pronargs = 0`,
      `select 'internal_judges_not_callable', not bool_or(has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE')), string_agg(p.proname, ',')
         from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('supply_learner_exposure','supply_delivery_valid','supply_artifact_revision')`,
      `select 'writer_rpcs_no_anon', not bool_or(has_function_privilege('anon', p.oid, 'EXECUTE')), null
         from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any(${arr(WRITER_RPCS)})`,
      `select 'definer_search_path_pg_temp', bool_and(exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%pg_temp')), string_agg(p.proname, ',') filter (where not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%pg_temp'))
         from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any(${arr(DB1_TARGET_FUNCTIONS)}) and p.prosecdef`,
      `select 'composite_keys', count(*) = 3, string_agg(conname, ',') from pg_constraint where conname in ('learner_workspace_id_user_key','csat_map_goal_version_id_user_key','learner_workspace_plan_ws_ver_user_key')`,
      `select 'no_db2_no_d3', to_regclass('public.factory_product_order') is null and to_regclass('public.factory_order_product_link') is null
           and not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'workspace_line_fulfillment')
           and not exists (select 1 from pg_constraint where conname = 'factory_order_state_check' and pg_get_constraintdef(oid) like '%partial%'), null`,
      // G2 노출 판정 — B 에서 'none' 이던 G2 쌍(2026-10-17 123쌍)이 이제 노출로 보여야 한다. 쌍 수만 낸다.
      `with x as (select public.supply_learner_exposure('csat_item', t.item_ref, t.user_id) e
                   from (select distinct user_id, item_ref from public.learning_task_attempts where item_ref is not null) t)
       select 'g2_exposure_none_zero', count(*) filter (where e = 'none') = 0,
           'pairs='||count(*)||' none='||count(*) filter (where e = 'none')||' by='||coalesce((select string_agg(e||':'||n, ',' order by e) from (select e, count(*) n from x group by e) g), '')
         from x`,
    )
  } else {
    rows.push(
      `select 'db1_history_present', exists (select 1 from supabase_migrations.schema_migrations where version = ${lit(STAGES.db1.version)}), null`,
      `select 'state_check_partial', exists (select 1 from pg_constraint where conname = 'factory_order_state_check' and pg_get_constraintdef(oid) like '%partial%'), null`,
      `select 'open_index_excludes_partial', coalesce((select pg_get_indexdef(to_regclass('public.factory_order_one_open_per_line')) like '%partial%'), false), null`,
      `select 'fulfillment_no_anon', not has_function_privilege('anon', 'public.workspace_line_fulfillment(uuid)', 'EXECUTE'), null`,
      `select 'fulfillment_definer_pg_temp', exists (select 1 from pg_proc p, unnest(p.proconfig) c where p.oid = 'public.workspace_line_fulfillment(uuid)'::regprocedure and c like 'search_path=%pg_temp'), null`,
      `select 'no_d3', to_regclass('public.factory_product_order') is null and to_regclass('public.factory_order_product_link') is null, null`,
    )
  }
  return rows
}
