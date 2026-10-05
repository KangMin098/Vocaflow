// review 60개 판정 근거 수집 — 읽기 전용
import fs from 'node:fs'
import { createRequire } from 'node:module'
const require = createRequire('D:/workspace/Vocaflow-ec-smoke/scripts/csat/error-evidence/isolated-pg/package.json')
const pg = require('pg')
const [IN, OUT] = process.argv.slice(2)
const plan = JSON.parse(fs.readFileSync(IN, 'utf8')).filter(f => f.action.startsWith('review'))
const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
await c.connect()
await c.query('set transaction read only')
const { rows } = await c.query(`select p.oid::int oid, p.proname n, pg_get_function_identity_arguments(p.oid) a, obj_description(p.oid,'pg_proc') cmt,
  pg_get_function_result(p.oid) ret, p.provolatile v, p.prosrc src from pg_proc p where p.oid = any($1::int[])`, [plan.map(f => f.oid)])
const invk = (await c.query(`select p.proname n, has_function_privilege('authenticated',p.oid,'execute') au, has_function_privilege('anon',p.oid,'execute') an, p.prosecdef sd from pg_proc p where p.pronamespace='public'::regnamespace`)).rows
await c.end()
const byOid = Object.fromEntries(rows.map(r => [r.oid, r]))
const out = plan.map(f => {
  const r = byOid[f.oid]
  const src = r.src.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ')
  const tables = [...new Set([...src.matchAll(/\b(?:from|join|into|update|delete from)\s+(?:public\.)?([a-z_0-9]+)/gi)].map(m => m[1].toLowerCase()))].filter(t => !['select', 'jsonb_array_elements', 'unnest', 'generate_series', 'lateral', 'v_chapter', 'v_word'].includes(t)).slice(0, 10)
  const userish = /\b(user_id|auth\.uid|profiles|user_)/i.test(src)
  return { name: f.name, args: f.args, oid: f.oid, action: f.action, cls_auto: f.cls, secdef: f.secdef, writes: f.writes, vol: r.v,
    ret: r.ret.slice(0, 80), comment: (r.cmt || '').slice(0, 220), tables, user_data: userish,
    priv: `PUBLIC=${f.via_public ? 'Y' : 'n'} anon=${f.anon ? 'Y' : 'n'} auth=${f.authenticated ? 'Y' : 'n'} svc=${f.service_role ? 'Y' : 'n'}`,
    callers: f.caller_files, invoked_by: (f.inInvoker || []).map(n => { const x = invk.find(i => i.n === n); return x ? `${n}(au=${x.au ? 'Y' : 'n'},anon=${x.an ? 'Y' : 'n'})` : n }),
    head: src.slice(0, 260) }
})
fs.writeFileSync(OUT, JSON.stringify(out, null, 1))
console.log(out.length)
