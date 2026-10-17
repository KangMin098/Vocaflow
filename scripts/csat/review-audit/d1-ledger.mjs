// scripts/csat/review-audit/d1-ledger.mjs
//
// **D1 — 학평 최신 분석 전량 사전 검사 + 열린 후속 조치 재대조(읽기 전용).** DB 에 아무것도 쓰지 않는다.
// 판정은 기존 도구와 같은 함수만 쓴다: precheckAnalysis(review-drain precheck 와 같음) · csat_valid_review_personas_many
// (발행 게이트와 같음) · csat_item_input_hash / csat_item_answer_hash(검수 스냅샷 대조, 화면 로더와 같음).
//
// 출력: scripts/csat/review-audit/work/d1-ledger-<날짜>.json (gitignore — 문항별 상태 원장) + 콘솔 요약.
// 상태(지시문 D1 표):
//   keep            사전 검사 통과 · 유효 승인 3/3
//   fix             사전 검사 실패(기계적 결함 재현) — 교정 대상
//   source-first    현재 근거 단위 목록 없음 — 원문 수리·units-build 선행
//   review          검수 기록 없음/부족 — 독립 검수 대상
//   rereview        최근 판정 뒤 분석·근거 단위만 바뀜 — 기존 블라인드 풀이에 잇는 재검수 후보
//   new-blind       최근 판정 뒤 원문·정답 입력이 바뀜 — 새 블라인드
//   rejected        현재 입력에 대한 반려(revise/fail)가 남음 — 교정 후 재검수
//   unknown         위 어디에도 확정 못 함(사유 기록)
// 사용: node --tls-max-v1.2 scripts/csat/review-audit/d1-ledger.mjs <env 파일>
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { validPersonasBatched } from '../lib-review-batching.mjs'
import { loadCurrentUnits } from '../lib-units-db.mjs'
import { precheckAnalysis, PRECHECK_VERSION } from '../lib-evidence-units.mjs'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const envFile = process.argv[2]
if (!envFile) throw new Error('env 파일 경로가 필요하다')
const env = Object.fromEntries(fs.readFileSync(envFile, 'utf8').split(/\r?\n/).filter((l) => /^[A-Z_]+=/.test(l)).map((l) => { const i = l.indexOf('='); return [l.slice(0, i), l.slice(i + 1).replace(/^["']|["']$/g, '')] }))
const db = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const die = (m) => { console.error(`✗ ${m}`); process.exit(1) }

async function all(q) {
  const rows = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await q().range(f, f + 999)
    if (error) die(error.message)
    rows.push(...data)
    if (data.length < 1000) return rows
  }
}
const inChunks = async (ids, size, fn) => { const out = []; for (let i = 0; i < ids.length; i += size) out.push(...(await fn(ids.slice(i, i + size)))); return out }
const pool = async (xs, n, fn) => { const q = [...xs]; await Promise.all(Array.from({ length: n }, async () => { for (let x = q.shift(); x !== undefined; x = q.shift()) await fn(x) })) }

const startedAt = new Date().toISOString()
// 1) 학평 문항 · 최신 분석
const items = await all(() => db.from('csat_items').select('id, type_id').like('id', 'H%').order('id'))
const analyses = await all(() => db.from('csat_item_analyses').select('id, item_id, version, status, analyst_run, units_hash, csat_analysis_hash, created_at').like('item_id', 'H%').order('item_id').order('version', { ascending: false }))
const latest = new Map(); for (const a of analyses) if (!latest.has(a.item_id)) latest.set(a.item_id, a)
const latestPublished = new Map(); for (const a of analyses) if (a.status === 'published' && !latestPublished.has(a.item_id)) latestPublished.set(a.item_id, a)
const L = [...latest.values()]
const ids = L.map((a) => a.id)
const byId = new Map(L.map((a) => [a.id, a]))

// 2) 사전 검사(현재 근거 단위 기준) — review-drain precheckMany 와 같은 필드
const units = await loadCurrentUnits(db, L.map((a) => a.item_id))
const pre = new Map()
for (const r of await inChunks(ids, 200, async (part) => {
  const { data, error } = await db.from('csat_item_analyses').select('id, item_id, answer_locus, choice_analysis, solve_procedure, measured_ability, design_intent, answer_unknown, csat_analysis_hash').in('id', part)
  if (error) die(error.message)
  return data
})) pre.set(r.id, precheckAnalysis(r, units.get(r.item_id)?.units))

// 3) 저장된 사전 검사 기록이 «현재» 것인지 (화면 기준과 같음)
const stored = await inChunks(ids, 200, (part) => all(() => db.from('csat_review_prechecks').select('analysis_id, analysis_hash, units_hash, input_hash, precheck_version').in('analysis_id', part).order('analysis_id')))
const storedCurrent = new Set(stored.filter((s) => {
  const a = byId.get(s.analysis_id); const u = a && units.get(a.item_id)
  return a && u && s.precheck_version === PRECHECK_VERSION && s.analysis_hash === a.csat_analysis_hash && s.units_hash === u.units_hash && s.input_hash === u.input_hash
}).map((s) => s.analysis_id))

// 4) 유효 승인 (게이트 함수)
const v = await validPersonasBatched(ids, (part) => db.rpc('csat_valid_review_personas_many', { p_analyses: part }))
if (v.error) die(`유효 승인: ${v.error}`)
const valid = new Map(v.rows.map((r) => [r.analysis_id, r.personas ?? []]))

// 5) 검수 기록 + 스냅샷 (승인 3/3 아닌 것만 해시 대조)
const notFull = L.filter((a) => (valid.get(a.id) ?? []).length < 3)
const reviews = await inChunks(notFull.map((a) => a.id), 100, (part) => all(() => db.from('csat_independent_reviews').select('id, analysis_id, persona, verdict, reviewed_at, item_input_hash, item_answer_hash, analysis_hash, units_hash').in('analysis_id', part).order('id')))
const byA = new Map(); for (const r of reviews) { const l = byA.get(r.analysis_id) ?? []; l.push(r); byA.set(r.analysis_id, l) }
const itemHash = new Map()
await pool(notFull.filter((a) => byA.has(a.id)), 8, async (a) => {
  const [ih, ah] = await Promise.all([db.rpc('csat_item_input_hash', { p_item: a.item_id }), db.rpc('csat_item_answer_hash', { p_item: a.item_id })])
  if (ih.error || ah.error) die(`문항 해시(${a.item_id}): ${(ih.error ?? ah.error).message}`)
  itemHash.set(a.item_id, { input: ih.data, answer: ah.data })
})

// 6) 후속 조치 전량(PK 커서) — 열린 것만 재대조
const q = (s) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`
const followups = []
for (let after = null; ;) {
  let qq = db.from('csat_review_followups').select('item_id, source, finding_key, finding, severity, status, noted_on, updated_at')
  if (after) qq = qq.or(after)
  const { data, error } = await qq.order('item_id').order('source').order('finding_key').limit(1000)
  if (error) die(error.message)
  followups.push(...data)
  if (data.length < 1000) break
  const k = data[data.length - 1]
  after = [`item_id.gt.${q(k.item_id)}`, `and(item_id.eq.${q(k.item_id)},source.gt.${q(k.source)})`, `and(item_id.eq.${q(k.item_id)},source.eq.${q(k.source)},finding_key.gt.${q(k.finding_key)})`].join(',')
}

// 분류
const differs = (then, now) => Boolean(then && now && then !== now)
const typeOf = new Map(items.map((i) => [i.id, i.type_id]))
const ledger = []
for (const it of items) {
  const a = latest.get(it.id)
  if (!a) { ledger.push({ item_id: it.id, type_id: it.type_id, state: 'no-analysis' }); continue }
  const p = pre.get(a.id), u = units.get(a.item_id), vp = valid.get(a.id) ?? []
  const row = { item_id: it.id, type_id: it.type_id, analysis_id: a.id, version: a.version, status: a.status, analysis_hash: a.csat_analysis_hash,
    units_hash: u?.units_hash ?? null, input_hash: u?.input_hash ?? null, analysis_units_bound: Boolean(a.units_hash && u && a.units_hash === u.units_hash),
    precheck_errors: p?.errors ?? null, precheck_warnings: p?.warnings ?? [], stored_precheck_current: storedCurrent.has(a.id),
    valid_personas: vp, published_version: latestPublished.get(it.id)?.version ?? null }
  if (!u) { row.state = 'source-first'; row.reason = '현재 근거 단위 목록 없음' }
  else if (p?.errors.length) { row.state = 'fix'; row.reason = p.errors.slice(0, 3).join(' · ') }
  else if (vp.length >= 3) row.state = 'keep'
  else {
    const rs = (byA.get(a.id) ?? []).sort((x, y) => x.reviewed_at.localeCompare(y.reviewed_at))
    const last = new Map(); for (const r of rs) last.set(r.persona, r)
    const lr = [...last.values()]; const ih = itemHash.get(a.item_id)
    if (!lr.length) { row.state = 'review'; row.reason = '검수 기록 없음' }
    else if (ih && lr.some((r) => differs(r.item_input_hash, ih.input) || differs(r.item_answer_hash, ih.answer))) { row.state = 'new-blind'; row.reason = '최근 판정 뒤 원문/정답 입력 변경' }
    else if (lr.some((r) => differs(r.analysis_hash, a.csat_analysis_hash) || differs(r.units_hash, u.units_hash))) { row.state = 'rereview'; row.reason = '최근 판정 뒤 분석/근거 단위만 변경' }
    else if (lr.some((r) => r.verdict !== 'pass')) { row.state = 'rejected'; row.reason = `현재 입력 반려: ${lr.filter((r) => r.verdict !== 'pass').map((r) => `${r.persona}=${r.verdict}`).join(',')}` }
    else if (lr.length < 3) { row.state = 'review'; row.reason = `판정 페르소나 ${lr.length}/3` }
    else { row.state = 'unknown'; row.reason = '최근 판정 3개 pass·해시 동일인데 게이트 미인정(자기 검수·풀이 전 공개 등) — 게이트 사유 확인 필요' }
    row.last_verdicts = lr.map((r) => ({ persona: r.persona, verdict: r.verdict, at: r.reviewed_at }))
  }
  ledger.push(row)
}
const rowOf = new Map(ledger.map((r) => [r.item_id, r]))

// 후속 조치 재대조: 기계 판정 가능한 범위만 — 의미 재현은 사람/에이전트 검토가 필요하므로 «재대조 필요»로 남긴다
const fuOut = followups.filter((f) => f.status === 'open').map((f) => {
  const r = rowOf.get(f.item_id)
  let cls
  if (!f.item_id.startsWith('H')) cls = typeOf.has(f.item_id) ? 'kice-item' : 'rule'
  else if (f.severity === 'reference' || f.severity === 'rule') cls = 'reference'
  else if (!r || r.state === 'no-analysis') cls = 'no-analysis'
  else if (latest.get(f.item_id).created_at.slice(0, 10) > f.noted_on) cls = 'analysis-changed-recheck'
  else cls = 'same-analysis-recheck'
  return { item_id: f.item_id, source: f.source, finding_key: f.finding_key, severity: f.severity, noted_on: f.noted_on, cls, item_state: r?.state ?? null }
})

const count = (xs, k) => xs.reduce((m, x) => ((m[x[k]] = (m[x[k]] ?? 0) + 1), m), {})
const hk = ledger.filter((r) => r.analysis_id)
const pub = hk.filter((r) => r.published_version != null)
const summary = {
  started_at: startedAt, finished_at: new Date().toISOString(), precheck_version: PRECHECK_VERSION,
  hakpyeong_items: items.length, with_analysis: hk.length, no_analysis: items.length - hk.length,
  states: count(ledger, 'state'),
  latest_status: count(hk, 'status'),
  published_any: pub.length,
  published_units_unbound: pub.filter((r) => !r.analysis_units_bound).length,
  latest_without_current_stored_precheck: hk.filter((r) => !r.stored_precheck_current).length,
  precheck_fail_now: hk.filter((r) => r.precheck_errors?.length).length,
  no_units_now: hk.filter((r) => !r.units_hash).length,
  followups_total: followups.length, followups_open: fuOut.length, followups_open_by_class: count(fuOut, 'cls'),
}
fs.mkdirSync(path.join(HERE, 'work'), { recursive: true })
const file = path.join(HERE, 'work', `d1-ledger-${startedAt.slice(0, 10)}.json`)
fs.writeFileSync(file, JSON.stringify({ summary, items: ledger, open_followups: fuOut }, null, 1))
console.log(JSON.stringify(summary, null, 1))
console.log(`원장: ${path.relative(process.cwd(), file)}`)
