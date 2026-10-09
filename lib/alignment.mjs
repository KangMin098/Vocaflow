// lib/alignment.mjs
//
// Goal Alignment Gate — 작업이 실제 미완료 목표에 기여하는지 등록 시점에 규칙·ID 로만 검사한다(AI 호출 없음).
//
//   작업 영향 계약(task.impact):
//     kind               platform(정본 목표 기여) | independent(사용자 명시 요청 — 정본에 억지로 묶지 않는다)
//     parent_goal_id     goal_id 자신 또는 그 상위(정본 parent 사슬)
//     acceptance_ids     이 작업이 겨냥하는 정본 수용 기준 id(criterion_claims 의 부분집합)
//     current_gap        지금 무엇이 안 되는가(한 문장)
//     expected_impact    closes(기준을 닫음 — full claim 필요) | advances(일부 개선) | prerequisite(간접 선행)
//     evidence_required  완료로 볼 증거(비지 않은 배열)
//     next_dependency    이 작업 뒤 같은 목표의 다음 의존 작업(없으면 null)
//     out_of_scope       하지 않을 것
//     dependency_type    direct | prerequisite — prerequisite 는 unblocks(풀어 주는 기준·작업 id) 필수, full claim 금지
//
//   실행 전 검사(addTask 안 · 실패는 RuleError):
//     상위 목표·수용 기준 존재 · 갭이 이미 닫혔나(목표 PASS) · 열린 작업 중복 · 완료 작업 재구현 · 정본 버전·기준 커밋 기록
//     소유권·허용 범위·승인은 tasks.mjs 의 기존 검사를 그대로 쓴다.
//
//   목표 단계(goalLevel): TASK_COMPLETED(작업만) < GOAL_PARTIAL < GOAL_VERIFIED(수용 기준 전부) < USER_ACCEPTED(사용자 결정)
//     에이전트는 USER_ACCEPTED 를 만들지 않는다 — 사용자가 대화형 터미널에서 기록한 결정(recorded_via=tty)만.

export const IMPACT_KINDS = ['platform', 'independent']
export const EXPECTED_IMPACT = ['closes', 'advances', 'prerequisite']
export const DEPENDENCY_TYPES = ['direct', 'prerequisite']
export const GOAL_LEVELS = ['NONE', 'TASK_COMPLETED', 'GOAL_PARTIAL', 'GOAL_VERIFIED', 'USER_ACCEPTED']

class AlignError extends Error {
  constructor(code, message) {
    super(message)
    this.code = code
  }
}

const str = (v) => typeof v === 'string' && v.trim().length > 0
const strArr = (v, nonEmpty) => Array.isArray(v) && v.every(str) && (!nonEmpty || v.length > 0)

/** 정본 parent 사슬(자신 포함) */
export function ancestors(doc, id) {
  const out = []
  let cur = doc.criteria.find((c) => c.id === id)
  while (cur && !out.includes(cur.id)) {
    out.push(cur.id)
    cur = cur.parent_id ? doc.criteria.find((c) => c.id === cur.parent_id) : null
  }
  return out
}

