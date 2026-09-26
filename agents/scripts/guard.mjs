#!/usr/bin/env node
// agents/scripts/guard.mjs
//
// PreToolUse 안전 훅 — Claude Code(.claude/settings.json)와 Codex CLI(.codex/config.toml)가 **같은 스크립트**를 부른다.
// 두 도구 모두 stdin JSON 의 `tool_input.command` 에 셸 명령이 온다.
// Claude Code 는 exit 2 + stderr, Codex 는 stdout 의 PreToolUse JSON deny 로 차단한다.
//
// 막는 것 (agents/DECISIONS.md D-04):
//   1. 재귀 + 강제 삭제       rm -rf · rm -r -f · Remove-Item -Recurse -Force · rd /s /q
//   2. 원격 이력 파괴          git push --force / -f / --force-with-lease / +refspec · main 으로 직접 push
//   3. 공유 워크스페이스 파괴  git reset --hard · git clean -f · git checkout -- . · git restore . · git stash (list/show 제외)
//   4. 비밀 출력              cat/type/Get-Content/head/tail/less… 로 .env* 읽기 (.env.example 제외)
//   5. 훅 우회                git commit/push --no-verify
// git commit 이면 커밋 전 검사를 더 돈다:
//   · 커밋될 추가 줄의 비밀값 패턴 · .env 파일 커밋
//   · 에이전트 설정 파일이 끼면 agents/scripts/check.mjs (D1–D3)
//   · 커밋될 apps/web 의 .ts/.tsx 에 eslint (오류만 차단)
//
// 시험: echo '{"tool_name":"Bash","tool_input":{"command":"rm -rf x"}}' | node agents/scripts/guard.mjs --agent test
// 판정만 보기: node agents/scripts/guard.mjs --explain "git push -f origin x"   (커밋 전 검사는 돌지 않는다)

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'
import { ROOT, findSecrets, git, isEnvFile, isMain } from './lib.mjs'

const SHELL_TOOLS = /^(Bash|PowerShell|shell|local_shell|exec_command|container\.exec)$/
const READERS = new Set(
  'cat type less more head tail bat nl od xxd strings sed awk grep rg findstr get-content gc select-string sls copy cp base64'.split(' '),
)
const REMOVERS = new Set(['rm', 'remove-item', 'ri', 'del', 'erase', 'rd', 'rmdir'])
const WRAPPER_SHELLS = new Set(['bash', 'bash.exe', 'sh', 'zsh', 'pwsh', 'powershell', 'powershell.exe', 'pwsh.exe', 'cmd', 'cmd.exe'])

// ── 셸 명령 → 세그먼트(토큰 배열) ─────────────────────────────────────────

