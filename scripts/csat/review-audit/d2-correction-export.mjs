// scripts/csat/review-audit/d2-correction-export.mjs
//
// **D2 교정 청크 export(읽기 전용).** 기존 분석을 «다시 쓰지 않고» 결함 부분만 고치기 위한 입력을 만든다.
// analysis-drain-export 는 로컬 코퍼스(corpus-hakpyeong.json)를 원문으로 쓰는데 이 워크트리엔 없고, 있어도 DB 보다
// 낡을 수 있다 — 여기서는 **DB 원문을 그대로** 싣고, 근거 단위는 같은 loadVerifiedExportUnits 로 앞뒤 대조한다.
//
// 산출(analysis-drain-hakpyeong/, gitignore):
//   chunk-<name>.json            import 가 읽는 입력(원문·정답 해시·현재 근거 단위)
//   chunk-<name>.out.seed.json   현재 최신 분석을 out 모양으로 옮긴 씨앗 — 작성자가 고친 뒤 .out.json 으로 저장한다
//                                (씨앗을 그대로 .out.json 으로 두면 «변경 없음» 으로 옛 행을 재사용하니 import 해도 무의미)
// 사용: node --tls-max-v1.2 scripts/csat/review-audit/d2-correction-export.mjs <env> --chunk <name> --items H..#..,H..#..
import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { exportAnswerHash, loadVerifiedExportUnits, unitsForAgent } from '../lib-units-db.mjs'
import { precheckAnalysis } from '../lib-evidence-units.mjs'

const arg = (n) => { const i = process.argv.indexOf(`--${n}`); return i >= 0 ? process.argv[i + 1] : null }
const envFile = process.argv[2]
const name = arg('chunk'), items = (arg('items') ?? '').split(',').filter(Boolean)
if (!envFile || !name || !/^[a-z0-9-]+$/.test(name) || !items.length) throw new Error('usage: <env> --chunk <name> --items <id,...>')
const env = Object.fromEntries(fs.readFileSync(envFile, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')] }))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: src, error } = await db.from('csat_items').select('id,type_id,passage,stem,choices,answer,answers').in('id', items)
if (error) throw new Error(error.message)
if (src.length !== items.length) throw new Error(`문항 ${items.length - src.length}개를 못 찾았다`)
const types = new Set(src.map((r) => r.type_id))
const units = await loadVerifiedExportUnits(db, src)
const { data: an, error: ae } = await db.from('csat_item_analyses').select('*').in('item_id', items).order('item_id').order('version', { ascending: false })
if (ae) throw new Error(ae.message)
const latest = new Map(); for (const a of an) if (!latest.has(a.item_id)) latest.set(a.item_id, a)

const exportedAt = new Date().toISOString()
const chunk = {
  chunk: name, type_id: types.size === 1 ? [...types][0] : 'MIXED', type_name: 'D2 교정', count: src.length, exported_at: exportedAt,
  provenance: 'DB 원문(csat_items) · 근거 단위 csat_current_units_many — d2-correction-export',
  items: items.map((id) => {
    const r = src.find((x) => x.id === id), u = units.get(id)
    if (!u) throw new Error(`${id}: 현재 근거 단위 목록 없음 — 원문 수리 선행`)
    return { item_id: id, type_id: r.type_id, stem: r.stem, passage: r.passage, choices: r.choices, answer: r.answer, answers: r.answers,
      input_hash: u.input_hash, answer_hash: exportAnswerHash(r), units_version: u.units_version, units_hash: u.units_hash, units: unitsForAgent(u.units) }
  }),
}
const seed = {
  chunk: name, type_id: chunk.type_id, analyst_run: null,
  provenance_note: '현재 최신 분석에서 출발한 교정 — 결함 부분만 고친다. analyst_run 을 채운다(검수자와 달라야 한다).',
  analyses: items.map((id) => {
    const a = latest.get(id), u = units.get(id)
    const pc = precheckAnalysis(a, u.units)
    return { item_id: id, base_analysis_id: a.id, base_version: a.version, base_status: a.status, precheck_errors_before: pc.errors,
      analyst_run: null, revised: true, body_recovered: a.body_recovered === true, answer_unknown: a.answer_unknown === true,
      measured_ability: a.measured_ability, design_intent: a.design_intent, answer_locus: a.answer_locus, choices: a.choice_analysis,
      solve_procedure: a.solve_procedure, time_budget_sec: a.time_budget_sec, difficulty: a.difficulty, required_vocab: a.required_vocab,
      reviews: [], units_version: u.units_version, units_hash: u.units_hash }
  }),
}
const WORK = path.resolve('scripts/csat/analysis-drain-hakpyeong')
fs.mkdirSync(WORK, { recursive: true })
for (const f of [`chunk-${name}.json`, `chunk-${name}.out.json`]) if (fs.existsSync(path.join(WORK, f))) throw new Error(`${f} 가 이미 있다 — 덮지 않는다`)
fs.writeFileSync(path.join(WORK, `chunk-${name}.json`), JSON.stringify(chunk, null, 1))
fs.writeFileSync(path.join(WORK, `chunk-${name}.out.seed.json`), JSON.stringify(seed, null, 1))
for (const a of seed.analyses) console.log(`  ${a.item_id} v${a.base_version}(${a.base_status}) — ${a.precheck_errors_before.join(' · ') || '사전 검사 통과'}`)
console.log(`저장: analysis-drain-hakpyeong/chunk-${name}.json · .out.seed.json`)
