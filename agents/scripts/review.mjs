// agents/scripts/review.mjs
//
// **목적 대조 Codex 리뷰** — 결함 + 목적 이탈(agents/goal-review.md)을 함께 본다.
// 사람(또는 에이전트)이 머지 전 교차 리뷰로 부른다. Stop 훅도 같은 지시문(goalReviewPrompt)을 쓴다.
//
//   node agents/scripts/review.mjs                     # 현재 브랜치 vs main, 목적 = .agent-goal.md
//   node agents/scripts/review.mjs --base origin/main --goal path/to/goal.md
//   node agents/scripts/review.mjs --print             # 실행하지 않고 지시문만 출력
//
// 목적 파일이 없으면 리뷰는 돌리되, 지시문이 「목적 파일 없음」을 [P2] 로 보고하게 한다.
// 종료 코드: 0 = P1·P2 없음 · 2 = P1·P2 있음 · 1 = 리뷰를 못 함(통과가 아니다).

import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')
const RULES = path.join(ROOT, 'agents', 'goal-review.md')

/** 목적 대조 지시문 — 목적 파일 내용(없으면 null)을 받아 Codex 에 넘길 글을 만든다 */
export function goalReviewPrompt(goalText, { base = 'main' } = {}) {
  const goal = goalText && goalText.trim()
    ? ['Stated goal file (.agent-goal.md) — the user\'s intent for this change:', '```markdown', goalText.trim(), '```'].join('\n')
    : 'No goal file (.agent-goal.md) was found. Report exactly one finding: "[P2] .agent-goal.md — 목적 파일 없음 — 목적 대조를 못 했다".'
  return [
    `Review the changes on this branch against ${base}: inspect the output of "git diff ${base}...HEAD" (read surrounding files only when needed). Do not modify anything. Answer in Korean.`,
    'Report two kinds of findings with the same severity scale:',
    '1. Real defects: bugs, regressions, security issues, broken contracts/types, data loss, missing error handling that will bite.',
    '2. Goal drift — compare the changes with the goal file below:',
    '   [P1] reintroduces anything under 「하지 않을 것」, goes against the goal, or breaks an acceptance criterion.',
    '   [P2] adds features/screens/settings/steps the user did not ask for (scope creep), misses an acceptance criterion,',
    '        or adds complexity (forms, options, steps) the user will not use.',
    '   [P3] unrelated polish or wording that contradicts the instructions.',
    '   Only report drift that contradicts the user\'s stated words — not taste or alternative designs.',
    goal,
    'Ignore style and formatting.',
    'Output format (no preamble, max 8 items, most severe first):',
    '[P1|P2|P3] path:line — (결함|목적 이탈) — what — fix (one line each)',
    'If there are no findings, output exactly: NO_FINDINGS',
  ].join('\n')
}

export function findCodex() {
  if (process.env.CODEX_BIN && fs.existsSync(process.env.CODEX_BIN)) return process.env.CODEX_BIN
  const ext = path.join(os.homedir(), '.vscode', 'extensions')
  try {
    const bins = fs.readdirSync(ext).filter((d) => d.startsWith('openai.chatgpt-'))
      .map((d) => path.join(ext, d, 'bin', process.platform === 'win32' ? 'windows-x86_64' : '', process.platform === 'win32' ? 'codex.exe' : 'codex'))
      .filter((p) => fs.existsSync(p))
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)
    if (bins[0]) return bins[0]
  } catch {
    // 확장이 없으면 PATH 의 codex
  }
  return 'codex'
}

function main() {
  const argv = process.argv.slice(2)
  const arg = (k, d) => {
    const i = argv.indexOf(k)
    return i >= 0 && argv[i + 1] ? argv[i + 1] : d
  }
  const base = arg('--base', 'main')
  const goalPath = path.resolve(arg('--goal', path.join(process.cwd(), '.agent-goal.md')))
  const goalText = fs.existsSync(goalPath) ? fs.readFileSync(goalPath, 'utf8') : null
  const prompt = goalReviewPrompt(goalText, { base })
  if (argv.includes('--print')) {
    console.log(prompt)
    return 0
  }
  if (!fs.existsSync(RULES)) console.warn(`[review] 기준 문서가 없다: ${RULES}`)
  // `codex review --base` 는 직접 쓴 지시문을 함께 못 받는다 — 읽기 전용 exec 로 돌리고 diff 는 지시문이 가리킨다
  const r = spawnSync(findCodex(), ['exec', '-s', 'read-only', '-c', 'model_reasoning_effort="high"', '--skip-git-repo-check', '-'], {
    cwd: process.cwd(), input: prompt, encoding: 'utf8', maxBuffer: 16 << 20, windowsHide: true,
  })
  if (r.error || r.status !== 0) {
    console.error(`[review] 리뷰를 못 했다(통과 아님): ${r.error?.message ?? r.stderr?.slice(-300)}`)
    return 1
  }
  // exec 는 진행 로그와 최종 답을 함께 낸다 — 마지막 답 덩어리만 남긴다
  const raw = (r.stdout || '').trim()
  const findings = raw.split('\n').filter((l) => /^\s*\[P[123]\]/.test(l))
  const out = findings.length ? [...new Set(findings.map((l) => l.trim()))].join('\n') : raw.includes('NO_FINDINGS') ? 'NO_FINDINGS' : raw
  // 명시적 NO_FINDINGS 나 형식 맞는 지적만 결과로 인정한다 — 빈 답 · 「검토 불가」 안내는 통과가 아니다
  if (!findings.length && out !== 'NO_FINDINGS') {
    console.error(`[review] 리뷰 결과를 읽지 못했다(통과 아님):
${raw.slice(-1500)}`)
    return 1
  }
  console.log(out)
  console.log(goalText ? `\n[review] 목적 파일: ${goalPath}` : '\n[review] 목적 파일 없음 — .agent-goal.md 를 쓰고 다시 돌린다')
  return /\[P[12]\]/.test(out) ? 2 : 0
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exit(main())
}
