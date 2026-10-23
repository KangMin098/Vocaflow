// docs/research/goal-data-batches/D4-assessment/_classify.mjs
// D4 2단계 — _compute.mjs 결과에 TASK별 5분류 · 완료 기준 5문항 답 · 평가 체계 불일치를 더한다(읽기 전용 실측 + 규칙 표).
// 실행(저장소 루트): node docs/research/goal-data-batches/D4-assessment/_compute.mjs && node --experimental-strip-types docs/research/goal-data-batches/D4-assessment/_classify.mjs
// 분류는 AI 감사 판정이다. 사람 Gold · 출시 승인이 아니며, 코드북 · 평가 정본을 바꾸지 않는다.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'docs/research/goal-data-batches/D4-assessment')
const readOut = (f) => JSON.parse(fs.readFileSync(path.join(OUT, f), 'utf8'))
const writeOut = (f, v) => fs.writeFileSync(path.join(OUT, f), JSON.stringify(v, null, 2) + '\n')
const lineOf = (p, re) => {
  const lines = fs.readFileSync(path.join(ROOT, p), 'utf8').split(/\r?\n/)
  const i = lines.findIndex((l) => re.test(l))
  return i < 0 ? null : `${p}:${i + 1}`
}

const { V4_DATA } = await import(pathToFileURL(path.join(ROOT, 'apps/web/src/lib/csat/map/v4/definition.data.ts')).href)
// definition.ts checkKeysOfTask 와 같은 규칙 — 보류 아님 · 중심 TASK 1개인 Template 의 content_keys 만 그 TASK 의 정본 확인 키다
const canonKeys = (id) => V4_DATA.templates.filter((w) => !w.hold && w.core.length === 1 && w.core[0] === id).flatMap((w) => w.content_keys)
const auxOf = (id) => V4_DATA.templates.filter((w) => !w.hold && (w.aux ?? w.support ?? []).includes(id)).map((w) => w.id)

const DIAG = 'apps/web/src/lib/csat/map/skill-diagnosis.ts'
const ASIS = 'apps/web/src/lib/csat/map/v4/as-is.ts'
const DEF = 'apps/web/src/lib/csat/map/v4/definition.ts'
const refs = {
  resolve_streak: lineOf(DIAG, /if \(streak >= CHECK_ITEMS\)/),
  verify_requires_no_correct: lineOf(DIAG, /if \(e\.ok\) break/),
  practice_excluded: lineOf(DIAG, /activity === 'practice'\) continue/),
  unverified_to_checking: lineOf(ASIS, /independent\.size > 0 \? 'checking'/),
  skill_to_task: lineOf(ASIS, /const SKILL_TO_TASK/),
  core_only_keys: lineOf(DEF, /export const checkKeysOfTask/),
}

