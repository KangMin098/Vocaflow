// scripts/csat/map/v4/content-candidates.mts
//
// 학습 지도 rev4.0 3차 §7 — 확인 · 적용 콘텐츠 확대 후보(읽기 전용 · 주석을 만들지 않는다 · 공개하지 않는다).
// 과제 키마다 대상 유형의 평가원 문항을 골격 파일(src/lib/csat/skeleton-data — 학평 골격은 DB · 재배포 금지라 제외)에서 모아
// 문항별로 점검한다: 골격 문장 수 · 근거 표시 · 해설 발행 · 근거 위치 · 보류 · 기존 주석 · 확인 묶음 소속 · 사전 노출(진단 반영 시험).
//   cd apps/web && node --env-file=.env.local --import tsx ../../scripts/csat/map/v4/content-candidates.mts
// 출력: docs/csat-learner/v4/content-candidates.json · docs/csat-learner/LEARNING_MAP_V4_CONTENT_CANDIDATES.md(생성물)
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { createClient } from '@supabase/supabase-js'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const WEB = path.join(ROOT, 'apps/web/src/lib')
if (!String(process.env.NEXT_PUBLIC_SUPABASE_URL).includes('jajenrevcbmrpaliomxv')) throw new Error('개발 프로젝트가 아니다')
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL as string, process.env.SUPABASE_SERVICE_ROLE_KEY as string, { auth: { persistSession: false } })

// 과제 키 → 대상 유형(레지스트리와 같은 값 — evidence-locate.ts EVIDENCE_TASK_TYPES · 기존 cohesion 주석 문항의 유형) · 최소 문장 수
const TASKS: Record<string, { types: string[]; workspace: string; minSentences: number }> = {
  'cohesion-link': { types: ['R-ORDER', 'R-INSERT'], workspace: 'ws.cohesion', minSentences: 4 },
  'evidence-locate': { types: ['R-BLANK'], workspace: 'ws.evidence-locate', minSentences: 4 },
  'option-restate': { types: ['R-TOPIC', 'R-TITLE', 'R-GIST'], workspace: 'ws.option-match', minSentences: 4 },
}

type Sk = { id: string; no: number; type_id: string | null; sentences: unknown[]; anchors?: { id: string }[] }
const items: (Sk & { exam: string })[] = []
for (const f of fs.readdirSync(path.join(WEB, 'csat/skeleton-data')).filter((x) => x.endsWith('.json') && x !== 'index.json')) {
  const j = JSON.parse(fs.readFileSync(path.join(WEB, 'csat/skeleton-data', f), 'utf8')) as { exam_id: string; items: Sk[] }
  for (const it of j.items) items.push({ ...it, exam: j.exam_id })
}
// 기존 주석(손 주석 · 합의 주석) — 이미 콘텐츠인 문항
const annotated = new Map<string, string>()
for (const f of fs.readdirSync(path.join(WEB, 'knowledge/annotations'))) {
  const j = JSON.parse(fs.readFileSync(path.join(WEB, 'knowledge/annotations', f), 'utf8'))
  if (j.items) for (const [id, v] of Object.entries(j.items as Record<string, { key: string }>)) annotated.set(id, v.key)
  else if (j.itemId) annotated.set(j.itemId, f.replace(/-[^-]*\.v\d+\.json$/, '').replace(/-\d{4}$/, ''))
}
const target = items.filter((i) => i.type_id && Object.values(TASKS).some((t) => t.types.includes(i.type_id!)))
const ids = target.map((i) => i.id)
const chunks = <T,>(xs: T[], n: number) => Array.from({ length: Math.ceil(xs.length / n) }, (_, i) => xs.slice(i * n, i * n + n))
const analyses: { item_id: string; status: string; version: number; answer_locus: unknown }[] = []
for (const c of chunks(ids, 100)) {
  const { data, error } = await db.from('csat_item_analyses').select('item_id, status, version, answer_locus').in('item_id', c)
  if (error) throw new Error(error.message)
  analyses.push(...(data as typeof analyses))
}
const { data: apps, error: ae } = await db.from('knowledge_applications').select('surface, surface_ref, status, audience')
if (ae) throw new Error(ae.message)
const inConfirm = new Set<string>()
for (const a of apps as { surface: string; audience: { item?: string; items?: string[] } | null; status: string }[]) {
  if (a.surface !== 'learning_map_find') continue
  for (const x of [a.audience?.item, ...(a.audience?.items ?? [])]) if (x) inConfirm.add(x)
}
const examIds = [...new Set(target.map((i) => i.exam))]
const { data: exams, error: ee } = await db.from('csat_exams').select('id, label, diagnosis_ready').in('id', examIds)
if (ee) throw new Error(ee.message)
const exam = new Map((exams as { id: string; label: string; diagnosis_ready: boolean }[]).map((e) => [e.id, e]))
const { data: held } = await db.rpc('csat_ec_embargoed_exams', { p_exams: examIds })
const heldSet = new Set(((held ?? []) as unknown[]).map((r) => (typeof r === 'string' ? r : String(Object.values(r as object)[0]))))

