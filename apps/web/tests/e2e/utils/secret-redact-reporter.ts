// apps/web/tests/e2e/utils/secret-redact-reporter.ts
// e2e 산출물의 인증 세션 흔적 가림 reporter — 설정의 reporter 목록 **맨 앞**에 둔다.
// 2026-10-26 실패 call log · error-context · trace 에 QA 세션 쿠키가 평문으로 남아 대화에 노출됐다.
// trace · 스크린샷 · 비디오 · html 리포트는 그대로 남기고, 그 안의 쿠키 · JWT · 갱신 토큰 값만 [REDACTED] 로 바꾼다.
// - onTestEnd: 결과 객체(오류 · stdout/stderr)와 첨부 파일(error-context.md · trace.zip 등)을 다른 reporter 가 읽기 전에 가린다
// - 콘솔: 최종 출력(process.stdout/stderr)을 가린다
// - onExit: 출력 폴더 · 리포트 폴더를 한 번 더 훑는다(안전망)
import fs from 'node:fs'
import path from 'node:path'
import type { FullConfig, Reporter, TestCase, TestError, TestResult, TestStep } from '@playwright/test/reporter'
import { countSecrets, redactSecrets, redactZip } from '../../../src/lib/utils/secret-redact'

const MAX_BYTES = 200 * 1024 * 1024
const TEXT_EXT = new Set(['.md', '.txt', '.log', '.json', '.html', '.network', '.trace', '.stacks', '.ndjson', '.har'])

function redactError(e: TestError | undefined): void {
  if (!e) return
  for (const k of ['message', 'stack', 'snippet', 'value'] as const) {
    const v = e[k]
    if (typeof v === 'string' && countSecrets(v)) (e as Record<string, unknown>)[k] = redactSecrets(v)
  }
  if (e.cause) redactError(e.cause)
}

// html 리포트는 단계별 오류 · 제목을 따로 담는다 — 단계 트리까지 가린다
function redactSteps(steps: TestStep[]): void {
  for (const s of steps) {
    redactError(s.error)
    if (countSecrets(s.title)) (s as { title: string }).title = redactSecrets(s.title)
    redactSteps(s.steps)
  }
}

function redactChunks(chunks: Array<string | Buffer>): void {
  for (let i = 0; i < chunks.length; i++) {
    const c = chunks[i]
    const s = typeof c === 'string' ? c : c.toString('latin1')
    if (!countSecrets(s)) continue
    chunks[i] = typeof c === 'string' ? redactSecrets(s) : Buffer.from(redactSecrets(s), 'latin1')
  }
}

/** 파일 하나를 그 자리에서 가린다. 가린 건수를 돌려준다. */
export function redactFile(file: string): number {
  let st: fs.Stats
  try {
    st = fs.statSync(file)
  } catch {
    return 0
  }
  if (!st.isFile() || st.size > MAX_BYTES) return 0
  const buf = fs.readFileSync(file)
  if (file.endsWith('.zip')) {
    const r = redactZip(buf)
    if (!r) return 0
    fs.writeFileSync(file, r.zip)
    return r.count
  }
  if (!TEXT_EXT.has(path.extname(file)) && !/error-context|stdout|stderr/.test(path.basename(file))) return 0
  const text = buf.toString('latin1')
  const n = countSecrets(text)
  if (n) fs.writeFileSync(file, Buffer.from(redactSecrets(text), 'latin1'))
  return n
}

export function redactTree(dir: string): number {
  let n = 0
  let entries: fs.Dirent[]
  try {
    entries = fs.readdirSync(dir, { withFileTypes: true })
  } catch {
    return 0
  }
  for (const e of entries) {
    const p = path.join(dir, e.name)
    n += e.isDirectory() ? redactTree(p) : redactFile(p)
  }
  return n
}

function patchStream(stream: NodeJS.WriteStream): void {
  const write = stream.write.bind(stream) as (...a: unknown[]) => boolean
  stream.write = ((chunk: unknown, ...rest: unknown[]) => {
    if (typeof chunk === 'string' && countSecrets(chunk)) chunk = redactSecrets(chunk)
    else if (Buffer.isBuffer(chunk)) {
      const s = chunk.toString('utf8')
      if (countSecrets(s)) chunk = redactSecrets(s)
    }
    return write(chunk, ...rest)
  }) as typeof stream.write
}

export default class SecretRedactReporter implements Reporter {
  private dirs = new Set<string>()
  private redacted = 0

  constructor() {
    patchStream(process.stdout)
    patchStream(process.stderr)
  }

  onBegin(config: FullConfig): void {
    // 리포트 폴더는 설정 파일 위치 기준(Playwright 와 같은 해석)
    const base = config.configFile ? path.dirname(config.configFile) : process.cwd()
    for (const p of config.projects) this.dirs.add(p.outputDir)
    for (const [, opts] of config.reporter) {
      const o = (opts ?? {}) as { outputFolder?: string; outputFile?: string }
      if (o.outputFolder) this.dirs.add(path.resolve(base, o.outputFolder))
      if (o.outputFile) this.dirs.add(path.dirname(path.resolve(base, o.outputFile)))
    }
  }

  onTestEnd(_test: TestCase, result: TestResult): void {
    redactError(result.error)
    for (const e of result.errors) redactError(e)
    redactSteps(result.steps)
    redactChunks(result.stdout)
    redactChunks(result.stderr)
    for (const a of result.attachments) {
      if (a.path) this.redacted += redactFile(a.path)
      else if (a.body && countSecrets(a.body.toString('latin1'))) {
        a.body = Buffer.from(redactSecrets(a.body.toString('latin1')), 'latin1')
        this.redacted++
      }
    }
  }

  onError(error: TestError): void {
    redactError(error)
  }

  async onExit(): Promise<void> {
    for (const d of this.dirs) this.redacted += redactTree(d)
    if (this.redacted) process.stdout.write(`[secret-redact] 인증 세션 흔적 ${this.redacted}건을 가렸다(값 비출력)\n`)
  }

  printsToStdio(): boolean {
    return false
  }
}