/** heredoc 본문은 명령이 아니라 데이터다(커밋 메시지에 "rm -rf" 가 들어가도 막지 않게). */
function stripHeredocs(cmd) {
  const lines = cmd.replace(/\r\n/g, '\n').split('\n')
  const out = []
  let delim = null
  for (const line of lines) {
    if (delim !== null) {
      if (line.trim() === delim) delim = null
      continue
    }
    out.push(line)
    const m = line.match(/<<-?\s*(['"]?)([A-Za-z_][\w-]*)\1/)
    if (m) delim = m[2]
  }
  // PowerShell here-string @' … '@ / @" … "@
  return out.join('\n').replace(/@(['"])\r?\n[\s\S]*?\r?\n\1@/g, "''")
}

/** 따옴표를 존중하는 작은 렉서. 연산자(; && || | 줄바꿈 &)에서 세그먼트를 끊는다. */
export function segments(cmd) {
  const src = stripHeredocs(cmd)
  const segs = []
  let cur = []
  let tok = ''
  let has = false
  let q = null
  const push = () => {
    if (has) cur.push(tok)
    tok = ''
    has = false
  }
  const cut = () => {
    push()
    if (cur.length) segs.push(cur)
    cur = []
  }
  for (let i = 0; i < src.length; i++) {
    const c = src[i]
    if (q) {
      if (c === q) q = null
      else if (c === '\\' && q === '"' && i + 1 < src.length) tok += src[++i]
      else tok += c
      continue
    }
    if (c === "'" || c === '"') {
      q = c
      has = true
    } else if (c === '\\' && i + 1 < src.length && /[ \t'"$`\\;&|<>()]/.test(src[i + 1])) {
      // 셸 특수문자 앞에서만 이스케이프다 — `apps\web\.env.local` 같은 Windows 경로의 \ 는 글자로 남긴다
      tok += src[++i]
      has = true
    } else if (c === '\n' || c === ';' || c === '|' || c === '&' || c === '(' || c === ')' || c === '{' || c === '}') {
      cut()
    } else if (c === ' ' || c === '\t') {
      push()
    } else if (c === '#' && !has && (i === 0 || /\s/.test(src[i - 1]))) {
      while (i + 1 < src.length && src[i + 1] !== '\n') i++
    } else {
      tok += c
      has = true
    }
  }
  cut()
  return segs
}

/** env 할당·sudo·command 같은 앞머리를 걷어낸 [verb, ...args]. */
function head(seg) {
  let i = 0
  while (i < seg.length && (/^[A-Za-z_][A-Za-z0-9_]*=/.test(seg[i]) || /^(sudo|command|exec|nohup|time|then|do|else|!)$/.test(seg[i]))) i++
  const rest = seg.slice(i)
  if (!rest.length) return null
  const verb = rest[0].replace(/^.*[\\/]/, '').toLowerCase()
  return { verb, args: rest.slice(1) }
}

// ── 판정 ────────────────────────────────────────────────────────────────

/**
 * rm 의 묶음 플래그(-rf)와 PowerShell 이름 매개변수(-Recurse · -Force · -r · -fo)를 함께 읽는다.
 * 이름 매개변수를 먼저 본다 — `-Force` 를 글자로 풀면 r 이 섞여 「재귀」로 오판한다.
 */
function removeFlags(args) {
  const letters = new Set()
  for (const a of args) {
    const m = a.match(/^--?([A-Za-z]+)$/)
    if (!m) continue
    const w = m[1].toLowerCase()
    if (w === 'recursive' || 'recurse'.startsWith(w)) letters.add('r')
    else if (w.length >= 2 && 'force'.startsWith(w)) letters.add('f')
    else if (!a.startsWith('--')) for (const ch of w) letters.add(ch)
  }
  return letters
}

function checkRemove(verb, args) {
  if (!REMOVERS.has(verb)) return null
  const lower = args.map((a) => a.toLowerCase())
  if (lower.includes('/s') && lower.includes('/q')) return `${verb} /s /q — 재귀 강제 삭제`
  const l = removeFlags(args)
  if (l.has('r') && l.has('f')) return `${verb} 재귀+강제 삭제(${args.filter((a) => a.startsWith('-')).join(' ')})`
  return null
}

const GIT_GLOBAL_WITH_VALUE = new Set(['-C', '-c', '--git-dir', '--work-tree', '--namespace'])

function gitSub(args) {
  let i = 0
  while (i < args.length && args[i].startsWith('-')) i += GIT_GLOBAL_WITH_VALUE.has(args[i]) ? 2 : 1
  return { sub: args[i], rest: args.slice(i + 1) }
}

function checkGit(args) {
  const { sub, rest } = gitSub(args)
  if (!sub) return null
  if ((sub === 'commit' || sub === 'push' || sub === 'merge' || sub === 'rebase') && rest.includes('--no-verify'))
    return `git ${sub} --no-verify — 훅을 우회하지 말고 실패 원인을 고친다`
  if (sub === 'commit' && rest.some((a) => /^-[a-z]*n[a-z]*$/.test(a) && !a.startsWith('--')))
    return 'git commit -n(= --no-verify) — 훅을 우회하지 않는다'
  if (sub === 'push') {
    const flags = rest.filter((a) => a.startsWith('-'))
    if (flags.some((a) => /^--force(-with-lease|-if-includes)?(=|$)/.test(a) || /^-[a-z]*f[a-z]*$/.test(a)))
      return 'git push --force 계열 — force push 금지'
    if (flags.includes('--mirror')) return 'git push --mirror — 원격 이력을 통째로 덮는다'
    const pos = rest.filter((a) => !a.startsWith('-'))
    const refspecs = pos.slice(1)
    if (refspecs.some((r) => r.startsWith('+'))) return 'git push +refspec — force push 와 같다'
    if (refspecs.some((r) => /(^|:)(refs\/heads\/)?(main|master)$/.test(r)))
      return 'main 으로 직접 push 금지 — 브랜치에 push 하고 PR 을 연다'
  }
  if (sub === 'reset' && rest.includes('--hard')) return 'git reset --hard — 공유 워크스페이스에서 다른 세션의 미커밋 변경을 지운다'
  if (sub === 'clean' && rest.some((a) => /^-[a-z]*f/i.test(a) || a === '--force'))
    return 'git clean -f — 공유 워크스페이스에서 다른 세션의 새 파일을 지운다'
  if ((sub === 'checkout' || sub === 'restore') && rest.some((a) => a === '.' || a === ':/' || a === '*'))
    return `git ${sub} . — 작업 트리 전체를 되돌린다(다른 세션의 변경 포함). 파일을 지정할 것`
  if (sub === 'stash' && !['list', 'show'].includes(rest[0] ?? ''))
    return 'git stash — 공유 워크스페이스에서 다른 세션의 변경까지 치운다'
  return null
}

function checkEnvRead(verb, args) {
  if (!READERS.has(verb)) return null
  const hit = args.find((a) => !a.startsWith('-') && isEnvFile(a.replace(/^.*=/, '')))
  return hit ? `${verb} ${hit} — .env 계열 출력 금지(값은 스크립트가 --env-file 로 읽는다)` : null
}

/** @returns {string[]} 차단 사유 목록 (빈 배열이면 통과) */
export function explain(cmd, depth = 0) {
  const reasons = []
  for (const seg of segments(cmd)) {
    const h = head(seg)
    if (!h) continue
    const { verb, args } = h
    if (WRAPPER_SHELLS.has(verb) && depth < 3) {
      const k = args.findIndex((a) => /^(-[a-z]*c|-command|\/c)$/i.test(a))
      if (k !== -1 && args[k + 1]) reasons.push(...explain(args.slice(k + 1).join(' '), depth + 1))
      continue
    }
    if (verb === 'eval' && depth < 3) {
      reasons.push(...explain(args.join(' '), depth + 1))
      continue
    }
    const r =
      checkRemove(verb, args) ??
      (verb === 'git' ? checkGit(args) : null) ??
      checkEnvRead(verb, args)
    if (r) reasons.push(r)
  }
  return reasons
}

// ── 커밋 전 검사 ─────────────────────────────────────────────────────────

const AGENT_CONFIG = /^(AGENTS\.md|CLAUDE\.md|\.mcp\.json|agents\/|\.codex\/|\.claude\/settings\.json)/

/** git commit 세그먼트 → 커밋될 경로(null = 인덱스 전체) */
function commitPaths(args) {
  const { rest } = gitSub(args)
  const only = rest.includes('--only') || rest.includes('-o')
  const all = rest.some((a) => /^-[a-z]*a[a-z]*$/.test(a) || a === '--all')
  const VAL = new Set(['-m', '-F', '--file', '-C', '-c', '--author', '--date', '--fixup', '--squash', '-t', '--template', '--trailer'])
  const paths = []
  let afterDash = false
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]
    if (afterDash) paths.push(a)
    else if (a === '--') afterDash = true
    else if (VAL.has(a)) i++
    else if (!a.startsWith('-')) paths.push(a)
  }
  // 경로를 주면 git 은 --only 가 기본이다 — 인덱스가 아니라 그 경로의 작업 트리 내용이 커밋된다
  if (paths.length) return { mode: 'paths', paths, only }
  return { mode: all ? 'all' : 'index', paths: [] }
}

function changedFiles(sel) {
  const out =
    sel.mode === 'index'
      ? git(['diff', '--cached', '--name-only', '--diff-filter=ACMR'])
      : sel.mode === 'all'
        ? git(['diff', 'HEAD', '--name-only', '--diff-filter=ACMR'])
        : git(['diff', 'HEAD', '--name-only', '--diff-filter=ACMR', '--', ...sel.paths]) +
          git(['ls-files', '--others', '--exclude-standard', '--', ...sel.paths])
  return [...new Set(out.split('\n').map((s) => s.trim()).filter(Boolean))]
}

function addedText(sel, files) {
  if (!files.length) return ''
  const tracked = sel.mode === 'index' ? git(['diff', '--cached', '-U0', '--', ...files]) : git(['diff', 'HEAD', '-U0', '--', ...files])
  const lines = tracked.split('\n').filter((l) => l.startsWith('+') && !l.startsWith('+++')).map((l) => l.slice(1))
  const untracked = git(['ls-files', '--others', '--exclude-standard', '--', ...files]).split('\n').filter(Boolean)
  for (const f of untracked) {
    const p = path.join(ROOT, f)
    if (fs.existsSync(p) && fs.statSync(p).size < 2_000_000) lines.push(fs.readFileSync(p, 'utf8'))
  }
  return lines.join('\n')
}

export function precommit(args) {
  const reasons = []
  let sel
  let files
  try {
    sel = commitPaths(args)
    files = changedFiles(sel)
  } catch (e) {
    return [`커밋 대상 파일을 못 읽었다: ${e.message.split('\n')[0]}`]
  }
  const envs = files.filter(isEnvFile)
  if (envs.length) reasons.push(`.env 파일 커밋 금지: ${envs.join(', ')}`)

  const scan = files.filter((f) => !/\.(png|jpe?g|gif|webp|pdf|zip|glb|woff2?|mp3|mp4|wav)$/i.test(f))
  const hits = findSecrets(addedText(sel, scan))
  if (hits.length) reasons.push(`커밋될 줄에 비밀값 패턴 ${hits.length}건: ${[...new Set(hits.map((h) => h.name))].join(', ')}`)

  if (files.some((f) => AGENT_CONFIG.test(f))) {
    const r = spawnSync(process.execPath, [path.join(ROOT, 'agents/scripts/check.mjs'), '--quiet'], { cwd: ROOT, encoding: 'utf8' })
    if (r.status !== 0) reasons.push(`에이전트 설정 검사 실패(node agents/scripts/check.mjs):\n${(r.stdout + r.stderr).trim()}`)
  }

  const lintable = files
    .filter((f) => /^apps\/web\/.*\.(tsx?|jsx?|mjs)$/.test(f) && fs.existsSync(path.join(ROOT, f)))
    .map((f) => f.slice('apps/web/'.length))
  if (lintable.length && process.env.AGENT_GUARD_SKIP_LINT !== '1') {
    const eslint = path.join(ROOT, 'apps/web/node_modules/.bin', process.platform === 'win32' ? 'eslint.cmd' : 'eslint')
    if (fs.existsSync(eslint)) {
      const r = spawnSync(eslint, ['--quiet', ...lintable], {
        cwd: path.join(ROOT, 'apps/web'),
        encoding: 'utf8',
        shell: process.platform === 'win32',
        timeout: 150_000,
      })
      if (r.status === 1) reasons.push(`eslint 오류(커밋될 파일 ${lintable.length}개):\n${(r.stdout || '').trim().slice(0, 3000)}`)
    }
  }
  return reasons
}

// ── 진입 ────────────────────────────────────────────────────────────────

function log(agent, cmd, reasons) {
  if (process.env.AGENT_GUARD_NO_LOG === '1') return // 회귀 테스트가 실제 차단 기록을 어지럽히지 않게
  try {
    const dir = path.join(ROOT, '.agent-logs')
    fs.mkdirSync(dir, { recursive: true })
    const line = JSON.stringify({ at: new Date().toISOString(), agent, blocked: reasons, command: cmd.slice(0, 300) })
    fs.appendFileSync(path.join(dir, 'guard.jsonl'), line + '\n')
  } catch {
    // 로그 실패는 판정에 영향을 주지 않는다
  }
}

async function readStdin() {
  const chunks = []
  for await (const c of process.stdin) chunks.push(c)
  return Buffer.concat(chunks).toString('utf8')
}

async function main() {
  const argv = process.argv.slice(2)
  const agent = argv[argv.indexOf('--agent') + 1] ?? 'unknown'
  const ex = argv.indexOf('--explain')
  if (ex !== -1) {
    const reasons = explain(argv.slice(ex + 1).join(' '))
    console.log(reasons.length ? `BLOCK\n- ${reasons.join('\n- ')}` : 'ALLOW')
    process.exit(reasons.length ? 2 : 0)
  }

  let payload
  try {
    payload = JSON.parse(await readStdin())
  } catch {
    process.exit(0) // 형식을 모르는 입력은 판정하지 않는다(도구를 멈추지 않게)
  }
  const tool = payload.tool_name ?? ''
  const cmd = payload.tool_input?.command
  if (!SHELL_TOOLS.test(tool) || !cmd) process.exit(0)
  // Codex 의 옛 shell 도구는 argv 배열을 준다: ["bash", "-lc", "<스크립트>"] → 스크립트를 그대로 본다
  // argv 가 ["bash", "-lc", "<스크립트>"] 꼴이면 스크립트를 그대로 본다.
  const command = !Array.isArray(cmd)
    ? String(cmd)
    : cmd.length >= 3 && /^(-[a-z]*c|-command|\/c)$/i.test(cmd[1])
      ? cmd.slice(2).join(' ')
      : cmd.map((a) => (/[\s'"]/.test(a) ? `'${a.replace(/'/g, `'\\''`)}'` : a)).join(' ')

  const reasons = explain(command)
  if (!reasons.length) {
    for (const seg of segments(command)) {
      const h = head(seg)
      if (h?.verb === 'git' && gitSub(h.args).sub === 'commit') reasons.push(...precommit(h.args))
    }
  }
  if (!reasons.length) process.exit(0)

  log(agent, command, reasons)
  const reason =
    `[agents/guard] 차단 (${agent}):\n- ${reasons.join('\n- ')}\n` +
    '규칙: AGENTS.md 「자동화 정책 ③」·「공유 워크스페이스」. 정말 필요하면 사용자에게 직접 실행을 요청할 것.'

  if (agent === 'codex') {
    process.stdout.write(
      JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PreToolUse',
          permissionDecision: 'deny',
          permissionDecisionReason: reason,
        },
      }) + '\n',
    )
    process.exit(0)
  }

  process.stderr.write(reason + '\n')
  process.exit(2)
}

if (isMain(import.meta.url)) main()
