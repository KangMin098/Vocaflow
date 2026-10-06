// scripts/db/apply-migration.mjs
//
// 승인된 마이그레이션 한 개를 개발 DB 에 원문 그대로 적용 + schema_migrations 기록(한 트랜잭션). 접속 문자열은 출력하지 않는다.
// 안전장치: ① --sha 로 넘긴 해시와 파일 해시가 다르면 중단(리뷰한 파일만) ② 이미 기록된 버전이면 중단
//          ③ --expect-def <regprocedure>=<md5> 로 적용 직전 live 정의가 생성 당시와 같은지 확인(다르면 누가 바꾼 것 — 중단)
// 실행: node --tls-max-v1.2 --env-file=<apps/web/.env.local> scripts/db/apply-migration.mjs <file> --sha <sha256> [--expect-def 'public.f(uuid)=<md5>']
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { createRequire } from 'node:module'
const pg = createRequire(path.resolve('scripts/csat/error-evidence/isolated-pg/package.json'))('pg')

const file = process.argv[2]
const arg = (k) => { const i = process.argv.indexOf(k); return i > 0 ? process.argv[i + 1] : null }
const sha = crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex')
if (sha !== arg('--sha')) { console.log(`중단: 파일 해시 ${sha} ≠ 승인 해시 ${arg('--sha')}`); process.exit(1) }
const m = path.basename(file).match(/^(\d{14})_(.+)\.sql$/)
if (!m) { console.log('중단: 파일 이름이 <version>_<name>.sql 이 아니다'); process.exit(1) }
const [, version, name] = m
// 파일의 최상위 begin; … commit; 한 쌍은 떼고 스크립트가 트랜잭션을 잡는다(적용 + 이력 기록을 한 트랜잭션에). 해시는 원본 파일로 검사했다
const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/)
const bi = lines.findIndex((l) => /^\s*begin\s*;\s*$/i.test(l))
const ci = lines.findLastIndex((l) => /^\s*commit\s*;\s*$/i.test(l))
if ((bi < 0) !== (ci < 0) || lines.filter((l) => /^\s*(begin|commit)\s*;\s*$/i.test(l)).length > (bi < 0 ? 0 : 2)) { console.log('중단: begin/commit 짝이 하나가 아니다'); process.exit(1) }
const body = (bi < 0 ? lines : lines.filter((_, i) => i !== bi && i !== ci)).join('\n')

const c = new pg.Client({ connectionString: process.env.SUPABASE_DB_URL, ssl: { rejectUnauthorized: false } })
await c.connect()
try {
  await c.query('begin')
  await c.query(`set local lock_timeout = '5s'`)
  if ((await c.query(`select 1 from supabase_migrations.schema_migrations where version = $1`, [version])).rowCount) throw new Error(`${version} 이미 기록돼 있다`)
  const exp = arg('--expect-def')
  if (exp) {
    const [proc, md5] = exp.split('=')
    const live = (await c.query(`select md5(pg_get_functiondef($1::regprocedure)) h`, [proc])).rows[0].h
    if (live !== md5) throw new Error(`live 정의가 생성 당시와 다르다(${proc} ${live} ≠ ${md5})`)
  }
  await c.query(body)
  await c.query(`insert into supabase_migrations.schema_migrations (version, name, statements) values ($1, $2, array[$3])`, [version, name, body])
  await c.query('commit')
  console.log(`APPLIED ${version}_${name} sha256 ${sha}`)
} catch (e) {
  await c.query('rollback').catch(() => {})
  console.log('ROLLED BACK:', e.message)
  process.exitCode = 1
} finally { await c.end() }
