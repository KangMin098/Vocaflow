#!/usr/bin/env node
// agents/scripts/local-merge.mjs
// TASK 없는 로컬 통합 — 검증한 커밋 SHA 하나를 main 워크트리에 `git merge --no-ff` 한다.
// 잠금 획득 결과를 **코드에서** 확인한 뒤에만 merge 한다. 옛 절차(`lock.mjs acquire … | tail -1 && git merge`)는
// pipe 가 acquire 실패를 삼켜 잠금 없이 merge 했다(2026-10-27 실측). 셸·pipe 없이 execFile argv 로만 git 을 부른다.
//
// 사용: node agents/scripts/local-merge.mjs <full-sha> --agent <name> --pid <live agent pid> [-m <message>]
//   대상은 이 스크립트가 있는 워크트리(main-serving)다. --repo 는 회귀용이며 AGENT_LOCK_FILE 을 함께 줘야 한다
//   (잠금 파일은 대상 워크트리의 것이어야 한다 — 다른 워크트리의 잠금으로 main 을 쓰지 않는다).
// 종료: 0 통합됨/이미 포함 · 2 사전 조건 실패(merge 0회) · 3 잠금 실패(merge 0회) · 4 merge 실패(상태 보존·잠금 유지) · 64 사용법

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import * as lock from './lock.mjs'
import { ROOT, isMain } from './lib.mjs'

const IN_PROGRESS = ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply', 'BISECT_LOG']

function gitIn(repo, args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

function tryGit(repo, args) {
  try {
    return { ok: true, out: gitIn(repo, args) }
  } catch (e) {
    return { ok: false, out: `${e.stdout ?? ''}${e.stderr ?? ''}`.trim() }
  }
}

/** 대상 워크트리의 현재 상태 — merge 전 두 번(잠금 전·후) 같은 값이어야 한다. */
export function snapshot(repo) {
  const branch = tryGit(repo, ['symbolic-ref', '--quiet', '--short', 'HEAD'])
  const head = tryGit(repo, ['rev-parse', 'HEAD'])
  const status = tryGit(repo, ['status', '--porcelain', '--untracked-files=normal'])
  const gitDir = tryGit(repo, ['rev-parse', '--absolute-git-dir'])
  const busy = gitDir.ok ? IN_PROGRESS.filter((f) => fs.existsSync(path.join(gitDir.out, f))) : ['git-dir?']
  // 잠금 파일은 워크트리 안에 있다 — 그 한 파일은 dirty 로 세지 않는다(.gitignore 에 없을 수도 있다)
  const lockName = path.basename(lock.LOCK_FILE)
  const dirty = status.ok ? status.out.split('\n').filter((l) => l && !l.endsWith(` ${lockName}`)) : ['status?']
  return { branch: branch.ok ? branch.out : null, head: head.ok ? head.out : null, dirty, busy }
}

function preconditions(s) {
  if (s.branch !== 'main') return `대상 브랜치가 main 이 아니다(${s.branch ?? 'detached'})`
  if (!s.head) return 'HEAD 를 읽지 못했다'
  if (s.busy.length) return `진행 중인 git 작업이 있다: ${s.busy.join(', ')}`
  if (s.dirty.length) return `미커밋 변경이 있다(${s.dirty.length}줄): ${s.dirty.slice(0, 3).join(' | ')}`
  return null
}

/**
 * 통합 본체. deps.afterAcquire 는 회귀용 훅(잠금 획득 직후 상태를 바꿔 재확인이 막는지 본다).
 * 반환 { code, msg, mainSha? , merged? }
 */
export function localMerge({ repo = ROOT, sha, agent, pid, message, afterAcquire } = {}) {
  if (!/^[0-9a-f]{40}$/.test(sha ?? '')) return { code: 64, msg: `전체 40자 SHA 를 준다(받은 값: ${sha ?? '없음'})` }
  if (!agent) return { code: 64, msg: '--agent 가 필요하다' }
  if (!Number.isInteger(pid) || pid <= 0) return { code: 64, msg: '--pid 에 살아 있는 에이전트 pid 를 준다' }

  const commit = tryGit(repo, ['cat-file', '-t', sha])
  if (!commit.ok || commit.out !== 'commit') return { code: 2, msg: `대상 저장소에 커밋 ${sha} 가 없다` }

  const before = snapshot(repo)
  const bad = preconditions(before)
  if (bad) return { code: 2, msg: `통합 보류(merge 0회): ${bad}` }

  const got = lock.acquire(agent, pid)
  if (!got.ok) return { code: 3, msg: `통합 보류(merge 0회) — 잠금 실패: ${got.msg}` }

  let keepLock = false
  try {
    afterAcquire?.()
    const after = snapshot(repo)
    const bad2 = preconditions(after)
    if (bad2) return { code: 2, msg: `통합 보류(merge 0회) — 잠금 뒤 재확인 실패: ${bad2}` }
    if (after.head !== before.head) return { code: 2, msg: `통합 보류(merge 0회) — 잠금 사이 HEAD 가 바뀌었다(${before.head} → ${after.head})` }

    if (tryGit(repo, ['merge-base', '--is-ancestor', sha, after.head]).ok)
      return { code: 0, msg: `이미 포함됨: ${sha} ⊂ main ${after.head}`, mainSha: after.head, merged: false }

    const m = tryGit(repo, ['merge', '--no-ff', '--no-edit', ...(message ? ['-m', message] : []), sha])
    if (!m.ok) {
      // 충돌·실패는 자동 abort/reset 하지 않는다 — 소유자가 그 상태에서 해결한다. 잠금도 놓지 않는다(그 사이 남이 쓰지 않게).
      keepLock = true
      return { code: 4, msg: `merge 실패 — 상태를 그대로 두고 잠금을 유지한다(해결 뒤 lock.mjs release ${agent}):\n${m.out}` }
    }
    const mainSha = gitIn(repo, ['rev-parse', 'HEAD'])
    return { code: 0, msg: `통합됨: ${sha} → main ${mainSha}`, mainSha, merged: true }
  } finally {
    if (!keepLock) {
      const r = lock.release(agent, pid)
      if (!r.ok) console.error(`잠금 해제 실패: ${r.msg}`)
    }
  }
}

function main() {
  const argv = process.argv.slice(2)
  const flag = (n) => {
    const i = argv.indexOf(n)
    return i === -1 ? undefined : argv[i + 1]
  }
  const sha = argv.find((a, i) => !a.startsWith('-') && !['--agent', '--pid', '-m', '--repo'].includes(argv[i - 1]))
  const repoArg = flag('--repo')
  if (repoArg && path.resolve(repoArg) !== path.resolve(ROOT) && !process.env.AGENT_LOCK_FILE) {
    console.error('--repo 를 다른 워크트리로 줄 때는 그 워크트리의 AGENT_LOCK_FILE 을 함께 준다')
    process.exit(64)
  }
  const pidArg = flag('--pid')
  const r = localMerge({
    repo: repoArg ? path.resolve(repoArg) : ROOT,
    sha,
    agent: flag('--agent'),
    pid: pidArg === undefined ? NaN : Number(pidArg),
    message: flag('-m'),
  })
  ;(r.code ? console.error : console.log)(r.msg)
  process.exit(r.code)
}

if (isMain(import.meta.url)) main()
