#!/usr/bin/env node
// bin/remote-track.mjs — 공식 원격 통합 큐(로컬 개발과 분리 · lib/remote.mjs)
//
//   node bin/remote-track.mjs set <task> --pr 303 --head <sha> --status CI_PENDING --by <owner> [--note …]
//   node bin/remote-track.mjs board [--json]          # 작업마다 로컬 상태 | 원격 상태
//   node bin/remote-track.mjs refresh <task> --by <owner>   # 공식 PR 의 CI 결과만 읽어 반영(gh 읽기 · 공식 통합 경로에서만)
// refresh 는 CI 를 다시 돌리거나 통과로 바꾸지 않는다. 성공이어도 REMOTE_REVIEW(리뷰 · safe-merge 대기)까지만 — MERGE_READY 는 독립 수용 뒤 사람이 아니라
// 기록 주체가 명시적으로 set 한다. 이 명령의 결과는 다음 작업 선정 · 로컬 통합의 입력이 아니다.
import { execFileSync } from 'node:child_process'

import { assertRemoteAllowed } from '../lib/devmode.mjs'

import { loadRemote, setRemote, statusBoard } from '../lib/remote.mjs'
import { loadState } from '../lib/state.mjs'

const [cmd, task, ...rest] = process.argv.slice(2)
const argv = [task, ...rest]
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined }
const json = argv.includes('--json')

if (cmd === 'set') {
  const e = setRemote(task, { pr: Number(arg('--pr')), head: arg('--head'), status: arg('--status'), note: arg('--note') ?? null, by: arg('--by') })
  console.log(JSON.stringify(e))
} else if (cmd === 'board') {
  const rows = statusBoard(loadState().state.taskQueue.tasks.filter((t) => !['FAILED'].includes(t.status) || loadRemote().entries[t.task_id]))
  if (json) console.log(JSON.stringify(rows, null, 2))
  else for (const r of rows) console.log(`${r.task_id.padEnd(7)} ${r.local.padEnd(17)} ${r.remote.padEnd(14)} ${r.pr ? `#${r.pr}` : ''} ${r.head ? String(r.head).slice(0, 9) : ''}`)
} else if (cmd === 'refresh') {
  const cur = loadRemote().entries[task]
  if (!cur?.pr) { console.log(JSON.stringify({ ok: false, why: `${task} 는 공식 PR 에 제출되지 않았다` })); process.exit(2) }
  assertRemoteAllowed('official', 'gh pr view') // 공식 통합 큐 판독 — LOCAL_FAST 에서도 허용되는 유일한 gh 판독
  const pr = JSON.parse(String(execFileSync('gh', ['pr', 'view', String(cur.pr), '--json', 'state,headRefOid,statusCheckRollup'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] })))
  const checks = pr.statusCheckRollup ?? []
  const concl = (c) => String(c.conclusion ?? c.state ?? '').toUpperCase()
  let status
  if (pr.state === 'MERGED') status = 'MERGED'
  else if (!String(pr.headRefOid).startsWith(String(cur.head).slice(0, 7))) status = 'CI_PENDING'
  else if (checks.some((c) => ['FAILURE', 'CANCELLED', 'TIMED_OUT', 'ERROR', 'ACTION_REQUIRED'].includes(concl(c)))) status = 'CI_FAILED'
  else if (!checks.length || checks.some((c) => !['SUCCESS', 'SKIPPED', 'NEUTRAL'].includes(concl(c)))) status = 'CI_PENDING'
  else status = cur.status === 'MERGE_READY' ? 'MERGE_READY' : 'REMOTE_REVIEW'
  const e = setRemote(task, { pr: cur.pr, head: pr.headRefOid, status, note: `refresh · checks ${checks.length}`, by: arg('--by') })
  console.log(JSON.stringify({ task_id: task, pr: cur.pr, head: e.head, status: e.status }))
} else {
  console.error('사용: remote-track.mjs set|board|refresh …')
  process.exit(1)
}
