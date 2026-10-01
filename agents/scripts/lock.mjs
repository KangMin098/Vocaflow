#!/usr/bin/env node
// agents/scripts/lock.mjs
//
// 워크트리 쓰기 잠금 — 같은 워크트리를 두 에이전트가 동시에 쓰지 않게 한다(A5).
//
//   node agents/scripts/lock.mjs acquire <agent> [--pid N] [--force]
//       잡기. 남이 살아서 쥐고 있으면 exit 3 — **이름이 같은 다른 세션도 남이다**(DD-53 보완).
//       같은 pid 의 재획득만 갱신이다. --force 는 사용자가 인수를 지시한 경우만.
//   node agents/scripts/lock.mjs release <agent> [--pid N] [--force]   # 놓기. 이름·pid 가 다른 살아 있는 잠금이면 exit 3 (--force 는 사용자 지시 시만)
//   node agents/scripts/lock.mjs status                      # 보기 (항상 exit 0)
//
// 잠금 파일: <워크트리>/.agent-lock  {agent, pid, host, branch, started_at}  (gitignore)
// pid 는 이 스크립트가 아니라 **에이전트 프로세스**다 — 스크립트·셸은 명령이 끝나면 죽으므로 조상 프로세스에서
// claude / codex 를 찾아 기록한다. 못 찾으면 --pid 로 넘긴다.
// 고아 잠금: 같은 호스트에서 pid 가 죽었거나, 시작 후 TTL(기본 12시간)이 지났으면 자동 해제 후 잡는다.

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import { currentBranch, isMain, rel } from './lib.mjs'

export const LOCK_FILE = process.env.AGENT_LOCK_FILE || rel('.agent-lock')
const TTL_MS = Number(process.env.AGENT_LOCK_TTL_MS || 12 * 3600 * 1000)

export function alive(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}

