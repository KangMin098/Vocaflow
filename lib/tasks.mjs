// lib/tasks.mjs
//
// 작업(task)·소유권(owner)·목표 상태·결정 기록의 규칙. 모든 변경은 state.withState(fn(state, ctx)) 안에서 일어난다.
//
// 상태 기계
//   READY ──start──▶ IN_PROGRESS ──submit──▶ REVIEW ──complete──▶ COMPLETED
//     ▲                 │  │                    │
//     └──unblock── BLOCKED ◀┘  └──fail──▶ FAILED   └──reject──▶ READY (새 run 에서 다시 검증)
//
// 신원 모델: 이 공간은 로컬 신뢰 모델이다(OS 계정 하나를 여러 에이전트가 공유). 호출자 신원은 --owner/--by 로 **선언**되고
// 규칙은 그 선언을 기준으로 강제한다. 선언을 속이는 행위까지 막지는 못한다 — 그 대신 모든 전이를 events.jsonl 과
// task.history 에 남겨 사후에 드러나게 한다(docs/CONCURRENCY.md 「신뢰 모델」).
//
// 소유권: 작업은 세션 이름이 아니라 고정 owner_id 에 속한다. 세션이 바뀌면 bindSession 으로 현재 세션만 교체.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { normalizeWorktree, root } from './paths.mjs'
import { acquire, release, lockName, pidAlive, listLocks, removeOrphan } from './lock.mjs'
import { checkTaskGoal, loadCriteria, templateTypes } from './goals.mjs'

export const TASK_STATUS = ['READY', 'IN_PROGRESS', 'BLOCKED', 'REVIEW', 'COMPLETED', 'FAILED']
export const GOAL_STATUS = ['PASS', 'FAIL', 'UNKNOWN', 'BLOCKED', 'EXTERNAL_INPUT_REQUIRED']
export const PRIORITIES = ['P0', 'P1', 'P2', 'P3']
export const APPROVAL_KINDS = ['db_write', 'main_merge', 'deploy', 'secret', 'destructive', 'external_publish']
export const EVIDENCE_TYPES = ['unit', 'integration', 'e2e', 'ci', 'deploy', 'smoke', 'manual', 'db_query', 'review', 'log', 'analysis']
const TASK_ID_RE = /^T-\d{4,}$/

export class RuleError extends Error {
  constructor(code, message, detail) {
    super(message)
    this.code = code
    this.detail = detail
  }
}

const now = () => new Date().toISOString()

function findTask(state, id) {
  const ts = state.taskQueue.tasks.filter((t) => t.task_id === id)
  if (!ts.length) throw new RuleError('NO_TASK', `작업 ${id} 가 없다`)
  if (ts.length > 1) throw new RuleError('DUP_TASK', `작업 ${id} 가 ${ts.length}개다 — 상태 파일 손상, 수동 확인 필요`)
  return ts[0]
}

function history(t, from, to, by, note) {
  t.history = t.history || []
  t.history.push({ at: now(), from, to, by, note: note ?? null })
  t.status = to
  t.updated_at = now()
}

/** 공간 루트 기준 상대경로 rel 이 base(예: 'verification') 아래의 **실제 파일**인지. '..' 탈출·디렉터리 거부. */
export function fileUnder(rel, base) {
  const full = path.resolve(root(), rel)
  const baseDir = path.resolve(root(), base) + path.sep
  if (!full.startsWith(baseDir)) return { ok: false, reason: `${rel} 는 ${base}/ 밖이다` }
  try {
    if (!fs.statSync(full).isFile()) return { ok: false, reason: `${rel} 는 파일이 아니다` }
  } catch {
    return { ok: false, reason: `${rel} 가 없다` }
  }
  return { ok: true, full }
}

const ISO_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d+)?)?(Z|[+-]\d{2}:\d{2})$/

function requireOwnerCaller(t, caller) {
  if (!caller) throw new RuleError('NO_CALLER', '--owner(또는 --by) 로 호출자 owner_id 를 밝혀야 한다')
  if (caller !== t.owner_id) throw new RuleError('NOT_OWNER', `${t.task_id} 의 owner 는 ${t.owner_id} 다 (호출자 ${caller})`)
}

// ── 소유권 ────────────────────────────────────────────────────────────────

