// lib/ci.mjs
//
// GitHub Actions 결과를 **판독**한다. 「job 이 초록」과 「검사가 실제로 돌았다」를 구분하는 것이 이 모듈의 존재 이유다.
// 2026-10-08~09 실측: e2e job 이 pass(33s)로 끝나지만 로그는 「e2e 건너뜀 — 저장소 시크릿 미설정」이었다.
//
// gh CLI 를 쓴다(인증은 사용자의 gh 로그인 — 토큰을 읽거나 저장하지 않는다). 테스트는 runner 를 주입한다.

import { execFileSync } from 'node:child_process'

/**
 * job 전체가 「돌지 않았다」를 뜻하는 표식 — 워크플로가 ::notice:: 로 낸 건너뜀 · 테스트 0건.
 * 일반 로그 줄의 「건너뜀」(예: 원료가 없어 일부 파일 타입 검사를 건너뜀)은 job 전체 건너뜀이 아니다 →
 * PARTIAL_MARKERS 로 따로 모아 숨기지 않고 보고한다(2026-10-09 verify job 오탐에서 고침).
 */
export const SKIP_MARKERS = [/::notice::[^\n]*건너뜀/, /::notice::[^\n]*\bskip/i, /no tests? (were )?(run|executed)/i]
export const PARTIAL_MARKERS = [/건너뜀/, /\bskipped\b/i]

function partialNotes(log) {
  return log
    .split('\n')
    .filter((l) => PARTIAL_MARKERS.some((re) => re.test(l)) && !SKIP_MARKERS.some((re) => re.test(l)))
    .map((l) => l.replace(/\x1b\[[0-9;]*m/g, '').trim().slice(0, 240))
    .filter((l) => !/\(\d+ tests? \| \d+ skipped\)|Tests\s+\d+ passed \| \d+ skipped|Test Files/.test(l)) // vitest 집계 줄은 테스트 증거 쪽에서 다룬다
    .slice(0, 20)
}

function defaultRunner(args) {
  return execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 })
}

export function ghAvailable(runner = defaultRunner) {
  try {
    runner(['auth', 'status'])
    return true
  } catch {
    return false
  }
}

/**
 * PR 의 현재 head 에 대한 체크를 읽고, 각 job 로그에서 건너뜀 표식을 찾는다.
 * 반환: { pr, head_sha, fetched_at, jobs:[{ name, state, run_id, job_id, skipped_inner, marker }], pending, failed, ok }
 *   ok = 전부 끝났고 실패 0 (단 skipped_inner 인 job 은 「통과」가 아니라 따로 표시된다)
 */
export function readPrChecks(pr, { runner = defaultRunner, now = () => new Date().toISOString() } = {}) {
  const view = JSON.parse(runner(['pr', 'view', String(pr), '--json', 'headRefOid,state,mergeStateStatus']))
  const checks = JSON.parse(runner(['pr', 'checks', String(pr), '--json', 'name,state,link']))
  const jobs = checks.map((c) => {
    const m = String(c.link || '').match(/runs\/(\d+)\/job\/(\d+)/)
    return { name: c.name, state: String(c.state).toLowerCase(), run_id: m?.[1] ?? null, job_id: m?.[2] ?? null, skipped_inner: false, marker: null, partial_skip_notes: [] }
  })
  for (const j of jobs) {
    if (j.state !== 'success' && j.state !== 'pass') continue
    if (!j.run_id || !j.job_id) continue
    let log = ''
    try {
      log = runner(['run', 'view', j.run_id, '--job', j.job_id, '--log'])
    } catch {
      j.marker = 'log_unreadable'
      continue
    }
    const hit = SKIP_MARKERS.find((re) => re.test(log))
    if (hit) {
      j.skipped_inner = true
      j.marker = (log.split('\n').find((l) => hit.test(l)) || '').trim().slice(0, 240)
    }
    j.partial_skip_notes = partialNotes(log)
  }
  const pending = jobs.filter((j) => ['pending', 'queued', 'in_progress', 'waiting'].includes(j.state))
  const failed = jobs.filter((j) => ['failure', 'fail', 'error', 'cancelled', 'timed_out'].includes(j.state))
  return { pr, head_sha: view.headRefOid, pr_state: view.state, merge_state: view.mergeStateStatus, fetched_at: now(), jobs, pending: pending.map((j) => j.name), failed: failed.map((j) => j.name), skipped_inner: jobs.filter((j) => j.skipped_inner).map((j) => j.name), ok: pending.length === 0 && failed.length === 0 }
}

/**
 * 로그의 테스트 집계 — vitest 「Tests  5 passed | 1 skipped」 · playwright 「5 passed」 「1 skipped」.
 * 정본 「핵심 E2E skip=0」 은 job 전체 건너뜀뿐 아니라 **일부 건너뜀**도 통과가 아니다(Codex 최종 리뷰 P1).
 */
export function testTally(log) {
  const clean = String(log).replace(/\x1b\[[0-9;]*m/g, '')
  let passed = 0
  let skipped = 0
  for (const m of clean.matchAll(/(\d+)\s+passed/gi)) passed += Number(m[1])
  for (const m of clean.matchAll(/(\d+)\s+(?:skipped|pending)/gi)) skipped += Number(m[1])
  return { test_passed: passed, test_skipped: skipped }
}

/** main 의 최신 워크플로 run 에서 이름이 일치하는 job 의 판독(예: ci.yml 의 e2e). */
export function readLatestWorkflowJob(workflow, jobName, { runner = defaultRunner, branch = 'main', now = () => new Date().toISOString() } = {}) {
  const runs = JSON.parse(runner(['run', 'list', '--workflow', workflow, '--branch', branch, '--limit', '1', '--json', 'databaseId,headSha,conclusion,createdAt']))
  if (!runs.length) return { workflow, job: jobName, found: false, fetched_at: now() }
  const run = runs[0]
  const jobs = JSON.parse(runner(['run', 'view', String(run.databaseId), '--json', 'jobs'])).jobs || []
  const job = jobs.find((j) => j.name === jobName)
  if (!job) return { workflow, job: jobName, found: false, run_id: run.databaseId, head_sha: run.headSha, fetched_at: now() }
  let log = ''
  try {
    log = runner(['run', 'view', String(run.databaseId), '--job', String(job.databaseId), '--log'])
  } catch {
    /* 로그를 못 읽으면 skipped 판정을 못 한다 — unknown 으로 둔다 */
  }
  const hit = log ? SKIP_MARKERS.find((re) => re.test(log)) : null
  return {
    workflow,
    job: jobName,
    found: true,
    run_id: run.databaseId,
    head_sha: run.headSha,
    created_at: run.createdAt,
    conclusion: job.conclusion,
    log_read: !!log,
    skipped_inner: !!hit,
    marker: hit ? (log.split('\n').find((l) => hit.test(l)) || '').trim().slice(0, 240) : null,
    partial_skip_notes: log ? partialNotes(log) : [],
    ...(log ? testTally(log) : { test_passed: null, test_skipped: null }),
    fetched_at: now(),
  }
}
