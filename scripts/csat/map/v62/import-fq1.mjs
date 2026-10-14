// scripts/csat/map/v62/import-fq1.mjs
//
// v6.2 P-F6b — Factory Qualification v1.0(research/factory-qualification-v1) 판정 20건을 제품 쪽 **읽기 전용 스냅샷**으로 옮긴다.
// 옮기는 것: 콘텐츠 id · revision · TASK · 요청 역할 · A~H 축 상태(+ 막힌 이유 한 줄) · 적격 역할 · 공개/평가 자격.
// 옮기지 않는 것: 원문 · 생성문 · 정답 · Gold · 로컬 경로 · PDF 이름 · 해시 근거 원문(연구 원장에만).
//   node scripts/csat/map/v62/import-fq1.mjs [--from D:/workspace/Vocaflow-factory-qualification-v1]
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = path.resolve(import.meta.dirname, '../../../..')
const FROM = process.argv.includes('--from') ? process.argv[process.argv.indexOf('--from') + 1] : 'D:/workspace/Vocaflow-factory-qualification-v1'
const D = path.join(FROM, 'docs/research/factory-qualification/data')
const raw = JSON.parse(fs.readFileSync(path.join(D, 'qualification-results.json'), 'utf8'))
const list = Array.isArray(raw) ? raw : raw.results
const head = execFileSync('git', ['-C', FROM, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()

const out = {
  source: { branch: 'research/factory-qualification-v1', commit: head, file: 'data/qualification-results.json', rulesVersion: 'FQ1.0', importedAt: new Date().toISOString().slice(0, 10) },
  results: list.map((r) => ({
    content: { id: r.content.id, revision: String(r.content.revision) },
    task: r.task_id,
    role: r.requested_role,
    axes: Object.fromEntries(Object.entries(r.axes).map(([k, v]) => [k, { state: v.state }])),
    eligibleRoles: r.eligible_roles,
    publicQualified: r.public_qualified,
    assessmentQualified: r.assessment_qualified,
  })),
}
const file = path.join(ROOT, 'apps/web/src/lib/csat/map/v62/fq1-results.data.json')
fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n')
console.log(`results ${out.results.length} · eligible ${out.results.filter((r) => r.eligibleRoles.length).length} · ${path.relative(ROOT, file)}`)
