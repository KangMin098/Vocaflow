// scripts/db/isolated/t_g1_auto_promote.mjs
//
// G1 격리 검증 — 20261006090000_auto_promote_self_only.sql 을 빈 PG 에 적용하고 역할 매트릭스를 본다.
// 이전 상태는 롤백 파일(이전 live 정의 + 이전 ACL)로 만든다 → 수정 전 취약점 재현 → 마이그레이션 → 매트릭스 → 롤백 정확 복원.
// 실행: node scripts/db/isolated/t_g1_auto_promote.mjs   (embedded-postgres · 포트 54329 · 개발 DB 무접촉)
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
const HARNESS = path.resolve('scripts/csat/error-evidence/isolated-pg')
const { startCluster, record, results } = await import(path.join(HARNESS, 'lib.mjs').replace(/^([A-Za-z]):/, 'file:///$1:').replace(/\\/g, '/'))
const require = createRequire(path.join(HARNESS, 'package.json'))
const pg = require('pg')

const MIG = fs.readFileSync('supabase/migrations/20261006090000_auto_promote_self_only.sql', 'utf8')
const RB = fs.readFileSync('scripts/db/rollback-20261006090000.sql', 'utf8')
const A = '00000000-0000-0000-0000-00000000000a', B = '00000000-0000-0000-0000-00000000000b'
const FN = `public.auto_promote_v_level_for_user(uuid)`

const cluster = await startCluster()
const admin = new pg.Pool({ host: '127.0.0.1', port: 54329, database: 'ec', user: 'supabase_admin', password: 'admin', max: 4 })
// PostgREST 처럼: 역할 전환 + JWT claim(role · sub)
async function call(actor, uid) {
  const c = await admin.connect()
  try {
    await c.query('begin')
    if (actor.role) await c.query(`set local role ${actor.role}`)
    if (actor.jwtRole) await c.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: actor.jwtRole, sub: actor.sub ?? null })])
    const r = await c.query(`select * from ${FN.replace('(uuid)', '')}($1)`, [uid])
    await c.query('rollback')   // 매트릭스는 상태를 남기지 않는다
    return { ok: true, row: r.rows[0] }
  } catch (e) { await c.query('rollback').catch(() => {}); return { ok: false, code: e.code, err: e.message } } finally { c.release() }
}
const priv = async () => (await admin.query(`select has_function_privilege('anon','${FN}','execute') anon, has_function_privilege('authenticated','${FN}','execute') au, has_function_privilege('service_role','${FN}','execute') svc, exists(select 1 from pg_proc p, aclexplode(p.proacl) x where p.oid='${FN}'::regprocedure and x.grantee=0) pub, md5(pg_get_functiondef('${FN}'::regprocedure)) h`)).rows[0]

