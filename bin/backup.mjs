#!/usr/bin/env node
// bin/backup.mjs — LOCAL_FAST 원격 백업(일반 개발에서 유일하게 GitHub 를 쓰는 곳 · Work Bridge 제외)
//
//   node bin/backup.mjs                 # 하루 최대 1회(max_per_day) — 오늘 이미 했으면 건너뜀
//   node bin/backup.mjs --point <이름>  # 중요 복구 시점 추가 백업(하루 상한과 별개)
//   node bin/backup.mjs --verify        # 복구 가능 확인: 마지막 백업 ref 의 원격 sha = 기록 sha · 로컬에 그 커밋 있음
// 통합 브랜치를 **새 ref 이름**(<prefix>-YYYYMMDD · <prefix>-point-<이름>)으로 push 한다 — 기존 원격 ref 를 덮지 않는다(force 없음).
// 원격이 다르면 push 가 거절되고 그대로 실패로 기록한다. 백업 실패는 로컬 개발을 멈추지 않는다(exit 0 · 기록만).
import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { devConfig } from '../lib/devmode.mjs'
import { appendLog } from '../lib/fsutil.mjs'
import { p, root } from '../lib/paths.mjs'

const argv = process.argv.slice(2)
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined }
const cfg = devConfig()
const repo = cfg.integration_worktree
const git = (...a) => String(execFileSync('git', ['-C', repo, ...a], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 180_000 })).trim()
const file = path.join(root(), 'runtime', 'backup.json')
const log = (() => { try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return { backups: [] } } })()
const save = () => { fs.mkdirSync(path.dirname(file), { recursive: true }); fs.writeFileSync(file, JSON.stringify(log, null, 2)) }
const today = new Date().toISOString().slice(0, 10).replace(/-/g, '')

if (argv.includes('--verify')) {
  const last = [...log.backups].reverse().find((b) => b.ok)
  if (!last) { console.log(JSON.stringify({ ok: false, why: '성공한 백업 기록 없음' })); process.exit(1) }
  let remote = null
  try { remote = git('ls-remote', cfg.backup.remote, `refs/heads/${last.ref}`).split(/\s+/)[0] || null } catch (e) { remote = null }
  let local = false
  try { git('cat-file', '-e', `${last.sha}^{commit}`); local = true } catch { local = false }
  const ok = remote === last.sha && local
  appendLog(p.eventLog(), { at: new Date().toISOString(), event: 'backup.verify', ref: last.ref, ok })
  console.log(JSON.stringify({ ok, ref: last.ref, sha: last.sha, remote_sha: remote, local_commit: local, restore: `git fetch ${cfg.backup.remote} ${last.ref} && git switch -c restore-${last.ref.split('/').pop()} FETCH_HEAD` }))
  process.exit(ok ? 0 : 1)
}

const point = arg('--point')
if (point && !/^[a-z0-9][a-z0-9-]{1,40}$/.test(point)) { console.log(JSON.stringify({ ok: false, why: '복구 시점 이름은 소문자 · 숫자 · 하이픈 2~41자' })); process.exit(2) }
if (!point && log.backups.filter((b) => b.ok && b.day === today && !b.point).length >= cfg.backup.max_per_day) {
  console.log(JSON.stringify({ ok: true, skipped: true, why: `오늘(${today}) 정기 백업을 이미 했다 — 상한 ${cfg.backup.max_per_day}` }))
  process.exit(0)
}
const ref = point ? `${cfg.backup.ref_prefix}-point-${point}` : `${cfg.backup.ref_prefix}-${today}`
let sha = null
const rec = { at: new Date().toISOString(), day: today, point: point ?? null, ref, sha: null, ok: false, error: null }
try {
  sha = git('rev-parse', cfg.integration_branch)
  rec.sha = sha
  git('push', '-q', cfg.backup.remote, `${sha}:refs/heads/${ref}`)
  rec.ok = true
} catch (e) {
  rec.error = String(e.stderr || e.message).slice(0, 300)
}
log.backups.push(rec)
save()
appendLog(p.eventLog(), { at: rec.at, event: 'backup.push', ref, sha, ok: rec.ok, github_call: true })
console.log(JSON.stringify(rec))
process.exit(0)
