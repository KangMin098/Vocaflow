// scripts/db/factory-i1/d3-package.mjs
// Builds reviewable SQL only. No DB/network/environment access and no apply command.
import fs from 'node:fs'
import path from 'node:path'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { CATALOG_SQL, diffSql } from './catalog.mjs'
import { BASELINE_SQL } from './d3-baseline-query.mjs'

const ROOT = path.resolve(import.meta.dirname, '../../..')
const T = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8')
const hash = (s) => createHash('sha256').update(s).digest('hex')
const lit = (s) => `'${String(s).replaceAll("'", "''")}'`
export const D3_VERSION = '20261020063000'
export const D3_TABLES = [
  'factory_product_order',
  'factory_order_product_link',
  'factory_product_order_withdrawal',
  'factory_lineage_request',
]
export const D3_RPCS = [
  'factory_product_order_register(uuid,text,text,jsonb,integer,text,uuid)',
  'factory_order_link_product(uuid,uuid,text,integer,text,text,integer,text,uuid)',
  'factory_product_order_withdraw(uuid,text,integer,text,text,uuid)',
  'factory_lineage_read(uuid,uuid,uuid)',
]
export function buildD3Package({
  baselineRows = JSON.parse(T('scripts/db/factory-i1/d3-baseline.json')).rows,
  allow = JSON.parse(T('scripts/db/factory-i1/d3-allow.json')),
} = {}) {
  const source = T('scripts/db/factory-i1/d3.sql')
  const sourceHash = hash(source)
  if (source.includes('$vf_d3_source$')) throw new Error('source delimiter collision')
  if (allow.changed.length || allow.removed.length || !allow.added.length)
    throw new Error('D3 must only add measured objects')
  const sql = `-- scripts/db/factory-i1/d3-package/apply.sql
-- REVIEW ONLY: 사용자 승인 전 공유 DB 실행 금지. 기존 DB1/DB2를 재적용하지 않는다.
-- source sha256=${sourceHash}; exact source bytes follow VF-D3 markers.
begin;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $guard$ declare actual jsonb; begin
  if current_setting('server_encoding') <> 'UTF8' then raise exception 'D3_BLOCKED: UTF8 required'; end if;
  if exists(select 1 from unnest(array[${D3_TABLES.map((n) => lit('public.' + n)).join(',')}]) n where to_regclass(n) is not null) then raise exception 'D3_BLOCKED: target already exists'; end if;
  if exists(select 1 from supabase_migrations.schema_migrations where version=${lit(D3_VERSION)}) then raise exception 'D3_BLOCKED: migration history already exists'; end if;
  select baseline into actual from (${BASELINE_SQL}) b;
  if actual is distinct from ${lit(JSON.stringify(baselineRows))}::jsonb then raise exception 'D3_BLOCKED: prerequisite fingerprint changed'; end if;
end $guard$;
create temporary table vf_d3_before on commit drop as ${CATALOG_SQL};
-- >>> VF-D3 SOURCE
${source}-- <<< VF-D3 SOURCE
do $guard$ declare actual jsonb; begin
  select to_jsonb(x) into actual from (${diffSql('vf_d3_before')}) x;
  if actual is distinct from ${lit(JSON.stringify(allow))}::jsonb then raise exception 'D3_BLOCKED: catalog diff outside measured allowlist: %',actual; end if;
end $guard$;
insert into supabase_migrations.schema_migrations(version,name,statements)
values(${lit(D3_VERSION)},'factory_product_order_lineage_v1',array[$vf_d3_source$${source}$vf_d3_source$]);
commit;
`
  const restore = `-- scripts/db/factory-i1/d3-package/stop-writes.sql
-- 비파괴 복구: 모든 기록·조회 보존, 쓰기 RPC만 정지. 공유 DB 실행은 별도 승인.
begin;
${D3_RPCS.filter((n) => !n.startsWith('factory_lineage_read'))
  .map((n) => `revoke execute on function public.${n} from service_role;`)
  .join('\n')}
commit;
`
  const verify = `-- scripts/db/factory-i1/d3-package/verify.sql
begin read only;
select 'history' as kind,${lit(D3_VERSION)} as name,
  coalesce(encode(sha256(convert_to(array_to_string(h.statements,''),'UTF8')),'hex')=${lit(sourceHash)},false) as ok,
  jsonb_build_object('installed',h.version is not null,'exact_source',coalesce(encode(sha256(convert_to(array_to_string(h.statements,''),'UTF8')),'hex')=${lit(sourceHash)},false)) as detail
from (values(${lit(D3_VERSION)})) expected(version) left join supabase_migrations.schema_migrations h using(version)
union all
select 'table',expected.name,
  coalesce(c.relrowsecurity,false) and not exists(select 1 from unnest(array['anon','authenticated','service_role']) r cross join unnest(array['INSERT','UPDATE','DELETE','TRUNCATE','TRIGGER','REFERENCES']) priv where has_table_privilege(r,c.oid,priv)) as ok,
  jsonb_build_object('installed',c.oid is not null,'rls',coalesce(c.relrowsecurity,false))
from unnest(array[${D3_TABLES.map(lit).join(',')}]) expected(name)
left join pg_class c on c.oid=to_regclass('public.'||expected.name)
union all
select 'rpc',expected.name,
  coalesce(p.prosecdef,false) and coalesce(array_to_string(p.proconfig,',') like '%search_path=public, pg_temp%',false)
    and coalesce(not has_function_privilege('anon',p.oid,'execute'),false)
    and coalesce(not has_function_privilege('authenticated',p.oid,'execute'),false)
    and coalesce(has_function_privilege('service_role',p.oid,'execute'),false) as ok,
  jsonb_build_object('installed',p.oid is not null,'security_definer',coalesce(p.prosecdef,false),'config',p.proconfig,
    'anon_execute',has_function_privilege('anon',p.oid,'execute'),'authenticated_execute',has_function_privilege('authenticated',p.oid,'execute'),'server_execute',has_function_privilege('service_role',p.oid,'execute'))
from unnest(array[${D3_RPCS.map(lit).join(',')}]) expected(name)
left join pg_proc p on p.oid=to_regprocedure('public.'||expected.name);
commit;
`
  const manifest = {
    contract: 'vf.factory-lineage-deploy/1',
    version: D3_VERSION,
    source_sha256: sourceHash,
    apply_sha256: hash(sql),
    stop_writes_sha256: hash(restore),
    verify_sha256: hash(verify),
    baseline_sha256: hash(JSON.stringify(baselineRows)),
    catalog: allow,
    shared_apply: 'REQUIRES_SEPARATE_APPROVAL',
    rollback: 'Stop writes; preserve all rows and reads. No DROP/DELETE rollback.',
  }
  return { sql, restore, verify, manifest }
}
if (path.resolve(process.argv[1] ?? '') === fileURLToPath(import.meta.url)) {
  const pkg = buildD3Package()
  const dir = path.join(ROOT, 'scripts/db/factory-i1/d3-package')
  const files = {
    'apply.sql': pkg.sql,
    'stop-writes.sql': pkg.restore,
    'verify.sql': pkg.verify,
    'MANIFEST.json': JSON.stringify(pkg.manifest, null, 2) + '\n',
  }
  if (process.argv.includes('--check')) {
    for (const [name, body] of Object.entries(files))
      if (fs.readFileSync(path.join(dir, name), 'utf8') !== body)
        throw new Error(`package drift: ${name}`)
    process.stdout.write('D3 package exact-byte check PASS\n')
  } else {
    fs.mkdirSync(dir, { recursive: true })
    for (const [name, body] of Object.entries(files)) fs.writeFileSync(path.join(dir, name), body)
    process.stdout.write(
      JSON.stringify({
        version: D3_VERSION,
        apply_sha256: pkg.manifest.apply_sha256,
        shared_apply: pkg.manifest.shared_apply,
      }) + '\n'
    )
  }
}
