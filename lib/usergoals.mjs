// lib/usergoals.mjs
//
// 사용자 지정 목표(USER_GOAL)의 다중 턴 협업 — WF-S7.
//
// 목표 하나 = thread 하나. 라운드(메시지 교환)마다 누가 누구에게 무엇을 왜 보냈는지, 어떤 설계 버전·기준 커밋을 두고
// 했는지를 남긴다. 고정 턴 수가 없다 — route() 가 지금 상태에서 **필요한 AI 하나**만 고른다.
//
//   시작 경로 2개(같은 상태 모델)
//     ChatGPT-first  startFromChatGPT(): 사용자가 ChatGPT 에서 받은 vfc-goal 블록 파일 → 목표 + 설계 v1 PROPOSED
//     Claude-first   startFromClaude():  Claude Code 가 조사 후 등록 → 설계가 필요하면 requestDesign() 이 요청서를 만든다
//   설계 버전        DRAFT → PROPOSED → (REVIEWED) → APPROVED → SUPERSEDED. 승인은 사용자 결정(DECISION_LOG APPROVED)으로만.
//                    새 버전은 승인 범위를 넓히지 않는다 — 범위는 승인 때 명시한 allowed_paths ⊆ 설계의 allowed_paths.
//                    핵심 계약(contract_hash)이 바뀌면 옛 버전으로 끝난 작업은 revalidate_required(목표 완료 근거에서 빠진다).
//   응답 인수        intakeResponses(): planning/responses 의 파일을 원자적으로 집어(rename) 검증·중복 제거·thread 대조 후 적용.
//                    ChatGPT 응답은 결코 승인이 아니다 — 새 설계 버전은 PROPOSED 로만 들어간다.
//   라우터           route(): DESIGN_REQUIRED · IMPLEMENTATION_REQUIRED · CODE_REVIEW_REQUIRED · DESIGN_CONFLICT ·
//                    IMPLEMENTATION_DEFECT · APPROVAL_REQUIRED · EXTERNAL_BLOCKER · GOAL_VERIFIED(수용 기준 전부 · 사용자 수락 대기) · USER_ACCEPTED (+ PAUSED)
//                    코드 결함은 Claude↔Codex 안에서 돈다(오케스트레이터 재작업 루프). ChatGPT 는 설계 쟁점에서만 부른다.
//   프로필·예산      FAST/BALANCED/DEEP/CRITICAL 은 반복·비용 예산과 「설계 선행 필요」만 바꾼다. 승인·무결성 게이트는 그대로다.
//
// OpenAI API · 브라우저 자동화 없음 — ChatGPT 구간은 사람이 파일을 옮긴다(HUMAN_IN_THE_LOOP).

import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'
import { p, root } from './paths.mjs'
import { sha256File } from './fsutil.mjs'
import { createRequest, extractResponse, validateResponse, readRequestHeader, toDecisionEntries, REQ_ID_RE, requestNamespace } from './planning.mjs'
import { EXPORT_FILES } from './context.mjs'
import { loadCriteria, goalIndex } from './goals.mjs'
import { RuleError, logDecision, isTrustedUserDecision, addTask } from './tasks.mjs'
import { policyCovers, policySha, validatePolicy, RISK } from './policy.mjs'

export const DESIGN_STATES = ['DRAFT', 'PROPOSED', 'REVIEWED', 'APPROVED', 'SUPERSEDED']
export const ROUTES = ['DESIGN_REQUIRED', 'IMPLEMENTATION_REQUIRED', 'CODE_REVIEW_REQUIRED', 'DESIGN_CONFLICT', 'IMPLEMENTATION_DEFECT', 'APPROVAL_REQUIRED', 'EXTERNAL_BLOCKER', 'GOAL_VERIFIED', 'USER_ACCEPTED', 'PAUSED']
export const MODES = ['USER_GOAL', 'PLATFORM_AUTO']

/** 프로필은 예산과 설계 선행만 바꾼다. require_review_pass·DB 승인·증거 무결성은 어떤 프로필에서도 낮아지지 않는다(CRITICAL 은 올린다). */
export const PROFILES = {
  FAST: { codex_effort: 'medium', max_review_rounds: 2, claude_budget_usd: 2, needs_design: false, require_review_pass: false, note: '작은 수정 · 관련 테스트 우선 · 기획 왕복 최소' },
  BALANCED: { codex_effort: 'medium', max_review_rounds: 3, claude_budget_usd: 5, needs_design: false, require_review_pass: false, note: '일반 제품 기능 · 기본 검증' },
  DEEP: { codex_effort: 'high', max_review_rounds: 3, claude_budget_usd: 5, needs_design: true, require_review_pass: false, note: '학습 원리·아키텍처 — 설계 대안과 근거 선행' },
  CRITICAL: { codex_effort: 'high', max_review_rounds: 3, claude_budget_usd: 5, needs_design: true, require_review_pass: true, note: '인증·권한·DB·학습 기록·데이터 계보 — 설계 선행 + 그 커밋의 Stop 훅 REVIEW_PASS 필수' },
}

export const BUDGET_DEFAULTS = {
  max_requeries_per_issue: 2, // 같은 설계 쟁점의 재질의
  max_total_requeries: 6,
  max_next_designs: 8, // 큐가 비어 자동으로 묻는 「다음 증분」 설계 — 같은 쟁점 재질의(위 6)와 따로 센다
  max_consecutive_failures: 3,
  max_wait_hours: 72, // 외부 응답 대기
  max_cost_usd: 30,
  max_minutes: 600,
}

const now = () => new Date().toISOString()
const sha = (s) => crypto.createHash('sha256').update(String(s)).digest('hex')

export function ugState(state) {
  state.userGoals ||= { schema: 'vfc-state/1', next_seq: 1, mode: 'PLATFORM_AUTO', active_goal: null, goals: {}, processed_responses: {} }
  return state.userGoals
}

export function findGoal(state, ug) {
  const g = ugState(state).goals[ug]
  if (!g) throw new RuleError('NO_USER_GOAL', `사용자 목표 ${ug} 가 없다`)
  return g
}

function history(g, event, by, note = '') {
  g.history.push({ at: now(), event, by, note })
}

// ── 설계 계약 ───────────────────────────────────────────────────────────

/** 핵심 계약 = 수용 기준 · 보존 계약 · 범위 · DB 변경 여부. 공백만 정규화한다 — 대소문자는 계약일 수 있다(ACTIVE≠active · Codex 리뷰 P1). */
export function contractOf(design) {
  const norm = (v) => (Array.isArray(v) ? v.map(norm) : String(v ?? '').replace(/\s+/g, ' ').trim())
  return {
    acceptance: norm(design.acceptance || []),
    preserved_contracts: norm(design.preserved_contracts || []),
    allowed_paths: [...(design.allowed_paths || [])].map(String).sort(),
    db_changes: !!design.db_changes,
  }
}
export const contractHash = (design) => sha(JSON.stringify(contractOf(design)))

function validateDesign(d, where) {
  const errs = []
  const isStr = (v) => typeof v === 'string' && v.trim()
  if (!isStr(d?.summary)) errs.push(`${where}.summary`)
  if (!Array.isArray(d?.acceptance) || !d.acceptance.length || !d.acceptance.every(isStr)) errs.push(`${where}.acceptance(비지 않은 문자열 배열)`)
  if (!Array.isArray(d?.allowed_paths) || !d.allowed_paths.length || !d.allowed_paths.every(isStr)) errs.push(`${where}.allowed_paths(비지 않은 배열)`)
  if (d?.preserved_contracts !== undefined && !Array.isArray(d.preserved_contracts)) errs.push(`${where}.preserved_contracts 는 배열`)
  if (d?.db_changes !== undefined && typeof d.db_changes !== 'boolean') errs.push(`${where}.db_changes 는 boolean`)
  return errs
}

function addDesign(g, design, { source, status, request_id = null, file = null, file_sha256 = null, base_commit = null, by }) {
  const version = g.designs.length + 1
  const rec = {
    version,
    status,
    source,
    request_id,
    file,
    file_sha256,
    base_commit,
    summary: design.summary,
    design: design.design ?? null,
    acceptance: design.acceptance,
    preserved_contracts: design.preserved_contracts || [],
    allowed_paths: design.allowed_paths,
    db_changes: !!design.db_changes,
    contract_hash: contractHash(design),
    created_at: now(),
    created_by: by,
  }
  g.designs.push(rec)
  history(g, `design.v${version}.${status}`, by, request_id ? `from ${request_id}` : source)
  return rec
}

export const approvedDesign = (g) => g.designs.find((d) => d.status === 'APPROVED') || null
const latestDesign = (g) => g.designs[g.designs.length - 1] || null

function addRound(state, g, r) {
  const round = {
    thread_id: g.thread_id,
    goal_id: g.ug_id,
    round_id: `${g.thread_id}-R${String(g.rounds.length + 1).padStart(2, '0')}`,
    request_id: r.request_id ?? null,
    parent_response_id: r.parent_response_id ?? null,
    sender: r.sender,
    recipient: r.recipient,
    purpose: r.purpose,
    design_version: r.design_version ?? null,
    base_commit: r.base_commit ?? null,
    source_evidence: r.source_evidence ?? [],
    response_status: r.response_status ?? 'PENDING',
    approval_status: r.approval_status ?? 'NONE',
    issue_key: r.issue_key ?? null,
    created_at: now(),
    completed_at: r.completed_at ?? null,
  }
  g.rounds.push(round)
  return round
}

