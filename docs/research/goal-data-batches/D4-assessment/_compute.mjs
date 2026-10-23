// docs/research/goal-data-batches/D4-assessment/_compute.mjs
// D4 — TASK별 평가 계약 · 콘텐츠 공백 감사(읽기 전용 실측). 실행: node docs/research/goal-data-batches/D4-assessment/_compute.mjs (저장소 루트에서)
// 입력 파일은 읽기만 한다. 출력은 이 폴더의 JSON 3개. 사람 검수 결과 · Gold 를 만들거나 바꾸지 않는다. 숙달률 · 점수 예측 없음.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execSync } from 'node:child_process'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'docs/research/goal-data-batches/D4-assessment')
const AUTH = 'apps/web/src/lib/knowledge/authored'
const sha = (buf) => crypto.createHash('sha256').update(buf).digest('hex')
const fsha = (p) => sha(fs.readFileSync(path.join(ROOT, p)))
const readJson = (p) => JSON.parse(fs.readFileSync(path.join(ROOT, p), 'utf8'))
const lineOf = (p, re) => {
  const lines = fs.readFileSync(path.join(ROOT, p), 'utf8').split(/\r?\n/)
  const i = lines.findIndex((l) => re.test(l))
  return i < 0 ? null : `${p}:${i + 1}`
}

const HEAD = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim()
const GENERATED_AT = new Date().toISOString()

const authoredJson = fs.readdirSync(path.join(ROOT, AUTH)).filter((f) => f.endsWith('.json')).sort()
const inputs = [
  'docs/csat-learner/v4/codebook.json',
  'apps/web/src/lib/csat/map/v4/definition.data.ts',
  'docs/csat-learner/v4/workspaces.json',
  'docs/csat-learner/v4/relations.json',
  ...authoredJson.map((f) => `${AUTH}/${f}`),
  `${AUTH}/tasks.ts`, `${AUTH}/formats.ts`, `${AUTH}/authored-items.ts`, `${AUTH}/labels.ts`,
  'docs/final/AUTHORING_SPEC.md', 'docs/final/APPROVAL_PACKAGE.md',
  'docs/final/review/r5-authored-gold-packet.md',
  'docs/csat-learner/v62/data-expansion/coverage.json',
  'apps/web/src/lib/csat/map/skill-diagnosis.ts',
  'apps/web/src/lib/csat/map/v4/observation.ts',
  'apps/web/src/lib/csat/map/v4/to-be.ts',
  'apps/web/src/lib/csat/map/lifecycle-evidence.ts',
  'apps/web/src/lib/csat/map/load.ts',
  'apps/web/src/lib/csat/map/v62/supply.ts',
].filter((p) => fs.existsSync(path.join(ROOT, p)))
const inputSha = Object.fromEntries(inputs.map((p) => [p, fsha(p)]))
const meta = { generated_at: GENERATED_AT, input_head: HEAD, generator: 'docs/research/goal-data-batches/D4-assessment/_compute.mjs', input_sha256: inputSha }

// ---------- 코드북 ----------
const codebook = readJson('docs/csat-learner/v4/codebook.json')
const tasks = codebook.tasks
const active = tasks.filter((t) => t.status !== 'hold')
const held = tasks.filter((t) => t.status === 'hold')