const rows = target.map((i) => {
  const key = Object.entries(TASKS).find(([, t]) => t.types.includes(i.type_id!))![0]
  const pub = analyses.filter((a) => a.item_id === i.id && a.status === 'published').sort((a, b) => b.version - a.version)[0]
  const checks = {
    skeleton: i.sentences.length >= TASKS[key].minSentences,
    evidenceMarks: (i.anchors ?? []).some((a) => !a.id.startsWith('reject:')),
    analysis: !!pub,
    locus: !!pub?.answer_locus,
    notHeld: !heldSet.has(i.exam),
  }
  const already = annotated.get(i.id) ?? null
  // 사전 노출: 진단 반영 시험이면 학습자가 시험지로 이미 풀었을 수 있다 — 확인 문항으로는 불리(적용 문항으로는 가능)
  const exposedByExam = exam.get(i.exam)?.diagnosis_ready === true
  const ok = Object.values(checks).every(Boolean)
  const role = !ok ? 'not_ready' : already ? 'already_content' : exposedByExam ? 'transfer_only' : 'confirm_or_transfer'
  return { itemId: i.id, exam: i.exam, examLabel: exam.get(i.exam)?.label ?? i.exam, no: i.no, typeId: i.type_id, key, workspace: TASKS[key].workspace, sentences: i.sentences.length, checks, already, inConfirm: inConfirm.has(i.id), exposedByExam, role }
})
const summary = Object.fromEntries(Object.keys(TASKS).map((k) => {
  const r = rows.filter((x) => x.key === k)
  const by = (role: string) => r.filter((x) => x.role === role).length
  return [k, { items: r.length, confirm_or_transfer: by('confirm_or_transfer'), transfer_only: by('transfer_only'), already_content: by('already_content'), not_ready: by('not_ready'), missing: Object.fromEntries(Object.keys(r[0]?.checks ?? {}).map((c) => [c, r.filter((x) => !(x.checks as Record<string, boolean>)[c]).length])) }]
}))
fs.writeFileSync(path.join(ROOT, 'docs/csat-learner/v4/content-candidates.json'), JSON.stringify({ generated_by: 'scripts/csat/map/v4/content-candidates.mts', summary, rows }, null, 1) + '\n')