function newGoal(state, { title, canon_goal_ids, origin, profile = 'BALANCED', by, budgets = {} }) {
  const U = ugState(state)
  if (!title) throw new RuleError('MISSING_FIELD', 'title 이 필요하다')
  if (!PROFILES[profile]) throw new RuleError('BAD_PROFILE', `profile 은 ${Object.keys(PROFILES).join('|')}`)
  const idx = goalIndex(loadCriteria())
  if (!Array.isArray(canon_goal_ids) || !canon_goal_ids.length) throw new RuleError('MISSING_FIELD', 'canon_goal_ids(정본 L3 목표 1개 이상)가 필요하다 — 작업은 정본 목표에 묶인다')
  for (const c of canon_goal_ids) if (!idx.has(c)) throw new RuleError('NO_GOAL', `정본에 없는 목표 ${c}`)
  const n = U.next_seq++
  // 인스턴스 이름공간을 붙인다 — 여러 AI-Control·ChatGPT 세션이 교환 저장소를 같이 쓰면 「UG-0001」 이 서로 다른 목표를 가리켰다(PoC 읽기 습관 카드 vs 단어 추출, 2026-10-09). 기존 목표 id 는 바꾸지 않는다
  const ns = requestNamespace()
  const seq = `${ns ? `${ns}-` : ''}${String(n).padStart(4, '0')}`
  const ug_id = `UG-${seq}`
  if (U.goals[ug_id]) throw new RuleError('DUPLICATE_GOAL', `${ug_id} 가 이미 있다`)
  const g = {
    ug_id,
    thread_id: `TH-${seq}`,
    title,
    canon_goal_ids,
    origin,
    profile,
    status: 'OPEN', // OPEN | PAUSED | ACCEPTED
    budgets: { ...BUDGET_DEFAULTS, ...budgets },
    counters: { requeries: {}, total_requeries: 0, consecutive_failures: 0 },
    approval: null, // { design_version, decision_id, allowed_paths, db_decision_id }
    designs: [],
    rounds: [],
    open_issue: null,
    created_at: now(),
    created_by: by,
    history: [],
  }
  U.goals[ug_id] = g
  history(g, 'goal.created', by, origin)
  return g
}

// ── 시작 경로 A: ChatGPT-first ───────────────────────────────────────────

/**
 * 파일 안의 ```json vfc-goal``` 블록 하나:
 *   { schema:'vfc-goal/1', title, canon_goal_ids:[VG-…], profile?, design:{ summary, design?, acceptance[], allowed_paths[], preserved_contracts?, db_changes? } }
 * 결과: 목표(OPEN) + 설계 v1 PROPOSED. 승인 전에는 아무 작업도 실행되지 않는다.
 */
export function parseGoalFile(text) {
  const blocks = [...String(text).matchAll(/```json vfc-goal\s*\n([\s\S]*?)\n```/g)]
  if (blocks.length !== 1) throw new RuleError('BAD_GOAL_FILE', `vfc-goal 블록이 정확히 1개여야 한다(발견 ${blocks.length})`)
  let j
  try {
    j = JSON.parse(blocks[0][1])
  } catch (e) {
    throw new RuleError('BAD_GOAL_FILE', `vfc-goal JSON 오류: ${e.message}`)
  }
  const errs = []
  if (j.schema !== 'vfc-goal/1') errs.push('schema 는 vfc-goal/1')
  if (!j.title) errs.push('title')
  errs.push(...validateDesign(j.design, 'design'))
  if (errs.length) throw new RuleError('BAD_GOAL_FILE', `vfc-goal 검증 실패: ${errs.join(', ')}`)
  return j
}

export function startFromChatGPT(state, { file, by }) {
  const text = fs.readFileSync(file, 'utf8')
  const j = parseGoalFile(text)
  const fileSha = sha(text)
  const U = ugState(state)
  const dup = Object.values(U.goals).find((g) => g.designs[0]?.file_sha256 === fileSha)
  if (dup) throw new RuleError('DUP_GOAL_FILE', `같은 파일로 이미 ${dup.ug_id} 를 시작했다`)
  const g = newGoal(state, { title: j.title, canon_goal_ids: j.canon_goal_ids, origin: 'chatgpt', profile: j.profile || 'BALANCED', by })
  const rel = path.relative(root(), path.resolve(file)).split(path.sep).join('/')
  addDesign(g, j.design, { source: 'chatgpt', status: 'PROPOSED', file: rel, file_sha256: fileSha, by })
  addRound(state, g, { sender: 'chatgpt', recipient: 'ai-control', purpose: 'goal_start', design_version: 1, source_evidence: [rel], response_status: 'APPLIED', approval_status: 'PENDING_USER', completed_at: now() })
  return g
}

// ── 시작 경로 B: Claude-first ────────────────────────────────────────────

/** design 을 주면 v1 DRAFT(claude). 기획이 필요 없는 일반 작업은 사용자가 그 DRAFT 를 바로 승인하면 된다. */
export function startFromClaude(state, { title, canon_goal_ids, profile = 'BALANCED', design = null, by }) {
  const g = newGoal(state, { title, canon_goal_ids, origin: 'claude', profile, by })
  if (design) {
    const errs = validateDesign(design, 'design')
    if (errs.length) throw new RuleError('BAD_DESIGN', errs.join(', '))
    addDesign(g, design, { source: 'claude', status: 'DRAFT', by })
  }
  addRound(state, g, { sender: 'claude', recipient: 'ai-control', purpose: 'goal_start', design_version: design ? 1 : null, response_status: 'APPLIED', completed_at: now() })
  return g
}

/**
 * 이미 있는 목표에 Claude 초안(DRAFT)을 더한다 — 설계가 없어 컨텍스트 패킷이 빈 목표(범위가 없어 코드 발췌 0)를 채우는 용도.
 * 초안은 승인이 아니다. 승인된 설계가 있거나 응답 대기 요청이 있으면 거부한다(진행 중 계약을 흔들지 않는다).
 */
export function addClaudeDraft(state, ug, design, { by }) {
  const g = findGoal(state, ug)
  if (approvedDesign(g)) throw new RuleError('BAD_TRANSITION', `${ug} 에 승인된 설계가 있다 — 초안 대신 재질의(request-design)`)
  const pending = g.rounds.find((r) => r.recipient === 'chatgpt' && r.response_status === 'PENDING')
  if (pending) throw new RuleError('BAD_TRANSITION', `${pending.request_id} 응답 대기 중 — 먼저 cancel-request`)
  const errs = validateDesign(design, 'design')
  if (errs.length) throw new RuleError('BAD_DESIGN', errs.join(', '))
  return addDesign(g, design, { source: 'claude', status: 'DRAFT', by })
}

// ── 설계 요청 · 자동 재질의 ──────────────────────────────────────────────

/**
 * issue(구조화된 재질의 — 변경과 쟁점 중심, 기존 설계 전문을 반복하지 않는다):
 *   { problem, evidence:[..], conflicts_with, alternatives:[..], question, approval_scope_change:boolean, attachments:[파일], issue_key? }
 * 같은 쟁점(issue_key)의 재질의는 예산(max_requeries_per_issue) 안에서만. 넘으면 RuleError(REQUERY_BUDGET) — 호출자는 작업을 보류한다.
 */
export function prepareDesignRequest(state, ug, { purpose = 'design', issue = null, base_commit = null, by }) {
  const g = findGoal(state, ug)
  const key = issue?.issue_key || (issue ? sha(`${issue.problem}|${issue.conflicts_with || ''}`).slice(0, 12) : 'initial')
  if (issue) {
    const n = (g.counters.requeries[key] || 0) + 1
    if (n > g.budgets.max_requeries_per_issue) throw new RuleError('REQUERY_BUDGET', `같은 설계 쟁점(${key}) 재질의 ${n - 1}회 = 상한 ${g.budgets.max_requeries_per_issue} — 사람 판단으로 넘긴다`)
    const next = String(key).startsWith('next-')
    if (next && (g.counters.next_designs || 0) + 1 > (g.budgets.max_next_designs ?? 8)) throw new RuleError('REQUERY_BUDGET', `자동 다음 설계 요청 상한 ${g.budgets.max_next_designs ?? 8}`)
    if (!next && g.counters.total_requeries + 1 > g.budgets.max_total_requeries) throw new RuleError('REQUERY_BUDGET', `목표 전체 재질의 상한 ${g.budgets.max_total_requeries}`)
  }
  const cur = approvedDesign(g) || latestDesign(g)
  const pending = g.rounds.find((r) => r.recipient === 'chatgpt' && r.response_status === 'PENDING')
  if (pending) throw new RuleError('ROUND_PENDING', `${pending.request_id} 응답을 아직 기다리는 중이다 — 같은 목표에 요청을 겹쳐 보내지 않는다`)
  const roundIdx = g.rounds.length + 1
  const thread = { thread_id: g.thread_id, goal_ref: g.ug_id, round_id: `${g.thread_id}-R${String(roundIdx).padStart(2, '0')}`, design_version: cur?.version ?? 0, base_commit, parent_response_id: [...g.rounds].reverse().find((r) => r.sender === 'chatgpt')?.request_id ?? null, purpose }
  const lines = []
  lines.push(`사용자 목표 ${g.ug_id} 「${g.title}」 (정본 ${g.canon_goal_ids.join(', ')} · 프로필 ${g.profile})`)
  if (cur) lines.push(`현재 설계 v${cur.version} (${cur.status}) 요약: ${cur.summary}`, `현재 수용 기준: ${cur.acceptance.map((a, i) => `[${i}] ${a}`).join(' / ')}`)
  if (issue) {
    lines.push('', '## 쟁점 (이번 라운드에서 판단받을 것만)', `- 문제: ${issue.problem}`, `- 근거: ${(issue.evidence || []).join(' · ') || '(없음)'}`, `- 기존 설계와의 충돌: ${issue.conflicts_with || '(없음)'}`, `- 대안: ${(issue.alternatives || []).map((a, i) => `(${i + 1}) ${a}`).join(' ')}`, `- 판단 요청: ${issue.question}`, `- 사용자 승인 범위 변경 필요: ${issue.approval_scope_change ? '예 — 사용자 승인 전에는 실행하지 않는다' : '아니오'}`)
  } else {
    lines.push('', '## 요청', '이 목표의 설계(무엇을 어디에 어떻게)와 검증 가능한 수용 기준, 바꾸면 안 되는 계약, 수정 허용 경로(allowed_paths)를 제안해 주세요.')
  }
  lines.push('', '응답의 plan 블록에 추가로 "allowed_paths"(배열)와 "db_changes"(boolean)를 넣어 주세요. 이 응답은 제안(PROPOSED)일 뿐이며 사용자 승인 전에는 실행되지 않습니다.')
  return { g, key, thread, question: lines.join('\n'), attachments: issue?.attachments || [] }
}

