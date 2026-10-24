// lib/worktree-reap.mjs — 끝난 작업의 Vocaflow 워크트리를 고른다(판정만 · 삭제는 bin/worktree-reap.mjs)
//
// 왜: 워크트리 하나가 node_modules 를 빼고도 0.5~0.6 GB 다. 열흘에 60개가 늘어 D: 100 GB 가 세 번 97~100% 가
// 됐다(2026-10-09 · 10-19 · 10-24). 끝난 워크트리를 아무도 안 지운다 — 손 정리는 매번 사람 몫이었다.
//
// 지우는 것은 아래를 **모두** 만족할 때뿐이다. 하나라도 모르면 남긴다(삭제는 되돌릴 수 없다).
//   ① 로컬 main 에 이미 들어간 HEAD (작업 결과가 main 에 있다)
//   ② 수정·스테이징 없음
//   ③ git 밖 파일이 캐시·에이전트 메모뿐 (연구 산출물·tmp·드레인 청크 같은 데이터가 있으면 남긴다)
//   ④ .env.local 이 없거나 main 의 것과 같다 (다른 키를 잃지 않는다)
//   ⑤ 살아 있는 .agent-lock 없음 · `git worktree lock` 없음
//   ⑥ 그 경로를 쓰는 프로세스 없음
//   ⑦ AI-Control 에 그 워크트리를 가리키는 끝나지 않은 TASK 없음
//   ⑧ idleMs 이상 활동 없음 (HEAD·reflog·폴더 시각 중 최신)
//   ⑨ main · integration · AI-Control · 원본 저장소 자체가 아님
import fs from 'node:fs'
import path from 'node:path'

/** git 밖에 있어도 지워도 되는 것 — 캐시·빌드 산출물·에이전트 메모. 그 밖은 데이터로 본다. */
export const DISPOSABLE = [
  /(^|\/)node_modules\/$/,
  /^apps\/web\/\.next[^/]*\/$/,
  /(^|\/)\.turbo\/$/,
  /\.tsbuildinfo$/,
  /(^|\/)next-env\.d\.ts$/,
  /(^|\/)test-results[^/]*\/$/,
  /(^|\/)playwright-report\/$/,
  /(^|\/)playwright-auth\/$/,
  /(^|\/)a11y-report\/$/,
  /^\.vfc-runs\/$/,
  /^\.vite\/$/,
  /^supabase\/\.temp\/$/,
  /^apps\/web\/public\/onnx\/$/,
  /^packages\/[^/]+\/dist\/$/,
  /^\.agent-(goal|plan)\.md$/,
  /^\.agent-(logs|handoff)\/$/,
  /^\.agent-lock$/,
  /(^|\/)\.dev-\d+\.log$/,
  /^\.codex\/hooks\.json$/,
]
const ENV_LOCAL = 'apps/web/.env.local'
const TERMINAL_TASK = new Set(['COMPLETED'])

/**
 * 비교용 경로. 있는 경로는 실제 경로로 푼다 — Windows 짧은 이름(`ADMINI~1`)과 긴 이름이 섞여 기록되면
 * 문자열 비교가 어긋나 **보호해야 할 TASK 워크트리를 남이 아닌 것으로 본다**(테스트에서 실측).
 * @param {string} p
 */
export const normPath = (p) => {
  let abs = path.resolve(p)
  try {
    abs = fs.realpathSync.native(abs)
  } catch {
    /* 없는 경로 — 그대로 비교한다 */
  }
  return abs.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
}

/**
 * `git worktree list --porcelain` 을 읽는다.
 * @param {string} text
 * @returns {{ path: string, head: string | null, branch: string | null, locked: boolean, bare: boolean }[]}
 */