export function ensureOwner(state, owner_id, spec = {}) {
  if (!/^[a-z][a-z0-9-]{2,40}$/.test(owner_id)) throw new RuleError('BAD_OWNER', `owner_id '${owner_id}' 는 소문자·숫자·- 3~41자여야 한다 (세션 이름을 쓰지 않는다)`)
  const existed = !!state.ownership.owners[owner_id]
  const o = state.ownership.owners[owner_id] || { owner_id, purpose: null, agent_kinds: [], worktrees: [], db_scopes: [], current_session: null, session_history: [], created_at: now() }
  if (spec.purpose) o.purpose = spec.purpose
  if (spec.agent_kinds) o.agent_kinds = spec.agent_kinds
  if (spec.db_scopes) {
    if (existed && JSON.stringify([...o.db_scopes].sort()) !== JSON.stringify([...spec.db_scopes].sort()) && !spec.db_change_decision) {
      throw new RuleError('DB_SCOPE_CHANGE', `기존 owner ${owner_id} 의 DB 쓰기 범위 변경은 사용자 승인 결정(--decision <APPROVED 결정 id>)이 필요하다`)
    }
    if (spec.db_change_decision) {
      const d = state.decisionLog.entries.find((e) => e.decision_id === spec.db_change_decision)
      if (!d || d.status !== 'APPROVED') throw new RuleError('DB_SCOPE_CHANGE', `결정 ${spec.db_change_decision} 가 APPROVED 가 아니다`)
    }
    for (const target of spec.db_scopes) {
      const other = Object.values(state.ownership.owners).find((x) => x.owner_id !== owner_id && (x.db_scopes || []).includes(target))
      if (other) throw new RuleError('DB_SCOPE_TAKEN', `DB ${target} 쓰기 소유자는 이미 ${other.owner_id} 다 — DB 대상별 소유자는 하나`)
    }
    const removed = (o.db_scopes || []).filter((x) => !spec.db_scopes.includes(x))
    const busy = state.taskQueue.tasks.find((t) => t.owner_id === owner_id && t.status === 'IN_PROGRESS' && t.db_scope.mode === 'write' && t.db_scope.targets.some((x) => removed.includes(x)))
    if (busy) throw new RuleError('DB_SCOPE_BUSY', `${busy.task_id} 가 그 DB 를 쓰는 중이다`)
    o.db_scopes = spec.db_scopes
  }
  state.ownership.owners[owner_id] = o
  return o
}

export function bindWorktree(state, owner_id, worktree, branch) {
  const o = state.ownership.owners[owner_id]
  if (!o) throw new RuleError('NO_OWNER', `owner ${owner_id} 가 없다`)
  const key = normalizeWorktree(worktree)
  for (const [oid, other] of Object.entries(state.ownership.owners)) {
    if (oid !== owner_id && other.worktrees.some((w) => w.path === key)) throw new RuleError('WORKTREE_OWNED', `${key} 는 이미 ${oid} 의 worktree 다 — 이전은 사용자 확인 후 unbind 부터`)
  }
  const existing = o.worktrees.find((w) => w.path === key)
  if (existing) existing.branch = branch ?? existing.branch
  else o.worktrees.push({ path: key, branch: branch ?? null, bound_at: now() })
  return o
}

export function unbindWorktree(state, owner_id, worktree) {
  const o = state.ownership.owners[owner_id]
  if (!o) throw new RuleError('NO_OWNER', `owner ${owner_id} 가 없다`)
  const key = normalizeWorktree(worktree)
  const active = state.taskQueue.tasks.find((t) => t.owner_id === owner_id && t.worktree === key && t.status === 'IN_PROGRESS')
  if (active) throw new RuleError('WORKTREE_BUSY', `${active.task_id} 가 이 worktree 에서 진행 중이다`)
  o.worktrees = o.worktrees.filter((w) => w.path !== key)
  return o
}

/** 세션이 바뀌어도 소유는 owner_id 에 남는다 — 현재 세션만 교체하고 이전 세션은 기록으로 보존. */
export function bindSession(state, owner_id, session) {
  const o = state.ownership.owners[owner_id]
  if (!o) throw new RuleError('NO_OWNER', `owner ${owner_id} 가 없다`)
  if (!session?.label || !session?.agent) throw new RuleError('BAD_SESSION', 'session 에는 label 과 agent(claude|codex|chatgpt|human) 가 필요하다')
  if (o.current_session) o.session_history.push({ ...o.current_session, unbound_at: now() })
  o.current_session = { label: session.label, agent: session.agent, pid: session.pid ?? null, bound_at: now() }
  return o
}

// ── 작업 등록 ──────────────────────────────────────────────────────────────

const REQUIRED = ['goal_id', 'title', 'description', 'priority', 'owner_id', 'allowed_paths', 'forbidden_paths', 'acceptance']

function nextTaskId(state) {
  const used = new Set(state.taskQueue.tasks.map((t) => t.task_id))
  let n = state.taskQueue.next_seq
  while (used.has(`T-${String(n).padStart(4, '0')}`)) n++
  state.taskQueue.next_seq = n + 1
  return `T-${String(n).padStart(4, '0')}`
}

