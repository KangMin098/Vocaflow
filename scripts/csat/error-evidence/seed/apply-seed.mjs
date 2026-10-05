// scripts/csat/error-evidence/seed/apply-seed.mjs
//
// v0.1 conditional seed — 개발 DB **실제 적용**(사용자 조건부 승인 2026-10-05). dryrun-seed.mjs 와 같은 입력 · 같은 순서.
// 다음 중 하나라도 어긋나면 COMMIT 하지 않고 ROLLBACK 한다:
//   정적 검증 PASS 아님 · dry-run PASS 아님 · 이미 v0.1 있음 · write 수 ≠ 예상 · 봉인 해시 ≠ dry-run 해시 · 기존 봉인 해시(v99.*) 변화 · 학습 기록 수 변화
// 결과: docs/csat-learner/codebook/data/seed-v0.1-apply.json
//
//   node --tls-max-v1.2 --env-file=<apps/web/.env.local> scripts/csat/error-evidence/seed/apply-seed.mjs

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
const dryrun = JSON.parse(fs.readFileSync(path.join(CB_DATA, 'seed-v0.1-dryrun.json'), 'utf8'))
if (validation.status !== 'PASS') { console.error(`정적 검증 ${validation.status} — 적용하지 않는다`); process.exit(1) }
if (dryrun.fail !== 0 || dryrun.validation !== 'PASS') { console.error('dry-run 이 PASS(정적 검증 PASS 기준)가 아니다 — 적용하지 않는다'); process.exit(1) }
const DRY_HASH = dryrun.results.find((r) => r.area === 'hash' && r.detail?.seal)?.detail.seal
const V = rows.taxonomy.version
const EXPECTED = { taxonomy_version: 1, code: rows.codes.length, boundary: rows.boundaries.length, seal_update: 1 }

const db = new pg.Client({ connectionString: DB_URL, ssl: { rejectUnauthorized: false } })
await db.connect()
const out = { ranAt: new Date().toISOString(), version: V, expected: EXPECTED, dry_run_hash: DRY_HASH }
const sealedOthers = async () => (await db.query(`select json_object_agg(version, definitions_hash order by version) j from public.csat_ec_taxonomy_version where version <> $1`, [V])).rows[0].j
const learner = async () => (await db.query(`select (select count(*) from public.csat_dx_session)::int s, (select count(*) from public.csat_dx_response)::int r,
  (select count(*) from public.csat_ec_process_evidence)::int pe, (select count(*) from public.csat_ec_review_round)::int rounds, (select count(*) from public.csat_ec_judgment)::int j`)).rows[0]
let inTx = false
try {
  if ((await db.query(`select 1 from public.csat_ec_taxonomy_version where version = $1`, [V])).rowCount) throw new Error(`${V} 가 이미 있다 — 다시 넣지 않는다`)
  const admin = (await db.query(`select p.user_id from public.user_profiles p join auth.users u on u.id = p.user_id where p.role = 'admin' order by u.created_at limit 1`)).rows[0]?.user_id
  if (!admin) throw new Error('관리자 계정 없음')
  const othersBefore = await sealedOthers(), learnerBefore = await learner()
  await db.query('begin'); inTx = true
  const w = { taxonomy_version: 0, code: 0, boundary: 0, seal_update: 0 }
  w.taxonomy_version += (await db.query(`insert into public.csat_ec_taxonomy_version (version, note) values ($1, $2)`, [V, rows.taxonomy.note])).rowCount
  for (const c of rows.codes)
    w.code += (await db.query(`insert into public.csat_ec_code (version, code, axis, label, definition, inclusion, exclusion, student_group, status) values ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [V, c.code, c.axis, c.label, c.definition, c.inclusion, c.exclusion, c.student_group, c.status])).rowCount
  for (const b of rows.boundaries)
    w.boundary += (await db.query(`insert into public.csat_ec_boundary (version, boundary_key, code_a, code_b, status, probe_key, decision_note, provenance) values ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [V, b.boundary_key, b.code_a, b.code_b, b.status, b.probe_key, b.decision_note, b.provenance])).rowCount
  await db.query(`select set_config('request.jwt.claims', $1, true)`, [JSON.stringify({ sub: admin, role: 'authenticated' })])
  await db.query(`set local role authenticated`)
  const seal = (await db.query(`select public.csat_ec_taxonomy_seal($1) h`, [V])).rows[0].h
  await db.query(`reset role`)
  w.seal_update = (await db.query(`select count(*)::int n from public.csat_ec_taxonomy_version where version = $1 and status = 'sealed' and definitions_hash = $2`, [V, seal])).rows[0].n
  out.actual = w; out.seal = seal
  const othersMid = await sealedOthers(), learnerMid = await learner()
  const problems = []
  if (JSON.stringify(w) !== JSON.stringify(EXPECTED)) problems.push('write 수 ≠ 예상')
  if (seal !== DRY_HASH) problems.push(`봉인 해시 ${seal} ≠ dry-run ${DRY_HASH}`)
  if (JSON.stringify(othersMid) !== JSON.stringify(othersBefore)) problems.push('기존 봉인 해시 변화')
  if (JSON.stringify(learnerMid) !== JSON.stringify(learnerBefore)) problems.push('학습 기록 · 회차 · 증거 · 판정 수 변화')
  if (problems.length) { await db.query('rollback'); inTx = false; out.status = 'ROLLED_BACK'; out.problems = problems; console.log('ROLLED BACK:', problems.join(' · ')); process.exitCode = 1 }
  else { await db.query('commit'); inTx = false; out.status = 'COMMITTED'; console.log('COMMITTED', V, seal) }
} catch (e) {
  if (inTx) await db.query('rollback').catch(() => {})
  out.status = 'ERROR'; out.error = e.message; console.log('ERROR (ROLLED BACK):', e.message); process.exitCode = 1
} finally {
  await db.end()
  fs.writeFileSync(path.join(CB_DATA, 'seed-v0.1-apply.json'), JSON.stringify(out, null, 1) + '\n')
}
