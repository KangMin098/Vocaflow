// lib/init.mjs
//
// 상태 초기화(멱등). 정본의 목표·게이트를 GOAL_STATUS 에 등록하고 seed 의 owner·결정·작업을 넣는다.

import { loadCriteria, validateCanon } from './goals.mjs'
import * as T from './tasks.mjs'
import { normalizeWorktree } from './paths.mjs'

/** 멱등 초기화: 정본의 목표·게이트를 GOAL_STATUS 에 등록하고 seed 의 owner·결정·작업을 넣는다. 이미 있는 항목은 유지. */
export function initState(s, seed) {
  const doc = loadCriteria()
  const r = validateCanon()
  s.goalStatus.canon_version = r.facts.canon_version
  const added = { goals: 0, gates: 0, owners: 0, decisions: 0, tasks: 0 }
  // L4 템플릿은 「목표 상태」가 아니라 작업 유형 정의다 — PASS/FAIL 을 갖지 않고 not_instantiated / instantiated 만 갖는다
  s.goalStatus.templates = s.goalStatus.templates || {}
  for (const c of doc.criteria.filter((c) => c.observed_status === 'template')) {
    if (!s.goalStatus.templates[c.id]) s.goalStatus.templates[c.id] = { id: c.id, title: c.title, status: 'not_instantiated', instances: [] }
  }
  for (const c of doc.criteria) {
    if (c.observed_status === 'template') continue
    if (s.goalStatus.goals[c.id]) continue
    const pre = seed.goal_status?.[c.id]
    s.goalStatus.goals[c.id] = {
      id: c.id,
      level: c.level,
      phase: c.phase,
      blocking_for_R0: c.blocking_for_R0,
      status: pre?.status ?? 'UNKNOWN',
      acceptance: c.acceptance,
      evidence_paths: pre?.evidence_paths ?? [],
      evidence_hooks: pre?.evidence_hooks ?? [],
      reported_only: pre?.reported_only ?? true,
      note: pre?.note ?? '정본 인수 시점 — 직접 검증된 근거 없음(UNKNOWN 은 통과가 아니다)',
      history: [{ at: new Date().toISOString(), from: null, to: pre?.status ?? 'UNKNOWN', by: 'init', note: 'canon import' }],
    }
    added.goals++
  }
  for (const g of doc.release_gates) {
    if (s.goalStatus.release_gates[g.id]) continue
    const pre = seed.gate_status?.[g.id]
    s.goalStatus.release_gates[g.id] = { id: g.id, condition: g.condition, required_evidence: g.required_evidence, status: pre?.status ?? 'UNKNOWN', evidence_paths: pre?.evidence_paths ?? [], reported_only: pre?.reported_only ?? true, note: pre?.note ?? null, history: [{ at: new Date().toISOString(), from: null, to: pre?.status ?? 'UNKNOWN', by: 'init' }] }
    added.gates++
  }
  for (const o of seed.owners) {
    const existed = !!s.ownership.owners[o.owner_id]
    T.ensureOwner(s, o.owner_id, o)
    if (!existed) {
      added.owners++
      for (const w of o.worktrees || []) T.bindWorktree(s, o.owner_id, w.path, w.branch)
      if (o.session_aliases) s.ownership.owners[o.owner_id].session_aliases = o.session_aliases
    }
  }
  for (const d of seed.decisions) {
    if (s.decisionLog.entries.some((e) => e.decision_id === d.decision_id)) continue
    T.logDecision(s, d)
    added.decisions++
  }
  for (const t of seed.tasks) {
    if (s.taskQueue.tasks.some((x) => x.task_id === t.task_id)) continue
    T.addTask(s, { ...t, created_by: 'init' })
    added.tasks++
  }
  // 스키마 보강(멱등): WF-S5 이전 작업에 빠진 필드만 채운다. 기본 claim 은 partial — PASS 근거가 되지 않는다.
  added.upgraded = 0
  // 경로 재정규화 — WF-S3 초기 바인딩은 대소문자를 보존했다(현재 규칙: Windows 전체 소문자 · 실경로)
  for (const o of Object.values(s.ownership.owners)) {
    for (const w of o.worktrees) {
      const n = normalizeWorktree(w.path)
      if (n !== w.path) {
        w.path = n
        added.upgraded++
      }
    }
  }
  for (const t of s.taskQueue.tasks) {
    if (t.worktree && normalizeWorktree(t.worktree) !== t.worktree) {
      t.worktree = normalizeWorktree(t.worktree)
      added.upgraded++
    }
  }
  for (const t of s.taskQueue.tasks) {
    let touched = false
    if (!t.criterion_claims) {
      const g = doc.criteria.find((c) => c.id === t.goal_id)
      t.criterion_claims = (g?.acceptance || []).map((a) => ({ criterion_id: a.criterion_id, claim: 'partial' }))
      touched = true
    }
    for (const [k, v] of [['flags', []], ['pr', null], ['requires_ci', false], ['verified_commit', null], ['orchestration', { rounds: 0, failures: {}, budget_used_usd: 0 }]]) {
      if (t[k] === undefined) {
        t[k] = v
        touched = true
      }
    }
    if (touched) added.upgraded++
  }
  const maxSeq = Math.max(0, ...s.taskQueue.tasks.map((t) => Number(t.task_id.slice(2)) || 0))
  s.taskQueue.next_seq = Math.max(s.taskQueue.next_seq, maxSeq + 1)
  const maxDl = Math.max(0, ...s.decisionLog.entries.map((e) => Number((e.decision_id.match(/^DL-(\d+)$/) || [])[1]) || 0))
  s.decisionLog.next_seq = Math.max(s.decisionLog.next_seq, maxDl + 1)
  return added
}

