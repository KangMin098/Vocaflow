// scripts/csat/error-evidence/seed/validate-seed.mjs
//
// v0.1 conditional seed candidate 정적 검증 — DB 트리거가 막아 줄 것이라 가정하지 않고 seed 입력 자체를 본다.
// 입력: data/seed-v0.1-rows.json(build-seed.mjs 생성물) · data/seed-v0.1-conditional.json · SEED_DECISION.md
// 출력: data/seed-v0.1-validation.json · 종료 코드 0 = 통과 · 1 = 결함 · 3 = 결함 없음이나 미결 결정(게이트 미통과)
//
//   node scripts/csat/error-evidence/seed/validate-seed.mjs

import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../../..')
const CB_DIR = path.join(REPO, 'docs/csat-learner/codebook')
const rows = JSON.parse(fs.readFileSync(path.join(CB_DIR, 'data/seed-v0.1-rows.json'), 'utf8'))
const decision = JSON.parse(fs.readFileSync(path.join(CB_DIR, 'data/seed-v0.1-conditional.json'), 'utf8'))
const decisionMd = fs.readFileSync(path.join(CB_DIR, 'SEED_DECISION.md'), 'utf8')

const checks = []
const check = (area, name, ok, detail) => { checks.push({ area, name, ok: !!ok, ...(detail === undefined ? {} : { detail }) }); console.log(`${ok ? 'PASS' : 'FAIL'}  [${area}] ${name}${!ok && detail !== undefined ? ` — ${JSON.stringify(detail)}` : ''}`) }
const pending = []

// ── 생성물이 지금 정본에서 나온 것인가 ──
const sha = (f) => createHash('sha256').update(fs.readFileSync(path.join(CB_DIR, f))).digest('hex')
check('정본', '생성물의 코드북 해시 = 지금 코드북 파일', rows.generated_from.codebook_sha256 === sha(rows.generated_from.codebook))
check('정본', '코드북 판 = 결정의 codebook_basis(rev4.2 · c7001aff97b0)', rows.generated_from.codebook === 'CODEBOOK.rev4.2.md' && rows.generated_from.codebook_sha256.startsWith('c7001aff97b0'))
check('정본', '생성물의 결정 JSON 해시 = 지금 결정 JSON(다시 생성하지 않은 낡은 생성물 거부)', rows.generated_from.decision_json_sha256 === sha('data/seed-v0.1-conditional.json'))

// ── 결정 문서와 대조 ──
check('결정', '사전 등록 결과 문구 유지(「rev4 did not pass the preregistered v0.1 seed gate」) — JSON · SEED_DECISION 모두',
  decision.preregistered_result === 'rev4 did not pass the preregistered v0.1 seed gate' && decisionMd.includes('rev4 did not pass the preregistered v0.1 seed gate'))
check('결정', '이름 = v0.1 conditional seed candidate(validated · verified 표현 없음)', decision.name === 'v0.1 conditional seed candidate'
  && !/\b(validated|verified) taxonomy\b/i.test(rows.taxonomy.note.replace(/validated · verified taxonomy 가 아니다/, '')))
check('결정', '규칙 상태 — R9 · R12 accepted, R6 provisional', decision.rules.accepted.some((r) => /R9/.test(r)) && decision.rules.accepted.some((r) => /R12/.test(r))
  && decision.rules.provisional.length === 1 && /R6/.test(decision.rules.provisional[0]) && !decision.rules.accepted.some((r) => /R6/.test(r)))
check('결정', 'R6 rev4.4 없음(파일 · 금지 목록)', !fs.existsSync(path.join(CB_DIR, 'CODEBOOK.rev4.4.md')) && decision.not_allowed_until_pilot.some((x) => /rev4\.4/.test(x)))
check('결정', 'retire 코드 없음(결정 retired = [])', Array.isArray(decision.codes.retired) && decision.codes.retired.length === 0)