export function recordDesignRequest(state, ug, { req, thread, key, issue, by }) {
  const g = findGoal(state, ug)
  if (issue) {
    g.counters.requeries[key] = (g.counters.requeries[key] || 0) + 1
    if (String(key).startsWith('next-')) g.counters.next_designs = (g.counters.next_designs || 0) + 1
    else g.counters.total_requeries += 1
    g.open_issue = { issue_key: key, problem: issue.problem, request_id: req.id, at: now() }
  }
  addRound(state, g, { request_id: req.id, sender: 'ai-control', recipient: 'chatgpt', purpose: thread.purpose, design_version: thread.design_version, base_commit: thread.base_commit, parent_response_id: thread.parent_response_id, source_evidence: (issue?.evidence || []).slice(0, 10), issue_key: issue ? key : null })
  history(g, 'round.request', by, req.id)
  logDecision(state, { status: 'RECORDED', kind: 'chatgpt_request', summary: `${g.ug_id} 설계 요청 ${req.id} (${thread.purpose})`, request_id: req.id, by })
}

/** 요청서 파일까지 만든다(상태 밖 파일 쓰기 → 상태 기록). */
export function requestDesign(withState, ug, { purpose = 'design', issue = null, base_commit = null, canon_version, by, context = null }) {
  const prep = withState((s) => {
    const r = prepareDesignRequest(s, ug, { purpose, issue, base_commit, by })
    return { key: r.key, thread: r.thread, question: r.question, attachments: r.attachments, canon: r.g.canon_goal_ids, title: r.g.title }
  })
  // Context Sync(WF-S9): 최신 플랫폼 정보 패킷을 붙인다. 재질의(쟁점)일 때는 쟁점 중심 요청 + 같은 패킷(캐시)이라 전체 설계를 다시 보내지 않는다
  // 외부(ChatGPT)로 나가는 첨부 = 내보내기 허용 파일만 — 선언(요청서·manifest)과 실제 게시가 같아야 한다(Work 실측 F2)
  const ctxFiles = context?.files ? context.files.filter((f) => EXPORT_FILES.has(f)).map((f) => path.join(context.dir, f)) : []
  const question = context?.manifest
    ? `${prep.question}\n\n## 최신 컨텍스트 패킷 (첨부 · main ${context.manifest.base_commit.slice(0, 9)} · ${context.manifest.generated_at})\n각 파일 머리의 등급을 지켜 주세요: code_verified(코드에서 직접 확인) · test_verified(통과 증거) · doc_claim(문서 주장) · unverified(가정). unverified 를 사실로 쓰지 마세요.`
    : `${prep.question}\n\n(컨텍스트 패킷 없음 — 현재 코드 정보 없이 설계하게 된다. 가정은 unverified 로 표시해 주세요.)`
  const req = createRequest({ topic: `${ug} ${prep.title} — ${purpose}`, question, goal_ids: prep.canon, attachments: [...prep.attachments, ...ctxFiles], canon_version, created_by: by, kind: 'plan', thread: { ...prep.thread, context_base_commit: context?.manifest?.base_commit ?? null } })
  withState((s) => recordDesignRequest(s, ug, { req, thread: prep.thread, key: prep.key, issue, by }))
  return req
}

// ── 응답 인수(원자적) ────────────────────────────────────────────────────

const TEMP_EXT = /\.(tmp|part|crdownload|download|partial)$/i

function pidAlive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}

/**
 * planning/responses 의 완성된 응답 파일을 원자적으로 집는다:
 *   · 임시 확장자·0바이트·최근 minAgeMs 안에 바뀐 파일은 건너뛴다(복사 중일 수 있다)
 *   · rename 으로 .processing/ 에 옮긴 쪽만 처리한다(동시에 두 실행이 집어도 하나만 성공)
 * 처리 결과: applied | duplicate | rejected(사유 · planning/rejected/ 로 이동, 원문 보존)
 */
export function claimResponseFiles({ minAgeMs = 2000, nowMs = Date.now() } = {}) {
  const dir = p.responses()
  if (!fs.existsSync(dir)) return []
  fs.mkdirSync(p.processing(), { recursive: true })
  // 집은 뒤 죽은 실행의 파일을 되돌린다(이름 끝 .<pid>.<ms>) — 아니면 .processing 에 영영 남는다
  for (const name of fs.readdirSync(p.processing())) {
    const m = name.match(/^(.*)\.(\d+)\.(\d+)$/)
    if (!m || pidAlive(Number(m[2]))) continue
    try {
      const back = path.join(dir, m[1])
      fs.renameSync(path.join(p.processing(), name), fs.existsSync(back) ? `${back}.recovered-${m[3]}.md` : back)
    } catch {
      /* 다른 실행이 먼저 되돌렸다 */
    }
  }
  const out = []
  for (const name of fs.readdirSync(dir)) {
    const f = path.join(dir, name)
    let st
    try {
      st = fs.statSync(f)
    } catch {
      continue
    }
    if (!st.isFile() || TEMP_EXT.test(name) || !/\.(md|json)$/i.test(name)) continue
    if (st.size === 0 || nowMs - st.mtimeMs < minAgeMs) continue
    const dest = path.join(p.processing(), `${name}.${process.pid}.${Date.now()}`)
    try {
      fs.renameSync(f, dest)
    } catch {
      continue // 다른 실행이 먼저 집었다
    }
    out.push({ name, file: dest })
  }
  return out
}

function moveTo(dir, file, name) {
  fs.mkdirSync(dir, { recursive: true })
  let dest = path.join(dir, name)
  if (fs.existsSync(dest)) dest = `${dest}.${Date.now()}.dup`
  fs.renameSync(file, dest)
  return path.relative(root(), dest).split(path.sep).join('/')
}

/**
 * 응답 하나 적용(상태 변경 · withState 안에서). 검증 순서:
 *   schema → 요청 존재 → thread_id → goal_ref → round_id/설계 버전 → (DB·보안 제안은 자동 실행 대상 아님) → 중복
 * 반환 { status, reason?, ug?, design_version? }
 */