// ---------- 등록(런타임) 세트 — authored-items.ts 의 import 목록을 실제로 읽는다 ----------
const itemsTs = fs.readFileSync(path.join(ROOT, AUTH, 'authored-items.ts'), 'utf8')
const imported = new Set([...itemsTs.matchAll(/from '\.\/([^']+\.json)'/g)].map((m) => m[1]))

// ---------- 문항 · 지문 ----------
const norm = (s) => s.normalize('NFC').replace(/\s+/g, ' ').trim().toLowerCase()
const passageText = (body) => (Array.isArray(body?.sentences) ? body.sentences.map(norm).join(' ') : null)
const words = (t) => new Set(t.replace(/[^a-z' ]/g, ' ').split(/\s+/).filter((w) => w.length > 3))
const jacc = (a, b) => { let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i || 1) }

const ROLES = ['model_explanation', 'guided_practice', 'independent_check', 'transfer', 'delayed_check']
const INSTR = new Set(['model_explanation', 'guided_practice'])
const ALT_KEYS = ['claimRestated', 'supportDisputed', 'evidenceAlt', 'decisiveAlt', 'alternatives', 'patternAlternatives', 'reasonAlternatives', 'relationAlternatives', 'acceptedAlternatives', 'accepted']

const files = []
const allItems = []
for (const f of authoredJson) {
  const p = `${AUTH}/${f}`
  const j = readJson(p)
  const rec = { file: p, sha256: inputSha[p], bytes: fs.statSync(path.join(ROOT, p)).size, runtime_registered: imported.has(f), set: j.set ?? j.id ?? null, taskId: j.taskId ?? j.task ?? null, taskKey: j.taskKey ?? null, format: j.format ?? (j.items ? 'central_meaning(기본값)' : null), schema: j.schema ?? null }
  if (!Array.isArray(j.items)) {
    rec.items = 0
    rec.note = `items 배열 없음 — 단일 레슨 산출물(schema ${j.schema}, role ${j.role}). assessment_scope.evidence=${j.assessment_scope?.evidence} (${j.assessment_scope?.non_evidence_reason}) → 평가 근거 아님`
    rec.role_counts = { [j.role]: 1 }
    files.push(rec)
    continue
  }
  rec.items = j.items.length
  rec.role_counts = Object.fromEntries(ROLES.map((r) => [r, j.items.filter((i) => i.role === r).length]))
  for (const it of j.items) {
    const text = passageText(it.body)
    const g = it.gold ?? {}
    const choices = Array.isArray(it.body?.choices) ? it.body.choices.length : null
    const altPresent = ALT_KEYS.filter((k) => g[k] !== undefined && !(Array.isArray(g[k]) && g[k].length === 0))
    const altDeclared = ALT_KEYS.filter((k) => g[k] !== undefined)
    if (Array.isArray(g.pairs) && g.pairs.some((p) => Array.isArray(p.alt))) { altDeclared.push('pairs[].alt'); if (g.pairs.some((p) => p.alt?.length)) altPresent.push('pairs[].alt') }
    const defects = []
    if (choices !== null) {
      if (!Number.isInteger(g.answer)) defects.push('answer_not_integer')
      else if (g.answer < 0 || g.answer >= choices) defects.push('answer_out_of_range')
      if (choices !== 5) defects.push(`choices_${choices}_not_5`)
      if (new Set(it.body.choices.map(norm)).size !== choices) defects.push('duplicate_choice_text')
      if (Array.isArray(g.distractors)) {
        const covered = new Set(g.distractors.map((d) => d.choice))
        const want = [...Array(choices).keys()].filter((k) => k !== g.answer)
        const missing = want.filter((k) => !covered.has(k))
        if (missing.length) defects.push(`distractor_rationale_missing:${missing.join(',')}`)
        if (covered.has(g.answer)) defects.push('distractor_marks_answer')
        if (g.distractors.some((d) => !d.why || String(d.why).trim().length < 5)) defects.push('distractor_why_empty')
      } else if (!Array.isArray(g.options)) defects.push('no_distractor_rationale')
    }
    const rationale = ['rationale', 'why', 'gist', 'senseGloss', 'correction'].some((k) => typeof g[k] === 'string' && g[k].trim().length > 0) || Array.isArray(g.options) || Array.isArray(g.distractors) || (Array.isArray(g.pairs) && g.pairs.every((p) => typeof p.cue === 'string' && p.cue.trim().length >= 2))
    if (!rationale) defects.push('no_rationale_text')
    if (INSTR.has(it.role) === false && (it.body?.teach || it.body?.hints)) defects.push('assessment_has_teach_or_hints')
    if (it.role === 'model_explanation' && !(it.body?.teach?.length >= 3)) defects.push('teach_steps_lt3')
    if (it.role === 'guided_practice' && !(it.body?.hints?.length >= 1)) defects.push('hints_missing')
    const rec2 = {
      file: p, set: rec.set, taskId: rec.taskId, runtime_registered: rec.runtime_registered, id: it.id, role: it.role, passageGroup: it.passageGroup,
      format: it.body?.format ?? rec.format, passage_sha256: text ? sha(text) : null, sentences: it.body?.sentences?.length ?? null,
      response_type: choices !== null ? `choice_${choices}` : Array.isArray(it.body?.pairs) ? 'pair_relations' : it.body?.pair ? 'equivalence_same+relation' : 'structured',
      answer: g.answer ?? null, composite_keys: Object.keys(g).filter((k) => !['answer', 'distractors', 'rationale', 'why', 'gist', 'senseGloss'].includes(k) && !ALT_KEYS.includes(k)),
      alternatives_declared: altDeclared, alternatives_nonempty: altPresent, free_text_response: false, defects,
    }
    allItems.push({ ...rec2, _words: text ? words(text) : null })
  }
  files.push(rec)
}

// 지문 해시 중복(전체)
const byHash = new Map()
for (const it of allItems) if (it.passage_sha256) { if (!byHash.has(it.passage_sha256)) byHash.set(it.passage_sha256, []); byHash.get(it.passage_sha256).push(it) }
const dupGroups = [...byHash.entries()].filter(([, v]) => v.length > 1).map(([h, v]) => ({
  passage_sha256: h, count: v.length,
  members: v.map((x) => ({ file: x.file, id: x.id, role: x.role, runtime_registered: x.runtime_registered })),
  only_superseded_copy: v.filter((x) => x.runtime_registered).length <= 1,
  cross_role_instruction_assessment: v.some((x) => INSTR.has(x.role)) && v.some((x) => !INSTR.has(x.role)),
}))

// 근사 중복(등록 세트 안, 같은 TASK, Jaccard ≥ 0.5 · 해시 다름)
const reg = allItems.filter((x) => x.runtime_registered && x._words)
const nearDup = []
for (let a = 0; a < reg.length; a++) for (let b = a + 1; b < reg.length; b++) {
  const x = reg[a]; const y = reg[b]
  if (x.passage_sha256 === y.passage_sha256) continue
  const s = jacc(x._words, y._words)
  if (s >= 0.5) nearDup.push({ a: `${x.id}(${x.role})`, b: `${y.id}(${y.role})`, task_a: x.taskId, task_b: y.taskId, jaccard_content_words: +s.toFixed(3) })
}

// ---------- TASK 별 ----------
const SKILL = 'apps/web/src/lib/csat/map/skill-diagnosis.ts'
const OBS = 'apps/web/src/lib/csat/map/v4/observation.ts'
const LIFE = 'apps/web/src/lib/csat/map/lifecycle-evidence.ts'
const FMT = `${AUTH}/formats.ts`
const ITEMS = `${AUTH}/authored-items.ts`
const refs = {
  verify: lineOf(SKILL, /^export const VERIFY_ITEMS/),
  check: lineOf(SKILL, /^export const CHECK_ITEMS/),
  resolveLoop: lineOf(SKILL, /if \(streak >= CHECK_ITEMS\)/),
  expiry: lineOf(SKILL, /^export const EXPIRY_DAYS/),
  obsDirect: lineOf(OBS, /^const DIRECT/),
  transferFinished: lineOf(LIFE, /^export function transferFinished/),
  groupMix: lineOf(ITEMS, /에 교수·평가가 섞였다/),
  assessRoles: lineOf(ITEMS, /^export const ASSESSMENT_ROLES/),
  delayedLabel: lineOf('apps/web/src/lib/csat/map/load.ts', /'받은 자료 · 다른 날 확인'/),
  supplyDelayed: lineOf('apps/web/src/lib/csat/map/v62/supply.ts', /경과 시간 판정은 기존 규칙/),
}
const gradeLine = (fmt) => {
  const src = fs.readFileSync(path.join(ROOT, FMT), 'utf8').split(/\r?\n/)
  const start = src.findIndex((l) => l.includes(`id: '${fmt}'`))
  const base = start < 0 ? 0 : start
  const k = src.findIndex((l, i) => i > base && l.includes('isCorrect:'))
  return k < 0 ? null : `${FMT}:${k + 1}`
}

// 도달 조건을 코드 규칙에 대 본 판정(사람이 코드를 읽고 쓴 대조 — 기계 판정 아님). 공통 규칙 = 확정(서로 다른 문항 2 오답) → 확인 연속 정답 2 = resolved.
const COMMON = `공통 판정 = ${refs.verify}(확정 2) · ${refs.resolveLoop}(연속 정답 ${2} → resolved) · 만료 ${refs.expiry}. 서로 다른 지문 · 다른 날 · 역할(transfer/delayed) 구분을 resolved 조건에 쓰지 않는다.`
const criterionVsCode = {
  'v.core_meaning': { implemented: 'no_authored_path', note: '창작 세트 없음 · AUTHORED_TASK_KEYS 에 없음. 「다른 날 다시 맞힌다」는 FSRS(WordVault·Flashcard) 쪽이며 이 지도 판정 경로와 결속된 코드 없음(검색 결과 map/ 아래 v.core_meaning 참조 = definition.data 뿐).' },
  'v.contextual_sense': { implemented: 'partial', note: '「서로 다른 문맥 2개 이상」 — 연속 2정답이 서로 다른 문항이면 대개 다른 지문이지만 지문 구분을 검사하지 않는다.' },
  'v.multiword': { implemented: 'proxy', note: '「낱낱 해석으로 바꾸지 않고 의미를 말한다」(산출) ↔ 5지선다 선택 + cue 문장. 산출 응답 없음.' },
  'v.semantic_relation': { implemented: 'yes_by_format', note: '「재진술 쌍을 가려낸다」 ↔ same + relation 둘 다 맞아야 정답(equivalence).' },
  's.sentence_core': { implemented: 'partial', note: '「3문장 이상 연속 정확」 ↔ resolved 는 연속 2. 3연속 요건 미구현.' },
  's.chunk_boundary': { implemented: 'proxy', note: '「경계 오류 없이 풀어 쓴다」(산출) ↔ 덩어리 선택 + 이유 선택. 풀어 쓰기 응답 없음.' },
  's.attachment': { implemented: 'partial', note: '「다른 문장에서도 맞힌다」 ↔ 서로 다른 문항 2 연속 정답(문장 구분 검사 없음).' },
  's.structural_relation': { implemented: 'proxy', note: '「풀어 쓰기가 원문 의미와 같다」 ↔ 선택 + 이유. 풀어 쓰기 산출 없음.' },
  's.form_scope': { implemented: 'partial', note: '「포인트별 서로 다른 문항 2개 이상」 ↔ 문항 2개는 충족, 포인트(reason)별 구분 없음.' },
  's.o.sentence_meaning_model': { implemented: 'observation_only', note: `통합 관찰 — 자기 문항 없음 · ${refs.obsDirect} 하위 TASK 직접 판정 집계만(unmeasurable/insufficient/observable).` },
  'r.reference': { implemented: 'partial', note: '「서로 다른 지문 2개」 — 지문 구분 검사 없음(문항 구분만).' },
  'r.relation': { implemented: 'yes_by_format', note: '「facet 별 막대 없음 — 관찰 근거 내역만」 ↔ 쌍 관계 전부 맞아야 정답 · 별도 막대 없음.' },
  'r.discourse_function': { implemented: 'partial', note: '「Gold tagging 에서 R4 와 독립 관찰 확인 전 잠정」 — R3/R4 가 같은 discourse_roles 형식 · 같은 gradeStructure 사용. 독립 관찰 확인 코드 없음.' },
  'r.discourse_structure': { implemented: 'partial', note: '「R3 와 다른 근거로 관찰될 때만 독립」 — R3 와 같은 형식 · 채점 함수. 근거 분리 검사 없음.' },
  'r.central_meaning': { implemented: 'partial', note: '「서로 다른 지문 2개 독립 확인 + 다른 날 재확인」 — 연속 2정답만. 다른 날 경과 검사 없음(delayed_check 는 라벨 · 공급 역할일 뿐).' },
  'r.inference': { implemented: 'yes_by_format', note: '「근거 없는 추론은 실패」 ↔ choice + decisive 근거 + 범주 밖 문장 없음이어야 정답(choice_evidence).' },
  'r.o.global_meaning_model': { implemented: 'observation_only', note: `통합 관찰 — ${refs.obsDirect}.` },
  'e.task_demand': { implemented: 'partial', note: '「유형 2개 이상」 ↔ 유형 구분 검사 없음(문항 2개).' },
  'e.evidence_location': { implemented: 'partial', note: '「서로 다른 확인 문항 2개 독립 정답 → 다른 날 재확인」 — 앞부분 구현, 다른 날 재확인 미구현.' },
  'e.option_correspondence': { implemented: 'yes_by_format', note: '「함정 선택만으로 약함 판정 금지」 — 확정은 오답 2문항 기준이라 함정 선택 1회로 확정하지 않음. 선지별 verdict 전부 + 문장 일치까지 맞아야 정답.' },
  'e.o.final_judgment': { implemented: 'observation_only', note: `통합 관찰 — 「추측 정답은 근거 아님」을 구분하는 코드(확신도 · 근거 응답) 없음 · ${refs.obsDirect}.` },
}

const regItems = allItems.filter((x) => x.runtime_registered)
const matrix = active.map((t) => {
  const its = regItems.filter((x) => x.taskId === t.id)
  const setFiles = files.filter((f) => f.taskId === t.id)
  const roleCounts = Object.fromEntries(ROLES.map((r) => [r, its.filter((i) => i.role === r).length]))
  const instrHashes = new Set(its.filter((i) => INSTR.has(i.role)).map((i) => i.passage_sha256))
  const assess = its.filter((i) => !INSTR.has(i.role))
  const assessShared = assess.filter((i) => instrHashes.has(i.passage_sha256)).map((i) => i.id)
  const assessHashCounts = {}
  for (const i of assess) assessHashCounts[i.passage_sha256] = (assessHashCounts[i.passage_sha256] ?? 0) + 1
  const assessSharedAmong = assess.filter((i) => assessHashCounts[i.passage_sha256] > 1).map((i) => i.id)
  const distinct = Object.fromEntries(ROLES.map((r) => [r, new Set(its.filter((i) => i.role === r).map((i) => i.passage_sha256)).size]))
  const defects = its.filter((i) => i.defects.length).map((i) => ({ id: i.id, defects: i.defects }))
  const formats = [...new Set(its.map((i) => i.format))]
  const c = criterionVsCode[t.id]
  const direct = its.length === 0 ? (t.kind === 'atomic' || !t.id.includes('.o.') ? 'no — 등록 창작 세트 없음' : 'no — 통합 관찰(설계상 자기 문항 없음)') : 'yes — 창작 세트(콘텐츠 출시 승인 별도)'
  return {
    task: t.id, display: t.display, status: t.status, direct_check_codebook: t.direct_check,
    definition: { goal: t.goal, conditions: t.conditions, evidence: t.evidence, criterion: t.criterion, quantity_policy: t.quantity_policy },
    sets: setFiles.map((f) => ({ file: f.file, set_revision: f.set, sha256: f.sha256, items: f.items, runtime_registered: f.runtime_registered })),
    formats, role_counts: roleCounts, distinct_passages_by_role: distinct,
    passage_independence: its.length === 0 ? null : {
      assessment_items: assess.length, assessment_sharing_instruction_passage: assessShared, assessment_sharing_passage_among_themselves: assessSharedAmong,
      verdict: assessShared.length === 0 && assessSharedAmong.length === 0 ? 'independent(정확 해시 기준)' : 'shared',
    },
    scoring_contract: its.length === 0 ? null : {
      grade_function: formats.map((f) => ({ format: f, isCorrect_line: gradeLine(f.replace('(기본값)', '')) })),
      response_types: [...new Set(its.map((i) => i.response_type))],
      alternatives_declared_items: its.filter((i) => i.alternatives_declared.length).length,
      alternatives_nonempty_items: its.filter((i) => i.alternatives_nonempty.length).length,
      free_text_items: its.filter((i) => i.free_text_response).length,
      defect_items: defects.length, defects,
      status: defects.length === 0 ? 'structurally_complete(정적 검사)' : 'defects_found',
    },
    judgment_code: { implemented: c?.implemented ?? 'unknown', note: c?.note ?? null, common_rule: its.length ? COMMON : null },
    direct_assessable: direct,
  }
})

// ---------- 공백 ----------
const MIN = { model_explanation: 1, guided_practice: 1, independent_check: 2, transfer: 1, delayed_check: 1 }
const gaps = []
for (const m of matrix) {
  if (m.sets.filter((s) => s.runtime_registered).length === 0) {
    const integrated = m.task.includes('.o.')
    gaps.push({ task: m.task, display: m.display, roles_missing: ROLES, kind: integrated ? 'integrated_observation_no_items_by_design' : 'no_instrument',
      priority: integrated ? 'P2' : 'P1',
      rationale: integrated ? '정본상 자기 문항·숙달도 없음. 하위 TASK 공백이 먼저 메워져야 observable 이 된다(observation.ts).' : 'atomic TASK 인데 직접 평가 도구가 지도 경로에 없다 — 도달 판정 불가.' })
    continue
  }
  const short = ROLES.filter((r) => m.role_counts[r] < MIN[r]).map((r) => ({ role: r, have: m.role_counts[r], spec_min: MIN[r] }))
  const crit = m.definition.criterion ?? ''
  const needsDiffDay = /다른 날/.test(crit)
  const needsDiffPassage = /서로 다른 지문|다른 문맥|다른 문장/.test(crit)
  const assessDistinct = m.distinct_passages_by_role.independent_check + m.distinct_passages_by_role.transfer + m.distinct_passages_by_role.delayed_check
  const item = { task: m.task, display: m.display, role_shortfall_vs_AUTHORING_SPEC: short,
    delayed_items: m.role_counts.delayed_check, criterion_requires_different_day: needsDiffDay, criterion_requires_distinct_passage: needsDiffPassage,
    assessment_distinct_passages: assessDistinct, code_gap: m.judgment_code.implemented }
  const reasons = []
  if (short.length) reasons.push('역할 최소량 미달')
  if (needsDiffDay && m.role_counts.delayed_check <= 1) reasons.push(`다른 날 재확인 요구 · delayed ${m.role_counts.delayed_check}문항 — 첫 확인 실패 뒤 재확인 여분 없음`)
  if (['proxy', 'partial'].includes(m.judgment_code.implemented)) reasons.push(`판정 코드 ${m.judgment_code.implemented}`)
  // 연속 2정답 resolved + 확정 2오답 → 한 회차에 필요한 미노출 평가 문항 최소 4
  if (m.role_counts.independent_check + m.role_counts.transfer + m.role_counts.delayed_check < 4) reasons.push('확정 2 + 해소 2 = 미노출 평가 문항 4 미만')
  item.priority = short.length || (needsDiffDay && m.judgment_code.implemented !== 'yes_by_format') ? 'P1' : reasons.length ? 'P2' : 'P3'
  item.rationale = reasons
  gaps.push(item)
}

// ---------- 쓰기 ----------
const clean = (x) => { const { _words, ...r } = x; return r }
const write = (n, o) => fs.writeFileSync(path.join(OUT, n), JSON.stringify(o, null, 2) + '\n')
const totalRoles = Object.fromEntries(ROLES.map((r) => [r, regItems.filter((i) => i.role === r).length]))
write('task-assessment-matrix.json', { ...meta,
  scope: { active_tasks: active.length, held_tasks_out_of_scope: held.map((t) => `${t.display} ${t.id}`) },
  t0087_packet: { path: 'docs/final/review/r5-authored-gold-packet.md', ledger: 'docs/final/FINAL_LEDGER.md §34', packet_sha256: inputSha['docs/final/review/r5-authored-gold-packet.md'] ?? null,
    declared_input: { file: `${AUTH}/r5-central-meaning.v1.json`, revision: 'r5-central-meaning.v3', sha256: '682dfbd97fa8c2317315f3458d11d24033364afee980d78331c03da5563e2846' },
    current_input_sha256: inputSha[`${AUTH}/r5-central-meaning.v1.json`],
    input_matches: inputSha[`${AUTH}/r5-central-meaning.v1.json`] === '682dfbd97fa8c2317315f3458d11d24033364afee980d78331c03da5563e2846', note: '기록만 — 패킷 변경 없음' },
  code_refs: refs, tasks: matrix })
write('instrument-gap.json', { ...meta, role_minimum_source: 'docs/final/AUTHORING_SPEC.md — 세트당 model 1 · guided 1 · independent 2 · transfer 1 · delayed 1', gaps,
  summary: { P1: gaps.filter((g) => g.priority === 'P1').map((g) => g.display), P2: gaps.filter((g) => g.priority === 'P2').map((g) => g.display), P3: gaps.filter((g) => g.priority === 'P3').map((g) => g.display) } })
write('content-inventory.json', { ...meta,
  totals: { files: files.length, runtime_registered_files: files.filter((f) => f.runtime_registered).length, items_all_files: allItems.length, items_runtime_registered: regItems.length, role_counts_runtime_registered: totalRoles,
    distinct_passages_runtime_registered: new Set(regItems.map((i) => i.passage_sha256)).size, exact_duplicate_passage_groups: dupGroups.length, near_duplicate_pairs_jaccard_ge_0_5: nearDup.length, items_with_defects: regItems.filter((i) => i.defects.length).length },
  passage_hash_rule: 'sha256(lowercase · 공백 정규화 · NFC · sentences 를 공백으로 이은 문자열)',
  files, exact_duplicate_passages: dupGroups, near_duplicate_passages: nearDup, items: allItems.map(clean) })
console.log(JSON.stringify({ head: HEAD, totals: { files: files.length, items: allItems.length, reg: regItems.length, totalRoles, dup: dupGroups.length, near: nearDup.length, defects: regItems.filter((i) => i.defects.length).length } }, null, 1))
