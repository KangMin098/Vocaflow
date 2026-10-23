// scripts/research/goal-data/d2-export.mjs
//
// D2 배치 입력 내보내기(읽기 전용 · DB 에 쓰지 않는다). 원문 · 선지 · 정답은 local/(git 제외)에만.
//   node --tls-max-v1.2 --env-file=<메인 apps/web/.env.local> scripts/research/goal-data/d2-export.mjs <batch>
// 배치 정의는 BATCHES 에 고정(무작위 없음). 이미 local/<batch>/input.json 이 있으면 덮어쓰지 않는다(선정 동결).
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..')
const LOCAL = path.join(ROOT, 'scripts/research/goal-data/local')
const KEY_TYPES = [22, 23, 29, 31, 32, 33, 34, 36, 37, 38, 39, 40]
export const BATCHES = {
  // 1차 표본(2026 수능 · M2706)과 겹치지 않는 직전 평가원 시험 — v2 규칙이 다른 시험에서도 일치를 올리는지 확인
  'b2-v2': { rule: 'M2609 독해 18–45 전 28 + 2025 수능 핵심 유형 12(22·23·29·31–34·36–40)', ids: [...Array.from({ length: 28 }, (_, k) => `M2609#${18 + k}`), ...KEY_TYPES.map((n) => `2025#${n}`)] },
}
const batch = process.argv[2]
const def = BATCHES[batch]
if (!def) throw new Error(`배치 이름: ${Object.keys(BATCHES).join(' | ')}`)
const OUT = path.join(LOCAL, batch, 'input.json')
if (fs.existsSync(OUT)) throw new Error(`${path.relative(ROOT, OUT)} 가 이미 있다 — 선정은 동결이다`)
const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL, KEY = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!String(URL_).includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const sha = (v) => crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex')
async function get(table, select, ids) {
  const list = ids.map((i) => `"${i}"`).join(',')
  const res = await fetch(`${URL_}/rest/v1/${table}?select=${encodeURIComponent(select)}&${table === 'csat_items' ? 'id' : 'item_id'}=in.(${encodeURIComponent(list)})`, { headers: { apikey: KEY, Authorization: `Bearer ${KEY}` } })
  if (!res.ok) throw new Error(`${table}: ${res.status} ${await res.text()}`)
  return res.json()
}
const items = await get('csat_items', 'id,exam_id,no,type_id,stem,passage,choices,answer,answers,points,body_ok', def.ids)
const analyses = await get('csat_item_analyses', 'item_id,version,status,measured_ability,design_intent,answer_locus,choice_analysis,solve_procedure,difficulty', def.ids)
const traps = await get('csat_dx_option_trap', '*', def.ids)
const byId = new Map(items.map((i) => [i.id, i]))
const missing = def.ids.filter((id) => !byId.has(id))
if (missing.length) throw new Error(`없는 문항: ${missing.join(', ')}`)
const bad = items.filter((i) => !i.body_ok || !Array.isArray(i.choices) || !(i.answers?.length || i.answer != null))
if (bad.length) throw new Error(`분석 부적격(D1 결손): ${bad.map((i) => i.id).join(', ')}`)
const latest = new Map()
for (const a of analyses) if (!latest.has(a.item_id) || latest.get(a.item_id).version < a.version) latest.set(a.item_id, a)
const rows = def.ids.map((id) => {
  const i = byId.get(id), a = latest.get(id) ?? null
  const source = { stem: i.stem, passage: i.passage, choices: i.choices, answer: i.answer, answers: i.answers, points: i.points }
  return { item_id: id, exam_id: i.exam_id, no: i.no, type_id: i.type_id, body_ok: i.body_ok, source, source_sha256: sha(source), analysis: a, analysis_sha256: a ? sha(a) : null, traps: traps.filter((t) => t.item_id === id) }
})
fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, JSON.stringify({ batch, rule: def.rule, generated_at: new Date().toISOString(), rows }, null, 1))
const selection = { batch, rule: def.rule, items: rows.map((r) => ({ item_id: r.item_id, type_id: r.type_id, source_sha256: r.source_sha256, analysis_version: r.analysis?.version ?? null, analysis_status: r.analysis?.status ?? null, analysis_sha256: r.analysis_sha256 })) }
const SEL = path.join(ROOT, 'docs/research/goal-data-batches/D2-task-mapping', `${batch}-selection.json`)
fs.mkdirSync(path.dirname(SEL), { recursive: true })
fs.writeFileSync(SEL, JSON.stringify({ ...selection, selection_sha256: sha(selection.items) }, null, 1) + '\n')
console.log(`${batch}: 문항 ${rows.length} · 분석 ${rows.filter((r) => r.analysis).length} → ${path.relative(ROOT, OUT)}`)
