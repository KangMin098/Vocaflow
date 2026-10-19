-- scripts/db/factory-i1/d3-package/verify.sql
begin read only;
select 'history' as kind,'20261020063000' as name,
  coalesce(encode(sha256(convert_to(array_to_string(h.statements,''),'UTF8')),'hex')='f94bf27f7c00ff5054a7bc2efdf61a55d83aefd98c2502e895c8332001aae3d8',false) as ok,
  jsonb_build_object('installed',h.version is not null,'exact_source',coalesce(encode(sha256(convert_to(array_to_string(h.statements,''),'UTF8')),'hex')='f94bf27f7c00ff5054a7bc2efdf61a55d83aefd98c2502e895c8332001aae3d8',false)) as detail
from (values('20261020063000')) expected(version) left join supabase_migrations.schema_migrations h using(version)
union all
select 'table',expected.name,
  coalesce(c.relrowsecurity,false) and not exists(select 1 from unnest(array['anon','authenticated','service_role']) r cross join unnest(array['INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES']) priv where has_table_privilege(r,c.oid,priv)) as ok,
  jsonb_build_object('installed',c.oid is not null,'rls',coalesce(c.relrowsecurity,false))
from unnest(array['factory_product_order','factory_order_product_link','factory_product_order_withdrawal','factory_lineage_request']) expected(name)
left join pg_class c on c.oid=to_regclass('public.'||expected.name)
union all
select 'rpc',expected.name,
  coalesce(p.prosecdef,false) and coalesce(array_to_string(p.proconfig,',') like '%search_path=public, pg_temp%',false)
    and coalesce(not has_function_privilege('anon',p.oid,'execute'),false)
    and coalesce(not has_function_privilege('authenticated',p.oid,'execute'),false)
    and coalesce(has_function_privilege('service_role',p.oid,'execute'),false) as ok,
  jsonb_build_object('installed',p.oid is not null,'security_definer',coalesce(p.prosecdef,false),'config',p.proconfig,
    'anon_execute',has_function_privilege('anon',p.oid,'execute'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'execute'),'server_execute',has_function_privilege('service_role',p.oid,'execute'))
from unnest(array['factory_product_order_register(uuid,text,text,jsonb,integer,text,uuid)','factory_order_link_product(uuid,uuid,text,integer,text,text,integer,text,uuid)','factory_product_order_withdraw(uuid,text,integer,text,text,uuid)','factory_lineage_read(uuid,uuid,uuid)']) expected(name)
left join pg_proc p on p.oid=to_regprocedure('public.'||expected.name);
commit;