export function addTask(state, spec, { goalsDoc = loadCriteria() } = {}) {
  for (const k of REQUIRED) if (spec[k] === undefined || spec[k] === null || spec[k] === '') throw new RuleError('MISSING_FIELD', `필수 필드 누락: ${k}`)
  const g = checkTaskGoal(goalsDoc, spec.goal_id)
  if (!g.ok) throw new RuleError('BAD_GOAL', g.reason)
  for (const rid of spec.related_goal_ids || []) if (!goalsDoc.criteria.some((c) => c.id === rid)) throw new RuleError('BAD_GOAL', `related goal ${rid} 는 정본에 없다`)
  if (spec.template && !templateTypes(goalsDoc).includes(spec.template)) throw new RuleError('BAD_TEMPLATE', `template ${spec.template} 는 정본 L4 템플릿이 아니다`)
  if (!PRIORITIES.includes(spec.priority)) throw new RuleError('BAD_PRIORITY', `priority 는 ${PRIORITIES.join('|')}`)
  if (!state.ownership.owners[spec.owner_id]) throw new RuleError('NO_OWNER', `owner ${spec.owner_id} 가 등록되지 않았다`)
  if (!Array.isArray(spec.allowed_paths) || !spec.allowed_paths.length) throw new RuleError('MISSING_FIELD', 'allowed_paths 는 비지 않은 배열')
  if (!Array.isArray(spec.forbidden_paths)) throw new RuleError('MISSING_FIELD', 'forbidden_paths 는 배열')
  if (!Array.isArray(spec.acceptance) || !spec.acceptance.length || !spec.acceptance.every((a) => typeof a === 'string' && a.trim())) throw new RuleError('MISSING_FIELD', 'acceptance(완료 조건) 는 비지 않은 문자열 배열')
  const db = spec.db_scope ?? { mode: 'none', targets: [] }
  if (!['none', 'read', 'write'].includes(db.mode)) throw new RuleError('BAD_DB_SCOPE', 'db_scope.mode 는 none|read|write')
  if (db.mode !== 'none' && !(db.targets || []).length) throw new RuleError('BAD_DB_SCOPE', 'db_scope.targets 가 필요하다(예: dev:<project-ref>)')
  const approvalKinds = new Set(spec.approval_kinds || [])
  if (db.mode === 'write') approvalKinds.add('db_write')
  for (const k of approvalKinds) if (!APPROVAL_KINDS.includes(k)) throw new RuleError('BAD_APPROVAL_KIND', `approval kind ${k} 를 모른다 (${APPROVAL_KINDS.join('|')})`)
  if (spec.approval_required === true && approvalKinds.size === 0) throw new RuleError('MISSING_FIELD', 'approval_required=true 면 approval_kinds 를 하나 이상 적어야 한다')
  if (spec.approval_required === false && approvalKinds.size > 0) throw new RuleError('BAD_APPROVAL_KIND', `approval_required=false 인데 승인 항목이 있다(${[...approvalKinds]}) — DB 쓰기 등은 승인을 끌 수 없다`)
  let id
  if (spec.task_id) {
    if (!TASK_ID_RE.test(spec.task_id)) throw new RuleError('BAD_TASK_ID', `task_id 형식은 T-0000`)
    if (state.taskQueue.tasks.some((t) => t.task_id === spec.task_id)) throw new RuleError('DUP_TASK', `작업 ${spec.task_id} 가 이미 있다`)
    id = spec.task_id
    state.taskQueue.next_seq = Math.max(state.taskQueue.next_seq, Number(id.slice(2)) + 1)
  } else id = nextTaskId(state)
  for (const d of spec.depends_on || []) if (!state.taskQueue.tasks.some((x) => x.task_id === d)) throw new RuleError('BAD_DEPENDENCY', `depends_on ${d} 가 없다`)
  const t = {
    task_id: id,
    goal_id: spec.goal_id,
    related_goal_ids: spec.related_goal_ids || [],
    template: spec.template || null,
    title: spec.title,
    description: spec.description,
    priority: spec.priority,
    status: 'READY',
    owner_id: spec.owner_id,
    branch: spec.branch || null,
    worktree: spec.worktree ? normalizeWorktree(spec.worktree) : null,
    allowed_paths: spec.allowed_paths,
    forbidden_paths: spec.forbidden_paths,
    db_scope: { mode: db.mode, targets: db.targets || [] },
    approval_required: approvalKinds.size > 0,
    approval_kinds: [...approvalKinds],
    approval: null,
    acceptance: spec.acceptance,
    evidence: [],
    run_seq: 0,
    depends_on: spec.depends_on || [],
    source: spec.source || null,
    created_at: now(),
    updated_at: now(),
    history: [{ at: now(), from: null, to: 'READY', by: spec.created_by || 'unknown', note: 'created' }],
    run: null,
  }
  state.taskQueue.tasks.push(t)
  return t
}

/** 작업 위치 지정(READY·BLOCKED 에서만). worktree 는 owner 에 묶인 것만. */
export function assignWorktree(state, task_id, { caller, worktree, branch }) {
  const t = findTask(state, task_id)
  requireOwnerCaller(t, caller)
  if (!['READY', 'BLOCKED'].includes(t.status)) throw new RuleError('BAD_TRANSITION', `${t.status} 에서는 위치를 바꿀 수 없다`)
  const key = normalizeWorktree(worktree)
  if (!state.ownership.owners[t.owner_id].worktrees.some((w) => w.path === key)) throw new RuleError('WORKTREE_NOT_OWNED', `${key} 는 ${t.owner_id} 에 묶인 worktree 가 아니다`)
  t.worktree = key
  t.branch = branch || t.branch
  t.updated_at = now()
  return t
}

