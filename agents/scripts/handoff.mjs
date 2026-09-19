#!/usr/bin/env node
// agents/scripts/handoff.mjs
//
// 에이전트 간 인수인계 — 한도·중단 시 다음 에이전트가 손실 없이 이어받게 한다(B7).
//
//   node agents/scripts/handoff.mjs <from> <to> \
//     --done "끝낸 것" --todo "남은 것" --accept "수용 기준" --next "다음 한 동작" [--forbid "금지"] [--session <jsonl>]
//     (--done/--todo/--accept/--forbid 는 여러 번 줄 수 있다)
//   node agents/scripts/handoff.mjs --validate [file]   # 필수 6항목 스키마 검사 (D6)
//   node agents/scripts/handoff.mjs --verify [json]     # 받는 쪽: 브랜치·변경 파일이 이어졌는지 (D8)
//   node agents/scripts/handoff.mjs --ack <agent>       # 받는 쪽: 읽었음 표시 (세션 시작 주입을 멈춘다)
//
// 산출물: .agent-handoff/latest.md (사람·에이전트용) + latest.json (기계용). 이전 것은 history/ 로 옮긴다.
// 재실행 안전: 같은 입력이면 같은 내용(작성 시각 제외). 필수 항목이 비면 파일은 쓰되 exit 1 로 알린다.

import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { ROOT, currentBranch, findSecrets, git, isMain, lf, rel } from './lib.mjs'

export const DIR = process.env.AGENT_HANDOFF_DIR || rel('.agent-handoff')
export const REQUIRED = ['1. 브랜치', '2. 변경 파일', '3. 완료된 것', '4. 남은 것과 수용 기준', '5. 다음 한 동작', '6. 실행 금지 사항']
const EMPTY = '(미기재)'
const ALWAYS_FORBID = [
  'main 직접 push · force push · `--no-verify` (AGENTS.md ③)',
  '마이그레이션 자동 적용 — SQL 을 보여주고 사용자 승인 후',
  '`.env*` 출력·커밋',
  '남의 잠금(`lock.mjs status`)이 살아 있는 워크트리에 쓰기',
]

function multi(argv, name) {
  const out = []
  argv.forEach((a, i) => {
    if (a === name && argv[i + 1] !== undefined) out.push(argv[i + 1])
  })
  return out
}

function changed() {
  try {
    return git(['status', '--porcelain=v1', '--untracked-files=all'])
      .split('\n')
      .filter(Boolean)
      .map((l) => ({ status: l.slice(0, 2).trim(), file: l.slice(3).replace(/^"|"$/g, '') }))
  } catch {
    return []
  }
}

// ── 세션 로그 요약 ────────────────────────────────────────────────────────

function newestJsonl(dir, filter = () => true) {
  if (!fs.existsSync(dir)) return null
  const files = []
  const walk = (d, depth) => {
    for (const e of fs.readdirSync(d, { withFileTypes: true })) {
      const p = path.join(d, e.name)
      if (e.isDirectory() && depth < 4) walk(p, depth + 1)
      else if (e.name.endsWith('.jsonl') && filter(p)) files.push({ p, t: fs.statSync(p).mtimeMs })
    }
  }
  walk(dir, 0)
  files.sort((a, b) => b.t - a.t)
  return files[0]?.p ?? null
}

function textOf(content) {
  if (typeof content === 'string') return content
  if (!Array.isArray(content)) return ''
  return content
    .filter((c) => ['text', 'input_text', 'output_text'].includes(c?.type))
    .map((c) => c.text)
    .join(' ')
}

/** Claude: ~/.claude/projects/<slug>/*.jsonl · Codex: ~/.codex/sessions/**\/rollout-*.jsonl (cwd 가 이 저장소인 것) */
export function sessionTurns(agent, explicit) {
  let file = explicit
  if (!file && agent === 'claude') {
    const slug = ROOT.replace(/[^A-Za-z0-9]/g, '-')
    const base = path.join(os.homedir(), '.claude', 'projects')
    const dir = fs.existsSync(base) ? fs.readdirSync(base).find((d) => d.toLowerCase() === slug.toLowerCase()) : null
    file = dir ? newestJsonl(path.join(base, dir)) : null
  }
  if (!file && agent === 'codex') {
    const home = process.env.CODEX_HOME || path.join(os.homedir(), '.codex')
    const root = ROOT.toLowerCase()
    file = newestJsonl(path.join(home, 'sessions'), (p) => fs.readFileSync(p, 'utf8').slice(0, 4000).toLowerCase().includes(JSON.stringify(root).slice(1, -1)))
  }
  if (!file || !fs.existsSync(file)) return { file: null, turns: [] }
  const turns = []
  for (const line of lf(fs.readFileSync(file, 'utf8')).split('\n')) {
    let e
    try {
      e = JSON.parse(line)
    } catch {
      continue
    }
    const msg = e.message ?? (e.payload?.type === 'message' ? e.payload : null)
    const role = msg?.role ?? e.type
    if (role !== 'user' && role !== 'assistant') continue
    const t = textOf(msg?.content).replace(/\s+/g, ' ').trim()
    if (!t || t.startsWith('<') || e.isMeta) continue
    turns.push({ role, text: t.length > 280 ? `${t.slice(0, 280)}…` : t })
  }
  const last = turns.slice(-10).map((t) => (findSecrets(t.text).length ? { ...t, text: '(비밀값 패턴이 있어 생략)' } : t))
  return { file, turns: last }
}

