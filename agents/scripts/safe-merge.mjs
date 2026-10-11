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
//   · 필수 체크가 **이 HEAD** 에서 · **마지막 base 변경 뒤에** 성공했는가(commits/<sha>/check-runs · timeline base_ref_changed)
//   · base ≠ main → 종속 PR — 앞 PR 병합 뒤 base 가 바뀌고 CI 가 다시 돈 다음에만
//   · supabase/migrations/ 변경 → 개발 DB 적용 이력(statements sha256)이 HEAD 본문과 같아야(PR 본문 문자열은 증거 아님 · _pending_ 제외)
//   · 30파일 이상 → 본문 `## 검증` 절(승인이 아니라 추가 검증 조건)
//   · auto_merge_enabled=false → 어떤 경로로도 병합하지 않는다(--dry-run 판정만) · 병합 직전 HEAD · base 재확인
//
//   node agents/scripts/safe-merge.mjs <PR번호> [--wait] [--timeout-min 30] [--method merge|squash|rebase] [--dry-run]
// 종료 코드: 0 병합(또는 --dry-run 통과) · 3 병합 불가(실패·대기·SKIP 뿐·충돌) · 1 실행 오류

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import { isMain, rel } from './lib.mjs'

/** 정책 정본(없거나 깨지면 던진다 — 정책 없이 병합하지 않는다) */
export function loadPolicy(file = rel('agents', 'policies', 'pr-automation.json')) {
  return parsePolicy(fs.readFileSync(file, 'utf8'))
}
export function parsePolicy(raw) {
  const p = JSON.parse(raw)
  if (!Array.isArray(p.required_checks) || !p.required_checks.length || !p.merge) throw new Error('pr-automation.json 형식 오류')
  return p
}

/**
 * 병합 판정에 쓰는 정책 = **보호된 origin/main 의 정책**(로컬 작업 트리 · PR 브랜치가 아니다).
 * PR 이 자기 브랜치에서 스위치를 켜거나 필수 체크를 줄여 자기 자신을 통과시키지 못하게 한다.
 * origin/main 에 정책이 없으면(도입 전) 병합 꺼짐 — 판정에는 로컬 정본의 필수 체크를 쓰되 병합은 하지 않는다.
 */
export function mergePolicy(fetchMain, local) {
  let raw = null
  try {
    raw = fetchMain()
  } catch {
    raw = null
  }
  if (!raw) return { ...local, merge: { ...local.merge, auto_merge_enabled: false }, source: 'local(origin/main 에 정책 없음 · 병합 꺼짐)' }
  return { ...parsePolicy(raw), source: 'origin/main' }
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
    // 필수가 아닌 체크가 SKIPPED 뿐이면 막지 않는다(e2e-shared-dev 는 PR 에서 의도적으로 건너뛴다). 필수 체크 · 실패 · 모르는 결론은 그대로 막는다
    else if (!s.includes('pass') && !(required.length && !required.includes(name) && s.every((x) => x === 'skip'))) reasons.push(`통과 아님: ${name}(${runs.map((r) => r.result).join(',')})`)
  }
  for (const name of required) if (!byName[name]) reasons.push(`누락: ${name} — 돌지 않은 필수 체크는 통과가 아니다`)
  const pending = reasons.length > 0 && reasons.every((r) => r.startsWith('대기:'))
  return { ok: reasons.length === 0, pending, reasons, byName }
}

const base = (p) => p.split('/').pop()
const VERSION = /^(\d{14})_/
export const sha256 = (t) => createHash('sha256').update(t).digest('hex')

/**
 * 정책 게이트(순수) — base · DB 변경 승인 증거 · 데이터 삭제 · 대규모 변경.
 * pr: { baseRefName, body, files: [{ path }] } · contents: { [path]: HEAD 본문 | null(삭제됨) | undefined(못 읽음) }
 * applied: { [버전]: 개발 DB 적용 이력 statements 의 sha256 } | null(이력을 읽지 못함)
 * 승인 증거 = **개발 DB 의 실제 적용 이력**(승인 훅을 거쳐서만 생긴다)과 HEAD 본문 해시 일치. PR 본문 문자열은 증거가 아니다(v1.1 P0-2).
 */
