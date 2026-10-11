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
// 정책 v1.1(agents/policies/pr-automation.json · 2026-10-11) 게이트 추가:
//   · 필수 체크(required_checks)가 하나라도 없으면 → 통과 아님(누락된 build · verify · e2e 는 PASS 가 아니다)
//   · base ≠ main → 종속 PR — 앞 PR 병합 뒤 base 가 바뀌고 CI 가 다시 돈 다음에만
//   · supabase/migrations/ 변경 → 파일마다 본문 `DB-Approved: <파일명> sha256=<앞 12자+>` 가 HEAD 본문 해시와 맞아야(삭제 파일은 sha256=removed)
//   · 30파일 이상 → 본문 `## 검증` 절(승인이 아니라 추가 검증 조건)
//   · --auto: 정책 auto_merge_enabled 가 false 면 판정만 하고 병합하지 않는다
//
//   node agents/scripts/safe-merge.mjs <PR번호> [--wait] [--timeout-min 30] [--method merge|squash|rebase] [--dry-run] [--auto]
// 종료 코드: 0 병합(또는 --dry-run 통과) · 3 병합 불가(실패·대기·SKIP 뿐·충돌) · 1 실행 오류

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { isMain, rel } from './lib.mjs'

/** 정책 정본(없거나 깨지면 던진다 — 정책 없이 병합하지 않는다) */
export function loadPolicy(file = rel('agents', 'policies', 'pr-automation.json')) {
  const p = JSON.parse(fs.readFileSync(file, 'utf8'))
  if (!Array.isArray(p.required_checks) || !p.merge) throw new Error('pr-automation.json 형식 오류')
  return p
}

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

/** PR 정보 → { ok, reasons[], byName{} } — 순수 함수(테스트 대상). required: 반드시 있어야 할 체크 이름 */
export function decide(pr, { required = [] } = {}) {
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
  for (const name of required) if (!byName[name]) reasons.push(`누락: ${name} — 돌지 않은 필수 체크는 통과가 아니다`)
  const pending = reasons.length > 0 && reasons.every((r) => r.startsWith('대기:'))
  return { ok: reasons.length === 0, pending, reasons, byName }
}

const base = (p) => p.split('/').pop()
/**
 * 정책 게이트(순수) — base · DB 변경 승인 증거 · 데이터 삭제 · 대규모 변경.
 * pr: { baseRefName, body, files: [{ path }] } · contents: { [path]: 본문 문자열 | null(삭제됨) }
 */
export function gates(pr, policy, contents = {}) {
  const reasons = []
  const notes = []
  const m = policy.merge
  if (pr.baseRefName !== m.base) reasons.push(`종속 PR — base ${pr.baseRefName} ≠ ${m.base}. 앞 PR 병합 뒤 base 를 바꾸고 최신 HEAD 의 CI 를 다시 본다`)
  const body = String(pr.body ?? '').replace(/\r\n/g, '\n')
  const files = (pr.files ?? []).map((f) => f.path)
  const marks = new Map()
  for (const line of body.split('\n')) {
    const x = line.match(new RegExp(`${m.db_approval_marker}\\s*(\\S+)\\s+sha256=([0-9a-f]{12,64}|removed)`, 'i'))
    if (x) marks.set(base(x[1]), x[2].toLowerCase())
  }
  const del = (m.deletion_patterns ?? []).map((p) => new RegExp(p, 'i'))
  for (const p of files.filter((f) => m.db_paths.some((d) => f.startsWith(d)))) {
    if (m.pending_prefix && base(p).startsWith(m.pending_prefix)) {
      notes.push(`제안본 ${base(p)} — 적용되지 않는 _pending_ 파일이라 승인 증거 대상 아님(적용은 별도 승인)`)
      continue
    }
    const text = contents[p]
    const mark = marks.get(base(p))
    if (text === undefined) { reasons.push(`DB 변경 ${p} — 본문을 읽지 못해 승인 증거를 확인할 수 없다`); continue }
    const kind = text === null ? '삭제된 마이그레이션' : del.some((r) => r.test(text)) ? 'DB 변경 + 데이터 삭제 구문' : 'DB 변경'
    if (!mark) { reasons.push(`${kind} ${p} — 본문에 「${m.db_approval_marker} ${base(p)} sha256=…」 승인 증거 없음`); continue }
    if (text === null) { if (mark !== 'removed') reasons.push(`삭제된 마이그레이션 ${p} — 증거는 sha256=removed 여야 한다`); continue }
    const sha = createHash('sha256').update(text).digest('hex')
    if (!sha.startsWith(mark)) reasons.push(`${kind} ${p} — 승인 해시 ${mark.slice(0, 12)} ≠ HEAD 본문 ${sha.slice(0, 12)}(승인 뒤 바뀜)`)
    else notes.push(`${kind} ${base(p)} 승인 증거 일치(${sha.slice(0, 12)})`)
  }
  if (files.length >= policy.large_change.files) {
    if (!/^##\s*검증/m.test(body)) reasons.push(`대규모 변경 ${files.length}파일 — 본문에 「## 검증」 절(실행한 검증 · 결과)이 없다`)
    else notes.push(`대규모 변경 ${files.length}파일 — 「## 검증」 절 있음`)
  }
  return { ok: reasons.length === 0, reasons, notes }
}

const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
const FIELDS = 'number,state,mergeable,headRefOid,baseRefName,body,files,statusCheckRollup'
/** PR HEAD 의 마이그레이션 본문(없으면 null = 삭제) */
function migrationContents(pr, policy) {
  const out = {}
  for (const { path } of pr.files ?? []) {
    if (!policy.merge.db_paths.some((d) => path.startsWith(d))) continue
    try {
      out[path] = execFileSync('gh', ['api', '-H', 'Accept: application/vnd.github.raw', `repos/{owner}/{repo}/contents/${encodeURI(path)}?ref=${pr.headRefOid}`], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
    } catch (e) {
      out[path] = /404|Not Found/.test(String(e.stderr)) ? null : undefined
    }
  }
  return out
}
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
  let policy
  try {
    policy = loadPolicy()
  } catch (e) {
    console.error(`[safe-merge] 정책을 읽지 못했다(병합하지 않음): ${e.message}`)
    return 1
  }
  const auto = argv.includes('--auto')
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
    d = decide(pr, { required: policy.required_checks })
    if (d.ok || !d.pending || !argv.includes('--wait') || Date.now() > deadline) break
    Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 30_000)
  }
  const g = gates(pr, policy, migrationContents(pr, policy))
  for (const note of g.notes) console.log(`[safe-merge] ${note}`)
  if (!d.ok || !g.ok) {
    d.reasons.push(...g.reasons)
    console.log(`[safe-merge] PR #${n} 병합 안 함 · head ${pr.headRefOid.slice(0, 9)}\n- ${d.reasons.join('\n- ')}`)
    return 3
  }
  if (auto && !policy.merge.auto_merge_enabled) {
    console.log(`[safe-merge] PR #${n} 게이트 통과 · head ${pr.headRefOid.slice(0, 9)} — 정책 v${policy.version} 자동 병합 꺼짐(auto_merge_enabled=false) · 병합하지 않음`)
    return 0
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
