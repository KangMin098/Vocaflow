// scripts/research/goal-data/d2-combine.mjs
//
// D2 결합 산출물 — 1차 표본(pilot-1 · 계약 v1 · 21 TASK)과 이후 배치(계약 v2 · 18 원자 TASK)의 링크를 한 형식으로 모은다.
//   node scripts/research/goal-data/d2-combine.mjs
// 출력(생성물): docs/research/goal-data-batches/D2-task-mapping/{item-task-links,disputed-links}.jsonl · mapping-coverage.json
// 통합 관찰 3 TASK 의 pilot-1 판정은 v2 에서 문항 단위 판정 대상이 아니므로 결합본에서 뺀다(원본은 pilot-links.json 에 남는다).
import fs from 'node:fs'
import path from 'node:path'

import { ROOT, nonHeldTasks } from '../../csat/map/v62/data/pilot-lib.mjs'

const DIR = path.join(ROOT, 'docs/research/goal-data-batches/D2-task-mapping')
const atomic = nonHeldTasks().filter((t) => t.kind !== 'integrated')
const atomicIds = new Set(atomic.map((t) => t.id))
const readJsonl = (f) => fs.readFileSync(f, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l))

const pilot = JSON.parse(fs.readFileSync(path.join(ROOT, 'docs/csat-learner/v62/data-expansion/pilot-links.json'), 'utf8')).links
  .filter((l) => atomicIds.has(l.task))
  .map((l) => ({ batch: 'pilot-1', contract: 'v1', item: l.item, exam_id: l.item.split('#')[0], task: l.task, display: l.display, relevance: 'unknown', candidateRelevance: l.candidateRelevance, state: l.state, tier: l.tier, judgments: l.judgments, anchors: l.anchors, why: l.why, source_sha256: l.source_sha256 }))
const batches = fs.readdirSync(DIR).filter((f) => f.endsWith('-agreement.json')).map((f) => f.replace('-agreement.json', ''))
// 재판정 배치가 있으면 같은 문항의 이전 판정을 대체한다(b3-insert: 주어진 문장 오독으로 무효가 된 pilot-1 · b2 삽입 8문항)
const SUPERSEDES = { 'b3-insert': ['pilot-1', 'b2-v2'] }
const superseded = new Set(Object.entries(SUPERSEDES).filter(([b]) => batches.includes(b))
  .flatMap(([b]) => JSON.parse(fs.readFileSync(path.join(DIR, `${b}-agreement.json`), 'utf8')).items_detail.map((i) => i.item_id)))
