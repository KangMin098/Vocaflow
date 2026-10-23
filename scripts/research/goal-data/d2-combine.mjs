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
const later = batches.flatMap((b) => [...readJsonl(path.join(DIR, `${b}-item-task-links.jsonl`)), ...readJsonl(path.join(DIR, `${b}-disputed-links.jsonl`))].map((l) => ({ ...l, contract: 'v2' })))
const rows = [...pilot, ...later]

const linked = rows.filter((l) => l.candidateRelevance)
const disputed = rows.filter((l) => l.state === 'DISPUTED')
const jl = (r) => r.map((x) => JSON.stringify(x)).join('\n') + '\n'
fs.writeFileSync(path.join(DIR, 'item-task-links.jsonl'), jl(linked))
fs.writeFileSync(path.join(DIR, 'disputed-links.jsonl'), jl(disputed))

// 배치 jsonl 에는 「둘 다 무관」 일치 쌍이 없다 — 판정 수 · 일치율은 배치 agreement.json 에서 읽는다(pilot-1 은 전 쌍이 있다)
const agreements = Object.fromEntries(batches.map((b) => [b, JSON.parse(fs.readFileSync(path.join(DIR, `${b}-agreement.json`), 'utf8'))]))
const items = new Set([...pilot.map((l) => l.item), ...Object.values(agreements).flatMap((a) => a.items_detail.map((i) => i.item_id))])
const exams = [...new Set([...items].map((i) => i.split('#')[0]))].sort()
const pairs = pilot.length + Object.values(agreements).reduce((s, a) => s + a.pairs, 0)
const perTask = Object.fromEntries(atomic.map((t) => {
  const r = rows.filter((l) => l.task === t.id)
  const p = pilot.filter((l) => l.task === t.id)
  return [t.id, {
    display: t.display, judged_items: p.length + Object.values(agreements).reduce((s, a) => s + a.per_task[t.id].n, 0),
    r1_direct_items: r.filter((l) => l.candidateRelevance === 'direct').map((l) => l.item),
    r1_indirect_items: r.filter((l) => l.candidateRelevance === 'indirect').length,
    disputed: r.filter((l) => l.state === 'DISPUTED').length,
    agreement: { 'pilot-1': Number((p.filter((l) => l.state !== 'DISPUTED').length / p.length).toFixed(3)), ...Object.fromEntries(batches.map((b) => [b, agreements[b].per_task[t.id].agreement])) },
    kappa: Object.fromEntries(batches.map((b) => [b, agreements[b].per_task[t.id].kappa])),
  }]
}))
const kappas = Object.fromEntries(batches.map((b) => [b, { kappa: agreements[b].kappa, agreement: agreements[b].agreement, items: agreements[b].items, pairs: agreements[b].pairs }]))
fs.writeFileSync(path.join(DIR, 'mapping-coverage.json'), JSON.stringify({
  generated_by: 'scripts/research/goal-data/d2-combine.mjs', generated_at: new Date().toISOString(),
  note: '모든 링크 relevance=unknown(사람 검수 전). candidateRelevance 는 두 독립 AI 판정 일치(R1)일 뿐 Gold · 학생 측정이 아니다. 제품 NeedRank 입력 금지(relevance.ts 계약).',
  scope: { items: items.size, exams, atomic_tasks: atomic.length, pairs, r1_links: linked.length, disputed: disputed.length, frame_note: '평가원 · 수능 최근 시험 표본(분석 적격 3,355 · 평가원 · 수능 802 중 80) — 전체 대표 표본 아님' },
  batch_agreement: kappas, per_task: perTask,
}, null, 1) + '\n')
console.log(`문항 ${items.size} · 쌍 ${pairs} · R1 ${linked.length} · 갈림 ${disputed.length} · 시험 ${exams.join(',')}`)
