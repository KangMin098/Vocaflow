// lib/agentpid.mjs
//
// 잠금에 기록할 pid 는 이 CLI 가 아니라 **에이전트 프로세스**(claude / codex)다.
// CLI·셸은 명령이 끝나면 죽으므로, 그 pid 를 쓰면 잠금이 곧바로 「죽은 소유자」가 된다.
// 제품 저장소 agents/scripts/lock.mjs 와 같은 방식: 조상 프로세스 중 에이전트를 찾는다. 못 찾으면 null(호출자가 --pid 를 요구).

import { execFileSync } from 'node:child_process'

function processTable() {
  try {
    if (process.platform === 'win32') {
      const out = execFileSync('powershell.exe', ['-NoProfile', '-Command', 'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine | ConvertTo-Json -Compress'], {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        stdio: ['ignore', 'pipe', 'ignore'],
      })
      return JSON.parse(out).map((p) => ({ pid: p.ProcessId, ppid: p.ParentProcessId, name: p.Name ?? '', cmd: p.CommandLine ?? '' }))
    }
    const out = execFileSync('ps', ['-eo', 'pid=,ppid=,comm=,args='], { encoding: 'utf8' })
    return out
      .split('\n')
      .map((l) => l.trim().match(/^(\d+)\s+(\d+)\s+(\S+)\s*(.*)$/))
      .filter(Boolean)
      .map((m) => ({ pid: +m[1], ppid: +m[2], name: m[3], cmd: m[4] }))
  } catch {
    return []
  }
}

export function findAgentPid(agent) {
  if (!['claude', 'codex'].includes(agent)) return null
  const table = new Map(processTable().map((p) => [p.pid, p]))
  const nameRe = agent === 'codex' ? /^codex(\.exe)?$/i : /^claude(\.exe)?$/i
  const cmdRe = agent === 'codex' ? /[\\/]codex(\.exe|\.js)?(\s|"|$)|@openai[\\/]codex/i : /[\\/]claude(\.exe)?(\s|"|$)|@anthropic-ai[\\/]claude-code/i
  let cur = table.get(process.ppid)
  for (let i = 0; cur && i < 30; i++) {
    if (nameRe.test(cur.name) || (/^node(\.exe)?$/i.test(cur.name) && cmdRe.test(cur.cmd))) return cur.pid
    cur = table.get(cur.ppid)
  }
  return null
}
