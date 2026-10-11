#!/usr/bin/env node
// scripts/csat/map/v4/export-asis.mjs
// 학습 지도 rev4.0 As-Is 감사용 스냅샷 — 개발 DB 의 지도 정의 테이블을 **읽기만** 해서 파일로 남긴다.
//   node --tls-max-v1.2 --env-file=<apps/web/.env.local> scripts/csat/map/v4/export-asis.mjs
// 출력: docs/csat-learner/v4/asis-snapshot.json (학습자 개인 기록은 개수만 — user_id 를 남기지 않는다)
// 재실행 안전: 파일을 통째로 다시 쓴다. DB 에 쓰지 않는다.
import fs from 'node:fs'
import path from 'node:path'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const req = createRequire(path.join(ROOT, 'apps/web/package.json'))
const { createClient } = req('@supabase/supabase-js')

if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

async function all(table, select, order) {
  const rows = []
  for (let from = 0; ; from += 1000) {
    let q = db.from(table).select(select).range(from, from + 999)
    for (const o of order) q = q.order(o)
    const { data, error } = await q
    if (error) throw new Error(`${table}: ${error.message}`)
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}

async function count(table) {
  const { count: n, error } = await db.from(table).select('*', { count: 'exact', head: true })
  if (error) throw new Error(`${table}: ${error.message}`)
  if (n == null) throw new Error(`${table}: count 없음`)
  return n
}

const snapshot = {
  generated_by: 'scripts/csat/map/v4/export-asis.mjs',
  project: 'jajenrevcbmrpaliomxv',
  nodes: await all('csat_map_node', 'code,kind,name,axis,track,summary,why,signal,sort,evidence_status', ['sort', 'code']),
  tasks: await all('csat_map_task', 'id,line_code,ord,title,how,cadence,done_when,material,method_line', ['line_code', 'ord']),
  edges: await all('csat_map_edge', 'id,from_code,to_code,kind,basis_claimed,basis', ['id']),
  line_links: await all('csat_map_line_link', 'line_code,link_kind,ref', ['line_code', 'link_kind', 'ref']),
  learner_counts: {
    csat_map_goal: await count('csat_map_goal'),
    csat_map_task_done: await count('csat_map_task_done'),
  },
}

const out = path.join(ROOT, 'docs/csat-learner/v4/asis-snapshot.json')
fs.mkdirSync(path.dirname(out), { recursive: true })
fs.writeFileSync(out, JSON.stringify(snapshot, null, 1) + '\n')
console.log(`nodes ${snapshot.nodes.length} · tasks ${snapshot.tasks.length} · edges ${snapshot.edges.length} · line_links ${snapshot.line_links.length} → ${path.relative(ROOT, out)}`)