export function applyResponse(state, { resp, text, request_id, file_rel, currentCommit = null, by }) {
  const U = ugState(state)
  const hash = sha(text)
  if (U.processed_responses[hash]) return { status: 'duplicate', reason: `같은 응답을 이미 처리했다(${U.processed_responses[hash].request_id})` }
  const header = readRequestHeader(request_id)
  if (!header) return { status: 'rejected', reason: `요청 ${request_id} 가 없다` }
  if (!header.thread) return { status: 'not_thread', reason: 'thread 없는 옛 형식 요청 — vfc planning import 로 가져온다' }
  const v = validateResponse(resp, { expectRequestId: request_id })
  if (!v.ok) return { status: 'rejected', reason: v.errors.join('; ') }
  const g = U.goals[header.thread.goal_ref]
  if (!g) return { status: 'rejected', reason: `목표 ${header.thread.goal_ref} 가 없다` }
  if (g.thread_id !== header.thread.thread_id) return { status: 'rejected', reason: 'thread 불일치' }
  const round = g.rounds.find((r) => r.request_id === request_id)
  if (!round) return { status: 'rejected', reason: `${g.ug_id} 에 ${request_id} 라운드가 없다` }
  if (round.response_status !== 'PENDING') return { status: 'duplicate', reason: `${request_id} 라운드는 이미 ${round.response_status}` }
  const cur = approvedDesign(g) || latestDesign(g)
  if ((cur?.version ?? 0) !== header.thread.design_version) {
    // 낡은 라운드는 닫는다 — 열린 채 두면 같은 목표의 새 요청이 영영 막힌다
    round.response_status = 'OBSOLETE'
    round.completed_at = now()
    return { status: 'rejected', reason: `요청 뒤 설계가 v${header.thread.design_version} → v${cur?.version} 로 바뀌었다 — 낡은 응답(라운드 OBSOLETE)` }
  }
  let planDesign = null
  // needs_info·reject 는 설계를 제안하지 않는 정당한 응답이다 — plan 이 비어 있어도 거부하지 않고 라운드만 닫는다(Work 실측 2026-10-09)
  if (resp.plan && !['needs_info', 'reject'].includes(resp.verdict)) {
    const pl = resp.plan
    planDesign = { summary: String(pl.design).slice(0, 300), design: pl.design, acceptance: pl.acceptance, preserved_contracts: pl.preserved_contracts, allowed_paths: Array.isArray(pl.allowed_paths) && pl.allowed_paths.length ? pl.allowed_paths : cur?.allowed_paths || [], db_changes: pl.db_changes === true }
    const errs = validateDesign(planDesign, 'plan')
    if (pl.allowed_paths !== undefined && !Array.isArray(pl.allowed_paths)) errs.push('plan.allowed_paths 는 배열')
    if (pl.db_changes !== undefined && typeof pl.db_changes !== 'boolean') errs.push('plan.db_changes 는 boolean')
    // 수정 경로만 비었으면(코드 근거 없이 경로를 지어내지 않은 정직한 응답 — Work 실측 PR #2) 설계 버전은 만들지 않고 응답은 기록·라운드는 닫는다.
    // 다른 형식 오류는 그대로 거부(상태 변경 없음)
    if (errs.length && errs.every((e) => /^plan\.allowed_paths\(/.test(e))) {
      planDesign = null
      var designIncomplete = '수정 허용 경로(allowed_paths) 없음 — 실행 가능한 설계가 아니라 설계 버전을 만들지 않았다(컨텍스트를 붙여 재질의)'
    } else if (errs.length) return { status: 'rejected', reason: `설계 형식 오류(상태 변경 없음): ${errs.join(', ')}` }
  }
  // 기준 커밋: 요청 때 커밋과 지금 커밋이 다르면 적용은 하되 표시한다(설계 응답은 코드 줄 단위가 아니다 — 사람이 승인 때 본다)
  const base_moved = !!(header.thread.base_commit && currentCommit && !String(currentCommit).startsWith(header.thread.base_commit) && !header.thread.base_commit.startsWith(String(currentCommit)))
  for (const e of toDecisionEntries(resp, file_rel)) logDecision(state, { ...e, response_sha256: hash, by, ug_ref: g.ug_id })
  state.decisionLog.imported_responses[request_id] = { sha256: hash, file: file_rel, imported_at: now(), by }
  const design = planDesign ? addDesign(g, planDesign, { source: 'chatgpt', status: 'PROPOSED', request_id, file: file_rel, file_sha256: hash, base_commit: header.thread.base_commit, by }) : null
  round.response_status = 'APPLIED'
  round.approval_status = design ? 'PENDING_USER' : 'NONE'
  // 쟁점은 응답으로 답해졌다 — 남은 판단은 사용자 승인(새 설계)이다. 같은 쟁점이 다시 생기면 새 재질의(예산 차감)로 연다
  if (g.open_issue?.request_id === request_id) g.open_issue = null
  round.completed_at = now()
  addRound(state, g, { request_id, parent_response_id: request_id, sender: 'chatgpt', recipient: 'ai-control', purpose: `${round.purpose}_response`, design_version: design?.version ?? cur?.version ?? null, base_commit: header.thread.base_commit, source_evidence: [file_rel], response_status: 'APPLIED', approval_status: round.approval_status, completed_at: now() })
  U.processed_responses[hash] = { request_id, ug: g.ug_id, at: now() }
  history(g, 'round.response', by, `${request_id} verdict=${resp.verdict}${base_moved ? ' · 기준 커밋 이동' : ''}`)
  return { status: 'applied', ug: g.ug_id, design_version: design?.version ?? null, base_moved, verdict: resp.verdict, ...(typeof designIncomplete === 'string' ? { design_incomplete: designIncomplete } : {}) }
}

/** 응답 디렉터리 전체를 인수한다. withState 는 lib/state.mjs 의 것. thread 없는 옛 응답은 건드리지 않고 되돌려 둔다. */
export function intakeResponses(withState, { by, currentCommitFor = () => null, minAgeMs } = {}) {
  const results = []
  for (const { name, file } of claimResponseFiles({ minAgeMs })) {
    const request_id = (name.match(new RegExp(`^(${REQ_ID_RE.source})`)) || [])[1]
    let text = ''
    let resp = null
    let parseErr = null
    try {
      text = fs.readFileSync(file, 'utf8')
      resp = extractResponse(text, name)
    } catch (e) {
      parseErr = e.message
    }
    // 블록을 못 읽었는데 방금 쓰인 파일이면 덜 복사됐을 수 있다 — 거부하지 않고 되돌려 다음 intake 에서 다시 본다
    if (parseErr && request_id && Date.now() - fs.statSync(file).mtimeMs < 60_000) {
      fs.renameSync(file, path.join(p.responses(), name))
      results.push({ file: name, status: 'deferred', reason: `아직 읽을 수 없다(복사 중일 수 있다): ${parseErr}` })
      continue
    }
    if (!request_id || parseErr) {
      const rel = moveTo(p.rejectedResponses(), file, name)
      results.push({ file: name, status: 'rejected', reason: parseErr || '파일 이름이 REQ-YYYYMMDD-NNN 으로 시작하지 않는다', moved_to: rel })
      continue
    }
    const header = readRequestHeader(request_id)
    if (header && !header.thread) {
      fs.renameSync(file, path.join(p.responses(), name)) // 옛 형식 — planning import 몫
      results.push({ file: name, status: 'not_thread', reason: 'thread 없는 옛 요청 — vfc planning import 로' })
      continue
    }
    const archived = path.join(p.archive(), name)
    const file_rel = path.relative(root(), archived).split(path.sep).join('/')
    const ugRef = header?.thread?.goal_ref
    const r = withState((s) => applyResponse(s, { resp, text, request_id, file_rel, currentCommit: ugRef ? currentCommitFor(ugRef, s) : null, by }), { event: 'usergoal.intake', file: name, by })
    if (r.status === 'applied') {
      fs.mkdirSync(p.archive(), { recursive: true })
      fs.renameSync(file, fs.existsSync(archived) ? `${archived}.${Date.now()}.dup` : archived)
      const req = path.join(p.requests(), `${request_id}.md`)
      if (fs.existsSync(req)) fs.renameSync(req, path.join(p.archive(), `${request_id}.md`))
    } else r.moved_to = moveTo(r.status === 'duplicate' ? path.join(p.archive(), 'duplicates') : p.rejectedResponses(), file, name)
    results.push({ file: name, ...r })
  }
  return results
}

// ── 승인 ────────────────────────────────────────────────────────────────

function requireUserDecision(state, decision_id, token, kind) {
  const d = state.decisionLog.entries.find((e) => e.decision_id === decision_id)
  if (!d || d.status !== 'APPROVED' || d.approved_by !== 'user') throw new RuleError('APPROVAL_REQUIRED', `${kind} 에는 사용자 APPROVED 결정이 필요하다(${decision_id}) — ChatGPT 응답·AI 판단은 승인이 아니다`)
  const text = `${d.summary || ''} ${d.reference || ''}`
  // 경계까지 맞춘다 — 「UG-0001@v10」 승인이 「UG-0001@v1」 을 승인하지 않게(Codex 리뷰 P1)
  const esc = token.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  if (!new RegExp(`(^|[^0-9A-Za-z@-])${esc}(?![0-9A-Za-z])`).test(text)) throw new RuleError('APPROVAL_MISMATCH', `결정 ${decision_id} 의 summary/reference 에 「${token}」 가 없다 — 다른 대상의 승인으로 이 설계를 승인할 수 없다`)
  return d
}

/**
 * 설계 vN 승인. scope.allowed_paths 는 설계의 allowed_paths 부분집합이어야 한다(새 버전이 범위를 자동으로 넓히지 않는다).
 * db_changes 설계는 별도 DB 승인 결정(token 「UG-…@vN db」)이 없으면 승인 자체는 되지만 실행 범위에서 DB 는 빠진다(approval.db=false).
 * 계약이 바뀐 새 버전이면 옛 버전으로 끝난 작업에 revalidate_required 를 단다.
 */
export function approveDesign(state, ug, { version, decision_id, allowed_paths = null, db_decision_id = null, by, via_policy = false }) {
  const g = findGoal(state, ug)
  const d = g.designs.find((x) => x.version === Number(version))
  if (!d) throw new RuleError('NO_DESIGN', `${ug} 에 설계 v${version} 가 없다`)
  if (via_policy) {
    // 목표 실행 정책(사용자 대화형 goal_delegation 승인)으로 버전 승인을 대신한다 — 정책이 이 설계를 덮을 때만 · DB 범위는 정책으로 못 연다
    const pol = g.execution_policy
    if (!pol || pol.approval_evidence !== decision_id) throw new RuleError('POLICY_REQUIRED', `${ug} 에 결정 ${decision_id} 로 승인된 실행 정책이 없다`)
    const pd = state.decisionLog.entries.find((e) => e.decision_id === decision_id)
    if (!isTrustedUserDecision(pd) || pd.kind !== 'goal_delegation' || pd.policy_sha256 !== pol.policy_sha256) throw new RuleError('TRUST_REQUIRED', `정책 근거 ${decision_id} 가 대화형 goal_delegation 결정이 아니거나 정책 내용과 다르다`)
    if (db_decision_id) throw new RuleError('BAD_SCOPE', 'DB 범위는 정책으로 승인하지 않는다(별도 대화형 db_write 승인)')
    const cov = policyCovers(pol, { paths: allowed_paths && allowed_paths.length ? allowed_paths : d.allowed_paths, db_changes: d.db_changes, capability: 'code_change' })
    if (!cov.ok) throw new RuleError('POLICY_NOT_COVERED', `설계 v${d.version} 는 정책 밖: ${cov.why.join(' / ')}`)
  }
  // 이미 승인된 버전에 DB 승인만 더하는 경우(설계 승인 때 DB 승인이 없었다)
  if (d.status === 'APPROVED' && db_decision_id && g.approval?.design_version === d.version && !g.approval.db) {
    if (!d.db_changes) throw new RuleError('BAD_SCOPE', '이 설계는 DB 변경이 없다')
    const dbd = requireUserDecision(state, db_decision_id, `${ug}@v${d.version} db`, 'DB 변경 승인')
    if (!isTrustedUserDecision(dbd)) throw new RuleError('TRUST_REQUIRED', `DB 변경 승인 ${db_decision_id} 는 대화형 터미널 기록이 아니다 — vfc approve --kind db_write`)
    g.approval = { ...g.approval, db: true, db_decision_id }
    history(g, `design.v${d.version}.DB_APPROVED`, by, db_decision_id)
    return { design: d, invalidated: [], contract_changed: false, resumed: [], drafts: [] }
  }
  if (!['PROPOSED', 'REVIEWED', 'DRAFT'].includes(d.status)) throw new RuleError('BAD_TRANSITION', `설계 v${version} 는 ${d.status} — 승인 대상이 아니다`)
  if (PROFILES[g.profile].needs_design && d.source === 'claude') throw new RuleError('DESIGN_REVIEW_REQUIRED', `프로필 ${g.profile} 은 ChatGPT 설계 검토가 선행된다 — Claude 초안 v${d.version} 를 바로 승인하지 않는다(ugoal request-design)`)
  if (!via_policy) requireUserDecision(state, decision_id, `${ug}@v${d.version}`, '설계 승인')
  const scope = allowed_paths && allowed_paths.length ? allowed_paths : d.allowed_paths
  const outside = scope.filter((x) => !d.allowed_paths.includes(x))
  if (outside.length) throw new RuleError('SCOPE_EXPANSION', `승인 범위 ${outside.join(', ')} 는 설계 v${d.version} 의 allowed_paths 밖이다`)
  let db = false
  if (db_decision_id) {
    if (!d.db_changes) throw new RuleError('BAD_SCOPE', '이 설계는 DB 변경이 없다')
    const dbd = requireUserDecision(state, db_decision_id, `${ug}@v${d.version} db`, 'DB 변경 승인')
    if (!isTrustedUserDecision(dbd)) throw new RuleError('TRUST_REQUIRED', `DB 변경 승인 ${db_decision_id} 는 대화형 터미널 기록이 아니다 — vfc approve --kind db_write`)
    db = true
  }
  const prev = approvedDesign(g)
  if (prev) prev.status = 'SUPERSEDED'
  for (const x of g.designs) if (x !== d && ['PROPOSED', 'REVIEWED', 'DRAFT'].includes(x.status) && x.version < d.version) x.status = 'SUPERSEDED'
  d.status = 'APPROVED'
  d.approved_at = now()
  g.approval = { design_version: d.version, via_policy, decision_id, allowed_paths: scope, db, db_decision_id: db ? db_decision_id : null }
  for (const r of g.rounds) if (r.design_version === d.version && r.approval_status === 'PENDING_USER') r.approval_status = 'APPROVED'
  const changed = prev && prev.contract_hash !== d.contract_hash
  const invalidated = []
  for (const t of state.taskQueue.tasks.filter((x) => x.user_goal_id === ug)) {
    if (!prev || t.design_version === d.version) continue
    if (changed && ['COMPLETED', 'IN_PROGRESS', 'REVIEW'].includes(t.status)) {
      t.revalidate_required = { reason: `설계 계약 v${t.design_version} → v${d.version} 변경`, at: now() }
      invalidated.push(t.task_id)
    }
  }
  // 설계 쟁점으로 멈춘 작업 · 설계 대기 초안을 새 승인 범위로 다시 연다(자동 재개). 범위 밖이면 그대로 둔다(사람이 다시 만든다)
  const resumed = []
  for (const t of state.taskQueue.tasks.filter((x) => x.user_goal_id === ug && x.status === 'BLOCKED' && /^DESIGN_CONFLICT/.test(x.blocker?.reason || ''))) {
    if (!t.allowed_paths.every((x) => pathInApproval(scope, x))) continue
    // 옛 설계의 수용 기준 번호는 문장이 새 설계에 그대로 있을 때만 새 번호로 옮긴다 — 다른 계약을 옛 번호로 덮지 않는다(Codex 리뷰 P1)
    const from = g.designs.find((x) => x.version === t.design_version)
    const norm = (s) => String(s).replace(/\s+/g, ' ').trim()
    t.design_acceptance = (t.design_acceptance || []).map((i) => d.acceptance.findIndex((a) => norm(a) === norm(from?.acceptance?.[i] ?? ''))).filter((i) => i >= 0)
    t.design_version = d.version
    t.blocker = null
    t.history.push({ at: now(), from: 'BLOCKED', to: 'READY', by, note: `${ug} 설계 v${d.version} 승인(${decision_id}) — 설계 쟁점 해소` })
    t.status = 'READY'
    resumed.push(t.task_id)
  }
  const drafts = (g.task_drafts || []).splice(0)
  if (changed && g.status === 'ACCEPTED') {
    g.status = 'OPEN'
    g.accepted_at = null
    history(g, 'goal.reopened', by, `설계 계약 v${prev.version} → v${d.version} 변경 — 이전 수용은 무효`)
  }
  if (g.open_issue) g.open_issue = null
  history(g, `design.v${d.version}.APPROVED`, by, `${decision_id}${changed ? ` · 계약 변경 → 재검증 ${invalidated.join(',') || '없음'}` : ''}${resumed.length ? ` · 재개 ${resumed.join(',')}` : ''}`)
  return { design: d, invalidated, contract_changed: !!changed, resumed, drafts }
}

const pathInApproval = (scope, x) => scope.some((s) => s === x || (s.endsWith('**') && x.startsWith(s.slice(0, -2))))

/** 설계 승인 전 작업 초안 — 승인되면 호출자가 bindTaskSpec → addTask 로 만든다(설계 대기 → 자동 재개) */
export function addTaskDraft(state, ug, spec, { by }) {
  const g = findGoal(state, ug)
  ;(g.task_drafts ||= []).push({ spec, at: now(), by })
  history(g, 'task.draft', by, spec.title)
  return g.task_drafts.length
}

// ── 작업 연결 ───────────────────────────────────────────────────────────

/** 작업 spec 을 사용자 목표에 묶는다: 승인된 설계 · 승인 범위 안 경로 · 프로필의 게이트. 호출자는 이어서 addTask 한다. */
export function bindTaskSpec(state, ug, spec) {
  const g = findGoal(state, ug)
  const d = approvedDesign(g)
  if (!d) throw new RuleError('DESIGN_NOT_APPROVED', `${ug} 에 승인된 설계가 없다 — 작업을 만들 수 없다`)
  const scope = g.approval.allowed_paths
  const outside = (spec.allowed_paths || []).filter((x) => !pathInApproval(scope, x))
  if (outside.length) throw new RuleError('SCOPE_EXPANSION', `작업 경로 ${outside.join(', ')} 는 ${ug} 승인 범위(${scope.join(', ')}) 밖이다`)
  if (spec.db_scope && !['none', 'read'].includes(spec.db_scope.mode) && !g.approval.db) throw new RuleError('APPROVAL_REQUIRED', `${ug} 는 DB 변경 승인이 없다 — DB 작업을 만들 수 없다`)
  if (!g.canon_goal_ids.includes(spec.goal_id)) throw new RuleError('GOAL_MISMATCH', `작업 goal_id ${spec.goal_id} 는 ${ug} 의 정본 목표(${g.canon_goal_ids.join(',')})가 아니다`)
  const prof = PROFILES[g.profile]
  return { ...spec, user_goal_id: ug, design_version: d.version, ...(prof.require_review_pass ? { require_review_pass: true } : {}) }
}

// ── 라우터 ──────────────────────────────────────────────────────────────

/** 지금 이 목표에 필요한 다음 한 걸음. 반환 { route, reason, actor, waiting? } */
export function route(state, ug) {
  const g = findGoal(state, ug)
  const R = (r, reason, actor, extra = {}) => ({ ug_id: ug, route: r, reason, actor, ...extra })
  if (g.status === 'ACCEPTED') return R('USER_ACCEPTED', `사용자 최종 수락(${g.accept_decision_id ?? '결정 없음'})`, null)
  if (g.status === 'PAUSED') return R('PAUSED', '사용자가 일시정지', 'user')
  const pending = g.rounds.find((r) => r.recipient === 'chatgpt' && r.response_status === 'PENDING')
  if (pending) {
    const hours = (Date.now() - Date.parse(pending.created_at)) / 3_600_000
    if (hours > g.budgets.max_wait_hours) return R('EXTERNAL_BLOCKER', `ChatGPT 응답 대기 ${Math.round(hours)}시간 > 상한 ${g.budgets.max_wait_hours}`, 'user', { request_id: pending.request_id })
    return R(g.open_issue ? 'DESIGN_CONFLICT' : 'DESIGN_REQUIRED', `${pending.request_id} 응답 대기(HUMAN_IN_THE_LOOP: 사용자가 ChatGPT 에 전달·응답 저장)`, 'chatgpt', { waiting: true, request_id: pending.request_id })
  }
  if (g.open_issue) return R('DESIGN_CONFLICT', `설계 쟁점: ${g.open_issue.problem}`, 'chatgpt')
  const appr = approvedDesign(g)
  const latest = latestDesign(g)
  if (latest && ['PROPOSED', 'REVIEWED', 'DRAFT'].includes(latest.status) && (!appr || latest.version > appr.version)) {
    if (latest.status === 'DRAFT' && PROFILES[g.profile].needs_design && latest.source === 'claude') return R('DESIGN_REQUIRED', `프로필 ${g.profile} 은 ChatGPT 설계 검토가 선행된다`, 'chatgpt')
    const miss = latest.code_check?.missing?.length ? ` · ⚠ main 에 없는 경로 ${latest.code_check.missing.map((m) => m.path).join(', ')}` : ''
    return R('APPROVAL_REQUIRED', `설계 v${latest.version} (${latest.status}) 사용자 승인 대기 — vfc decision add … 「${ug}@v${latest.version}」 → vfc ugoal approve${miss}`, 'user', { design_version: latest.version, code_check: latest.code_check ?? null })
  }
  if (!appr) return R('DESIGN_REQUIRED', PROFILES[g.profile].needs_design ? `프로필 ${g.profile} — 설계 선행` : '설계가 없다(Claude 초안 또는 ChatGPT 요청)', PROFILES[g.profile].needs_design ? 'chatgpt' : 'claude')
  if (appr.db_changes && !g.approval.db) return R('APPROVAL_REQUIRED', `설계 v${appr.version} 는 DB 변경을 포함한다 — DB 승인(「${ug}@v${appr.version} db」) 전에는 DB 작업을 만들지 않는다`, 'user', { db: true })
  const tasks = state.taskQueue.tasks.filter((t) => t.user_goal_id === ug)
  const current = tasks.filter((t) => t.design_version === appr.version)
  const stale = tasks.filter((t) => t.revalidate_required || (t.design_version !== appr.version && t.status !== 'COMPLETED'))
  if (current.some((t) => t.status === 'REVIEW')) return R('CODE_REVIEW_REQUIRED', 'Codex 독립 리뷰 대기', 'codex')
  const defect = current.find((t) => t.status === 'READY' && [...t.history].reverse().find((h) => h.from === 'REVIEW')?.to === 'READY')
  if (defect) return R('IMPLEMENTATION_DEFECT', `${defect.task_id} 리뷰 반려 — Claude 수정 → Codex 재리뷰`, 'claude', { task_id: defect.task_id })
  if (current.some((t) => ['READY', 'IN_PROGRESS'].includes(t.status))) return R('IMPLEMENTATION_REQUIRED', '실행할 작업이 있다', 'claude')
  const acc = acceptanceCoverage(state, ug)
  if (acc.ok) return R('GOAL_VERIFIED', `설계 v${appr.version} 수용 기준 ${acc.total}개 전부 COMPLETED 작업이 덮는다 — 사용자 최종 수락 대기: 사용자가 직접 vfc decision add 「UG-… accept」 → vfc ugoal accept --decision`, 'user', { coverage: acc })
  if (current.some((t) => t.status === 'BLOCKED') && !current.some((t) => t.status === 'READY')) return R('EXTERNAL_BLOCKER', `작업 BLOCKED: ${current.filter((t) => t.status === 'BLOCKED').map((t) => `${t.task_id}(${t.blocker?.reason?.slice(0, 60)})`).join(', ')}`, 'user')
  return R('IMPLEMENTATION_REQUIRED', `덮이지 않은 수용 기준 [${acc.missing.join(',')}]${stale.length ? ` · 재검증 필요 ${stale.map((t) => t.task_id).join(',')}` : ''} — 작업 분해(ugoal task add)`, 'claude', { coverage: acc })
}

/** 설계 수용 기준 i 를 덮는 COMPLETED 작업(현재 설계 버전 · 재검증 불필요 · design_acceptance 에 i 포함)이 있는가 */
/** 사용자 목표의 진행 단계 — 작업 완료(TASK_COMPLETED)와 목표 검증(GOAL_VERIFIED)·사용자 수락(USER_ACCEPTED)을 분리 */
export function goalLevelOf(state, ug) {
  const g = findGoal(state, ug)
  const acc = acceptanceCoverage(state, ug)
  const done = state.taskQueue.tasks.filter((t) => t.user_goal_id === ug && t.status === 'COMPLETED').map((t) => t.task_id)
  const level = g.status === 'ACCEPTED' && g.accept_decision_id ? 'USER_ACCEPTED' : acc.ok ? 'GOAL_VERIFIED' : acc.covered?.length ? 'GOAL_PARTIAL' : done.length ? 'TASK_COMPLETED' : 'NONE'
  return { goal_id: ug, level, coverage: { total: acc.total, covered: acc.covered, missing: acc.missing }, tasks_done: done }
}

export function acceptanceCoverage(state, ug) {
  const g = findGoal(state, ug)
  const appr = approvedDesign(g)
  if (!appr) return { ok: false, total: 0, missing: [], covered: [] }
  const done = state.taskQueue.tasks.filter((t) => t.user_goal_id === ug && t.status === 'COMPLETED' && t.design_version === appr.version && !t.revalidate_required && t.impact?.dependency_type !== 'prerequisite')
  const covered = new Set(done.flatMap((t) => t.design_acceptance || []))
  // 읽기 전용 live 검증 PASS(같은 설계 버전) 도 그 기준을 덮는다 — UNVERIFIED·FAIL 은 덮지 않는다
  const latestDone = done.reduce((a, t) => (t.updated_at > a ? t.updated_at : a), '')
  const latestByTest = new Map()
  for (const v of g.live_verifications || []) if (v.design_version === appr.version) latestByTest.set(v.test, v)
  // 마지막 구현(완료 작업의 verified_commit)에서 돈 검증만 — 옛 worktree·이후 변경 코드의 근거로 쓰지 않는다(Codex P2)
  const lastTask = done.reduce((a, t) => (!a || t.updated_at > a.updated_at ? t : a), null)
  for (const v of latestByTest.values()) if (v.status === 'PASS' && v.at >= latestDone && (!lastTask?.verified_commit || v.commit === lastTask.verified_commit)) for (const i of v.acceptance || []) covered.add(i)
  const missing = appr.acceptance.map((_, i) => i).filter((i) => !covered.has(i))
  return { ok: missing.length === 0, total: appr.acceptance.length, missing, covered: [...covered].sort(), tasks: done.map((t) => t.task_id) }
}

/**
 * 최종 수락은 사용자가 직접 기록한 APPROVED 결정(「UG-…accept」)이 있어야 한다. 「--by user」 인수나 에이전트가 옮겨 적은 결정(recorded_via=agent)은 근거가 아니다(WF-S12 감사).
 */
export function acceptGoal(state, ug, { by, decision_id }) {
  const g = findGoal(state, ug)
  const acc = acceptanceCoverage(state, ug)
  if (!acc.ok) throw new RuleError('NOT_ACCEPTED', `덮이지 않은 수용 기준 [${acc.missing.join(',')}] — 완료로 위장하지 않는다`)
  const d = requireUserDecision(state, decision_id, `${ug} accept`, '목표 최종 수락')
  if (!isTrustedUserDecision(d)) throw new RuleError('TRUST_REQUIRED', `결정 ${decision_id} 는 대화형 터미널 승인이 아니다(recorded_via=${d.recorded_via ?? '없음'}) — 최종 수락은 사용자가 일반 터미널에서 vfc approve --kind goal_acceptance 로 기록한다`)
  g.status = 'ACCEPTED'
  g.accepted_at = now()
  g.accept_decision_id = decision_id
  history(g, 'goal.accepted', by, `tasks ${acc.tasks.join(',')} · ${decision_id}`)
  if (ugState(state).active_goal === ug) ugState(state).active_goal = null
  return { goal: g, coverage: acc }
}

// ── 실행 모드 · 선정 필터 ────────────────────────────────────────────────

export function setActive(state, ug, { by }) {
  const U = ugState(state)
  if (ug) {
    const g = findGoal(state, ug)
    if (g.status === 'ACCEPTED') throw new RuleError('BAD_TRANSITION', `${ug} 는 이미 ACCEPTED`)
    U.active_goal = ug
    U.mode = 'USER_GOAL'
    history(g, 'goal.activated', by)
  } else U.active_goal = null
  return U
}

/** 이 목표의 ChatGPT 쪽 위치(사람이 다시 찾기 위한 참조). 자동 라우팅은 goal/thread/request/round 로만 한다. */
export const CHAT_SURFACES = ['chat', 'work', 'event_task', 'desktop_work']
export function linkSurface(state, ug, { surface, url = null, by }) {
  const g = findGoal(state, ug)
  if (!CHAT_SURFACES.includes(surface)) throw new RuleError('BAD_SURFACE', `surface 는 ${CHAT_SURFACES.join('|')}`)
  if (url && !/^https:\/\/(chatgpt\.com|chat\.openai\.com)\//.test(url)) throw new RuleError('BAD_URL', 'chat_url 은 https://chatgpt.com/… 만 — 참조용')
  g.chat_surface = surface
  g.chat_url = url
  history(g, 'surface.linked', by, surface)
  return { ug_id: ug, chat_surface: surface, chat_url: url }
}

/**
 * 아직 응답이 없는 요청 라운드를 취소한다(예: 게시 전 패킷을 고쳐 다시 만들어야 할 때). 응답이 온 라운드는 취소할 수 없다.
 * 취소는 라운드를 CANCELLED 로 닫을 뿐 — 이미 게시했다면 교환 저장소 PR 도 닫아야 한다(work-bridge 는 취소된 요청을 게시하지 않는다).
 */
export function cancelRequest(state, ug, request_id, { reason, by }) {
  const g = findGoal(state, ug)
  const r = g.rounds.find((x) => x.request_id === request_id && x.recipient === 'chatgpt')
  if (!r) throw new RuleError('NO_ROUND', `${ug} 에 ${request_id} 요청 라운드가 없다`)
  if (r.response_status !== 'PENDING') throw new RuleError('BAD_TRANSITION', `${request_id} 는 ${r.response_status} — 응답 대기 중인 요청만 취소한다`)
  if (!reason) throw new RuleError('NO_REASON', '취소 사유가 필요하다')
  r.response_status = 'CANCELLED'
  r.completed_at = now()
  if (g.open_issue?.request_id === request_id) g.open_issue = null
  history(g, 'round.cancelled', by, `${request_id}: ${reason}`)
  return { ug_id: ug, request_id, response_status: 'CANCELLED' }
}

export function setMode(state, mode) {
  if (!MODES.includes(mode)) throw new RuleError('BAD_MODE', `mode 는 ${MODES.join('|')}`)
  ugState(state).mode = mode
  return ugState(state)
}

export function setPaused(state, ug, paused, { by }) {
  const g = findGoal(state, ug)
  if (g.status === 'ACCEPTED') throw new RuleError('BAD_TRANSITION', `${ug} 는 ACCEPTED`)
  g.status = paused ? 'PAUSED' : 'OPEN'
  history(g, paused ? 'goal.paused' : 'goal.resumed', by)
  return g
}

/**
 * 오케스트레이터 선정 필터. 반환 { allow:boolean, reason?, tier } — tier 가 낮을수록 먼저.
 *   USER_GOAL 모드: 활성 목표 작업(tier 0) → 다른 열린 사용자 목표 작업(tier 1). 사용자 목표 없는 플랫폼 작업은 고르지 않는다.
 *   PLATFORM_AUTO: 모든 작업(사용자 목표 작업은 아래 게이트 통과 시).
 *   게이트(모드 무관): 일시정지·완료 목표 · 설계 미승인 · 작업의 설계 버전 ≠ 승인 버전 · 재검증 필요.
 */
export function selectionGate(state, task) {
  const U = ugState(state)
  if (!task.user_goal_id) return U.mode === 'USER_GOAL' ? { allow: false, reason: `USER_GOAL 모드${U.active_goal ? `(활성 ${U.active_goal})` : ''} — 사용자 목표 밖 플랫폼 작업은 PLATFORM_AUTO 에서만` } : { allow: true, tier: 0 }
  const g = U.goals[task.user_goal_id]
  if (!g) return { allow: false, reason: `사용자 목표 ${task.user_goal_id} 없음` }
  if (g.status !== 'OPEN') return { allow: false, reason: `${g.ug_id} ${g.status}` }
  const appr = approvedDesign(g)
  if (!appr) return { allow: false, reason: `${g.ug_id} 승인된 설계 없음` }
  if (task.design_version !== appr.version) return { allow: false, reason: `설계 v${task.design_version} 는 SUPERSEDED(현재 v${appr.version}) — 새 설계 기준으로 다시 만든다` }
  if (task.revalidate_required) return { allow: false, reason: `재검증 필요: ${task.revalidate_required.reason}` }
  if (g.rounds.some((r) => r.recipient === 'chatgpt' && r.response_status === 'PENDING') && g.open_issue) return { allow: false, reason: `${g.ug_id} 설계 쟁점 응답 대기` }
  if (g.execution_policy && g.approval?.via_policy) {
    // 정책으로 승인된 설계의 작업 — 작업마다 위험·범위를 다시 본다(HIGH·범위 밖·예산 초과는 그 작업만 보류)
    const cov = policyCovers(g.execution_policy, { paths: task.allowed_paths, db_scope: task.db_scope, capability: 'code_change' })
    if (!cov.ok) return { allow: false, reason: `정책 밖 — 사용자 승인 대기: ${cov.why.join(' / ')}` }
    const spent = state.taskQueue.tasks.filter((t) => t.user_goal_id === g.ug_id).reduce((a, t) => a + (t.orchestration?.budget_used_usd || 0), 0)
    if (spent >= g.execution_policy.max_cost_usd) return { allow: false, reason: `목표 비용 상한 ${g.execution_policy.max_cost_usd}$ 도달(누적 ${spent.toFixed(2)}$)` }
  }
  return { allow: true, tier: U.mode === 'USER_GOAL' && U.active_goal !== g.ug_id ? 1 : 0 }
}

/** 목표 정책의 남은 비용(정책 없으면 null) — 그 목표 작업들의 누적 사용액 기준 */
export function policyBudgetLeft(state, ug) {
  const g = ugState(state).goals[ug]
  if (!g?.execution_policy) return null
  const spent = state.taskQueue.tasks.filter((t) => t.user_goal_id === ug).reduce((a, t) => a + (t.orchestration?.budget_used_usd || 0), 0)
  return g.execution_policy.max_cost_usd - spent
}

export function limitsFor(state, task, base) {
  if (!task.user_goal_id) return base
  const g = ugState(state).goals[task.user_goal_id]
  if (!g) return base
  const prof = PROFILES[g.profile]
  const out = { ...base, max_review_rounds: Math.min(base.max_review_rounds, prof.max_review_rounds), claude_budget_usd: Math.min(base.claude_budget_usd, prof.claude_budget_usd), codex_effort: prof.codex_effort }
  if (g.execution_policy && base.max_minutes) out.max_minutes = Math.min(base.max_minutes, g.execution_policy.max_runtime_min)
  const left = policyBudgetLeft(state, g.ug_id)
  if (left !== null) out.claude_budget_usd = Math.max(0, Math.min(out.claude_budget_usd, left))
  return out
}

export function summary(state, ug) {
  const g = findGoal(state, ug)
  return {
    ug_id: g.ug_id,
    thread_id: g.thread_id,
    title: g.title,
    origin: g.origin,
    profile: g.profile,
    status: g.status,
    chat_surface: g.chat_surface ?? null,
    chat_url: g.chat_url ?? null,
    owners: [...new Set(state.taskQueue.tasks.filter((t) => t.user_goal_id === ug).map((t) => `${t.owner_id}@${t.worktree ?? '-'}`))],
    canon_goal_ids: g.canon_goal_ids,
    approval: g.approval,
    designs: g.designs.map((d) => ({ version: d.version, status: d.status, source: d.source, request_id: d.request_id, contract_hash: d.contract_hash.slice(0, 12), acceptance: d.acceptance.length })),
    rounds: g.rounds.map((r) => ({ round_id: r.round_id, request_id: r.request_id, sender: r.sender, recipient: r.recipient, purpose: r.purpose, design_version: r.design_version, response_status: r.response_status, approval_status: r.approval_status })),
    counters: g.counters,
    tasks: state.taskQueue.tasks.filter((t) => t.user_goal_id === ug).map((t) => ({ task_id: t.task_id, status: t.status, design_version: t.design_version, revalidate_required: !!t.revalidate_required })),
    route: route(state, ug),
  }
}

export { sha256File }

/**
 * 사용자가 대화형 터미널로 기록한 설계 승인(vfc approve --kind design_approval --summary 「UG-…@vN」 [--paths ..])을 적용한다.
 * 오케스트레이터가 반복마다 부른다 — 사용자는 승인 명령 하나만 실행하면 되고, 적용·작업 재개는 자동이다.
 * tty 결정만(에이전트·cli 기록은 무시) · 이미 적용된 결정은 다시 쓰지 않는다 · 범위 확장·DEEP 초안 직승인 같은 기존 규칙은 approveDesign 이 그대로 검사한다.
 */
export function applyTrustedDesignApprovals(state, { by = 'orchestrator' } = {}) {
  const out = []
  // ① 목표 실행 정책: 대화형 goal_delegation 결정(「UG-…@policy」 + 정책 내용 sha256) → goal.execution_policy
  for (const d of state.decisionLog.entries) {
    if (d.kind !== 'goal_delegation' || !isTrustedUserDecision(d) || d.auto_applied) continue
    const g = d.policy && ugState(state).goals[d.policy.goal_id]
    const errs = d.policy ? validatePolicy(d.policy) : ['정책 내용 없음']
    const tokenOk = g && new RegExp(`(^|[^0-9A-Za-z@-])${g.ug_id.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}@policy(?![0-9A-Za-z])`).test(d.summary || '')
    if (!g || errs.length || !tokenOk || policySha(d.policy) !== d.policy_sha256) {
      d.auto_applied = { at: now(), error: !g ? '목표 없음' : errs.length ? errs.join('; ') : !tokenOk ? 'summary 에 「UG-…@policy」 없음' : '정책 sha256 불일치' }
      out.push({ decision_id: d.decision_id, error: d.auto_applied.error })
      continue
    }
    g.execution_policy = { ...d.policy, approval_evidence: d.decision_id, policy_sha256: d.policy_sha256, applied_at: now() }
    history(g, 'goal.policy', by, d.decision_id)
    d.auto_applied = { ug: g.ug_id, policy: true, at: now() }
    out.push({ ug: g.ug_id, policy: d.decision_id })
  }
  // ② 정책이 있는 목표: 최신 PROPOSED 설계가 정책 안이면 버전 승인 없이 적용(사용자 재승인 없음)
  for (const g of Object.values(ugState(state).goals)) {
    const pol = g.execution_policy
    if (!pol || g.status !== 'OPEN') continue
    const latest = g.designs[g.designs.length - 1]
    if (!latest || latest.status !== 'PROPOSED' || g.approval?.design_version === latest.version) continue
    const key = `${g.ug_id}@v${latest.version}#${pol.policy_sha256.slice(0, 12)}`
    if ((g.policy_attempts || {})[key]) continue // 같은 버전은 한 번만 시도(정책 밖이면 사람 승인 대기로 남긴다)
    g.policy_attempts = { ...(g.policy_attempts || {}), [key]: now() }
    try {
      const r = approveDesign(state, g.ug_id, { version: latest.version, decision_id: pol.approval_evidence, by, via_policy: true })
      const created = []
      const refused = []
      for (const dr of r.drafts || []) {
        try {
          created.push(addTask(state, bindTaskSpec(state, g.ug_id, dr.spec), { ugBound: true }).task_id)
        } catch (e) {
          refused.push({ title: dr.spec.title, reason: e.message })
          g.task_drafts = [...(g.task_drafts || []), dr]
        }
      }
      if (!created.length && !(r.resumed ?? []).length) {
        const auto = autoTaskFromDesign(state, g, latest, { by })
        if (auto.task_id) created.push(auto.task_id)
        else if (auto.reason) refused.push({ title: '자동 작업', reason: auto.reason })
      }
      out.push({ ug: g.ug_id, version: latest.version, via_policy: pol.approval_evidence, created, refused, resumed: r.resumed ?? [] })
    } catch (e) {
      history(g, 'goal.policy_not_covered', by, `v${latest.version}: ${String(e.message).slice(0, 300)}`)
      out.push({ ug: g.ug_id, version: latest.version, error: `${e.code ?? 'ERROR'}: ${String(e.message).slice(0, 200)}` })
    }
  }
  const used = new Set(Object.values(ugState(state).goals).map((g) => g.approval?.decision_id).filter(Boolean))
  for (const d of state.decisionLog.entries) {
    if (d.kind !== 'design_approval' || !isTrustedUserDecision(d) || used.has(d.decision_id) || d.auto_applied) continue
    const text = `${d.summary || ''} ${d.reference || ''}`
    for (const g of Object.values(ugState(state).goals)) {
      if (g.status !== 'OPEN') continue
      for (const v of g.designs) {
        const esc = `${g.ug_id}@v${v.version}`.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
        if (!new RegExp(`(^|[^0-9A-Za-z@-])${esc}(?![0-9A-Za-z])`).test(text)) continue
        try {
          const r = approveDesign(state, g.ug_id, { version: v.version, decision_id: d.decision_id, allowed_paths: d.allowed_paths || null, by })
          // 승인 전 초안 → 작업(vfc ugoal approve 와 같은 절차 · 범위 밖 초안은 사유와 함께 남긴다)
          const created = []
          const refused = []
          for (const dr of r.drafts || []) {
            try {
              created.push(addTask(state, bindTaskSpec(state, g.ug_id, dr.spec), { ugBound: true }).task_id)
            } catch (e) {
              refused.push({ title: dr.spec.title, reason: e.message })
              // 범위·DB 승인 부족으로 거부된 초안은 버리지 않고 다시 보관 — 별도 승인 뒤 재시도(Codex P2)
              g.task_drafts = [...(g.task_drafts || []), dr]
            }
          }
          d.auto_applied = { ug: g.ug_id, version: v.version, at: now(), created, refused }
          out.push({ ug: g.ug_id, version: v.version, decision_id: d.decision_id, created, refused, resumed: r.resumed ?? [] })
        } catch (e) {
          d.auto_applied = { ug: g.ug_id, version: v.version, at: now(), error: `${e.code ?? 'ERROR'}: ${String(e.message).slice(0, 200)}` }
          out.push({ ug: g.ug_id, version: v.version, decision_id: d.decision_id, error: d.auto_applied.error })
        }
      }
    }
  }
  return out
}

const OPEN_TASK = new Set(['READY', 'IN_PROGRESS', 'REVIEW', 'BLOCKED', 'WAITING_CHATGPT'])

/**
 * 정책 승인 설계 → 작업 하나 자동 생성(작업 큐가 비어도 멈추지 않게).
 * 조건: 위임(delegations) 의 owner·worktree 가 있다 · 이 목표의 열린 작업·초안이 없다 · 덮이지 않은 기준이 있다.
 * 작업 계약: 설계 allowed_paths · 설계 수용 기준 문장 · design_acceptance = 덮이지 않은 기준 · 금지 = HIGH 계열 경로.
 */
export function autoTaskFromDesign(state, g, design, { by = 'orchestrator' } = {}) {
  const dlg = (g.delegations || []).at(-1)
  if (!dlg?.executor_owner || !dlg?.worktree) return { reason: '위임 owner·worktree 없음 — 작업을 자동으로 만들 수 없다' }
  if (state.taskQueue.tasks.some((t) => t.user_goal_id === g.ug_id && OPEN_TASK.has(t.status)) || (g.task_drafts || []).length) return { reason: '열린 작업·초안이 이미 있다' }
  const acc = acceptanceCoverage(state, g.ug_id)
  const idx = acc.missing?.length ? acc.missing : design.acceptance.map((_, i) => i)
  const canon = loadCriteria().criteria
  const goal3 = g.canon_goal_ids.find((id) => canon.find((c) => c.id === id)?.level === 3)
  if (!goal3) return { reason: '정본 L3 목표가 없다' }
  const spec = {
    goal_id: goal3,
    title: `${g.ug_id} 설계 v${design.version} 구현(자동)`,
    description: `정책 승인(${g.execution_policy?.approval_evidence}) 설계 v${design.version}: ${String(design.summary || '').slice(0, 600)}`,
    priority: 'P1',
    owner_id: dlg.executor_owner,
    allowed_paths: design.allowed_paths,
    forbidden_paths: ['supabase/**', '**/*.sql', '**/.env*', 'docs/csat-learner/LEARNING_MAP_VNEXT.md', 'goals/**', '.github/workflows/**', '**/package.json', '**/pnpm-lock.yaml'],
    acceptance: idx.map((i) => design.acceptance[i]),
    worktree: dlg.worktree,
    branch: dlg.branch,
    design_acceptance: idx,
    created_by: by,
  }
  try {
    const t = addTask(state, bindTaskSpec(state, g.ug_id, spec), { ugBound: true })
    history(g, 'task.auto', by, `${t.task_id} v${design.version} [${idx.join(',')}]`)
    return { task_id: t.task_id }
  } catch (e) {
    return { reason: `${e.code ?? 'ERROR'}: ${String(e.message).slice(0, 200)}` }
  }
}

/**
 * 작업 큐가 비었을 때 다음 설계를 자동 요청할지 — 정책 있는 OPEN 목표 · 응답 대기 요청 없음 · 열린 작업·초안 없음 · 예산 남음 ·
 * 같은 (승인 버전 · 미충족 기준) 조합으로 이미 요청하지 않았음. 쟁점은 사용자 방향(next_scope) · 미충족 기준 · 정책 코드 영역에서 만든다.
 */
export function nextDesignIssue(state, ug, { base = null, checkKey = true } = {}) {
  const g = ugState(state).goals[ug]
  if (!g || g.status !== 'OPEN' || !g.execution_policy) return null
  if (g.rounds.some((r) => r.recipient === 'chatgpt' && r.response_status === 'PENDING')) return null
  if (state.taskQueue.tasks.some((t) => t.user_goal_id === ug && (t.status === 'READY' || t.status === 'IN_PROGRESS' || t.status === 'REVIEW'))) return null
  if ((g.task_drafts || []).length) return null
  const left = policyBudgetLeft(state, ug)
  if (left !== null && left <= 0) return null
  const appr = approvedDesign(g)
  const acc = appr ? acceptanceCoverage(state, ug) : { missing: [], total: 0 }
  // 직전 needs_info 를 조사해 답을 얻었으면 같은 기준이라도 한 번 더 묻는다(조사 답이 새 근거)
  const researched = Object.keys(g.research_notes || {}).filter((k) => (g.research_notes[k].answers || []).length).sort().at(-1)
  const key = `v${appr?.version ?? 0}#${(acc.missing || []).join(',')}${base ? `@${String(base).slice(0, 12)}` : ''}${researched ? `#r${researched.slice(-3)}` : ''}`
  if (checkKey && (g.auto_design_requests || {})[key]) return null
  const pol = g.execution_policy
  return {
    key,
    issue: {
      issue_key: `next-${key}`,
      problem: `목표 ${ug} 「${g.title}」 의 다음 증분 설계가 필요하다. 승인 설계 v${appr?.version ?? '-'} 의 미충족 기준 [${(acc.missing || []).join(',')}]${(acc.missing || []).length ? '' : '(없음 — 다음 범위로)'} · 사용자 방향: ${(g.next_scope || []).join(' / ') || '없음'}`,
      evidence: [
        ...(appr ? [`설계 v${appr.version}: ${String(appr.summary || '').slice(0, 300)}`] : []),
        ...(acc.missing || []).map((i) => `미충족 [${i}] ${appr?.acceptance?.[i] ?? ''}`),
        `완료 작업: ${state.taskQueue.tasks.filter((t) => t.user_goal_id === ug && t.status === 'COMPLETED').map((t) => `${t.task_id} ${t.title}`).join(' · ') || '없음'}`,
        // 완료 작업의 실행 증거(명령 · 결과 · 건너뜀 수) — Work 가 「테스트 결과가 없다」 고 묻지 않게
        ...state.taskQueue.tasks.filter((t) => t.user_goal_id === ug && t.status === 'COMPLETED').flatMap((t) => (t.evidence || []).slice(-2).map((e) => `증거 ${t.task_id}@${String(t.verified_commit || '').slice(0, 9)}: ${e.type} · ${String(e.command_or_protocol || '').slice(0, 160)} → ${e.result} · skip ${e.skip_count ?? 0}${e.skipped_files?.length ? ` (${e.skipped_files.join(',')})` : ''}`)),
        // 직전 needs_info 에 대한 읽기 전용 코드 조사 답(Codex)
        ...Object.values(g.research_notes || {}).slice(-1).flatMap((n) => (n.answers || []).map((a) => `조사 답: Q ${String(a.q).slice(0, 160)} → ${String(a.a).slice(0, 400)}${a.paths?.length ? ` [${a.paths.join(', ')}]` : ''}`)),
      ],
      conflicts_with: '없음(다음 증분) — 기존 사용자 결정과 승인 설계 계약을 보존한다',
      alternatives: ['사용자 방향(next_scope)의 가장 앞 항목을 정책 코드 영역 안에서 구현 가능한 최소 증분으로', 'DB·정본·인증 변경이 필요하면 그 부분은 별도 승인 항목으로 분리하고 나머지만'],
      question: `다음 구현 증분 하나를 설계하라. 자동 실행 조건(목표 위임 정책): 허용 코드 영역 ${pol.allowed_code_areas.join(', ')} · 위험 상한 ${pol.risk_level} · 제외 ${pol.excluded_operations.join(', ')}. allowed_paths 는 이 영역 안의 실제 파일로만 · db_changes=false. 영역 밖이 꼭 필요하면 그 이유를 open_questions 에 적어라(그 부분은 사용자 승인 대기). 이미 구현된 기능을 다시 만들지 말고(첨부 패킷의 코드 근거), 수용 기준은 실제 테스트로 검증 가능하게.`,
      approval_scope_change: false,
    },
  }
}

/** 이 목표의 마지막 Work 응답이 needs_info 이고 아직 조사하지 않았으면 { request_id, questions } */
export function pendingResearch(state, ug) {
  const g = ugState(state).goals[ug]
  if (!g) return null
  const last = [...g.rounds].reverse().find((r) => r.sender === 'chatgpt' && r.request_id)
  if (!last || (g.research_notes || {})[last.request_id]) return null
  const f = path.join(root(), 'planning', 'archive', `${last.request_id}.response.md`)
  if (!fs.existsSync(f)) return null
  let resp
  try {
    resp = JSON.parse(fs.readFileSync(f, 'utf8').match(/```json vfc-response\s*\n([\s\S]*?)\n```/)[1])
  } catch {
    return null
  }
  if (resp.verdict !== 'needs_info' || !(resp.open_questions || []).length) return null
  return { request_id: last.request_id, questions: resp.open_questions, findings: (resp.findings || []).map((x) => `${x.severity} ${x.claim}`) }
}