// 5분류 — 규칙(우선순위 위에서 아래):
//   tool_missing          독립 평가 도구가 없다(등록 세트 0 · 정본 확인 키 0 · 설계상 관찰만 포함)
//   criterion_unverified  도구는 있으나 코드북 도달 조건의 핵심 요소(다른 날 · 서로 다른 지문 · 연속 수 · 유형/포인트 구분 · 독립성)를 판정이 검사하지 않는다
//   partial               도달 조건이 산출형인데 선택형 proxy 로만 잰다
//   human_gate            계약은 형식상 충족 — 근거가 창작 세트뿐이라 사람 Gold · 권리 · 출시 승인 전에는 실제 근거가 아니다
//   assessable            계약 형식 충족 + 정본 확인 키(기출 문항 묶음)가 있어 사람 승인 없이도 직접 확인이 돈다
const CLASS = {
  'v.core_meaning': ['tool_missing', '등록 창작 세트 · 정본 확인 키 · FSRS→지도 결속 코드 모두 없음'],
  's.o.sentence_meaning_model': ['tool_missing', '설계상 관찰 전용 — 숙달 판정 도구가 없다(정본 「숙달도 계산 없음」)'],
  'r.o.global_meaning_model': ['tool_missing', '설계상 관찰 전용'],
  'e.o.final_judgment': ['tool_missing', '설계상 관찰 전용 · 「추측 정답」을 가를 응답 형식이 없다'],
  'v.contextual_sense': ['criterion_unverified', '「서로 다른 문맥 2」 — 판정은 문항 구분만 본다'],
  's.sentence_core': ['criterion_unverified', '「3문장 연속」 — 해소 규칙은 연속 2'],
  's.attachment': ['criterion_unverified', '「다른 문장에서도」 — 지문 구분 미검사 · 독립 2/전이 1로 여분도 가장 적다'],
  's.form_scope': ['criterion_unverified', '「포인트별 서로 다른 문항 2」 — 포인트 구분 필드가 판정에 없다'],
  'r.reference': ['criterion_unverified', '「서로 다른 지문 2」 — 지문 구분 미검사'],
  'r.discourse_function': ['criterion_unverified', 'R4 와 같은 형식 · 같은 채점 함수 — 정본의 독립 관찰 조건을 확인할 코드가 없다'],
  'r.discourse_structure': ['criterion_unverified', 'R3 와 같은 이유'],
  'r.central_meaning': ['criterion_unverified', '「다른 날 재확인」 — 경과 일수 미검사(정본 확인 키 claim-support 는 있음)'],
  'e.task_demand': ['criterion_unverified', '「유형 2개 이상」 — 유형 구분 미검사'],
  'e.evidence_location': ['criterion_unverified', '「다른 날 재확인」 — 경과 일수 미검사(정본 확인 키 evidence-locate 는 있음)'],
  'v.multiword': ['partial', '「의미를 말한다」(산출) → 5지선다 proxy'],
  's.chunk_boundary': ['partial', '「풀어 쓴다」(산출) → 선택 + 이유 proxy'],
  's.structural_relation': ['partial', '「풀어 쓰기」(산출) → 선택형 proxy'],
  'v.semantic_relation': ['human_gate', '형식 충족 · 근거는 창작 세트뿐(정본 확인 키 없음, ws.option-match 에서는 보조 TASK 라 판정 안 받음)'],
  'r.inference': ['human_gate', '형식 충족 · 근거는 창작 세트뿐(ws.inference 는 content_keys 비어 있음)'],
  'r.relation': ['assessable', '형식 충족 + 정본 확인 키 cohesion-link'],
  'e.option_correspondence': ['assessable', '형식 충족 + 정본 확인 키 option-restate'],
}
const LABEL = { assessable: '실제 평가 가능', partial: '부분 평가 가능', tool_missing: '평가 도구 부족', criterion_unverified: '도달 조건 검증 부족', human_gate: '사람 Gold·권리 승인 대기' }