export function gates(pr, policy, contents = {}, applied = {}) {
  const reasons = []
  const notes = []
  const m = policy.merge
  if (pr.baseRefName !== m.base) reasons.push(`종속 PR — base ${pr.baseRefName} ≠ ${m.base}. 앞 PR 병합 뒤 base 를 바꾸고 최신 HEAD 의 CI 를 다시 본다`)
  const body = String(pr.body ?? '').replace(/\r\n/g, '\n')
  const files = (pr.files ?? []).map((f) => f.path)
  const del = (m.deletion_patterns ?? []).map((p) => new RegExp(p, 'i'))
  for (const p of files.filter((f) => m.db_paths.some((d) => f.startsWith(d)))) {
    const name = base(p)
    if (m.pending_prefix && name.startsWith(m.pending_prefix)) {
      notes.push(`제안본 ${name} — 적용되지 않는 _pending_ 파일이라 승인 증거 대상 아님(적용은 별도 승인)`)
      continue
    }
    const text = contents[p]
    if (text === undefined) { reasons.push(`DB 변경 ${p} — 본문을 읽지 못해 승인 증거를 확인할 수 없다`); continue }
    const v = name.match(VERSION)?.[1] ?? null
    if (!v) { reasons.push(`DB 변경 ${p} — 버전 번호 없는 마이그레이션 파일(적용 이력과 이을 수 없다)`); continue }
    if (applied === null) { reasons.push(`DB 변경 ${p} — 개발 DB 적용 이력을 읽지 못했다(SUPABASE_ACCESS_TOKEN) · 증거 없이 병합하지 않는다`); continue }
    if (text === null) {
      reasons.push(applied[v] ? `적용된 마이그레이션 삭제 ${name} — 스키마 이력 손실 · 데이터 삭제 승인 대상` : `마이그레이션 삭제 ${name} — 사용자 승인 필요`)
      continue
    }
    const kind = del.some((r) => r.test(text)) ? 'DB 변경 + 데이터 삭제 구문' : 'DB 변경'
    const sha = sha256(text)
    if (!applied[v]) reasons.push(`${kind} ${name} — 개발 DB 적용 이력 없음(승인 · 적용 전 마이그레이션은 병합하지 않는다)`)
    else if (applied[v] !== sha) reasons.push(`${kind} ${name} — 적용된 SQL ${applied[v].slice(0, 12)} ≠ HEAD 본문 ${sha.slice(0, 12)}(적용 뒤 바뀜)`)
    else notes.push(`${kind} ${name} — 개발 DB 적용 이력과 본문 일치(${sha.slice(0, 12)})`)
  }
  if (files.length >= policy.large_change.files) {
    if (!/^##\s*검증/m.test(body)) reasons.push(`대규모 변경 ${files.length}파일 — 본문에 「## 검증」 절(실행한 검증 · 결과)이 없다`)
    else notes.push(`대규모 변경 ${files.length}파일 — 「## 검증」 절 있음`)
  }
  return { ok: reasons.length === 0, reasons, notes }
}

/**
 * 필수 체크가 **이 HEAD** 에서 · **마지막 base 변경 뒤에** 성공했는지(순수).
 * runs: commits/<sha>/check-runs 의 { name, head_sha, status, conclusion, started_at } · baseChangedAt: ISO | null
 */
export function verifyRuns(required, runs, headSha, baseChangedAt = null) {
  const reasons = []
  for (const name of required) {
    const mine = runs.filter((r) => r.name === name && r.head_sha === headSha)
    const fresh = mine.filter((r) => !baseChangedAt || Date.parse(r.started_at) > Date.parse(baseChangedAt))
    if (!mine.length) reasons.push(`HEAD ${headSha.slice(0, 9)} 에서 돈 「${name}」 없음`)
    else if (!fresh.length) reasons.push(`「${name}」 이 base 변경(${baseChangedAt}) 전에 돌았다 — 다시 돌려야 한다`)
    else if (!fresh.some((r) => r.status === 'completed' && r.conclusion === 'success')) reasons.push(`「${name}」 최신 HEAD · base 에서 성공 아님(${fresh.map((r) => r.conclusion ?? r.status).join(',')})`)
  }
  return { ok: reasons.length === 0, reasons }
}

const gh = (args) => execFileSync('gh', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024 })
const FIELDS = 'number,state,mergeable,headRefOid,baseRefName,body,files,statusCheckRollup'
/** PR HEAD 의 마이그레이션 본문(없으면 null = 삭제) */
function migrationContents(pr, policy) {
  const out = {}
  for (const { path } of pr.files ?? []) {
    if (!policy.merge.db_paths.some((d) => path.startsWith(d))) continue
    try {
      out[path] = gh(['api', '-H', 'Accept: application/vnd.github.raw', `repos/{owner}/{repo}/contents/${encodeURI(path)}?ref=${pr.headRefOid}`])
    } catch (e) {
      out[path] = /404|Not Found/.test(String(e.stderr)) ? null : undefined
    }
  }
  return out
}
/** 개발 DB 적용 이력(읽기 전용 질의 · Management API) — 버전 → statements sha256. 토큰이 없거나 실패하면 null */
async function appliedHashes(pr, policy) {
  const versions = (pr.files ?? []).map((f) => base(f.path).match(VERSION)?.[1]).filter(Boolean)
  if (!versions.length) return {}
  const token = process.env.SUPABASE_ACCESS_TOKEN
  if (!token || !policy.merge.db_project) return null
  const query = `select version, encode(sha256(convert_to(array_to_string(statements, ''), 'UTF8')), 'hex') as sha from supabase_migrations.schema_migrations where version in (${versions.map((v) => `'${v}'`).join(',')})`
  try {
    const res = await fetch(`https://api.supabase.com/v1/projects/${policy.merge.db_project}/database/query`, {
      method: 'POST',
      headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
      body: JSON.stringify({ query, read_only: true }),
    })
    if (!res.ok) return null
    return Object.fromEntries((await res.json()).map((r) => [r.version, r.sha]))
  } catch {
    return null
  }
}
/** 이 HEAD 의 체크 실행 · 마지막 base 변경 시각 */
function runsAndBaseChange(n, sha) {
  const runs = JSON.parse(gh(['api', '--paginate', '--slurp', `repos/{owner}/{repo}/commits/${sha}/check-runs?per_page=100`])).flatMap((p) => p.check_runs)
  const events = JSON.parse(gh(['api', '--paginate', '--slurp', `repos/{owner}/{repo}/issues/${n}/timeline?per_page=100`])).flat()
  const changed = events.filter((e) => e.event === 'base_ref_changed').map((e) => e.created_at).sort().pop() ?? null
  return { runs, baseChangedAt: changed }
}
const view = (n) => JSON.parse(gh(['pr', 'view', String(n), '--json', FIELDS]))