// ── 작성 ─────────────────────────────────────────────────────────────────

const bullets = (xs) => (xs.length ? xs.map((x) => `- ${x}`).join('\n') : `- ${EMPTY}`)

export function startCommand(to) {
  const prompt = '.agent-handoff/latest.md 를 읽고 「4. 남은 것과 수용 기준」부터 재확인한 뒤 이어서 진행하라. 시작 전에 node agents/scripts/lock.mjs acquire ' + to + ' 를 실행하라.'
  return to === 'codex' ? `codex "${prompt}"` : to === 'claude' ? `claude "${prompt}"` : prompt
}

export function build({ from, to, done, todo, accept, next, forbid, session }) {
  const branch = currentBranch()
  let headSha = ''
  let stat = ''
  try {
    headSha = git(['rev-parse', 'HEAD']).trim()
    stat = git(['diff', 'HEAD', '--stat']).trim()
  } catch {
    // git 없음 — 빈 칸으로 둔다
  }
  const files = changed()
  const log = sessionTurns(from, session)
  const md = [
    `# 인수인계 — ${from} → ${to}`,
    '',
    `- 작성: ${new Date().toISOString()} · 작성 에이전트 \`${from}\` · 받는 에이전트 \`${to}\``,
    '- 받는 쪽 첫 동작: 이 파일을 읽고 **4번 수용 기준부터 재확인**. 받은 기능은 받은 쪽이 끝낸다(중간 재이관 금지).',
    '',
    `## ${REQUIRED[0]}`,
    '',
    `- \`${branch}\` @ \`${headSha.slice(0, 12)}\``,
    '',
    `## ${REQUIRED[1]}`,
    '',
    files.length
      ? `공유 워크스페이스라 다른 세션의 변경이 섞일 수 있다 — 3·4번에 적힌 경로가 이 작업의 몫이다.\n\n${files.map((f) => `- \`${f.status}\` ${f.file}`).join('\n')}`
      : '- (작업 트리 깨끗함)',
    '',
    `## ${REQUIRED[2]}`,
    '',
    bullets(done),
    '',
    `## ${REQUIRED[3]}`,
    '',
    '남은 것:',
    bullets(todo),
    '',
    '수용 기준:',
    bullets(accept),
    '',
    `## ${REQUIRED[4]}`,
    '',
    `- ${next || EMPTY}`,
    '',
    `## ${REQUIRED[5]}`,
    '',
    bullets([...forbid, ...ALWAYS_FORBID]),
    '',
    '## 부록 A. git diff HEAD --stat',
    '',
    '```',
    stat || '(변경 없음)',
    '```',
    '',
    `## 부록 B. 최근 대화 (최대 10턴${log.file ? ` · ${path.basename(log.file)}` : ''})`,
    '',
    log.turns.length ? log.turns.map((t) => `- **${t.role}**: ${t.text}`).join('\n') : '- (세션 로그를 찾지 못함)',
    '',
    '## 받는 쪽 시작 명령',
    '',
    '```',
    startCommand(to),
    '```',
    '',
  ].join('\n')
  const json = { from, to, branch, head: headSha, files: files.map((f) => f.file), created_at: new Date().toISOString(), ack: null }
  return { md, json }
}

