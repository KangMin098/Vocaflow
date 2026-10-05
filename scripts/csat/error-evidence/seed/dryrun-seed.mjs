// scripts/csat/error-evidence/seed/dryrun-seed.mjs
//
// v0.1 conditional seed — 개발 DB 에서 **한 트랜잭션으로 넣고 봉인한 뒤 ROLLBACK** 하는 dry-run. 커밋하지 않는다.
// 입력: docs/csat-learner/codebook/data/seed-v0.1-rows.json(build-seed.mjs) — validate-seed.mjs 가 FAIL 이면 시작하지 않는다.
// 확인: 예상 write 수 = 실제 · 봉인 해시 = 정본 재계산 · 기존 v99.0/v99.1 · 회차 · 응답 · 증거 불변 · RPC/RLS 경로 · ROLLBACK 뒤 스냅샷 차이 0.
// 실제 학습자 기록에는 쓰지 않는다(경계 관찰 · probe 경로는 dev-smoke/smoke-pilot.mjs 가 TEST 계정으로 본다).
//
//   node --tls-max-v1.2 --env-file=<apps/web/.env.local> scripts/csat/error-evidence/seed/dryrun-seed.mjs

import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const REPO = path.resolve(HERE, '../../../..')
const require = createRequire(path.join(HERE, '../dev-smoke/package.json'))
const pg = require('pg')
const DEV_REF = 'jajenrevcbmrpaliomxv'
const DB_URL = process.env.SUPABASE_DB_URL
if (!DB_URL) { console.error('환경 변수 없음 — --env-file 로 실행'); process.exit(2) }
if (!DB_URL.includes(DEV_REF)) { console.error(`개발 프로젝트(${DEV_REF})가 아니다 — 중단`); process.exit(2) }
const CB_DATA = path.join(REPO, 'docs/csat-learner/codebook/data')
const rows = JSON.parse(fs.readFileSync(path.join(CB_DATA, 'seed-v0.1-rows.json'), 'utf8'))
const validation = JSON.parse(fs.readFileSync(path.join(CB_DATA, 'seed-v0.1-validation.json'), 'utf8'))
if (validation.status === 'FAIL') { console.error('정적 검증 FAIL — dry-run 하지 않는다'); process.exit(1) }
const V = rows.taxonomy.version

const results = []
const record = (area, name, ok, detail) => { results.push({ area, name, ok: !!ok, ...(detail === undefined ? {} : { detail }) }); console.log(`${ok ? 'PASS' : 'FAIL'}  [${area}] ${name}${!ok && detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`) }

const db = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
await db.connect()

// 스냅샷 — csat_ec 표 전부(행 md5) · 학습자 표 개수 · 스키마 객체 · 봉인 해시
const EC = ['csat_ec_taxonomy_version', 'csat_ec_code', 'csat_ec_boundary', 'csat_ec_boundary_signal', 'csat_ec_ai_run', 'csat_ec_claim', 'csat_ec_review_round',
  'csat_ec_review_assignment', 'csat_ec_judgment', 'csat_ec_session_confirmation', 'csat_ec_process_evidence']
const snapshot = async () => {
  const s = {}
  for (const t of EC) s[t] = (await db.query(`select count(*)::int n, md5(coalesce(string_agg(to_jsonb(x)::text, chr(10) order by to_jsonb(x)::text), '')) h from public.${t} x`)).rows[0]
  s.learner = (await db.query(`select (select count(*) from public.csat_dx_session)::int s, (select count(*) from public.csat_dx_response)::int r`)).rows[0]
  s.schema = (await db.query(`select
      (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and proname like 'csat\\_ec\\_%')::int fn,
      (select md5(string_agg(md5(pg_get_functiondef(p.oid)), '' order by p.oid::regprocedure::text)) from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and proname like 'csat\\_ec\\_%') fn_h,
      (select count(*) from pg_policy where polrelid::regclass::text like 'csat\\_ec\\_%')::int pol,
      (select count(*) from pg_trigger where not tgisinternal and tgrelid::regclass::text like 'csat\\_ec\\_%')::int trg,
      (select count(*) from pg_constraint where conrelid::regclass::text like 'csat\\_ec\\_%')::int con`)).rows[0]
  s.sealed = (await db.query(`select json_object_agg(version, definitions_hash order by version) j from public.csat_ec_taxonomy_version`)).rows[0].j
  return s
}

