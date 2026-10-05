// 감사 결과(fn-census.json)에 DB 의존(정책 · 뷰 · 기본값 · 다른 invoker 함수 본문)을 붙여 회수 계획을 만든다. 읽기 전용.
import fs from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire('D:/workspace/Vocaflow-ec-smoke/scripts/csat/error-evidence/isolated-pg/package.json')
const pg = require('pg')
const [IN, OUT] = process.argv.slice(2)
const census = JSON.parse(fs.readFileSync(IN, 'utf8'))
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
await c.connect()
await c.query('set transaction read only')
const pol = (await c.query(`select schemaname||'.'||tablename t, coalesce(qual,'')||' '||coalesce(with_check,'') e from pg_policies`)).rows
const views = (await c.query(`select c.oid::regclass::text t, pg_get_viewdef(c.oid) e from pg_class c where c.relkind in ('v','m') and c.relnamespace in ('public'::regnamespace)`)).rows
const defs = (await c.query(`select a.adrelid::regclass::text t, pg_get_expr(a.adbin,a.adrelid) e from pg_attrdef a`)).rows
const invokers = (await c.query(`select p.proname t, p.prosrc e from pg_proc p where p.pronamespace='public'::regnamespace and not p.prosecdef`)).rows
await c.end()
const refs = (name, list) => list.filter(r => new RegExp(`\\b${name}\\s*\\(`).test(r.e)).map(r => r.t)
const plan = census.map(f => {
  const inPolicy = refs(f.name, pol), inView = refs(f.name, views), inDefault = refs(f.name, defs)
  const inInvoker = refs(f.name, invokers.filter(x => x.t !== f.name))
  const keepAu = inPolicy.length || inView.length || inDefault.length
  let action
  if (f.cls === 'intended_public') action = 'keep'
  else if (f.cls === 'trigger_only') action = 'revoke_public_anon_authenticated'
  else if (f.cls === 'service_only') action = keepAu ? 'revoke_public_anon(정책/뷰 의존)' : inInvoker.length ? 'review(invoker 함수가 부름)' : 'revoke_public_anon_authenticated'
  else action = (f.uid_check || f.admin_check || f.cls === 'admin_only') ? 'revoke_public_anon' : 'review(비로그인 공개 경로 확인)'
  return { ...f, inPolicy, inView, inDefault, inInvoker: inInvoker.slice(0, 5), action }
})
fs.writeFileSync(OUT, JSON.stringify(plan, null, 1))
const by = {}; for (const p of plan) by[p.action] = (by[p.action] || 0) + 1
console.log(by)
