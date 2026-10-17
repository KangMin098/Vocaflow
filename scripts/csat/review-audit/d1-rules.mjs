// scripts/csat/review-audit/d1-rules.mjs
//
// **D1 보강 — 원문과 무관한 현재 규칙 전량 검사(읽기 전용).** d1-ledger 의 사전 검사(precheckAnalysis)는 validate 의
// 일부만 본다. V14 처럼 validate 안에만 있는 규칙이 발행 분석에 남아 있었다(2026-10-18 V12 교정 청크에서 3/12 적발).
// 여기서는 지문 대조가 필요 없는 규칙만 같은 함수로 다시 돌린다:
//   analysisRuleErrors(V10·V11·V12·V15 등, lib-analysis-rules) · V14(validate 363행과 같은 조건 — distractorsAreTrue)
// 인용 대조(V4)·창 대조는 로컬 원문 창이 필요해 여기서 하지 않는다(미검사로 보고한다).
// 사용: node --tls-max-v1.2 scripts/csat/review-audit/d1-rules.mjs <env>
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { analysisRuleErrors, distractorsAreTrue } from '../lib-analysis-rules.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const env = Object.fromEntries(fs.readFileSync(process.argv[2], 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')] }))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
async function all(q) { const rows = []; for (let f = 0; ; f += 1000) { const { data, error } = await q().range(f, f + 999); if (error) throw new Error(error.message); rows.push(...data); if (data.length < 1000) return rows } }

const items = new Map((await all(() => db.from('csat_items').select('id, type_id, stem, answer, answers').like('id', 'H%').order('id'))).map((r) => [r.id, r]))
const heads = await all(() => db.from('csat_item_analyses').select('id, item_id, version, status').like('item_id', 'H%').order('item_id').order('version', { ascending: false }))
const latest = new Map(); for (const a of heads) if (!latest.has(a.item_id)) latest.set(a.item_id, a)
const ids = [...latest.values()].map((a) => a.id)
const rows = []
for (let i = 0; i < ids.length; i += 200) {
  const { data, error } = await db.from('csat_item_analyses').select('id, item_id, version, status, measured_ability, design_intent, answer_locus, choice_analysis, solve_procedure, difficulty, answer_unknown').in('id', ids.slice(i, i + 200))
  if (error) throw new Error(error.message)
  rows.push(...data)
}
const out = []
for (const a of rows) {
  const it = items.get(a.item_id)
  const answerKnown = it.answer != null || (Array.isArray(it.answers) && it.answers.length > 0)
  const errs = analysisRuleErrors({ ...a, choices: a.choice_analysis }, { typeId: it.type_id, answerKnown })
  if (distractorsAreTrue(it.type_id, it.stem)) {
    const traps = (a.choice_analysis ?? []).filter((c) => c.verdict === 'distractor' && c.trap)
    if (traps.length) errs.push(`V14 내용이 맞는 선지 ${traps.map((c) => c.n).join(',')} 에 trap 라벨`)
  }
  if (errs.length) out.push({ item_id: a.item_id, type_id: it.type_id, version: a.version, status: a.status, rules: [...new Set(errs.map((e) => e.match(/^V\d+/)?.[0] ?? e.slice(0, 20)))], errors: errs })
}
const by = (k) => out.reduce((m, r) => { for (const x of [].concat(r[k])) m[x] = (m[x] ?? 0) + 1; return m }, {})
const typeRule = out.reduce((m, r) => { for (const x of r.rules) { const k = `${x}/${r.type_id}/${r.status}`; m[k] = (m[k] ?? 0) + 1 } return m }, {})
const summary = { checked: rows.length, flagged: out.length, by_rule: by('rules'), by_status: by('status'), by_rule_type_status: typeRule, not_checked: 'V4 인용 대조 · 원문 창 대조(로컬 원문 필요)' }
fs.mkdirSync(path.join(HERE, 'work'), { recursive: true })
const file = path.join(HERE, 'work', `d1-rules-${new Date().toISOString().slice(0, 10)}.json`)
fs.writeFileSync(file, JSON.stringify({ summary, items: out }, null, 1))
console.log(JSON.stringify(summary, null, 1))
