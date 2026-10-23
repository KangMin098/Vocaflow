// scripts/research/goal-data/d2-run.mjs
//
// D2 문항↔TASK 매핑 배치 — 청크 · 검증 · A/B 일치(계약 v2: 18 원자 TASK · indirect 반사실 필수).
//   node scripts/research/goal-data/d2-run.mjs <batch> chunks|validate|agree
// 검증은 1차 표본 검증기(validateRow · validateChunk)를 그대로 쓰고 v2 반사실 검사만 더한다. 재실행 안전(있는 청크는 건너뜀).
// agree 출력(생성물): docs/research/goal-data-batches/D2-task-mapping/<batch>-{item-task-links,disputed-links}.jsonl · <batch>-agreement.json
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { ROOT, nonHeldTasks } from '../../csat/map/v62/data/pilot-lib.mjs'

import { checkChunk, chunkSize, loadTrack, makeValidator } from './d2-validate.mjs'

const [batch, cmd] = process.argv.slice(2)
const LOCAL = path.join(ROOT, 'scripts/research/goal-data/local', String(batch))
const OUTDIR = path.join(ROOT, 'docs/research/goal-data-batches/D2-task-mapping')
// b2 · b3 만 10문항 청크 — 그 뒤 배치는 20문항 청크(분석자 수를 동시 실행 한도 안에 둔다 · T-0100 은 정규식이 b4–b9 에만 맞던 것을 지적)
const CHUNK = chunkSize(batch)
const sha = (v) => crypto.createHash('sha256').update(typeof v === 'string' ? v : JSON.stringify(v)).digest('hex')
const hideQuote = (a) => (a?.quote ? { field: a.field, quote_sha256: sha(String(a.quote)), quote_chars: String(a.quote).length } : null)
const norm = (s) => String(s ?? '').replace(/\s+/g, ' ').trim()
const input = JSON.parse(fs.readFileSync(path.join(LOCAL, 'input.json'), 'utf8'))
const byId = new Map(input.rows.map((r) => [r.item_id, r]))
// 계약: b2 = v2 · b3/b4 = v2.1 · 입력에 contract 가 있으면 그 버전까지(v2.2 = TASK 부분 집합 · E2 탐색 · 삽입 격리)
const DOC = 'docs/research/goal-data-batches/D2-task-mapping'
const CONTRACTS = ['docs/csat-learner/v62/data-expansion/ANALYST_CONTRACT.md', `${DOC}/CONTRACT_V2.md`, ...(batch === 'b2-v2' ? [] : [`${DOC}/CONTRACT_V2_1.md`]), ...(['v2.2', 'v2.3', 'v2.4', 'v2.5'].includes(input.contract) ? [`${DOC}/CONTRACT_V2_2.md`] : []), ...(['v2.3', 'v2.4', 'v2.5'].includes(input.contract) ? [`${DOC}/CONTRACT_V2_3.md`] : []), ...(['v2.4', 'v2.5'].includes(input.contract) ? [`${DOC}/CONTRACT_V2_4.md`] : []), ...(input.contract === 'v2.5' ? [`${DOC}/CONTRACT_V2_5.md`] : [])]
// v2: 통합 관찰(kind=integrated)은 문항 단위 판정에서 뺀다 · v2.2: 입력의 tasks 부분 집합만 판정 · 검증한다
const allAtomic = nonHeldTasks().filter((t) => t.kind !== 'integrated')
const tasks = input.tasks ? input.tasks.map((id) => allAtomic.find((t) => t.id === id) ?? (() => { throw new Error(`입력 tasks 에 정의 밖 TASK ${id}`) })()) : allAtomic
const subset = !!input.tasks
// 계약 검사는 d2-validate(d3-build 와 공용 · T-0107 P1)
const V = makeValidator(input, tasks)
// 안정 5 TASK(T-0100) — 일치 .80 · κ .68 을 둘 다 밑돌면 다음 배치 중단
const STABLE = ['r.central_meaning', 'r.inference', 'e.task_demand', 'e.option_correspondence', 'r.discourse_structure']
const nChunks = Math.ceil(input.rows.length / CHUNK)
const name = (track, k, out) => path.join(LOCAL, `chunk-${track}-${String(k + 1).padStart(2, '0')}${out ? '.out' : ''}.json`)

