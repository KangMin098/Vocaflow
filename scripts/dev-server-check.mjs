// scripts/dev-server-check.mjs — verify the actual port owner before reporting local main as served.
import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const normalized = value => /^[a-z]:[\\/]/i.test(value)
  ? path.win32.normalize(value).replace(/[\\/]+$/, '').toLowerCase()
  : path.resolve(value)

export function checkDevServerOrigin({ mainWorktree, owner, listenerPids }) {
  const expected = /^[a-z]:[\\/]/i.test(mainWorktree)
    ? path.win32.join(mainWorktree, 'apps', 'web')
    : path.join(mainWorktree, 'apps', 'web')
  if (!owner || !Number.isInteger(owner.pid) || typeof owner.cwd !== 'string') return { ok: false, reason: 'missing_owner', expected }
  if (normalized(owner.cwd) !== normalized(expected)) return { ok: false, reason: 'wrong_directory', expected }
  const listeners = [...new Set(listenerPids)]
  if (listeners.length !== 1 || listeners[0] !== owner.pid) return { ok: false, reason: 'wrong_listener', expected }
  return { ok: true, pid: owner.pid, cwd: owner.cwd }
}

export function verifyLocalMainServer() {
  if (process.platform !== 'win32') throw new Error('The local main server check requires Windows Get-NetTCPConnection.')
  const config = JSON.parse(fs.readFileSync('D:/workspace/Vocaflow-AI-Control/config/dev-mode.json', 'utf8'))
  if (typeof config.main_worktree !== 'string') throw new Error('main_worktree is missing from dev-mode.json.')
  const ownerFile = path.join(config.main_worktree, 'apps/web/.next-dev/.dev-server-owner.json')
  const owner = fs.existsSync(ownerFile) ? JSON.parse(fs.readFileSync(ownerFile, 'utf8')) : null
  const output = execFileSync('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command',
    'Get-NetTCPConnection -LocalPort 3000 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess | ConvertTo-Json -Compress',
  ], { encoding: 'utf8', windowsHide: true }).trim()
  const pids = output ? JSON.parse(output) : []
  const result = checkDevServerOrigin({ mainWorktree: config.main_worktree, owner, listenerPids: Array.isArray(pids) ? pids : [pids] })
  if (!result.ok) throw new Error(`localhost:3000 is not verified as local main (${result.reason}); expected ${result.expected}. Check the running dev server before changing UI code.`)
  return result
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const result = verifyLocalMainServer()
    console.log(`PASS localhost:3000 -> ${result.cwd} (PID ${result.pid})`)
  } catch (error) {
    console.error(error.message)
    process.exitCode = 1
  }
}