/** glob 의 고정 접두(첫 와일드카드 앞) */
const prefixOf = (g) => String(g).replace(/\\/g, '/').split(/[*?[{]/)[0]
/** 두 경로 범위가 겹치나 — 고정 접두가 서로의 앞부분이면 겹친다(보수적) */
export function pathsOverlap(a, b) {
  return a.some((x) => b.some((y) => {
    const px = prefixOf(x)
    const py = prefixOf(y)
    return px.startsWith(py) || py.startsWith(px)
  }))
}

/**
 * spec.impact 를 검증·정규화한다. claims = 이 작업의 criterion_claims(이미 검증된 값).
 * 반환: { impact, claims } — prerequisite·independent 는 claims 를 조정한다(full 불가 · independent 는 기준 기여 없음).
 */
export function normalizeImpact(spec, { doc, claims, ErrorClass = AlignError }) {
  const fail = (code, m) => {
    throw new ErrorClass(code, m)
  }
  const im = spec.impact
  if (!im || typeof im !== 'object') fail('IMPACT_REQUIRED', '작업 영향 계약(impact)이 필요하다 — parent_goal_id · acceptance_ids · current_gap · expected_impact · evidence_required · next_dependency · out_of_scope')
  const kind = im.kind ?? 'platform'
  if (!IMPACT_KINDS.includes(kind)) fail('BAD_IMPACT', `impact.kind 는 ${IMPACT_KINDS.join('|')}`)
  if (!str(im.current_gap)) fail('BAD_IMPACT', 'impact.current_gap(지금 안 되는 것)이 필요하다')
  if (!strArr(im.evidence_required, true)) fail('BAD_IMPACT', 'impact.evidence_required 는 비지 않은 문자열 배열')
  if (!strArr(im.out_of_scope ?? [], false)) fail('BAD_IMPACT', 'impact.out_of_scope 는 문자열 배열')
  if (im.next_dependency !== undefined && im.next_dependency !== null && !str(im.next_dependency)) fail('BAD_IMPACT', 'impact.next_dependency 는 문자열 또는 null')

  if (kind === 'independent') {
    // 사용자가 명시적으로 시작한 독립 작업 — 정본 기준에 기여하지 않는다(목표 PASS 근거 0). 대신 사용자 완료 기준과 요청 근거가 있어야 한다.
    if (!str(im.user_request_ref)) fail('BAD_IMPACT', 'independent 작업은 impact.user_request_ref(사용자 요청 근거)가 필요하다')
    return {
      claims: [],
      impact: { kind, parent_goal_id: null, acceptance_ids: [], current_gap: im.current_gap, expected_impact: 'advances', evidence_required: im.evidence_required, next_dependency: im.next_dependency ?? null, out_of_scope: im.out_of_scope ?? [], dependency_type: 'direct', user_request_ref: im.user_request_ref },
    }
  }

  const parent = im.parent_goal_id ?? spec.goal_id
  if (!ancestors(doc, spec.goal_id).includes(parent)) fail('BAD_PARENT_GOAL', `parent_goal_id ${parent} 는 ${spec.goal_id} 자신이나 상위 목표가 아니다`)
  const claimIds = claims.map((c) => c.criterion_id)
  const acc = im.acceptance_ids ?? claimIds
  if (!strArr(acc, true)) fail('BAD_IMPACT', 'impact.acceptance_ids 는 비지 않은 배열')
  for (const a of acc) if (!claimIds.includes(a)) fail('BAD_IMPACT', `acceptance_ids ${a} 는 이 작업의 criterion_claims 에 없다`)
  const dep = im.dependency_type ?? (im.expected_impact === 'prerequisite' ? 'prerequisite' : 'direct')
  if (!DEPENDENCY_TYPES.includes(dep)) fail('BAD_IMPACT', `dependency_type 은 ${DEPENDENCY_TYPES.join('|')}`)
  if (!EXPECTED_IMPACT.includes(im.expected_impact)) fail('BAD_IMPACT', `expected_impact 는 ${EXPECTED_IMPACT.join('|')}`)
  const targeted = claims.filter((c) => acc.includes(c.criterion_id))
  const outClaims = claims
  // 남는 claim 전부를 검사한다 — 겨냥 밖(full)이 남으면 선행 작업이 다른 기준의 PASS 근거가 된다(Codex P1)
  const fullOutside = claims.filter((c) => c.claim === 'full' && !acc.includes(c.criterion_id))
  if (fullOutside.length) fail('BAD_IMPACT', `full claim ${fullOutside.map((c) => c.criterion_id).join(',')} 이 acceptance_ids 밖에 있다 — 겨냥하는 기준만 full 로 주장한다`)
  if (dep === 'prerequisite') {
    // 간접 선행 작업: 허용하되 기준을 닫았다고 주장하지 못한다(기반 계약 완료 ≠ 목표 완료)
    if (im.expected_impact !== 'prerequisite') fail('BAD_IMPACT', 'dependency_type=prerequisite 면 expected_impact 도 prerequisite')
    if (!str(im.unblocks)) fail('BAD_IMPACT', 'prerequisite 작업은 impact.unblocks(풀어 주는 기준·작업 id)가 필요하다')
    if (claims.some((c) => c.claim === 'full')) fail('PREREQ_FULL_CLAIM', '간접 선행 작업은 수용 기준을 full 로 주장할 수 없다 — 기반 계약 완료는 목표 완료가 아니다')
  } else {
    if (im.expected_impact === 'prerequisite') fail('BAD_IMPACT', 'expected_impact=prerequisite 는 dependency_type=prerequisite 와 함께')
    const anyFull = targeted.some((c) => c.claim === 'full')
    if (im.expected_impact === 'closes' && !anyFull) fail('BAD_IMPACT', 'expected_impact=closes 인데 full claim 이 없다')
    if (im.expected_impact === 'advances' && anyFull) fail('BAD_IMPACT', 'full claim 이 있으면 expected_impact=closes')
  }
  return {
    claims: outClaims,
    impact: { kind, parent_goal_id: parent, acceptance_ids: acc, current_gap: im.current_gap, expected_impact: im.expected_impact, evidence_required: im.evidence_required, next_dependency: im.next_dependency ?? null, out_of_scope: im.out_of_scope ?? [], dependency_type: dep, ...(dep === 'prerequisite' ? { unblocks: im.unblocks } : {}) },
  }
}

const OPEN = new Set(['READY', 'IN_PROGRESS', 'REVIEW', 'BLOCKED', 'WAITING_CHATGPT'])

/**
 * 실행 전 정렬 검사 — 갭 · 중복 · 재구현. 같은 owner·다른 owner 를 가리지 않고 같은 기준 + 겹치는 경로면 중복이다.
 * 다른 작업의 forbidden_paths 는 이 작업의 범위 판단에 쓰지 않는다(각 작업은 자기 계약으로만 판정).
 * 우회: spec.reopen_reason(완료·PASS 기준을 다시 여는 사유) · spec.duplicate_reason(의도적 병행 사유) — 기록에 남는다.
 */
export function alignmentGate(state, spec, impact, { doc, ErrorClass = AlignError }) {
  const fail = (code, m) => {
    throw new ErrorClass(code, m)
  }
  const checks = []
  if (impact.kind === 'independent') return { checks: ['independent — 정본 갭 검사 생략(기준 기여 0)'] }
  const gs = state.goalStatus?.goals?.[spec.goal_id]?.status ?? 'UNKNOWN'
  // 기준별 상태가 있으면 그것으로(겨냥 기준이 전부 PASS 면 갭 없음), 없으면 목표 단위로
  const cs = state.goalStatus?.goals?.[spec.goal_id]?.criteria_status
  const allPass = cs && impact.acceptance_ids.every((a) => cs[a]?.status === 'PASS')
  if ((gs === 'PASS' || allPass) && impact.dependency_type === 'direct' && !str(spec.reopen_reason)) fail('GAP_CLOSED', `${spec.goal_id} 의 겨냥 기준 ${impact.acceptance_ids.join(',')} 은 이미 PASS — 실제 미완료 갭이 없다(다시 열려면 reopen_reason)`)
  checks.push(`gap: ${spec.goal_id} ${gs}`)
  for (const t of state.taskQueue.tasks) {
    const tIds = t.impact?.acceptance_ids ?? (t.criterion_claims || []).map((c) => c.criterion_id)
    const shared = tIds.filter((x) => impact.acceptance_ids.includes(x))
    if (!shared.length || !pathsOverlap(t.allowed_paths || [], spec.allowed_paths)) continue
    if (OPEN.has(t.status) && !str(spec.duplicate_reason)) fail('DUPLICATE_TASK', `열린 작업 ${t.task_id}(${t.status}) 가 같은 기준 ${shared.join(',')} 과 겹치는 경로를 이미 다룬다 — 중복 작업(의도적이면 duplicate_reason)`)
    const fullDone = t.status === 'COMPLETED' && (t.criterion_claims || []).some((c) => shared.includes(c.criterion_id) && c.claim === 'full')
    if (fullDone && !str(spec.reopen_reason)) fail('REIMPLEMENT', `완료 작업 ${t.task_id} 가 기준 ${shared.join(',')} 을 full 로 이미 구현했다 — 재구현 금지(무효화·결함이면 reopen_reason)`)
  }
  checks.push('duplicate: 없음')
  return { checks }
}

/**
 * 정본 목표의 진행 단계. goalStatus(검사기 결과) + 작업 상태 + 사용자 수락 결정으로만 정한다.
 * USER_ACCEPTED 는 사용자가 직접 기록한 APPROVED 결정(「<goal> accept」, recorded_via=tty) + GOAL_VERIFIED 일 때만.
 */
export function goalLevel(state, goal_id) {
  const gs = state.goalStatus?.goals?.[goal_id]?.status ?? 'UNKNOWN'
  const tasks = state.taskQueue.tasks.filter((t) => t.goal_id === goal_id || (t.impact?.parent_goal_id === goal_id))
  const done = tasks.filter((t) => t.status === 'COMPLETED')
  const contributing = done.filter((t) => (t.impact?.dependency_type ?? 'direct') === 'direct' && (t.criterion_claims || []).length)
  let level = 'NONE'
  if (done.length) level = 'TASK_COMPLETED'
  if (contributing.length) level = 'GOAL_PARTIAL'
  if (gs === 'PASS') level = 'GOAL_VERIFIED'
  if (level === 'GOAL_VERIFIED') {
    const esc = goal_id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`(^|[^0-9A-Za-z-])${esc} accept(?![0-9A-Za-z])`)
    const acc = (state.decisionLog?.entries || []).find((e) => e.status === 'APPROVED' && e.approved_by === 'user' && e.recorded_via === 'tty' && re.test(`${e.summary || ''} ${e.reference || ''}`))
    if (acc) return { goal_id, level: 'USER_ACCEPTED', goal_status: gs, decision_id: acc.decision_id, tasks_done: done.map((t) => t.task_id) }
  }
  return { goal_id, level, goal_status: gs, tasks_done: done.map((t) => t.task_id), prerequisite_done: done.filter((t) => t.impact?.dependency_type === 'prerequisite').map((t) => t.task_id) }
}

/** 방금 끝난 작업과 같은 상위 목표 · 그 작업에 의존하는 작업을 같은 tier 안에서 먼저(0) — 다른 목표로의 이동은 tier(실행 모드) 가 정한다 */
export function sameGoalPreference(task, last) {
  if (!last) return 1
  if ((task.depends_on || []).includes(last.task_id)) return 0
  const pg = (t) => t.user_goal_id ?? t.impact?.parent_goal_id ?? t.goal_id
  return pg(task) === last.parent_goal_id ? 0 : 1
}
