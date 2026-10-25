// 서비스 키(SUPABASE_SERVICE_ROLE_KEY) 사용 파일의 DB 쓰기 진입점 분류 — 읽기 전용 정적 조사
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const root = process.argv[2]
const files = execFileSync('git', ['-C', root, 'grep', '-l', 'SUPABASE_SERVICE_ROLE_KEY', '--', '*.mjs', '*.mts', '*.ts', '*.tsx', '*.js', '*.cjs'], { encoding: 'utf8', maxBuffer: 1 << 26 }).trim().split('\n').filter(Boolean)
const WRITE = /\.(insert|upsert|update|delete)\s*\(/
const RPC = /\.rpc\(\s*['"`]([a-z0-9_]+)/g
const DDL = /\b(create|alter|drop)\s+(table|function|policy|index|trigger|view|schema)\b/i
const writeRpc = /^(record_|apply_|publish_|approve_|reject_|insert_|update_|delete_|upsert_|set_|reset_|close_|capture_|enqueue|claim|complete|mark_|admin_|import_|ingest|refresh|sync_|seed|bulk|drain|promote|archive|restore|grant|revoke)/
const out = []
for (const f of files) {
  const src = fs.readFileSync(path.join(root, f), 'utf8')
  const rpcs = [...src.matchAll(RPC)].map((m) => m[1])
  const wr = WRITE.test(src) || rpcs.some((r) => writeRpc.test(r))
  const ddl = DDL.test(src) && /\.(sql|query)\(|execute_sql|pg\b/.test(src)
  const commitFlag = /--commit|--apply|--write|COMMIT\b/.test(src)
  let cls
  if (/(__tests__|\.test\.|\.spec\.|\/e2e\/|playwright|fixtures?\/|test-utils|tests\/)/.test(f)) cls = wr ? 'test-write' : 'test-read'
  else if (/^apps\/web\/src\/(app|lib|middleware|server)/.test(f)) cls = wr ? 'product-write' : 'product-read'
  else if (ddl) cls = 'schema'
  else if (wr) cls = commitFlag ? 'admin-write-gated' : 'admin-write-ungated'
  else cls = 'read-only'
  out.push({ f, cls, rpcs: [...new Set(rpcs)].slice(0, 6) })
}
const by = {}
for (const r of out) (by[r.cls] ??= []).push(r)
const dir = (f) => f.split('/').slice(0, f.startsWith('apps/web/') ? 3 : 2).join('/')
const summary = Object.fromEntries(Object.entries(by).map(([k, v]) => {
  const d = {}; for (const r of v) d[dir(r.f)] = (d[dir(r.f)] || 0) + 1
  return [k, { n: v.length, top_dirs: Object.entries(d).sort((a, b) => b[1] - a[1]).slice(0, 8) }]
}))
fs.writeFileSync(process.argv[3], JSON.stringify({ total: out.length, summary, files: out }, null, 1))
console.log(JSON.stringify({ total: out.length, summary }, null, 1))
