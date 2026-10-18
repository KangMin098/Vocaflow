// scripts/csat/map/v62/import-research-v14.mjs
//
// v6.2 P-M3 — 연구 v1.4(research/csat-reading-v14) 전달 패킷을 제품 쪽 **읽기 전용 스냅샷**으로 옮긴다.
// 옮기는 것: TASK 별 교육 정의 · 방법 이름/적합성 · 설계 활동(id · 문항 id · 자료 역할 · 응답 단위 · 채점 facet 수) · 승격 게이트 ·
//           원문 결속 AI 검토 24행(문항 · 유형 · 두 판정 · 일치 여부). 옮기지 않는 것: 원문 · 선지 · 정답 · Gold · 채점 기준 문구 · 판정 이유(원문 인용 가능).
// 연구 판정은 제품에서 검증된 관련성 · 학생 능력이 아니다(R1). 6,310 자동 후보는 옮기지 않는다.
//   node scripts/csat/map/v62/import-research-v14.mjs [--from D:/workspace/Vocaflow-csat-reading-v14]
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = path.resolve(import.meta.dirname, '../../../..')
const FROM = process.argv.includes('--from') ? process.argv[process.argv.indexOf('--from') + 1] : 'D:/workspace/Vocaflow-csat-reading-v14'
const D = path.join(FROM, 'docs/research/csat-reading/data/v14')
const read = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'))
const head = execFileSync('git', ['-C', FROM, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()

const pk = read('education-packages.json')
const gate = read('final-gate.json')
const first = read('map-review.json')
const second = read('map-second-review.json')
const sec = new Map(second.rows.map((r) => [`${r.item_id}|${r.task_id}`, r]))

const tasks = pk.packages.map((p) => ({
  task: p.task_id,
  display: p.display,
  definition: p.contracts.educational_definition,
  gate: p.promotion_gate,
  methods: p.methods.map((m) => ({ id: m.method_id, name: m.name, suitability: m.suitability })),
  materialRoles: [...new Set(p.materials.map((m) => m.role))],
  activities: pk.activities.filter((a) => a.task_id === p.task_id).map((a) => ({
    id: a.activity_id,
    item: a.item_id,
    role: a.material_role,
    responseUnit: typeof a.learner_response_unit === 'string' ? a.learner_response_unit : JSON.stringify(a.learner_response_unit).slice(0, 120),
    facets: Array.isArray(a.analytic_rubric_facets) ? a.analytic_rubric_facets.length : Object.keys(a.analytic_rubric_facets ?? {}).length,
  })),
}))

const links = first.rows.map((r) => {
  const s = sec.get(`${r.item_id}|${r.task_id}`)
  const second = s?.relevance ?? null
  return { task: r.task_id, item: r.item_id, type: r.type_id, first: r.relevance, second, agree: second !== null && second === r.relevance }
})

const out = {
  source: { branch: 'research/csat-reading-v14', commit: head, files: ['education-packages.json', 'final-gate.json', 'map-review.json', 'map-second-review.json'], importedAt: new Date().toISOString().slice(0, 10) },
  status: {
    release: gate.R_C?.release ?? 'hold',
    r3Approved: gate.R_C?.independent_AI_counts?.R3_approved ?? 0,
    humanValidation: gate.R_C?.independent_AI_counts?.human_validation ?? 0,
    studentValidation: gate.R_C?.independent_AI_counts?.student_validation ?? 0,
    activities: gate.R_C?.independent_AI_counts?.actual_activities ?? null,
    facets: gate.R_C?.independent_AI_counts?.actual_facets ?? null,
    forbidden: gate.forbidden ?? [],
  },
  mapping: { reviewedNew: first.rows.length, cumulativeReviewOpportunities: 98, unreviewed: 23482, automaticCandidates: 6310, note: '자동 후보는 옮기지 않았다 · 98 은 검토 기회이지 합의된 관련성이 아니다' },
  tasks,
  links,
}
const file = path.join(ROOT, 'apps/web/src/lib/csat/map/v62/research-v14.data.json')
fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n')
console.log(`tasks ${tasks.length} · activities ${tasks.reduce((s, t) => s + t.activities.length, 0)} · links ${links.length} (agree ${links.filter((l) => l.agree).length}) · ${path.relative(ROOT, file)}`)