const ROLE: Record<string, string> = { confirm_or_transfer: '확인 · 적용 후보', transfer_only: '적용 후보만(시험지 노출)', already_content: '이미 콘텐츠', not_ready: '준비 부족' }
const md = ['# 학습 지도 rev4.0 — 콘텐츠 확대 후보(생성물)', '',
  '> **생성물 — 손으로 고치지 않는다.** `scripts/csat/map/v4/content-candidates.mts`(읽기 전용). 후보는 **자동 점검을 통과한 문항**일 뿐이다 — 교육적 일치 · 정답/해설 타당성 · 주석(합의) · Evidence Anchor 결속 · 맹검 채택 · 공개 승인은 사람과 기존 절차가 한다. 이 목록으로 Workspace 를 완결로 올리지 않는다.',
  '> 평가원만(학평 골격은 DB · 재배포 금지라 이 파일 기반 조사에서 제외). 「적용 후보만」 = 진단 반영 시험(학습자가 시험지로 이미 풀었을 수 있음) — 독립 확인 문항으로 쓰지 않는다.', '> **자동 점검의 한계**: 골격 파일은 해설이 발행된 문항으로만 만들어져 골격 · 해설 · 근거 위치 점검은 거의 다 통과한다(준비 부족 0 은 거름이 약하다는 뜻). **문장 잇기 대상에 R-INSERT(문장 삽입)를 넣은 것은 가설** — 지금 주석은 R-ORDER(글의 순서) 한 문항뿐이다. 삽입 문항이 같은 과제(앞 문장과 이어 주는 단서)로 채점 가능한지 주석 1–2문항으로 먼저 확인한다.', '', '## 요약', '',
  '| 과제 키 | Workspace | 대상 문항 | 확인 · 적용 후보 | 적용 후보만 | 이미 콘텐츠 | 준비 부족 | 부족 사유(문항 수) |', '|---|---|---|---|---|---|---|---|',
  ...Object.entries(summary).map(([k, s]) => `| ${k} | ${TASKS[k].workspace} | ${s.items} | ${s.confirm_or_transfer} | ${s.transfer_only} | ${s.already_content} | ${s.not_ready} | ${Object.entries(s.missing).filter(([, n]) => n).map(([c, n]) => `${c} ${n}`).join(' · ') || '—'} |`),
  '', '## 후보 문항', '', '| 과제 키 | 문항 | 시험 | 유형 | 문장 | 역할 | 확인 묶음 | 비고 |', '|---|---|---|---|---|---|---|---|',
  ...rows.filter((r) => r.role !== 'not_ready').sort((a, b) => a.key.localeCompare(b.key) || b.exam.localeCompare(a.exam) || a.no - b.no).map((r) => `| ${r.key} | ${r.itemId} | ${r.examLabel} | ${r.typeId} | ${r.sentences} | ${ROLE[r.role]} | ${r.inConfirm ? '들어 있음' : '—'} | ${r.already ? `주석 ${r.already}` : ''} |`),
  '', '## 검수 · 활성화 절차(기존 정책 — 자동화하지 않는다)', '',
  '1. 후보에서 과제 키별로 고른다 — 문장 잇기는 확인 문항 2개 이상이 있어야 직접 확인(서로 다른 2문항) 규칙이 돈다.',
  '2. 합의 주석: 기존 주석 파일 형식(`lib/knowledge/annotations/*.json`)으로 두 판정자 주석 → 일치 · 이견 기록(design-annotation-criteria).',
  '3. Evidence Anchor 결속: `scripts/csat/map/anchor-bind.mts` 로 원문 텍스트 해시 · 문자 범위에 묶고, 런타임 관문(anchorGate)이 통과하는지 확인.',
  '4. 맹검 채택(역할 학습자 시뮬레이션 · 실제 학습자 아님)으로 채점 · 문구 결함을 거른다.',
  '5. 적용 행(`knowledge_applications` csat_item_task · learning_map_find)을 draft 로 만들고 **공개 승인 뒤** active — 이 문서의 후보는 그 전 단계다.',
  '6. 기존 교재 생성 파이프라인 재사용: 골격 · 해설(answer_locus)은 재사용, 주석은 과제별 손 주석이라 드레인 재사용 불가(사람 합의 필요).', '']
fs.writeFileSync(path.join(ROOT, 'docs/csat-learner/LEARNING_MAP_V4_CONTENT_CANDIDATES.md'), md.join('\n'))
console.log(JSON.stringify(summary))
