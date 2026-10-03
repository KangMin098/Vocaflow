// scripts/csat/error-evidence/isolated-pg/t_rls.mjs
// 역할별 실제 권한 — 표 9개 × 행동 4개 × 역할(anon · 학습자 L1 · 판정자 RA · 관리자 · service_role)
import { as, record } from './lib.mjs'
import { ANON, SERVICE, U, learner } from './seed.mjs'

const TABLES = ['csat_ec_taxonomy_version', 'csat_ec_code', 'csat_ec_ai_run', 'csat_ec_claim', 'csat_ec_review_round',
  'csat_ec_review_assignment', 'csat_ec_judgment', 'csat_ec_session_confirmation', 'csat_ec_process_evidence']
const ACTORS = { anon: ANON, learner: learner(U.L1), reviewer: learner(U.RA), admin: learner(U.ADM), service: SERVICE }
// 기대: SELECT 가능한 (표, 역할) — 나머지 SELECT 는 권한 거부. INSERT · UPDATE · DELETE 는 전부 거부
const SELECT_OK = {
  csat_ec_taxonomy_version: ['learner', 'reviewer', 'admin'],
  csat_ec_code: ['learner', 'reviewer', 'admin'],
  csat_ec_claim: ['learner', 'reviewer', 'admin'],
  csat_ec_session_confirmation: ['learner', 'reviewer', 'admin'],
  csat_ec_process_evidence: ['learner', 'reviewer', 'admin'],
}

