// scripts/dict/sense-progress.mjs
// 멀티세션 sense 완성 진행률 스냅샷 한 줄 출력 (모니터링 폴링용).
//   전체 다중-sense 수 + 오늘 갱신 수 + V-Level별 % 압축.
import fs from 'node:fs'
import path from 'node:path'
const envPath = path.resolve('apps/web/.env.local')
if (fs.existsSync(envPath)) for (const line of fs.readFileSync(envPath, 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/); if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env['NEXT_PUBLIC_SUPABASE_URL'], process.env['SUPABASE_SERVICE_ROLE_KEY'], { auth: { persistSession: false } })

let total = 0, today = 0
const per = {}
let cursor = ''
for (;;) {
  const { data: rows, error } = await db.from('shared_dictionary')
    .select('word, v_level, meanings_ko, updated_at')
    .in('pos', ['noun', 'verb', 'adjective']).not('classified_by', 'is', null)
    .gt('word', cursor).order('word', { ascending: true }).limit(1000)
  if (error) { console.error('ERR', error.message); process.exit(1) }
  if (!rows.length) break
  for (const r of rows) {
    if (!/^[a-z]+$/.test(r.word) || /ing$/.test(r.word)) continue
    per[r.v_level] ??= { c: 0, m: 0 }
    per[r.v_level].c++
    if (Array.isArray(r.meanings_ko) && r.meanings_ko.length >= 2) {
      per[r.v_level].m++; total++
      if ((r.updated_at || '').slice(0, 10) === '2026-07-13') today++
    }
  }
  cursor = rows[rows.length - 1].word
  if (rows.length < 1000) break
}
const now = new Date().toISOString().slice(11, 16)
const pcts = Object.keys(per).sort((a, b) => a - b).map((v) => `V${v}:${(100 * per[v].m / per[v].c).toFixed(0)}`).join(' ')
process.stdout.write(`${now} multi=${total} today=${today} | ${pcts}\n`)
process.exit(0)
