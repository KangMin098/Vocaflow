// public 함수 EXECUTE 전수 감사 — 읽기 전용. DB 는 pg_proc 만 읽고, 저장소는 호출부만 grep 한다.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const require = createRequire('D:/workspace/Vocaflow-ec-smoke/scripts/csat/error-evidence/isolated-pg/package.json')
const pg = require('pg')
const ROOT = 'D:/workspace/Vocaflow-ec-smoke'
const OUT = process.argv[2]

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
await c.connect()
await c.query('set transaction read only')
const { rows } = await c.query(`
 select p.oid::int, p.proname n, pg_get_function_identity_arguments(p.oid) a, p.prosecdef sd,
  p.prorettype = 'trigger'::regtype trig, pg_get_userbyid(p.proowner) owner, p.proconfig cfg, p.proacl::text acl,
  has_function_privilege('anon',p.oid,'execute') anon, has_function_privilege('authenticated',p.oid,'execute') au,
  has_function_privilege('service_role',p.oid,'execute') svc,
  (p.proacl is null or exists(select 1 from aclexplode(p.proacl) x where x.grantee=0)) via_public,
  exists(select 1 from aclexplode(p.proacl) x where x.grantee='anon'::regrole) anon_direct,
  exists(select 1 from aclexplode(p.proacl) x where x.grantee='authenticated'::regrole) au_direct,
  exists(select 1 from aclexplode(p.proacl) x where x.grantee='service_role'::regrole) sr_direct,
  p.prosrc ~* '\\m(insert|update|delete|truncate|merge)\\M' writes,
  p.prosrc ~* '(is_admin|admin_users|is_admin_or_curator|video_is_admin)' admin_check,
  p.prosrc ~* '(auth\\.uid\\(\\)|auth\\.role\\(\\)|auth\\.jwt\\(\\))' uid_check
 from pg_proc p where p.pronamespace='public'::regnamespace and p.prokind='f'
  and not exists(select 1 from pg_depend d where d.objid=p.oid and d.deptype='e')
 order by 2,3`)
await c.end()

// 호출부 수집
function walk(d, acc = []) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    if (e.name === 'node_modules' || e.name.startsWith('.')) continue
    const p = path.join(d, e.name)
    if (e.isDirectory()) walk(p, acc)
    else if (/\.(ts|tsx|mjs|js|cjs)$/.test(e.name) && !/__tests__|\.test\./.test(p)) acc.push(p)
  }
  return acc
}
const files = [...walk(path.join(ROOT, 'apps/web/src')), ...walk(path.join(ROOT, 'scripts')), ...(fs.existsSync(path.join(ROOT, 'supabase/functions')) ? walk(path.join(ROOT, 'supabase/functions')) : [])]
const callers = {}
const rpcRe = /\.rpc\(\s*['"]([a-z_0-9]+)['"]/g
for (const f of files) {
  const s = fs.readFileSync(f, 'utf8')
  let m; const names = new Set()
  while ((m = rpcRe.exec(s))) names.add(m[1])
  if (!names.size) continue
  const rel = path.relative(ROOT, f).replace(/\\/g, '/')
  let kind
  // 스크립트도 로그인 세션(학습자 · 검수자 JWT)으로 부르면 authenticated 호출이다 — service 로 세지 않는다
  if ((rel.startsWith('scripts/') || rel.startsWith('supabase/')) && /signInWithPassword|signInWith|ANON_KEY|setSession/.test(s)) kind = 'user_script'
  else if (rel.startsWith('scripts/') || rel.startsWith('supabase/')) kind = 'script'
  else if (/lib\/supabase\/admin|createAdminClient/.test(s) && !/lib\/supabase\/(server|client)['"]/.test(s)) kind = 'service'
  else if (/^['"]use client['"]/m.test(s)) kind = 'browser'
  else kind = 'user_server'
  const adminArea = /(^|\/)(admin)(\/|$)|lib\/admin\//.test(rel)
  for (const n of names) (callers[n] ||= []).push({ rel, kind, adminArea })
}
// cron · SQL 내부 사용
const mig = fs.readdirSync(path.join(ROOT, 'supabase/migrations')).map(f => fs.readFileSync(path.join(ROOT, 'supabase/migrations', f), 'utf8')).join('\n')
const cronNames = new Set([...mig.matchAll(/cron\.schedule\([\s\S]{0,400}?\$\$?[\s\S]{0,400}?\b([a-z_0-9]+)\s*\(/g)].map(m => m[1]))
// 이전 anon 기준선(2026-09-20)
const base = JSON.parse(fs.readFileSync(path.join(ROOT, 'scripts/db/anon-executable-functions.json'), 'utf8')).functions
const baseNames = new Set(base.map(x => typeof x === 'string' ? x.split('(')[0] : x.name))

const out = rows.filter(r => r.anon || r.au).map(r => {
  const cs = callers[r.n] || []
  const kinds = [...new Set(cs.map(x => x.kind))]
  const learnerCall = cs.filter(x => x.kind === 'browser' || x.kind === 'user_server' || x.kind === 'user_script')
  let cls
  if (r.trig) cls = 'trigger_only'
  // 본문이 auth.uid()/is_admin 을 요구하면 로그인 호출을 전제한 함수다 — 호출부를 못 찾아도 service_only 로 내리지 않는다
  else if (!learnerCall.length && !r.uid_check && !r.admin_check) cls = 'service_only'
  else if (!learnerCall.length) cls = 'authenticated_only'
  else if (learnerCall.every(x => x.adminArea)) cls = 'admin_only'
  else cls = 'authenticated_only'
  // anon 이 앱 경로로 의도적으로 부르는 것: 브라우저 호출 + 이전 기준선의 의도 목록(peek/funnel 등)
  const anonIntended = ['peek_class_by_code', 'record_funnel_event'].includes(r.n)
  if (anonIntended) cls = 'intended_public'
  const unexpectedAnon = r.anon && cls !== 'intended_public' && cls !== 'trigger_only'
  const unexpectedAu = r.au && (cls === 'service_only')
  return { name: r.n, args: r.a, oid: r.oid, owner: r.owner, secdef: r.sd, writes: r.writes, admin_check: r.admin_check, uid_check: r.uid_check,
    anon: r.anon, authenticated: r.au, service_role: r.svc, via_public: r.via_public, anon_direct: r.anon_direct, au_direct: r.au_direct, sr_direct: r.sr_direct, acl: r.acl,
    cls, unexpected_anon: unexpectedAnon, unexpected_authenticated: unexpectedAu, in_0920_baseline: baseNames.has(r.n),
    cron: cronNames.has(r.n), callers: kinds, caller_files: cs.map(x => `${x.kind}:${x.rel}`).slice(0, 6) }
})
fs.writeFileSync(OUT, JSON.stringify(out, null, 1))
const t = (f) => out.filter(f).length
console.log({ total: out.length, anon: t(x => x.anon), au: t(x => x.authenticated),
  via_public: t(x => x.via_public), anon_direct: t(x => x.anon_direct),
  by_cls: Object.fromEntries(['intended_public', 'authenticated_only', 'admin_only', 'service_only', 'trigger_only'].map(k => [k, t(x => x.cls === k)])),
  unexpected_anon: t(x => x.unexpected_anon), unexpected_anon_secdef_write: t(x => x.unexpected_anon && x.secdef && x.writes),
  unexpected_au_service_only: t(x => x.unexpected_authenticated), unexpected_au_secdef_write_nocheck: t(x => x.unexpected_authenticated && x.secdef && x.writes && !x.admin_check && !x.uid_check) })
