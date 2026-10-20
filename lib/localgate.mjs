// lib/localgate.mjs — LOCAL_FAST 로컬 통합 게이트(safe-merge 의 필수 검사를 로컬로 옮긴 것 · GitHub 호출 없음)
//
// 이미 completeTask 가 보장하는 것(다시 하지 않는다): 다른 owner 의 Codex 리뷰 기록 · 이번 run 증거 전부 pass · 완료 조건 전부 덮음 · 증거 단일 커밋.
// 여기서 더 보는 것 — safe-merge · CI 가 하던 몫:
//   commit   검증 커밋(verified_commit) = 작업 브랜치 HEAD · 검사 중 HEAD 불변(TOCTOU)
//   review   리뷰 기록 파일이 완료 때 해시와 같다 · 판정 PASS 만(REVIEW_UNKNOWN · 기록 없음 = 실패)
//   align    목표 정렬 게이트를 통과한 작업(impact.parent_goal_id) · 변경 파일이 allowed_paths 안
//   approval 마이그레이션(supabase/migrations/*.sql, _pending 제외) 변경은 사용자 DB 승인의 SQL sha256 과 일치 · 마이그레이션 삭제 금지
//   security .env* 파일 · 비밀값 모양 추가 줄 금지
//   checks   타입 · lint · 관련 테스트(+선택 e2e)를 검증 커밋에서 병렬 재실행 — 결과는 verification/local/ 에 남긴다
// 통과한 작업만 통합 worktree(integration_branch)에 --no-ff 병합한다. 통합 worktree 가 더러우면 손대지 않는다(미커밋 변경 강제 정리 금지).
import { spawn, execFileSync } from 'node:child_process'
import crypto from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { pathInScope } from './tasks.mjs'
import { localEvidenceDir } from './devmode.mjs'
import { checkProvenance } from './localroles.mjs'

