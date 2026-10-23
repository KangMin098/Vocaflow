// scripts/research/goal-data/insert-split-audit.mjs
//
// 삽입 문항(R-INSERT) 전체의 주어진 문장 분리 형식 집계(읽기 전용). d2-export.mjs insertSplit 과 같은 규칙을 쓴다.
//   node --tls-max-v1.2 --env-file=<메인 apps/web/.env.local> scripts/research/goal-data/insert-split-audit.mjs
import { insertSplit } from './insert-split.mjs'

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!String(URL_).includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const res = await fetch(`${URL_}/rest/v1/csat_items?select=id,exam_id,passage&type_id=eq.R-INSERT`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })
if (!res.ok) throw new Error(`csat_items: ${res.status}`)
const rows = await res.json()
const by = {}
for (const r of rows) { const s = insertSplit(r.passage); (by[s.confidence] ??= []).push(r.id) }
console.log(JSON.stringify({ total: rows.length, counts: Object.fromEntries(Object.entries(by).map(([k, v]) => [k, v.length])), uncertain: by.uncertain ?? [] }, null, 1))