/** 사용자 승인 기록. by 는 'user' 여야 하고 근거(reference)가 있어야 한다. 에이전트가 스스로 승인하지 않는다. */
export function recordApproval(state, task_id, { by, reference, kinds, sql_sha256 }) {
  const t = findTask(state, task_id)
  if (by !== 'user') throw new RuleError('APPROVAL_NOT_USER', '승인은 사용자만 기록할 수 있다 (by=user)')
  if (!reference) throw new RuleError('APPROVAL_NO_REF', '승인 근거(대화 일시·메시지 요지 등)가 필요하다')
  const need = new Set(t.approval_kinds)
  for (const k of kinds || t.approval_kinds) need.delete(k)
  if (need.size) throw new RuleError('APPROVAL_INCOMPLETE', `승인되지 않은 항목: ${[...need].join(',')}`)
  if (t.approval_kinds.includes('db_write') && !/^[a-f0-9]{64}$/.test(sql_sha256 || '')) throw new RuleError('APPROVAL_NO_SQL_HASH', 'DB 쓰기 승인에는 사용자가 본 SQL 의 sha256 이 필요하다')
  t.approval = { by, reference, kinds: kinds || t.approval_kinds, sql_sha256: sql_sha256 || null, at: now() }
  t.updated_at = now()
  return t
}

// ── 제품 저장소 .agent-lock 연동 ──────────────────────────────────────────
//
// 제품 worktree 의 `.agent-lock`(agents/scripts/lock.mjs 형식 {agent,pid,host,branch,started_at})을 **함께 잡는다**.
// 그래야 vfc 를 모르는 기존 도구(lock.mjs acquire)도 이 worktree 가 쓰이는 중임을 안다.
//   없음            → 'wx' 로 만들고 vfc_token 을 넣는다(반납 시 우리가 만든 것만 지운다)
//   있음·같은 pid   → 에이전트가 이미 쥐고 있다 — 그대로 둔다(반납도 하지 않는다)
//   있음·다른 pid   → 살아 있든 죽었든 거부(죽은 잠금 정리는 제품 도구의 책임 — 그 TTL·조상 판별 규칙을 따른다)
//   읽을 수 없음    → 거부(불완전한 잠금을 없는 것으로 보지 않는다)

export function claimProductLock(worktree, { pid, agent, branch }) {
  const f = path.join(worktree, '.agent-lock')
  let fd
  try {
    fd = fs.openSync(f, 'wx')
  } catch (e) {
    if (e.code !== 'EEXIST') throw e
    let m
    try {
      m = JSON.parse(fs.readFileSync(f, 'utf8'))
    } catch {
      throw new RuleError('PRODUCT_LOCK_UNREADABLE', `${f} 를 읽을 수 없다 — 불완전한 잠금으로 보고 거부한다(제품 lock.mjs status 로 확인)`)
    }
    if (m.pid === pid && m.host === os.hostname()) return { created: false, holder: m }
    throw new RuleError('PRODUCT_LOCK_HELD', `제품 worktree 잠금(.agent-lock)을 ${m.agent} pid ${m.pid}${pidAlive(m.pid) ? '' : '(죽음 — 제품 lock.mjs 로 정리)'} 가 쥐고 있다`, m)
  }
  const token = crypto.randomBytes(8).toString('hex')
  try {
    fs.writeSync(fd, JSON.stringify({ agent, pid, host: os.hostname(), branch: branch ?? null, started_at: now(), vfc_token: token }, null, 2))
  } finally {
    fs.closeSync(fd)
  }
  return { created: true, token }
}

export function releaseProductLock(worktree, token) {
  if (!worktree || !token) return { ok: false, reason: 'not created by vfc' }
  const f = path.join(worktree, '.agent-lock')
  try {
    const m = JSON.parse(fs.readFileSync(f, 'utf8'))
    if (m.vfc_token !== token) return { ok: false, reason: '다른 소유자의 .agent-lock — 건드리지 않음' }
    fs.rmSync(f, { force: true })
    return { ok: true }
  } catch {
    return { ok: false, reason: 'absent or unreadable' }
  }
}

// ── 실행 ──────────────────────────────────────────────────────────────────