let before, inTx
try {
  if ((await db.query(`select 1 from public.csat_ec_taxonomy_version where version = $1`, [V])).rowCount) throw new Error(`${V} 가 이미 있다 — dry-run 대상이 아니다`)
  const admin = (await db.query(`select p.user_id from public.user_profiles p join auth.users u on u.id = p.user_id where p.role = 'admin' order by u.created_at limit 1`)).rows[0]?.user_id
  if (!admin) throw new Error('개발 DB 에 관리자 계정이 없다 — 봉인 RPC 를 관리자 경로로 부를 수 없다')
  before = await snapshot()
  const expectedWrites = { taxonomy_version: 1, code: rows.codes.length, boundary: rows.boundaries.length, seal_update: 1 }

  await db.query('begin')
  inTx = true
  const w = { taxonomy_version: 0, code: 0, boundary: 0, seal_update: 0 }
  w.taxonomy_version += (await db.query(`insert into public.csat_ec_taxonomy_version (version, note) values ($1, $2)`, [V, rows.taxonomy.note])).rowCount
  for (const c of rows.codes)
    w.code += (await db.query(`insert into public.csat_ec_code (version, code, axis, label, definition, inclusion, exclusion, student_group, status) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [V, c.code, c.axis, c.label, c.definition, c.inclusion, c.exclusion, c.student_group, c.status])).rowCount
  for (const b of rows.boundaries)
    w.boundary += (await db.query(`insert into public.csat_ec_boundary (version, boundary_key, code_a, code_b, status, probe_key, decision_note, provenance) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [V, b.boundary_key, b.code_a, b.code_b, b.status, b.probe_key, b.decision_note, b.provenance])).rowCount

  // 봉인 — 앱과 같은 관리자 RPC 경로(authenticated + 관리자 JWT)
  await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: admin, role: 'authenticated' })])
  await db.query(`set local role authenticated`)
  const seal = (await db.query(`select public.csat_ec_taxonomy_seal($1) h`, [V])).rows[0].h
  await db.query(`reset role`)
  w.seal_update = (await db.query(`select count(*)::int n from public.csat_ec_taxonomy_version where version = $1 and status = 'sealed' and definitions_hash = $2`, [V, seal])).rows[0].n
  record('write', '예상 write 수 = 실제(버전 1 · 코드 19 · 경계 1 · 봉인 1)', JSON.stringify(w) === JSON.stringify(expectedWrites), { expected: expectedWrites, actual: w })

  const recompute = (await db.query(`select encode(extensions.digest(
      (select string_agg(to_jsonb(c)::text, chr(10) order by c.code) from public.csat_ec_code c where c.version = $1)
      || chr(10) || '--boundaries--' || chr(10)
      || (select string_agg((to_jsonb(b) - 'created_at')::text, chr(10) order by b.boundary_key) from public.csat_ec_boundary b where b.version = $1), 'sha256'), 'hex') h`, [V])).rows[0].h
  record('hash', '봉인 해시 = 코드 + 경계 재계산(경계가 해시에 반영됨)', seal === recompute, { seal, recompute })
  const noBoundary = (await db.query(`select encode(extensions.digest((select string_agg(to_jsonb(c)::text, chr(10) order by c.code) from public.csat_ec_code c where c.version = $1), 'sha256'), 'hex') h`, [V])).rows[0].h
  record('hash', '경계를 뺀 해시와 다름(경계 변경이 해시를 바꾼다)', seal !== noBoundary)
  const midSealed = (await db.query(`select json_object_agg(version, definitions_hash order by version) j from public.csat_ec_taxonomy_version where version <> $1`, [V])).rows[0].j
  record('보존', '트랜잭션 안에서도 기존 봉인 해시(v99.0 · v99.1) 불변', JSON.stringify(midSealed) === JSON.stringify(before.sealed), { before: before.sealed, mid: midSealed })

  // 봉인 뒤 불변 — 코드 · 경계 수정 거부(savepoint 로 격리)
  const refused = async (sql, args) => { await db.query('savepoint s'); try { await db.query(sql, args); await db.query('release savepoint s'); return null } catch (e) { await db.query('rollback to savepoint s'); return e.message } }
  record('봉인', '봉인 뒤 경계 수정 거부', /봉인/.test(await refused(`update public.csat_ec_boundary set status = 'accepted', probe_key = null where version = $1`, [V]) ?? ''))
  record('봉인', '봉인 뒤 코드 수정 거부', !!(await refused(`update public.csat_ec_code set status = 'deprecated' where version = $1 and code = 'V.wrong_sense'`, [V])))
  record('봉인', '봉인 뒤 경계 추가 거부', /봉인/.test(await refused(`insert into public.csat_ec_boundary (version, boundary_key, code_a, code_b, status, decision_note) values ($1, 'r.main_point__v.unknown_word', 'R.main_point', 'V.unknown_word', 'accepted', 'x')`, [V]) ?? ''))

  // RPC · RLS 경로 — 학습자(authenticated) 사전 읽기 · AI(service_role) 사전
  await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: '00000000-0000-0000-0000-000000000000', role: 'authenticated' })])
  await db.query(`set local role authenticated`)
  const asLearner = (await db.query(`select (select count(*) from public.csat_ec_code where version = $1)::int codes,
      (select json_agg(json_build_object('k', boundary_key, 's', status, 'p', probe_key)) from public.csat_ec_boundary where version = $1) b`, [V])).rows[0]
  const sigDenied = await refused(`select 1 from public.csat_ec_boundary_signal limit 1`, [])
  await db.query(`reset role`)
  record('RLS', '로그인 사용자 — v0.1 코드 19 · 경계 정의 읽기', asLearner.codes === 19 && asLearner.b?.length === 1 && asLearner.b[0].s === 'provisional' && asLearner.b[0].p === 'r6_derivation_probe', asLearner)
  record('RLS', '로그인 사용자 — 경계 관찰 표 직접 읽기 거부', /permission denied/.test(sigDenied ?? ''), sigDenied)
  await db.query(`set local role service_role`)
  const aiTax = (await db.query(`select public.csat_ec_ai_taxonomy($1) j`, [V])).rows[0].j
  const svcCode = await refused(`select 1 from public.csat_ec_code limit 1`, [])
  await db.query(`reset role`)
  record('RPC', 'ai_taxonomy(service_role) — V/S/R/E 14코드 · 경계 1(provisional · probe) · 봉인 해시', aiTax?.codes?.length === 14 && aiTax.codes.every((c) => 'VSRE'.includes(c.axis))
    && aiTax.boundaries.length === 1 && aiTax.boundaries[0].status === 'provisional' && aiTax.definitions_hash === seal, aiTax && { codes: aiTax.codes.length, b: aiTax.boundaries })
  record('RPC', 'service_role — 코드 표 직접 읽기 거부(RPC 로만)', /permission denied/.test(svcCode ?? ''), svcCode)
  const groups = (await db.query(`select json_object_agg(g, n) j from (select student_group g, count(*)::int n from public.csat_ec_code where version = $1 and student_group is not null group by 1) x`, [V])).rows[0].j
  record('학생 범주', '학생 범주 6개 모두 대응 코드 있음(학생 범주 보고 경로가 막히지 않음)', ['word', 'sentence', 'flow', 'evidence', 'choice', 'time'].every((g) => groups?.[g] > 0), groups)
  const cand = (await db.query(`select count(*)::int n from public.csat_ec_code where version = $1 and status = 'active' and code = any($2)`, [V, ['R.inference', 'V.wrong_sense']])).rows[0].n
  record('후보', 'candidate_codes 로 쓸 R6 두 코드가 v0.1 에 active 로 존재(판정 가드가 받는 조건)', cand === 2)
  const trg = (await db.query(`select count(*)::int n from pg_trigger g join pg_proc p on p.oid = g.tgfoid where not tgisinternal
      and tgrelid in ('public.csat_ec_taxonomy_version'::regclass, 'public.csat_ec_code'::regclass, 'public.csat_ec_boundary'::regclass) and p.proname not like 'csat\\_ec\\_%'`)).rows[0].n
  record('Learning Map', 'seed 대상 표에 csat_ec 밖 트리거 없음(학습 지도로 번지지 않음)', trg === 0, trg)
} catch (e) {
  record('실행', '예외', false, e.message)
} finally {
  if (inTx) await db.query('rollback').catch((e) => record('실행', 'ROLLBACK', false, e.message))
  if (before) {
    const after = await snapshot()
    const diff = Object.keys(before).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]))
    record('rollback', 'ROLLBACK 뒤 스냅샷 = 시작 전(csat_ec 11표 행 해시 · 학습자 표 · 함수 정의 · 정책 · 트리거 · 제약 · 봉인 해시)', diff.length === 0, diff)
    record('rollback', `${V} 가 남지 않음`, (await db.query(`select count(*)::int n from public.csat_ec_taxonomy_version where version = $1`, [V])).rows[0].n === 0)
  }
  await db.end()
  const fail = results.filter((r) => !r.ok)
  fs.writeFileSync(path.join(CB_DATA, 'seed-v0.1-dryrun.json'), JSON.stringify({ ranAt: '2026-10-05', version: V, validation: validation.status, pass: results.length - fail.length, fail: fail.length, results }, null, 1) + '\n')
  console.log(`\n합계 PASS ${results.length - fail.length} · FAIL ${fail.length} (정적 검증 ${validation.status})`)
  process.exitCode = fail.length ? 1 : 0
}