const replaced = (l) => superseded.has(l.item) && Object.entries(SUPERSEDES).some(([b, olds]) => batches.includes(b) && olds.includes(l.batch))
// 제3 판정(R3 · CONTRACT_V2_1 §1): A · B 중 한쪽과 같으면 다수 판정 — 셋이 모두 다르면 갈림 유지
const THIRD = path.join(ROOT, 'scripts/research/goal-data/local/b2-v2/r3-third.out.json')
const third = fs.existsSync(THIRD) ? new Map(JSON.parse(fs.readFileSync(THIRD, 'utf8')).rows.map((r) => [r.item_id, r.relevance])) : new Map()
const withThird = (l) => {
  if (l.batch !== 'b2-v2' || l.task !== 'r.discourse_function' || l.state !== 'DISPUTED' || !third.has(l.item)) return l
  const c = third.get(l.item)
  const majority = c === l.judgments.A || c === l.judgments.B ? c : null
  return { ...l, judgments: { ...l.judgments, C: c }, state: majority ? 'MAJORITY_OF_THREE' : 'DISPUTED', candidateRelevance: majority === 'direct' || majority === 'indirect' ? majority : null, tier: majority ? 'R1' : 'R0' }
}
// 배치가 판정에 쓴 계약 — agreement.json 의 contracts 경로에서 가장 높은 버전(CONTRACT_V2_3.md → v2.3)
const contractOf = (b) => { const paths = JSON.parse(fs.readFileSync(path.join(DIR, `${b}-agreement.json`), 'utf8')).contracts.map((c) => c.path); const v = paths.map((p) => p.match(/CONTRACT_V2(?:_(\d))?\.md$/)).filter(Boolean).map((m) => (m[1] ? `v2.${m[1]}` : 'v2')); return v.sort().at(-1) ?? 'v1' }
const later = batches.flatMap((b) => { const c = contractOf(b); return [...readJsonl(path.join(DIR, `${b}-item-task-links.jsonl`)), ...readJsonl(path.join(DIR, `${b}-disputed-links.jsonl`))].map((l) => ({ ...l, contract: c })) })
// 독립 검증이 반박한 판정 근거(<batch>-corrections.json) — 상태 · 수치는 바꾸지 않고 refuted_rationale 만 붙인다
const corrections = new Map(batches.flatMap((b) => { const f = path.join(DIR, `${b}-corrections.json`); return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')).corrections.map((c) => [`${b}|${c.item}|${c.task}`, c]) : [] }))
const withCorrection = (l) => { const c = corrections.get(`${l.batch}|${l.item}|${l.task}`); return c ? { ...l, refuted_rationale: { track: c.track, note: c.note, contract_fix: c.contract_fix } } : l }
const rows = [...pilot, ...later].filter((l) => !replaced(l)).map(withThird).map(withCorrection)

const linked = rows.filter((l) => l.candidateRelevance)
const disputed = rows.filter((l) => l.state === 'DISPUTED')
const jl = (r) => r.map((x) => JSON.stringify(x)).join('\n') + '\n'
fs.writeFileSync(path.join(DIR, 'item-task-links.jsonl'), jl(linked))
fs.writeFileSync(path.join(DIR, 'disputed-links.jsonl'), jl(disputed))

// 배치 jsonl 에는 「둘 다 무관」 일치 쌍이 없다 — 판정 수 · 일치율은 배치 agreement.json 에서 읽는다(pilot-1 은 전 쌍이 있다)
const agreements = Object.fromEntries(batches.map((b) => [b, JSON.parse(fs.readFileSync(path.join(DIR, `${b}-agreement.json`), 'utf8'))]))
const items = new Set([...pilot.map((l) => l.item), ...Object.values(agreements).flatMap((a) => a.items_detail.map((i) => i.item_id))])
const exams = [...new Set([...items].map((i) => i.split('#')[0]))].sort()
// 대체된 문항은 옛 배치(pilot-1 또는 b2-v2)에서 문항당 한 번씩 판정됐다 — 그만큼 판정 수에서 뺀다
const pairs = pilot.length + Object.values(agreements).reduce((s, a) => s + a.pairs, 0) - superseded.size * atomic.length
const perTask = Object.fromEntries(atomic.map((t) => {
  const r = rows.filter((l) => l.task === t.id)
  const p = pilot.filter((l) => l.task === t.id)
  return [t.id, {
    display: t.display, judged_items: p.length + Object.values(agreements).reduce((s, a) => s + (a.per_task[t.id]?.n ?? 0), 0) - superseded.size,
    r1_direct_items: r.filter((l) => l.candidateRelevance === 'direct').map((l) => l.item),
    r1_indirect_items: r.filter((l) => l.candidateRelevance === 'indirect').length,
    disputed: r.filter((l) => l.state === 'DISPUTED').length,
    agreement: { 'pilot-1': Number((p.filter((l) => l.state !== 'DISPUTED').length / p.length).toFixed(3)), ...Object.fromEntries(batches.map((b) => [b, agreements[b].per_task[t.id]?.agreement ?? null])) },
    kappa: Object.fromEntries(batches.map((b) => [b, agreements[b].per_task[t.id]?.kappa ?? null])),
  }]
}))
const kappas = Object.fromEntries(batches.map((b) => [b, { kappa: agreements[b].kappa, agreement: agreements[b].agreement, items: agreements[b].items, pairs: agreements[b].pairs }]))
fs.writeFileSync(path.join(DIR, 'mapping-coverage.json'), JSON.stringify({
  generated_by: 'scripts/research/goal-data/d2-combine.mjs', generated_at: new Date().toISOString(),
  note: '모든 링크 relevance=unknown(사람 검수 전). candidateRelevance 는 두 독립 AI 판정 일치(R1)일 뿐 Gold · 학생 측정이 아니다. 제품 NeedRank 입력 금지(relevance.ts 계약).',
  scope: { items: items.size, exams, atomic_tasks: atomic.length, pairs, r1_links: linked.length, disputed: disputed.length, frame_note: `평가원 · 수능 최근 시험 표본(평가원 · 수능 802 중 ${items.size}) — 전체 대표 표본 아님`, superseded_items: [...superseded].sort(), r3_third_judged: third.size },
  batch_agreement: kappas, per_task: perTask,
}, null, 1) + '\n')
console.log(`문항 ${items.size} · 쌍 ${pairs} · R1 ${linked.length} · 갈림 ${disputed.length} · 시험 ${exams.join(',')}`)