// ── taxonomy 버전 ──
const v = rows.taxonomy.version
check('taxonomy', '버전 형식 ^v숫자.숫자$(probe 증거 CHECK 와 같은 형식)', /^v[0-9]+\.[0-9]+$/.test(v ?? ''), v)
check('taxonomy', 'TEST fixture 버전이 아니다(v99.* 는 개발 DB smoke 전용)', !!v && !/^v99\./.test(v), v)
check('taxonomy', 'note 에 TEST 표시 없음 · conditional · 사전 등록 FAIL 명시', !/TEST/.test(rows.taxonomy.note) && /conditional/.test(rows.taxonomy.note) && /did not pass/.test(rows.taxonomy.note))

// ── 코드 ──
const C = rows.codes
const codeSet = new Set(C.map((c) => c.code))
const GROUPS = ['word', 'sentence', 'flow', 'evidence', 'choice', 'time']
check('코드', `개수 = 코드북 선언(${rows.declared_code_count}) = 19`, C.length === rows.declared_code_count && C.length === 19, C.length)
check('코드', '중복 없음', codeSet.size === C.length)
check('코드', '형식 ^[VSREBX]\\.[a-z_]+$ · 축 = 첫 글자', C.every((c) => /^[VSREBX]\.[a-z_]+$/.test(c.code) && c.axis === c.code[0]), C.filter((c) => !/^[VSREBX]\.[a-z_]+$/.test(c.code) || c.axis !== c.code[0]).map((c) => c.code))
check('코드', '라벨 · 정의 · 포함 · 제외 모두 비어 있지 않음', C.every((c) => [c.label, c.definition, c.inclusion, c.exclusion].every((x) => typeof x === 'string' && x.trim().length > 0)),
  C.filter((c) => ![c.label, c.definition, c.inclusion, c.exclusion].every((x) => x?.trim())).map((c) => c.code))
check('코드', '상태 — 모두 active(결정: 19개 모두 accepted · deprecated 없음)', C.every((c) => c.status === 'active'))
check('코드', 'V.wrong_sense · R.inference 코드 자체는 active(경계만 provisional)', C.find((c) => c.code === 'V.wrong_sense')?.status === 'active' && C.find((c) => c.code === 'R.inference')?.status === 'active')
check('코드', 'student_group — B 는 NULL · 그 밖은 허용 범주', C.every((c) => (c.axis === 'B' ? c.student_group === null : GROUPS.includes(c.student_group))),
  C.filter((c) => (c.axis === 'B' ? c.student_group !== null : !GROUPS.includes(c.student_group))).map((c) => c.code))
const covered = new Set(C.map((c) => c.student_group).filter(Boolean))
check('코드', '학생이 고를 수 있는 범주마다 대응 코드가 하나 이상(학생 범주 보고가 막히지 않게)', GROUPS.every((g) => covered.has(g)), GROUPS.filter((g) => !covered.has(g)))
if (decision.student_group_by_axis?.pending_decision) pending.push({ what: 'student_group', detail: decision.student_group_by_axis.pending_decision })
// E 축 — 2026-10-05 사용자 결정과 정확히 같아야 한다(생성물 · 결정 기록 모두)
const EXPECT_E = { 'E.evidence_location': 'evidence', 'E.task_misread': 'choice', 'E.option_mismatch': 'choice' }
const eRows = Object.fromEntries(C.filter((c) => c.axis === 'E').map((c) => [c.code, c.student_group]))
check('코드', 'E 축 학생 범주 = 결정(evidence_location→evidence · task_misread · option_mismatch→choice)',
  JSON.stringify(eRows, Object.keys(EXPECT_E).sort()) === JSON.stringify(EXPECT_E, Object.keys(EXPECT_E).sort())
  && JSON.stringify(decision.student_group_by_axis?.decision?.mapping, Object.keys(EXPECT_E).sort()) === JSON.stringify(EXPECT_E, Object.keys(EXPECT_E).sort()), eRows)
