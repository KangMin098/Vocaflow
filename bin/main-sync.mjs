// bin/main-sync.mjs — 로컬 main(정본) → origin/main 일일 동기화(dev-mode.json development_policy.main_sync)
//
//   node bin/main-sync.mjs              # 미반영 커밋이 있을 때만 · 하루 1회 성공 상한
//   node bin/main-sync.mjs --dry-run    # 원격 쓰기 없이 할 일만 출력
// 순서: fetch → 앞선 커밋 수 확인 → sync/main-YYYYMMDD push(force 없음) → PR 1개 → CI 대기 →
//       scope 계약 생성 → safe-merge(VFC_DEV_MODE=GITHUB) → main-serving 이 잠금 없고 깨끗하면 병합 커밋 역동기화.
// 보호 규칙 · 필수 CI · safe-merge 게이트를 그대로 거친다. 실패는 기록만 하고 로컬 개발을 멈추지 않는다(exit 0).
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { devConfig } from '../lib/devmode.mjs'
import { appendLog } from '../lib/fsutil.mjs'
import { p, root } from '../lib/paths.mjs'

const argv = process.argv.slice(2)
const dryRun = argv.includes('--dry-run')
const cfg = devConfig()
const repo = cfg.main_worktree ?? 'D:/workspace/Vocaflow-main-serving'
const run = (cmd, args, opts = {}) => String(execFileSync(cmd, args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180_000, ...opts })).trim()
const git = (...a) => run('git', a)
const gh = (...a) => run('gh', a)
const file = path.join(root(), 'runtime', 'main-sync.json')
const log = (() => { try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return { runs: [] } } })()
const now = new Date()
const today = now.toISOString().slice(0, 10).replace(/-/g, '')
const rec = { at: now.toISOString(), day: today, branch: `sync/main-${today}`, pr: null, head: null, ahead: null, ok: false, step: 'start', error: null, back_sync: null }

function finish() {
  if (!dryRun) {
    log.runs.push(rec)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    fs.writeFileSync(file, JSON.stringify(log, null, 2))
    appendLog(p.eventLog(), { at: rec.at, event: 'main.sync', pr: rec.pr, head: rec.head, ok: rec.ok, step: rec.step, github_call: true })
  }
  console.log(JSON.stringify(rec))
  process.exit(0)
}

try {
  if (log.runs.some((r) => r.ok && r.day === today)) { rec.ok = true; rec.step = 'skipped: 오늘 이미 동기화함'; finish() }
  rec.step = 'fetch'
  git('fetch', '-q', 'origin')
  rec.head = git('rev-parse', 'main')
  rec.ahead = Number(git('rev-list', '--count', 'origin/main..main'))
  if (rec.ahead === 0) { rec.ok = true; rec.step = 'skipped: 미반영 커밋 없음'; finish() }
  if (dryRun) { rec.step = `dry-run: ${rec.ahead}커밋을 ${rec.branch} PR 로 반영 예정`; finish() }

  rec.step = 'push'
  git('push', '-q', 'origin', `${rec.head}:refs/heads/${rec.branch}`)

  rec.step = 'pr'
  const open = JSON.parse(gh('pr', 'list', '--head', rec.branch, '--state', 'open', '--json', 'number'))
  rec.pr = open[0]?.number ?? null
  const body = [
    `로컬 main(정본)을 origin/main 에 반영하는 일일 동기화 PR — \`bin/main-sync.mjs\` · 규칙 \`dev-mode.json\` \`main_sync\`.`,
    '',
    '## 검증',
    '- 각 커밋은 작성 세션이 영향 범위(L1~L4)로 로컬 검증한 뒤 로컬 main 에 통합했다.',
    '- 이 PR 은 필수 CI 전체와 safe-merge(범위 계약 · HEAD · DB 적용 이력 대조)를 통과해야 병합된다.',
    '',
    '🤖 Generated with [Claude Code](https://claude.com/claude-code)',
  ].join('\n')
  if (!rec.pr) {
    const url = gh('pr', 'create', '--base', 'main', '--head', rec.branch, '--title', `sync: 로컬 main → origin/main (${today})`, '--body', body)
    rec.pr = Number(url.split('/').pop())
  }

  rec.step = 'ci'
  try { run('gh', ['pr', 'checks', String(rec.pr), '--watch', '--interval', '60', '--required'], { timeout: 90 * 60_000 }) } catch (e) {
    throw new Error(`CI 실패 또는 시간 초과: ${String(e.stdout || e.message).split('\n').filter((l) => /fail/i.test(l)).slice(0, 5).join(' | ')}`)
  }

  rec.step = 'scope'
  git('fetch', '-q', 'origin')
  const base = git('rev-parse', 'origin/main')
  const pr = JSON.parse(gh('pr', 'view', String(rec.pr), '--json', 'headRefOid,commits'))
  const paths = git('diff', '--name-only', `${base}...${pr.headRefOid}`).split('\n').filter(Boolean)
  const scope = path.join(os.tmpdir(), `vfc-main-sync-${today}.json`)
  fs.writeFileSync(scope, JSON.stringify({ version: 1, base_ref: 'main', base_sha: base, head_sha: pr.headRefOid, expected_commits: pr.commits.length, expected_paths: paths }, null, 2))

  rec.step = 'safe-merge'
  run('node', ['agents/scripts/safe-merge.mjs', String(rec.pr), '--scope-file', scope], { env: { ...process.env, VFC_DEV_MODE: 'GITHUB' }, timeout: 10 * 60_000 })
  rec.ok = true

  rec.step = 'back-sync'
  git('fetch', '-q', 'origin')
  if (fs.existsSync(path.join(repo, '.agent-lock')) || git('status', '--porcelain')) {
    rec.back_sync = 'skipped: main-serving 잠금 또는 미커밋 변경 — 다음 작업 세션이 origin/main 을 합친다'
  } else {
    try {
      git('merge', '-q', '--no-ff', '-m', `merge: origin/main(PR #${rec.pr} 병합 커밋) 역동기화`, 'origin/main')
      rec.back_sync = git('rev-parse', '--short', 'HEAD')
    } catch (e) {
      try { git('merge', '--abort') } catch { /* 병합이 시작되지 않았으면 되돌릴 것도 없다 */ }
      rec.back_sync = `skipped: 역동기화 병합 실패(되돌림) — ${String(e.stderr || e.message).slice(0, 160)}`
    }
  }
  rec.step = 'done'
} catch (e) {
  rec.error = String(e.stderr || e.message).slice(0, 400)
}
finish()
