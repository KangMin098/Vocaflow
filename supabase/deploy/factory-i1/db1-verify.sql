-- supabase/deploy/factory-i1/db1-verify.sql — 생성물. 적용 직후 읽기 전용 검증(각 문 독립 실행 · ok 열이 모두 true). $1 = 061a48a8b50b956762dedf171d3a8949d4f9bae4da4058b41d52227eb767c624
select 'history_row' as chk, exists (select 1 from supabase_migrations.schema_migrations where version = '20261017200000'
       and encode(sha256(convert_to(array_to_string(statements, ''), 'UTF8')), 'hex') = '061a48a8b50b956762dedf171d3a8949d4f9bae4da4058b41d52227eb767c624') as ok,
       (select coalesce(name, '') from supabase_migrations.schema_migrations where version = '20261017200000') as detail;
select 'tables_rls_on', bool_and(coalesce((select relrowsecurity from pg_class where oid = to_regclass('public.'||t)), false)), string_agg(t, ',') filter (where to_regclass('public.'||t) is null)
         from unnest(array['content_qualification', 'content_release_approval', 'content_release_revocation', 'workspace_content_demand', 'workspace_content_demand_line', 'factory_order', 'factory_order_event', 'workspace_content_delivery']::text[]) t;
select 'tables_empty', bool_and((xpath('/row/c/text()', query_to_xml(format('select count(*) c from public.%I', t), false, true, '')))[1]::text::bigint = 0), null
         from unnest(array['content_qualification', 'content_release_approval', 'content_release_revocation', 'workspace_content_demand', 'workspace_content_demand_line', 'factory_order', 'factory_order_event', 'workspace_content_delivery']::text[]) t where to_regclass('public.'||t) is not null;
select 'table_privileges', not bool_or(has_table_privilege('anon', 'public.'||t, 'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
           or has_table_privilege('authenticated', 'public.'||t, 'INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER')
           or not has_table_privilege('authenticated', 'public.'||t, 'SELECT')), null
         from unnest(array['content_qualification', 'content_release_approval', 'content_release_revocation', 'workspace_content_demand', 'workspace_content_demand_line', 'factory_order', 'factory_order_event', 'workspace_content_delivery']::text[]) t where to_regclass('public.'||t) is not null;
select 'policies_select_only', count(*) = 8 and bool_and(cmd = 'SELECT'), string_agg(tablename||'.'||policyname||':'||cmd||':'||roles::text, ',')
         from pg_policies where schemaname = 'public' and tablename = any(array['content_qualification', 'content_release_approval', 'content_release_revocation', 'workspace_content_demand', 'workspace_content_demand_line', 'factory_order', 'factory_order_event', 'workspace_content_delivery']::text[]);
select 'helper_search_path', bool_and(coalesce(p.proconfig::text, 'NULL') = h.want), string_agg(h.f||'='||coalesce(p.proconfig::text, 'NULL'), ',')
         from (values ('is_admin', '{"search_path=public, pg_temp"}'), ('is_admin_or_curator', '{"search_path=public, auth, pg_temp"}')) h(f, want)
         left join pg_proc p on p.pronamespace = 'public'::regnamespace and p.proname = h.f and p.pronargs = 0;
select 'internal_judges_not_callable', not bool_or(has_function_privilege('anon', p.oid, 'EXECUTE') or has_function_privilege('authenticated', p.oid, 'EXECUTE')), string_agg(p.proname, ',')
         from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname in ('supply_learner_exposure','supply_delivery_valid','supply_artifact_revision');
select 'writer_rpcs_no_anon', not bool_or(has_function_privilege('anon', p.oid, 'EXECUTE')), null
         from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any(array['workspace_demand_record', 'factory_order_open', 'factory_order_transition', 'workspace_delivery_record', 'content_qualification_record', 'content_release_approve', 'content_release_revoke']::text[]);
select 'definer_search_path_pg_temp', bool_and(exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%pg_temp')), string_agg(p.proname, ',') filter (where not exists (select 1 from unnest(p.proconfig) c where c like 'search_path=%pg_temp'))
         from pg_proc p where p.pronamespace = 'public'::regnamespace and p.proname = any(array['forbid_ledger_mutation', 'fq_axes_valid', 'fq_role_ok', 'content_qualification_record', 'content_release_approve', 'content_release_revoke', 'ledger_writer_guard', 'factory_order_state_guard', 'workspace_demand_record', 'factory_order_open', 'factory_order_transition', 'supply_artifact_revision', 'supply_learner_exposure', 'workspace_delivery_record', 'supply_writer_guard', 'supply_delivery_valid']::text[]) and p.prosecdef;
select 'composite_keys', count(*) = 3, string_agg(conname, ',') from pg_constraint where conname in ('learner_workspace_id_user_key','csat_map_goal_version_id_user_key','learner_workspace_plan_ws_ver_user_key');
select 'no_db2_no_d3', to_regclass('public.factory_product_order') is null and to_regclass('public.factory_order_product_link') is null
           and not exists (select 1 from pg_proc where pronamespace = 'public'::regnamespace and proname = 'workspace_line_fulfillment')
           and not exists (select 1 from pg_constraint where conname = 'factory_order_state_check' and pg_get_constraintdef(oid) like '%partial%'), null;
with x as (select public.supply_learner_exposure('csat_item', t.item_ref, t.user_id) e
                   from (select distinct user_id, item_ref from public.learning_task_attempts where item_ref is not null) t)
       select 'g2_exposure_none_zero', count(*) filter (where e = 'none') = 0,
           'pairs='||count(*)||' none='||count(*) filter (where e = 'none')||' by='||coalesce((select string_agg(e||':'||n, ',' order by e) from (select e, count(*) n from x group by e) g), '')
         from x;