export default async function rls(admin, ctx) {
  const { app } = ctx
  const matrix = []
  let rlsFail = 0
  for (const t of TABLES) {
    for (const [name, actor] of Object.entries(ACTORS)) {
      const sel = await as(app, actor, `select * from public.${t}`)
      const ins = await as(app, actor, `insert into public.${t} default values`)
      const upd = await as(app, actor, `update public.${t} set ${t === "csat_ec_code" ? "label = label" : "created_at = created_at"}`)
      const del = await as(app, actor, `delete from public.${t}`)
      const trunc = await as(app, actor, `truncate public.${t}`)
      const selExpected = (SELECT_OK[t] ?? []).includes(name)
      const denied = (r) => !r.ok && /permission denied|must be owner/.test(r.err)
      const pass = (selExpected ? sel.ok : denied(sel)) && denied(ins) && denied(upd) && denied(del) && denied(trunc)
      matrix.push({ t, name, select: sel.ok ? sel.rows.length : 'X', insert: ins.ok ? 'O' : 'X', update: upd.ok ? 'O' : 'X', delete: del.ok ? 'O' : 'X', truncate: trunc.ok ? 'O' : 'X' })
      if (!pass) rlsFail++
      if (!pass) record('RLS', `${t} × ${name}`, false, { sel: sel.err ?? sel.rows.length, ins: ins.err, upd: upd.err, del: del.err, trunc: trunc.err })
    }
  }
  record('RLS', '표 9 × 역할 5 × (SELECT · INSERT · UPDATE · DELETE · TRUNCATE) 기대와 일치', rlsFail === 0, `위반 ${rlsFail}건 / ${matrix.length}칸`)
  ctx.rlsMatrix = matrix

  // 학습자 행 범위 — L1 은 자기 행만, 학생 claim 만(AI claim 비공개)
  const own = await as(app, learner(U.L1), `select (select count(*) from public.csat_ec_claim) c, (select count(*) from public.csat_ec_claim where user_id <> auth.uid()) other,
     (select count(*) from public.csat_ec_claim where source = 'ai') ai, (select count(*) from public.csat_ec_process_evidence where user_id <> auth.uid()) pe_other,
     (select count(*) from public.csat_ec_session_confirmation where user_id <> auth.uid()) conf_other`)
  const o = own.ok ? own.rows[0] : {}
  record('RLS', '학습자 L1 — 자기 학생 claim 만(타인 · AI 0) · 타인 증거 · 확인 0', own.ok && Number(o.c) === 12 && Number(o.other) === 0 && Number(o.ai) === 0 && Number(o.pe_other) === 0 && Number(o.conf_other) === 0, o)
  const outsider = await as(app, learner(U.OUT), `select (select count(*) from public.csat_ec_claim) c, (select count(*) from public.csat_ec_process_evidence) pe, (select count(*) from public.csat_ec_session_confirmation) conf`)
  record('RLS', '외부 사용자 — claim · 증거 · 확인 0행', outsider.ok && Object.values(outsider.rows[0]).every((v) => Number(v) === 0), outsider.rows?.[0])
  const svc = await as(app, SERVICE, `select count(*) from public.csat_ec_judgment`)
  record('RLS', 'service_role(AI) — 사람 판정 표 SELECT 권한 거부(BYPASSRLS 여도 GRANT 없음)', !svc.ok && /permission denied/.test(svc.err), svc.err)
  const svcClaim = await as(app, SERVICE, `select count(*) from public.csat_ec_claim`)
  record('RLS', 'service_role(AI) — claim 표(학생 범주 보고 포함) SELECT 거부', !svcClaim.ok && /permission denied/.test(svcClaim.err), svcClaim.err)
  const svcRpc = await as(app, SERVICE, `select * from public.csat_ec_blind_queue(1)`)
  record('RLS', 'service_role — 판정자 RPC 실행 권한 없음', !svcRpc.ok && /permission denied/.test(svcRpc.err), svcRpc.err)
  const anonRpc = await as(app, ANON, `select public.csat_ec_confirm_session('00000000-0000-4000-8000-000000000000', true, true)`)
  record('RLS', 'anon — 학습자 RPC 실행 권한 없음', !anonRpc.ok && /permission denied/.test(anonRpc.err), anonRpc.err)
  const learnerAi = await as(app, learner(U.L1), `select public.csat_ec_ai_export(1, '00000000-0000-4000-8000-000000000000', 18::smallint)`)
  record('RLS', 'authenticated — AI RPC 실행 권한 없음', !learnerAi.ok && /permission denied/.test(learnerAi.err), learnerAi.err)
  const helper = await as(app, learner(U.L1), `select public.csat_ec_judgment_input_hash('00000000-0000-4000-8000-000000000000', 18::smallint)`)
  record('RLS', '계산 함수(해시 · 품질) — 직접 실행 권한 없음', !helper.ok && /permission denied/.test(helper.err), helper.err)

  // SECURITY DEFINER 전수 감사
  const defs = (await admin.query(`
    select p.proname, pg_get_userbyid(p.proowner) owner, p.prosecdef, p.proconfig,
           has_function_privilege('public', p.oid, 'execute') pub, has_function_privilege('anon', p.oid, 'execute') anon,
           has_function_privilege('authenticated', p.oid, 'execute') auth, has_function_privilege('service_role', p.oid, 'execute') svc,
           pg_get_functiondef(p.oid) ~* 'execute\\s+format' as dyn
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname like 'csat\\_ec\\_%' order by p.proname`)).rows
  ctx.definerAudit = defs
  const badPath = defs.filter((d) => d.prosecdef && !(d.proconfig ?? []).some((c) => c === 'search_path=""' || c === "search_path=''" || c === 'search_path='))
  record('DEFINER', `SECURITY DEFINER ${defs.filter((d) => d.prosecdef).length}개 — 모두 search_path 고정`, badPath.length === 0, badPath.map((d) => [d.proname, d.proconfig]))
  const allPath = defs.filter((d) => !(d.proconfig ?? []).some((c) => c.startsWith('search_path=')))
  record('DEFINER', `함수 ${defs.length}개 전부 search_path 고정(INVOKER 포함)`, allPath.length === 0, allPath.map((d) => d.proname))
  record('DEFINER', '소유자 = postgres(운영과 같은 비 superuser · BYPASSRLS)', defs.every((d) => d.owner === 'postgres'), [...new Set(defs.map((d) => d.owner))])
  record('DEFINER', 'PUBLIC · anon 실행 권한 0', defs.every((d) => !d.pub && !d.anon), defs.filter((d) => d.pub || d.anon).map((d) => d.proname))
  record('DEFINER', '동적 SQL(EXECUTE format) 사용 함수 0개', defs.filter((d) => d.dyn).map((d) => d.proname).join() === '', defs.filter((d) => d.dyn).map((d) => d.proname))

  // 그림자 객체 공격 — 학습자가 public 에 같은 이름 함수 · 표를 만들 수 있나(만들 수 없어야 하고, 만들어도 search_path='' 라 무관)
  const shadow = await as(app, learner(U.L1), `create function public.is_admin() returns boolean language sql as 'select true'`)
  record('DEFINER', '학습자가 public 에 함수 생성(그림자) 거부', !shadow.ok, shadow.err)
  const tmp = await as(app, learner(U.L1), `create temp table csat_dx_session (id uuid, user_id uuid);
      insert into pg_temp.csat_dx_session values ('${ctx.S.L2}', '${U.L1}');
      set local search_path = pg_temp, public;
      select public.csat_ec_confirm_session('${ctx.S.L2}', true, true)`)
  record('DEFINER', 'pg_temp 그림자 표(타인 세션을 내 것으로 위장)로 소유 확인 우회 불가', !tmp.ok && /자기 기록만/.test(tmp.err), tmp.err)
}
