#!/usr/bin/env node
// bin/owner-worker.mjs — owner worker 실행기: 자기 owner 에게 배정된 작업을 인수(claim)해 owner 의 worktree 에서 구현하고 제출한다.
//
//   node bin/owner-worker.mjs --worker <worker_id> [--once] [--max-tasks N] [--json]
//
// 한 반복: heartbeat → 배정 작업(dispatch.to = 내 owner · READY · worktree 없음 또는 내 worktree) 선택 →
//          상태 뮤텍스 안에서 원자적 claim(startTask · accepted_at · generation) → implementStep(Claude · 범위 검사 · 증거) →
//          fencing(내 세대인지) → submitForReview. 리뷰·완료 판정은 중앙 오케스트레이터(Codex 독립 리뷰)가 한다.
// 멈춤: --once · 작업 수 상한 · runtime/STOP · 할 일 없음(--once 아닐 때는 30초마다 다시 본다 — 시간 상한 --minutes).
// 등록은 1회 사용자 대화형 터미널: node bin/vfc.mjs worker register --owner <o> --worktree <path> --branch <b>

import fs from 'node:fs'
import path from 'node:path'
import { execFileSync } from 'node:child_process'
import { withState, loadState } from '../lib/state.mjs'
import { p } from '../lib/paths.mjs'
import * as T from '../lib/tasks.mjs'
import * as W from '../lib/workers.mjs'
import * as UG from '../lib/usergoals.mjs'
import { goalMode } from '../lib/dispatch.mjs'
import { implementStep, DEFAULT_LIMITS } from '../lib/orchestrator.mjs'
import { runClaude, readClaudeReport } from '../lib/agents.mjs'

const argv = process.argv.slice(2)
const opt = {}
for (let i = 0; i < argv.length; i++) if (argv[i].startsWith('--')) opt[argv[i].slice(2)] = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true
const out = (o) => console.log(opt.json ? JSON.stringify(o, null, 2) : JSON.stringify(o))
const nowIso = () => new Date().toISOString()
const sleep = (ms) => Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, ms)
const git = (wt, args) => execFileSync('git', ['-C', wt, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()

function nextTask(state, w) {
  return state.taskQueue.tasks.find((t) => t.status === 'READY' && t.dispatch?.to === w.owner_id && t.owner_id === w.owner_id && goalMode(UG.ugState(state).goals[t.user_goal_id]) === 'owner_session' && (!t.worktree || t.worktree === w.worktree))
}

function main() {
  const wid = opt.worker
  if (!wid) throw new Error('--worker <worker_id> 가 필요하다')
  const deps = { runClaude: process.env.VFC_CLAUDE_CMD ? runClaude : runClaude, readClaudeReport }
  const maxTasks = Number(opt['max-tasks'] || 1)
  const until = Date.now() + Number(opt.minutes || 0) * 60_000
  const result = { worker: wid, claimed: [], submitted: [], skipped: [], stop: null }
  for (;;) {
    if (fs.existsSync(p.stopFile())) {
      result.stop = 'runtime/STOP'
      break
    }
    const w = withState((s) => W.heartbeat(s, wid, { pid: process.pid, status: 'idle' }), { event: 'worker.heartbeat', worker: wid, by: wid })
    if (result.claimed.length >= maxTasks) {
      result.stop = `작업 수 상한 ${maxTasks}`
      break
    }
    const cand = nextTask(loadState().state, w)
    if (!cand) {
      if (opt.once || Date.now() >= until) {
        result.stop = '할 일 없음'
        break
      }
      sleep(30_000)
      continue
    }
    // 원자적 claim — 다른 worker·세션이 먼저 잡았으면 여기서 거부된다
    let claim
    try {
      claim = withState((s, ctx) => {
        const t = s.taskQueue.tasks.find((x) => x.task_id === cand.task_id)
        if (!t.worktree) Object.assign(t, { worktree: w.worktree, branch: w.branch })
        t.orchestration.rounds = (t.orchestration.rounds || 0) + 1
        const started = T.startTask(s, t.task_id, { owner_id: w.owner_id, session: { label: wid, agent: 'claude', pid: process.pid }, pid: process.pid, worker_id: wid }, ctx)
        try {
          started.run.start_head = git(w.worktree, ['rev-parse', 'HEAD'])
        } catch {
          started.run.start_head = null
        }
        W.heartbeat(s, wid, { pid: process.pid, status: 'busy', active_task: t.task_id })
        return { task_id: t.task_id, generation: started.run.generation, round: t.orchestration.rounds }
      }, { event: 'worker.claim', worker: wid, by: wid })
    } catch (e) {
      result.skipped.push({ task_id: cand.task_id, why: `${e.code ?? 'ERROR'}: ${String(e.message).slice(0, 160)}` })
      if (opt.once) break
      continue
    }
    result.claimed.push(claim)
    // 실행 기록(오케스트레이터 run 과 구분되는 worker run) — implementStep 의 이벤트가 여기에 남는다
    const runId = `worker-${wid}-${nowIso().replace(/[-:.]/g, '').slice(0, 15)}`
    withState((s) => {
      s.orchestrator.runs[runId] = { run_id: runId, kind: 'worker', worker_id: wid, pid: process.pid, started_at: nowIso(), status: 'worker', phase: 'start', task_id: claim.task_id, cost_usd: 0, events: [], tasks_done: [], limits: DEFAULT_LIMITS }
    }, { event: 'worker.run', run: runId, by: wid })
    const task = loadState().state.taskQueue.tasks.find((t) => t.task_id === claim.task_id)
    const limits = UG.limitsFor(loadState().state, task, { ...DEFAULT_LIMITS })
    const impl = implementStep({ runId, task, round: claim.round, findings: null, limits, deps })
    if (impl.cause) {
      withState((s, ctx) => T.blockTask(s, claim.task_id, { caller: w.owner_id, reason: `${impl.cause}: ${String(impl.detail || '').slice(0, 300)}` }, ctx), { event: 'task.block', task: claim.task_id, by: wid })
      result.skipped.push({ task_id: claim.task_id, why: `구현 실패 ${impl.cause}` })
    } else {
      // fencing — 그 사이 다른 세대가 작업을 가져갔으면 제출하지 않는다
      const ok = withState((s, ctx) => {
        const t = s.taskQueue.tasks.find((x) => x.task_id === claim.task_id)
        if (t.status !== 'IN_PROGRESS' || t.run?.worker_id !== wid || t.run?.generation !== claim.generation) return false
        T.submitForReview(s, claim.task_id, { caller: w.owner_id }, ctx)
        return true
      }, { event: 'worker.submit', worker: wid, by: wid })
      if (ok) result.submitted.push({ task_id: claim.task_id, head: impl.head })
      else result.skipped.push({ task_id: claim.task_id, why: 'fencing — 세대가 바뀌어 제출하지 않음' })
    }
    withState((s) => {
      W.heartbeat(s, wid, { pid: process.pid, status: 'idle', active_task: null })
      Object.assign(s.orchestrator.runs[runId], { status: 'done', ended_at: nowIso() })
    }, { event: 'worker.done', worker: wid, by: wid })
    if (opt.once) break
  }
  try {
    withState((s) => W.heartbeat(s, wid, { pid: null, status: 'offline', active_task: null }), { event: 'worker.offline', worker: wid, by: wid })
  } catch {
    /* 해지된 worker */
  }
  out(result)
}

try {
  main()
} catch (e) {
  console.error(`거부 [${e.code ?? 'ERROR'}] ${e.message}`)
  process.exit(2)
}
