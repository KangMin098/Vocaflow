// scripts/db/apply-approved-sql.mjs
//
// 사용자가 승인한 SQL 파일 하나를 **승인된 sha256 과 정확히 같을 때만** 개발 DB 에 실행한다(2026-10-08).
// 앞뒤로 DB 체크포인트(record_db_health_checkpoint)를 남기고 diff 요약을 출력한다(/db-checkpoint 절차).
// 파일이 한 글자라도 바뀌었으면 실행하지 않는다 — 승인은 그 해시에 대한 것이다.
//   node --tls-max-v1.2 --env-file=<.env.local> scripts/db/apply-approved-sql.mjs <file.sql> <sha256> <checkpoint-label> [--pg <pg 모듈 경로>] [--ca <CA 파일>]
import crypto from 'node:crypto'
import fs from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

const [file, sha, label] = process.argv.slice(2)
const opt = (k, d) => (process.argv.includes(k) ? process.argv[process.argv.indexOf(k) + 1] : d)
if (!file || !sha || !label) throw new Error('사용: apply-approved-sql.mjs <file.sql> <sha256> <checkpoint-label>')
const url = process.env.SUPABASE_DB_URL
if (!url) throw new Error('SUPABASE_DB_URL 없음')
if (!url.includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다 — 멈춘다')
const sql = fs.readFileSync(file, 'utf8')
const got = crypto.createHash('sha256').update(sql).digest('hex')
if (got !== sha) throw new Error(`sha256 불일치 — 승인 ${sha} · 파일 ${got}. 실행하지 않는다`)

const pgDir = opt('--pg', 'D:/workspace/Vocaflow-ec-smoke/scripts/csat/error-evidence/isolated-pg/node_modules')
const { Client } = createRequire(path.join(pgDir, 'x.js'))('pg')
const ca = opt('--ca', 'D:/workspace/Vocaflow-ec-reveal/tmp/reveal-db-deployment/supabase-ca.crt')
const client = new Client({ connectionString: url.replace(/[?&]sslmode=[^&]*/, ''), ssl: { ca: fs.readFileSync(ca, 'utf8'), rejectUnauthorized: true } })
await client.connect()
try {
  await client.query('select record_db_health_checkpoint($1, $2, $3)', [label, 'before', `apply ${path.basename(file)} sha ${sha.slice(0, 12)}`])
  await client.query(sql)
  await client.query('select record_db_health_checkpoint($1, $2, $3)', [label, 'after', `applied ${path.basename(file)}`])
  const diff = await client.query("select metric, subject, status, before_value, after_value from db_health_checkpoint_diff($1) where status <> 'same' order by status limit 20", [label])
  console.log(`적용 완료 · ${path.basename(file)} · sha ${sha}`)
  console.log(JSON.stringify(diff.rows))
} finally {
  await client.end()
}
