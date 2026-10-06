// scripts/db/drafts/gen-g2-migration.mjs
// G2 마이그레이션 생성 — manifest(정본) + live 정의에서 만든다. DB 를 고치지 않는다(읽기 전용 트랜잭션).
//   ① 검사 헬퍼 2개(invoker) ② 본문 검사 삽입(가드 ③ 위반 함수만 — plpgsql: 첫 BEGIN 뒤 PERFORM, sql: 결과문 앞 SELECT)
//   ③ 권한: manifest class 대로 PUBLIC · anon · authenticated 회수 후 필요한 역할만 GRANT(service_role 은 건드리지 않고 SERVICE_ONLY 만 GRANT)
//   ④ 신규 함수 기본 권한에서 authenticated 회수
// 롤백: 바뀐 함수의 이전 정의 + 모든 대상 함수의 이전 ACL 을 정확히 복원.
import fs from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire(new URL('../../csat/error-evidence/isolated-pg/package.json', import.meta.url))
const pg = require('pg')
const VERSION = '20261006100000'
const OUT = `supabase/migrations/${VERSION}_function_exec_policy.sql`
const RB = `scripts/db/rollback-${VERSION}.sql`
const man = JSON.parse(fs.readFileSync('scripts/db/function-exec-manifest.json', 'utf8')).functions

// 본문 검사 삽입 대상 — 2026-10-06 가드 ③ 위반(증거 판정 docs/reports/function-execute-decisions-2026-10-06.md)
const ADMIN_FIX = ['publish_article_word_set', 'admin_vrl_track_distribution', 'admin_vrl_v_level_distribution', 'admin_vrl_cron_jobs', 'admin_vrl_cron_runs',
  'admin_vrl_diagnostic_use', 'admin_vrl_snapshot_counts', 'content_gate_publishable', 'dict_polysemy_count', 'dict_inflections_by_pos',
  'dict_categorical_distributions', 'select_article_vocab', 'acp_article_rollup', 'db_health_anomalies']
// 본인 검사: 대상 user_id 를 내는 식(인자 그대로 또는 결과 행의 소유자)
const SELF_FIX = {
  recommend_word_sets_for_user: 'p_user_id',
  extract_vocabulary_for_user: 'p_user_id',
  extract_vocabulary_for_user_v2: 'p_user_id',
  record_pending_words: 'p_user_id',
  refresh_user_known_word_count: 'p_user_id',
  analyze_and_apply_diagnostic_result: '(select r.user_id from public.user_diagnostic_results r where r.id = p_result_id)',
  analyze_and_apply_track_diagnostic_result: '(select r.user_id from public.user_diagnostic_results r where r.id = p_result_id)',
  analyze_and_apply_comprehensive_diagnostic_result: '(select r.user_id from public.user_diagnostic_results r where r.id = p_result_id)',
}

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
await c.connect(); await c.query('begin read only')
// 롤백이 「직전 상태」를 복원하려면 G1(20261006090000) 이 적용된 뒤의 live 에서 생성해야 한다 — 아니면 롤백이 G1 을 되돌린다
const g1 = (await c.query(`select 1 from supabase_migrations.schema_migrations where version = '20261006090000'`)).rowCount
if (!g1 && !process.argv.includes('--draft-before-g1')) throw new Error('G1 미적용 — 적용 뒤 다시 생성한다(초안 미리보기는 --draft-before-g1)')
const rows = (await c.query(`select p.oid::int oid, p.proname n, p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' sig,
  p.oid::regprocedure::text regp, pg_get_functiondef(p.oid) def, (select lanname from pg_language l where l.oid = p.prolang) lang,
  p.prosecdef sd, coalesce(p.proacl::text, '') acl, p.prosrc src
  from pg_proc p where p.pronamespace = 'public'::regnamespace and p.prokind = 'f'
  and not exists(select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')`)).rows
