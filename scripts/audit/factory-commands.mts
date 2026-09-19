// scripts/audit/factory-commands.mts
//
// **공장이 관리자에게 내미는 명령이 실제로 그렇게 동작하는가** — 멱등 · dry-run · 재개 실측.
//
// ── 왜 이 자를 만드나 (감사 2026-09-16) ─────────────────────────────────
// 현황판 8칸은 각각 「다음에 돌릴 명령」을 들고 있고(`factory-model.ts` 의 `nextCommands`),
// 화면도움말(`lib/admin/help/csat.ts`)은 드레인 절차를 따로 적는다. 둘 다 **문장**이다.
// 문장은 무엇이든 약속할 수 있다 — "재실행 안전" 이라 적혀 있어도 코드가 그런지는 다른 문제다.
//
// `factory-model.test.ts` 는 **파일이 있는가**까지만 본다. 그래서 다음 셋은 아무도 안 본다:
//
//   ① `writes: true` 로 표시되지 않았는데 실제로 쓰는 명령 (관리자가 경고 없이 DB 를 바꾼다)
//   ② `--commit` 없이 돌렸을 때 정말 아무것도 안 쓰는가 (dry-run 이 실제로 dry 인가)
//   ③ 중간에 죽었을 때 다시 돌리면 이어지는가 (커서·이미 채운 것 건너뛰기)
//
// 이 자는 **정적으로** 센다 — 실제로 돌려 보지 않는다(쓰기 명령을 감사가 돌릴 수는 없다).
// 그래서 답은 "그렇다/아니다" 가 아니라 **「코드에 그 장치가 있는가」**다. 없으면 확실히
// 없는 것이고, 있으면 더 봐야 한다 — 그 구분을 판정에 그대로 적는다.
//
// 실행: npx tsx --tsconfig apps/web/tsconfig.json scripts/audit/factory-commands.mts
//       (읽기 전용 · 재실행 안전)

import { readFileSync, existsSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

const ROOT = process.cwd()
const OUT = path.join(ROOT, 'scripts/audit/factory-commands.result.json')

const read = (rel: string): string => readFileSync(path.join(ROOT, rel), 'utf8')

/* ───────── 명령을 **정본 파일에서** 긁는다 ───────── */
// 여기에 명령을 베껴 적으면 저쪽이 바뀌어도 이 자는 옛 목록을 검사한다.
const factorySrc = read('apps/web/src/lib/csat/factory.ts')
const lineViewSrc = read('apps/web/src/lib/csat/factory-line-views.ts')
const helpSrc = read('apps/web/src/lib/admin/help/csat.ts')

/** `cmd: '...'` 한 줄에서 명령 문자열만. 여러 줄 문자열은 안 쓴다(정본이 한 줄 규약). */
function cmdsIn(src: string): { cmd: string; writes: boolean; claudeCode: boolean }[] {
  const out: { cmd: string; writes: boolean; claudeCode: boolean }[] = []
  const lines = src.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const m = /^\s*cmd:\s*'([^']+)'/.exec(lines[i]!)
    if (!m) continue
    // 같은 객체 리터럴 안(다음 8줄)에서 표시를 찾는다 — 닫는 중괄호를 만나면 멈춘다.
    let writes = false
    let claudeCode = false
    for (let j = i + 1; j < Math.min(i + 9, lines.length); j++) {
      if (/^\s*\},?\s*$/.test(lines[j]!)) break
      if (/writes:\s*true/.test(lines[j]!)) writes = true
      if (/claudeCode:\s*true/.test(lines[j]!)) claudeCode = true
    }
    out.push({ cmd: m[1]!, writes, claudeCode })
  }
  return out
}

/** 명령 문자열에서 저장소 안의 스크립트 경로를 뽑는다. 없으면 null(=Claude Code 지시문). */
function scriptOf(cmd: string): string | null {
  const m = /(scripts\/[A-Za-z0-9_\-/.]+\.(?:mjs|mts|ts|js))/.exec(cmd)
  return m ? m[1]! : null
}