async function main() {
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
    policy = mergePolicy(() => {
      execFileSync('git', ['fetch', '-q', 'origin', 'main'], { stdio: 'ignore' })
      return execFileSync('git', ['show', 'origin/main:agents/policies/pr-automation.json'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] })
    }, loadPolicy())
    console.log(`[safe-merge] 정책 v${policy.version} · 출처 ${policy.source} · 병합 ${policy.merge.auto_merge_enabled ? '켜짐' : '꺼짐'}`)
  } catch (e) {
    console.error(`[safe-merge] 정책을 읽지 못했다(병합하지 않음): ${e.message}`)
    return 1
  }
  const dry = argv.includes('--dry-run')
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
  const g = gates(pr, policy, migrationContents(pr, policy), await appliedHashes(pr, policy))
  let r
  try {
    const { runs, baseChangedAt } = runsAndBaseChange(n, pr.headRefOid)
    r = verifyRuns(policy.required_checks, runs, pr.headRefOid, baseChangedAt)
  } catch (e) {
    r = { ok: false, reasons: [`체크 실행 · base 변경 이력을 읽지 못했다: ${String(e.stderr || e.message).slice(0, 160)}`] }
  }
  for (const note of g.notes) console.log(`[safe-merge] ${note}`)
  const reasons = [...d.reasons, ...g.reasons, ...r.reasons]
  if (reasons.length) {
    console.log(`[safe-merge] PR #${n} 병합 안 함 · head ${pr.headRefOid.slice(0, 9)}\n- ${reasons.join('\n- ')}`)
    return 3
  }
  if (dry) {
    console.log(`[safe-merge] PR #${n} 병합 가능 · head ${pr.headRefOid.slice(0, 9)} · 필수 체크 ${policy.required_checks.length}종 이 HEAD 에서 통과 (--dry-run)`)
    return 0
  }
  // 정책 비활성 = 어떤 경로로도 병합하지 않는다(자동 · 수동 구분 없음). 켜는 길은 정책 파일을 바꾸는 PR 하나뿐(보호된 main 을 거친다)
  if (!policy.merge.auto_merge_enabled) {
    console.log(`[safe-merge] PR #${n} 게이트 통과 · head ${pr.headRefOid.slice(0, 9)} — 정책 v${policy.version} 병합 꺼짐(auto_merge_enabled=false) · 병합하지 않음`)
    return 3
  }
  // 확인과 병합 사이 HEAD · base 변경 — 다시 읽어 비교하고, GitHub 에도 확인한 SHA 로만 병합하라고 넘긴다
  const again = view(n)
  if (again.headRefOid !== pr.headRefOid || again.baseRefName !== pr.baseRefName) {
    console.log(`[safe-merge] PR #${n} 확인 뒤 HEAD/base 가 바뀌었다(${pr.headRefOid.slice(0, 9)} → ${again.headRefOid.slice(0, 9)}) — 다시 검증한다 · 병합하지 않음`)
    return 3
  }
  try {
    gh(['pr', 'merge', String(n), `--${method}`, '--match-head-commit', pr.headRefOid])
  } catch (e) {
    console.error(`[safe-merge] 병합 거부(확인 뒤 HEAD 가 바뀌었거나 GitHub 거부): ${String(e.stderr || e.message).slice(0, 300)}`)
    return 3
  }
  console.log(`[safe-merge] PR #${n} 병합 · head ${pr.headRefOid.slice(0, 9)} · 필수 체크 ${policy.required_checks.length}종 통과`)
  return 0
}

if (isMain(import.meta.url)) process.exit(await main())
