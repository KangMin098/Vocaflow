#!/usr/bin/env node
// bin/local-integrate.mjs — LOCAL_FAST 로컬 통합(safe-merge 대체 · GitHub 호출 없음)
//
//   node bin/local-integrate.mjs --task T-0048 [--e2e] [--dry-run] [--json]
// 순서: 정적 게이트(커밋 · 리뷰 · 정렬 · 승인 · 보안) → 검증 커밋에서 타입 · lint · 관련 테스트(+e2e) 병렬 재실행 → HEAD 불변 재확인 →
//       통합 worktree(config/dev-mode.json integration_branch)에 --no-ff 병합 → verification/local/ 기록 · 이벤트.
// 실패하면 무엇도 병합하지 않는다. 통합 worktree 가 더러우면 손대지 않는다. DB · 데이터 삭제는 승인형 DB 러너 몫(여기서 적용하지 않는다).
import fs from 'node:fs'
import path from 'node:path'

import { devConfig, isLocalFast, localEvidenceDir } from '../lib/devmode.mjs'
import { appendLog } from '../lib/fsutil.mjs'
import { defaultGit, integrate, runChecks, selectChecks, staticGates, writeLocalEvidence } from '../lib/localgate.mjs'
import { p, root } from '../lib/paths.mjs'
import { loadState } from '../lib/state.mjs'

const argv = process.argv.slice(2)
const arg = (k) => { const i = argv.indexOf(k); return i >= 0 ? argv[i + 1] : undefined }
const json = argv.includes('--json')
const say = (o) => console.log(json ? JSON.stringify(o) : Object.entries(o).map(([k, v]) => `${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n'))

const cfg = devConfig()
if (!isLocalFast(cfg)) { say({ ok: false, why: `개발 모드 ${cfg.mode} — 로컬 통합은 LOCAL_FAST 에서만(GITHUB 모드는 safe-merge)` }); process.exit(2) }
const taskId = arg('--task')
const { state } = loadState()
const task = state.taskQueue.tasks.find((t) => t.task_id === taskId)
if (!task) { say({ ok: false, why: `작업 없음: ${taskId}` }); process.exit(2) }
if (!task.worktree || !task.branch) { say({ ok: false, why: `${taskId} 에 worktree · branch 결속이 없다` }); process.exit(2) }

const t0 = Date.now()
const git = defaultGit(task.worktree)
const base = cfg.integration_branch
// 통합 브랜치가 없으면 로컬 origin/main 에서 만든다(fetch 없음 · 원격 호출 0)
try { git('rev-parse', '--verify', base) } catch { git('branch', base, 'origin/main') }
const head = git('rev-parse', task.branch)
const gates = staticGates({ task, head, base, git, reviewRoot: root() })

// 실행 검사 — 검증 커밋이 체크아웃된 깨끗한 worktree 에서만(=스냅샷과 같다). 끝나고 HEAD 불변을 다시 본다
const wtHead = git('rev-parse', 'HEAD')
const dirty = git('status', '--porcelain', '--untracked-files=no')
if (wtHead !== head) gates.fail.push(`checks: 작업 worktree HEAD ${wtHead.slice(0, 9)} ≠ 검증 커밋 ${head.slice(0, 9)}`)
if (dirty) gates.fail.push('checks: 작업 worktree 에 커밋 안 된 추적 변경 — 검증 커밋 그대로가 아니다')
const checks = selectChecks(cfg.checks || [], { files: gates.files, worktree: task.worktree, e2e: argv.includes('--e2e') })

let results = []
if (!gates.fail.length && !argv.includes('--dry-run')) {
  results = await runChecks(checks)
  for (const r of results) if (!r.ok) gates.fail.push(`checks: ${r.id} 실패(code ${r.code}) — ${r.tail.split('\n').filter(Boolean).slice(-3).join(' / ').slice(0, 300)}`)
  for (const r of results.filter((x) => x.kind !== 'lint' && x.counts && x.counts.skipped > 0 && x.kind === 'e2e')) gates.fail.push(`checks: ${r.id} 건너뜀 ${r.counts.skipped}(skip=0 요구)`)
  if (git('rev-parse', task.branch) !== head) gates.fail.push('commit: 검사 중 작업 브랜치 HEAD 가 바뀌었다 — 다시 실행')
  const e2e = results.find((r) => r.kind === 'e2e')
  if (e2e && cfg.e2e_criterion) writeLocalEvidence(cfg.e2e_criterion, e2e, head)
}

let merged = null
if (!gates.fail.length && !argv.includes('--dry-run')) {
  const igit = defaultGit(cfg.integration_worktree)
  if (!fs.existsSync(cfg.integration_worktree)) git('worktree', 'add', '-q', cfg.integration_worktree, base)
  merged = integrate({ integrationGit: igit, head, message: `local-integrate: ${taskId} ${task.title ?? ''}`.trim().slice(0, 120) })
  if (!merged.ok) gates.fail.push(`integrate: ${merged.why}`)
}

const rec = {
  at: new Date().toISOString(), task_id: taskId, head, base, mode: cfg.mode, ok: gates.fail.length === 0 && !argv.includes('--dry-run'),
  dry_run: argv.includes('--dry-run'), fail: gates.fail, files: gates.files.length,
  checks: results.map((r) => ({ id: r.id, kind: r.kind, ok: r.ok, ms: r.ms, counts: r.counts })), integrated: merged?.ok ? merged.sha : null,
  wall_ms: Date.now() - t0, github_calls: 0,
}
fs.mkdirSync(localEvidenceDir(), { recursive: true })
const out = path.join(localEvidenceDir(), `integrate--${taskId}--${head.slice(0, 12)}.json`)
fs.writeFileSync(out, JSON.stringify(rec, null, 2))
appendLog(p.eventLog(), { at: rec.at, event: 'local.integrate', task_id: taskId, head, ok: rec.ok, integrated: rec.integrated, wall_ms: rec.wall_ms, fail: rec.fail.length })
say({ ...rec, record: path.relative(root(), out).split(path.sep).join('/') })
process.exit(rec.ok || rec.dry_run ? 0 : 1)