const dacl = (await c.query(`select defaclacl::text a from pg_default_acl where defaclrole = 'postgres'::regrole and defaclnamespace = 'public'::regnamespace and defaclobjtype = 'f'`)).rows[0]?.a
const diag = (await c.query(`select count(*)::int n from information_schema.columns where table_schema = 'public' and table_name = 'user_diagnostic_results' and column_name = 'user_id'`)).rows[0].n
await c.query('rollback'); await c.end()
if (diag !== 1) throw new Error('user_diagnostic_results.user_id 가 없다 — 본인 검사 식을 다시 정한다')

function inject(r, stmt) {
  const def = r.def.replace(/\r\n/g, '\n')
  if (r.lang === 'plpgsql') {
    const m = def.match(/\n(BEGIN|begin)\n/)
    if (!m) throw new Error(`${r.sig}: BEGIN 줄을 못 찾았다`)
    return def.replace(m[0], `\n${m[1]}\n  PERFORM ${stmt};  -- 2026-10-06 G2 접근 검사\n`)
  }
  if (r.lang === 'sql') {
    if (/BEGIN\s+ATOMIC/i.test(def)) throw new Error(`${r.sig}: BEGIN ATOMIC — 수동 처리`)
    const open = def.indexOf('AS $function$')
    if (open < 0) throw new Error(`${r.sig}: 본문 구분자`)
    const at = open + 'AS $function$'.length
    return def.slice(0, at) + `\n  SELECT ${stmt};  -- 2026-10-06 G2 접근 검사(결과문은 아래 마지막 문장)` + def.slice(at)
  }
  throw new Error(`${r.sig}: 언어 ${r.lang}`)
}

const byName = {}
for (const r of rows) (byName[r.n] ||= []).push(r)
const one = (n) => { const l = byName[n] || []; if (l.length !== 1) throw new Error(`${n}: overload ${l.length}`); return l[0] }
const bodyFix = [...ADMIN_FIX.map((n) => [one(n), 'public._assert_admin_or_service()']), ...Object.entries(SELF_FIX).map(([n, e]) => [one(n), `public._assert_self_or_service(${e})`])]

let sql = `-- supabase/migrations/${VERSION}_function_exec_policy.sql
--
-- G2 — public 함수 EXECUTE 정책 정리. 정본 scripts/db/function-exec-manifest.json · 가드 scripts/db/check-function-exec.mjs(기본 거부).
-- 생성: scripts/db/drafts/gen-g2-migration.mjs (live 정의 · ACL 2026-10-06 추출). 손으로 고치지 말고 다시 생성한다.
-- 근거: docs/reports/function-execute-audit-2026-10-05.md · docs/reports/function-execute-decisions-2026-10-06.md
--
-- ① 검사 헬퍼 2개(SECURITY INVOKER) — JWT role 이 anon/authenticated 인 요청만 검사하고, JWT 없는 호출(cron · 소유자 내부)과
--    service_role 은 통과시킨다(G1 과 같은 규칙). invoker 함수가 호출자 권한으로 부르므로 모든 역할에 EXECUTE.
-- ② 본문 검사 ${bodyFix.length}개 — 각 함수 본문 맨 앞 한 줄만 더한다(나머지는 live 정의 그대로).
-- ③ 권한 — 함수마다 PUBLIC · anon · authenticated 를 회수하고 class 가 요구하는 역할만 다시 준다. service_role 은 회수하지 않는다.
-- ④ 앞으로 만드는 함수에 authenticated 기본 EXECUTE 를 주지 않는다(anon · PUBLIC 은 2026-09-19 에 이미).
-- 되돌리기: scripts/db/rollback-${VERSION}.sql

create or replace function public._assert_admin_or_service()
returns void language plpgsql stable security invoker set search_path = public as $fn$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') and not coalesce(public.is_admin(), false) then
    raise exception '관리자만 호출할 수 있다' using errcode = '42501';
  end if;
end $fn$;
comment on function public._assert_admin_or_service() is
  'G2(2026-10-06) 관리자 검사 — anon/authenticated JWT 요청은 is_admin() 이어야 한다. JWT 없는 호출(cron · 소유자)과 service_role 은 통과.';

create or replace function public._assert_self_or_service(p_user_id uuid)
returns void language plpgsql stable security invoker set search_path = public as $fn$
begin
  if coalesce(auth.role(), '') in ('anon', 'authenticated') and (auth.uid() is null or auth.uid() is distinct from p_user_id) then
    raise exception '본인 데이터만 다룰 수 있다' using errcode = '42501';
  end if;
end $fn$;
comment on function public._assert_self_or_service(uuid) is
  'G2(2026-10-06) 본인 검사 — anon/authenticated JWT 요청은 auth.uid() = 대상 user_id 여야 한다(대상이 없으면 거부). JWT 없는 호출과 service_role 은 통과.';

revoke execute on function public._assert_admin_or_service() from public;
revoke execute on function public._assert_self_or_service(uuid) from public;
grant execute on function public._assert_admin_or_service() to anon, authenticated, service_role;
grant execute on function public._assert_self_or_service(uuid) to anon, authenticated, service_role;

-- ② 본문 검사
`
for (const [r, stmt] of bodyFix) sql += `\n${inject(r, stmt).trim()};\n`

