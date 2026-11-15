// packages/library-pipeline/src/story/cli.ts
//
// LCP Story 로컬 제작 CLI 본체 — 실행 진입은 scripts/lcp/story/story.ts.
// 결과는 stdout 에 JSON 하나, 사람이 읽을 한 줄 요약은 stderr 로 낸다.
// 종료 코드: 0 성공 · 2 대기/후보 없음(실패는 아니지만 성공도 아니다) · 1 오류.

import {
  exportEditionTasks,
  exportReviewTasks,
  planWork,
  validateWork,
  type CommandReport,
  type EditionReport,
} from './workdir'

export interface CliIo {
  stdout(text: string): void
  stderr(text: string): void
  now(): Date
}

export const STORY_CLI_USAGE = `LCP Story 로컬 제작 CLI (DB · 네트워크 없음)

  export   --root <dir> --work <name> --source <snapshot.json> --policy <policy.json> [--now <ISO>]
  export   --root <dir> --work <name> --stage review [--now <ISO>]
  validate --root <dir> --work <name> [--now <ISO>]
  plan     --root <dir> --work <name> [--out plan.json] [--now <ISO>]

  --root  작업 root(링크 불가). 저장소 안이라면 gitignore 된 work/lcp-story 를 쓴다.
  --work  작업 이름(a-z0-9-). 원천 · 기준이 바뀌면 새 이름으로 내보낸다(같은 이름 덮기 거부).
  --now   시각 주입(재현용). 없으면 실행 시각.
종료 코드: 0 성공 · 2 대기/후보 없음 · 1 오류`

// Map 이라 `toString` · `constructor` · `__proto__` 같은 Object.prototype 이름이 명령으로 잡히지 않는다.
const ALLOWED: ReadonlyMap<string, ReadonlySet<string>> = new Map([
  ['export', new Set(['root', 'work', 'source', 'policy', 'stage', 'now'])],
  ['validate', new Set(['root', 'work', 'now'])],
  ['plan', new Set(['root', 'work', 'now', 'out'])],
])

const ISO_WITH_OFFSET = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,9})?)?(Z|[+-]\d{2}:\d{2})$/

interface ParsedArgs {
  command: string
  values: Partial<Record<'root' | 'work' | 'source' | 'policy' | 'stage' | 'now' | 'out', string>>
}

type Parsed = ParsedArgs | { error: string }

export function parseStoryArgs(argv: readonly string[]): Parsed {
  const [command, ...rest] = argv
  const allowed = command === undefined ? undefined : ALLOWED.get(command)
  if (!command || !allowed) return { error: `알 수 없는 명령: ${command ?? '(없음)'}` }
  const values = new Map<string, string>()
  for (let i = 0; i < rest.length; i += 2) {
    const flag = rest[i]!
    const value = rest[i + 1]
    if (!flag.startsWith('--')) return { error: `옵션이 아닌 인자: ${flag}` }
    const key = flag.slice(2)
    if (!allowed.has(key)) return { error: `${command} 에 쓸 수 없는 옵션: ${flag}` }
    if (value === undefined || value.startsWith('--')) return { error: `${flag} 의 값이 없다` }
    if (values.has(key)) return { error: `${flag} 가 두 번 있다` }
    values.set(key, value)
  }
  return { command, values: Object.fromEntries(values) as ParsedArgs['values'] }
}

/** 판본 결과 · 검수 파일 안쪽의 오류까지 센다 — 요약 줄이 「오류 0」인데 종료 1 인 일이 없게. */
function errorCount(report: CommandReport): number {
  const holder = report as CommandReport & { editions?: unknown; validation?: { editions?: unknown } }
  const list = Array.isArray(holder.editions) ? holder.editions : holder.validation?.editions
  let nested = 0
  if (Array.isArray(list)) {
    for (const e of list) {
      if (typeof e !== 'object' || e === null || !('result' in e)) continue
      const ed = e as EditionReport
      nested += ed.result.errors.length + ed.reviews.reduce((n, r) => n + r.errors.length, 0)
    }
  }
  return report.errors.length + nested
}

function summarize(report: CommandReport): string {
  const written = report.files.filter((f) => f.outcome === 'written').length
  const unchanged = report.files.filter((f) => f.outcome === 'unchanged').length
  const head =
    report.exit_code === 0 ? 'ok' : report.exit_code === 1 ? 'error' : report.command === 'plan' ? 'no-candidate' : 'pending'
  const temps = report.leftover_temp_files.length > 0 ? ` · 남은 임시 파일 ${report.leftover_temp_files.length}` : ''
  return `[lcp-story] ${report.command} ${head} — 오류 ${errorCount(report)} · 기록 ${written} · 그대로 ${unchanged}${temps}`
}

export function runStoryCli(argv: readonly string[], io: CliIo): number {
  if (argv.length === 0 || argv[0] === 'help' || argv[0] === '--help') {
    io.stderr(`${STORY_CLI_USAGE}\n`)
    return argv.length === 0 ? 1 : 0
  }
  const parsed = parseStoryArgs(argv)
  const fail = (message: string): number => {
    io.stdout(`${JSON.stringify({ ok: false, exit_code: 1, errors: [{ code: 'usage', path: 'argv', message }] }, null, 2)}\n`)
    io.stderr(`[lcp-story] 사용법 오류 — ${message}\n${STORY_CLI_USAGE}\n`)
    return 1
  }
  if ('error' in parsed) return fail(parsed.error)
  const { command, values } = parsed
  if (!values.root || !values.work) return fail('--root 와 --work 가 필요하다')
  let now: Date
  if (values.now !== undefined) {
    if (!ISO_WITH_OFFSET.test(values.now) || Number.isNaN(Date.parse(values.now))) {
      return fail('--now 는 시간대가 있는 ISO 시각이어야 한다(예: 2026-10-25T09:00:00+09:00)')
    }
    now = new Date(values.now)
  } else {
    now = io.now()
  }

  let report: CommandReport
  if (command === 'export') {
    const stage = values.stage ?? 'edition'
    if (stage === 'edition') {
      if (!values.source || !values.policy) return fail('export 는 --source 와 --policy 가 필요하다')
      report = exportEditionTasks({ root: values.root, work: values.work, sourcePath: values.source, policyPath: values.policy, now })
    } else if (stage === 'review') {
      if (values.source || values.policy) return fail('--stage review 는 작업 폴더의 사본만 쓴다(--source · --policy 불가)')
      report = exportReviewTasks({ root: values.root, work: values.work, now })
    } else {
      return fail('--stage 는 edition 또는 review')
    }
  } else if (command === 'validate') {
    report = validateWork({ root: values.root, work: values.work, now })
  } else {
    report = planWork({ root: values.root, work: values.work, now, out: values.out ?? null })
  }
  io.stdout(`${JSON.stringify(report, null, 2)}\n`)
  io.stderr(`${summarize(report)}\n`)
  return report.exit_code
}
