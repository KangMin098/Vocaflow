// lib/tool-scope.mjs — 자동 Claude의 파일·셸 쓰기를 작업 경계에서 거부한다.
import fs from 'node:fs'
import path from 'node:path'
import { normalizeWorktree } from './paths.mjs'
import { pathInScope } from './tasks.mjs'

function realDestination(file) {
  const tail = []
  let dir = path.resolve(file)
  while (!fs.existsSync(dir)) {
    const parent = path.dirname(dir)
    if (parent === dir) throw new Error('Cannot resolve destination')
    tail.unshift(path.basename(dir)); dir = parent
  }
  return normalizeWorktree(path.join(fs.realpathSync.native(dir), ...tail))
}

export function checkToolScope(event, scope) {
  const root = normalizeWorktree(scope.worktree)
  const input = event.tool_input || {}
  const inside = (file) => {
    const resolved = realDestination(path.resolve(scope.worktree, file))
    return resolved === root || resolved.startsWith(root + '/')
  }
  const writable = (file) => {
    const resolved = realDestination(path.resolve(scope.worktree, file))
    if ((scope.report_files || []).some((f) => realDestination(f) === resolved)) return true
    if (!inside(file)) return false
    const rel = resolved.slice(root.length + 1)
    // NTFS paths are case-insensitive; normalize patterns together with the real
    // path, otherwise exact paths such as docs/DECISIONS.md are falsely denied.
    const patterns = (globs) => process.platform === 'win32' ? globs.map((g) => g.toLowerCase()) : globs
    return (rel.startsWith('.vfc-runs/') || pathInScope(rel, patterns(scope.allowed_paths))) && !pathInScope(rel, patterns(scope.forbidden_paths))
  }
  try {
    if (event.cwd && normalizeWorktree(event.cwd) !== root) return 'Tool cwd is outside the task worktree'
    if (['Edit', 'Write', 'NotebookEdit'].includes(event.tool_name)) {
      if (scope.read_only) return 'Read-only execution cannot edit files'
      const file = input.file_path || input.notebook_path
      return typeof file === 'string' && writable(file) ? null : 'Write destination is outside the task contract'
    }
    if (event.tool_name !== 'Bash') return null
    const command = String(input.command || '')
    // Compound commands, redirection, shell substitutions and cwd changes cannot be
    // attributed safely. Run tests directly; save their output using Write.
    if (/[;&|<>`$\r\n]/.test(command)) return 'Run one allowlisted command without shell expansion or redirection'
    const tokens = command.match(/"[^"\n]*"|'[^'\n]*'|[^\s]+/g)?.map((s) => s.replace(/^(['"])(.*)\1$/, '$2')) || []
    const verb = tokens[0]
    const git = verb === 'git' && ['status', 'diff', 'log', 'show', 'rev-parse', 'add', 'commit'].includes(tokens[1])
    const node = verb === 'node' && ['--test', '--check'].includes(tokens[1])
    const prefix = verb === 'pnpm' && tokens[1] === '--filter' && tokens[2] === 'web'
    const browser = prefix && tokens[3] === 'exec' && tokens[4] === 'playwright' && tokens[5] === 'test'
    const harness = prefix && tokens[3] === 'exec' && tokens[4] === 'tsx' && /^scripts\/build-[\w-]+-harness\.mts$/.test(tokens[5] || '') && writable('apps/web/' + tokens[5])
    if (browser) {
      const files = tokens.slice(6).filter((t) => /^tests\//.test(t))
      if (!files.length || files.some((t) => !t.startsWith('tests/e2e-isolated/') || !writable('apps/web/' + t))) return 'Browser verification requires explicit in-scope isolated specs'
      const configAt = tokens.indexOf('--config')
      if (tokens.includes('--ui') || tokens.includes('--update-snapshots') || tokens.some((t) => t.startsWith('--config=')) || configAt < 0 || tokens[configAt + 1] !== 'playwright.isolated.config.ts') return 'Use the fixed isolated Playwright config without snapshot updates'
    }
    const pnpm = prefix && (['typecheck', 'lint'].includes(tokens[3]) || tokens[3] === 'exec' && ['vitest', 'eslint', 'tsc'].includes(tokens[4]) || browser || harness)
    const mkdir = command === 'mkdir -p .vfc-runs'
    if (!git && !node && !pnpm && !mkdir) return 'Command is outside the automated allowlist'
    if (scope.read_only && (git && ['add', 'commit'].includes(tokens[1]) || mkdir)) return 'Read-only execution cannot mutate Git or files'
    if (git && tokens[1] === 'commit' && (!tokens.includes('--only') || tokens.includes('--amend') || tokens.includes('--no-verify'))) return 'Commit requires explicit --only paths and normal hooks'
    for (const token of tokens.slice(1)) {
      if (token.startsWith('-')) {
        // Reject file/config/cwd-bearing option forms, including equals variants.
        if (/^(?:--(?:git-dir|work-tree|output|dir|prefix)|-C)(?:=|$)/.test(token) || /^--config(?:=|$)/.test(token) && !browser) return 'Command cannot redirect its worktree/config/output'
        continue
      }
      if ((/^[a-zA-Z]:[\\/]|^[/\\]|(?:^|[/\\])\.\.(?:[/\\]|$)/.test(token)) && !inside(token)) return 'Command path escapes the task worktree'
    }
    if (git && tokens[1] === 'add') {
      const files = tokens.slice(2).filter((t) => t !== '--')
      if (!files.length || files.some((t) => t.startsWith('-') || /[*?]/.test(t) || !writable(t) || fs.existsSync(path.resolve(scope.worktree, t)) && fs.statSync(path.resolve(scope.worktree, t)).isDirectory())) return 'Stage explicit in-scope files only'
    }
    if (git && tokens[1] === 'commit') {
      const at = tokens.indexOf('--only') + 1
      const files = tokens.slice(at, tokens.findIndex((t, i) => i >= at && t.startsWith('-')) < 0 ? tokens.length : tokens.findIndex((t, i) => i >= at && t.startsWith('-')))
      if (!files.length || tokens.includes('-a') || tokens.includes('--all') || files.some((t) => /[*?]/.test(t) || !writable(t) || fs.existsSync(path.resolve(scope.worktree, t)) && fs.statSync(path.resolve(scope.worktree, t)).isDirectory())) return 'Commit explicit in-scope files only'
    }
    return null
  } catch { return 'Scope could not be verified; operation refused' }
}