function gitBranch(worktree) {
  try {
    return execFileSync('git', ['-C', worktree, 'branch', '--show-current'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim()
  } catch {
    return null
  }
}

/**
 * 고아 잠금 정리 — 상태 뮤텍스 안에서만. task/worktree/db 잠금 중 어떤 IN_PROGRESS 작업의 run 에도 없는 token 은
 * 커밋되지 못한 시작(또는 커밋 후 반납 전 죽음)이 남긴 것이다. 작업 잠금은 언제나 뮤텍스 안에서 잡고 같은 뮤텍스 안에서
 * 기록되므로, 이 판정은 진행 중인 다른 시작과 경쟁하지 않는다.
 */
export function reconcileLocks(state) {
  const live = new Set(state.taskQueue.tasks.filter((t) => t.status === 'IN_PROGRESS').flatMap((t) => (t.run?.locks || []).map((l) => l.token)))
  const removed = []
  for (const l of listLocks()) {
    if (!/^(task|worktree|db)--/.test(l.name) || !l.meta?.token) continue
    if (live.has(l.meta.token)) continue
    const r = removeOrphan(l.name, l.meta.token, 'no IN_PROGRESS task references this token')
    if (r.ok) removed.push(l.name)
  }
  // 제품 worktree 의 .agent-lock: vfc 가 만든 것(vfc_token) 중 진행 중 run 이 참조하지 않는 것은 커밋 후 반납 전에 죽은 흔적이다.
  // vfc 의 .agent-lock 생성과 run 기록은 같은 상태 뮤텍스·같은 커밋 안이므로 이 판정은 진행 중인 시작과 경쟁하지 않는다.
  const liveProduct = new Set(state.taskQueue.tasks.filter((t) => t.status === 'IN_PROGRESS').map((t) => t.run?.product_lock_token).filter(Boolean))
  const worktrees = new Set(Object.values(state.ownership.owners).flatMap((o) => o.worktrees.map((w) => w.path)))
  for (const wt of worktrees) {
    const f = path.join(wt, '.agent-lock')
    let m
    try {
      m = JSON.parse(fs.readFileSync(f, 'utf8'))
    } catch {
      continue // 없음 또는 읽을 수 없음 — vfc 것이 아니면 건드리지 않는다
    }
    if (!m.vfc_token || liveProduct.has(m.vfc_token)) continue
    const r = releaseProductLock(wt, m.vfc_token)
    if (r.ok) removed.push(`product:${wt}`)
  }
  return removed
}

export function startTask(state, task_id, { owner_id, session, pid, checkWorktree = true }, ctx) {
  const t = findTask(state, task_id)
  requireOwnerCaller(t, owner_id)
  if (t.status === 'IN_PROGRESS') throw new RuleError('ALREADY_RUNNING', `${task_id} 는 이미 실행 중이다 (session ${t.run?.session})`)
  if (t.status !== 'READY') throw new RuleError('BAD_TRANSITION', `${task_id} 상태 ${t.status} 에서는 시작할 수 없다`)
  for (const d of t.depends_on) {
    const dep = state.taskQueue.tasks.find((x) => x.task_id === d)
    if (dep?.status !== 'COMPLETED') throw new RuleError('DEPENDENCY_OPEN', `선행 작업 ${d} 가 COMPLETED 가 아니다 (${dep?.status})`)
  }
  if (t.approval_required && !t.approval) throw new RuleError('APPROVAL_REQUIRED', `${task_id} 는 사용자 승인이 필요하다: ${t.approval_kinds.join(',')}`)
  if (!t.worktree) throw new RuleError('WORKTREE_REQUIRED', `${task_id} 에 worktree 가 없다 — 모든 작업은 실행 위치가 있어야 worktree 잠금을 잡을 수 있다(vfc task assign-worktree)`)
  const owner = state.ownership.owners[owner_id]
  const key = normalizeWorktree(t.worktree)
  if (!owner.worktrees.some((w) => w.path === key)) throw new RuleError('WORKTREE_NOT_OWNED', `${key} 는 ${owner_id} 에 묶인 worktree 가 아니다`)
  if (checkWorktree) {
    if (!fs.existsSync(key)) throw new RuleError('WORKTREE_MISSING', `${key} 가 없다`)
    const br = gitBranch(key)
    if (t.branch && br !== t.branch) throw new RuleError('BRANCH_MISMATCH', `${key} 의 현재 브랜치 ${br} ≠ 작업 브랜치 ${t.branch}`)
  }
  if (t.db_scope.mode === 'write') {
    for (const target of t.db_scope.targets) if (!(owner.db_scopes || []).includes(target)) throw new RuleError('DB_SCOPE_NOT_OWNED', `${owner_id} 는 DB ${target} 쓰기 소유자가 아니다 (OWNERSHIP_REGISTRY.db_scopes)`)
  }
  reconcileLocks(state)
  // 잠금을 정해진 순서로 잡는다(교착 방지): task → worktree → db → 제품 .agent-lock
  const wanted = [lockName('task', t.task_id), lockName('worktree', key)]
  if (t.db_scope.mode === 'write') for (const target of [...t.db_scope.targets].sort()) wanted.push(lockName('db', target))
  const held = []
  ctx?.onAbort(() => held.forEach((h) => release(h.name, h.token)))
  for (const name of wanted) {
    const r = acquire(name, { owner_id, session: session?.label ?? null, purpose: `${t.task_id} ${t.title}`, pid })
    if (!r.ok) throw new RuleError('LOCK_HELD', `잠금 ${name} 획득 실패 — ${r.judgement.state}: ${r.judgement.reason}`, r.holder)
    held.push({ name, token: r.token })
  }
  let product = { created: false }
  if (checkWorktree) {
    product = claimProductLock(key, { pid, agent: session?.agent ?? 'unknown', branch: t.branch })
    if (product.created) ctx?.onAbort(() => releaseProductLock(key, product.token))
  }
  t.run_seq = (t.run_seq || 0) + 1
  t.run = { run_seq: t.run_seq, session: session?.label ?? null, agent: session?.agent ?? null, pid: pid ?? null, host: os.hostname(), started_at: now(), locks: held, product_lock_token: product.created ? product.token : null }
  history(t, 'READY', 'IN_PROGRESS', owner_id, session?.label)
  return t
}

/** 실행 잠금 반납은 상태가 커밋된 **뒤** 실행한다(커밋 전 반납 → 저장 실패 시 잠금 없는 IN_PROGRESS 가 남는다). */
function releaseRunAfterCommit(t, ctx) {
  const locks = t.run?.locks || []
  const wt = t.worktree
  const productToken = t.run?.product_lock_token
  if (t.run) t.run = { ...t.run, ended_at: now(), locks: [], product_lock_token: null }
  ctx?.afterCommit(() => {
    for (const l of locks) release(l.name, l.token)
    if (productToken) releaseProductLock(wt, productToken)
  })
  return locks.map((l) => l.name)
}

function validateEvidence(ev, t) {
  for (const k of ['type', 'command_or_protocol', 'result', 'artifact_path_or_url', 'observed_at']) if (!ev[k] || typeof ev[k] !== 'string') throw new RuleError('BAD_EVIDENCE', `증거 필드 누락/형식 오류: ${k}`)
  if (!EVIDENCE_TYPES.includes(ev.type)) throw new RuleError('BAD_EVIDENCE', `type 은 ${EVIDENCE_TYPES.join('|')}`)
  if (!['pass', 'fail', 'skip', 'not_run', 'unknown'].includes(ev.result)) throw new RuleError('BAD_EVIDENCE', 'result 는 pass|fail|skip|not_run|unknown')
  if (!Number.isInteger(ev.skip_count) || ev.skip_count < 0) throw new RuleError('BAD_EVIDENCE', 'skip_count(0 이상 정수)가 필요하다 — CI green + skip 은 통과가 아니다')
  const at = Date.parse(ev.observed_at)
  if (!ISO_RE.test(ev.observed_at) || Number.isNaN(at)) throw new RuleError('BAD_EVIDENCE', 'observed_at 은 시간대가 있는 ISO 8601 시각(예: 2026-10-09T10:00:00+09:00)')
  if (at > Date.now() + 5 * 60_000) throw new RuleError('BAD_EVIDENCE', 'observed_at 이 미래다')
  if (!Array.isArray(ev.covers) || !ev.covers.length || !ev.covers.every((i) => Number.isInteger(i) && i >= 0 && i < t.acceptance.length)) {
    throw new RuleError('BAD_EVIDENCE', `covers 는 이 증거가 확인하는 acceptance 번호 배열(0~${t.acceptance.length - 1})`)
  }
  if (!/^https?:\/\//.test(ev.artifact_path_or_url)) {
    const cands = [ev.artifact_path_or_url, path.join(root(), ev.artifact_path_or_url), t.worktree ? path.join(t.worktree, ev.artifact_path_or_url) : null].filter(Boolean)
    const isFile = (c) => {
      try {
        return fs.statSync(c).isFile()
      } catch {
        return false
      }
    }
    if (!cands.some(isFile)) throw new RuleError('BAD_EVIDENCE', `artifact ${ev.artifact_path_or_url} 가 없다(공간 루트·작업 worktree·절대경로 기준) — 없는 보고서로 완료할 수 없다`)
  }
}

export function addEvidence(state, task_id, ev, { caller }) {
  const t = findTask(state, task_id)
  if (!['IN_PROGRESS', 'REVIEW'].includes(t.status)) throw new RuleError('BAD_TRANSITION', `${t.status} 에서는 증거를 붙일 수 없다`)
  if (t.status === 'IN_PROGRESS') requireOwnerCaller(t, caller)
  else if (!state.ownership.owners[caller] || caller === t.owner_id) throw new RuleError('NOT_REVIEWER', 'REVIEW 단계 증거는 등록된 다른 owner(리뷰어)만 붙인다')
  validateEvidence(ev, t)
  const rec = { evidence_id: `${task_id}-R${t.run_seq}-E${String(t.evidence.length + 1).padStart(2, '0')}`, run_seq: t.run_seq, recorded_by: caller, ...ev, recorded_at: now() }
  t.evidence.push(rec)
  t.updated_at = now()
  return rec
}

export function submitForReview(state, task_id, { caller }, ctx) {
  const t = findTask(state, task_id)
  requireOwnerCaller(t, caller)
  if (t.status !== 'IN_PROGRESS') throw new RuleError('BAD_TRANSITION', `${t.status} → REVIEW 불가`)
  if (!t.evidence.some((e) => e.run_seq === t.run_seq)) throw new RuleError('NO_EVIDENCE', '이번 실행(run)의 검증 증거 없이 REVIEW 로 넘길 수 없다')
  const released = releaseRunAfterCommit(t, ctx)
  history(t, 'IN_PROGRESS', 'REVIEW', caller)
  return { task: t, released }
}

/** 완료 판정: 등록된 독립 리뷰어 · 리뷰 기록 파일 · 이번 run 의 증거가 모든 acceptance 를 pass·skip0 으로 덮고 실패·스킵이 없을 것. */
export function completeTask(state, task_id, { caller, review_path }) {
  const t = findTask(state, task_id)
  if (t.status !== 'REVIEW') throw new RuleError('BAD_TRANSITION', `${t.status} → COMPLETED 불가 (REVIEW 를 거쳐야 한다)`)
  if (!caller || !state.ownership.owners[caller]) throw new RuleError('NO_REVIEWER', `리뷰어 ${caller} 는 등록된 owner 가 아니다`)
  if (caller === t.owner_id) throw new RuleError('SELF_REVIEW', '작업 owner 가 자기 작업을 완료 판정할 수 없다')
  requireReviewRecord(review_path)
  const current = t.evidence.filter((e) => e.run_seq === t.run_seq)
  const bad = current.filter((e) => e.result !== 'pass' || e.skip_count !== 0)
  if (bad.length) throw new RuleError('NON_PASSING_EVIDENCE', `이번 run 에 통과가 아닌 증거가 있다: ${bad.map((e) => `${e.evidence_id}=${e.result}/skip${e.skip_count}`).join(', ')} — 재실행(reject) 하거나 FAILED`)
  const covered = new Set(current.flatMap((e) => e.covers))
  const missing = t.acceptance.map((_, i) => i).filter((i) => !covered.has(i))
  if (missing.length) throw new RuleError('ACCEPTANCE_UNCOVERED', `증거가 덮지 않은 완료 조건: ${missing.map((i) => `[${i}] ${t.acceptance[i]}`).join(' / ')}`)
  t.reviewed_by = caller
  t.review_record = review_path
  history(t, 'REVIEW', 'COMPLETED', caller, `review=${review_path}`)
  return t
}

function requireReviewRecord(review_path) {
  if (!review_path) throw new RuleError('NO_REVIEW_RECORD', '리뷰 기록 파일(--review verification/reviews/…)이 필요하다')
  const r = fileUnder(review_path, 'verification/reviews')
  if (!r.ok) throw new RuleError('NO_REVIEW_RECORD', `리뷰 기록: ${r.reason}`)
}

export function rejectReview(state, task_id, { caller, reason, review_path }) {
  const t = findTask(state, task_id)
  if (t.status !== 'REVIEW') throw new RuleError('BAD_TRANSITION', `${t.status} 에서 반려 불가`)
  if (!state.ownership.owners[caller] || caller === t.owner_id) throw new RuleError('NOT_REVIEWER', '반려는 등록된 다른 owner(리뷰어)만')
  if (!reason) throw new RuleError('NO_REASON', '반려 사유가 필요하다')
  requireReviewRecord(review_path)
  t.review_record = review_path
  history(t, 'REVIEW', 'READY', caller, `rejected: ${reason} (review=${review_path})`)
  return t
}

export function blockTask(state, task_id, { caller, reason, external = false }, ctx) {
  const t = findTask(state, task_id)
  requireOwnerCaller(t, caller)
  if (!['READY', 'IN_PROGRESS', 'REVIEW'].includes(t.status)) throw new RuleError('BAD_TRANSITION', `${t.status} → BLOCKED 불가`)
  if (!reason) throw new RuleError('NO_REASON', 'BLOCKED 사유가 필요하다')
  const released = releaseRunAfterCommit(t, ctx)
  t.blocker = { reason, external, at: now() }
  history(t, t.status, 'BLOCKED', caller, reason)
  return { task: t, released }
}

export function unblockTask(state, task_id, { caller, note }) {
  const t = findTask(state, task_id)
  requireOwnerCaller(t, caller)
  if (t.status !== 'BLOCKED') throw new RuleError('BAD_TRANSITION', `${t.status} 는 BLOCKED 가 아니다`)
  t.blocker = null
  history(t, 'BLOCKED', 'READY', caller, note)
  return t
}

export function failTask(state, task_id, { caller, reason }, ctx) {
  const t = findTask(state, task_id)
  requireOwnerCaller(t, caller)
  if (!['IN_PROGRESS', 'REVIEW'].includes(t.status)) throw new RuleError('BAD_TRANSITION', `${t.status} → FAILED 불가`)
  if (!reason) throw new RuleError('NO_REASON', 'FAILED 사유가 필요하다')
  const released = releaseRunAfterCommit(t, ctx)
  history(t, t.status, 'FAILED', caller, reason)
  return { task: t, released }
}

/** 비정상 종료 복구: IN_PROGRESS 인데 실행 pid 가 죽은 작업 → BLOCKED · 잠금 정리. 이어서 고아 잠금 정리. */
export function reapAbandoned(state, { by = 'reaper' } = {}, ctx) {
  const reaped = []
  for (const t of state.taskQueue.tasks) {
    if (t.status !== 'IN_PROGRESS' || !t.run?.pid) continue
    if (t.run.host && t.run.host !== os.hostname()) continue
    if (pidAlive(t.run.pid)) continue
    const deadPid = t.run.pid
    const released = releaseRunAfterCommit(t, ctx)
    t.blocker = { reason: `실행 프로세스 pid ${deadPid} 가 죽었다 — 작업 내용 확인 후 unblock`, external: false, at: now() }
    history(t, 'IN_PROGRESS', 'BLOCKED', by, 'abandoned run reaped')
    reaped.push({ task_id: t.task_id, released })
  }
  ctx?.afterCommit(() => reconcileLocks(state))
  return reaped
}

// ── 목표 상태 ─────────────────────────────────────────────────────────────

/**
 * PASS·FAIL 은 이 공간의 verification/ 아래 **실제로 있는** 증거 파일이 있어야 한다(보고서·외부 문서 인용만으로는 안 된다).
 * 근거가 없으면 UNKNOWN 이다.
 */
export function setGoalStatus(state, id, { status, evidence_paths = [], note, by, kind = 'goal' }) {
  if (!GOAL_STATUS.includes(status)) throw new RuleError('BAD_GOAL_STATUS', `status 는 ${GOAL_STATUS.join('|')}`)
  if (state.goalStatus.templates?.[id]) throw new RuleError('TEMPLATE_HAS_NO_STATUS', `${id} 는 L4 작업 템플릿이다 — PASS/FAIL 이 아니라 not_instantiated/instantiated 이고, 작업이 생기면 자동으로 바뀐다`)
  const bucket = kind === 'gate' ? state.goalStatus.release_gates : state.goalStatus.goals
  const g = bucket[id]
  if (!g) throw new RuleError('BAD_GOAL', `${kind} ${id} 는 GOAL_STATUS 에 없다`)
  if (['PASS', 'FAIL'].includes(status)) {
    if (!evidence_paths.length) throw new RuleError('NO_EVIDENCE', `${status} 에는 증거 경로가 필요하다 — 근거가 없으면 UNKNOWN`)
    for (const e of evidence_paths) {
      const r = fileUnder(e, 'verification')
      if (!r.ok) throw new RuleError(/밖이다/.test(r.reason) ? 'REPORTED_ONLY' : 'NO_EVIDENCE', `${r.reason} — verification/ 아래 실제 증거 파일만 ${status} 근거가 된다(보고서 인용 불가)`)
    }
  }
  if (!note && status !== 'UNKNOWN') throw new RuleError('NO_REASON', '상태 변경 사유(--note)가 필요하다')
  g.history = g.history || []
  g.history.push({ at: now(), from: g.status, to: status, by, note: note ?? null, evidence_paths })
  g.status = status
  g.evidence_paths = evidence_paths
  g.reported_only = !['PASS', 'FAIL'].includes(status)
  g.updated_at = now()
  return g
}

// ── 결정 기록 (append-only) ───────────────────────────────────────────────

export const DECISION_STATUS = ['APPROVED', 'RECORDED', 'PROPOSED', 'OPEN_QUESTION', 'REJECTED', 'SUPERSEDED']

export function logDecision(state, entry) {
  if (!DECISION_STATUS.includes(entry.status)) throw new RuleError('BAD_DECISION', `status 는 ${DECISION_STATUS.join('|')}`)
  if (entry.status === 'APPROVED' && (entry.approved_by !== 'user' || !(entry.source || entry.reference))) throw new RuleError('APPROVAL_NOT_USER', 'APPROVED 결정은 approved_by=user 와 근거(source/reference)가 있어야 한다')
  const used = new Set(state.decisionLog.entries.map((e) => e.decision_id))
  let id = entry.decision_id
  if (id) {
    if (used.has(id)) throw new RuleError('DUP_DECISION', `결정 ${id} 가 이미 있다`)
    const m = id.match(/^DL-(\d+)$/)
    if (m) state.decisionLog.next_seq = Math.max(state.decisionLog.next_seq, Number(m[1]) + 1)
  } else {
    let n = state.decisionLog.next_seq
    while (used.has(`DL-${String(n).padStart(4, '0')}`)) n++
    id = `DL-${String(n).padStart(4, '0')}`
    state.decisionLog.next_seq = n + 1
  }
  const rec = { ...entry, decision_id: id, recorded_at: now() }
  state.decisionLog.entries.push(rec)
  return rec
}