sql += `\n-- ③ 권한 (manifest class 기준)\n`
const GRANT = { PUBLIC_RPC: 'anon, authenticated', AUTH_READ_RPC: 'authenticated', AUTH_SELF_RPC: 'authenticated', REVIEWER_RPC: 'authenticated', ADMIN_RPC: 'authenticated' }
const touched = []
for (const r of rows) {
  const m = man[r.sig]
  if (!m) throw new Error(`manifest 미분류: ${r.sig}`)
  sql += `revoke execute on function ${r.regp} from public, anon, authenticated;\n`
  if (GRANT[m.class]) sql += `grant execute on function ${r.regp} to ${GRANT[m.class]};\n`
  if (m.class === 'SERVICE_ONLY') sql += `grant execute on function ${r.regp} to service_role;\n`
  touched.push(r)
}
sql += `\n-- ④ 신규 함수 기본 권한\nalter default privileges in schema public revoke execute on functions from authenticated;\n`
fs.writeFileSync(OUT, sql)

// 롤백 — 헬퍼 제거 · 이전 정의 · 이전 ACL(대상 함수 전부) · 이전 기본 ACL
let rb = `-- ${VERSION} 되돌리기 — 2026-10-06 추출 이전 상태. 기본 ACL 이전 값: ${dacl}\nbegin;\n`
for (const [r] of bodyFix) rb += `\n${r.def.replace(/\r\n/g, '\n').trim()};\n`
rb += '\n'
for (const r of touched) {
  rb += `revoke execute on function ${r.regp} from public, anon, authenticated, service_role;\n`
  const g = []
  if (!r.acl) g.push('public')   // proacl null = 기본(PUBLIC 실행)
  for (const ent of r.acl.replace(/[{}"]/g, '').split(',').filter(Boolean)) {
    const [who, rest] = ent.split('=')
    if (!rest || !rest.split('/')[0].includes('X') || who === 'postgres') continue
    g.push(who === '' ? 'public' : who)
  }
  if (g.length) rb += `grant execute on function ${r.regp} to ${[...new Set(g)].join(', ')};\n`
}
rb += `alter default privileges in schema public grant execute on functions to authenticated;\n`
rb += `drop function public._assert_self_or_service(uuid);\ndrop function public._assert_admin_or_service();\ncommit;\n`
fs.writeFileSync(RB, rb)
console.log({ functions: touched.length, bodyFix: bodyFix.length, out: OUT, rollback: RB, default_acl_before: dacl })
