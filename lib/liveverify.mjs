// lib/liveverify.mjs
//
// 읽기 전용 개발 DB 검증(live test) — 목표 실행 정책이 db_read_dev 와 테스트 계정(live_test_user)을 위임했을 때만.
//
//   읽기 전용 근거(정적 · 해시 결속):
//     테스트 파일에서 시작해 상대·@/ import 를 따라간 파일 전부를 모은다(apps/web/src 안).
//     각 파일의 쓰기 호출(.insert( .update( .delete( .upsert( .rpc()을 센다. 쓰기 호출이 있는 파일은
//     정책의 read_only_attestation 에 { path, sha256 } 로 올라 있어야 한다(사람이 「이 테스트 경로에서 그 쓰기 함수는 불리지 않는다」를 확인·승인).
//     하나라도 해시가 다르거나 목록에 없으면 실행하지 않는다(REATTEST_REQUIRED).
//   판정: 통과 테스트 > 0 · 실패 0 · 건너뜀 0 일 때만 PASS. 건너뜀은 PASS 가 아니다(UNVERIFIED).
//   비밀값: .env 파일은 이 프로세스가 process.loadEnvFile 로 자식 환경에만 넣는다 — 출력·기록하지 않는다.

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { spawnSync } from 'node:child_process'

// 공백·줄바꿈을 끼운 호출도 잡는다(`.insert ({})` · `.delete\n()`) — Codex P1
const WRITE_RE = /\.\s*(insert|update|delete|upsert|rpc)\s*\(/g
const sha = (f) => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')

function resolveImport(fromFile, spec, srcRoot) {
  let base
  if (spec.startsWith('@/')) base = path.join(srcRoot, spec.slice(2))
  else if (spec.startsWith('.')) base = path.resolve(path.dirname(fromFile), spec)
  else return null
  for (const c of [base, `${base}.ts`, `${base}.tsx`, path.join(base, 'index.ts')]) if (fs.existsSync(c) && fs.statSync(c).isFile()) return c
  return null
}

/**
 * vitest 가 테스트보다 먼저 싣는 코드(설정 파일 · setupFiles · globalSetup) — 같은 자격 증명으로 실행되므로 검사 대상(Codex P1).
 * 설정 파일이 문자열이 아닌 값으로 이 목록을 만들면 따라갈 수 없다 → 거부.
 */
export function runnerRoots(worktree) {
  const web = path.join(worktree, 'apps', 'web')
  const roots = []
  const unresolved = []
  for (const n of ['vitest.config.ts', 'vitest.config.mts', 'vitest.config.js', 'vitest.config.mjs', 'vitest.workspace.ts', 'vite.config.ts']) {
    const f = path.join(web, n)
    if (!fs.existsSync(f)) continue
    roots.push(f)
    const text = fs.readFileSync(f, 'utf8')
    for (const key of ['setupFiles', 'globalSetup']) {
      const m = text.match(new RegExp(`${key}\\s*:\\s*(\\[[^\\]]*\\]|['"][^'"]+['"]|[^,}\\n]+)`))
      if (!m) continue
      const v = m[1].trim()
      const literalOnly = /^(['"][^'"]+['"]|\[\s*(['"][^'"]+['"]\s*(,\s*['"][^'"]+['"]\s*)*,?)?\s*\])$/.test(v)
      if (!literalOnly) {
        unresolved.push(`${path.relative(worktree, f)}: ${key} 가 문자열(목록)만으로 되어 있지 않다 — 따라갈 수 없다`)
        continue
      }
      const lits = [...v.matchAll(/['"]([^'"]+)['"]/g)].map((x) => x[1])
      for (const l of lits) {
        const p = path.resolve(web, l.replace(/^\.\//, ''))
        const hit = [p, `${p}.ts`, `${p}.mts`, `${p}.js`].find((c) => fs.existsSync(c) && fs.statSync(c).isFile())
        if (hit) roots.push(hit)
        else unresolved.push(`${path.relative(worktree, f)}: ${key} ${l} 를 찾지 못했다`)
      }
    }
  }
  return { roots, unresolved }
}

/** 테스트 파일(+ 러너가 먼저 싣는 코드)의 import 닫힘(타입 전용 import 제외) — 각 파일의 쓰기 호출 수 */
export function importClosure(worktree, testRel, { runner = true } = {}) {
  const srcRoot = path.join(worktree, 'apps', 'web', 'src')
  const webRoot = path.join(worktree, 'apps', 'web')
  const start = path.join(worktree, testRel)
  const seen = new Map()
  const unresolved = []
  // 러너 코드는 apps/web 아래(설정·setup 파일이 src 밖에 있다)까지, 테스트 쪽은 apps/web/src 안만 따라간다
  const stack = [{ f: start, root: srcRoot }]
  if (runner) {
    const rr = runnerRoots(worktree)
    unresolved.push(...rr.unresolved)
    for (const r of rr.roots) stack.push({ f: r, root: webRoot })
  }
  while (stack.length) {
    const { f, root } = stack.pop()
    if (seen.has(f)) continue
    const raw = fs.readFileSync(f, 'utf8')
    const text = raw.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:\\])\/\/.*$/gm, '$1')
    seen.set(f, { writes: (text.match(WRITE_RE) || []).length })
    // 러너 쪽 공유 설정 모듈이 setup 목록을 다시 선언하면 따라갈 수 없다 → 거부(Codex P1)
    if (root === webRoot && !f.startsWith(srcRoot) && !/vitest\.config|vitest\.workspace|vite\.config/.test(path.basename(f)) && /\b(setupFiles|globalSetup)\b/.test(text)) unresolved.push(`${path.relative(worktree, f)}: 공유 설정 모듈이 setupFiles/globalSetup 을 선언한다 — 따라갈 수 없다`)
    // 실행되는 의존 형태 전부: import … from · import '…'(부수 효과) · export … from(재내보내기) · import('…') · require('…') — Codex P1
    const specs = [
      // 줄 어디에 있어도(한 줄에 여러 선언 · 세미콜론 뒤) — Codex P1
      ...[...text.matchAll(/\bimport\s+(?!type\b)[^'";]*?\bfrom\s*['"]([^'"]+)['"]/g)].map((m) => m[1]),
      ...[...text.matchAll(/\bimport\s*['"]([^'"]+)['"]/g)].map((m) => m[1]),
      ...[...text.matchAll(/\bexport\s+(?!type\b)[^'";]*?\bfrom\s*['"]([^'"]+)['"]/g)].map((m) => m[1]),
      ...[...text.matchAll(/\bimport\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]),
      ...[...text.matchAll(/\brequire\s*\(\s*['"]([^'"]+)['"]\s*\)/g)].map((m) => m[1]),
    ]
    if (/\bimport\s*\(\s*[^'"\s)]/.test(text) || /\brequire\s*\(\s*[^'"\s)]/.test(text)) unresolved.push(`${path.relative(worktree, f)}: 동적 import 경로(문자열 아님)`)
    for (const sp of specs) {
      const r = resolveImport(f, sp, srcRoot)
      if (r && r.startsWith(root)) stack.push({ f: r, root })
      else if (r) unresolved.push(`${path.relative(worktree, f)}: ${sp} 는 ${path.relative(worktree, root)} 밖이다(검사 범위 밖 — 거부)`)
      else if (sp.startsWith('.') || sp.startsWith('@/')) unresolved.push(`${path.relative(worktree, f)}: ${sp} 를 찾지 못했다`)
    }
  }
  const files = [...seen.entries()].map(([f, v]) => ({ path: path.relative(worktree, f).split(path.sep).join('/'), sha256: sha(f), writes: v.writes }))
  files.unresolved = unresolved
  return files
}

/** 실행 전 검사 — 위임·계정·해시 결속 */
export function preflight(policy, worktree, testRel) {
  const why = []
  if (!policy) return { ok: false, why: ['목표 실행 정책 없음'], closure: [] }
  if (!policy.allowed_capabilities.includes('db_read_dev')) why.push('db_read_dev 미위임')
  if (!policy.live_test_user) why.push('테스트 계정(live_test_user) 미지정 — 실제 학습자 계정으로 돌리지 않는다')
  const closure = importClosure(worktree, testRel)
  for (const u of closure.unresolved || []) why.push(`안전하게 따라갈 수 없는 의존: ${u}`)
  const att = new Map((policy.read_only_attestation || []).map((a) => [a.path, a.sha256]))
  const fns = policy.read_only_write_functions || []
  for (const f of closure) {
    if (att.has(f.path)) {
      if (att.get(f.path) !== f.sha256) why.push(`${f.path} 가 확인 뒤 바뀌었다(해시 불일치) — 다시 확인 필요`)
      continue
    }
    if (f.writes > 0) why.push(`쓰기 호출 ${f.writes}개 파일 ${f.path} 이 읽기 전용 확인 목록에 없다`)
    // 확인된 쓰기 함수를 새로 참조하는 파일(테스트·호출자 변경)은 호출 경로가 바뀐 것 — 다시 확인(Codex P1)
    const text = fs.readFileSync(path.join(worktree, f.path), 'utf8')
    const refs = fns.filter((n) => new RegExp(`\\b${n}\\b`).test(text))
    if (refs.length) why.push(`${f.path} 가 확인된 쓰기 함수 ${refs.join(',')} 를 참조한다 — 호출 경로 재확인 필요`)
  }
  return { ok: !why.length, why, closure }
}

/**
 * 실행 · 판정. cmd 는 테스트용 대역(VFC_VITEST_CMD) 이 아니면 pnpm vitest. envFile 은 값을 읽어 자식 환경에만 넣는다.
 * 반환 status: PASS(통과>0·실패0·건너뜀0) · FAIL · UNVERIFIED(건너뜀·결과 없음)
 */
export function runLive({ worktree, testRel, liveUser, envFile = null, timeoutMs = 300_000 }) {
  // vitest 의 파일 인자는 부분 일치 필터 — 자격 증명을 주기 전에 저장소의 테스트 파일 중 이 필터에 맞는 것이 승인 파일 하나뿐인지 확인(Codex P1)
  const filter = testRel.replace(/^apps\/web\//, '')
  const webDir = path.join(worktree, 'apps', 'web')
  const all = []
  const walk = (d) => {
    for (const e of fs.existsSync(d) ? fs.readdirSync(d, { withFileTypes: true }) : []) {
      if (e.name === 'node_modules' || e.name.startsWith('.')) continue
      const p = path.join(d, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.(test|spec)\.[cm]?[jt]sx?$/.test(e.name)) all.push(path.relative(webDir, p).split(path.sep).join('/'))
    }
  }
  walk(webDir)
  const matches = all.filter((x) => x.includes(filter))
  if (matches.length !== 1 || matches[0] !== filter) return { status: 'UNVERIFIED', counts: null, exit: null, ms: 0, reason: `필터 「${filter}」 가 승인 파일 하나만 고르지 않는다(${matches.length}개: ${matches.slice(0, 3).join(', ')}) — 자격 증명을 주지 않았다` }
  const out = path.join(worktree, '.vfc-runs', `live-${Date.now()}.json`)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  const childEnv = { ...process.env, MAP_LIVE_USER: liveUser }
  if (envFile && fs.existsSync(envFile)) {
    // 값을 이 프로세스 환경에 읽지 않고 사본에만 — loadEnvFile 은 process.env 를 바꾸므로 사본으로 되돌린다
    const before = { ...process.env }
    process.loadEnvFile(envFile)
    for (const [k, v] of Object.entries(process.env)) if (before[k] !== v) childEnv[k] = v
    for (const k of Object.keys(process.env)) if (!(k in before)) delete process.env[k]
    Object.assign(process.env, before)
  }
  childEnv.MAP_LIVE_USER = liveUser // 정책이 승인한 테스트 계정이 마지막 — .env 의 값으로 바뀌지 않는다(Codex P1)
  const cmd = process.env.VFC_VITEST_CMD
  const t0 = Date.now()
  const r = cmd
    ? spawnSync(process.execPath, [...cmd.split(' ').slice(1), testRel, out], { cwd: worktree, env: childEnv, encoding: 'utf8', timeout: timeoutMs })
    : spawnSync(process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm', ['--filter', 'web', 'exec', 'vitest', 'run', testRel.replace(/^apps\/web\//, ''), '--reporter=json', `--outputFile=${out}`], { cwd: worktree, env: childEnv, encoding: 'utf8', timeout: timeoutMs, shell: process.platform === 'win32' })
  let rep = null
  try {
    rep = JSON.parse(fs.readFileSync(out, 'utf8'))
  } catch {
    rep = null
  }
  const n = rep ? { passed: rep.numPassedTests ?? 0, failed: rep.numFailedTests ?? 0, skipped: (rep.numPendingTests ?? 0) + (rep.numTodoTests ?? 0), total: rep.numTotalTests ?? 0 } : null
  // 러너가 실패로 끝났거나(teardown·처리 안 된 오류) 보고서에 오류가 있으면 PASS 가 아니다 — Codex P2
  const runnerOk = r.status === 0 && !(rep && (rep.success === false || (rep.numFailedTestSuites ?? 0) > 0 || (rep.numRuntimeErrorTestSuites ?? 0) > 0))
  // vitest 의 파일 인자는 부분 일치 필터다 — 승인한 테스트 파일 말고 다른 파일이 실행됐으면 PASS 가 아니다(Codex P1)
  const norm = (x) => String(x).split('\\').join('/')
  const ran = (rep?.testResults || []).map((t) => norm(t.name || t.file || ''))
  const want = norm(testRel)
  const extra = ran.filter((x) => x && !x.endsWith(want) && !x.endsWith(want.replace(/^apps\/web\//, '')))
  const onlyApproved = !extra.length
  const status = !n ? 'UNVERIFIED' : n.failed > 0 || !runnerOk || !onlyApproved ? 'FAIL' : n.skipped > 0 || n.passed === 0 ? 'UNVERIFIED' : 'PASS'
  return { status, counts: n, exit: r.status, ms: Date.now() - t0, reason: !onlyApproved ? `승인 밖 테스트 파일 실행: ${extra.slice(0, 3).join(', ')}` : !n ? '결과 파일 없음' : status === 'UNVERIFIED' ? `건너뜀 ${n.skipped} · 통과 ${n.passed} — 건너뜀은 PASS 가 아니다` : null }
}
