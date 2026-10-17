// scripts/csat/review-audit/verify-d0.mjs
// D0 확인(읽기 전용): 후속 조치 PK 커서 전량 · 유효 승인 묶음 호출이 PostgREST 8s 안에서 끝나는지 · 결과를 JSON 으로 출력.
// 비교 대상 SQL 집계는 MCP execute_sql 로 같은 시점에 따로 낸다.
import fs from 'node:fs'
import { createClient } from '@supabase/supabase-js'
import { validPersonasBatched } from '../lib-review-batching.mjs'

const envFile = process.argv[2]
const env = Object.fromEntries(fs.readFileSync(envFile, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')] }))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const q = (v) => `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
const after = (k) => [`item_id.gt.${q(k.item_id)}`, `and(item_id.eq.${q(k.item_id)},source.gt.${q(k.source)})`, `and(item_id.eq.${q(k.item_id)},source.eq.${q(k.source)},finding_key.gt.${q(k.finding_key)})`].join(',')

const out = {}
// 1) 후속 조치
const fu = []; const seen = new Set()
for (let a = null; ;) {
  let qq = db.from('csat_review_followups').select('item_id, source, finding_key, status')
  if (a) qq = qq.or(a)
  const { data, error } = await qq.order('item_id').order('source').order('finding_key').limit(1000)
  if (error) throw new Error(error.message)
  for (const r of data) { const k = JSON.stringify([r.item_id, r.source, r.finding_key]); if (seen.has(k)) throw new Error('dup ' + k); seen.add(k); fu.push(r) }
  if (data.length < 1000) break
  a = after(data[data.length - 1])
}
out.followups = { total: fu.length, open: fu.filter((r) => r.status === 'open').length }
// 2) 학평 최신 분석 전량 유효 승인
const an = []
for (let from = 0; ; from += 1000) {
  const { data, error } = await db.from('csat_item_analyses').select('id, item_id, version').like('item_id', 'H%').order('item_id').order('version', { ascending: false }).range(from, from + 999)
  if (error) throw new Error(error.message)
  an.push(...data); if (data.length < 1000) break
}
const latest = new Map(); for (const r of an) if (!latest.has(r.item_id)) latest.set(r.item_id, r.id)
const ids = [...latest.values()]
const t0 = Date.now()
const v = await validPersonasBatched(ids, (part) => db.rpc('csat_valid_review_personas_many', { p_analyses: part }))
if (v.error) throw new Error(v.error)
const n3 = v.rows.filter((r) => (r.personas ?? []).length >= 3).length
const hist = {}; for (const r of v.rows) { const k = (r.personas ?? []).length; hist[k] = (hist[k] ?? 0) + 1 }
out.valid = { analyses: ids.length, ms: Date.now() - t0, personasHistogram: hist, threeOfThree: n3 }
console.log(JSON.stringify(out))
