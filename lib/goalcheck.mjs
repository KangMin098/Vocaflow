// lib/goalcheck.mjs
//
// 최상위 목표 검사기 — 정본 v1.1.0 의 모든 목표·수용 기준을 **실제 증거**로 판정한다.
//
// 판정 단위는 수용 기준(criterion_id, 예: VG-L3-D1-02-AC1). 목표 상태는 그 기준들에서 나온다.
//
// 우선순위(위가 이긴다)
//   PASS                    COMPLETED 작업이 이 기준을 claim:'full' 로 주장하고, 그 작업의 현재 run 증거가 유효하며,
//                           검증 커밋 이후 그 작업의 변경 범위(allowed_paths)가 main 에서 바뀌지 않았다.
//   FAIL                    verification/ 아래 증거로 기록된 FAIL(사람·이전 검사) — 또는 CI 판독이 실행 0 을 보인 기준
//   BLOCKED                 이 기준을 겨냥한 작업이 BLOCKED
//   EXTERNAL_INPUT_REQUIRED 이 목표에 걸린 열린 external_input 결정이 있다
//   UNKNOWN                 그 밖 — **통과가 아니다**
//
// 하지 않는 것: 문서·보고서에 「완료」라고 적힌 것으로 PASS 를 주지 않는다. CI job 이 초록이어도 내부가 건너뛰었으면 PASS 가 아니다.
// L1·L0 는 하위가 모두 PASS 여도 자동 PASS 가 아니다(장기·효과 목표 — PROJECT_GOAL §2·§6).

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { skipOutOfScope } from './tasks.mjs'
import { root as spaceRoot } from './paths.mjs'

const sha256 = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')

