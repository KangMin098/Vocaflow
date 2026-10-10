#!/usr/bin/env node
// agents/scripts/safe-merge.mjs
//
// PR 병합 게이트 — 병합 직전에 필수 체크와 HEAD SHA 를 한 번에 다시 확인하고, 그 SHA 일 때만 병합한다.
// 왜(2026-10-10 PR #200): main 에 브랜치 보호가 없어 GitHub 이 실패 체크를 막지 않았고, 에이전트가
// `gh pr checks --watch; gh pr merge` 로 확인과 병합을 이어 붙여 build FAILURE 인 PR 이 병합됐다.
//
// 판정(체크 이름 단위 — 이 저장소 CI 는 같은 이름의 체크가 두 번 돌고 한쪽은 SKIPPED 가 된다):
//   · 한 번이라도 FAILURE · CANCELLED · TIMED_OUT · ACTION_REQUIRED · STARTUP_FAILURE · STALE → 실패
//   · 아직 끝나지 않은 실행이 있으면 → 대기(PENDING)
//   · SUCCESS 가 하나 이상 → 통과
//   · SKIPPED · NEUTRAL 뿐이거나 모르는 결론 → 통과 아님(SKIP·UNKNOWN 을 PASS 로 치지 않는다)
//   · 체크가 하나도 없으면 → 통과 아님 · PR 이 열려 있고 MERGEABLE 이어야 한다
// 병합은 `gh pr merge --match-head-commit <확인한 SHA>` — 확인 뒤 새 커밋이 들어오면 GitHub 이 거부한다.
//
//   node agents/scripts/safe-merge.mjs <PR번호> [--wait] [--timeout-min 30] [--method merge|squash|rebase] [--dry-run]
// 종료 코드: 0 병합(또는 --dry-run 통과) · 3 병합 불가(실패·대기·SKIP 뿐·충돌) · 1 실행 오류

import { execFileSync } from 'node:child_process'
import { isMain } from './lib.mjs'

const FAIL = new Set(['FAILURE', 'CANCELLED', 'TIMED_OUT', 'ACTION_REQUIRED', 'STARTUP_FAILURE', 'STALE', 'ERROR'])
const PASS = new Set(['SUCCESS'])
const NONPASS = new Set(['SKIPPED', 'NEUTRAL'])

/** statusCheckRollup 항목 하나 → { name, state: 'pass'|'fail'|'pending'|'skip'|'unknown' } */
export function classify(c) {
  // CheckRun: status·conclusion · StatusContext: state
  const name = c.name || c.context || '(이름 없음)'
  const done = c.__typename === 'StatusContext' ? !['PENDING', 'EXPECTED'].includes(c.state) : c.status === 'COMPLETED'
  const result = String(c.conclusion || c.state || '').toUpperCase()
  if (!done) return { name, state: 'pending', result: c.status || c.state || 'PENDING' }
  if (FAIL.has(result)) return { name, state: 'fail', result }
  if (PASS.has(result)) return { name, state: 'pass', result }
  if (NONPASS.has(result)) return { name, state: 'skip', result }
  return { name, state: 'unknown', result: result || '(없음)' }
}

/** PR 정보 → { ok, reasons[], byName{} } — 순수 함수(테스트 대상) */
export function decide(pr) {
  const reasons = []
  if (pr.state !== 'OPEN') reasons.push(`PR 상태 ${pr.state}`)
  if (pr.mergeable !== 'MERGEABLE') reasons.push(`병합 가능 상태 아님(${pr.mergeable})`)
  const checks = (pr.statusCheckRollup || []).map(classify)
  if (!checks.length) reasons.push('체크가 하나도 없다 — 통과로 치지 않는다')
  const byName = {}
  for (const c of checks) (byName[c.name] ||= []).push(c)
  for (const [name, runs] of Object.entries(byName)) {
    const s = runs.map((r) => r.state)
    if (s.includes('fail')) reasons.push(`실패: ${name}(${runs.filter((r) => r.state === 'fail').map((r) => r.result).join(',')})`)
    else if (s.includes('pending')) reasons.push(`대기: ${name}`)
    else if (!s.includes('pass')) reasons.push(`통과 아님: ${name}(${runs.map((r) => r.result).join(',')})`)
  }
  const pending = reasons.length > 0 && reasons.every((r) => r.startsWith('대기:'))
  return { ok: reasons.length === 0, pending, reasons, byName }
}

const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const FIELDS = 'number,state,mergeable,headRefOid,baseRefName,statusCheckRollup'
const view = (n) => JSON.parse(gh(['pr', 'view', String(n), '--json', FIELDS]))

function main() {
  const argv = process.argv.slice(2)
  const n = argv.find((a) => /^\d+$/.test(a))
  const arg = (k, d) => (argv.includes(k) ? argv[argv.indexOf(k) + 1] : d)
  if (!n) {
    console.error('사용: node agents/scripts/safe-merge.mjs <PR번호> [--wait] [--timeout-min 30] [--method merge|squash|rebase] [--dry-run]')
    return 1
  }
  const method = arg('--method', 'merge')
  if (!['merge', 'squash', 'rebase'].includes(method)) {
    console.error(`모르는 병합 방식: ${method}`)
    return 1
  }
  const deadline = Date.now() + Number(arg('--timeout-min', 30)) * 60_000
  let pr
  let d
  for (;;) {
    try {
      pr = view(n)
    } catch (e) {
      console.error(`[safe-merge] PR #${n} 를 읽지 못했다(병합하지 않음): ${String(e.stderr || e.message).slice(0, 300)}`)
      return 1
    }
    d = decide(pr)
    if (d.ok || !d.pending || !argv.includes('--wait') || Date.now() > deadline) break
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 30_000)
  }
  if (!d.ok) {
    console.log(`[safe-merge] PR #${n} 병합 안 함 · head ${pr.headRefOid.slice(0, 9)}\n- ${d.reasons.join('\n- ')}`)
    return 3
  }
  if (argv.includes('--dry-run')) {
    console.log(`[safe-merge] PR #${n} 병합 가능 · head ${pr.headRefOid.slice(0, 9)} · 체크 ${Object.keys(d.byName).length}종 통과 (--dry-run)`)
    return 0
  }
  try {
    gh(['pr', 'merge', String(n), `--${method}`, '--match-head-commit', pr.headRefOid])
  } catch (e) {
    console.error(`[safe-merge] 병합 거부(확인 뒤 HEAD 가 바뀌었거나 GitHub 거부): ${String(e.stderr || e.message).slice(0, 300)}`)
    return 3
  }
  console.log(`[safe-merge] PR #${n} 병합 · head ${pr.headRefOid.slice(0, 9)} · 체크 ${Object.keys(d.byName).length}종 통과`)
  return 0
}

if (isMain(import.meta.url)) process.exit(main())
