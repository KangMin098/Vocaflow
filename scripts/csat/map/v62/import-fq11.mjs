// scripts/csat/map/v62/import-fq11.mjs
//
// v6.2 P-F8c — FQ1.1(research/factory-qualification-v11 · a658fa39a) 최종 선택 16개를 제품 쪽 **읽기 전용 스냅샷**으로 옮긴다.
// 옮기는 것: 콘텐츠 id · revision · 산출물 sha256 · TASK · 요청 역할 · 코호트 · A~H 축(상태 · 방법 · 검토 revision · 근거 sha256 · 이유 문장).
// 옮기지 않는 것: 로컬 근거 경로 · 원문 · 정답 · Gold · 응답(연구 원장에만). 연구 원장의 최초 판정 · 수치는 고치지 않는다.
//   node scripts/csat/map/v62/import-fq11.mjs [--ref a658fa39a]
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = path.resolve(import.meta.dirname, '../../../..')
const REF = process.argv.includes('--ref') ? process.argv[process.argv.indexOf('--ref') + 1] : 'a658fa39a'
const FILE = 'docs/research/factory-qualification-v11/data/final-qualification.json'
const raw = JSON.parse(execFileSync('git', ['-C', ROOT, 'show', `${REF}:${FILE}`], { encoding: 'utf8', maxBuffer: 64 << 20 }))

const out = {
  source: { branch: 'research/factory-qualification-v11', commit: REF, file: FILE, version: raw.version, scope: raw.scope },
  counts: raw.counts,
  selected: raw.selected.map((r) => ({
    content: { id: r.content_id, revision: r.revision, sha256: r.artifact_sha256 },
    task: r.task_id,
    role: r.requested_role,
    cohort: r.cohort,
    issues: r.original_issue_ids ?? [],
    review: r.bounded_review_status,
    ambiguity: r.remaining_ambiguity ?? null,
    axes: Object.fromEntries(Object.entries(r.axes).map(([k, v]) => [k, {
      state: v.state, method: v.method, reviewRevision: v.review_revision,
      evidenceSha256: v.evidence_ref?.sha256 ?? null, reason: v.reason ?? null,
    }])),
  })),
}
const text = JSON.stringify(out, null, 2)
if (/[A-Za-z]:[\\/]|scripts\/research\/[^"]*\/local\//.test(text)) throw new Error('로컬 경로가 스냅샷에 섞였다')
const file = path.join(ROOT, 'apps/web/src/lib/csat/map/v62/fq11-candidates.data.json')
fs.writeFileSync(file, text + '\n')
console.log(`selected ${out.selected.length} · full_AH ${raw.counts.full_AH_qualified} · public ${raw.counts.public_qualified} · ${path.relative(ROOT, file)}`)
