-- supabase/deploy/factory-i1/db2-verify.sql — 생성물. 적용 직후 읽기 전용 검증(각 문 독립 실행 · ok 열이 모두 true). $1 = 2165015d063ff67a56806e57dabbaa6aa7fe2bd07e8608beaa8a9323fba8896b
select 'history_row' as chk, exists (select 1 from supabase_migrations.schema_migrations where version = '20261017200100'
       and encode(sha256(convert_to(array_to_string(statements, ''), 'UTF8')), 'hex') = '2165015d063ff67a56806e57dabbaa6aa7fe2bd07e8608beaa8a9323fba8896b') as ok,
       (select coalesce(name, '') from supabase_migrations.schema_migrations where version = '20261017200100') as detail;
select 'db1_history_present', exists (select 1 from supabase_migrations.schema_migrations where version = '20261017200000'), null;
select 'state_check_partial', exists (select 1 from pg_constraint where conname = 'factory_order_state_check' and pg_get_constraintdef(oid) like '%partial%'), null;
select 'open_index_excludes_partial', coalesce((select pg_get_indexdef(to_regclass('public.factory_order_one_open_per_line')) like '%partial%'), false), null;
select 'fulfillment_no_anon', not has_function_privilege('anon', 'public.workspace_line_fulfillment(uuid)', 'EXECUTE'), null;
select 'fulfillment_definer_pg_temp', exists (select 1 from pg_proc p, unnest(p.proconfig) c where p.oid = 'public.workspace_line_fulfillment(uuid)'::regprocedure and c like 'search_path=%pg_temp'), null;
select 'no_d3', to_regclass('public.factory_product_order') is null and to_regclass('public.factory_order_product_link') is null, null;
