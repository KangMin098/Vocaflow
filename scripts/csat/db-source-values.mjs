// library_articles.source 의 **실제 값**을 센다. 읽기 전용.
//
// ⚠️ CHECK 제약 목록을 손으로 다시 적으면 안 된다 — 2026-09-05 에 그렇게 했다가
//    다른 세션이 적재한 gutenberg 31,543편이 제약을 어겨 VALIDATE 가 실패했다.
//    **지금 쓰이는 값을 먼저 세고**, 거기에 새 값만 더한다.
import fs from 'node:fs'
import path from 'node:path'
for (const line of fs.readFileSync(path.resolve('apps/web/.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].trim().replace(/^["']|["']$/g, '')
}
const { createClient } = await import('@supabase/supabase-js')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false },
})
const seen = new Map()
let from = null
for (;;) {
  let q = db.from('library_articles').select('id, source').order('id').limit(1000)
  if (from) q = q.gt('id', from)
  const { data, error } = await q
  if (error) throw new Error(error.message)
  if (!data?.length) break
  for (const r of data) seen.set(r.source, (seen.get(r.source) ?? 0) + 1)
  from = data.at(-1).id
  if (data.length < 1000) break
}
const rows = [...seen.entries()].sort((a, b) => b[1] - a[1])
console.log('실제 쓰이는 source 값', rows.length, '종')
for (const [k, v] of rows) console.log('  ' + String(k).padEnd(20), v.toLocaleString())
console.log('\n합계', rows.reduce((a, r) => a + r[1], 0).toLocaleString())
console.log('\nARRAY 리터럴 (마이그레이션에 그대로 쓸 것):')
console.log(rows.map(([k]) => `'${k}'`).join(', '))
