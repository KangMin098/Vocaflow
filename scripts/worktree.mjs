#!/usr/bin/env node
// scripts/worktree.mjs
//
// Vocaflow 멀티 세션 git worktree 관리 헬퍼.
// 여러 Claude Code / VS Code 세션이 서로 다른 브랜치를 동시에 작업할 때
// worktree(별도 디렉터리 + 독립 워킹트리 + 공유 .git) 생성·조회·정리를 자동화.
//
// 사용:
//   node scripts/worktree.mjs list                 # 전체 worktree + ahead/behind
//   node scripts/worktree.mjs new <suffix> [base]  # ../Vocaflow-<suffix> + feat/<suffix> 생성 (base 기본 main)
//   node scripts/worktree.mjs remove <suffix> [--del-branch]
//   node scripts/worktree.mjs sync                 # fetch --all --prune + 상태 요약
//
// pnpm 별칭: pnpm wt <subcommand>
//
// 규약: 디렉터리 = <parent>/Vocaflow-<suffix>, 브랜치 = feat/<suffix> (base 분기)
//       new 시 pnpm install --frozen-lockfile 자동 실행 (worktree 마다 node_modules 필요).

import { execSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const REPO_ROOT = path.resolve(__dirname, '..')
const PARENT = path.dirname(REPO_ROOT)
const NAME_PREFIX = 'Vocaflow-'
const MAIN_BRANCH = 'main'

function sh(cmd, opts = {}) {
  return execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf-8', stdio: 'pipe', ...opts }).trim()
}

function shLoud(cmd, opts = {}) {
  return execSync(cmd, { cwd: REPO_ROOT, encoding: 'utf-8', stdio: 'inherit', ...opts })
}

function fail(msg) {
  console.error(`\x1b[31m✗ ${msg}\x1b[0m`)
  process.exit(1)
}

// `git worktree list --porcelain` 파싱 → [{ dir, branch, head }]
function listWorktrees() {
  const out = sh('git worktree list --porcelain')
  const entries = []
  let cur = null
  for (const line of out.split('\n')) {
    if (line.startsWith('worktree ')) {
      if (cur) entries.push(cur)
      cur = { dir: line.slice('worktree '.length).trim(), branch: null, head: null }
    } else if (line.startsWith('HEAD ')) {
      if (cur) cur.head = line.slice('HEAD '.length).trim().slice(0, 7)
    } else if (line.startsWith('branch ')) {
      if (cur) cur.branch = line.slice('branch '.length).trim().replace('refs/heads/', '')
    } else if (line.startsWith('detached')) {
      if (cur) cur.branch = '(detached)'
    }
  }
  if (cur) entries.push(cur)
  return entries
}

// main 대비 ahead/behind 카운트 (origin/main 우선, 없으면 로컬 main)
function aheadBehind(branch) {
  if (!branch || branch === '(detached)') return ''
  let base = `origin/${MAIN_BRANCH}`
  try {
    sh(`git rev-parse --verify ${base}`)
  } catch {
    base = MAIN_BRANCH
  }
  try {
    const counts = sh(`git rev-list --left-right --count ${base}...${branch}`)
    const [behind, ahead] = counts.split(/\s+/).map((n) => parseInt(n, 10))
    if (!behind && !ahead) return 'in sync'
    const parts = []
    if (ahead) parts.push(`↑${ahead}`)
    if (behind) parts.push(`↓${behind}`)
    return parts.join(' ')
  } catch {
    return ''
  }
}

function cmdList() {
  const wts = listWorktrees()
  console.log('')
  console.log(`  \x1b[1mVocaflow worktrees\x1b[0m (vs ${MAIN_BRANCH})`)
  console.log('  ' + '─'.repeat(72))
  for (const w of wts) {
    const isRoot = path.resolve(w.dir) === REPO_ROOT
    const tag = isRoot ? '\x1b[2m(root)\x1b[0m' : ''
    const branch = (w.branch || '(detached)').padEnd(28)
    const ab = aheadBehind(w.branch)
    console.log(`  \x1b[36m${branch}\x1b[0m ${w.head}  ${ab.padEnd(12)} ${w.dir} ${tag}`)
  }
  console.log('')
}

function cmdNew(suffix, base = MAIN_BRANCH) {
  if (!suffix) fail('suffix 필요. 예: node scripts/worktree.mjs new payments')
  if (!/^[a-z0-9][a-z0-9-]*$/.test(suffix)) fail(`suffix 는 소문자/숫자/하이픈만: "${suffix}"`)

  const dir = path.join(PARENT, `${NAME_PREFIX}${suffix}`)
  const branch = `feat/${suffix}`

  if (fs.existsSync(dir)) fail(`디렉터리가 이미 존재: ${dir}`)
  let branchExists = false
  try {
    sh(`git rev-parse --verify ${branch}`)
    branchExists = true
  } catch {
    branchExists = false
  }

  console.log(`\x1b[1m▸ worktree 생성\x1b[0m  ${dir}  [${branch}]  (base: ${base})`)
  if (branchExists) {
    // 기존 브랜치 체크아웃
    shLoud(`git worktree add "${dir}" ${branch}`)
  } else {
    shLoud(`git worktree add -b ${branch} "${dir}" ${base}`)
  }

  console.log(`\x1b[1m▸ pnpm install\x1b[0m  (${dir})`)
  try {
    shLoud(`pnpm install --frozen-lockfile --prefer-offline`, { cwd: dir })
  } catch {
    console.warn('\x1b[33m⚠ pnpm install 실패 — 수동으로 다시 시도하세요.\x1b[0m')
  }

  console.log('')
  console.log(`\x1b[32m✓ 완료\x1b[0m`)
  console.log(`  VS Code 로 열기:   code "${dir}"`)
  console.log(`  새 세션 working dir: ${dir}`)
}

function cmdRemove(suffix, opts) {
  if (!suffix) fail('suffix 필요. 예: node scripts/worktree.mjs remove payments')
  const dir = path.join(PARENT, `${NAME_PREFIX}${suffix}`)
  const branch = `feat/${suffix}`

  if (!fs.existsSync(dir)) fail(`디렉터리 없음: ${dir}`)
  if (path.resolve(dir) === REPO_ROOT) fail('루트 worktree 는 제거할 수 없습니다.')

  console.log(`\x1b[1m▸ worktree 제거\x1b[0m  ${dir}`)
  shLoud(`git worktree remove "${dir}"`)

  if (opts.delBranch) {
    console.log(`\x1b[1m▸ 브랜치 삭제\x1b[0m  ${branch}`)
    try {
      shLoud(`git branch -D ${branch}`)
    } catch {
      console.warn(`\x1b[33m⚠ 브랜치 ${branch} 삭제 실패 (이미 없거나 미머지).\x1b[0m`)
    }
  } else {
    console.log(`\x1b[2m  (브랜치 ${branch} 는 보존 — 삭제하려면 --del-branch)\x1b[0m`)
  }
  console.log(`\x1b[32m✓ 완료\x1b[0m`)
}

function cmdSync() {
  console.log('\x1b[1m▸ git fetch --all --prune\x1b[0m')
  shLoud('git fetch --all --prune')
  cmdList()
}

// ── entry ──────────────────────────────────────────────────────────
const [, , sub, ...rest] = process.argv
const flags = new Set(rest.filter((a) => a.startsWith('--')))
const args = rest.filter((a) => !a.startsWith('--'))

switch (sub) {
  case 'list':
  case 'ls':
    cmdList()
    break
  case 'new':
  case 'add':
    cmdNew(args[0], args[1])
    break
  case 'remove':
  case 'rm':
    cmdRemove(args[0], { delBranch: flags.has('--del-branch') })
    break
  case 'sync':
    cmdSync()
    break
  default:
    console.log(`Vocaflow worktree 헬퍼

  node scripts/worktree.mjs list                 전체 worktree + main 대비 ahead/behind
  node scripts/worktree.mjs new <suffix> [base]  ../Vocaflow-<suffix> + feat/<suffix> 생성 + pnpm install
  node scripts/worktree.mjs remove <suffix> [--del-branch]
  node scripts/worktree.mjs sync                 fetch --all --prune 후 상태 요약

  pnpm wt <subcommand> 로도 호출 가능.`)
    if (sub && sub !== 'help' && sub !== '--help') process.exit(1)
}