function processTable() {
  try {
    if (process.platform === 'win32') {
      const out = execFileSync(
        'powershell.exe',
        ['-NoProfile', '-Command', 'Get-CimInstance Win32_Process | Select-Object ProcessId,ParentProcessId,Name,CommandLine | ConvertTo-Json -Compress'],
        { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] },
      )
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

/** 조상 중 에이전트 프로세스. 이름으로 먼저, node 로 도는 경우 명령줄로 가린다(임시 경로의 "claude" 문자열에 속지 않게). */
export function findAgentPid(agent) {
  const table = new Map(processTable().map((p) => [p.pid, p]))
  const want = agent === 'codex' ? /codex/i : /claude/i
  let cur = table.get(process.ppid)
  for (let hops = 0; cur && hops < 30; hops++) {
    const base = cur.name.replace(/\.exe$/i, '').toLowerCase()
    if ((base === 'claude' || base === 'codex') && want.test(base)) return cur.pid
    if (base === 'node' && (agent === 'codex' ? /@openai[\\/]codex|[\\/]codex(\.js)?\b/i : /claude-code|[\\/]claude(\.js|\.mjs)?\b/i).test(cur.cmd))
      return cur.pid
    cur = table.get(cur.ppid)
  }
  return null
}

export function read() {
  try {
    return JSON.parse(fs.readFileSync(LOCK_FILE, 'utf8'))
  } catch {
    return null
  }
}

/** @returns {'free'|'held'|'orphan'} */
export function state(lock) {
  if (!lock) return 'free'
  if (Date.now() - Date.parse(lock.started_at) > TTL_MS) return 'orphan'
  if (lock.host === os.hostname() && !alive(lock.pid)) return 'orphan'
  return 'held'
}

// ── 보조 잠금(mutex) ─────────────────────────────────────────────
// 「읽기 → 판정 → (고아) 삭제 → 생성」 을 한 번에 한 세션만 지나가게 한다. 옛 판은 두 세션이 같은 고아 잠금을 읽고,
// 한쪽이 지우고 새로 잡은 뒤 다른 쪽이 낡은 판단으로 **새 잠금을 지우고** 자기도 잡았다(wx 는 이미 지워진 뒤라 못 막는다 ·
// Codex 리뷰 2026-10-01).
// 남은 보조 잠금을 **자동으로 지우지 않는다.** 「오래됐으니 지운다」는 판단도 두 세션이 동시에 하면 한쪽이 새로 만든
// 보조 잠금을 다른 쪽이 지운다(같은 모양의 경쟁 · Codex 재리뷰). 보조 잠금은 수 ms 만 쥐므로 남아 있다면 그 사이 프로세스가
// 죽은 드문 경우다 — 주인 pid 상태와 경로를 알려 주고 사람이 확인해 지운다.
const MUTEX = `${LOCK_FILE}.mutex`
const MUTEX_WAIT_MS = Number(process.env.AGENT_LOCK_MUTEX_WAIT_MS || 3000)
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)

function withMutex(fn) {
  const deadline = Date.now() + MUTEX_WAIT_MS
  for (;;) {
    try {
      fs.writeFileSync(MUTEX, String(process.pid), { flag: 'wx' })
      break
    } catch (e) {
      if (e.code !== 'EEXIST') throw e
      if (Date.now() > deadline) {
        let owner = NaN
        try {
          owner = Number(fs.readFileSync(MUTEX, 'utf8'))
        } catch {}
        const dead = Number.isInteger(owner) && owner > 0 && !alive(owner)
        return {
          ok: false,
          code: 3,
          msg: dead
            ? `잠금 처리 중 멈춘 흔적이 있다(보조 잠금 주인 pid ${owner} 는 죽었다) — 다른 세션이 잠금을 다루는 중이 아님을 확인한 뒤 ${MUTEX} 를 지우고 다시 시도`
            : `잠금 처리 중인 다른 세션이 있다(pid ${Number.isFinite(owner) ? owner : '?'}) — 잠시 뒤 다시 시도`,
        }
      }
      sleep(50)
    }
  }
  try {
    return fn()
  } finally {
    fs.rmSync(MUTEX, { force: true })
  }
}

/** 잠금 주인 pid 로 쓸 수 있는가 — 양의 정수이고 살아 있어야 한다(죽었거나 엉터리면 곧바로 고아가 된다). */
export function validOwnerPid(pid) {
  return Number.isInteger(pid) && pid > 0 && alive(pid)
}

export function acquire(agent, pid, force = false) {
  if (!validOwnerPid(pid))
    return {
      ok: false,
      code: 64,
      msg: `잠금 주인 pid 가 유효하지 않다(${pid}) — 살아 있는 에이전트 프로세스의 pid 를 --pid 로 준다. 짧게 사는 셸 pid 로 잡으면 곧 「고아」가 되어 남이 가져간다`,
    }
  return withMutex(() => acquireLocked(agent, pid, force))
}

function acquireLocked(agent, pid, force) {
  const cur = read()
  const st = state(cur)
  if (st === 'held' && cur.agent !== agent && !force)
    return { ok: false, code: 3, msg: `잠금 중: ${cur.agent} (pid ${cur.pid}, ${cur.branch}, ${cur.started_at}) — 읽기 전용으로만 일할 것` }
  // ⚠️ **이름이 같다고 같은 세션이 아니다.** 옛 판은 `cur.agent === agent` 면 무조건 갱신해서,
  //    claude 세션 둘이 같은 워크트리를 동시에 쓰는 것을 잠금이 **허용**했다(2026-09-20 실측:
  //    pid 21452 가 main 에서 쥐고 있는 잠금을 pid 5772 가 그대로 가져갔다). DD-53 보완.
  //    pid 가 다르고 그 pid 가 살아 있으면(또는 다른 호스트라 확인할 수 없으면) 거부한다.
  //    죽은 pid 는 state() 가 이미 'orphan' 으로 돌려 자동 해제되므로 여기 오지 않는다.
  if (st === 'held' && cur.agent === agent && cur.pid !== pid && !force)
    return {
      ok: false,
      code: 3,
      msg:
        `잠금 중: 같은 이름의 **다른 세션** ${cur.agent} (pid ${cur.pid}, ${cur.branch}, ${cur.started_at}) 이 살아 있다 — 읽기 전용으로만 일할 것.\n` +
        `병행하려면 \`pnpm wt new <suffix>\` 로 워크트리를 따로 쓴다. 사용자가 인수를 지시했으면 --force.`,
    }
  const notes = []
  if (st === 'orphan') {
    notes.push(`고아 잠금 해제: ${cur.agent} pid ${cur.pid} (${cur.started_at})`)
    fs.rmSync(LOCK_FILE, { force: true })
  } else if (st === 'held') {
    fs.rmSync(LOCK_FILE, { force: true })
    notes.push(cur.pid === pid ? '같은 세션 — 잠금 갱신' : `사용자 지시(--force) 로 인수: ${cur.agent} pid ${cur.pid}`)
  }
  const lock = { agent, pid, host: os.hostname(), branch: currentBranch(), started_at: new Date().toISOString() }
  try {
    fs.writeFileSync(LOCK_FILE, JSON.stringify(lock, null, 2) + '\n', { flag: 'wx' })
  } catch (e) {
    if (e.code === 'EEXIST') return { ok: false, code: 3, msg: `잠금 경쟁에서 짐: ${read()?.agent ?? '?'} 이 먼저 잡았다` }
    throw e
  }
  return { ok: true, code: 0, msg: [...notes, `잠금 획득: ${agent} (pid ${pid}, ${lock.branch})`].join('\n'), lock }
}

/**
 * 놓기 — 살아 있는 잠금은 **이름과 pid 가 모두** 같은 주인만 놓는다. 옛 판은 이름만 봐서, 같은 이름의 다른 세션
 * (acquire 를 거절당한 세션 포함)이 남의 잠금을 지웠다(Codex 리뷰 2026-10-01). 고아 잠금은 누구나 치울 수 있다.
 * pid = 부른 쪽 에이전트 pid(못 찾으면 null — 주인임을 증명하지 못하니 놓지 않는다).
 */
export function release(agent, pid, force = false) {
  return withMutex(() => {
    const cur = read()
    if (!cur) return { ok: true, code: 0, msg: '잠금 없음' }
    if (!force && state(cur) === 'held') {
      if (cur.agent !== agent) return { ok: false, code: 3, msg: `남의 잠금이다: ${cur.agent}. 놓지 않는다(사용자 지시가 있으면 --force)` }
      if (cur.pid !== pid)
        return {
          ok: false,
          code: 3,
          msg: `같은 이름의 **다른 세션** 잠금이다: ${cur.agent} pid ${cur.pid} (부른 쪽 pid ${pid ?? '확인 못 함'}). 놓지 않는다 — 주인이면 --pid ${cur.pid}, 사용자 지시가 있으면 --force`,
        }
    }
    fs.rmSync(LOCK_FILE, { force: true })
    return { ok: true, code: 0, msg: `잠금 해제: ${cur.agent}` }
  })
}

function main() {
  const [cmd, agent] = process.argv.slice(2)
  const flag = (n) => {
    const i = process.argv.indexOf(n)
    return i === -1 ? undefined : process.argv[i + 1]
  }
  // 에이전트 pid — --pid 가 있으면 그것(검증은 acquire 가), 없으면 조상에서 찾는다. 못 찾아도 셸 pid(process.ppid)로
  // 떨어지지 않는다: 셸은 명령이 끝나면 죽어 잠금이 곧 고아가 된다(Codex 리뷰 2026-10-01).
  // AGENT_LOCK_DISCOVERY=off 는 탐색 실패를 흉내 내는 회귀용.
  const discovered = () => (process.env.AGENT_LOCK_DISCOVERY === 'off' ? null : findAgentPid(agent))
  const pidArg = flag('--pid')
  const callerPid = pidArg !== undefined ? Number(pidArg) : discovered()
  let r
  if (cmd === 'acquire' && agent) {
    r =
      callerPid === null
        ? { ok: false, code: 64, msg: `에이전트(${agent}) 프로세스를 찾지 못했다 — 살아 있는 에이전트 pid 를 --pid 로 준다(셸 pid 로 잡지 않는다)` }
        : acquire(agent, callerPid, process.argv.includes('--force'))
  } else if (cmd === 'release' && agent) {
    r = release(agent, callerPid, process.argv.includes('--force'))
  } else if (cmd === 'status') {
    const cur = read()
    const st = state(cur)
    r = { code: 0, msg: st === 'free' ? '잠금 없음' : `${st === 'held' ? '잠금 중' : '고아(다음 acquire 때 해제)'}: ${JSON.stringify(cur)}` }
  } else {
    console.error('사용: lock.mjs acquire|release <agent> [--pid N] [--force] · lock.mjs status')
    process.exit(64)
  }
  ;(r.code ? console.error : console.log)(r.msg)
  process.exit(r.code)
}

if (isMain(import.meta.url)) main()