function chunks() {
  fs.mkdirSync(LOCAL, { recursive: true })
  for (let k = 0; k < nChunks; k++) {
    const rows = input.rows.slice(k * CHUNK, (k + 1) * CHUNK)
    for (const track of ['A', 'B']) {
      const f = name(track, k)
      if (fs.existsSync(f)) continue
      // 사전 등록 비교 배치(derived_from)는 두 트랙 모두 원문만 — C · E 에 기존 분석을 주면 (C,D)/(E,F) 안에서 정보 조건이 달라진다
      const items = rows.map((r) => ({ item_id: r.item_id, type_id: r.type_id, source: r.source, source_sha256: r.source_sha256, ...(r.insert_split ? { insert_split: r.insert_split } : {}), ...(track === 'A' && !input.derived_from ? { prior_analysis_unverified: r.analysis, prior_traps: r.traps.map((t) => ({ option_no: t.option_no, trap_key: t.trap_key })) } : {}) }))
      fs.writeFileSync(f, JSON.stringify({ batch, track, contracts: CONTRACTS, tasks, items }, null, 1))
    }
  }
  console.log(`${batch}: 청크 ${nChunks} × 트랙 2 · TASK ${tasks.length} → ${path.relative(ROOT, LOCAL)}`)
}

/** 트랙 출력 로더 — d2-validate.loadTrack(prereg-compare 와 공용) */
const load = (track) => loadTrack(LOCAL, track, nChunks, V, [...byId.keys()])

/**
 * validate [A|B] [NN] — 청크 번호를 주면 그 청크 문항의 결함만 보인다(b16: 분석자가 같은 트랙 다른 청크의 결함 · 설명을 봤다).
 *   d2-validate.checkChunk 로 직접 센다(T-0124: 문자열 역해석이 자기 누락 · 넷째 반복 문항을 숨겼다). 종료 코드는 이 청크 기준
 */
function validate(only, chunkNo) {
  let bad = 0
  if (only && !['A', 'B'].includes(only)) { console.error('validate [A|B] [NN]'); process.exit(2) }
  if (chunkNo && !only) { console.error('청크 번호는 트랙과 함께: validate A 01'); process.exit(2) }
  for (const t of only ? [only] : ['A', 'B']) {
    const { out, errors } = load(t)
    if (!chunkNo) {
      console.log(`${t}: 통과 ${out.size}/${byId.size} · 결함 ${errors.length}`)
      for (const e of errors.slice(0, 80)) console.log('  ' + e)
      bad += errors.length
      continue
    }
    const nn = String(chunkNo).padStart(2, '0')
    const { own, mine, trackExcluded } = checkChunk(LOCAL, t, nn, nChunks, V)
    console.log(`${t}-${nn}: 문항 ${own.length} · 이 청크 결함 ${mine.length}`)
    for (const e of mine.slice(0, 80)) console.log('  ' + e)
    if (trackExcluded) console.log('  (다른 청크의 트랙 전체 반복 결함으로 이 트랙이 결합에서 배제된 상태 — 내용은 보이지 않는다 · 이 청크 결함이 0 이면 기다린다)')
    bad += mine.length
  }
  process.exit(bad ? 1 : 0)
}

function kappa(pairs) {
  const cats = ['direct', 'indirect', 'not_applicable', 'unknown']
  const n = pairs.length
  if (!n) return null
  const po = pairs.filter(([a, b]) => a === b).length / n
  const pe = cats.reduce((s, c) => s + (pairs.filter(([a]) => a === c).length / n) * (pairs.filter(([, b]) => b === c).length / n), 0)
  return pe === 1 ? null : Number(((po - pe) / (1 - pe)).toFixed(4))
}