const SECRET_RES = [
  /sk-[A-Za-z0-9_-]{20,}/, /sk-ant-[A-Za-z0-9_-]{20,}/, /eyJ[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{20,}\.[A-Za-z0-9_-]{10,}/,
  /postgres(?:ql)?:\/\/[^\s'"]+:[^\s'"@]+@/, /SUPABASE_SERVICE_ROLE_KEY\s*=\s*\S+/, /gh[pousr]_[A-Za-z0-9]{30,}/,
]

export const defaultGit = (repo) => (...args) => {
  const output = execFileSync('git', ['-C', repo, ...args], { maxBuffer: 64 << 20, stdio: ['ignore', 'pipe', 'pipe'], windowsHide: true })
  // SQL 승인 해시는 Git blob의 바이트 그대로 계산한다. BOM·CRLF·끝 공백도 승인 대상이다.
  return args[0] === 'show' ? output : output.toString('utf8').trim()
}

/** 순수 정적 게이트(파일 · 기록 · 승인 · 비밀값) — 실행 검사 전. 실패 사유 목록을 돌려준다(빈 목록 = 통과) */
export function staticGates({ task, head, base, git, readFile = (p) => fs.readFileSync(p), reviewRoot }) {
  const fail = []
  if (task.status !== 'COMPLETED') fail.push(`task: ${task.task_id} 상태 ${task.status} — COMPLETED(다른 owner 의 리뷰 통과)만 통합한다`)
  if (!task.verified_commit) fail.push('commit: 검증 커밋 없음')
  else if (!head.startsWith(task.verified_commit) && !task.verified_commit.startsWith(head)) fail.push(`commit: 검증 커밋 ${task.verified_commit.slice(0, 9)} ≠ 브랜치 HEAD ${head.slice(0, 9)} — 검증 뒤 커밋이 더 있다`)
  // 리뷰 기록 무결성 + 판정
  if (!task.review_record) fail.push('review: 리뷰 기록 없음(REVIEW_UNKNOWN 은 통과가 아니다)')
  else {
    try {
      const buf = readFile(path.resolve(reviewRoot, task.review_record))
      if (task.review_record_sha256 && crypto.createHash('sha256').update(buf).digest('hex') !== task.review_record_sha256) fail.push('review: 리뷰 기록이 완료 뒤 바뀌었다')
      const txt = String(buf)
      if (task.role_assignment) {
        const block = [...txt.matchAll(/```json\s*\n([\s\S]*?)\n```/g)].at(-1)
        let review = null
        try { review = JSON.parse(block?.[1] || 'null') } catch { /* rejected below */ }
        fail.push(...checkProvenance(task, head, review))
      }
      const v = txt.match(/"verdict"\s*:\s*"([A-Z_]+)"/)?.[1] ?? null
      // 통과 판정 = APPROVE(오케스트레이터 vfc-review 스키마) · PASS. REVIEW_UNKNOWN · REWORK · 판독 불가는 통과가 아니다
      if (v !== 'APPROVE' && v !== 'PASS') fail.push(`review: 판정 ${v ?? '없음'} — APPROVE 만 통합(REVIEW_UNKNOWN · REWORK 불가)`)
      // 일반 LOCAL_FAST는 실제 증거 게이트로 통합한다. 명시된 독립 검토 계약은 유지한다.
      const evidenceOnly = /"verification_mode"\s*:\s*"evidence_only"/.test(txt)
      if (evidenceOnly && (task.role_assignment || task.require_review_pass)) fail.push('review: 이 작업은 독립 검토 계약이 있어 증거 전용 판정으로 대체할 수 없다')
      else if (/자동 Codex 리뷰 없음/.test(txt) && !evidenceOnly) fail.push('review: 검증 방식이 없는 옛 결정적 판정 — 실제 증거 게이트 기록 필요')
    } catch { fail.push('review: 리뷰 기록을 읽지 못했다') }
  }
  if (!task.impact?.parent_goal_id && !task.user_goal_id) fail.push('align: 목표 정렬 근거 없음(impact.parent_goal_id · user_goal_id)')
  // 변경 파일
  let files = []
  try { files = git('diff', '--name-status', `${base}...${head}`).split('\n').filter(Boolean).map((l) => { const [st, ...p] = l.split('\t'); return { st: st[0], file: p.at(-1) } }) } catch { fail.push('diff: 기준 ref 와 비교할 수 없다') }
  const out = files.filter((f) => !pathInScope(f.file, task.allowed_paths || []) || pathInScope(f.file, task.forbidden_paths || []))
  if (out.length) fail.push(`align: 허용 범위 밖 변경 ${out.slice(0, 5).map((f) => f.file).join(', ')}${out.length > 5 ? ` 외 ${out.length - 5}` : ''}`)
  for (const f of files.filter((x) => /^supabase\/migrations\/[^/]+\.sql$/.test(x.file) && !/\/_pending/.test(x.file))) {
    if (f.st === 'D') { fail.push(`approval: 마이그레이션 삭제 ${f.file} — 데이터 손실 승인 경로로`); continue }
    const sha = crypto.createHash('sha256').update(git('show', `${head}:${f.file}`)).digest('hex')
    if (task.approval?.sql_sha256 !== sha) fail.push(`approval: ${f.file} 은 사용자 DB 승인(sql_sha256)과 일치하지 않는다 — 승인형 DB 러너로`)
  }
  for (const f of files) if (/(^|\/)\.env(\.|$)/.test(f.file) && f.st !== 'D') fail.push(`security: ${f.file} — .env 파일은 통합하지 않는다`)
  try {
    const added = git('diff', '-U0', `${base}...${head}`).split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++'))
    const hit = added.find((l) => SECRET_RES.some((re) => re.test(l)))
    if (hit) fail.push(`security: 비밀값 모양의 추가 줄 — ${hit.slice(0, 40)}…`)
  } catch { fail.push('security: diff 를 읽지 못했다') }
  return { fail, files: files.map((f) => f.file) }
}

/** 문서·스타일만 바뀌면 전체 web 타입 검사를 반복하지 않는다. 삭제·공유 패키지·빌드 설정은 포함한다. */
export function selectChecks(checks, { files, worktree, e2e = false }) {
  const webFiles = files.filter((f) => /^apps\/web\/.*\.[cm]?[jt]sx?$/.test(f)
    && fs.existsSync(path.join(worktree, f))).map((f) => f.slice('apps/web/'.length))
  const typeImpact = files.some((f) => /^(apps\/web\/|packages\/).*\.(?:[cm]?[jt]sx?|json)$/.test(f)
    || /^(?:package\.json|pnpm-lock\.yaml|pnpm-workspace\.yaml|tsconfig[^/]*\.json|turbo\.json|\.nvmrc)$/.test(f))
  return checks.filter((c) => (c.kind !== 'e2e' || e2e)
    && (!c.needs_web_files || webFiles.length)
    && (!c.needs_web_types || typeImpact))
    .map((c) => ({ ...c, cwd: path.join(worktree, c.cwd || '.'),
      args: (c.args || []).flatMap((a) => a === '{changed_web_files}' ? webFiles : [a]) }))
}

/** 실행 검사 병렬 실행 — 각 {id, cwd, cmd, args, timeout_ms, kind}. 결과 {id, ok, ms, code, tail, counts} */
export function runChecks(checks, { run = spawnCheck } = {}) {
  return Promise.all(checks.map((c) => run(c)))
}

export function spawnCheck(c) {
  const t0 = Date.now()
  return new Promise((resolve) => {
    // Native executables do not need cmd.exe; shell:true splits C:\Program Files\nodejs\node.exe.
    // Keep the shell only for Windows batch launchers (pnpm is a .cmd shim).
    const batch = process.platform === 'win32' && (/\.(cmd|bat)$/i.test(c.cmd) || /^(pnpm|npm|npx)$/i.test(c.cmd))
    const p = spawn(c.cmd, c.args, { cwd: c.cwd, shell: batch, windowsHide: true, env: { ...process.env, CI: '1' } })
    let buf = ''
    const keep = (d) => { buf = (buf + d).slice(-20000) }
    p.stdout.on('data', keep); p.stderr.on('data', keep)
    const timer = setTimeout(() => p.kill(), c.timeout_ms ?? 15 * 60_000)
    p.on('close', (code) => { clearTimeout(timer); resolve({ id: c.id, kind: c.kind ?? 'check', ok: code === 0, code, ms: Date.now() - t0, tail: buf.slice(-3000), counts: countsOf(buf) }) })
    p.on('error', (e) => { clearTimeout(timer); resolve({ id: c.id, kind: c.kind ?? 'check', ok: false, code: -1, ms: Date.now() - t0, tail: String(e.message), counts: null }) })
  })
}

/** 실행 수 · 건너뜀 수(vitest · playwright · node:test 출력) — 못 찾으면 null(= 실행 0 으로 보지 않고 UNKNOWN) */
export function countsOf(text) {
  // 색 코드 제거(ESC [ … m)
  const s = String(text).replace(new RegExp(String.fromCharCode(27) + '\\[[0-9;]*m', 'g'), '')
  const pw = s.match(/(\d+) passed[^\n]*/)
  const vt = s.match(/Tests\s+(?:(\d+) failed \| )?(\d+) passed(?: \| (\d+) skipped)?/)
  if (vt) return { passed: Number(vt[2]), failed: Number(vt[1] ?? 0), skipped: Number(vt[3] ?? 0) }
  const nt = s.match(/ℹ pass (\d+)[\s\S]*?ℹ fail (\d+)[\s\S]*?ℹ skipped (\d+)/)
  if (nt) return { passed: Number(nt[1]), failed: Number(nt[2]), skipped: Number(nt[3]) }
  if (pw) return { passed: Number(pw[1]), failed: Number(s.match(/(\d+) failed/)?.[1] ?? 0), skipped: Number(s.match(/(\d+) skipped/)?.[1] ?? 0) }
  return null
}

/** e2e 결과를 goal-check 가 읽는 로컬 증거로(CI 판독과 같은 모양) */
export function writeLocalEvidence(criterionId, result, head, { dir = localEvidenceDir(), now = () => new Date().toISOString() } = {}) {
  fs.mkdirSync(dir, { recursive: true })
  const rec = {
    at: now(), source: 'local-integrate', run_id: `local-${head.slice(0, 9)}-${Date.now()}`, head_sha: head, found: true, log_read: !!result.counts,
    skipped_inner: false, conclusion: result.ok ? 'success' : 'failure', test_passed: result.counts?.passed ?? 0, test_skipped: result.counts?.skipped ?? null,
    marker: result.counts ? `${result.counts.passed} passed · ${result.counts.skipped} skipped` : null, ms: result.ms,
  }
  const f = path.join(dir, `${criterionId}--${head.slice(0, 12)}--${rec.at.replace(/[:.]/g, '-')}.json`)
  fs.writeFileSync(f, JSON.stringify(rec, null, 2))
  return f
}

/** 통합 — 통합 worktree 가 깨끗하고 병합이 충돌 없을 때만. 충돌이면 되돌리고 실패 */
export function integrate({ integrationGit, head, message }) {
  if (integrationGit('status', '--porcelain', '--untracked-files=no')) return { ok: false, why: '통합 worktree 에 커밋 안 된 변경이 있다 — 손대지 않는다' }
  try {
    integrationGit('merge', '--no-ff', '--no-edit', '-m', message, head)
    return { ok: true, sha: integrationGit('rev-parse', 'HEAD') }
  } catch (e) {
    try { integrationGit('merge', '--abort') } catch { /* 병합이 시작되지 않음 */ }
    return { ok: false, why: `병합 충돌 · 실패: ${String(e.message).slice(0, 200)}` }
  }
}
