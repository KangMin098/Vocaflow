// scripts/lcp/apply-migration.mjs
//
// Supabase Management API 로 마이그레이션 SQL 적용 (MCP/CLI 부재 세션용 폴백).
//   자격: apps/web/.env.local 의 SUPABASE_ACCESS_TOKEN (Personal Access Token, sbp_…).
//   project ref: NEXT_PUBLIC_SUPABASE_URL(https://<ref>.supabase.co) 에서 자동 추출.
//
//     node scripts/lcp/apply-migration.mjs supabase/migrations/20260808120000_comic_pipeline.sql
//
//   토큰이 없으면 실행 방법을 안내하고 종료(무해).

import fs from 'node:fs'
import path from 'node:path'

const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
  }
}

const token = process.env['SUPABASE_ACCESS_TOKEN']
const url = process.env['NEXT_PUBLIC_SUPABASE_URL'] || ''
const ref = (url.match(/https?:\/\/([a-z0-9]+)\.supabase\.co/i) || [])[1] || 'jajenrevcbmrpaliomxv'
const file = process.argv[2]

if (!file) { console.error('usage: node scripts/lcp/apply-migration.mjs <sql-file>'); process.exit(2) }
if (!fs.existsSync(file)) { console.error(`파일 없음: ${file}`); process.exit(2) }

if (!token) {
  console.error('✗ SUPABASE_ACCESS_TOKEN 미설정.')
  console.error('  1) Supabase 대시보드 → Account → Access Tokens → 토큰 생성(sbp_…)')
  console.error('  2) apps/web/.env.local 에 한 줄 추가:  SUPABASE_ACCESS_TOKEN=sbp_xxx')
  console.error('  3) 다시 실행. (끝나면 토큰 폐기 권장 · .env.local 은 git 미추적)')
  process.exit(1)
}

const sql = fs.readFileSync(file, 'utf8')
console.error(`▶ 적용 대상: ${path.basename(file)} · project ${ref} · ${sql.length} bytes`)

const r = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: sql }),
})
const text = await r.text()
if (!r.ok) {
  console.error(`✗ 적용 실패 (${r.status})`)
  console.error(text.slice(0, 800))
  process.exit(1)
}
console.error('✓ 적용 완료.')
try { const j = JSON.parse(text); if (Array.isArray(j) && j.length) console.error(JSON.stringify(j).slice(0, 400)) } catch { /* 빈 결과 정상 */ }