function agree() {
  const A = load('A'), B = load('B')
  const linked = [], disputed = [], all = []
  const per = Object.fromEntries(tasks.map((t) => [t.id, { display: t.display, pairs: [], both_direct: 0, both_indirect: 0, both_na: 0, disputed: 0 }]))
  const items = []
  for (const [id, inp] of byId) {
    const a = A.out.get(id), b = B.out.get(id)
    if (!a || !b) { items.push({ item_id: id, status: 'HUMAN_REVIEW_REQUIRED', reason: !a && !b ? 'A·B 검증 실패' : !a ? 'A 검증 실패' : 'B 검증 실패' }); continue }
    const la = new Map(a.links.map((l) => [l.task_id, l])), lb = new Map(b.links.map((l) => [l.task_id, l]))
    for (const t of tasks) {
      const x = la.get(t.id), y = lb.get(t.id), same = x.relevance === y.relevance
      all.push([x.relevance, y.relevance]); per[t.id].pairs.push([x.relevance, y.relevance])
      if (same) per[t.id][{ direct: 'both_direct', indirect: 'both_indirect', not_applicable: 'both_na' }[x.relevance] ?? 'disputed'] += x.relevance === 'unknown' ? 0 : 1
      else per[t.id].disputed++
      const rec = {
        batch, item: id, exam_id: inp.exam_id, type_id: inp.type_id, task: t.id, display: t.display,
        relevance: 'unknown',
        candidateRelevance: same && (x.relevance === 'direct' || x.relevance === 'indirect') ? x.relevance : null,
        state: same ? 'INDEPENDENTLY_CHECKED' : 'DISPUTED', tier: same ? 'R1' : 'R0',
        judgments: { A: x.relevance, B: y.relevance },
        anchors: { A: hideQuote(x.anchor), B: hideQuote(y.anchor) },
        counterfactual: { A: x.counterfactual ? { kind: x.counterfactual.kind, choice: x.counterfactual.choice ?? null, how: x.counterfactual.how } : null, B: y.counterfactual ? { kind: y.counterfactual.kind, choice: y.counterfactual.choice ?? null, how: y.counterfactual.how } : null },
        why: { A: x.why, B: y.why },
        directly_observable: { A: (a.directly_observable ?? []).includes(t.id), B: (b.directly_observable ?? []).includes(t.id) },
        source_sha256: inp.source_sha256,
      }
      if (same && rec.candidateRelevance) linked.push(rec)
      if (!same) disputed.push(rec)
    }
    items.push({
      item_id: id, exam_id: inp.exam_id, type_id: inp.type_id, source_sha256: inp.source_sha256, analysis_version: inp.analysis?.version ?? null,
      primary_task: { A: a.primary_task, B: b.primary_task, agree: a.primary_task === b.primary_task },
      directly_observable_both: (a.directly_observable ?? []).filter((t) => (b.directly_observable ?? []).includes(t)),
      independent_assessment: { A: a.independent_assessment?.eligibility, B: b.independent_assessment?.eligibility },
      // 독립 평가 부적격(둘 중 하나라도 not_suitable) → 교수 사례 · 간접 관찰 후보
      use: a.independent_assessment?.eligibility === 'candidate_if_unexposed' && b.independent_assessment?.eligibility === 'candidate_if_unexposed' ? 'independent_check_candidate' : 'teaching_case_or_indirect',
    })
  }
  const summary = {
    batch, tasks_judged: tasks.map((t) => t.display), subset, contracts: CONTRACTS.map((c) => ({ path: c, sha256: sha(fs.readFileSync(path.join(ROOT, c), 'utf8').replace(/\r\n/g, '\n')) })),
    input_sha256: sha(input.rows.map((r) => [r.item_id, r.source_sha256])), rule: input.rule,
    tasks: tasks.length, items: byId.size, pairs: all.length,
    agreement: all.length ? Number((all.filter(([p, q]) => p === q).length / all.length).toFixed(4)) : null,
    kappa: kappa(all), primary_task_agreement: items.filter((i) => i.primary_task?.agree).length,
    per_task: Object.fromEntries(Object.entries(per).map(([k, v]) => [k, { display: v.display, n: v.pairs.length, agreement: v.pairs.length ? Number((v.pairs.filter(([p, q]) => p === q).length / v.pairs.length).toFixed(4)) : null, kappa: kappa(v.pairs), both_direct: v.both_direct, both_indirect: v.both_indirect, both_not_applicable: v.both_na, disputed: v.disputed }])),
    human_review: 0, student_measurement: 0,
    note: '두 AI 판정의 일치는 사람 검수 · 학생 성취가 아니다. relevance 는 전부 unknown — 일치한 direct·indirect 만 candidateRelevance(R1).',
    items_detail: items,
  }
  fs.mkdirSync(OUTDIR, { recursive: true })
  const jl = (rows) => rows.map((r) => JSON.stringify(r)).join('\n') + '\n'
  fs.writeFileSync(path.join(OUTDIR, `${batch}-item-task-links.jsonl`), jl(linked))
  fs.writeFileSync(path.join(OUTDIR, `${batch}-disputed-links.jsonl`), jl(disputed))
  // 중단 경보(T-0100 성공 기준 2): 안정 TASK 가 일치 .80 · κ .68 을 둘 다 밑돌면 stop. κ 가 null(단일 범주)이면 unclear — 통과로 치지 않는다
  summary.stop_alarm = Object.fromEntries(STABLE.filter((id) => summary.per_task[id]).map((id) => {
    const v = summary.per_task[id]
    return [v.display, v.kappa === null ? 'unclear' : v.agreement < 0.8 && v.kappa < 0.68 ? 'stop' : 'ok']
  }))
  summary.stop = Object.values(summary.stop_alarm).includes('stop')
  // 원문 대조 표본(성공 기준 3): R1 후보 10 · 갈림 10 — 삽입 · E1 · E3 를 앞에 두고 문항이 겹치지 않게(부족하면 전부)
  const prio = (l) => (byId.get(l.item)?.type_id === 'R-INSERT' ? 0 : l.task === 'e.task_demand' ? 1 : l.task === 'e.option_correspondence' ? 2 : 3)
  const pick = (rows) => {
    const seen = new Set()
    return [...rows].sort((x, y) => prio(x) - prio(y) || x.item.localeCompare(y.item)).filter((l) => !seen.has(l.item) && seen.add(l.item)).slice(0, 10)
      .map((l) => ({ item: l.item, task: l.task, display: l.display, judgments: l.judgments, state: l.state }))
  }
  fs.writeFileSync(path.join(OUTDIR, `${batch}-review-sample.json`), JSON.stringify({ batch, rule: 'R1 후보 10 · 갈림 10(삽입 · E1 · E3 우선 · 문항 중복 없음) — 원문 대조는 독립 검증자가 한다', candidates: pick(linked), disputed: pick(disputed) }, null, 1) + '\n')
  fs.writeFileSync(path.join(OUTDIR, `${batch}-agreement.json`), JSON.stringify(summary, null, 1) + '\n')
  if (summary.stop) console.log(`중단 경보: ${JSON.stringify(summary.stop_alarm)} — 다음 배치 전에 갈림을 원문으로 검토한다`)
  console.log(`쌍 ${summary.pairs} · 일치 ${summary.agreement} · κ ${summary.kappa} · 주 TASK 일치 ${summary.primary_task_agreement}/${byId.size} · R1 ${linked.length} · 갈림 ${disputed.length}`)
  for (const v of Object.values(summary.per_task)) console.log(`  ${v.display.padEnd(5)} 일치 ${v.agreement} κ ${v.kappa} 직접 ${v.both_direct} 간접 ${v.both_indirect} 무관 ${v.both_not_applicable} 갈림 ${v.disputed}`)
}

