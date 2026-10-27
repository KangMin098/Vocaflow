#!/usr/bin/env node
// agents/scripts/local-merge.mjs
// TASK 없는 로컬 통합 — 검증한 커밋 SHA 하나를 main 워크트리에 `git merge --no-ff` 한다.
// 잠금 획득 결과를 **코드에서** 확인한 뒤에만 merge 한다. 옛 절차(`lock.mjs acquire … | tail -1 && git merge`)는
// pipe 가 acquire 실패를 삼켜 잠금 없이 merge 했다(2026-10-27 실측). 셸·pipe 없이 execFile argv 로만 git 을 부른다.
//
// 사용: node agents/scripts/local-merge.mjs <full-sha> --agent <name> [--pid <live agent pid>] [-m <message>]
//   대상은 이 스크립트가 있는 워크트리이며 중앙 dev-mode 의 LOCAL_FAST main_worktree 와 같아야 한다. CLI 는 AGENT_LOCK_FILE 을
//   받지 않는다. localMerge() 직접 호출(회귀)도 대상이 git 루트이고 잠금이 그 루트의 .agent-lock 일 때만 진행한다.
// 종료: 0 통합됨/이미 포함 · 2 사전 조건 실패(merge 0회) · 3 잠금 실패·소유 변경(merge 0회) · 4 merge 실패(상태 보존·잠금 유지) · 5 잠금 해제 실패 · 64 대상·설정·사용법

import { execFileSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import * as lock from './lock.mjs'
import { ROOT, isMain } from './lib.mjs'

const LOCK_NAME = '.agent-lock'
const IN_PROGRESS = ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-merge', 'rebase-apply', 'BISECT_LOG']

function gitIn(repo, args) {
  return execFileSync('git', args, { cwd: repo, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
}

/** 비교용 정규 경로 — 8.3 짧은 이름(ADMINI~1)·대소문자·구분자 차이를 없앤다. 없는 파일은 부모를 정규화한다. */
function canon(p) {
  const abs = path.resolve(p)
  const real = (q) => fs.realpathSync.native(q)
  try {
    return real(abs).toLowerCase()
  } catch {
    return path.join(real(path.dirname(abs)), path.basename(abs)).toLowerCase()
  }
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
  // 대상 루트의 **미추적** 잠금 파일 한 줄만 dirty 에서 뺀다(.gitignore 에 없을 수도 있다) — 같은 이름의 추적 파일 수정은 빼지 않는다
  const dirty = status.ok ? status.out.split('\n').filter((l) => l && l !== `?? ${LOCK_NAME}`) : ['status?']
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
  if (!Number.isInteger(pid) || pid <= 0) return { code: 64, msg: '살아 있는 에이전트 pid 를 찾지 못했다(--pid 로 줄 수 있다)' }

  // 대상은 git 워크트리 **루트**여야 하고, 잠금은 그 루트의 .agent-lock 이어야 한다 —
  // 하위 디렉터리를 대상으로 주면 git 은 상위 루트를 merge 하므로 별도 잠금으로 우회된다(Codex 재리뷰 2026-10-27)
  const top = tryGit(repo, ['rev-parse', '--show-toplevel'])
  const same = (a, b) => canon(a) === canon(b)
  if (!top.ok || !same(top.out, repo)) return { code: 64, msg: `대상(${repo})이 git 워크트리 루트가 아니다(${top.out}) — merge 0회` }
  if (!same(lock.LOCK_FILE, path.join(repo, LOCK_NAME)))
    return { code: 64, msg: `잠금 파일(${lock.LOCK_FILE})이 대상 워크트리(${repo})의 ${LOCK_NAME} 가 아니다 — merge 0회` }

  const commit = tryGit(repo, ['cat-file', '-t', sha])
  if (!commit.ok || commit.out !== 'commit') return { code: 2, msg: `대상 저장소에 커밋 ${sha} 가 없다` }

  const before = snapshot(repo)
  const bad = preconditions(before)
  if (bad) return { code: 2, msg: `통합 보류(merge 0회): ${bad}` }

  const got = lock.acquire(agent, pid)
  if (!got.ok) return { code: 3, msg: `통합 보류(merge 0회) — 잠금 실패: ${got.msg}` }

  let keepLock = false
  let r
  try {
    r = (() => {
      afterAcquire?.()
      const after = snapshot(repo)
      const bad2 = preconditions(after)
      if (bad2) return { code: 2, msg: `통합 보류(merge 0회) — 잠금 뒤 재확인 실패: ${bad2}` }
      if (after.head !== before.head) return { code: 2, msg: `통합 보류(merge 0회) — 잠금 사이 HEAD 가 바뀌었다(${before.head} → ${after.head})` }

      if (tryGit(repo, ['merge-base', '--is-ancestor', sha, after.head]).ok)
        return { code: 0, msg: `이미 포함됨: ${sha} ⊂ main ${after.head}`, mainSha: after.head, merged: false }

      // merge 직전 — 잠금이 아직 내 것인지(다른 세션 --force 인수·고아 정리 뒤 재획득 등)
      const cur = lock.read()
      if (lock.state(cur) !== 'held' || cur.agent !== agent || cur.pid !== pid) {
        keepLock = true // 내 것이 아니면 놓지도 않는다
        return { code: 3, msg: `통합 보류(merge 0회) — 잠금이 더 이상 내 것이 아니다: ${JSON.stringify(cur)}` }
      }

      const m = tryGit(repo, ['merge', '--no-ff', '--no-edit', ...(message ? ['-m', message] : []), sha])
      if (!m.ok) {
        // 충돌·실패는 자동 abort/reset 하지 않는다 — 소유자가 그 상태에서 해결한다. 잠금도 놓지 않는다(그 사이 남이 쓰지 않게).
        keepLock = true
        return { code: 4, msg: `merge 실패 — 상태를 그대로 두고 잠금을 유지한다(해결 뒤 lock.mjs release ${agent}):\n${m.out}` }
      }
      const mainSha = gitIn(repo, ['rev-parse', 'HEAD'])
      return { code: 0, msg: `통합됨: ${sha} → main ${mainSha}`, mainSha, merged: true }
    })()
  } finally {
    if (!keepLock) {
      const rel = lock.release(agent, pid)
      if (!rel.ok) r = { ...(r ?? { merged: false }), code: 5, msg: `${r?.msg ?? '중단'}\n잠금 해제 실패: ${rel.msg}`, releaseFailed: true }
    }
  }
  return r
}

/** CLI 대상은 중앙 dev-mode 의 LOCAL_FAST main_worktree 와 같아야 한다(임의 저장소·잠금 경로로 우회 금지). */
export function configuredMain(cfgPath = process.env.VFC_DEV_MODE_FILE || 'D:/workspace/Vocaflow-AI-Control/config/dev-mode.json') {
  try {
    const cfg = JSON.parse(fs.readFileSync(cfgPath, 'utf8'))
    if (cfg.mode !== 'LOCAL_FAST' || !cfg.main_worktree) return { ok: false, msg: `dev-mode 가 LOCAL_FAST 가 아니거나 main_worktree 가 없다(${cfg.mode})` }
    return { ok: true, main: path.resolve(cfg.main_worktree) }
  } catch (e) {
    return { ok: false, msg: `dev-mode 설정을 읽지 못했다: ${e.message}` }
  }
}

function main() {
  const argv = process.argv.slice(2)
  const flag = (n) => {
    const i = argv.indexOf(n)
    return i === -1 ? undefined : argv[i + 1]
  }
  const sha = argv.find((a, i) => !a.startsWith('-') && !['--agent', '--pid', '-m'].includes(argv[i - 1]))
  const fail = (code, msg) => {
    console.error(msg)
    process.exit(code)
  }
  const cfg = configuredMain()
  if (!cfg.ok) fail(64, `통합 보류(merge 0회): ${cfg.msg}`)
  if (canon(ROOT) !== canon(cfg.main))
    fail(64, `통합 보류(merge 0회): 이 스크립트의 워크트리(${ROOT})가 main_worktree(${cfg.main})가 아니다 — main_worktree 의 사본으로 실행한다`)
  if (process.env.AGENT_LOCK_FILE) fail(64, '통합 보류(merge 0회): CLI 는 AGENT_LOCK_FILE 을 받지 않는다(대상 워크트리의 .agent-lock 만 쓴다)')
  const agent = flag('--agent')
  const pidArg = flag('--pid')
  // 기본은 조상에서 찾은 살아 있는 에이전트 pid(옛 pid 를 계속 넣지 않게). --pid 는 그 값이 살아 있을 때만 acquire 가 받는다.
  const pid = pidArg !== undefined ? Number(pidArg) : agent ? lock.findAgentPid(agent) : null
  const r = localMerge({ repo: ROOT, sha, agent, pid: pid ?? NaN, message: flag('-m') })
  ;(r.code ? console.error : console.log)(r.msg)
  process.exit(r.code)
}

if (isMain(import.meta.url)) main()
