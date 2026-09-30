// scripts/csat/review-drain.mjs
//
// **학평 분석 독립 검수 드레인** — 분석을 쓴 에이전트와 **다른** 검수 에이전트가 문항마다 쓰는 도구.
// DB 게이트(20260928141215_csat_hakpyeong_independent_review_gate)가 최종 판정한다. 이 스크립트는 그 절차를
// 사람·에이전트가 틀리지 않게 한 줄씩 부르는 창구일 뿐이다.
//
// ── 왜 따로 있나 ──────────────────────────────────────────────────────
// 2026-09-28 학평 드레인에서 분석 에이전트가 3인 검수를 스스로 적었고, 12문항 청크에서는 검수 소견을
// 틀로 찍었다(4문항+ 청크 42 중 40). 같은 주체가 쓰고 검수하면 어떤 검사도 형식만 맞춰 통과할 수 있다.
// 그래서 검수는 **다른 실행 주체**가, **정답·분석을 보기 전에 먼저 풀고**, DB 가 그 순서와 해시를 박제한다.
//
// ── 검수 에이전트의 한 문항 절차(순서가 곧 규칙이다) ─────────────────
//   1) start   --analysis <id> --persona <setter|analyst|tutor> --agent-run <내 실행 id>
//              → 원문·발문·선지만 준다. 정답·분석은 주지 않는다.
//   2) solve   --run <run id> --answer <1-5> --note "<왜 그 답인가>"
//              → 독립 풀이 확정. 한 번만. 이 뒤에만 공개된다.
//   3) reveal  --run <run id>
//              → 공식 정답과 분석(해당 버전)을 준다.
//   4) submit  --run <run id> --verdict <pass|revise|fail> --findings '<json 배열>' --checked '<json 배열>'
//              → 판정 기록. DB 가 이 순간의 원문·정답·분석 해시와 시각을 박제한다.
//
// ── 분석만 바뀐 재검수(게이트 v2 · 20260928143924_csat_hakpyeong_rereview_link) ─────
//   rereview --analysis <새 분석 id> --persona <…> --agent-run <내 실행 id>
//              → 같은 문항·같은 페르소나의 **최초 블라인드 풀이**에 잇는 재검수 실행을 만들고 곧바로 공개한다.
//                새로 풀지 않는다(정답을 이미 본 검수를 블라인드로 기록할 길은 DB 가 막는다).
//                원문·선지·정답이 풀이 뒤에 바뀌었으면 쓸 수 없다 — 그때는 start 로 새 블라인드부터.
//              출력: 새 분석 · 최초 풀이(답·근거) · 그 블라인드 실행이 옛 분석에 남긴 소견 → 교정이 소견을 풀었는지 본다
//   다음: submit --run <run id> …(블라인드와 같다)
//
// ── 운영자 명령 ───────────────────────────────────────────────────────
//   export  [--size 8] [--limit N] [--items H2603G3#18,...]   독립 검수가 필요한 학평 분석을 청크로(작업 중 제외)
//   publish [--items ...]                                       독립 검수 3인이 모인 분석을 발행 시도(게이트가 판정)
//   precheck [--items ...] [--out]                                    옛 분석도 근거 단위 번호 검사(V9) — 실패는 검수 전에 교정
//   status                                                      학평 분석 상태·독립 검수 진행 요약
//
// 재실행 안전: start 는 매번 새 실행을 만든다(버려진 실행은 게이트가 세지 않는다) · solve 는 두 번 부르면
// DB 가 거부 · reveal 은 몇 번 불러도 같은 값 · submit 은 (분석, 페르소나, 실행) 당 한 번 · publish 는 몇 번이든 안전.

import fs from 'node:fs'
import path from 'node:path'
import { createClient } from '@supabase/supabase-js'
import { loadCurrentUnits, unitsForAgent } from './lib-units-db.mjs'
import { precheckAnalysis, PRECHECK_VERSION, UNITS_VERSION } from './lib-evidence-units.mjs'
import { isKiceExam } from './lib-exam-id.mjs'
import { execFileSync } from 'node:child_process'

const [cmd, ...rest] = process.argv.slice(2)
const arg = (n, d = null) => {
  const i = rest.indexOf(`--${n}`)
  return i >= 0 ? rest[i + 1] : d
}
const has = (n) => rest.includes(`--${n}`)