/** 출력(.out.json)을 고치기 전 원본을 보존한다(T-0111 U1 — 재표시 전 원본이 없어 독립성을 확인할 수 없었다). local/<batch>/history/<시각>-<label>/ */
function snapshot(label) {
  const dir = path.join(LOCAL, 'history', `${new Date().toISOString().replace(/[:.]/g, '-')}-${String(label ?? 'before-edit').replace(/[^A-Za-z0-9_-]/g, '_')}`)
  fs.mkdirSync(dir, { recursive: true })
  const files = fs.readdirSync(LOCAL).filter((f) => f.endsWith('.out.json'))
  for (const f of files) fs.copyFileSync(path.join(LOCAL, f), path.join(dir, f))
  const manifest = files.map((f) => ({ file: f, sha256: sha(fs.readFileSync(path.join(LOCAL, f), 'utf8')) }))
  fs.writeFileSync(path.join(dir, 'manifest.json'), JSON.stringify({ batch, label, files: manifest }, null, 1))
  console.log(`보존 ${files.length}개 → ${path.relative(ROOT, dir)}`)
}

if (cmd === 'chunks') chunks()
else if (cmd === 'snapshot') snapshot(process.argv[4])
else if (cmd === 'validate') validate(process.argv[4], process.argv[5])
else if (cmd === 'agree') agree()
else { console.error('<batch> chunks | validate [A|B] | agree | snapshot <label>'); process.exit(2) }