interface Finding {
  cmd: string
  declaredWrites: boolean
  declaredClaudeCode: boolean
  script: string | null
  exists: boolean
  /** `--commit` 을 인자로 보는가 — dry-run 이 있다는 뜻. */
  hasCommitFlag: boolean
  /** **DB 를 바꾸는가.** 되돌리기가 비싼 것은 이것뿐이다. */
  dbWrite: boolean
  /** 앱이 읽는 스냅샷 JSON 을 덮는가 — 화면 수치가 바뀐다(되돌리기는 git). */
  appStateWrite: boolean
  /** 커서 · `.imported` 표식 · 이미 채운 것 건너뛰기 — 재개 장치. */
  hasResume: boolean
  resumeEvidence: string[]
  /** 표시와 코드가 어긋난 자리. */
  mismatch: string[]
}

/**
 * **파일을 쓴다 ≠ 되돌릴 수 없다.**
 *
 * 첫 판(2026-09-16)에는 `writeFileSync` 를 DB 쓰기와 같이 세어 23개 중 13개를
 * 「표시 없는 쓰기」로 걸었다 — 그중 대부분은 **자기 결과 리포트를 쓰는 읽기 전용 자**였다
 * (`graded-source-probe` · `proofread-report` · `market-benchmark`). 규칙이 틀렸지
 * 코드가 틀린 게 아니었다(이 저장소가 「루프 애니메이션 금지」로 이미 한 번 겪은 실수다).
 *
 * 그래서 셋으로 가른다 — **DB 쓰기**(되돌리기 비쌈) · **앱 스냅샷 덮기**(화면이 바뀜 · git 으로
 * 되돌림) · **작업 파일 쓰기**(청크·리포트 · 되돌릴 것이 없음). 앞의 둘만 표시 대상이다.
 */