export function parseWorktreeList(text) {
  const out = []
  let cur = null
  for (const line of String(text).split(/\r?\n/)) {
    if (line.startsWith('worktree ')) {
      cur = { path: line.slice(9), head: null, branch: null, locked: false, bare: false }
      out.push(cur)
    } else if (!cur) continue
    else if (line.startsWith('HEAD ')) cur.head = line.slice(5)
    else if (line.startsWith('branch ')) cur.branch = line.slice(7).replace(/^refs\/heads\//, '')
    else if (line === 'locked' || line.startsWith('locked ')) cur.locked = true
    else if (line === 'bare') cur.bare = true
  }
  return out
}

/**
 * 끝나지 않은 TASK 가 가리키는 워크트리.
 * @param {{ tasks?: unknown }} queue TASK_QUEUE.json
 * @returns {Set<string>}
 */
export function activeTaskWorktrees(queue) {
  const tasks = queue?.tasks
  const arr = Array.isArray(tasks) ? tasks : tasks && typeof tasks === 'object' ? Object.values(tasks) : []
  const set = new Set()
  for (const t of arr) {
    if (t && typeof t === 'object' && t.worktree && !TERMINAL_TASK.has(String(t.status))) set.add(normPath(String(t.worktree)))
  }
  return set
}

/**
 * 워크트리 하나를 판정한다. 부작용 없음 — 바깥 세계는 ctx 로만 본다.
 * @param {{ path: string, head: string | null, branch: string | null, locked: boolean, bare: boolean }} wt
 * @param {{
 *   protectedPaths: Set<string>,
 *   activeTasks: Set<string>,
 *   isMerged: (wtPath: string, head: string) => boolean,
 *   statusLines: (wtPath: string) => string[],
 *   lastActivityAt: (wtPath: string) => number,
 *   readFile: (file: string) => string | null,
 *   pidAlive: (pid: number) => boolean,
 *   processCmdlines: string[],
 *   mainEnvLocal: string | null,
 *   now: number,
 *   idleMs: number,
 * }} ctx
 * @returns {{ path: string, branch: string | null, remove: boolean, reasons: string[] }}
 */
export function judgeWorktree(wt, ctx) {
  const reasons = []
  const key = normPath(wt.path)
  const res = (remove) => ({ path: wt.path, branch: wt.branch, remove, reasons })
  if (wt.bare || ctx.protectedPaths.has(key)) return reasons.push('보호 대상(main·integration·AI-Control·원본)'), res(false)
  if (wt.locked) reasons.push('git worktree lock')
  if (ctx.activeTasks.has(key)) reasons.push('끝나지 않은 AI-Control TASK')
  if (!wt.head) reasons.push('HEAD 불명')
  else if (!ctx.isMerged(wt.path, wt.head)) reasons.push('로컬 main 에 없는 커밋')

  const lockText = ctx.readFile(path.join(wt.path, '.agent-lock'))
  if (lockText !== null) {
    let pid = null
    try {
      pid = JSON.parse(lockText)?.pid ?? null
    } catch {
      /* 형식을 모르면 살아 있는 잠금으로 본다 */
    }
    if (pid === null || ctx.pidAlive(Number(pid))) reasons.push('살아 있는 .agent-lock')
  }

  const keys = [...new Set([key, path.resolve(wt.path).replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()])]
  if (ctx.processCmdlines.some((c) => keys.some((k) => mentionsPath(c, k)))) reasons.push('실행 중인 프로세스가 사용')

  const idle = ctx.now - ctx.lastActivityAt(wt.path)
  if (!(idle >= ctx.idleMs)) reasons.push(`최근 활동 ${Math.max(0, Math.round(idle / 3_600_000))}시간 전`)

  // 파일 검사는 가장 비싸다(무시 파일까지 보는 git status — 워크트리 120개면 수십 분).
  // 하나라도 걸리면 어차피 남기므로 앞의 검사를 모두 통과한 워크트리만 본다.
  if (reasons.length === 0) checkFiles(wt, ctx, reasons)
  return res(reasons.length === 0)
}

/** 미커밋 변경 · git 밖 데이터 · .env.local 을 본다. 첫 문제에서 멈춘다. */
function checkFiles(wt, ctx, reasons) {
  let lines
  try {
    lines = ctx.statusLines(wt.path)
  } catch {
    reasons.push('git status 실패')
    return
  }
  for (const line of lines) {
    const code = line.slice(0, 2)
    const file = line.slice(3)
    if (code !== '??' && code !== '!!') return void reasons.push(`미커밋 변경 ${file}`)
    if (file.startsWith('"')) return void reasons.push(`git 밖 데이터 ${file}`)
    if (file === ENV_LOCAL) {
      const mine = ctx.readFile(path.join(wt.path, ENV_LOCAL))
      if (ctx.mainEnvLocal === null || mine !== ctx.mainEnvLocal) return void reasons.push('.env.local 이 main 과 다름')
      continue
    }
    if (!DISPOSABLE.some((re) => re.test(file))) return void reasons.push(`git 밖 데이터 ${file}`)
  }
}

/**
 * 명령줄이 그 경로(또는 그 안)를 가리키는가. `D:\x\Vocaflow-a` 는 `Vocaflow-ab` 와 구별한다.
 * @param {string} cmdline
 * @param {string} key normPath 결과
 */
export function mentionsPath(cmdline, key) {
  const norm = String(cmdline).toLowerCase().replace(/\\+/g, '/').replace(/\/{2,}/g, '/')
  for (let i = norm.indexOf(key); i >= 0; i = norm.indexOf(key, i + 1)) {
    const next = norm[i + key.length]
    if (next === undefined || !/[a-z0-9._-]/.test(next)) return true
  }
  return false
}

/**
 * 워크트리 활동 시각: 워크트리 폴더·git HEAD 파일 시각과 reflog **마지막 항목에 적힌 시각** 중 최신.
 * ⚠️ 파일 시각으로 보면 안 되는 것 둘 (2026-10-24 실측):
 *   · index — `git status` 가 stat 정보를 고치며 다시 써서, 점검만 해도 「방금 활동」이 된다.
 *     스테이징은 판정 ② 미커밋 변경이 따로 잡는다.
 *   · logs/HEAD — git gc 가 reflog 를 일괄로 다시 써서 모든 워크트리가 같은 시각(10-23 14:20)을 갖는다.
 *     그래서 파일 시각이 아니라 마지막 줄의 `<epoch> <tz>` 를 읽는다.
 * @param {string} wtPath
 * @param {string} gitDir 그 워크트리의 git-dir (`git rev-parse --git-dir`)
 */
export function activityAt(wtPath, gitDir) {
  let t = 0
  for (const f of [wtPath, path.join(gitDir, 'HEAD')]) {
    try {
      t = Math.max(t, fs.statSync(f).mtimeMs)
    } catch {
      /* 없으면 건너뛴다 */
    }
  }
  return Math.max(t, lastReflogAt(path.join(gitDir, 'logs', 'HEAD')))
}

/**
 * reflog 마지막 항목의 시각(ms). 없거나 못 읽으면 0.
 * 형식: `<old> <new> <name> <email> <epoch> <+tz>\t<message>`
 * @param {string} file
 */
export function lastReflogAt(file) {
  let text
  try {
    text = fs.readFileSync(file, 'utf8')
  } catch {
    return 0
  }
  const lines = text.split('\n').filter(Boolean)
  const m = /> (\d{9,}) [+-]\d{4}\t/.exec(lines.at(-1) ?? '')
  return m ? Number(m[1]) * 1000 : 0
}