// 추가 자료 — 교수/평가/전이 무엇이 더 필요한가(콘텐츠 공급 · 판정 코드 · 응답 형식 구분)
const NEEDS = {
  'v.core_meaning': ['도구: FSRS(Flashcard/WordVault) 첫 인출 → 다른 날 재인출을 V1 근거로 결속하는 경로', '자료: 기출 빈도 어휘 목록(shared_dictionary) 기반 인출 문항 — 새 창작보다 기존 기록 재사용이 먼저'],
  'v.contextual_sense': ['판정: 서로 다른 passage 해시 2개 조건', '자료: 지연 문항 2개 이상'],
  'v.multiword': ['형식: 짧은 산출(뜻 쓰기) 응답 또는 정본에 proxy 명시', '자료: 지연 문항 2개 이상'],
  'v.semantic_relation': ['승인: 창작 세트 Gold · 권리', '자료: 지연 문항 2개 이상'],
  's.sentence_core': ['판정: 연속 3(코드북) 또는 코드북 수치 정정 — 사람 결정', '자료: 연속 3을 받치려면 독립+지연 문항 여분 확대'],
  's.chunk_boundary': ['형식: 풀어 쓰기 산출 또는 proxy 명시', '자료: 지연 문항 2개 이상'],
  's.attachment': ['자료: 독립 2→4, 전이 1→2(다른 세트와 같은 수준)', '판정: 서로 다른 문장/지문 조건'],
  's.structural_relation': ['형식: 풀어 쓰기 산출 또는 proxy 명시', '자료: 지연 문항 2개 이상'],
  's.form_scope': ['데이터: 문항별 문법 포인트 태그 + 포인트별 2문항 판정', '자료: 포인트 수 × 2 이상의 독립 문항'],
  's.o.sentence_meaning_model': ['관찰: 기출 문장 통째 해석 산출 과제(점수 없음)'],
  'r.reference': ['판정: 서로 다른 지문 2 조건', '자료: 지연 문항 2개 이상'],
  'r.relation': ['자료: 지연 문항 2개 이상'],
  'r.discourse_function': ['근거: Gold tagging 으로 R3/R4 독립 관찰 확인(사람)', '형식: R4 와 구별되는 응답 형식 검토'],
  'r.discourse_structure': ['근거: R3 와 같음'],
  'r.central_meaning': ['판정: 다른 날 최소 경과(값은 사람 결정)', '승인: T-0087 R5 패킷 결정란'],
  'r.inference': ['승인: 창작 세트 Gold · 권리', '자료: 정본 확인 키(기출 추론 문항 묶음) 연결'],
  'r.o.global_meaning_model': ['관찰: 요지 · 구조 동시 응답 지문(점수 없음)'],
  'e.task_demand': ['데이터: 문항별 유형 태그 + 유형 2개 판정'],
  'e.evidence_location': ['판정: 다른 날 최소 경과'],
  'e.option_correspondence': ['자료: 지연 문항 2개 이상'],
  'e.o.final_judgment': ['형식: 선택 + 결정 근거 문장(E2 choice_evidence 재사용) — 근거가 틀린 정답은 근거로 세지 않음'],
}

const matrix = readOut('task-assessment-matrix.json')
const counts = Object.fromEntries(Object.keys(LABEL).map((k) => [k, 0]))
for (const t of matrix.tasks) {
  const c = CLASS[t.task]
  if (!c) throw new Error(`분류 규칙 없음: ${t.task}`)
  counts[c[0]]++
  const keys = canonKeys(t.task)
  const rc = t.role_counts
  const assessN = rc.independent_check + rc.transfer + rc.delayed_check
  t.canonical_check_keys = keys
  t.aux_in_templates = auxOf(t.task)
  t.assessment_class = { code: c[0], label: LABEL[c[0]], reason: c[1], release_gate: t.sets.some((s) => s.runtime_registered) ? '창작 세트 근거는 사람 Gold · 권리 · 출시 승인 전 실제 근거 아님' : null, verdict_source: 'AI 감사(_classify.mjs) — 사람 판정 아님' }
  t.completion_answers = {
    q1_learns: `${t.definition.goal} (조건: ${t.definition.conditions})`,
    q2_measurable: c[0] === 'tool_missing'
      ? '현재 직접 측정 불가 — ' + c[1]
      : `${t.formats.join(' · ') || '—'} 응답(닫힌 형식)으로 독립 ${rc.independent_check} · 전이 ${rc.transfer} · 지연 ${rc.delayed_check}문항(평가 ${assessN})${keys.length ? ` + 정본 확인 키 ${keys.join(',')}` : ''}`,
    q3_success_condition: c[0] === 'tool_missing'
      ? '정의된 성공 판정 없음(관찰 기록만 또는 경로 없음)'
      : `코드: 확인 문항 독립 첫 시도 2개 연속 실패로 확정 → 확정 뒤 처음 본 다른 문항 연속 ${2}정답이면 resolved(${refs.resolve_streak}). 코드북 기준: 「${t.definition.criterion}」`,
    q4_unverified: [c[1], ...(t.sets.some((s) => s.runtime_registered) ? ['창작 정답(gold 필드)은 AI 제안 — 사람 Gold 아님'] : []), '처음부터 맞히는 학습자의 「도달」 상태가 없다(M1)'],
    q5_needs: NEEDS[t.task] ?? [],
  }
}
matrix.classification = { generator: 'docs/research/goal-data-batches/D4-assessment/_classify.mjs', labels: LABEL, counts, code_refs: refs }
writeOut('task-assessment-matrix.json', matrix)

