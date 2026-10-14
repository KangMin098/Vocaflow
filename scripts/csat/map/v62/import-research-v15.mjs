// scripts/csat/map/v62/import-research-v15.mjs
//
// v6.2 P-F5b — 연구 v1.5(research/csat-reading-v15) 전달 패킷을 제품 쪽 **읽기 전용 스냅샷**으로 옮긴다.
// 옮기는 것: V2 · S5 우선 활동 후보 8(후보 id · 문항 id · 시험 메타 · 공유 지문 묶음 · TASK · 원 문항 관련성 · 분석 버전) ·
//           자료 역할 사용 수 · 시험 원천 상태(미지원 시험 id · 분모) · 자격 수치(공개 0 · 직접 평가 0 · 학생 0).
// 옮기지 않는 것: 원문 · 선지 · 정답 · Gold · 합성 응답 · 개별 판정 · 원문 경로(로컬 연구 파일).
//   node scripts/csat/map/v62/import-research-v15.mjs [--from D:/workspace/Vocaflow-csat-reading-v15]
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'

const ROOT = path.resolve(import.meta.dirname, '../../../..')
const FROM = process.argv.includes('--from') ? process.argv[process.argv.indexOf('--from') + 1] : 'D:/workspace/Vocaflow-csat-reading-v15'
const D = path.join(FROM, 'docs/research/csat-reading/data/v15')
const read = (f) => JSON.parse(fs.readFileSync(path.join(D, f), 'utf8'))
const head = execFileSync('git', ['-C', FROM, 'rev-parse', '--short', 'HEAD'], { encoding: 'utf8' }).trim()

const handoff = read('handoff.json')
const cands = read('content-candidates-revision1.json')
const delivery = read('content-delivery-revision3.json')
const exams = read('exam-sources.json')

const out = {
  source: { branch: 'research/csat-reading-v15', commit: head, files: ['handoff.json', 'content-candidates-revision1.json', 'content-delivery-revision3.json', 'exam-sources.json'], importedAt: new Date().toISOString().slice(0, 10) },
  counts: {
    priorityActivities: handoff.counts.total_priority_activities,
    newActivities: handoff.counts.new_activity_candidates,
    materialRoleUses: handoff.counts.material_role_uses,
    publicQualified: handoff.counts.public_qualified,
    assessmentQualified: handoff.counts.assessment_qualified,
    students: handoff.counts.students,
    humanOrRightsApproved: handoff.counts.human_or_rights_approved,
  },
  workspaces: handoff.education_content_packet.workspace_ids,
  candidates: cands.candidates.map((c) => ({
    id: c.candidate_id,
    item: c.item_id,
    task: c.task_id,
    exam: { kind: c.exam.exam_kind, year: c.exam.academic_year, form: c.exam.form, no: c.exam.question_number },
    sharedPassageGroup: c.shared_passage_group,
    derivedRelevance: c.derived_task_relevance,
    originalRelevance: c.original_exam_task_relevance,
    analysisVersion: c.analysis_version,
  })),
  roles: { uses: delivery.role_uses, qualifiedPublic: delivery.qualified_public, qualifiedDirectAssessment: delivery.qualified_direct_assessment, actualStudents: delivery.actual_students },
  examSources: { counts: exams.counts, unsupported: exams.unsupported_ids, denominator: exams.denominator },
}
const file = path.join(ROOT, 'apps/web/src/lib/csat/map/v62/research-v15.data.json')
fs.writeFileSync(file, JSON.stringify(out, null, 2) + '\n')
console.log(`candidates ${out.candidates.length} · roles ${out.roles.uses} · unsupported exams ${out.examSources.unsupported.join(',')} · ${path.relative(ROOT, file)}`)