export function validate(md) {
  const problems = []
  const text = lf(md)
  for (const h of REQUIRED) {
    const i = text.indexOf(`## ${h}`)
    if (i === -1) {
      problems.push(`항목 없음: ${h}`)
      continue
    }
    const rest = text.slice(i + h.length + 3)
    const body = rest.slice(0, rest.search(/\n## |$/)).trim()
    const items = body.split('\n').filter((l) => l.startsWith('- '))
    if (!items.length || items.every((l) => l === `- ${EMPTY}`)) problems.push(`비어 있음: ${h}`)
  }
  const acc = text.match(/수용 기준:\n([\s\S]*?)\n\n/)
  if (!acc || /^- \(미기재\)$/.test(acc[1].trim())) problems.push('수용 기준이 비어 있음')
  return problems
}

function archive() {
  const md = path.join(DIR, 'latest.md')
  if (!fs.existsSync(md)) return
  const hist = path.join(DIR, 'history')
  fs.mkdirSync(hist, { recursive: true })
  const stamp = fs.statSync(md).mtime.toISOString().replace(/[:.]/g, '-')
  fs.renameSync(md, path.join(hist, `${stamp}.md`))
  const js = path.join(DIR, 'latest.json')
  if (fs.existsSync(js)) fs.renameSync(js, path.join(hist, `${stamp}.json`))
}

export function verify(js = path.join(DIR, 'latest.json')) {
  if (!fs.existsSync(js)) return ['latest.json 없음']
  const h = JSON.parse(fs.readFileSync(js, 'utf8'))
  const problems = []
  const branch = currentBranch()
  if (branch !== h.branch) problems.push(`브랜치가 다르다: 인계 ${h.branch} · 지금 ${branch}`)
  if (h.head) {
    try {
      git(['merge-base', '--is-ancestor', h.head, 'HEAD'])
    } catch {
      problems.push(`인계 시점 커밋 ${h.head.slice(0, 12)} 이 지금 HEAD 의 조상이 아니다(이력이 갈렸다)`)
    }
  }
  const now = new Set(changed().map((f) => f.file))
  let committed = new Set()
  if (h.head) {
    try {
      committed = new Set(git(['diff', '--name-only', h.head, 'HEAD']).split('\n').filter(Boolean))
    } catch {
      // 위에서 이미 보고
    }
  }
  // 인계된 변경은 (a) 아직 작업 트리에 변경으로 남아 있거나 (b) 인계 시점 이후 커밋에 들어갔어야 한다
  for (const f of h.files) if (!now.has(f) && !committed.has(f)) problems.push(`인계된 변경이 사라졌다: ${f}`)
  return problems
}

function main() {
  const argv = process.argv.slice(2)
  if (argv[0] === '--validate') {
    const file = argv[1] ?? path.join(DIR, 'latest.md')
    const p = validate(fs.readFileSync(file, 'utf8'))
    console.log(p.length ? `FAIL\n- ${p.join('\n- ')}` : `PASS  필수 6항목 (${path.relative(ROOT, file)})`)
    process.exit(p.length ? 1 : 0)
  }
  if (argv[0] === '--verify') {
    const p = verify(argv[1])
    console.log(p.length ? `FAIL\n- ${p.join('\n- ')}` : 'PASS  브랜치·인계 시점 커밋·변경 파일이 모두 이어졌다')
    process.exit(p.length ? 1 : 0)
  }
  if (argv[0] === '--ack') {
    const js = path.join(DIR, 'latest.json')
    const h = JSON.parse(fs.readFileSync(js, 'utf8'))
    h.ack = { agent: argv[1] ?? 'unknown', at: new Date().toISOString() }
    fs.writeFileSync(js, JSON.stringify(h, null, 2) + '\n')
    console.log(`읽음 표시: ${h.ack.agent}`)
    process.exit(0)
  }
  const [from, to] = argv
  if (!from || !to || from.startsWith('-') || to.startsWith('-')) {
    console.error('사용: handoff.mjs <from> <to> --done … --todo … --accept … --next … [--forbid …]  |  --validate [file]  |  --verify  |  --ack <agent>')
    process.exit(64)
  }
  const one = (n) => multi(argv, n)[0]
  const { md, json } = build({
    from,
    to,
    done: multi(argv, '--done'),
    todo: multi(argv, '--todo'),
    accept: multi(argv, '--accept'),
    next: one('--next'),
    forbid: multi(argv, '--forbid'),
    session: one('--session'),
  })
  fs.mkdirSync(DIR, { recursive: true })
  archive()
  fs.writeFileSync(path.join(DIR, 'latest.md'), md)
  fs.writeFileSync(path.join(DIR, 'latest.json'), JSON.stringify(json, null, 2) + '\n')
  const problems = validate(md)
  console.log(`인수인계 작성: ${path.relative(ROOT, path.join(DIR, 'latest.md'))}  (${from} → ${to}, 변경 파일 ${json.files.length})`)
  if (problems.length) console.error(`⚠ 필수 항목 미기재 — 받는 쪽이 이어받기 어렵다:\n- ${problems.join('\n- ')}`)
  console.log(`\n받는 쪽 시작 명령:\n  ${startCommand(to)}`)
  process.exit(problems.length ? 1 : 0)
}

if (isMain(import.meta.url)) main()
