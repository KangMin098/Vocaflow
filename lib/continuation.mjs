// lib/continuation.mjs — 중단된 자기 작업의 정확한 바이트만 재개한다. 정리·되돌리기 없음.
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { execFileSync } from 'node:child_process'
import { normalizeWorktree } from './paths.mjs'
import { pathRisk } from './policy.mjs'

const sha = (x) => crypto.createHash('sha256').update(x).digest('hex')
export function captureContinuation(task) {
  const wt = normalizeWorktree(task.worktree)
  const git = (...args) => execFileSync('git', ['-C', wt, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })
  const rows = git('status', '--porcelain', '-z', '--untracked-files=all').split('\0').filter(Boolean)
  const files = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]; files.push(row.slice(3))
    if (/[RC]/.test(row.slice(0, 2))) files.push(rows[++i])
  }
  const changes = [...new Set(files.filter((f) => f && f !== '.agent-goal.md' && !f.startsWith('.vfc-runs/')))].sort().map((file) => {
    const full = path.resolve(wt, file)
    const real = normalizeWorktree(fs.existsSync(full) ? full : path.dirname(full))
    if (real !== wt && !real.startsWith(wt + '/') || pathRisk(file) === 'HIGH') throw new Error('Unsafe continuation path')
    return { file, sha256: fs.existsSync(full) ? sha(fs.readFileSync(full)) : null }
  })
  return { head: git('rev-parse', 'HEAD').trim(), contract_sha256: sha(JSON.stringify([task.allowed_paths, task.forbidden_paths, task.acceptance])), files: changes }
}
export function continuationMatches(task) {
  if (!task.continuation) return false
  try {
    const current = captureContinuation(task)
    return current.head === task.continuation.head && current.contract_sha256 === task.continuation.contract_sha256 && JSON.stringify(current.files) === JSON.stringify(task.continuation.files)
  } catch { return false }
}