// 평가 체계 불일치 — 지시서 §3 항목별 실측
const gap = readOut('instrument-gap.json')
gap.mismatches = [
  { id: 'M1', title: '선행 실패 없는 도달 상태가 없다', severity: 'P1', evidence: [refs.verify_requires_no_correct, refs.unverified_to_checking, refs.skill_to_task],
    finding: '확정(verified)은 맞힌 문항 없이 2개가 막혀야 열리고, resolved 는 확정 뒤에만 온다. 첫 확인부터 맞히는 학습자는 unverified → 지도에서 checking 으로 남는다. 코드북 「도움 없이 맞힌다」 류 도달 조건을 만족해도 엔진이 「도달」로 읽을 상태가 없다.',
    impact: '목표 달성 엔진이 resolved 만 도달로 세면, 이미 할 줄 아는 TASK 를 계속 미도달로 계획한다.' },
  { id: 'M2', title: '코드북 도달 조건 ≠ 공통 CHECK 2문항', severity: 'P1', evidence: [refs.resolve_streak],
    finding: '공통 규칙은 「확정 뒤 연속 2정답」 하나다. 다른 날(R5 · E2 · V1), 서로 다른 지문/문맥(V2 · S3 · R1 · R5), 연속 3(S1), 포인트/유형별 2(S5 · E1)는 판정에 없다. 21개 중 코드북 기준과 공통 규칙이 형식상 같은 것은 V4 · R2 · R6 · E3 네 개.' },
  { id: 'M3', title: '개별 TASK 성공 ≠ 통합 능력 성공', severity: 'P2', evidence: ['apps/web/src/lib/csat/map/v4/observation.ts'],
    finding: 'S-O1 · R-O1 · E-O1 은 관찰만이고 숙달 판정이 없다. 하위 TASK 가 모두 resolved 여도 통합 성공을 확인하는 도구가 없으므로, 엔진은 하위 성공을 통합 성공(점수 · 등급)으로 합산하면 안 된다.' },
  { id: 'M4', title: '연습 성공을 독립 평가로 셀 위험', severity: 'P3(방어됨)', evidence: [refs.practice_excluded],
    finding: "activity='practice' 기록 · 도움 · 해설 뒤 · 합성 · 시각 불확실 시도는 판정에서 빠진다. 창작 세트 교수/안내 지문과 평가 지문의 해시 중복 0건. 남은 위험: validateAuthoredSet 은 passageGroup 이름만 보므로 지문을 공유하는 새 세트가 들어오면 조용히 깨진다." },
  { id: 'M5', title: '전이 · 지연 도구 부족', severity: 'P2',
    finding: 'transfer/delayed_check 는 공급 역할 · 라벨일 뿐 판정 조건이 아니다. 지연 문항은 R5 만 2개, 나머지 세트는 1개(첫 지연 확인에서 틀리면 다시 볼 문항이 없다). S3 은 전이 1개.' },
  { id: 'M6', title: '평가 도구가 없는 TASK', severity: 'P1', finding: 'V1(경로 없음) · S-O1 · R-O1 · E-O1(설계상 관찰). 정본 확인 키(기출 묶음)가 있는 TASK 는 R5 · E2 · R2 · E3 네 개뿐이고, 나머지 13개는 창작 세트(사람 승인 전)로만 직접 확인된다.' },
  { id: 'M7', title: '한 문항으로 여러 TASK 숙달 판정', severity: 'P3(방어됨)', evidence: [refs.core_only_keys],
    finding: '확인 키는 중심 TASK 가 하나인 Template 에만 붙고 보조 TASK 는 판정을 받지 않는다(ws.option-match 의 V4 · R5, ws.central-meaning 의 R3 · R4 등). 시도는 taskKey 하나를 갖는다. 남은 위험: R3/R4 는 같은 형식 · 채점 함수라 서로 다른 TASK 로 두 번 확인돼도 같은 능력을 두 번 잰 것일 수 있다.' },
]
gap.classification_counts = counts
writeOut('instrument-gap.json', gap)
console.log(counts)