// ⚠️ **`.delete(` 만 보면 안 된다.** 첫 판은 `analysis-drain-export.mjs` 의 `done.delete(id)`
//    — 자바스크립트 `Set.delete` — 를 DB 삭제로 세어 읽기 전용 자를 「경고 없는 쓰기」로 걸었다.
//    그래서 **supabase 연쇄 안에서만** 센다: `.from('표')` 뒤 300자 안의 쓰기 호출.
const DB_WRITE =
  /\.from\(\s*['"][a-z_]+['"]\s*\)[\s\S]{0,300}?\.(insert|upsert|update|delete)\s*\(|apply_migration/
const APP_STATE_WRITE = /writeFileSync\([^)]*apps\/web\/src\/lib/
/** `--commit` 관문이 코드에 있고 화면이 그 인자 **없이** 부르면, 그 호출은 dry-run 이다. */
const commitGuarded = (src: string, cmd: string): boolean =>
  /process\.argv\.includes\(\s*['"]--commit['"]\s*\)/.test(src) && !/--commit/.test(cmd)
const COMMIT_FLAG = /--commit/
const RESUME_PATTERNS: [string, RegExp][] = [
  ['커서 파일', /CURSOR|cursor(File|s)\b/],
  ['.imported 표식', /\.imported/],
  ['이미 채운 것 건너뛰기', /이미 (채워진|있는|적재|처리)|already|skip(ped)?Existing/],
  ['건너뛴 수 출력', /건너뛴|skipped/],
  ['out.json 존재 검사', /existsSync\([^)]*out\.json/],
  ['--resume 인자', /--resume|--from\b|--offset/],
]

const declared = [...cmdsIn(factorySrc), ...cmdsIn(lineViewSrc), ...cmdsIn(helpSrc)]
const seen = new Set<string>()
const findings: Finding[] = []

for (const d of declared) {
  if (seen.has(d.cmd)) continue
  seen.add(d.cmd)
  const script = scriptOf(d.cmd)
  const exists = script ? existsSync(path.join(ROOT, script)) : false
  let src = ''
  if (exists) {
    try {
      src = read(script!)
    } catch {
      src = ''
    }
  }
  const hasCommitFlag = COMMIT_FLAG.test(src) || COMMIT_FLAG.test(d.cmd)
  const guarded = commitGuarded(src, d.cmd)
  /** 이 **호출이** DB 를 바꾸는가 — 파일에 쓰기 코드가 있어도 `--commit` 뒤면 이 호출은 아니다. */
  const dbWrite = DB_WRITE.test(src) && !guarded
  const appStateWrite = APP_STATE_WRITE.test(src) && !guarded
  const resumeEvidence = RESUME_PATTERNS.filter(([, re]) => re.test(src)).map(([n]) => n)

  const mismatch: string[] = []
  if (script && !exists) mismatch.push('명령이 가리키는 파일이 없다 — 관리자가 터미널에서 막힌다')
  if (exists && dbWrite && !d.writes)
    mismatch.push('DB 를 바꾸는데 화면에 `writes` 표시가 없다 — 관리자가 경고 없이 누른다')
  if (exists && appStateWrite && !d.writes)
    mismatch.push('앱이 읽는 스냅샷을 덮는데 `writes` 표시가 없다 — 화면 수치가 조용히 바뀐다')
  if (exists && d.writes && dbWrite && !hasCommitFlag)
    mismatch.push('DB 쓰기로 표시됐는데 `--commit` 관문이 없다 — dry-run 이 불가능하다')
  if (exists && dbWrite && !resumeEvidence.length)
    mismatch.push('DB 를 쓰는데 재개 장치가 안 보인다 — 중간에 죽으면 처음부터다')

  findings.push({
    cmd: d.cmd,
    declaredWrites: d.writes,
    declaredClaudeCode: d.claudeCode,
    script,
    exists,
    hasCommitFlag,
    dbWrite,
    appStateWrite,
    hasResume: resumeEvidence.length > 0,
    resumeEvidence,
    mismatch,
  })
}

/* ───────── 드레인 — Claude Code 에 그대로 던질 지시문이 있는가 ───────── */
const drainDirs = [
  ...readdirSync(path.join(ROOT, 'scripts/csat'), { withFileTypes: true })
    .filter((e) => e.isDirectory() && /drain|blind|refold|pilot|mixed/.test(e.name))
    .map((e) => 'scripts/csat/' + e.name),
  ...readdirSync(path.join(ROOT, 'scripts/textbook'), { withFileTypes: true })
    .filter((e) => e.isDirectory() && /drain|revise/.test(e.name))
    .map((e) => 'scripts/textbook/' + e.name),
]

const drains = drainDirs.map((d) => {
  const entries = readdirSync(path.join(ROOT, d))
  const briefs = entries.filter((f) => /^_?(PROMPT|BRIEF|JUDGING|MANIFEST)/i.test(f))
  const chunks = entries.filter((f) => /^chunk-.*\.json$/.test(f) && !/\.out\.json$/.test(f)).length
  const outs = entries.filter((f) => /\.out\.json$/.test(f)).length
  const imported = entries.filter((f) => /\.imported$/.test(f)).length
  const base = path.basename(d).replace(/-drain$/, '')
  const dir = path.dirname(d)
  const exportScript = [`${dir}/${base}-drain-export.mjs`, `${dir}/${base}-export.mjs`].find((p) =>
    existsSync(path.join(ROOT, p)),
  )
  const importScript = [`${dir}/${base}-drain-import.mjs`, `${dir}/${base}-import.mjs`].find((p) =>
    existsSync(path.join(ROOT, p)),
  )
  const validateScript = [`${dir}/${base}-drain-validate.mjs`, `${dir}/${base}-validate.mjs`].find(
    (p) => existsSync(path.join(ROOT, p)),
  )
  // ⚠️ **모든 청크 묶음이 드레인은 아니다.** 첫 판은 `choice-blind` 류(사람·LLM 이 지문만 보고
  //    답을 맞히는 **블라인드 평가 세트** — 결과가 DB 로 안 간다)를 드레인으로 세어
  //    「3단 미완비」로 걸었다. 완비될 수 없는 것을 미완비라 부르면 분모가 거짓이 된다.
  //    적재기가 있어야 드레인이다 — 결과가 제품으로 돌아가는 것이 드레인의 정의다.
  const kind: 'drain' | 'blind' = importScript ? 'drain' : 'blind'

  // ⚠️ **게이트는 파일 이름이 아니라 동작이다** (감사 2026-09-16 정정).
  //   첫 판은 `*-drain-validate.mjs` 라는 **파일**이 있는 드레인만 「게이트 보유」로 세어 2/11 을 냈고,
  //   그것을 근거로 「드레인 네 개에 검사기를 새로 붙이자」(T6)를 제안했다. 적재기를 열어 보니
  //   네 개 모두 **이미** `--commit` 없이는 미리보기만 하고, 빈 값·짧은 값·규격 밖을 **이유와 수를
  //   찍으며** 거르고 있었다 — CLAUDE.md 가 요구하는 그대로다. 새 파일은 중복이었다.
  //   그래서 적재기 **안의** 관문도 게이트로 센다: dry-run 스위치 + 건너뛴 수 출력.
  //   따로 돌릴 수 있는 검증기(`*-verify` · `*-audit` · `*-selfcheck`)도 함께 적는다.
  const importSrc = importScript ? readFileSync(path.join(ROOT, importScript), 'utf8') : ''
  const inImportGate =
    /process\.argv\.includes\(\s*['"]--commit['"]\s*\)/.test(importSrc) &&
    // `trim` 은 거부 사유를 `reject[코드]` 로 센다 — 낱말 「건너뛴」만 찾으면 그 자물쇠를 못 본다.
    /건너뛴|건너뜀|skipped|skip\(|reject\[/.test(importSrc)
  const checkRe = new RegExp(`^${base}-(drain-)?(verify|audit|selfcheck|validate)\\.m?[jt]s$`)
  const siblingChecks = readdirSync(path.join(ROOT, dir)).filter((f) => checkRe.test(f))
  return {
    dir: d,
    kind,
    /** Claude Code 가 읽고 바로 작업할 수 있는 지시문. 없으면 매번 사람이 말로 옮겨야 한다. */
    brief: briefs.length ? briefs.join(' · ') : null,
    chunks,
    outs,
    imported,
    exportScript: exportScript ?? null,
    importScript: importScript ?? null,
    validateScript: validateScript ?? null,
    /** 3단(export → Claude Code → import) 이 다 있는가. */
    complete: Boolean(exportScript && importScript),
    /** 적재기 안의 관문 — `--commit` 없이는 미리보기 + 건너뛴 수 출력. */
    inImportGate,
    /** 따로 돌려 볼 수 있는 검증기. */
    siblingChecks,
    /** 빈 값 적재를 막는 층이 **어디든** 있는가. */
    gated: Boolean(validateScript) || inImportGate,
  }
})

/* ───────── 지시문의 **정본**은 화면도움말이다 ─────────
   CLAUDE.md §3️⃣ 가 `lib/admin/help/<pipeline>.ts` 의 `drain` 을 정본으로 지정한다.
   ⚠️ 첫 판은 `_PROMPT.md` 개수만 세어 「11개 중 3개」라 적을 뻔했다 — 지시문은 대부분
      도움말 쪽에 있었고, 그것은 **거짓 음성**이다. 없는 것을 없다고 하려면 정본을 봐야 한다. */
// ⚠️ **따옴표 없는 키를 빠뜨리면 안 된다.** 첫 판은 `/^ {2}'([a-z0-9-]+)':/` 로만 훑어
//   `csat-*` 아홉만 찾고 **현황판 자신인 `csat:`**(따옴표 없는 식별자)을 놓쳤다. 그 결과
//   「현황판에는 화면도움말이 아예 없다」는 **거짓 결함**을 보고할 뻔했다 — 도움말은 있었다.
//   JS 객체 리터럴은 하이픈 없는 키를 따옴표 없이 쓸 수 있으므로 둘 다 받는다.
const KEY_RE = /^ {2}'?([a-z0-9-]+)'?:\s*\{/gm
const helpKeys = [...helpSrc.matchAll(KEY_RE)].map((m) => m[1]!)
/** 그 키가 원문에서 시작하는 자리 — 따옴표가 있을 수도 없을 수도 있다. */
const keyStart = (key: string): number => {
  const q = helpSrc.indexOf(`  '${key}':`)
  const u = helpSrc.indexOf(`  ${key}:`)
  return q >= 0 && (u < 0 || q < u) ? q : u
}
const helpBlocks = helpKeys.map((key, i) => {
  const start = keyStart(key)
  const end = i + 1 < helpKeys.length ? keyStart(helpKeys[i + 1]!) : helpSrc.length
  const block = helpSrc.slice(start, end)
  const drain = /^ {6}drain:\s*\{/m.test(block)
  const steps = [...block.matchAll(/^ {12}'(?:[^']|\\')*'/gm)].length
  return {
    key,
    hasDrain: drain,
    /** 각 단계가 재실행 안전 여부를 **명시**했는가 — CLAUDE.md 가 필수로 요구하는 항목. */
    rerunSafetyMentions: (block.match(/재실행 안전/g) ?? []).length,
    hasPrerequisites: /prerequisites:/.test(block),
    hasVerify: /verify:/.test(block),
    hasRecovery: /recovery:/.test(block),
    /** 되돌릴 수 없는 동작을 경고했는가. */
    hasCautions: /cautions:/.test(block),
    steps,
  }
})

const result = {
  measuredAt: new Date().toISOString(),
  help: {
    screens: helpBlocks.length,
    withDrain: helpBlocks.filter((h) => h.hasDrain).length,
    withVerify: helpBlocks.filter((h) => h.hasDrain && h.hasVerify).length,
    withRecovery: helpBlocks.filter((h) => h.hasDrain && h.hasRecovery).length,
    rerunSafetyTotal: helpBlocks.reduce((n, h) => n + h.rerunSafetyMentions, 0),
    rows: helpBlocks,
  },
  commands: {
    total: findings.length,
    missingFile: findings.filter((f) => f.script && !f.exists).length,
    undeclaredWrites: findings.filter((f) => f.mismatch.some((m) => m.includes('writes'))).length,
    noDryRun: findings.filter((f) => f.mismatch.some((m) => m.includes('dry-run'))).length,
    noResume: findings.filter((f) => f.mismatch.some((m) => m.includes('재개'))).length,
    claudeCodeSteps: findings.filter((f) => f.declaredClaudeCode).length,
    findings,
  },
  drains: {
    /** 분모는 **드레인만**이다 — 블라인드 평가 세트는 적재기가 없는 것이 정상이다. */
    total: drains.filter((d) => d.kind === 'drain').length,
    withBrief: drains.filter((d) => d.kind === 'drain' && d.brief).length,
    gated: drains.filter((d) => d.kind === 'drain' && d.gated).length,
    blindSets: drains.filter((d) => d.kind === 'blind').length,
    rows: drains,
  },
}

writeFileSync(OUT, JSON.stringify(result, null, 2) + '\n', 'utf8')

console.log('\n═══ 공장 명령 위생 ═══  ' + result.measuredAt)
console.log(
  `\n명령 ${result.commands.total}개 — 파일 없음 ${result.commands.missingFile} · 표시 없는 쓰기 ${result.commands.undeclaredWrites} · dry-run 없음 ${result.commands.noDryRun} · 재개 장치 없음 ${result.commands.noResume} · Claude Code 단계 ${result.commands.claudeCodeSteps}`,
)
for (const f of findings.filter((x) => x.mismatch.length)) {
  console.log(`\n✗ ${f.cmd}`)
  for (const m of f.mismatch) console.log(`    ${m}`)
}

console.log(
  `\n─── 드레인 ${result.drains.total}개 — 지시문 보유 ${result.drains.withBrief} · 게이트 보유 ${result.drains.gated} (별도: 블라인드 평가 세트 ${result.drains.blindSets}개, 적재기 없는 것이 정상) ───`,
)
for (const d of drains.filter((x) => x.kind === 'drain')) {
  console.log(
    `  ${d.gated ? '·' : '✗'} ${d.dir.padEnd(36)} 게이트 ${d.validateScript ? '검증기 파일' : d.inImportGate ? '적재기 안(dry-run+건너뛴 수)' : '없음'}${d.siblingChecks.length ? ` · 별도 ${d.siblingChecks.join(', ')}` : ''} · 지시문 ${d.brief ?? '전용 파일 없음'}`,
  )
}
console.log(
  `\n─── 화면도움말 (지시문 정본 · CLAUDE.md §3️⃣) — 화면 ${result.help.screens} · 드레인 절차 보유 ${result.help.withDrain} · verify ${result.help.withVerify} · recovery ${result.help.withRecovery} · 「재실행 안전」 명시 ${result.help.rerunSafetyTotal}회 ───`,
)
for (const h of helpBlocks) {
  console.log(
    `  ${h.hasDrain ? '·' : ' '} ${h.key.padEnd(16)} 드레인 ${h.hasDrain ? '있음' : '없음'}  전제 ${h.hasPrerequisites ? 'O' : '-'} 검증 ${h.hasVerify ? 'O' : '-'} 복구 ${h.hasRecovery ? 'O' : '-'} 주의 ${h.hasCautions ? 'O' : '-'}  재실행안전 ${String(h.rerunSafetyMentions).padStart(2)}회`,
  )
}

console.log(`\n→ ${path.relative(ROOT, OUT)}\n`)