function env(name) {
  if (process.env[name]) return process.env[name]
  for (const f of ['.env.local', '.env', 'apps/web/.env.local', 'apps/web/.env']) {
    if (!fs.existsSync(f)) continue
    const m = fs.readFileSync(f, 'utf8').match(new RegExp(`^${name}\\s*=\\s*(.+)$`, 'm'))
    if (m) return m[1].trim().replace(/^["']|["']$/g, '')
  }
  return null
}
const URL = env('NEXT_PUBLIC_SUPABASE_URL') ?? env('SUPABASE_URL')
const KEY = env('SUPABASE_SERVICE_ROLE_KEY') ?? env('SUPABASE_SERVICE_KEY')
if (!URL || !KEY) throw new Error('SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 를 못 찾았다')
const db = createClient(URL, KEY, { auth: { persistSession: false } })

const WORK = path.resolve('scripts/csat/review-drain-hakpyeong') // gitignore — 문항 id 만 담지만 학평 작업물과 같은 규칙
const PERSONAS = ['setter', 'analyst', 'tutor']
/** 이 시간 안에 만들어졌는데 판정이 없는 실행은 «작업 중» 으로 보고 다시 배정하지 않는다 */
const CLAIM_HOURS = 3

/**
 * 검수자에게 보이는 분석 — 판정에 필요 없는 출처·운영 칸은 뺀다.
 * analyst_run 이 보이면 검수자가 «누가 썼나»(교정본·시험용 결함 심기 등)로 판정을 기울일 수 있다.
 */
const forReviewer = (a) => {
  if (!a) return a
  const { analyst_run, body_recovered, created_at, updated_at, ...rest } = a
  return rest
}
const out = (v) => console.log(JSON.stringify(v, null, 1))
const die = (msg) => { console.error(`✗ ${msg}`); process.exit(1) }
const must = (v, name) => (v == null || v === '' ? die(`--${name} 가 필요하다`) : v)

async function all(q) {
  const rows = []
  for (let f = 0; ; f += 1000) {
    const { data, error } = await q().range(f, f + 999)
    if (error) die(error.message)
    rows.push(...data)
    if (data.length < 1000) break
  }
  return rows
}

/** 검수자에게 보이는 근거 단위 목록 — DB 의 **현재** 목록(csat_item_units)만. 없으면 null 과 사유 */
async function unitsView(itemId) {
  const u = (await loadCurrentUnits(db, [itemId])).get(itemId)
  return u ? { units_version: u.units_version, list: unitsForAgent(u.units), note: '분석의 sentence_index·[uN] 은 이 번호다 — 지문을 다시 세지 말고 이 목록으로 대조한다' }
    : { list: null, note: '근거 단위 목록 없음 — 번호 대조 불가(units-build 필요)' }
}

/** 분석 id → 사전 검사 결과(현재 근거 단위 목록 기준). 목록 없는 문항은 오류로 센다 */
async function precheckMany(analyses) {
  const out = new Map()
  const units = await loadCurrentUnits(db, analyses.map((a) => a.item_id))
  for (let i = 0; i < analyses.length; i += 200) {
    const { data, error } = await db.from('csat_item_analyses').select('id, item_id, answer_locus, choice_analysis, answer_unknown')
      .in('id', analyses.slice(i, i + 200).map((a) => a.id))
    if (error) die(error.message)
    for (const r of data) out.set(r.id, precheckAnalysis(r, units.get(r.item_id)?.units))
  }
  return out
}

/** 도표(R-CHART) 문항 id — 이미지 입력이 없어 발행 보류 대상 */
async function chartItems(itemIds) {
  const set = new Set()
  for (let i = 0; i < itemIds.length; i += 200) {
    const { data, error } = await db.from('csat_items').select('id').in('id', itemIds.slice(i, i + 200)).eq('type_id', 'R-CHART')
    if (error) die(error.message)
    for (const r of data) set.add(r.id)
  }
  return set
}

/** 학평 문항별 최신 분석 */
async function latestHakpyeong() {
  const rows = await all(() => db.from('csat_item_analyses').select('id, item_id, version, status, analyst_run').like('item_id', 'H%').order('item_id').order('version', { ascending: false }))
  const latest = new Map()
  for (const r of rows) if (!latest.has(r.item_id)) latest.set(r.item_id, r)
  return [...latest.values()]
}

switch (cmd) {
  // ── 검수 에이전트 ───────────────────────────────────────────────────
  case 'start': {
    const analysisId = must(arg('analysis'), 'analysis')
    const persona = must(arg('persona'), 'persona')
    const agentRun = must(arg('agent-run'), 'agent-run')
    if (!PERSONAS.includes(persona)) die(`persona 는 ${PERSONAS.join('|')}`)
    const { data: a, error: ae } = await db.from('csat_item_analyses').select('id, item_id, analyst_run').eq('id', analysisId).single()
    if (ae) die(ae.message)
    if (a.analyst_run && a.analyst_run === agentRun) die('분석을 쓴 실행 주체는 그 분석을 검수할 수 없다')
    // 이 도구는 **학평(보조·검증 집합) 전용**이다 — 평가원 분석은 csat_analysis_reviews 규약을 따른다
    if (isKiceExam(a.item_id)) die(`${a.item_id}: 평가원 문항은 이 도구로 검수하지 않는다(학평 전용)`)
    const { data: run, error: re } = await db.from('csat_review_runs')
      .insert({ item_id: a.item_id, analysis_id: a.id, role: 'reviewer', agent_run: agentRun, persona }).select('id').single()
    if (re) die(re.message)
    // 정답(answer·answers)과 분석은 **주지 않는다** — solve 뒤 reveal 에서만
    const { data: it, error: ie } = await db.from('csat_items').select('id, exam_id, no, type_id, stem, passage, choices').eq('id', a.item_id).single()
    if (ie) die(ie.message)
    out({ run_id: run.id, item: it, units: await unitsView(a.item_id), next: `solve --run ${run.id} --answer <1-5> --note "<근거>"` })
    break
  }
  case 'solve': {
    const run = must(arg('run'), 'run')
    const answer = Number(must(arg('answer'), 'answer'))
    const note = must(arg('note'), 'note')
    if (!(answer >= 1 && answer <= 5)) die('answer 는 1~5')
    const { error } = await db.rpc('csat_review_solve', { p_run: run, p_answer: answer, p_note: note })
    if (error) die(error.message)
    out({ run_id: run, solved: answer, next: `reveal --run ${run}` })
    break
  }
  case 'reveal': {
    const run = must(arg('run'), 'run')
    const { data, error } = await db.rpc('csat_review_reveal', { p_run: run })
    if (error) die(error.message)
    const row = data?.[0]
    const { data: r } = await db.from('csat_review_runs').select('solve_answer').eq('id', run).single()
    out({ run_id: run, official_answer: row?.answer, official_answers: row?.answers, your_solve: r?.solve_answer, matches: r?.solve_answer === row?.answer, analysis: forReviewer(row?.analysis),
      units: row?.analysis?.item_id ? await unitsView(row.analysis.item_id) : null,
      next: `submit --run ${run} --verdict <pass|revise|fail> --findings '[...]' --checked '[...]'` })
    break
  }
  case 'submit': {
    const run = must(arg('run'), 'run')
    const verdict = must(arg('verdict'), 'verdict')
    if (!['pass', 'revise', 'fail'].includes(verdict)) die('verdict 는 pass|revise|fail')
    let findings, checked
    try { findings = JSON.parse(must(arg('findings'), 'findings')); checked = JSON.parse(arg('checked', '[]')) } catch (e) { die(`findings/checked 는 JSON 배열: ${e.message}`) }
    if (!Array.isArray(findings) || !findings.length) die('findings 는 비지 않은 배열 — 이 문항에서 실제로 본 것을 적는다')
    const { data: r, error: re } = await db.from('csat_review_runs').select('analysis_id, persona, revealed_at').eq('id', run).single()
    if (re) die(re.message)
    if (!r.revealed_at) die('reveal 전에는 판정을 기록하지 않는다 — solve → reveal → submit')
    const { error } = await db.from('csat_independent_reviews')
      .insert({ analysis_id: r.analysis_id, review_run_id: run, persona: r.persona, verdict, findings, checked })
    if (error) die(error.message)
    out({ run_id: run, recorded: verdict })
    break
  }

  case 'rereview': {
    const analysisId = must(arg('analysis'), 'analysis')
    const persona = must(arg('persona'), 'persona')
    const agentRun = must(arg('agent-run'), 'agent-run')
    if (!PERSONAS.includes(persona)) die(`persona 는 ${PERSONAS.join('|')}`)
    const { data: a, error: ae } = await db.from('csat_item_analyses').select('id, item_id, analyst_run').eq('id', analysisId).single()
    if (ae) die(ae.message)
    if (a.analyst_run && a.analyst_run === agentRun) die('분석을 쓴 실행 주체는 그 분석을 검수할 수 없다')
    // parent 는 **지금 원문·정답 해시와 맞는** 가장 최근 blind 풀이(DB 함수 — 게이트와 같은 조건).
    // 예전에는 해시를 안 보고 가장 오래된 풀이를 골라, 원문 변경 뒤 새 blind 를 마쳐도 옛 풀이에 이어 게이트에서 계속 거부됐다(PR #126 리뷰 P2-7)
    const { data: parentId, error: pe } = await db.rpc('csat_rereview_parent', { p_item: a.item_id, p_persona: persona, p_analyst_run: a.analyst_run ?? '' })
    if (pe) die(pe.message)
    if (!parentId) die(`${a.item_id} ${persona}: 지금 원문·정답과 맞는 블라인드 풀이가 없다 — start 로 새 블라인드부터`)
    const { data: parent, error: pe2 } = await db.from('csat_review_runs').select('id, solve_answer, solve_note').eq('id', parentId).single()
    if (pe2) die(pe2.message)
    const { data: run, error: re } = await db.from('csat_review_runs')
      .insert({ item_id: a.item_id, analysis_id: a.id, role: 'reviewer', agent_run: agentRun, persona, kind: 'rereview', parent_run_id: parent.id }).select('id').single()
    if (re) die(re.message)
    const { data, error } = await db.rpc('csat_review_reveal', { p_run: run.id })
    if (error) die(error.message)
    const row = data?.[0]
    const { data: prior } = await db.from('csat_independent_reviews').select('verdict, findings').eq('review_run_id', parent.id)
    out({ run_id: run.id, kind: 'rereview', parent_run: parent.id,
      original_solve: { answer: parent.solve_answer, note: parent.solve_note, matches: parent.solve_answer === row?.answer },
      prior_review_on_old_analysis: prior ?? [], official_answer: row?.answer, analysis: forReviewer(row?.analysis), units: await unitsView(a.item_id),
      next: `submit --run ${run.id} --verdict <pass|revise|fail> --findings '[...]' --checked '[...]'` })
    break
  }

  // ── 운영자 ──────────────────────────────────────────────────────────
  case 'export': {
    const size = Number(arg('size', 8)) // 2026-09-29 시험: 8문항이 4문항보다 문항당 39.4% 싸고 심은 결함 검출은 같았다(확인한 결함 한정)
    const limit = arg('limit') ? Number(arg('limit')) : Infinity
    const only = arg('items') ? new Set(arg('items').split(',')) : null
    const all0 = (await latestHakpyeong()).filter((a) => a.status !== 'published' && (!only || only.has(a.item_id)))
    // 도표는 이미지 없이 검수할 수 없다 — 청크에서 빼되 **보류 건수로 남긴다**(조용히 제외하지 않는다 · DB 게이트도 발행 거부)
    const chartHeld = await chartItems(all0.map((a) => a.item_id))
    const latest0 = all0.filter((a) => !chartHeld.has(a.item_id))
    // 기계로 잡히는 번호 결함은 블라인드 검수에 보내지 않는다 — 검수 3인이 같은 결함을 세 번 적는 비용이다(2026-09-30 배치 4: 반려 4/4 가 V9 결함)
    const pre = await precheckMany(latest0)
    const fixFirst = latest0.filter((a) => pre.get(a.id)?.errors.length)
    const latest = latest0.filter((a) => !fixFirst.includes(a))
    const ids = latest.map((a) => a.id)
    const runs = []
    for (let i = 0; i < ids.length; i += 200) {
      runs.push(...(await all(() => db.from('csat_review_runs').select('id, analysis_id, persona, created_at').in('analysis_id', ids.slice(i, i + 200)))))
    }
    const reviews = []
    for (let i = 0; i < ids.length; i += 200) {
      reviews.push(...(await all(() => db.from('csat_independent_reviews').select('analysis_id, persona, verdict, review_run_id').in('analysis_id', ids.slice(i, i + 200)))))
    }
    const reviewedRuns = new Set(reviews.map((r) => r.review_run_id))
    const cutoff = Date.now() - CLAIM_HOURS * 3600e3
    const busy = new Set(runs.filter((r) => !reviewedRuns.has(r.id) && Date.parse(r.created_at) > cutoff).map((r) => r.analysis_id))
    // 이미 받은 승인은 **게이트와 같은 기준**(DB 함수 csat_valid_review_personas)으로만 센다. 예전에는 과거 pass 의
    // 페르소나를 그냥 세서, 원문 변경 등으로 무효가 된 승인이 재검수 배정을 막았다 — 발행은 거부되는데 청크에도 안
    // 들어가는 상태가 생겼다(PR #126 리뷰 P2-6)
    const passed = new Map()
    for (let i = 0; i < ids.length; i += 200) {
      const { data, error } = await db.rpc('csat_valid_review_personas_many', { p_analyses: ids.slice(i, i + 200) })
      if (error) die(error.message)
      for (const r of data ?? []) passed.set(r.analysis_id, new Set(r.personas ?? []))
    }
    const noRun = latest.filter((a) => !a.analyst_run)
    const todo = latest.filter((a) => a.analyst_run && !busy.has(a.id))
      .map((a) => ({ analysis_id: a.id, item_id: a.item_id, version: a.version, need: PERSONAS.filter((p) => !passed.get(a.id)?.has(p)) }))
      .filter((t) => t.need.length)
    fs.mkdirSync(WORK, { recursive: true })
    const stamp = new Date().toISOString().replace(/[-:]/g, '').slice(0, 13)
    let n = 0
    for (let i = 0; i < todo.length && n < limit; i += size, n += 1) {
      const name = `rchunk-${stamp}-${String(n + 1).padStart(3, '0')}.json`
      fs.writeFileSync(path.join(WORK, name), JSON.stringify({ created_at: new Date().toISOString(), items: todo.slice(i, i + size) }, null, 1))
      console.log(`  ${name}  ${todo.slice(i, i + size).map((t) => t.item_id).join(' ')}`)
    }
    console.log(`  보류: 도표 이미지 없음 ${chartHeld.size} (검수 청크에서 뺐다 · 완료로 세지 않는다)`)
    console.log(`  교정 먼저: 사전 검사(V9) 실패 ${fixFirst.length}${fixFirst.length ? ' — ' + fixFirst.slice(0, 10).map((a) => a.item_id).join(' ') + (fixFirst.length > 10 ? ' …' : '') : ''}`)
    console.log(`  대상 ${latest.length} · 작업 중 ${busy.size} · analyst_run 없음 ${noRun.length} · 검수 필요 ${todo.length} · 새 청크 ${n}`)
    if (noRun.length) console.log('  ⚠ analyst_run 이 없는 분석은 게이트가 발행을 막는다 — 분석을 다시 적재할 때 analyst_run 을 적는다(백필 명령은 2026-10-01 할 일을 마치고 없앴다)')
    break
  }
  case 'publish': {
    const only = arg('items') ? new Set(arg('items').split(',')) : null
    const latest = (await latestHakpyeong()).filter((a) => a.status !== 'published' && (!only || only.has(a.item_id)))
    // 발행은 서버 함수가 문항별 저장점으로 한다(csat_publish_hakpyeong) — 한 문항의 게이트 거부가 나머지를 막지 않고,
    // 스크립트가 행마다 PATCH 하지 않는다(단건 쓰기 예산). 게이트가 최종 판정한다.
    let ok = 0
    const refused = []
    for (let i = 0; i < latest.length; i += 200) {
      const { data, error } = await db.rpc('csat_publish_hakpyeong', { p_analyses: latest.slice(i, i + 200).map((a) => a.id) })
      if (error) die(error.message)
      for (const r of data ?? []) {
        if (r.ok) ok += 1
        else refused.push(`${r.item_id}: ${String(r.reason).slice(0, 100)}`)
      }
    }
    console.log(`  발행 ${ok} · 게이트 거부 ${refused.length}`)
    for (const r of refused.slice(0, 10)) console.log(`    · ${r}`)
    break
  }
  case 'precheck': {
    // 옛 분석도 현재 validator 의 번호 검사(V9)를 거친다 — 읽기만 한다(재실행 안전)
    const only = arg('items') ? new Set(arg('items').split(',')) : null
    const latest = (await latestHakpyeong()).filter((a) => (only ? only.has(a.item_id) : a.status !== 'published'))
    const pre = await precheckMany(latest)
    let bad = 0
    for (const a of latest) {
      const r = pre.get(a.id)
      if (!r?.errors.length) continue
      bad += 1
      if (only || bad <= 30) console.log(`  ✗ ${a.item_id} v${a.version} — ${r.errors.join(' · ')}`)
    }
    console.log(`  대상 ${latest.length} · 사전 검사 실패 ${bad} · 통과 ${latest.length - bad}`)
    // --out: 결과를 기록한다. **자동 검사 적발 후보**일 뿐이다 — 통과는 결함 없음도, 독립 검수 통과도 아니다
    if (has('out')) {
      const failed = latest.filter((a) => pre.get(a.id)?.errors.length)
      const hashes = new Map()
      for (let i = 0; i < failed.length; i += 200) {
        const { data, error } = await db.from('csat_item_analyses').select('id, csat_analysis_hash').in('id', failed.slice(i, i + 200).map((a) => a.id))
        if (error) die(error.message)
        for (const r of data) hashes.set(r.id, r.csat_analysis_hash)
      }
      const units = await loadCurrentUnits(db, failed.map((a) => a.item_id))
      let commit = null
      try { commit = execFileSync('git', ['rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim() } catch { /* git 없음 */ }
      const rec = {
        kind: '자동 검사 적발 후보',
        caution: '검사 통과는 결함 없음이나 독립 검수 통과가 아니다. 적발 후보는 교정 후보이지 결함률이 아니다(의미 오류·「N번 문장」 서술은 못 잡는다).',
        generated_at: new Date().toISOString(),
        checker: { units_version: UNITS_VERSION, precheck_version: PRECHECK_VERSION, commit },
        scope: only ? 'items' : 'unpublished-latest',
        counts: { checked: latest.length, flagged: failed.length },
        items: failed.map((a) => ({ item_id: a.item_id, analysis_id: a.id, version: a.version, analysis_hash: hashes.get(a.id) ?? null,
          units_version: units.get(a.item_id)?.units_version ?? null, units_hash: units.get(a.item_id)?.units_hash ?? null,
          errors: pre.get(a.id).errors, warnings: pre.get(a.id).warnings })),
      }
      fs.mkdirSync(WORK, { recursive: true })
      const file = path.join(WORK, `_precheck-${rec.generated_at.slice(0, 10)}.json`)
      fs.writeFileSync(file, JSON.stringify(rec, null, 1))
      console.log(`  기록: ${path.relative(process.cwd(), file)} (gitignore — 학평 작업물)`)
    }
    break
  }
  case 'status': {
    const latest = await latestHakpyeong()
    const by = {}
    for (const a of latest) by[a.status] = (by[a.status] ?? 0) + 1
    const { count: runs } = await db.from('csat_review_runs').select('id', { count: 'exact', head: true })
    const { count: revs } = await db.from('csat_independent_reviews').select('id', { count: 'exact', head: true })
    const held = await chartItems(latest.filter((a) => a.status !== 'published').map((a) => a.item_id))
    out({ analyses: latest.length, by_status: by, held_chart_no_image: held.size, analyst_run_missing: latest.filter((a) => !a.analyst_run).length, review_runs: runs, independent_reviews: revs })
    break
  }
  default:
    console.log('usage: review-drain.mjs <start|solve|reveal|submit|rereview|precheck|export|publish|status> …(머리 주석 참조)')
    process.exit(cmd ? 1 : 0)
}
