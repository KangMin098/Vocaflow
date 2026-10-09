#!/usr/bin/env node
// lib/supervise.mjs — 자식 프로세스(Claude/Codex CLI)의 수명을 부모(오케스트레이터)에 묶는 감독자
//
//   node supervise.mjs <parentPid> <pidFile> <exe> [args...]   (stdin → 자식 stdin, 자식 stdout/stderr → 그대로)
//
// 왜: Windows 에서는 부모가 강제 종료돼도 spawn 한 자식이 계속 산다. 그러면 오케스트레이터가 죽은 뒤 다음 실행이
// 그 작업의 잠금을 회수하고 같은 worktree 에 들어가는 동안 **이전 Claude 가 계속 쓰는** 경쟁이 생긴다(Codex 최종 리뷰 P1).
//   · 시작하면 pidFile 에 {supervisor, child, parent} 를 남긴다 — 복구는 child 가 살아 있으면 잠금을 회수하지 않는다.
//   · 1초마다 부모 생존을 확인하고, 부모가 죽으면 **자기가 띄운 자식 트리만** 끝낸다(taskkill /T /F · 다른 세션 프로세스는 건드리지 않는다).
//   · 자식이 끝나면 pidFile 에 exited 를 적고 같은 종료 코드로 끝난다.

import fs from 'node:fs'
import { spawn, execFileSync } from 'node:child_process'

const [parentArg, pidFile, exe, ...args] = process.argv.slice(2)
const parent = Number(parentArg)
const alive = (pid) => {
  try {
    process.kill(pid, 0)
    return true
  } catch (e) {
    return e.code === 'EPERM'
  }
}
const write = (extra) => {
  try {
    const prev = fs.existsSync(pidFile) ? JSON.parse(fs.readFileSync(pidFile, 'utf8')) : {}
    fs.writeFileSync(pidFile, JSON.stringify({ ...prev, ...extra, at: new Date().toISOString() }))
  } catch {
    /* 기록 실패는 감독을 멈추지 않는다 */
  }
}

// POSIX: detached 로 자식을 자기 프로세스 그룹의 리더로 만든다 — 그래야 kill(-pid) 가 손자까지 끝낸다(Windows 는 taskkill /T)
const child = spawn(exe, args, { stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, env: process.env, detached: process.platform !== 'win32' })
write({ supervisor: process.pid, child: child.pid, parent, exe })
// 부모가 죽으면 파이프가 끊긴다 — EPIPE 로 감독자가 먼저 죽으면 자식이 고아로 남으므로 오류를 삼키고 감시를 계속한다
for (const s of [process.stdin, process.stdout, process.stderr, child.stdin, child.stdout, child.stderr]) s.on('error', () => {})
process.stdin.pipe(child.stdin)
child.stdout.pipe(process.stdout)
child.stderr.pipe(process.stderr)
child.on('error', (e) => {
  write({ exited: true, error: e.message })
  process.exit(127)
})

function killTree(pid) {
  try {
    if (process.platform === 'win32') execFileSync('taskkill', ['/PID', String(pid), '/T', '/F'], { stdio: 'ignore' })
    else process.kill(-pid, 'SIGKILL')
  } catch {
    try {
      process.kill(pid, 'SIGKILL')
    } catch {
      /* 이미 끝났다 */
    }
  }
}

// 기한은 감독자가 직접 지킨다 — Windows 에서 spawnSync 시간 초과는 감독자를 강제 종료할 뿐 잡을 수 있는 신호를 주지 않는다
const deadlineMs = Number(process.env.VFC_SUPERVISE_TIMEOUT_MS || 0)
if (deadlineMs > 0) {
  setTimeout(() => {
    killTree(child.pid)
    write({ killed_because: `timeout ${deadlineMs}ms`, exited: true, timed_out: true })
    process.exit(124)
  }, deadlineMs).unref()
}

const timer = setInterval(() => {
  if (!alive(parent)) {
    killTree(child.pid)
    write({ killed_because: `parent ${parent} died`, exited: true })
    process.exit(137)
  }
}, 1000)

// 시간 초과 시 spawnSync 는 감독자에게 SIGTERM 을 보낸다 — 감독자만 죽고 자식이 남지 않게 자식 트리부터 끝낸다
for (const sig of ['SIGTERM', 'SIGINT', 'SIGHUP', 'SIGBREAK']) {
  try {
    process.on(sig, () => {
      killTree(child.pid)
      write({ killed_because: `supervisor got ${sig}`, exited: true })
      process.exit(143)
    })
  } catch {
    /* 이 플랫폼에 없는 신호 */
  }
}

// 'exit' 는 자식 stdout/stderr 가 닫히기 전에 올 수 있다 — 'close'(스트림까지 닫힘) 뒤, 전달 중인 출력을 비우고 끝낸다
child.on('close', (code, signal) => {
  clearInterval(timer)
  write({ exited: true, code, signal })
  const finish = () => process.exit(code ?? 1)
  process.stdout.write('', () => process.stderr.write('', finish))
})
