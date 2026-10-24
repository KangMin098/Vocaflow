// bin/worktree-reap.mjs — 끝난 작업의 Vocaflow 워크트리 자동 정리 (판정 규칙: lib/worktree-reap.mjs)
//
//   node bin/worktree-reap.mjs                      # 미리보기 — 지울 것 · 남길 이유만 출력
//   node bin/worktree-reap.mjs --apply              # 실제 삭제 (bin/main-sync.cmd 가 매일 부른다)
//   옵션: --idle-days N (기본 3) · --max N (한 번에 지울 상한, 기본 30)
//
// 삭제 직전에 같은 워크트리를 다시 판정한다(미리 고른 뒤 그 사이 누가 쓰기 시작했으면 남긴다).
// 폴더를 지운 뒤 `git worktree prune` — 브랜치·커밋은 저장소에 남아 `pnpm wt new` 로 다시 꺼낼 수 있다.
// 판정에 필요한 정보(프로세스 목록 · TASK 큐 · 워크트리 목록)를 하나라도 못 읽으면 아무것도 지우지 않는다.
// 실패는 기록만 하고 exit 0 — 일일 동기화를 막지 않는다.
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { devConfig } from '../lib/devmode.mjs'
import { appendLog } from '../lib/fsutil.mjs'
import { pidAlive } from '../lib/lock.mjs'
import { p, root } from '../lib/paths.mjs'
import { activeTaskWorktrees, activityAt, judgeWorktree, normPath, parseWorktreeList } from '../lib/worktree-reap.mjs'

const argv = process.argv.slice(2)
const apply = argv.includes('--apply')
const opt = (name, dflt) => {
  const i = argv.indexOf(name)
  if (i < 0) return dflt
  const n = Number(argv[i + 1])
  if (!Number.isFinite(n) || n < 0) {
    console.error(`${name} 는 0 이상의 수여야 한다`)
    process.exit(2)
  }
  return n
}
const idleMs = opt('--idle-days', 3) * 24 * 3_600_000
const maxRemove = opt('--max', 30)

const cfg = devConfig()
const repo = cfg.main_worktree ?? 'D:/workspace/Vocaflow-main-serving'
const git = (cwd, ...args) =>
  String(execFileSync('git', ['-C', cwd, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000, maxBuffer: 64 << 20 })).trimEnd()
const now = Date.now()
const rec = { at: new Date(now).toISOString(), apply, idle_days: idleMs / 86_400_000, removed: [], failed: [], kept: 0, candidates: 0, error: null }
const stateFile = path.join(root(), 'runtime', 'worktree-reap.json')

function finish() {
  if (apply) {
    let log = { runs: [] }
    try { log = JSON.parse(fs.readFileSync(stateFile, 'utf8')) } catch { /* 첫 실행 */ }
    log.runs = [...(log.runs || []), rec].slice(-60)
    fs.mkdirSync(path.dirname(stateFile), { recursive: true })
    fs.writeFileSync(stateFile, JSON.stringify(log, null, 2))
    appendLog(p.eventLog(), { at: rec.at, event: 'worktree.reap', removed: rec.removed.length, failed: rec.failed.length, error: rec.error })
  }
  console.log(JSON.stringify(rec, null, 2))
  process.exit(0)
}

function processCmdlines() {
  if (process.platform === 'win32') {
    // powershell 이 가끔 CLR 초기화에서 실패한다(HRESULT 0x80004005 · 2026-10-24 실측, 바로 재시도하면 성공).
    // 세 번 다 실패하면 던진다 — 프로세스 목록 없이는 아무것도 지우지 않는다.
    let last
    for (let attempt = 0; attempt < 3; attempt++) {
      try {
        const out = execFileSync(
          'powershell.exe',
          ['-NoProfile', '-NonInteractive', '-Command', 'Get-CimInstance Win32_Process | ForEach-Object { $_.CommandLine }'],
          { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 120_000, maxBuffer: 64 << 20, windowsHide: true },
        )
        const lines = String(out).split(/\r?\n/).filter(Boolean)
        if (lines.length) return lines
        last = new Error('프로세스 목록이 비었다')
      } catch (e) {
        last = e
      }
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 3_000)
    }
    throw new Error(`프로세스 목록을 못 읽었다 — 아무것도 지우지 않는다: ${String(last?.stderr || last?.message).slice(0, 160)}`)
  }
  return String(execFileSync('ps', ['-eo', 'args'], { encoding: 'utf8' })).split('\n').filter(Boolean)
}

const readOrNull = (f) => {
  try { return fs.readFileSync(f, 'utf8') } catch { return null }
}

try {
  const list = parseWorktreeList(git(repo, 'worktree', 'list', '--porcelain'))
  if (!list.length) throw new Error('워크트리 목록이 비었다')
  // 첫 항목 = 원본 저장소. main · integration · AI-Control 도 지우지 않는다.
  const protectedPaths = new Set([list[0].path, repo, cfg.integration_worktree, root()].filter(Boolean).map(normPath))
  const queueText = readOrNull(p.taskQueue())
  const activeTasks = queueText === null ? new Set() : activeTaskWorktrees(JSON.parse(queueText))
  const ctx = {
    protectedPaths,
    activeTasks,
    isMerged: (_wt, head) => {
      try { git(repo, 'merge-base', '--is-ancestor', head, 'main'); return true } catch { return false }
    },
    statusLines: (wt) => git(wt, 'status', '--porcelain=v1', '--ignored').split('\n').filter(Boolean),
    lastActivityAt: (wt) => {
      try { return activityAt(wt, git(wt, 'rev-parse', '--absolute-git-dir')) } catch { return now }
    },
    readFile: readOrNull,
    pidAlive,
    processCmdlines: processCmdlines(),
    mainEnvLocal: readOrNull(path.join(repo, 'apps', 'web', '.env.local')),
    now,
    idleMs,
  }

  const verdicts = list.map((wt) => judgeWorktree(wt, ctx))
  const chosen = verdicts.filter((v) => v.remove)
  rec.candidates = chosen.length
  rec.kept = verdicts.length - chosen.length
  if (!apply) {
    rec.preview = {
      remove: chosen.map((v) => v.path),
      keep: verdicts.filter((v) => !v.remove).map((v) => `${v.path} — ${v.reasons.join(' · ')}`),
    }
    finish()
  }

  for (const v of chosen.slice(0, maxRemove)) {
    // 다시 판정 — 미리 고른 뒤 누가 쓰기 시작했으면 남긴다.
    const fresh = parseWorktreeList(git(repo, 'worktree', 'list', '--porcelain')).find((w) => normPath(w.path) === normPath(v.path))
    if (!fresh) continue
    const again = judgeWorktree(fresh, { ...ctx, processCmdlines: processCmdlines(), now: Date.now() })
    if (!again.remove) {
      rec.failed.push({ path: v.path, why: `재판정에서 남김: ${again.reasons.join(' · ')}` })
      continue
    }
    try {
      // fs.rmSync 는 Windows 긴 경로(node_modules · 260자 초과)도 지운다 — git worktree remove 는 여기서 실패한다.
      fs.rmSync(v.path, { recursive: true, force: true, maxRetries: 3, retryDelay: 500 })
      rec.removed.push({ path: v.path, branch: v.branch })
    } catch (e) {
      rec.failed.push({ path: v.path, why: String(e.message).slice(0, 200) })
    }
  }
  if (rec.removed.length) git(repo, 'worktree', 'prune')
} catch (e) {
  rec.error = String(e.stderr || e.message).slice(0, 400)
}
finish()