try {
  await admin.query(`
    create role anon nologin; create role authenticated nologin; create role service_role nologin bypassrls;
    create schema auth; grant usage on schema auth to anon, authenticated, service_role;
    create function auth.uid() returns uuid language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.sub', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub'))::uuid $$;
    create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role'))::text $$;
    grant execute on all functions in schema auth to anon, authenticated, service_role;
    create role postgres nologin;
    create table public.user_profiles (user_id uuid primary key, current_v_level smallint);
    create table public.vocabularies (id bigserial primary key, user_id uuid, word text);
    create table public.shared_dictionary (word text primary key, v_level smallint);
    create table public.learning_records (id bigserial primary key, vocabulary_id bigint, is_correct boolean, attempted_at timestamptz);
    create table public.level_log (user_id uuid, new_level smallint);
    -- update_user_v_level 대역: 인자 모양만 live 와 같게, 레벨을 바꾸고 기록한다
    create function public.update_user_v_level(p_user_id uuid, p_new_level smallint, p_source text, p_confidence numeric, p_reason text, p_diagnostic_id uuid, p_triggered_by text, p_trigger_details jsonb)
      returns void language sql as $$ update public.user_profiles set current_v_level = p_new_level where user_id = p_user_id; insert into public.level_log values (p_user_id, p_new_level) $$;
    insert into public.user_profiles values ('${A}', 3), ('${B}', 3);
    -- A · B 둘 다 V4 낱말 20개를 30일 안에 3번씩 맞혔다(승급 조건 충족)
    insert into public.shared_dictionary select 'w'||g, 4 from generate_series(1,20) g;
    insert into public.vocabularies (user_id, word) select u, 'w'||g from (values ('${A}'::uuid), ('${B}'::uuid)) v(u), generate_series(1,20) g;
    insert into public.learning_records (vocabulary_id, is_correct, attempted_at) select v.id, true, now() - make_interval(hours => k) from public.vocabularies v, generate_series(1,3) k;
    -- cron 래퍼 대역: live 처럼 SECURITY DEFINER 로 전원을 돈다
    create function public.cron_stub() returns int language plpgsql security definer set search_path = public as $$
      declare n int := 0; r record; begin for r in select user_id from public.user_profiles loop
        if (select promoted from public.auto_promote_v_level_for_user(r.user_id)) then n := n + 1; end if; end loop; return n; end $$;
  `)
  // ── 수정 전 상태(롤백 파일 = 이전 정의 + 이전 ACL) ──
  await admin.query(RB)
  const before = await priv()
  record('G1 수정 전', 'anon 실행 가능(취약점 재현 조건)', before.anon === true && before.pub === true, before)
  const vuln = await call({ role: 'anon', jwtRole: 'anon' }, B)
  record('G1 수정 전', 'anon 이 남(B)의 승급을 일으킨다', vuln.ok && vuln.row?.promoted === true, vuln.ok ? vuln.row.reason : vuln.err)
  const hBefore = before.h

  // ── 마이그레이션 적용 ──
  await admin.query('begin'); await admin.query(MIG); await admin.query('commit')
  const after = await priv()
  record('G1 권한', 'PUBLIC · anon EXECUTE 없음', after.pub === false && after.anon === false, after)
  record('G1 권한', 'authenticated · service_role EXECUTE 있음', after.au === true && after.svc === true, after)

  const m = [
    ['anon → 남(B)', { role: 'anon', jwtRole: 'anon' }, B, (r) => !r.ok && r.code === '42501'],
    ['anon → 자기 sub 를 B 로 위장해도', { role: 'anon', jwtRole: 'anon', sub: B }, B, (r) => !r.ok && r.code === '42501'],
    ['authenticated A → 남(B)', { role: 'authenticated', jwtRole: 'authenticated', sub: A }, B, (r) => !r.ok && r.code === '42501' && /본인/.test(r.err)],
    ['authenticated A → 자기(A) 승급', { role: 'authenticated', jwtRole: 'authenticated', sub: A }, A, (r) => r.ok && r.row.promoted === true && r.row.new_level === 4],
    ['authenticated · JWT 없이(sub null) → A', { role: 'authenticated' }, A, (r) => r.ok],   // PostgREST 는 항상 claim 을 싣는다 — 역할만 바꾼 세션은 claim 없음: role() null → 검사 대상 아님, 기록용
    ['service_role JWT → 남(B)', { role: 'service_role', jwtRole: 'service_role' }, B, (r) => r.ok && r.row.promoted === true],
    ['소유자 · JWT 없음(cron) → B', {}, B, (r) => r.ok && r.row.promoted === true],
  ]
  for (const [name, actor, uid, ok] of m) { const r = await call(actor, uid); record('G1 매트릭스', name, ok(r), r.ok ? r.row.reason : `${r.code} ${r.err}`) }

  // cron 래퍼(SECURITY DEFINER) — JWT 없는 cron 은 전원 승급, 로그인 사용자가 래퍼를 부르면 남 몫에서 막힌다
  const c1 = await admin.connect()
  try { await c1.query('begin'); const n = (await c1.query('select public.cron_stub() n')).rows[0].n; record('G1 cron', 'JWT 없는 cron 래퍼 → 2명 승급', n === 2, `n=${n}`); await c1.query('rollback') } finally { c1.release() }
  const c2 = await admin.connect()
  try {
    await c2.query('begin'); await c2.query(`grant execute on function public.cron_stub() to authenticated`); await c2.query('set local role authenticated')
    await c2.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ role: 'authenticated', sub: A })])
    let blocked = false; try { await c2.query('select public.cron_stub()') } catch (e) { blocked = e.code === '42501' }
    record('G1 cron', '로그인 사용자가 래퍼로 우회 → 남 몫에서 42501', blocked); await c2.query('rollback')
  } finally { c2.release() }

  // 본문은 검사 한 덩어리 외에 그대로인가 — 마이그레이션 정의에서 검사 블록을 빼면 이전 정의와 같아야 한다
  const def = (await admin.query(`select pg_get_functiondef('${FN}'::regprocedure) d`)).rows[0].d
  const stripped = def.replace(/\n  -- 본인만[\s\S]*?END IF;\n/, '\n')
  await admin.query(RB)
  const restored = await priv()
  const defOld = (await admin.query(`select pg_get_functiondef('${FN}'::regprocedure) d`)).rows[0].d
  record('G1 본문', '검사 블록 외 본문 동일', stripped === defOld)
  record('G1 롤백', '정의 · ACL 정확 복원', restored.h === hBefore && restored.anon === true && restored.pub === true && restored.au === true && restored.svc === true, restored)
} finally {
  await admin.end().catch(() => {})
  await cluster.stop()
  const fail = results.filter((r) => !r.pass).length
  fs.writeFileSync('scripts/db/isolated/results-g1.json', JSON.stringify({ ranAt: new Date().toISOString(), pass: results.length - fail, fail, results }, null, 1))
  console.log(`\n합계 PASS ${results.length - fail} · FAIL ${fail}`)
  process.exitCode = fail ? 1 : 0
}