check('코드', '학생 범주는 원인 라벨이 아님 · task 범주 없음(결정 기록)', /cause label 이 아니다/.test(decision.student_group_by_axis?.decision?.not_cause_label ?? '') && !covered.has('task'))
// 정의 문구 안 코드 참조 — 이 판에 없는 코드(폐기된 B.guess · 다른 판 이름)를 가리키지 않는다
const refs = C.flatMap((c) => [c.definition, c.inclusion, c.exclusion].join(' ').match(/`[VSREBX]\.[a-z_]+`/g)?.map((x) => [c.code, x.slice(1, -1)]) ?? [])
const dangling = refs.filter(([, r]) => !codeSet.has(r))
check('코드', '정의 · 포함 · 제외가 참조하는 코드가 모두 이 판에 있음(폐기 · 다른 판 참조 없음)', dangling.length === 0, dangling)

// ── 경계 ──
const B = rows.boundaries
check('경계', '개수 1 — 결정의 provisional 경계 하나뿐', B.length === 1 && decision.boundaries.length === 1)
check('경계', '키 중복 없음', new Set(B.map((b) => b.boundary_key)).size === B.length)
for (const b of B) {
  check('경계', `${b.boundary_key} — 두 코드가 이 판의 코드`, codeSet.has(b.code_a) && codeSet.has(b.code_b))
  check('경계', `${b.boundary_key} — 순서 고정(code_a < code_b, C 정렬) · 키 = lower(a)__lower(b)`, b.code_a < b.code_b && b.boundary_key === `${b.code_a.toLowerCase()}__${b.code_b.toLowerCase()}`)
  check('경계', `${b.boundary_key} — 상태가 DB 값(accepted · provisional · retired)`, ['accepted', 'provisional', 'retired'].includes(b.status), b.status)
  check('경계', `${b.boundary_key} — probe 는 provisional 에만 · 형식 ^[a-z0-9_]+$`, b.probe_key === null || (b.status === 'provisional' && /^[a-z0-9_]+$/.test(b.probe_key)), b.probe_key)
  check('경계', `${b.boundary_key} — decision_note 비어 있지 않음`, typeof b.decision_note === 'string' && b.decision_note.trim().length > 0)
}
const r6 = B.find((b) => b.code_a === 'R.inference' && b.code_b === 'V.wrong_sense')
check('경계', 'R6 경계 = R.inference ↔ V.wrong_sense · provisional · probe r6_derivation_probe · 자동 확정 금지', r6?.status === 'provisional' && r6?.probe_key === 'r6_derivation_probe' && r6?.provenance?.auto_confirm === false, r6 && { status: r6.status, probe: r6.probe_key })
check('경계', 'provisional 경계는 R6 하나뿐(그 밖 경계를 provisional 로 만들지 않음)', B.filter((b) => b.status === 'provisional').length === 1)

// ── seed 가 아닌 것 ──
check('범위', 'seed 입력에 outcome · candidate_codes · evidence_profile · 회차 · 판정 없음(런타임 값 — DB 제약 · smoke 가 검증)',
  !['outcome', 'candidate_codes', 'evidence_profile', 'rounds', 'judgments'].some((k) => k in rows) && C.every((c) => !('candidate_codes' in c)))

const fail = checks.filter((c) => !c.ok)
const status = fail.length ? 'FAIL' : pending.length ? 'PENDING_DECISION' : 'PASS'
fs.writeFileSync(path.join(CB_DIR, 'data/seed-v0.1-validation.json'), JSON.stringify({ status, pass: checks.length - fail.length, fail: fail.length, pending, checks }, null, 1) + '\n')
console.log(`\n${status} · 검사 ${checks.length} · 통과 ${checks.length - fail.length} · 실패 ${fail.length} · 미결 ${pending.length}`)
for (const p of pending) console.log('미결:', p.what, '—', p.detail)
process.exitCode = fail.length ? 1 : pending.length ? 3 : 0