/** PASS 후보의 증거·리뷰 원본이 지금도 그대로 있는가(소실·변조 → PASS 아님). */
export function evidenceIntact(t, current) {
  const resolveArt = (p) => [p, path.join(spaceRoot(), p), t.worktree ? path.join(t.worktree, p) : null].filter(Boolean).find((c) => {
    try {
      return fs.statSync(c).isFile()
    } catch {
      return false
    }
  })
  if (!t.review_record) return { ok: false, why: '리뷰 기록 경로 없음' }
  const rv = resolveArt(t.review_record)
  if (!rv) return { ok: false, why: `리뷰 기록 ${t.review_record} 가 없다` }
  if (!t.review_record_sha256) return { ok: false, why: '리뷰 기록 무결성 해시 없음(이 규칙 이전 완료)' }
  if (sha256(rv) !== t.review_record_sha256) return { ok: false, why: `리뷰 기록 ${t.review_record} 내용이 완료 후 바뀌었다` }
  for (const e of current) {
    if (/^https?:\/\//.test(e.artifact_path_or_url)) continue
    const f = resolveArt(e.artifact_path_or_url)
    if (!f) return { ok: false, why: `증거 ${e.evidence_id} 파일 ${e.artifact_path_or_url} 가 없다` }
    if (!e.artifact_sha256) return { ok: false, why: `증거 ${e.evidence_id} 무결성 해시 없음` }
    if (sha256(f) !== e.artifact_sha256) return { ok: false, why: `증거 ${e.evidence_id} 파일 내용이 기록 후 바뀌었다` }
  }
  return { ok: true }
}

/** 필수 CI 판독이 PASS 를 허용하는가: 찾음 · 로그 읽음 · job 전체/일부 건너뜀 0 · 실제 테스트 실행 · 성공 · 판독 커밋 = 검사 대상 main */
export function ciAllowsPass(r, mainSha) {
  if (!r) return { ok: false, why: 'CI 판독 없음(--no-ci · gh 오류)' }
  if (!r.found) return { ok: false, why: 'job 없음' }
  if (!r.log_read) return { ok: false, why: '로그를 못 읽어 건너뜀 여부를 모른다' }
  if (r.skipped_inner) return { ok: false, why: 'job 전체 건너뜀' }
  if (r.conclusion !== 'success') return { ok: false, why: `conclusion=${r.conclusion}` }
  if ((r.test_skipped ?? 0) > 0) return { ok: false, why: `테스트 ${r.test_skipped}개 건너뜀(skip=0 요구)` }
  if (!(r.test_passed > 0)) return { ok: false, why: '실행된 테스트 집계를 찾지 못했다' }
  if (mainSha && r.head_sha && !String(mainSha).startsWith(String(r.head_sha).slice(0, 7)) && !String(r.head_sha).startsWith(String(mainSha).slice(0, 7))) return { ok: false, why: `CI 커밋 ${String(r.head_sha).slice(0, 9)} ≠ 검사 대상 main ${String(mainSha).slice(0, 9)}` }
  return { ok: true }
}

export const RANK = { PASS: 5, FAIL: 4, BLOCKED: 3, EXTERNAL_INPUT_REQUIRED: 2, UNKNOWN: 1 }

/** CI 판독 규칙: 어떤 기준이 어떤 job 의 「실제 실행」을 요구하는가 */
export const CI_RULES = [{ criterion_id: 'VG-L3-D2-01-AC1', workflow: 'ci.yml', job: 'e2e', reason: '핵심 E2E skip=0 요구 — job 은 초록이어도 로그가 건너뜀이면 실행 0' }]

function defaultGit(repo, args) {
  return execFileSync('git', ['-C', repo, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
}

/** 검증 커밋 이후 그 작업의 범위 파일이 ref(기본 origin/main)에서 바뀌었는가. 판정 불가면 null. */
export function changedSince({ repo, commit, paths, ref = 'origin/main', git = defaultGit }) {
  if (!commit || !paths?.length) return null
  try {
    git(repo, ['cat-file', '-e', `${commit}^{commit}`])
    // 검증 커밋이 ref 의 조상이 아니면(아직 머지 전) 비교 기준이 없다 — 머지 후에만 판정
    try {
      git(repo, ['merge-base', '--is-ancestor', commit, ref])
    } catch {
      return { comparable: false, files: [] }
    }
    const pathspecs = paths.map((p) => `:(glob)${p}`)
    const out = git(repo, ['diff', '--name-only', `${commit}..${ref}`, '--', ...pathspecs]).trim()
    return { comparable: true, files: out ? out.split('\n') : [] }
  } catch {
    return null
  }
}

function acceptanceItems(doc) {
  const items = []
  for (const c of doc.criteria) {
    if (c.observed_status === 'template') continue
    for (const a of c.acceptance) items.push({ goal: c, criterion_id: a.criterion_id, condition: a.condition })
  }
  return items
}

/**
 * 순수 판정. 입력:
 *   doc        정본 GOAL_ACCEPTANCE_CRITERIA
 *   state      loadState().state
 *   ci         { [criterion_id]: readLatestWorkflowJob 결과 } (없으면 CI 판정 생략 — 이유를 남긴다)
 *   repo, git  변경 무효화 판정용
 *   head       { main_sha } 기록용
 */
export function computeGoalCheck({ doc, state, ci = {}, repo, git, head = {}, now = new Date().toISOString() }) {
  const results = []
  const tasks = state.taskQueue.tasks
  const openExternal = state.decisionLog.entries.filter((e) => e.status === 'OPEN_QUESTION' && e.kind === 'external_input')

  for (const { goal, criterion_id, condition } of acceptanceItems(doc)) {
    const prev = state.goalStatus.goals[goal.id]
    const cands = []

    // PASS 후보: COMPLETED 작업의 full claim
    for (const t of tasks.filter((t) => t.status === 'COMPLETED')) {
      const claim = (t.criterion_claims || []).find((c) => c.criterion_id === criterion_id)
      if (!claim) continue
      if (claim.claim !== 'full') {
        cands.push({ status: 'UNKNOWN', reason: `${t.task_id} 는 이 기준을 부분(partial)으로만 다뤘다 — PASS 근거 아님`, evidence_path: t.review_record, commit: t.verified_commit ?? null, scope: `task ${t.task_id}` })
        continue
      }
      // 사용자 목표의 설계 계약이 바뀌어 재검증이 필요한 작업은 PASS 근거가 아니다(WF-S7)
      if (t.revalidate_required) {
        cands.push({ status: 'UNKNOWN', reason: `${t.task_id} 재검증 필요 — ${t.revalidate_required.reason}`, evidence_path: t.review_record, commit: t.verified_commit ?? null, scope: `task ${t.task_id}` })
        continue
      }
      const current = (t.evidence || []).filter((e) => e.run_seq === t.run_seq)
      const bad = current.filter((e) => e.result !== 'pass' || !skipOutOfScope(e, t))
      if (bad.length || !current.length) {
        cands.push({ status: 'UNKNOWN', reason: `${t.task_id} 증거가 유효하지 않다(${bad.map((e) => e.evidence_id).join(',') || '증거 없음'})`, scope: `task ${t.task_id}` })
        continue
      }
      const ch = changedSince({ repo, commit: t.verified_commit, paths: t.allowed_paths, git })
      if (ch === null) {
        cands.push({ status: 'UNKNOWN', reason: `${t.task_id} 검증 커밋(${t.verified_commit ?? '없음'})을 확인할 수 없다`, scope: `task ${t.task_id}` })
        continue
      }
      if (!ch.comparable) {
        cands.push({ status: 'UNKNOWN', reason: `${t.task_id} 검증 커밋 ${t.verified_commit} 이 아직 main 에 없다 — 머지 후 판정`, scope: `task ${t.task_id}` })
        continue
      }
      if (ch.files.length) {
        cands.push({ status: 'UNKNOWN', reason: `PASS 무효화: ${t.task_id} 검증(${t.verified_commit}) 이후 범위 파일이 main 에서 바뀌었다 — ${ch.files.slice(0, 5).join(', ')}`, scope: `task ${t.task_id}`, invalidated: true })
        continue
      }
      const intact = evidenceIntact(t, current)
      if (!intact.ok) {
        cands.push({ status: 'UNKNOWN', reason: `${t.task_id} 증거 무결성 실패 — ${intact.why}`, scope: `task ${t.task_id}` })
        continue
      }
      cands.push({ status: 'PASS', reason: `${t.task_id} COMPLETED(full) · 리뷰 ${t.reviewed_by} · 이후 범위 변경 없음 · 증거 원본 무결`, evidence_path: t.review_record, commit: t.verified_commit, scope: `task ${t.task_id} · ${t.allowed_paths.join(', ')}` })
    }

    // CI 판독
    const rule = CI_RULES.find((r) => r.criterion_id === criterion_id)
    if (rule) {
      const r = ci[criterion_id]
      if (!r) cands.push({ status: 'UNKNOWN', reason: `CI 판독 없음(${rule.workflow}/${rule.job}) — gh 를 못 썼거나 생략`, scope: 'ci' })
      else if (!r.found) cands.push({ status: 'UNKNOWN', reason: `main 최신 ${rule.workflow} 에 ${rule.job} job 이 없다`, scope: 'ci' })
      else if (r.skipped_inner || r.conclusion !== 'success' || (r.test_skipped ?? 0) > 0) cands.push({ status: 'FAIL', reason: `${rule.reason} · run ${r.run_id} conclusion=${r.conclusion} · 건너뜀 테스트 ${r.test_skipped ?? '?'} · 로그: ${r.marker ?? '(표식 없음)'}`, evidence_path: r.evidence_path ?? null, commit: r.head_sha, scope: `ci ${rule.workflow}/${rule.job}`, ci_run: r.run_id })
      else if (!r.log_read) cands.push({ status: 'UNKNOWN', reason: `run ${r.run_id} 로그를 못 읽어 건너뜀 여부를 모른다`, scope: 'ci' })
      // 실제 실행 + 성공이어도 이 기준(배포 스모크 포함)은 CI 하나로 PASS 가 아니다 — 작업 full claim 이 있어야 한다
    }

    // 사람·이전 검사가 verification/ 증거로 남긴 FAIL 은 유지(새 PASS 가 이기지 않는 한)
    // 검사기 자신의 보고서(verification/goal-check/)만 근거인 FAIL 은 유지하지 않는다 — 다음 검사가 다시 판정한다(CI 가 고쳐지면 풀린다)
    const recorded = (prev?.evidence_paths || []).filter((p) => String(p).startsWith('verification/') && !String(p).startsWith('verification/goal-check/'))
    if (prev?.status === 'FAIL' && recorded.length) {
      // 사유는 FAIL 을 기록한 마지막 이력의 메모 — prev.note 는 초기값일 수 있다(상태 변경 메모를 저장하기 전 기록)
      const failNote = [...(prev.history || [])].reverse().find((h) => h.to === 'FAIL' && h.by !== 'goal-check' && h.by !== 'goal-check-cli')?.note ?? prev.note ?? ''
      cands.push({ status: 'FAIL', reason: `기록된 FAIL 유지: ${failNote}`.slice(0, 400), evidence_path: recorded.join(','), scope: 'recorded' })
    }

    if (tasks.some((t) => t.status === 'BLOCKED' && (t.criterion_claims || []).some((c) => c.criterion_id === criterion_id))) {
      cands.push({ status: 'BLOCKED', reason: '이 기준을 겨냥한 작업이 BLOCKED', scope: 'tasks' })
    }
    const ext = openExternal.filter((e) => (e.affects_goal_ids || []).includes(goal.id))
    if (ext.length) cands.push({ status: 'EXTERNAL_INPUT_REQUIRED', reason: `열린 외부 입력: ${ext.map((e) => e.decision_id).join(',')}`, scope: 'decisions' })

    cands.push({ status: 'UNKNOWN', reason: '직접 검증된 근거 없음(UNKNOWN 은 통과가 아니다)', scope: 'default' })
    // PASS 가 있으면 FAIL 기록보다 우선하지만, 같은 기준에 CI FAIL 이 있으면 PASS 를 주지 않는다(실행 0 은 통과가 아님)
    const ciFail = cands.find((c) => c.status === 'FAIL' && c.scope.startsWith('ci'))
    let pick = ciFail ?? cands.sort((a, b) => RANK[b.status] - RANK[a.status])[0]
    if (pick.status === 'PASS' && rule) {
      const gate = ciAllowsPass(ci[criterion_id], head.main_sha)
      if (!gate.ok) pick = { ...pick, status: 'UNKNOWN', reason: `PASS 보류 — 필수 CI(${rule.workflow}/${rule.job}) 확인 불가: ${gate.why} · 작업 근거: ${pick.reason}` }
    }
    results.push({ goal_id: goal.id, criterion_id, condition, level: goal.level, status: pick.status, reason: pick.reason, evidence_path: pick.evidence_path ?? null, commit: pick.commit ?? head.main_sha ?? null, scope: pick.scope, checked_at: now, previous_status: prev?.status ?? null, considered: cands.length - 1 })
  }

  // 목표 단위 상태: 기준이 하나면 그대로, 여럿이면 가장 나쁜 쪽(FAIL>BLOCKED>EXT>UNKNOWN), 전부 PASS 일 때만 PASS
  const byGoal = new Map()
  for (const r of results) byGoal.set(r.goal_id, [...(byGoal.get(r.goal_id) || []), r])
  const goals = {}
  const worst = (rs) => {
    if (rs.every((r) => r.status === 'PASS')) return 'PASS'
    for (const s of ['FAIL', 'BLOCKED', 'EXTERNAL_INPUT_REQUIRED']) if (rs.some((r) => r.status === s)) return s
    return 'UNKNOWN'
  }
  for (const [id, rs] of byGoal) {
    const g = doc.criteria.find((c) => c.id === id)
    let status = worst(rs)
    let reason = rs.map((r) => `${r.criterion_id}: ${r.status} — ${r.reason}`).join(' | ')
    // 상위 목표: 자식이 PASS 아니면 자신도 PASS 불가 · L0/L1 은 자동 PASS 금지
    const kids = doc.criteria.filter((c) => c.parent_id === id)
    if (status === 'PASS' && kids.length) {
      const kidStates = kids.map((k) => byGoal.get(k.id)).filter(Boolean).map(worst)
      if (!kidStates.every((s) => s === 'PASS')) {
        status = 'UNKNOWN'
        reason = `자신의 기준은 PASS 이나 하위 목표가 모두 PASS 가 아니다 | ${reason}`
      }
    }
    if (status === 'PASS' && g.level <= 1) {
      status = 'UNKNOWN'
      reason = `L${g.level} 장기 목표 — 하위 판정으로 자동 PASS 하지 않는다 | ${reason}`
    }
    goals[id] = { status, reason, criteria: rs.map((r) => r.criterion_id) }
  }
  return { checked_at: now, head, results, goals }
}

/** 판정 결과를 GOAL_STATUS 에 반영 — 바뀐 것만, 이전 상태와 이유를 history 에 남긴다. UNKNOWN→FAIL 은 「새 결함 발견」으로 표시. */
export function applyGoalCheck(state, check, { by = 'goal-check', reportPath }) {
  const changes = []
  for (const [id, g] of Object.entries(check.goals)) {
    const cur = state.goalStatus.goals[id]
    if (!cur || cur.status === g.status) continue
    const kind = cur.status === 'UNKNOWN' && g.status === 'FAIL' ? 'defect_discovered' : cur.status === 'PASS' && g.status !== 'PASS' ? 'pass_invalidated' : 'status_change'
    cur.history = cur.history || []
    cur.history.push({ at: check.checked_at, from: cur.status, to: g.status, by, note: `${kind}: ${g.reason}`.slice(0, 800), evidence_paths: reportPath ? [reportPath] : [] })
    changes.push({ goal_id: id, from: cur.status, to: g.status, kind })
    cur.status = g.status
    cur.last_check = { at: check.checked_at, reason: g.reason.slice(0, 800), report: reportPath ?? null }
    if (reportPath) cur.evidence_paths = Array.from(new Set([...(cur.evidence_paths || []).filter((p) => p.startsWith('verification/') && !p.startsWith('verification/goal-check/')), reportPath]))
  }
  for (const [id, g] of Object.entries(check.goals)) {
    const cur = state.goalStatus.goals[id]
    if (cur) cur.last_check = { at: check.checked_at, reason: g.reason.slice(0, 800), report: reportPath ?? null }
  }
  // 수용 기준별 상태(덧붙이기만 — 목표 status·history 구조는 그대로). 작업 완료와 기준 충족을 구분해 다음 의존 작업을 가리킨다
  const open = new Set(['READY', 'IN_PROGRESS', 'REVIEW', 'BLOCKED', 'WAITING_CHATGPT'])
  const tasks = state.taskQueue?.tasks || []
  for (const r of check.results) {
    const cur = state.goalStatus.goals[r.goal_id]
    if (!cur) continue
    const method = (cur.acceptance || []).find((a) => a.criterion_id === r.criterion_id)?.verification_method ?? null
    const targets = (t) => (t.impact?.acceptance_ids ?? (t.criterion_claims || []).map((c) => c.criterion_id)).includes(r.criterion_id)
    const next = tasks.filter((t) => open.has(t.status) && targets(t)).map((t) => t.task_id)
    const done = tasks.filter((t) => t.status === 'COMPLETED' && targets(t)).map((t) => t.task_id)
    cur.criteria_status = cur.criteria_status || {}
    cur.criteria_status[r.criterion_id] = {
      status: r.status,
      evidence_path: r.evidence_path ?? null,
      verified_commit: r.status === 'PASS' ? r.commit ?? null : null,
      checked_at: check.checked_at,
      verification_method: method,
      unmet_reason: r.status === 'PASS' ? null : String(r.reason || '').slice(0, 400),
      tasks_completed: done,
      next_dependency: next[0] ?? null,
    }
  }
  return changes
}
