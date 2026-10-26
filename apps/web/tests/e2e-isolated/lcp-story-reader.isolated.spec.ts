// apps/web/tests/e2e-isolated/lcp-story-reader.isolated.spec.ts
//
// T-0176 LCP Story S5 — 학습자 이야기 서가(/library/stories) · 독서(/library/stories/[releaseKey]?unit=N)의 실제 클라이언트 컴포넌트를
// 실제 앱 CSS(tines 스킨) · 실제 글꼴 파일로 PC Chromium 1440×900 · 1280×900 에서 연다. 하네스: scripts/build-lcp-story-reader-harness.mts.
//
// 가짜 origin http://harness.local 에서 page.route 가 하네스 HTML · 글꼴 파일(빌드 manifest 목록) · apps/web/public 정적 파일 · 하네스 POST 만 응답하고,
// 그 밖의 모든 요청은 abort 하고 기록한다. layout.tsx 의 Pretendard CDN <link> 는 「알려진 외부(abort)」로 따로 센다 — 그 밖의 외부 요청은 0 이어야 한다.
// 서버 판정(page.tsx 의 loader 결과)과 Server Action 은 tsx 자식 프로세스 scripts/lcp/story/s5-reader-harness-eval.ts 가 **실제**
// apps/web/src/lib/library/story/learner.ts 를 가짜 쿠키 클라이언트 + S3 학습자 RPC 규칙 · 제안 story_reader_context(미적용 SQL r3)를 흉내 낸
// 메모리 가짜 DB 로 돌려 만든다. 데이터는 전부 합성(gull-rock — packages/library-pipeline/src/story/fixtures).
// 「로그인 계정」(익명 · 학습자 A · B · 정지)과 인증 이벤트(SIGNED_OUT · 사용자 전환)는 이 스펙의 테스트 제어다 — 제품 기능이 아니다.
//
// 표현하지 않는 것(정직한 경계): middleware · (main)/layout RSC 셸(AppHeader · CompassRibbon) · page.tsx RSC 실행 · 실제 쿠키 인증 ·
// PostgREST/RPC · RLS · 실제 Server Action HTTP · DB funnel 허용 목록. 컴포넌트 수준 브라우저 증거다 — live E2E 가 아니다.
//
//   pnpm.cmd --dir apps/web exec tsx scripts/build-lcp-story-reader-harness.mts --baseline
//   pnpm.cmd --dir apps/web exec tsx scripts/build-lcp-story-reader-harness.mts
//   pnpm.cmd --dir apps/web exec playwright test -c playwright.isolated.config.ts tests/e2e-isolated/lcp-story-reader.isolated.spec.ts --reporter=list
import { spawn } from 'node:child_process'
import { createHash } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import AxeBuilder from '@axe-core/playwright'
import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test'

const REPO = path.resolve(__dirname, '../../../..')
const WEB = path.join(REPO, 'apps/web')
const WORK = path.join(REPO, 'work/lcp-story-s5')
const HARNESS = path.join(WORK, 'harness')
/** 개발 중 시험 실행은 LCP_STORY_READER_SHOTS=…/shots-dev 로 따로 둔다(최종 캡처와 섞지 않는다) */
const SHOTS = process.env.LCP_STORY_READER_SHOTS ?? path.join(WORK, 'shots')
const ORIGIN = 'http://harness.local'
/** layout.tsx 가 싣는 한글 CDN 글꼴 — 하네스는 받지 않는다(abort · 기록). 이 밖의 외부 호스트는 0 이어야 한다. */
const KNOWN_EXTERNAL = new Set(['cdn.jsdelivr.net'])

// ─────────────────────────────────────────────────────────────────────────────
// 공용 — 요청 가로채기 · 기록 · 캡처
// ─────────────────────────────────────────────────────────────────────────────

export interface NetLog {
  test: string
  fulfilled: string[]
  fonts_served: number
  public_served: string[]
  known_external_aborted: string[]
  unexpected_external: string[]
  unexpected_harness: string[]
  posts: { path: string; at: number }[]
  page_errors: string[]
  console_errors: string[]
  /** 모든 문서에 걸친 계측 이벤트(대역 track 이 window.__vfEvents 에 넣는 순간 받아 둔다) */
  events: unknown[]
}
export type PostHandler = (pathname: string, body: unknown) => Promise<unknown> | unknown

function fontMap(name: string): Record<string, { path: string; sha256: string }> {
  return JSON.parse(fs.readFileSync(path.join(HARNESS, `${name}.fonts.json`), 'utf8'))
}

/** 알려진 하네스 요청만 응답하고 나머지는 abort · 기록. HTML 은 html(url) 가 만든다. */
export async function harness(context: BrowserContext, name: string, opts: { htmlName: string; html: (url: URL) => Promise<string> | string; onPost?: PostHandler }): Promise<NetLog> {
  const log: NetLog = { test: name, fulfilled: [], fonts_served: 0, public_served: [], known_external_aborted: [], unexpected_external: [], unexpected_harness: [], posts: [], page_errors: [], console_errors: [], events: [] }
  const fonts = fontMap(opts.htmlName)
  const watch = (p: Page) => {
    p.on('pageerror', (e) => log.page_errors.push(String(e.message).slice(0, 400)))
    p.on('console', (m) => {
      // 하네스가 abort 한 요청의 「Failed to load resource」 는 abort 기록이 따로 센다
      if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) log.console_errors.push(m.text().slice(0, 400))
    })
  }
  context.pages().forEach(watch)
  context.on('page', watch)
  await context.exposeFunction('__vfRecordEvent', (e: unknown) => {
    log.events.push(e)
  })
  await context.addInitScript(() => {
    const w = window as unknown as { __vfEvents: unknown[]; __vfRecordEvent?: (e: unknown) => void }
    const arr: unknown[] = []
    arr.push = (...xs: unknown[]) => {
      for (const x of xs) w.__vfRecordEvent?.(JSON.parse(JSON.stringify(x)))
      return Array.prototype.push.apply(arr, xs)
    }
    w.__vfEvents = arr
  })
  await context.route('**/*', async (route: Route) => {
    const req = route.request()
    const url = new URL(req.url())
    if (url.origin !== ORIGIN) {
      const bucket = KNOWN_EXTERNAL.has(url.host) ? log.known_external_aborted : log.unexpected_external
      if (!bucket.includes(url.host)) bucket.push(url.host)
      return route.abort('blockedbyclient')
    }
    if (req.method() === 'GET' && fonts[url.pathname]) {
      log.fonts_served += 1
      return route.fulfill({ contentType: 'font/woff2', body: fs.readFileSync(path.join(REPO, fonts[url.pathname]!.path)) })
    }
    if (req.method() === 'GET' && /^\/(illustrations|images|art)\//.test(url.pathname)) {
      const file = path.join(WEB, 'public', decodeURIComponent(url.pathname))
      if (file.startsWith(path.join(WEB, 'public')) && fs.existsSync(file) && fs.statSync(file).isFile()) {
        log.public_served.push(url.pathname)
        const ext = path.extname(file).slice(1)
        return route.fulfill({ contentType: ext === 'svg' ? 'image/svg+xml' : `image/${ext}`, body: fs.readFileSync(file) })
      }
    }
    if (req.method() === 'GET' && (url.pathname === '/library' || url.pathname.startsWith('/library/')) && req.resourceType() === 'document') {
      log.fulfilled.push(`GET ${url.pathname}${url.search}`)
      return route.fulfill({ contentType: 'text/html; charset=utf-8', body: await opts.html(url) })
    }
    if (req.method() === 'POST' && opts.onPost && /^\/(__page|__story\/[A-Za-z0-9_$]+|__action\/[A-Za-z0-9_$]+)$/.test(url.pathname)) {
      log.posts.push({ path: url.pathname, at: Date.now() })
      log.fulfilled.push(`POST ${url.pathname}`)
      const out = await opts.onPost(url.pathname, req.postDataJSON())
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(out) })
    }
    log.unexpected_harness.push(`${req.method()} ${url.pathname}`)
    return route.abort('blockedbyclient')
  })
  return log
}

export function writeNetLog(log: NetLog) {
  fs.mkdirSync(WORK, { recursive: true })
  fs.appendFileSync(path.join(WORK, 'network-log.jsonl'), `${JSON.stringify({ ...log, observed_at: new Date().toISOString() })}\n`)
}

/** 외부 요청: 알려진 CDN 글꼴만 abort 로 기록되고 그 밖은 0 · 하네스가 모르는 harness.local 요청 0 · pageerror 0 */
export function assertQuietNetwork(log: NetLog) {
  expect(log.unexpected_external, 'unexpected external hosts').toEqual([])
  expect(log.unexpected_harness, 'unknown harness requests').toEqual([])
  expect(log.page_errors, 'page errors').toEqual([])
  for (const h of log.known_external_aborted) expect(KNOWN_EXTERNAL.has(h)).toBe(true)
  // 모든 문서의 계측: 닫힌 두 이름 · 닫힌 속성만 · 값에 id · URL · 본문 없음
  for (const e of log.events as { name: string; props: Record<string, unknown> }[]) {
    expect(['story_catalog_viewed', 'story_reader_action']).toContain(e.name)
    expect(Object.keys(e.props).sort()).toEqual(e.name === 'story_catalog_viewed' ? ['editions', 'signed_in', 'works'] : ['action', 'completed', 'coverage', 'kind', 'unit_index'])
    expect(JSON.stringify(e)).not.toMatch(/lsr_|https?:|javascript:|data:|Gull|Mara|lighthouse|00000000-0000-4000-8000/i)
  }
}

export async function overflow(page: Page) {
  return page.evaluate(() => {
    const s = document.scrollingElement!
    return { scrollWidth: s.scrollWidth, clientWidth: s.clientWidth }
  })
}
export const noOverflow = async (page: Page) => expect.poll(() => overflow(page).then((o) => o.scrollWidth <= o.clientWidth)).toBe(true)

/**
 * 캡처는 **덮어쓰지 않는다**: `<name>.png` 가 이미 있으면 `<name>.r2.png` · `.r3` … 로 쓴다. 전체 페이지(맨 위부터)와 지금 뷰포트 두 장.
 * 모든 캡처의 sha256 을 work/lcp-story-s5/shots-index.jsonl 에 남긴다.
 */
export async function shot(page: Page, name: string): Promise<string> {
  fs.mkdirSync(SHOTS, { recursive: true })
  let n = 1
  const fileOf = (suffix: string) => path.join(SHOTS, `${name}${n > 1 ? `.r${n}` : ''}${suffix}.png`)
  while (fs.existsSync(fileOf('')) || fs.existsSync(fileOf('.viewport'))) n += 1
  const full = fileOf('')
  const viewport = fileOf('.viewport')
  await page.screenshot({ path: viewport })
  const y = await page.evaluate(() => window.scrollY)
  const active = await page.evaluate(() => (document.activeElement as HTMLElement | null)?.id || null)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: full, fullPage: true })
  await page.evaluate((top) => window.scrollTo(0, top), y)
  for (const f of [full, viewport]) {
    fs.appendFileSync(path.join(WORK, 'shots-index.jsonl'), `${JSON.stringify({ file: path.relative(REPO, f).replace(/\\/g, '/'), sha256: createHash('sha256').update(fs.readFileSync(f)).digest('hex'), active_id: active, at: new Date().toISOString() })}\n`)
  }
  return full
}

/**
 * 글꼴 충실도 — document.fonts.check 는 대체 글꼴로도 참이 된다. 그래서 (1) load() 가 돌려준 FontFace 가 비어 있지 않고 전부 loaded 인지,
 * (2) CDP CSS.getPlatformFontsForNode 로 **실제로 그 노드를 그린 글꼴**이 무엇인지(사용자 정의 글꼴 여부 포함) 본다.
 * 한글 산세리프(Pretendard)는 CDN 이라 하네스에 없다 — 한글이 시스템 글꼴로 그려지는 것을 숨기지 않고 기록한다.
 */
export async function fontEvidence(page: Page, label: string, probes: { selector: string; expectCustom?: string }[]) {
  const loaded = await page.evaluate(async () => {
    const specs = [
      ['400 16px "Figtree"', 'Story 012'], ['600 16px "Figtree"', 'Story'], ['700 16px "Figtree"', 'Story'],
      ['400 16px "Petrona"', 'Story'], ['700 16px "Petrona"', 'Story'], ['400 16px "Space Mono"', '0123'],
      ['400 16px "Hahmlet"', '이야기 판본'],
    ]
    const out = []
    for (const [spec, text] of specs) {
      const faces = await document.fonts.load(spec!, text)
      out.push({ spec, count: faces.length, statuses: faces.map((f) => f.status) })
    }
    await document.fonts.ready
    const families = new Map<string, string[]>()
    document.fonts.forEach((f) => { if (f.status === 'loaded') families.set(f.family, [...(families.get(f.family) ?? []), f.weight]) })
    return { out, loaded_families: [...families.entries()].map(([family, weights]) => ({ family, weights: [...new Set(weights)] })), pretendard_faces: [...document.fonts].filter((f) => /Pretendard/i.test(f.family)).length, body_family: getComputedStyle(document.body).fontFamily }
  })
  for (const item of loaded.out) {
    expect(item.count, `${item.spec} FontFace`).toBeGreaterThan(0)
    expect(item.statuses.every((s) => s === 'loaded'), `${item.spec} loaded`).toBe(true)
  }
  const cdp = await page.context().newCDPSession(page)
  await cdp.send('DOM.enable')
  await cdp.send('CSS.enable')
  const { root } = await cdp.send('DOM.getDocument', { depth: 0 })
  const rendered: { selector: string; fonts: { familyName: string; isCustomFont: boolean; glyphCount: number }[] }[] = []
  for (const probe of probes) {
    const { nodeId } = await cdp.send('DOM.querySelector', { nodeId: root.nodeId, selector: probe.selector })
    if (!nodeId) { rendered.push({ selector: probe.selector, fonts: [] }); continue }
    const r = await cdp.send('CSS.getPlatformFontsForNode', { nodeId })
    rendered.push({ selector: probe.selector, fonts: r.fonts })
    if (probe.expectCustom) {
      const names = r.fonts.filter((f) => f.isCustomFont).map((f) => f.familyName)
      expect(names.join(','), `${probe.selector} rendered with ${probe.expectCustom}`).toContain(probe.expectCustom)
    }
  }
  await cdp.detach()
  const record = { label, ...loaded, rendered }
  fs.appendFileSync(path.join(WORK, 'fonts-evidence.jsonl'), `${JSON.stringify({ ...record, at: new Date().toISOString() })}\n`)
  return record
}

// ─────────────────────────────────────────────────────────────────────────────
// 기준선 — 기존 Library(Books 면 · PC 레일). HEAD 코드로 구운 baseline-library.html(빌더 --baseline)
// ─────────────────────────────────────────────────────────────────────────────

const BASELINE_HTML = path.join(HARNESS, 'baseline-library.html')

test.describe('기준선 · 기존 Library', () => {
  test.skip(!fs.existsSync(BASELINE_HTML), 'baseline harness not built — run build-lcp-story-reader-harness.mts --baseline')
  for (const width of [1440, 1280] as const) {
    test(`Books 면 · 자료 유형 레일 @${width}`, async ({ page, context }) => {
      await page.setViewportSize({ width, height: 900 })
      const html = fs.readFileSync(BASELINE_HTML, 'utf8')
      const log = await harness(context, `baseline@${width}`, { htmlName: 'baseline-library', html: () => html })
      try {
        await page.goto(`${ORIGIN}/library/books`)
        await expect(page.locator('[data-reader-harness-ready="baseline"]')).toBeVisible()
        const tabs = page.getByRole('tablist', { name: '라이브러리 탭' })
        await expect(tabs).toBeVisible()
        const tabNames = await tabs.getByRole('tab').allInnerTexts()
        fs.writeFileSync(path.join(WORK, `baseline-tabs-${width}.json`), `${JSON.stringify({ tabNames: tabNames.map((t) => t.trim()) }, null, 2)}\n`)
        await expect(page.getByRole('heading', { level: 1 }).first()).toBeVisible()
        await fontEvidence(page, `baseline-books@${width}`, [{ selector: 'h1', expectCustom: 'Figtree' }])
        await noOverflow(page)
        await shot(page, `baseline-library-books-${width}`)

        await page.goto(`${ORIGIN}/library/scripts`)
        await expect(page.locator('[data-reader-harness-ready="baseline"]')).toBeVisible()
        const rail = page.getByRole('navigation', { name: '서가 자료 유형' })
        await expect(rail).toBeVisible()
        fs.writeFileSync(path.join(WORK, `baseline-rail-${width}.json`), `${JSON.stringify({ railNames: (await rail.getByRole('link').allInnerTexts()).map((t) => t.trim()) }, null, 2)}\n`)
        await noOverflow(page)
        await shot(page, `baseline-library-rail-${width}`)
      } finally {
        writeNetLog(log)
      }
      assertQuietNetwork(log)
    })
  }
})

// ─────────────────────────────────────────────────────────────────────────────
// 현재 — 이야기 서가 · 독서(실제 StoryCatalog · StoryReader + 실제 learner.ts 자식 프로세스 + 메모리 가짜 DB)
// ─────────────────────────────────────────────────────────────────────────────

const READER_HTML = path.join(HARNESS, 'reader-harness.html')
const TSX = path.join(REPO, 'node_modules/tsx/dist/cli.mjs')
const FIX = path.join(WORK, 'reader-fixtures')
const sx = expect.configure({ timeout: 15_000 })

interface FixtureManifest {
  users: { A: string; B: string; S: string }
  release_keys: { B1: string; A2: string; EP: string; WD: string; RH: string }
}
interface DbRelease {
  release_key: string
  title: string
  hook_text: string
  units: { unit_index: number; unit_title: string | null; body: string; anchors: { paragraph: number; quote: string }[] }[]
  source: { source_url: string | null; edition_label: string; title: string }
  withdrawn_at: string | null
  rights_ok: boolean
  context_notes: { id: string; unit_ids: string[]; text: string }[]
}
interface DbState {
  releases: DbRelease[]
  progress: { user_id: string; release_key: string; last_unit_index: number; furthest_unit_index: number; completed_units: number[]; completed_at: string | null }[]
  faults: Record<string, { kind: 'network' | 'error'; times: number; message?: string }>
  reader_context_missing: boolean
  /** U1 안내 RPC 없음(제안 SQL 미적용 — 공유 DB 의 지금 상태) */
  guidance_missing: boolean
  /** 안내 결속이 깨진 발행 키(이용 가능하면 안내 호출 전체가 story:guidance_mismatch) */
  guidance_corrupt: string[]
  /** W2 맥락 설명 RPC 없음(제안 SQL 미적용 — 공유 DB 의 지금 상태) */
  context_notes_missing: boolean
  /** 맥락 설명 결속이 깨진 발행 키(story:context_notes_mismatch) */
  context_notes_corrupt: string[]
  /** 맥락 설명 응답이 다른 단위 번호를 말하는 발행 키(어긋난 · 늦은 응답 흉내) */
  context_notes_wrong_unit: string[]
  catalog_hide: string[]
  profiles: Record<string, { status: string }>
}
interface RpcCall {
  fn: string
  actor: string | null
  result: string
  code?: string
  args?: { p_release_key?: string; p_unit_index?: number }
}

let FM: FixtureManifest
let DB0: DbState
const readerTemplate = () => fs.readFileSync(READER_HTML, 'utf8')

/** 자식 프로세스 최소 환경 — .env · Supabase 자격은 넘기지 않는다(S4 와 같음). */
function childEnv(): Record<string, string> {
  const env: Record<string, string> = { NODE_OPTIONS: '--conditions=react-server' }
  for (const key of ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'windir', 'ComSpec', 'TEMP', 'TMP', 'USERPROFILE', 'HOME', 'APPDATA', 'LOCALAPPDATA']) {
    const value = process.env[key]
    if (value) env[key] = value
  }
  return env
}

function runChild(script: string, input: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [TSX, script], { cwd: REPO, env: childEnv() as NodeJS.ProcessEnv })
    let out = ''
    let err = ''
    child.stdout.on('data', (d) => (out += d))
    child.stderr.on('data', (d) => (err += d))
    child.on('close', (code) => (code === 0 ? resolve(out) : reject(new Error(`${script} exit ${code}: ${err.slice(0, 2000)}`))))
    child.stdin.end(input)
  })
}

interface Run {
  name: string
  statePath: string
  /** 서버 쪽(쿠키 세션) 로그인 계정 — 스펙의 테스트 제어 */
  actor: string | null
  /** 브라우저 Supabase 세션이 처음에 말하는 계정(기본 = actor) */
  browserUser: string | null | undefined
  /** 브라우저 세션 기준선(INITIAL_SESSION · getSession)을 스펙이 window.__vfAuthResolve 로 풀 때까지 늦춘다 */
  authManual: boolean
  actions: { name: string; args: unknown }[]
  pages: string[]
  rpc: RpcCall[]
  payloads: string[]
  hold: Map<string, Promise<void>>
  lose: Map<string, number>
  queue: Promise<unknown>
  /** 자식 평가 호출마다: 무엇을 했고 그 호출이 가짜 DB 에 부른 RPC 는 무엇인가 */
  calls: { op: string; what: string; value: unknown; rpc: RpcCall[] }[]
}

function newRun(name: string, mutate?: (db: DbState) => void): Run {
  const statePath = path.join(WORK, 'state', `${name}.json`)
  fs.mkdirSync(path.dirname(statePath), { recursive: true })
  const db = JSON.parse(JSON.stringify(DB0)) as DbState
  mutate?.(db)
  fs.writeFileSync(statePath, JSON.stringify(db))
  return { name, statePath, actor: FM.users.A, browserUser: undefined, authManual: false, actions: [], pages: [], rpc: [], payloads: [], hold: new Map(), lose: new Map(), queue: Promise.resolve(), calls: [] }
}

const readDb = (run: Run) => JSON.parse(fs.readFileSync(run.statePath, 'utf8')) as DbState
function editDb(run: Run, fn: (db: DbState) => void) {
  const db = readDb(run)
  fn(db)
  fs.writeFileSync(run.statePath, JSON.stringify(db))
}
const progressOf = (run: Run, user: string, key: string) => readDb(run).progress.find((p) => p.user_id === user && p.release_key === key) ?? null

/** 서버 쪽 평가를 한 줄로 세운다(가짜 DB 파일 읽기-쓰기 경합 방지). 응답 지연(hold)은 평가가 끝난 뒤 — 「서버는 저장했고 응답이 오는 중」 이다. */
function evalServer(run: Run, input: Record<string, unknown>): Promise<unknown> {
  const p = run.queue.then(async () => {
    const out = JSON.parse(await runChild('scripts/lcp/story/s5-reader-harness-eval.ts', JSON.stringify({ ...input, statePath: run.statePath, actor: run.actor }))) as { value: unknown; rpc_calls: RpcCall[] }
    run.rpc.push(...out.rpc_calls)
    run.calls.push({ op: String(input.op), what: String(input.name ?? input.url), value: out.value, rpc: out.rpc_calls })
    return out.value
  })
  run.queue = p.catch(() => undefined)
  return p
}

async function pageState(run: Run, url: string): Promise<Record<string, unknown>> {
  run.pages.push(url)
  if (new URL(url, ORIGIN).pathname.startsWith('/library/books')) return { kind: 'books', url }
  const value = (await evalServer(run, { op: 'page', url })) as Record<string, unknown>
  run.payloads.push(JSON.stringify(value))
  return value
}

const esc = (v: unknown) => JSON.stringify(v).replace(/</g, '\\u003c')

async function readerHarness(context: BrowserContext, name: string, run: Run) {
  const template = readerTemplate()
  return harness(context, name, {
    htmlName: 'reader-harness',
    html: async (url) => {
      const page = await pageState(run, url.pathname + url.search)
      const browser = run.browserUser === undefined ? run.actor : run.browserUser
      return template.replace('<!--VF_PAGE-->', `<script>window.__VF_PAGE__=${esc(page)};window.__VF_AUTH_USER__=${esc(browser ? { id: browser } : null)};window.__VF_AUTH_DELAY__=${run.authManual ? '"manual"' : '0'};</script>`)
    },
    onPost: async (pathname, body) => {
      if (pathname === '/__page') {
        // 이동 · refresh 응답 지연(holdNext(run, '__page')) — 서버 판정은 끝났고 응답이 오는 중이다
        const value = await pageState(run, (body as { url: string }).url)
        const gate = run.hold.get('__page')
        if (gate) await gate
        return value
      }
      const m = /^\/__story\/([A-Za-z0-9_$]+)$/.exec(pathname)
      if (!m) return { value: { ok: false, error: 'harness: not wired' } }
      const name = m[1]!
      const args = (body as { args: unknown[] }).args
      run.actions.push({ name, args: args[0] })
      const value = await evalServer(run, { op: 'action', name, args })
      const gate = run.hold.get(name)
      if (gate) await gate
      const lost = run.lose.get(name) ?? 0
      if (lost > 0) {
        run.lose.set(name, lost - 1)
        return { __throw: 'harness: response lost after the server committed' }
      }
      return { value }
    },
  })
}

/** 다음 응답 하나를 붙잡는다 — 돌려준 함수로 놓아준다. */
function holdNext(run: Run, name: string): () => void {
  let release!: () => void
  run.hold.set(name, new Promise<void>((r) => (release = r)))
  return () => {
    run.hold.delete(name)
    release()
  }
}

function faultOnce(run: Run, fn: string, kind: 'network' | 'error' = 'network') {
  editDb(run, (db) => {
    db.faults[fn] = { kind, times: 1 }
  })
}

const WRITE_FNS = new Set(['story_record_position', 'story_complete_unit'])
const writes = (run: Run) => run.rpc.filter((c) => WRITE_FNS.has(c.fn))

function finishRun(run: Run, log: NetLog) {
  writeNetLog(log)
  fs.mkdirSync(path.join(WORK, 'runs'), { recursive: true })
  fs.writeFileSync(path.join(WORK, 'runs', `${run.name}.json`), `${JSON.stringify({ actions: run.actions, pages: run.pages, calls: run.calls.map((c) => ({ op: c.op, what: c.what, rpc: c.rpc.map((r) => `${r.fn}:${r.result}${r.code ? `:${r.code}` : ''}`) })) }, null, 2)}\n`)
}

/** 텔레메트리 — 두 이름만, 닫힌 속성만, 값에 id · URL · 본문 없음. 보낸 것 목록을 돌려준다. */
async function closedTelemetry(page: Page): Promise<{ name: string; props: Record<string, unknown> }[]> {
  const events = (await page.evaluate(() => (window as unknown as { __vfEvents?: unknown[] }).__vfEvents ?? [])) as { name: string; props: Record<string, unknown> }[]
  for (const e of events) {
    expect(['story_catalog_viewed', 'story_reader_action']).toContain(e.name)
    if (e.name === 'story_catalog_viewed') {
      expect(Object.keys(e.props).sort()).toEqual(['editions', 'signed_in', 'works'])
      expect(Number.isInteger(e.props.works) && Number.isInteger(e.props.editions) && typeof e.props.signed_in === 'boolean').toBe(true)
    } else {
      expect(Object.keys(e.props).sort()).toEqual(['action', 'completed', 'coverage', 'kind', 'unit_index'])
      expect(['start', 'resume', 'navigate', 'unit_complete', 'source_open', 'edition_switch']).toContain(e.props.action)
      expect(['story_edition', 'easy_reader']).toContain(e.props.kind)
      expect(['complete_work', 'episode', 'excerpt']).toContain(e.props.coverage)
      expect(Number.isInteger(e.props.unit_index)).toBe(true)
      expect(typeof e.props.completed).toBe('boolean')
    }
    const text = JSON.stringify(e)
    for (const id of Object.values(FM.users)) expect(text).not.toContain(id)
    expect(text).not.toMatch(/lsr_|https?:|javascript:|data:|Gull|Mara/)
  }
  return events
}

/** viewerId · 사용자 id 가 URL · 저장소 · 이동 기록 · 그려진 DOM 에 없다(window.__VF_PAGE__ 는 RSC 직렬화 payload 대역이라 제외). */
async function noIdentityLeak(page: Page, probes: string[] = []) {
  const dump = await page.evaluate(() => {
    const all = (s: Storage) => Array.from({ length: s.length }, (_, i) => `${s.key(i)}=${s.getItem(s.key(i)!) ?? ''}`).join('\n')
    return {
      href: location.href,
      nav: ((window as unknown as { __vfNav?: { url: string }[] }).__vfNav ?? []).map((n) => n.url).join('\n'),
      storage: `${all(localStorage)}\n${all(sessionStorage)}`,
      cookie: document.cookie,
      dom: document.getElementById('root')?.innerHTML ?? '',
    }
  })
  for (const id of Object.values(FM.users)) {
    for (const [k, v] of Object.entries(dump)) expect(v, `${k} contains a user id`).not.toContain(id)
  }
  for (const probe of probes) {
    expect(dump.storage).not.toContain(probe)
    expect(dump.href + dump.nav).not.toContain(probe)
  }
}

const B = (page: Page) => page.locator('[data-story-body]')
const statusDock = (page: Page) => page.locator('[data-story-status]')
const heading = (page: Page) => page.locator('#story-unit-heading')
const tocLink = (page: Page, i: number) => page.locator(`[data-story-toc] [data-story-go="toc"][data-unit="${i}"]`)
const completeBtn = (page: Page) => page.locator('button[data-story-complete]')
const unitText = (key: string, i: number) => DB0.releases.find((r) => r.release_key === key)!.units[i]!.body
const probeOf = (key: string, i: number) => unitText(key, i).slice(0, 40)
const search = (page: Page) => new URL(page.url()).searchParams

async function openStories(page: Page, pathAndQuery: string) {
  await page.goto(`${ORIGIN}${pathAndQuery}`)
  await sx(page.locator('[data-reader-harness-ready]')).toBeVisible()
}

/** 위치 기록 → 이동까지 기다린다(URL 의 unit 값 · 단위 제목). */
async function goUnit(page: Page, link: ReturnType<Page['locator']>, unit: number) {
  await link.click()
  await sx.poll(() => search(page).get('unit')).toBe(String(unit))
  await sx(heading(page)).toContainText(`${unit + 1}번째 단위`)
}

async function markUnit(page: Page, unit: number) {
  await completeBtn(page).click()
  await sx(page.locator(`[data-story-complete="marked"][data-unit="${unit}"]`)).toBeVisible()
}

test.describe('현재 · 이야기 서가 · 독서', () => {
  test.skip(!fs.existsSync(READER_HTML), 'reader harness not built — run build-lcp-story-reader-harness.mts')
  test.use({ actionTimeout: 10_000 })
  test.beforeAll(async () => {
    await runChild('scripts/lcp/story/s5-reader-fixtures.ts', '')
    FM = JSON.parse(fs.readFileSync(path.join(FIX, 'manifest.json'), 'utf8')) as FixtureManifest
    DB0 = JSON.parse(fs.readFileSync(path.join(FIX, 'db.json'), 'utf8')) as DbState
  })

  for (const width of [1440, 1280] as const) {
    test.describe(`@${width}`, () => {
      test.use({ viewport: { width, height: 900 } })

      test('익명 서가 — 메타 · HOOK · 로그인 복귀 링크, 본문 없음 · 익명 직접 링크', async ({ page, context }) => {
        const run = newRun(`anon-${width}`)
        run.actor = null
        const log = await readerHarness(context, `anon@${width}`, run)
        try {
          await openStories(page, '/library/stories')
          await sx(page.getByRole('heading', { level: 1, name: 'Stories' })).toBeVisible()
          await sx(page.locator('[data-story-counts]')).toHaveText(/작품\s*2\s*편\s*·\s*판본\s*3\s*개/)
          const hooks = page.locator('[data-story-hook]')
          await sx(hooks).toHaveCount(2)
          await sx(hooks.first()).toBeVisible()
          // HOOK 이 시작 행동보다 먼저(문서 순서)
          const hookFirst = await page.evaluate(() => {
            const hook = document.querySelector('[data-story-hook]')!
            const open = document.querySelector('[data-story-open]')!
            return !!(hook.compareDocumentPosition(open) & Node.DOCUMENT_POSITION_FOLLOWING)
          })
          expect(hookFirst).toBe(true)
          const logins = page.locator('[data-story-open="login"]')
          await sx(logins).toHaveCount(3)
          for (const href of await logins.evaluateAll((els) => els.map((e) => e.getAttribute('href')))) expect(href).toBe('/login?next=%2Flibrary%2Fstories')
          await sx(page.locator('[data-story-open="reader"]')).toHaveCount(0)
          expect(await page.locator('#root').innerText()).not.toContain(probeOf(FM.release_keys.B1, 0))
          expect(run.payloads.join('\n')).not.toContain(probeOf(FM.release_keys.B1, 0))
          expect(run.rpc.map((c) => c.fn)).toEqual(['story_catalog', 'story_release_guidance'])
          await noOverflow(page)
          await fontEvidence(page, `catalog-anon@${width}`, [
            { selector: 'h1', expectCustom: 'Petrona' },
            { selector: '[data-story-hook]', expectCustom: 'Petrona' },
            { selector: '[data-story-counts]', expectCustom: 'Figtree' },
          ])
          await shot(page, `current-catalog-anon-${width}`)
          // 라이브러리 탭 줄 · 레일(현재 작업 트리) — 기준선 비교용
          const tabs = page.getByRole('tablist', { name: '라이브러리 탭' })
          fs.writeFileSync(path.join(WORK, `current-tabs-${width}.json`), `${JSON.stringify({ tabNames: (await tabs.getByRole('tab').allInnerTexts()).map((t) => t.trim()), railNames: (await page.getByRole('navigation', { name: '서가 자료 유형' }).getByRole('link').allInnerTexts()).map((t) => t.trim()) }, null, 2)}\n`)

          // 익명 직접 링크(?unit=1) — 메타 · HOOK · 로그인(복귀 = 그 단위), 본문 · 목차 · 앵커 없음
          await openStories(page, `/library/stories/${FM.release_keys.B1}?unit=1`)
          await sx(page.locator('[data-story-reader="signed_out"]')).toBeVisible()
          await sx(page.locator('[data-story-login]')).toHaveAttribute('href', `/login?next=${encodeURIComponent(`/library/stories/${FM.release_keys.B1}?unit=1`)}`)
          await sx(page.locator('[data-story-hook]')).toHaveText(DB0.releases.find((r) => r.release_key === FM.release_keys.B1)!.hook_text)
          await sx(B(page)).toHaveCount(0)
          await sx(page.locator('[data-story-toc]')).toHaveCount(0)
          expect(await page.locator('#root').innerText()).not.toContain(probeOf(FM.release_keys.B1, 1))
          expect(run.payloads.join('\n')).not.toContain(probeOf(FM.release_keys.B1, 1))
          expect(run.rpc.map((c) => c.fn)).toEqual(['story_catalog', 'story_release_guidance', 'story_catalog', 'story_release_guidance'])
          expect(writes(run)).toEqual([])
          await noOverflow(page)
          await shot(page, `current-reader-signed-out-${width}`)
          const events = await closedTelemetry(page)
          expect(events).toEqual([])
          await noIdentityLeak(page)
        } finally {
          finishRun(run, log)
        }
        assertQuietNetwork(log)
      })

      test('빈 서가 · 조회 실패 — 지어낸 수 없음 · 실패를 빈 서가로 보이지 않음 · 다시 시도', async ({ page, context }) => {
        const empty = newRun(`empty-${width}`, (db) => {
          db.releases = []
          db.progress = []
        })
        empty.actor = null
        const log = await readerHarness(context, `empty@${width}`, empty)
        try {
          await openStories(page, '/library/stories')
          await sx(page.getByText('아직 공개된 이야기가 없어요')).toBeVisible()
          await sx(page.locator('[data-story-counts]')).toHaveCount(0)
          await sx(page.locator('[data-story-work]')).toHaveCount(0)
          expect(await page.locator('[data-story-catalog]').innerText()).not.toMatch(/\d+\s*편|\d+\s*개/)
          const events = await closedTelemetry(page)
          expect(events).toEqual([{ name: 'story_catalog_viewed', props: { works: 0, editions: 0, signed_in: false } }])
          await shot(page, `current-catalog-empty-${width}`)

          // 조회 실패 — 같은 화면을 실패로(빈 서가 문구 없음 · 이벤트 없음) → 다시 시도(router.refresh) → 서가
          editDb(empty, (db) => {
            db.releases = DB0.releases
            db.faults.story_catalog = { kind: 'network', times: 1 }
          })
          await page.reload()
          await sx(page.locator('[data-story-catalog="error"]')).toBeVisible()
          await sx(page.getByText('이야기 서가를 불러오지 못했어요')).toBeVisible()
          await sx(page.getByText('아직 공개된 이야기가 없어요')).toHaveCount(0)
          expect(await closedTelemetry(page)).toEqual([])
          await noOverflow(page)
          await shot(page, `current-catalog-error-${width}`)
          await page.getByRole('button', { name: '다시 시도' }).click()
          await sx(page.locator('[data-story-catalog="ready"]')).toBeVisible()
          await sx(page.locator('[data-story-counts]')).toHaveText(/작품\s*2\s*편\s*·\s*판본\s*3\s*개/)
          expect(await closedTelemetry(page)).toEqual([{ name: 'story_catalog_viewed', props: { works: 2, editions: 3, signed_in: false } }])
        } finally {
          finishRun(empty, log)
        }
        assertQuietNetwork(log)
      })

      test('로그인 — 작품 → 판본 → 입구(기록 없음) · 명시적 시작 · 이동 ≠ 완료 · 마지막만 표시는 미완 · 전 단위 표시 뒤 각색 완독', async ({ page, context }) => {
        test.setTimeout(300_000)
        const run = newRun(`flow-${width}`)
        const key = FM.release_keys.B1
        const log = await readerHarness(context, `flow@${width}`, run)
        try {
          await openStories(page, '/library/stories')
          await sx(page.locator('[data-story-counts]')).toBeVisible()
          // 학습자 A 의 철회된 판본 기록은 기록으로만(링크 없음)
          const history = page.locator('[data-story-history]')
          await sx(history).toContainText('열 수 없는 판본')
          await sx(history.locator('a')).toHaveCount(0)
          await shot(page, `current-catalog-signed-in-${width}`)
          expect(writes(run)).toEqual([])

          // 작품 → 판본(Story Edition B1) 고르기 → 입구
          const work = page.locator('[data-story-work]').filter({ has: page.getByRole('heading', { name: /The Keeper of Gull Rock/ }) })
          await work.locator('[data-story-release]').filter({ hasText: '8단위' }).locator('[data-story-open="reader"]').click()
          await sx.poll(() => new URL(page.url()).pathname).toBe(`/library/stories/${key}`)
          await sx(page.locator('[data-story-reader="entry"]')).toBeVisible()
          await sx(page.locator('[data-story-progress]')).toContainText('아직 읽은 기록이 없어요')
          await sx(page.locator('[data-story-toc] li')).toHaveCount(8)
          await sx(page.locator('[data-story-go="start"]')).toHaveText('처음부터 읽기')
          await sx(B(page)).toHaveCount(0)
          // 시작 전: HOOK · 편집 목표(진단 아님) · 원천 줄(원작 언어 · 본문 언어 · 원천 판본)이 시작 행동보다 앞에
          await sx(page.locator('[data-story-entry-public] [data-story-hook]')).toHaveText(DB0.releases.find((r) => r.release_key === key)!.hook_text)
          await sx(page.locator('[data-story-target]')).toContainText(/편집 목표.*B1/)
          await sx(page.locator('[data-story-target]')).toContainText('진단 결과가 아니에요')
          await sx(page.locator('[data-story-source-line]')).toContainText(/원작 언어 영어 · 본문 언어 영어 · 원천 판본/)
          expect(await page.evaluate(() => {
            const order = ['[data-story-hook]', '[data-story-target]', '[data-story-source-line]', '[data-story-go="start"]'].map((q) => document.querySelector(q)!)
            return order.every((el, i) => i === 0 || !!(order[i - 1]!.compareDocumentPosition(el) & Node.DOCUMENT_POSITION_FOLLOWING))
          })).toBe(true)
          await noOverflow(page)
          await shot(page, `current-reader-entry-${width}`)

          // GET · 새로 고침 · 주소로 이동은 기록하지 않는다
          await page.reload()
          await sx(page.locator('[data-story-reader="entry"]')).toBeVisible()
          await openStories(page, `/library/stories/${key}?unit=3`)
          await sx(heading(page)).toHaveText('4번째 단위')
          await sx(B(page)).toContainText(probeOf(key, 3))
          await page.reload()
          await sx(B(page)).toContainText(probeOf(key, 3))
          expect(writes(run), 'render / reload / URL navigation must not write').toEqual([])
          expect(progressOf(run, FM.users.A, key)).toBeNull()

          // 입구로 돌아가 명시적 시작 → 위치 기록(start 0) → 단위 0 본문 · 제목 초점
          await openStories(page, `/library/stories/${key}`)
          await goUnit(page, page.locator('[data-story-go="start"]'), 0)
          expect(writes(run).map((c) => `${c.fn}:${c.args?.p_unit_index}`)).toEqual(['story_record_position:0'])
          expect(run.actions.at(-1)).toEqual({ name: 'recordStoryPositionAction', args: { releaseKey: key, unitIndex: 0, reason: 'start', expectedViewerId: FM.users.A } })
          await sx(B(page)).toContainText(probeOf(key, 0))
          await sx(heading(page)).toBeFocused()
          await noOverflow(page)
          await shot(page, `current-reader-unit0-${width}`)

          // 읽음 표시(단위 0) — 상태 알림이 뷰포트 안 · 완료 수 1/8
          await markUnit(page, 0)
          await sx(statusDock(page)).toContainText('1번째 단위 — 읽음으로 표시했어요 · 완료 표시 1/8')
          await sx(statusDock(page)).toBeInViewport()
          expect(progressOf(run, FM.users.A, key)!.completed_units).toEqual([0])

          // 다음 단위 = 위치 기록만(완료 아님)
          await goUnit(page, page.locator('[data-story-go="next"]'), 1)
          await sx(heading(page)).toBeFocused()
          let p = progressOf(run, FM.users.A, key)!
          expect([p.last_unit_index, p.furthest_unit_index, p.completed_units, p.completed_at]).toEqual([1, 1, [0], null])
          await sx(page.locator('[data-story-progress]')).toContainText('완료 표시 1/8')

          // 떠났다가 돌아와 이어 읽기 — 정확한 위치(2번째 단위) · 완료(1/8)와 별개
          await page.locator('header a', { hasText: '← 목차로' }).click()
          await sx(page.locator('[data-story-reader="entry"]')).toBeVisible()
          await page.locator('header a', { hasText: '← Stories' }).click()
          await sx(page.locator('[data-story-catalog="ready"]')).toBeVisible()
          const b1Row = page.locator('[data-story-release]').filter({ hasText: '8단위' })
          await sx(b1Row.locator('[data-story-progress-line]')).toContainText('2/8 단위 위치')
          await sx(b1Row.locator('[data-story-progress-line]')).toContainText('완료 표시 1/8')
          await sx(b1Row.locator('[data-story-open="reader"]')).toHaveText('이어 읽기')
          await shot(page, `current-catalog-resume-${width}`)
          await b1Row.locator('[data-story-open="reader"]').click()
          await sx(page.locator('[data-story-entry]')).toContainText('마지막으로 연 곳은 2번째 단위')
          await goUnit(page, page.locator('[data-story-go="resume"]'), 1)
          expect(run.actions.at(-1)).toEqual({ name: 'recordStoryPositionAction', args: { releaseKey: key, unitIndex: 1, reason: 'resume', expectedViewerId: FM.users.A } })
          expect(progressOf(run, FM.users.A, key)!.completed_units).toEqual([0])

          // 마지막 단위로 건너뛰기 + 마지막만 표시 → 완료 아님
          await goUnit(page, tocLink(page, 7), 7)
          await markUnit(page, 7)
          await sx(statusDock(page)).toContainText('완료 표시 2/8')
          await sx(page.locator('[data-story-done]')).toHaveCount(0)
          expect(await page.locator('#root').innerText()).not.toMatch(/각색 완독|원문 완독/)
          p = progressOf(run, FM.users.A, key)!
          expect([p.completed_units, p.completed_at]).toEqual([[0, 7], null])
          await shot(page, `current-reader-last-only-${width}`)

          // 남은 단위를 「표시하지 않은 단위로」 → 표시 반복
          for (let u = 1; u <= 6; u += 1) {
            await goUnit(page, page.locator('[data-story-go="next"]'), u)
            await markUnit(page, u)
          }
          await sx(page.locator('[data-story-done]')).toContainText('각색 완독 — 모든 단위를 읽음으로 표시했어요')
          await sx(page.locator('[data-story-completion]')).toHaveText('각색 완독')
          await sx(page.locator('[data-story-next-story]').first()).toHaveText('다음 이야기 고르기')
          await sx(page.locator('[data-story-next-story]').first()).toHaveAttribute('href', '/library/stories')
          expect(await page.locator('#root').innerText()).not.toContain('원문 완독')
          p = progressOf(run, FM.users.A, key)!
          expect(p.completed_units).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
          expect(p.completed_at).not.toBeNull()
          await noOverflow(page)
          await shot(page, `current-reader-done-${width}`)
          // 다음 이야기 고르기 → 서가(이 판본 줄은 각색 완독 · 다시 보기)
          await page.locator('[data-story-next-story]').first().click()
          await sx(page.locator('[data-story-catalog="ready"]')).toBeVisible()
          const doneRow = page.locator('[data-story-release]').filter({ hasText: '8단위' })
          await sx(doneRow.locator('[data-story-progress-line]')).toContainText('각색 완독')
          await sx(doneRow.locator('[data-story-open="reader"]')).toHaveText('다시 보기')
          await shot(page, `current-catalog-after-done-${width}`)
          // 다른 작품(Storm 에피소드)을 고른다 — 자기 발행본 메타 · 승계 없는 빈 진도
          const ep = DB0.releases.find((r) => r.release_key === FM.release_keys.EP)!
          const stormWork = page.locator('[data-story-work]').filter({ has: page.getByRole('heading', { name: /The Storm Night/ }) })
          await sx(stormWork.locator('[data-story-hook]')).toHaveText(ep.hook_text)
          await stormWork.locator('[data-story-open="reader"]').click()
          await sx.poll(() => new URL(page.url()).pathname).toBe(`/library/stories/${FM.release_keys.EP}`)
          await sx(page.locator('[data-story-reader="entry"]')).toBeVisible()
          await sx(page.locator('[data-story-entry-public] [data-story-hook]')).toHaveText(ep.hook_text)
          await sx(page.locator('[data-story-target]')).not.toContainText('B1')
          await sx(page.locator('header')).toContainText('에피소드')
          await sx(page.locator('header')).toContainText('3단위')
          await sx(page.locator('[data-story-progress]')).toContainText('아직 읽은 기록이 없어요')
          await sx(page.locator('[data-story-toc]')).not.toContainText('✓ 읽음')
          await sx(page.locator('[data-story-go="start"]')).toHaveText('처음부터 읽기')
          expect(progressOf(run, FM.users.A, FM.release_keys.EP)).toBeNull()
          fs.writeFileSync(path.join(WORK, `flow-other-work-target-${width}.txt`), await page.locator('[data-story-target]').innerText())
          await shot(page, `current-reader-other-work-entry-${width}`)
          // Keeper 기록은 그대로(완료) — 서가로 돌아가면 각색 완독 · 다시 보기
          expect(progressOf(run, FM.users.A, key)!.completed_at).not.toBeNull()
          await page.locator('header a', { hasText: '← Stories' }).click()
          await sx(page.locator('[data-story-catalog="ready"]')).toBeVisible()
          await sx(page.locator('[data-story-release]').filter({ hasText: '8단위' }).locator('[data-story-progress-line]')).toContainText('각색 완독')

          const events = await closedTelemetry(page)
          const seq = events.filter((e) => e.name === 'story_reader_action').map((e) => `${e.props.action}:${e.props.unit_index}:${e.props.completed}`)
          expect(seq).toEqual([
            'start:0:false', 'unit_complete:0:false', 'navigate:1:false', 'resume:1:false', 'navigate:7:false', 'unit_complete:7:false',
            'navigate:1:false', 'unit_complete:1:false', 'navigate:2:false', 'unit_complete:2:false', 'navigate:3:false', 'unit_complete:3:false',
            'navigate:4:false', 'unit_complete:4:false', 'navigate:5:false', 'unit_complete:5:false', 'navigate:6:false', 'unit_complete:6:true',
          ])
          // 서가 진입 이벤트는 첫 문서에서 한 번(모든 문서 기록)
          // 서가에 들어간 네 번(첫 진입 · 떠났다 돌아옴 · 다음 이야기 고르기 · 다른 작품 뒤 돌아옴) 모두 실제 수 · 로그인 표시
          expect((log.events as { name: string }[]).filter((e) => e.name === 'story_catalog_viewed')).toEqual(Array(4).fill({ name: 'story_catalog_viewed', props: { works: 2, editions: 3, signed_in: true } }))
          await noIdentityLeak(page, [probeOf(key, 0)])
        } finally {
          finishRun(run, log)
        }
        assertQuietNetwork(log)
      })

      test('에피소드 — 단위 제목 · 전 단위 표시 뒤 「이 부분 읽기 완료」(각색 완독 아님)', async ({ page, context }) => {
        test.setTimeout(180_000)
        const run = newRun(`episode-${width}`)
        const key = FM.release_keys.EP
        const log = await readerHarness(context, `episode@${width}`, run)
        try {
          await openStories(page, `/library/stories/${key}`)
          await sx(page.locator('[data-story-toc]')).toContainText('1번째 단위 · Storm')
          await sx(page.locator('header')).toContainText('에피소드')
          await goUnit(page, page.locator('[data-story-go="start"]'), 0)
          await sx(heading(page)).toHaveText('1번째 단위 · Storm')
          await markUnit(page, 0)
          for (let u = 1; u <= 2; u += 1) {
            await goUnit(page, page.locator('[data-story-go="next"]'), u)
            await markUnit(page, u)
          }
          await sx(page.locator('[data-story-done]')).toContainText('이 부분 읽기 완료')
          expect(await page.locator('#root').innerText()).not.toMatch(/각색 완독|원문 완독/)
          expect(progressOf(run, FM.users.A, key)!.completed_at).not.toBeNull()
          await noOverflow(page)
          await shot(page, `current-reader-episode-done-${width}`)
          await closedTelemetry(page)
        } finally {
          finishRun(run, log)
        }
        assertQuietNetwork(log)
      })

      test('판본 전환 — 같은 작품 다른 판본은 위치 · 완료를 따로(승계 없음)', async ({ page, context }) => {
        test.setTimeout(180_000)
        const run = newRun(`switch-${width}`)
        const b1 = FM.release_keys.B1
        const a2 = FM.release_keys.A2
        // B1 전 단위 완료를 실제 서버 로직(completeStoryUnit)으로 미리 기록
        for (let u = 0; u < 8; u += 1) {
          const r = (await evalServer(run, { op: 'action', name: 'completeStoryUnitAction', args: [{ releaseKey: b1, unitIndex: u, expectedViewerId: FM.users.A }] })) as { ok: boolean }
          expect(r.ok).toBe(true)
        }
        expect(progressOf(run, FM.users.A, b1)!.completed_at).not.toBeNull()
        const before = run.rpc.length
        const log = await readerHarness(context, `switch@${width}`, run)
        try {
          await openStories(page, `/library/stories/${b1}?unit=2`)
          await sx(page.locator('[data-story-completion]')).toHaveText('각색 완독')
          const sib = page.locator('[data-story-sibling]')
          await sx(sib).toHaveCount(1)
          await sx(sib).toContainText('Easy Reader')
          await shot(page, `current-reader-siblings-${width}`)
          await sib.click()
          await sx.poll(() => new URL(page.url()).pathname).toBe(`/library/stories/${a2}`)
          await sx(page.locator('[data-story-reader="entry"]')).toBeVisible()
          await sx(page.locator('header')).toContainText('Easy Reader')
          await sx(page.locator('[data-story-progress]')).toContainText('아직 읽은 기록이 없어요')
          await sx(page.locator('[data-story-toc]')).not.toContainText('✓ 읽음')
          await sx(page.locator('[data-story-go="start"]')).toBeVisible()
          expect(progressOf(run, FM.users.A, a2)).toBeNull()
          expect(writes({ ...run, rpc: run.rpc.slice(before) })).toEqual([])
          await goUnit(page, page.locator('[data-story-go="start"]'), 0)
          const pa2 = progressOf(run, FM.users.A, a2)!
          expect([pa2.last_unit_index, pa2.completed_units, pa2.completed_at]).toEqual([0, [], null])
          const pb1 = progressOf(run, FM.users.A, b1)!
          expect(pb1.completed_units).toEqual([0, 1, 2, 3, 4, 5, 6, 7])
          await sx(page.locator('[data-story-progress]')).not.toContainText('각색 완독')
          await noOverflow(page)
          await shot(page, `current-reader-switched-${width}`)
          const events = await closedTelemetry(page)
          expect(events.map((e) => `${e.props.action}:${e.props.kind}:${e.props.completed}`)).toEqual(['edition_switch:story_edition:true', 'start:easy_reader:false'])
        } finally {
          finishRun(run, log)
        }
        assertQuietNetwork(log)
      })

      test('저장 실패 — 사실대로 · 이벤트 없음 · 다시 시도 · 응답 유실 뒤 재시도도 한 번만 · 빠른 두 번 클릭은 요청 하나', async ({ page, context }) => {
        test.setTimeout(240_000)
        const run = newRun(`failure-${width}`)
        const key = FM.release_keys.B1
        const log = await readerHarness(context, `failure@${width}`, run)
        try {
          await openStories(page, `/library/stories/${key}`)
          // 위치 기록 실패(일시) — 이동하지 않음 · 실패 문구 · 다시 시도
          faultOnce(run, 'story_record_position')
          await page.locator('[data-story-go="start"]').click()
          await sx(statusDock(page)).toContainText('위치를 저장하지 못했어요 — 다시 시도해 주세요')
          await sx(statusDock(page)).toBeInViewport()
          expect(search(page).get('unit')).toBeNull()
          await sx(B(page)).toHaveCount(0)
          expect(await closedTelemetry(page)).toEqual([])
          await noOverflow(page)
          await shot(page, `current-reader-save-failed-${width}`)
          await statusDock(page).locator('[data-story-retry]').click()
          await sx.poll(() => search(page).get('unit')).toBe('0')
          await sx(B(page)).toContainText(probeOf(key, 0))
          expect((await closedTelemetry(page)).map((e) => e.props.action)).toEqual(['start'])

          // 완료 실패(일시) → 이벤트 없음 → 다시 시도 → 1/8
          faultOnce(run, 'story_complete_unit')
          await completeBtn(page).click()
          await sx(statusDock(page)).toContainText('읽음 표시를 저장하지 못했어요 — 다시 시도해 주세요')
          await sx(page.locator('[data-story-complete="ready"]')).toBeVisible()
          expect((await closedTelemetry(page)).map((e) => e.props.action)).toEqual(['start'])
          await statusDock(page).locator('[data-story-retry]').click()
          await sx(statusDock(page)).toContainText('완료 표시 1/8')

          // 서버는 저장했는데 응답이 유실 → 화면은 실패로 · 다시 시도 → DB 는 같은 한 건(재호출 안전) · 수는 2/8 (중복 없음)
          await goUnit(page, page.locator('[data-story-go="next"]'), 1)
          run.lose.set('completeStoryUnitAction', 1)
          await completeBtn(page).click()
          await sx(statusDock(page)).toContainText('읽음 표시를 저장하지 못했어요')
          expect(progressOf(run, FM.users.A, key)!.completed_units).toEqual([0, 1])
          await statusDock(page).locator('[data-story-retry]').click()
          await sx(statusDock(page)).toContainText('완료 표시 2/8')
          expect(progressOf(run, FM.users.A, key)!.completed_units).toEqual([0, 1])
          expect(run.actions.filter((a) => a.name === 'completeStoryUnitAction').map((a) => (a.args as { unitIndex: number }).unitIndex)).toEqual([0, 0, 1, 1])

          // 빠른 두 번 클릭 — 응답을 붙잡은 채 두 번 → 요청 하나
          await goUnit(page, page.locator('[data-story-go="next"]'), 2)
          const nCompleteBefore = run.actions.filter((a) => a.name === 'completeStoryUnitAction').length
          const release = holdNext(run, 'completeStoryUnitAction')
          await completeBtn(page).dblclick()
          await sx(page.locator('[data-story-complete="pending"]')).toBeVisible()
          await page.waitForTimeout(800)
          release()
          await sx(page.locator('[data-story-complete="marked"][data-unit="2"]')).toBeVisible()
          expect(run.actions.filter((a) => a.name === 'completeStoryUnitAction').length - nCompleteBefore).toBe(1)
          const nNavBefore = run.actions.filter((a) => a.name === 'recordStoryPositionAction').length
          const releaseNav = holdNext(run, 'recordStoryPositionAction')
          const next = page.locator('[data-story-go="next"]')
          await next.click()
          await next.click({ force: true }).catch(() => undefined)
          await page.waitForTimeout(800)
          releaseNav()
          await sx.poll(() => search(page).get('unit')).toBe('3')
          expect(run.actions.filter((a) => a.name === 'recordStoryPositionAction').length - nNavBefore).toBe(1)
          const events = await closedTelemetry(page)
          expect(events.map((e) => `${e.props.action}:${e.props.unit_index}`)).toEqual(['start:0', 'unit_complete:0', 'navigate:1', 'unit_complete:1', 'navigate:2', 'unit_complete:2', 'navigate:3'])
        } finally {
          finishRun(run, log)
        }
        assertQuietNetwork(log)
      })

      test('원문 대응 — 요청 시에만 · 이 단위 앵커 인용 · 메타 · http(s)만 링크(noopener noreferrer)', async ({ page, context }) => {
        test.setTimeout(180_000)
        const run = newRun(`source-${width}`)
        const { B1: b1, A2: a2, EP: ep } = FM.release_keys
        const log = await readerHarness(context, `source@${width}`, run)
        try {
          await openStories(page, `/library/stories/${b1}?unit=1`)
          await sx(page.locator('[data-story-source-panel]')).toHaveCount(0)
          const toggle = page.locator('[data-story-source-toggle]')
          await sx(toggle).toHaveAttribute('aria-expanded', 'false')
          await toggle.click()
          await sx(toggle).toHaveAttribute('aria-expanded', 'true')
          const panel = page.locator('[data-story-source-panel]')
          const rel = DB0.releases.find((r) => r.release_key === b1)!
          const anchors = rel.units[1]!.anchors
          await sx(panel.locator('[data-story-anchor]')).toHaveCount(anchors.length)
          await sx(panel.locator('blockquote').first()).toHaveText(anchors[0]!.quote)
          await sx(panel).toContainText(rel.source.title)
          await sx(panel).toContainText(rel.source.edition_label)
          await sx(panel).toContainText('원작 언어 그대로')
          const link = panel.locator('[data-story-source-link]')
          await sx(link).toHaveAttribute('href', rel.source.source_url!)
          await sx(link).toHaveAttribute('rel', 'noopener noreferrer')
          await sx(link).toHaveAttribute('target', '_blank')
          await panel.locator('[data-story-anchor="0"]').click()
          await sx(panel.locator('[data-story-anchor="0"]')).toHaveAttribute('aria-pressed', 'true')
          await sx(panel.locator('[data-story-trace]')).toContainText(`원문 ${anchors[0]!.paragraph + 1}문단의 이 인용은 2번째 단위의 근거예요`)
          await sx(B(page)).toHaveAttribute('data-tracing', 'true')
          expect((await closedTelemetry(page)).map((e) => `${e.props.action}:${e.props.unit_index}`)).toEqual(['source_open:1'])
          await noOverflow(page)
          await shot(page, `current-reader-source-https-${width}`)

          // javascript: — 링크 없음 · 글자만 / 여러 앵커
          await openStories(page, `/library/stories/${a2}?unit=0`)
          await page.locator('[data-story-source-toggle]').click()
          const pa = page.locator('[data-story-source-panel]')
          await sx(pa.locator('[data-story-anchor]')).toHaveCount(DB0.releases.find((r) => r.release_key === a2)!.units[0]!.anchors.length)
          await sx(pa.locator('a')).toHaveCount(0)
          await sx(pa.locator('[data-story-source-text]')).toHaveText('javascript:alert(document.domain)')
          await shot(page, `current-reader-source-javascript-${width}`)
          expect((await closedTelemetry(page)).map((e) => `${e.props.action}:${e.props.unit_index}`)).toEqual(['source_open:0'])
          // data: — 링크 없음
          await openStories(page, `/library/stories/${ep}?unit=0`)
          await page.locator('[data-story-source-toggle]').click()
          const pe = page.locator('[data-story-source-panel]')
          await sx(pe.locator('a')).toHaveCount(0)
          await sx(pe.locator('[data-story-source-text]')).toHaveText('data:text/html,<b>synthetic</b>')
          expect(await page.evaluate(() => document.querySelectorAll('a[href^="javascript:"], a[href^="data:"]').length)).toBe(0)
          expect(writes(run)).toEqual([])
          const events = await closedTelemetry(page)
          // 문서마다 따로 센다(page.goto = 새 문서) — 이 문서는 data: 판본 하나
          expect(events.map((e) => `${e.props.action}:${e.props.unit_index}`)).toEqual(['source_open:0'])
          expect(log.events.map((e) => (e as { props: { action: string } }).props.action)).toEqual(['source_open', 'source_open', 'source_open'])
        } finally {
          finishRun(run, log)
        }
        assertQuietNetwork(log)
      })

      test('철회 · 권리 보류 · 서가에서 빠짐 — 서가 · 직접 링크 · 본문 · 위치 · 완료 모두 닫힘', async ({ page, context }) => {
        test.setTimeout(180_000)
        const run = newRun(`unavailable-${width}`)
        const { B1: b1, WD: wd, RH: rh } = FM.release_keys
        const log = await readerHarness(context, `unavailable@${width}`, run)
        try {
          await openStories(page, '/library/stories')
          const catalogText = await page.locator('[data-story-catalog]').innerText()
          expect(catalogText).not.toContain('Withdrawn Synthetic Edition')
          expect(catalogText).not.toContain('Rights-Held Synthetic Edition')
          for (const k of [wd, rh]) {
            await sx(page.locator(`a[href*="${k}"]`)).toHaveCount(0)
            for (const unit of ['', '?unit=0']) {
              await openStories(page, `/library/stories/${k}${unit}`)
              await sx(page.locator('[data-story-state="release_unavailable"]')).toBeVisible()
              await sx(B(page)).toHaveCount(0)
              await sx(page.locator('[data-story-toc]')).toHaveCount(0)
            }
            // 위치 · 완료 직접 호출(실제 서버 로직) — 닫힘 · 쓰기 RPC 0
            for (const name of ['recordStoryPositionAction', 'completeStoryUnitAction']) {
              const r = (await evalServer(run, { op: 'action', name, args: [{ releaseKey: k, unitIndex: 0, reason: 'navigate', expectedViewerId: FM.users.A }] })) as { ok: boolean; code: string }
              expect([r.ok, r.code]).toEqual([false, 'release_unavailable'])
            }
          }
          expect(writes(run)).toEqual([])
          await noOverflow(page)
          await shot(page, `current-reader-unavailable-${width}`)

          // (g) 읽기 문맥 · 본문은 열리는데 서가 조회에서는 빠진 발행본(그 사이 철회 · 권리 보류 경합 흉내) → 본문 없이 닫힘
          editDb(run, (db) => {
            db.catalog_hide = [b1]
          })
          await openStories(page, `/library/stories/${b1}?unit=0`)
          await sx(page.locator('[data-story-state="release_unavailable"]')).toBeVisible()
          await sx(B(page)).toHaveCount(0)
          expect(await page.locator('#root').innerText()).not.toContain(probeOf(b1, 0))
          expect(run.calls.at(-1)!.rpc.map((c) => c.fn)).toEqual(expect.arrayContaining(['story_reader_context', 'story_catalog']))
          await shot(page, `current-reader-catalog-absent-${width}`)
          editDb(run, (db) => {
            db.catalog_hide = []
          })
          expect(await closedTelemetry(page)).toEqual([])
          expect(log.events).toEqual([{ name: 'story_catalog_viewed', props: { works: 2, editions: 3, signed_in: true } }])
        } finally {
          finishRun(run, log)
        }
        assertQuietNetwork(log)
      })

      test('읽은 뒤 서버 거부 — 철회 · 권리 보류 · 계정 정지 → 본문 · 앵커 · 진도 지움 + 다시 받은 상태가 이유를 말함', async ({ page, context }) => {
        test.setTimeout(240_000)
        const run = newRun(`denied-${width}`)
        const b1 = FM.release_keys.B1
        const log = await readerHarness(context, `denied@${width}`, run)
        const cases: { label: string; mutate: (db: DbState) => void; act: 'next' | 'complete'; final: string; denied: string }[] = [
          { label: 'withdrawn', mutate: (db) => (db.releases.find((r) => r.release_key === b1)!.withdrawn_at = '2026-10-25T13:00:00.000Z'), act: 'next', final: '[data-story-state="release_unavailable"]', denied: 'release_unavailable' },
          { label: 'rights-held', mutate: (db) => (db.releases.find((r) => r.release_key === b1)!.rights_ok = false), act: 'complete', final: '[data-story-state="release_unavailable"]', denied: 'release_unavailable' },
          { label: 'suspended', mutate: (db) => (db.profiles[FM.users.A] = { status: 'suspended' }), act: 'complete', final: '[data-story-state="blocked"]', denied: 'account_blocked' },
        ]
        try {
          for (const c of cases) {
            editDb(run, (db) => {
              const fresh = JSON.parse(JSON.stringify(DB0)) as DbState
              db.releases = fresh.releases
              db.profiles = fresh.profiles
            })
            await openStories(page, `/library/stories/${b1}?unit=0`)
            await sx(B(page)).toBeVisible()
            await page.locator('[data-story-source-toggle]').click()
            await sx(page.locator('[data-story-anchor]').first()).toBeVisible()
            const before = writes(run).length
            const pagesBefore = run.pages.length
            editDb(run, c.mutate)
            if (c.act === 'next') await page.locator('[data-story-go="next"], [data-story-go="forward"]').first().click()
            else await completeBtn(page).click()
            // 서버가 다시 그린 상태(refresh)가 이유를 말한다 · 개인 내용 없음
            await sx(page.locator(c.final)).toBeVisible()
            await sx(B(page)).toHaveCount(0)
            await sx(page.locator('[data-story-anchor]')).toHaveCount(0)
            await sx(page.locator('[data-story-progress]')).toHaveCount(0)
            await sx(page.locator('[data-story-toc]')).toHaveCount(0)
            expect(run.pages.length, 'refresh re-ran the loader').toBeGreaterThan(pagesBefore)
            const lastAction = [...run.calls].reverse().find((x) => x.op === 'action')!
            expect(lastAction.value).toMatchObject({ ok: false, code: c.denied })
            expect(writes(run).length - before, `${c.label}: no write RPC`).toBe(0)
            await noOverflow(page)
            await shot(page, `current-reader-denied-${c.label}-${width}`)
          }
          const events = await closedTelemetry(page)
          expect(events.filter((e) => e.props.action === 'navigate' || e.props.action === 'unit_complete')).toEqual([])
        } finally {
          finishRun(run, log)
        }
        assertQuietNetwork(log)
      })

      test('읽기 문맥 RPC 없음(S5 SQL 미적용) — 준비 중 상태 · 읽던 중 사라져도 저장은 쓰기 RPC 에 닿지 않음', async ({ page, context }) => {
        const run = newRun(`not-ready-${width}`, (db) => {
          db.reader_context_missing = true
        })
        const key = FM.release_keys.B1
        const log = await readerHarness(context, `not-ready@${width}`, run)
        try {
          for (const q of ['', '?unit=0']) {
            await openStories(page, `/library/stories/${key}${q}`)
            await sx(page.locator('[data-story-state="reader_not_ready"]')).toBeVisible()
            await sx(page.getByRole('heading', { name: '읽기 화면 준비 중' })).toBeVisible()
            await sx(page.locator('[data-story-toc]')).toHaveCount(0)
            await sx(page.locator('[data-story-source-toggle]')).toHaveCount(0)
            await sx(B(page)).toHaveCount(0)
            await sx(page.locator('[data-story-retry]')).toHaveCount(0)
          }
          expect(run.rpc.filter((c) => c.fn === 'story_reader_context').map((c) => c.code)).toEqual(['PGRST202', 'PGRST202'])
          expect(run.rpc.filter((c) => c.fn === 'story_read_unit')).toEqual([])
          await noOverflow(page)
          await shot(page, `current-reader-not-ready-${width}`)
          // 직접 저장 호출(실제 서버 로직) — 읽기 문맥 확인에서 멈춘다
          for (const name of ['recordStoryPositionAction', 'completeStoryUnitAction']) {
            const r = (await evalServer(run, { op: 'action', name, args: [{ releaseKey: key, unitIndex: 0, reason: 'navigate', expectedViewerId: FM.users.A }] })) as { ok: boolean; code: string }
            expect([r.ok, r.code]).toEqual([false, 'reader_not_ready'])
          }
          // 읽는 중에 사라짐(열 때는 있었음) → 이동 · 완료 저장이 쓰기 RPC 에 닿지 않는다
          editDb(run, (db) => {
            db.reader_context_missing = false
          })
          await openStories(page, `/library/stories/${key}?unit=0`)
          await sx(B(page)).toBeVisible()
          editDb(run, (db) => {
            db.reader_context_missing = true
          })
          await completeBtn(page).click()
          await sx(page.locator('[data-story-status="error"], [data-story-state="reader_not_ready"]').first()).toBeVisible()
          const after = await page.locator('#root').innerText()
          fs.writeFileSync(path.join(WORK, `not-ready-midread-${width}.txt`), after)
          expect(writes(run), 'no story_record_position / story_complete_unit reached the fake DB').toEqual([])
          await closedTelemetry(page).then((ev) => expect(ev.filter((e) => e.name === 'story_reader_action')).toEqual([]))
          // 서가는 그대로 열린다
          await openStories(page, '/library/stories')
          await sx(page.locator('[data-story-catalog="ready"]')).toBeVisible()
        } finally {
          finishRun(run, log)
        }
        assertQuietNetwork(log)
      })

      test('정지 계정 — 독서 차단(본문 없음) · 서가는 진도 없이', async ({ page, context }) => {
        const run = newRun(`suspended-${width}`)
        run.actor = FM.users.S
        const log = await readerHarness(context, `suspended@${width}`, run)
        try {
          await openStories(page, `/library/stories/${FM.release_keys.B1}?unit=0`)
          await sx(page.locator('[data-story-state="blocked"]')).toBeVisible()
          await sx(B(page)).toHaveCount(0)
          await sx(page.locator('[data-story-toc]')).toHaveCount(0)
          expect(run.rpc.map((c) => c.fn)).toEqual([])
          await shot(page, `current-reader-blocked-${width}`)
          await openStories(page, '/library/stories')
          await sx(page.locator('[data-story-progress="error"]')).toContainText('이 계정은 지금 이야기를 읽을 수 없어요')
          expect(run.rpc.map((c) => c.fn)).toEqual(['story_catalog', 'story_release_guidance'])
          await noOverflow(page)
          await closedTelemetry(page)
        } finally {
          finishRun(run, log)
        }
        assertQuietNetwork(log)
      })

      test('인증 확인 중(기준선 지연) — 개인 내용 · 조작 없음 · 액션 0 · B 로 확정되면 그대로 숨김 + 다시 받기 · A 로 확정되면 보임', async ({ page, context }) => {
        test.setTimeout(240_000)
        const run = newRun(`checking-${width}`)
        const key = FM.release_keys.B1
        // A 의 기록(완료 표시 · 위치)을 미리 — 확인 전에는 그 흔적도 보이면 안 된다
        for (const u of [0, 1]) await evalServer(run, { op: 'action', name: 'completeStoryUnitAction', args: [{ releaseKey: key, unitIndex: u, expectedViewerId: FM.users.A }] })
        const log = await readerHarness(context, `checking@${width}`, run)
        const privateAbsent = async () => {
          await sx(page.locator('[data-story-private="hidden"]')).toBeVisible()
          await sx(B(page)).toHaveCount(0)
          await sx(page.locator('[data-story-anchor], [data-story-source-toggle]')).toHaveCount(0)
          await sx(page.locator('[data-story-progress], [data-story-completion], [data-story-toc]')).toHaveCount(0)
          await sx(page.locator('[data-story-go], button[data-story-complete], [data-story-retry]')).toHaveCount(0)
          const text = await page.locator('#root').innerText()
          expect(text).not.toContain(probeOf(key, 0))
          expect(text).not.toMatch(/✓ 읽음|완료 표시|단위 위치/)
        }
        try {
          run.authManual = true
          for (const owner of ['B', 'A'] as const) {
            run.browserUser = owner === 'B' ? FM.users.B : FM.users.A
            const actionsBefore = run.actions.length
            await openStories(page, `/library/stories/${key}?unit=0`)
            await sx(page.locator('[data-story-identity="checking"]')).toBeVisible()
            await privateAbsent()
            // 공개 정보(HOOK · 편집 목표 · 원천 줄)는 보인다
            await sx(page.locator('[data-story-hook]')).toBeVisible()
            // 키보드 · 클릭 시도: 모든 초점 정지에서 Enter · Space(링크 이동은 막고 버튼만) — 액션 요청 0
            await page.evaluate(() => {
              for (const el of Array.from(document.querySelectorAll<HTMLElement>('#root button'))) el.click()
            })
            for (let i = 0; i < 12; i += 1) {
              await page.keyboard.press('Tab')
              const tag = await page.evaluate(() => document.activeElement?.tagName)
              if (tag === 'BUTTON') await page.keyboard.press('Space')
            }
            await page.waitForTimeout(500)
            expect(run.actions.length - actionsBefore, `checking(${owner}): zero action requests`).toBe(0)
            if (owner === 'B') await shot(page, `current-reader-checking-${width}`)
            const pagesBefore = run.pages.length
            await page.evaluate((u) => (window as unknown as { __vfAuthResolve: (x: unknown) => void }).__vfAuthResolve({ id: u }), run.browserUser)
            if (owner === 'B') {
              await sx(page.locator('[data-story-state="auth_changed"]')).toBeVisible()
              await sx(B(page)).toHaveCount(0)
              await sx(page.locator('[data-story-progress], [data-story-toc], [data-story-anchor]')).toHaveCount(0)
              await sx.poll(() => run.pages.length, { message: 'auth change triggers a server refresh' }).toBeGreaterThan(pagesBefore)
              expect(run.actions.length - actionsBefore).toBe(0)
              await shot(page, `current-reader-checking-resolved-b-${width}`)
            } else {
              await sx(page.locator('[data-story-private="shown"]')).toBeVisible()
              await sx(B(page)).toContainText(probeOf(key, 0))
              await sx(page.locator('[data-story-completion]')).toContainText('완료 표시 2/8')
              await sx(page.locator('[data-story-go="next"]')).not.toHaveAttribute('aria-disabled', 'true')
              await sx(page.locator('[data-story-go="next"]')).toBeVisible()
              await shot(page, `current-reader-checking-resolved-a-${width}`)
            }
          }
          // 서가: 확인 중에는 개인 기록(철회 판본 이력 · 진도 줄) 없음
          run.browserUser = FM.users.A
          await openStories(page, '/library/stories')
          await sx(page.locator('[data-story-identity="checking"]')).toBeVisible()
          await sx(page.locator('[data-story-history], [data-story-progress-line]')).toHaveCount(0)
          await page.evaluate((u) => (window as unknown as { __vfAuthResolve: (x: unknown) => void }).__vfAuthResolve({ id: u }), FM.users.A)
          await sx(page.locator('[data-story-history]').first()).toBeVisible()
          await closedTelemetry(page)
          await noIdentityLeak(page)
        } finally {
          finishRun(run, log)
        }
        assertQuietNetwork(log)
      })

      test('인증 경계 — 읽는 중 로그아웃 · 계정 전환 · 무효 뒤 조작 0 · 전환 뒤 도착한 A 의 응답 버림 · 쿠키 B 는 쓰기 전에 viewer_changed', async ({ page, context }) => {
        test.setTimeout(240_000)
        const run = newRun(`auth-${width}`)
        const key = FM.release_keys.B1
        const log = await readerHarness(context, `auth@${width}`, run)
        const emit = (event: string, id: string | null) =>
          page.evaluate(([e, u]) => (window as unknown as { __vfAuthEmit: (e: string, u: unknown) => void }).__vfAuthEmit(e as string, u ? { id: u } : null), [event, id] as const)
        try {
          // (1) 같은 사람으로 열고 읽는 중 SIGNED_OUT → 개인 내용 즉시 없음
          await openStories(page, `/library/stories/${key}?unit=0`)
          await sx(B(page)).toBeVisible()
          await emit('SIGNED_OUT', null)
          await sx(page.locator('[data-story-state="auth_changed"]')).toBeVisible()
          await sx(B(page)).toHaveCount(0)
          await sx(page.locator('[data-story-toc], [data-story-progress]')).toHaveCount(0)
          await shot(page, `current-reader-signed-out-midread-${width}`)

          // (2) 무효가 된 그 순간의 조작(무효 직전에 잡아 둔 요소로 클릭 · 다시 시도 포함) — 액션 요청 0
          await openStories(page, `/library/stories/${key}?unit=0`)
          faultOnce(run, 'story_complete_unit')
          await completeBtn(page).click()
          await sx(statusDock(page).locator('[data-story-retry]')).toBeVisible()
          const n0 = run.actions.length
          await page.evaluate((b) => {
            const w = window as unknown as { __vfAuthEmit: (e: string, u: unknown) => void }
            const els = Array.from(document.querySelectorAll<HTMLElement>('[data-story-go], button[data-story-complete], [data-story-retry]'))
            w.__vfAuthEmit('SIGNED_IN', { id: b })
            for (const el of els) el.click()
          }, FM.users.B)
          await sx(page.locator('[data-story-state="auth_changed"]')).toBeVisible()
          await page.waitForTimeout(500)
          expect(run.actions.length - n0, 'invalidated: zero action requests').toBe(0)

          // (3) A 의 완료 요청이 날아가는 중에 B 로 전환 → 도착한 응답은 버린다(성공 문구 · 이벤트 · 본문 없음)
          await openStories(page, `/library/stories/${key}?unit=1`)
          await sx(B(page)).toBeVisible()
          const release = holdNext(run, 'completeStoryUnitAction')
          await completeBtn(page).click()
          await sx(page.locator('[data-story-complete="pending"]')).toBeVisible()
          await sx.poll(() => run.actions.filter((a) => a.name === 'completeStoryUnitAction').length).toBeGreaterThan(0)
          await emit('SIGNED_IN', FM.users.B)
          await sx(page.locator('[data-story-state="auth_changed"]')).toBeVisible()
          release()
          await page.waitForTimeout(1000)
          await sx(page.locator('[data-story-state="auth_changed"]')).toBeVisible()
          expect(await page.locator('#root').innerText()).not.toContain('읽음으로 표시했어요')
          await sx(B(page)).toHaveCount(0)
          // 서버는 그 요청 시점의 쿠키(A)로 저장했다 — 화면이 그것을 다른 사람 화면에 보이지 않을 뿐이다
          expect(progressOf(run, FM.users.A, key)!.completed_units).toEqual([1])

          // (4) 브라우저는 A 그대로, 서버 쿠키가 B 로 바뀐 뒤 이동 저장 → 서버(실제 learner.ts)가 쓰기 전에 viewer_changed · B 진도 그대로
          run.actor = FM.users.A
          await openStories(page, `/library/stories/${key}?unit=0`)
          await sx(B(page)).toBeVisible()
          const bBefore = progressOf(run, FM.users.B, key)
          run.actor = FM.users.B
          await page.locator('[data-story-go="next"], [data-story-go="forward"]').first().click()
          await sx(page.locator('[data-story-state="auth_changed"], [data-story-denied="viewer_changed"]').first()).toBeVisible()
          await sx(B(page)).toHaveCount(0)
          const call = [...run.calls].reverse().find((x) => x.op === 'action')!
          expect(call.value).toMatchObject({ ok: false, code: 'viewer_changed' })
          expect(call.rpc, 'no private/mutation RPC in the viewer_changed call').toEqual([])
          expect(progressOf(run, FM.users.B, key)).toEqual(bBefore)
          expect(search(page).get('unit')).toBe('0')
          await shot(page, `current-reader-viewer-changed-${width}`)

          const events = await closedTelemetry(page)
          expect(events.filter((e) => e.props.action === 'unit_complete' || e.props.action === 'navigate')).toEqual([])
          await noIdentityLeak(page, [probeOf(key, 0)])
        } finally {
          finishRun(run, log)
        }
        assertQuietNetwork(log)
      })

      test('단어 뜻(요청 시) — 이 단위 낱말만 · 키보드 · Esc 초점 복귀 · 없음/오류 · 단위 · 판본 · 인증 바뀌면 닫힘 · 기록 없음', async ({ page, context }) => {
        test.setTimeout(240_000)
        const run = newRun(`word-help-${width}`)
        const { B1: b1, A2: a2 } = FM.release_keys
        await context.addInitScript(() => {
          // 합성 사전(SYNTHETIC) — 공유 DB 없음
          ;(window as unknown as { __VF_LOOKUP__: unknown }).__VF_LOOKUP__ = { lighthouse: { word: 'lighthouse', meaning_ko: '등대 (합성 사전)', pos: 'noun' } }
        })
        const log = await readerHarness(context, `word-help@${width}`, run)
        const dialog = () => page.getByRole('dialog')
        const supa = () => page.evaluate(() => (window as unknown as { __vfSupabase?: unknown[] }).__vfSupabase ?? [])
        try {
          await openStories(page, `/library/stories/${b1}?unit=0`)
          await sx(B(page)).toBeVisible()
          await sx(page.locator('[data-word-index]')).toHaveCount(0)
          await sx(dialog()).toHaveCount(0)
          expect(await supa()).toEqual([])
          await page.locator('[data-story-word-mode]').click()
          // 낱말 버튼은 온전한 낱말(유니코드 글자 · 아포스트로피/하이픈 결합)이고, 낱말 모드 본문 글자는 원래 본문과 같다
          const words = await page.locator('[data-word-index]').allInnerTexts()
          expect(words.length).toBeGreaterThan(5)
          for (const w of words) expect(w).toMatch(/^[\p{L}\p{M}]+(?:['’-][\p{L}\p{M}]+)*$/u)
          expect((await B(page).innerText()).replace(/\s+/g, ' ').trim()).toBe(unitText(b1, 0).replace(/\s+/g, ' ').trim())
          const word = page.locator('[data-word-index]').filter({ hasText: /^lighthouse$/ }).first()
          await word.click()
          await sx(dialog()).toBeVisible()
          await sx(dialog()).toContainText('등대 (합성 사전)')
          await noOverflow(page)
          await shot(page, `current-reader-word-help-found-${width}`)
          await page.keyboard.press('Escape')
          await sx(dialog()).toHaveCount(0)
          await sx(word).toBeFocused()
          // 키보드: 화살표로 옆 낱말 → Enter → 없는 낱말 상태
          await page.keyboard.press('ArrowRight')
          const focused = page.locator('[data-word-index]:focus')
          const surface = (await focused.innerText()).trim()
          await page.keyboard.press('Enter')
          await sx(dialog()).toBeVisible()
          await sx(dialog()).toContainText('사전에 없는 단어예요')
          await page.keyboard.press('Escape')
          await sx(dialog()).toHaveCount(0)
          await sx(page.locator(`[data-word-index]:focus`)).toHaveText(surface)
          // 오류 상태
          await page.evaluate(() => ((window as unknown as { __VF_LOOKUP_MODE__: string }).__VF_LOOKUP_MODE__ = 'error'))
          await word.click()
          await sx(dialog()).toContainText('뜻을 불러오지 못했어요')
          await shot(page, `current-reader-word-help-error-${width}`)
          await page.keyboard.press('Escape')
          await page.evaluate(() => ((window as unknown as { __VF_LOOKUP_MODE__: string }).__VF_LOOKUP_MODE__ = 'normal'))

          // 단위가 바뀌면 닫힘(뒤로 가기 — 소프트 이동 · 클릭 없이)
          await goUnit(page, page.locator('[data-story-go="forward"], [data-story-go="next"]').first(), 1)
          await page.locator('[data-story-word-mode]').click()
          await page.locator('[data-word-index]').first().click()
          await sx(dialog()).toBeVisible()
          await page.goBack()
          await sx.poll(() => search(page).get('unit')).toBe('0')
          await sx(heading(page)).toHaveText('1번째 단위')
          await sx(dialog()).toHaveCount(0)
          await sx(page.locator('[data-word-index]')).toHaveCount(0)

          // 판본이 바뀌면 닫힘: B1 → (형제) A2 입구 → 시작 → 뜻 열기 → history.go(-2) 로 B1 단위로
          await page.locator('[data-story-sibling]').click()
          await sx.poll(() => new URL(page.url()).pathname).toBe(`/library/stories/${a2}`)
          await goUnit(page, page.locator('[data-story-go="start"]'), 0)
          await page.locator('[data-story-word-mode]').click()
          await page.locator('[data-word-index]').first().click()
          await sx(dialog()).toBeVisible()
          await page.evaluate(() => history.go(-2))
          await sx.poll(() => new URL(page.url()).pathname).toBe(`/library/stories/${b1}`)
          await sx(B(page)).toContainText(probeOf(b1, 0))
          await sx(dialog()).toHaveCount(0)

          // 인증이 바뀌면 닫힘
          await page.locator('[data-story-word-mode]').click()
          await page.locator('[data-word-index]').first().click()
          await sx(dialog()).toBeVisible()
          await page.evaluate(() => (window as unknown as { __vfAuthEmit: (e: string, u: unknown) => void }).__vfAuthEmit('SIGNED_OUT', null))
          await sx(page.locator('[data-story-state="auth_changed"]')).toBeVisible()
          await sx(dialog()).toHaveCount(0)

          // 기록 없음: 브라우저 쪽 Supabase 호출은 사전 조회(rpc lookup_word_meaning · shared_dictionary select)뿐 · 쓰기 0
          const calls = (await supa()) as ({ kind: string; fn?: string; table?: string; ops?: string } | string)[]
          fs.writeFileSync(path.join(WORK, `word-help-supabase-${width}.json`), `${JSON.stringify(calls, null, 2)}\n`)
          for (const c of calls) {
            expect(typeof c === 'object' && ((c.kind === 'rpc' && c.fn === 'lookup_word_meaning') || (c.kind === 'from' && c.table === 'shared_dictionary' && c.ops === 'select.eq'))).toBe(true)
          }
          // 서버 쪽: 단어 도움은 위치 · 완료를 만들지 않았다(기록은 명시적 이동 2번 · 시작 1번뿐)
          expect(writes(run).map((c) => c.fn)).toEqual(['story_record_position', 'story_record_position'])
          const events = await closedTelemetry(page)
          expect(JSON.stringify(events)).not.toMatch(/lighthouse/i)
          await noIdentityLeak(page, ['lighthouse', surface])
        } finally {
          finishRun(run, log)
        }
        assertQuietNetwork(log)
      })

      test('시작 전 선택 안내(U1 · 합성 fixture) — 부담 한 줄 · 접힌 주의(키보드 · 실측 44px) · 도움 한 줄 · 주의 없으면 경고 없음 · 못 불러옴/확인 못함 구분 · 안내 중 쓰기 0 · 읽기 시작 · axe', async ({ page, context }) => {
        test.setTimeout(240_000)
        const run = newRun(`guidance-${width}`)
        run.actor = null
        const { B1: b1, A2: a2 } = FM.release_keys
        const cautionsOf = (key: string) => (DB0.releases.find((r) => r.release_key === key) as unknown as { guidance: { cautions: string[] } }).guidance.cautions
        const log = await readerHarness(context, `guidance@${width}`, run)
        /** 키보드만으로 이 요소에 닿는가(Tab 반복) · 닿았을 때 보이는 초점 테두리. */
        const tabTo = async (selector: string) => {
          await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
          for (let i = 0; i < 80; i += 1) {
            await page.keyboard.press('Tab')
            const hit = await page.evaluate((sel) => {
              const el = document.activeElement
              if (!el || !el.matches(sel)) return null
              const cs = getComputedStyle(el)
              const r = el.getBoundingClientRect()
              return {
                outline: cs.outlineStyle,
                outlineWidth: cs.outlineWidth,
                h: r.height,
                w: r.width,
                minHeight: cs.minHeight,
                display: cs.display,
                lineHeight: cs.lineHeight,
                fontSize: cs.fontSize,
                nativeSummaryInDetails: el.tagName === 'SUMMARY' && el.parentElement?.tagName === 'DETAILS' && el.parentElement.firstElementChild === el,
              }
            }, selector)
            if (hit) return hit
          }
          return null
        }
        /** 실제 측정값 기록(여백 계산이 아니라 브라우저 bounding box). */
        const recordMetric = (where: string, m: unknown) => {
          fs.mkdirSync(SHOTS, { recursive: true })
          fs.appendFileSync(path.join(SHOTS, 'u1-summary-metrics.jsonl'), `${JSON.stringify({ width, where, ...(m as object), at: new Date().toISOString() })}\n`)
        }
        const axeGuidance = async () => {
          const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).include('[data-story-guidance]').analyze()
          return res.violations.map((v) => `${v.impact}/${v.id} ×${v.nodes.length}`)
        }
        try {
          // 1) 익명 서가 — 판본마다 안내 · 주의 있는 판본(B1)만 접힌 주의 · 요약에 장면 없음
          await openStories(page, '/library/stories')
          await sx(page.locator('[data-story-guidance="ready"]')).toHaveCount(3)
          const det = page.locator('details[data-story-cautions]')
          await sx(det).toHaveCount(1)
          await sx(det.locator('summary')).toHaveText(`읽기 전 주의 ${cautionsOf(b1).length}가지 · 펼치면 장면 내용이 조금 드러나요`)
          expect(await det.evaluate((d) => (d as HTMLDetailsElement).open)).toBe(false)
          await sx(det.locator('li').first()).toBeHidden()
          await sx(page.locator('[data-story-guidance-load]').first()).toContainText('편집 판단 · 추론 부담')
          const reach = await tabTo('details[data-story-cautions] > summary')
          expect(reach, 'caution summary reachable by Tab').not.toBeNull()
          expect(reach!.outline).not.toBe('none')
          expect(reach!.h).toBeGreaterThanOrEqual(44)
          expect(reach!.minHeight).toBe('44px')
          expect(reach!.display).toBe('list-item')
          expect(reach!.nativeSummaryInDetails).toBe(true)
          recordMetric('catalog-edition-column', reach)
          await page.keyboard.press('Enter')
          await sx(det.locator('li')).toHaveText(cautionsOf(b1))
          expect(await axeGuidance()).toEqual([])
          await noOverflow(page)
          await shot(page, `u1-catalog-guidance-anon-open-${width}`)
          await page.keyboard.press('Enter')
          expect(await det.evaluate((d) => (d as HTMLDetailsElement).open)).toBe(false)
          expect(run.rpc.map((c) => c.fn)).toEqual(['story_catalog', 'story_release_guidance'])

          // 2) 로그인 전 판본 화면 — HOOK 뒤 · 로그인 행동 앞에 같은 안내(자동으로 열리지 않음)
          await openStories(page, `/library/stories/${b1}`)
          await sx(page.locator('[data-story-reader="signed_out"]')).toBeVisible()
          const order = await page.evaluate(() => {
            const g = document.querySelector('[data-story-guidance="ready"]')
            const hook = document.querySelector('[data-story-hook]')
            const login = document.querySelector('[data-story-login]')
            if (!g || !hook || !login) return null
            return { afterHook: !!(hook.compareDocumentPosition(g) & Node.DOCUMENT_POSITION_FOLLOWING), beforeLogin: !!(g.compareDocumentPosition(login) & Node.DOCUMENT_POSITION_FOLLOWING) }
          })
          expect(order).toEqual({ afterHook: true, beforeLogin: true })
          expect(await page.locator('details[data-story-cautions]').evaluate((d) => (d as HTMLDetailsElement).open)).toBe(false)
          await shot(page, `u1-reader-signed-out-guidance-${width}`)

          // 3) 로그인한 학습자 A — 작품 입구: 안내가 시작 행동보다 먼저 · 키보드로 펼침 · 시작 행동 하나 그대로 · 쓰기 0
          run.actor = FM.users.A
          await openStories(page, `/library/stories/${b1}`)
          await sx(page.locator('[data-story-private="shown"]')).toBeVisible()
          await sx(page.locator('[data-story-entry-public] [data-story-guidance="ready"]')).toBeVisible()
          const entryOrder = await page.evaluate(() => {
            const g = document.querySelector('[data-story-guidance="ready"]')!
            const go = document.querySelector('[data-story-go]')!
            return !!(g.compareDocumentPosition(go) & Node.DOCUMENT_POSITION_FOLLOWING)
          })
          expect(entryOrder).toBe(true)
          // 실제로 동작하는 요청형 도움 한 줄 — 시작 행동 바로 위
          const help = page.locator('[data-story-help-line]')
          await sx(help).toContainText('「단어 뜻 보기」')
          await sx(help).toContainText('「원문 대응 보기」')
          expect(await page.evaluate(() => {
            const h = document.querySelector('[data-story-help-line]')!
            const go = document.querySelector('[data-story-go="start"], [data-story-go="resume"]')!
            return !!(h.compareDocumentPosition(go) & Node.DOCUMENT_POSITION_FOLLOWING)
          })).toBe(true)
          const reach2 = await tabTo('details[data-story-cautions] > summary')
          expect(reach2, 'entry caution summary reachable by Tab').not.toBeNull()
          expect(reach2!.h).toBeGreaterThanOrEqual(44)
          expect(reach2!.outline).not.toBe('none')
          recordMetric('entry', reach2)
          await page.keyboard.press('Space')
          await sx(page.locator('details[data-story-cautions] li')).toHaveText(cautionsOf(b1))
          expect(await axeGuidance()).toEqual([])
          await noOverflow(page)
          await shot(page, `u1-entry-guidance-open-${width}`)

          // 4) 주의 없는 판본(A2) — 부담 줄만 · 경고 요소 · 「주의」 문구 없음
          await openStories(page, `/library/stories/${a2}`)
          await sx(page.locator('[data-story-entry-public] [data-story-guidance-load]')).toBeVisible()
          await sx(page.locator('[data-story-cautions]')).toHaveCount(0)
          expect(await page.locator('[data-story-entry-public]').innerText()).not.toContain('주의')
          await sx(page.locator('[data-story-help-line]')).toBeVisible()
          await shot(page, `u1-entry-no-cautions-${width}`)

          // 5) 안내 RPC 없음(공유 DB 의 지금 상태 · SQL 미적용) — 「불러오지 못함」 · 주의 없음이 아니라고 말함 · 독서 행동 그대로
          editDb(run, (db) => {
            db.guidance_missing = true
          })
          await openStories(page, `/library/stories/${b1}`)
          await sx(page.locator('[data-story-guidance="unavailable"][data-story-guidance-reason="not_ready"]')).toContainText('주의할 내용이 없다는 뜻은 아니에요')
          await sx(page.locator('[data-story-cautions]')).toHaveCount(0)
          await sx(page.locator('[data-story-go="start"], [data-story-go="resume"]')).toHaveCount(1)
          await sx(page.locator('[data-story-help-line]')).toBeVisible()
          await shot(page, `u1-entry-guidance-missing-${width}`)

          // 6) 결속 불일치 — 서가 전체 「확인하지 못함」(주의 없음으로 바꾸지 않음) · 서가와 시작 행동은 그대로
          editDb(run, (db) => {
            db.guidance_missing = false
            db.guidance_corrupt = [b1]
          })
          await openStories(page, '/library/stories')
          await sx(page.locator('[data-story-guidance="unavailable"][data-story-guidance-reason="invalid"]')).toHaveCount(3)
          await sx(page.locator('[data-story-open]')).toHaveCount(3)
          await sx(page.locator('[data-story-cautions]')).toHaveCount(0)
          await shot(page, `u1-catalog-guidance-invalid-${width}`)
          expect(writes(run)).toEqual([])

          // 7) 읽기 시작 — 안내 화면에서 명시적 시작 → 단위 0(위치 기록 1회뿐) · 그 한 줄이 말한 도움 조작이 실제로 있다
          editDb(run, (db) => {
            db.guidance_corrupt = []
          })
          await openStories(page, `/library/stories/${b1}`)
          await sx(page.locator('[data-story-entry-public] [data-story-guidance="ready"]')).toBeVisible()
          await goUnit(page, page.locator('[data-story-go="start"]'), 0)
          await sx(B(page)).toBeVisible()
          await sx(page.locator('[data-story-word-mode]')).toHaveText('단어 뜻 보기')
          await sx(page.locator('[data-story-source-toggle]')).toHaveText('원문 대응 보기')
          await sx(page.locator('[data-story-guidance]')).toHaveCount(0)
          await sx(page.locator('[data-story-help-line]')).toHaveCount(0)
          await shot(page, `u1-read-start-unit0-${width}`)
          expect(writes(run).map((c) => c.fn)).toEqual(['story_record_position'])
          const events = await closedTelemetry(page)
          expect(events.every((e) => ['story_catalog_viewed', 'story_reader_action'].includes(e.name))).toBe(true)
          await noIdentityLeak(page)
        } finally {
          finishRun(run, log)
        }
        assertQuietNetwork(log)
      })

      test('W2 단위 화면 캡처(합성 fixture) — 맥락이 붙을 단위(3·4번째)와 없는 단위(1번째)의 직접 진입 · 쓰기 0', async ({ page, context }) => {
        test.setTimeout(120_000)
        const run = newRun(`w2-capture-${width}`)
        const b1 = FM.release_keys.B1
        const log = await readerHarness(context, `w2-capture@${width}`, run)
        try {
          for (const unit of [2, 3, 0]) {
            await openStories(page, `/library/stories/${b1}?unit=${unit}`)
            await sx(B(page)).toBeVisible()
            await sx(heading(page)).toContainText(`${unit + 1}번째 단위`)
            await noOverflow(page)
            await shot(page, `w2-unit${unit}-${width}`)
          }
          expect(writes(run)).toEqual([])
        } finally {
          finishRun(run, log)
        }
        assertQuietNetwork(log)
      })

      test('W2 시대적 맥락 설명(합성 fixture) — 본문 뒤 접힘(키보드 · 실측 44px) · 3번째 둘 · 4번째 하나 · 없는 단위 무표시 · 못 불러옴/확인 못함/어긋난 응답 구분 · 늦은 응답 · 계정 전환 · 위치 · 완료 그대로 · axe', async ({ page, context }) => {
        test.setTimeout(300_000)
        const run = newRun(`w2-notes-${width}`)
        const b1 = FM.release_keys.B1
        const notesOf = (unitId: string) => DB0.releases.find((r) => r.release_key === b1)!.context_notes.filter((n) => n.unit_ids.includes(unitId))
        const textsOf = (unitId: string) => notesOf(unitId).map((n) => n.text)
        const ALL_TEXTS = DB0.releases.find((r) => r.release_key === b1)!.context_notes.map((n) => n.text)
        expect(notesOf('u3')).toHaveLength(2)
        expect(notesOf('u4')).toHaveLength(1)
        const det = page.locator('details[data-story-context-notes]')
        const unavailable = page.locator('[data-story-context-notes="unavailable"]')
        const emit = (event: string, id: string | null) =>
          page.evaluate(([e, u]) => (window as unknown as { __vfAuthEmit: (e: string, u: unknown) => void }).__vfAuthEmit(e as string, u ? { id: u } : null), [event, id] as const)
        const rootText = () => page.locator('#root').innerText()
        const tabToSummary = async () => {
          await page.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
          for (let i = 0; i < 80; i += 1) {
            await page.keyboard.press('Tab')
            const hit = await page.evaluate(() => {
              const el = document.activeElement
              if (!el || !el.matches('details[data-story-context-notes] > summary')) return null
              const cs = getComputedStyle(el)
              const r = el.getBoundingClientRect()
              return {
                outline: cs.outlineStyle,
                outlineWidth: cs.outlineWidth,
                h: r.height,
                w: r.width,
                minHeight: cs.minHeight,
                display: cs.display,
                nativeSummaryInDetails: el.tagName === 'SUMMARY' && el.parentElement?.tagName === 'DETAILS' && el.parentElement.firstElementChild === el,
              }
            })
            if (hit) return hit
          }
          return null
        }
        const order = () =>
          page.evaluate(() => {
            const body = document.querySelector('[data-story-body]')
            const notes = document.querySelector('[data-story-context-notes]')
            const done = document.querySelector('[data-story-complete]')
            if (!body || !notes || !done) return null
            const after = (a: Element, b: Element) => !!(a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING)
            return { afterBody: after(body, notes), beforeComplete: after(notes, done), insideMain: !!notes.closest('#story-content') }
          })
        const log = await readerHarness(context, `w2-notes@${width}`, run)
        try {
          // 1) 3번째 단위(u3) 직접 진입 — 본문 뒤 · 읽음 표시 앞 · 접힘 · 요약은 개수만 · 키보드로 닿고 44px · Enter 열고 닫기 · Space 열기
          await openStories(page, `/library/stories/${b1}?unit=2`)
          await sx(B(page)).toBeVisible()
          await sx(det).toHaveCount(1)
          await sx(det).toHaveAttribute('data-story-context-notes', '2')
          expect(await order()).toEqual({ afterBody: true, beforeComplete: true, insideMain: true })
          await sx(det.locator('summary')).toHaveText('시대적 맥락 2가지 · 원할 때 펼쳐 보세요')
          expect(await det.evaluate((d) => (d as HTMLDetailsElement).open)).toBe(false)
          await sx(det.locator('li').first()).toBeHidden()
          await noOverflow(page)
          await shot(page, `w2-notes-closed-${width}`)
          const reach = await tabToSummary()
          expect(reach, 'context-notes summary reachable by Tab').not.toBeNull()
          expect(reach!.outline).not.toBe('none')
          expect(reach!.h).toBeGreaterThanOrEqual(44)
          expect(reach!.minHeight).toBe('44px')
          expect(reach!.display).toBe('list-item')
          expect(reach!.nativeSummaryInDetails).toBe(true)
          fs.mkdirSync(SHOTS, { recursive: true })
          fs.appendFileSync(path.join(SHOTS, 'w2-summary-metrics.jsonl'), `${JSON.stringify({ width, where: 'unit-2', ...reach, at: new Date().toISOString() })}\n`)
          await page.keyboard.press('Enter')
          await sx(det.locator('li')).toHaveText(textsOf('u3'))
          await noOverflow(page)
          await shot(page, `w2-notes-open-${width}`)
          const axe = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).include('[data-story-context-notes]').analyze()
          expect(axe.violations.map((v) => `${v.impact}/${v.id} ×${v.nodes.length}`)).toEqual([])
          await page.keyboard.press('Enter')
          expect(await det.evaluate((d) => (d as HTMLDetailsElement).open)).toBe(false)
          await page.keyboard.press('Space')
          expect(await det.evaluate((d) => (d as HTMLDetailsElement).open)).toBe(true)
          expect(writes(run)).toEqual([])
          expect(run.rpc.filter((c) => c.fn === 'story_unit_context_notes').map((c) => c.args)).toEqual([{ p_release_key: b1, p_unit_index: 2 }])

          // 2) 단위 이동 + 늦은 응답 — 응답이 오기 전에는 지금 단위(3번째)와 그 설명 둘 그대로 · 도착하면 4번째 단위와 그 단위 설명 하나(접힌 채)
          const releasePage = holdNext(run, '__page')
          await page.locator('[data-story-go="next"], [data-story-go="forward"]').first().click()
          await sx.poll(() => run.pages.some((u) => u.endsWith('?unit=3'))).toBe(true)
          await sx(heading(page)).toContainText('3번째 단위')
          await sx(det).toHaveAttribute('data-story-context-notes', '2')
          releasePage()
          await sx(heading(page)).toContainText('4번째 단위')
          await sx(det).toHaveAttribute('data-story-context-notes', '1')
          await sx(det.locator('summary')).toHaveText('시대적 맥락 1가지 · 원할 때 펼쳐 보세요')
          expect(await det.evaluate((d) => (d as HTMLDetailsElement).open)).toBe(false)
          await det.locator('summary').click()
          await sx(det.locator('li')).toHaveText(textsOf('u4'))
          expect(await rootText()).not.toContain(notesOf('u3')[0]!.text)
          await shot(page, `w2-unit3-one-note-${width}`)

          // 3) 설명 없는 단위(5번째) — 요소 · 「불러오지 못함」 줄 모두 없음 · 이동은 위치 기록만
          await goUnit(page, page.locator('[data-story-go="next"], [data-story-go="forward"]').first(), 4)
          await sx(det).toHaveCount(0)
          await sx(unavailable).toHaveCount(0)
          expect(await rootText()).not.toContain('시대적 맥락')
          await noOverflow(page)
          await shot(page, `w2-no-note-${width}`)
          expect(writes(run).map((c) => c.fn)).toEqual(['story_record_position', 'story_record_position'])

          // 4) 맥락 설명 RPC 없음(공유 DB 의 지금 상태 · SQL 미적용) — 「불러오지 못함 · 없다는 뜻 아님」 · 본문 · 읽음 표시 · 완료 기록 그대로
          editDb(run, (db) => {
            db.context_notes_missing = true
          })
          await openStories(page, `/library/stories/${b1}?unit=2`)
          await sx(B(page)).toBeVisible()
          await sx(unavailable).toHaveAttribute('data-story-context-notes-reason', 'not_ready')
          await sx(unavailable).toContainText('설명이 없다는 뜻은 아니에요')
          await sx(det).toHaveCount(0)
          await markUnit(page, 2)
          expect(progressOf(run, FM.users.A, b1)!.completed_units).toEqual([2])
          await noOverflow(page)
          await shot(page, `w2-notes-missing-${width}`)

          // 5) 결속 거부(story:context_notes_mismatch) — 「확인하지 못함」 · 본문 그대로
          editDb(run, (db) => {
            db.context_notes_missing = false
            db.context_notes_corrupt = [b1]
          })
          await openStories(page, `/library/stories/${b1}?unit=2`)
          await sx(B(page)).toBeVisible()
          await sx(unavailable).toHaveAttribute('data-story-context-notes-reason', 'invalid')
          await sx(unavailable).toContainText('확인하지 못해 보여 드리지 않아요')
          await sx(det).toHaveCount(0)
          await shot(page, `w2-notes-invalid-${width}`)

          // 6) 다른 단위를 말하는 응답(어긋난 · 늦은 응답) — 그 설명을 싣지 않고 「확인하지 못함」
          editDb(run, (db) => {
            db.context_notes_corrupt = []
            db.context_notes_wrong_unit = [b1]
          })
          await openStories(page, `/library/stories/${b1}?unit=2`)
          await sx(B(page)).toBeVisible()
          await sx(unavailable).toHaveAttribute('data-story-context-notes-reason', 'invalid')
          for (const t of ALL_TEXTS) expect(await rootText()).not.toContain(t)
          await shot(page, `w2-notes-wrong-unit-${width}`)

          // 7) 계정 전환 — 설명이 보이던 중 B 로 바뀌면 설명 · 본문 없음 · 이동 응답이 늦게 도착해도 다시 그리지 않는다
          editDb(run, (db) => {
            db.context_notes_wrong_unit = []
          })
          await openStories(page, `/library/stories/${b1}?unit=2`)
          await sx(det).toHaveAttribute('data-story-context-notes', '2')
          const releaseLate = holdNext(run, '__page')
          await page.locator('[data-story-go="next"], [data-story-go="forward"]').first().click()
          await sx.poll(() => run.pages.filter((u) => u.endsWith('?unit=3')).length).toBeGreaterThan(1)
          await emit('SIGNED_IN', FM.users.B)
          await sx(page.locator('[data-story-state="auth_changed"]')).toBeVisible()
          releaseLate()
          await page.waitForTimeout(1000)
          await sx(page.locator('[data-story-state="auth_changed"]')).toBeVisible()
          await sx(page.locator('[data-story-context-notes]')).toHaveCount(0)
          for (const t of ALL_TEXTS) expect(await rootText()).not.toContain(t)
          await shot(page, `w2-notes-account-switch-${width}`)

          // 8) 다른 학습자(B · 쿠키 · 브라우저 모두 B) — 같은 공개 설명 · 자기 진도(A 의 완료가 보이지 않음)
          run.actor = FM.users.B
          run.browserUser = undefined
          await openStories(page, `/library/stories/${b1}?unit=3`)
          await sx(det).toHaveAttribute('data-story-context-notes', '1')
          await sx(page.locator('[data-story-complete="marked"]')).toHaveCount(0)

          expect(writes(run).filter((c) => c.fn === 'story_complete_unit')).toHaveLength(1)
          expect(progressOf(run, FM.users.B, b1)).toBeNull()
          const events = await closedTelemetry(page)
          expect(events.every((e) => ['story_catalog_viewed', 'story_reader_action'].includes(e.name))).toBe(true)
          for (const e of events) expect(JSON.stringify(e)).not.toMatch(/note-|시대적/)
          await noIdentityLeak(page, ALL_TEXTS.map((t) => t.slice(0, 20)))
        } finally {
          finishRun(run, log)
        }
        assertQuietNetwork(log)
      })

      test('키보드 — 건너뛰기 링크 · 탭 순서 · 보이는 초점 · 이동 뒤 단위 제목 초점 · 상태 알림 뷰포트', async ({ page, context }) => {
        test.setTimeout(180_000)
        const run = newRun(`keyboard-${width}`)
        const key = FM.release_keys.B1
        const log = await readerHarness(context, `keyboard@${width}`, run)
        try {
          await openStories(page, `/library/stories/${key}?unit=1`)
          await sx(B(page)).toBeVisible()
          await page.keyboard.press('Tab')
          const first = await page.evaluate(() => {
            const el = document.activeElement as HTMLElement
            const r = el.getBoundingClientRect()
            return { text: el.textContent?.trim(), w: r.width, h: r.height, top: r.top }
          })
          // 첫 Tab = 셸의 「본문으로 건너뛰기」(#main-content · 하네스가 (main)/layout 마크업을 옮겨 적음). 그 뒤 Library 탭 · 레일을 지나
          // 독서 화면 자기 링크 「이야기 본문으로 건너뛰기」(머리 · 목차를 건너 단위 본문으로)가 온다. 목적지가 다른 두 링크는 이름이 달라야 구별된다.
          expect(first.text).toBe('본문으로 건너뛰기')
          expect(first.w).toBeGreaterThan(10)
          expect(first.top).toBeGreaterThanOrEqual(0)
          let second: { text?: string; href: string | null; w: number; top: number } | null = null
          for (let i = 0; i < 30 && !second; i += 1) {
            await page.keyboard.press('Tab')
            const now = await page.evaluate(() => {
              const el = document.activeElement as HTMLElement
              const r = el.getBoundingClientRect()
              return { text: el.textContent?.trim(), href: el.getAttribute('href'), w: r.width, top: r.top }
            })
            if (now.text === '이야기 본문으로 건너뛰기') second = now
            // 같은 이름 「본문으로 건너뛰기」가 두 번째로 나오면 안 된다.
            else expect(now.text).not.toBe('본문으로 건너뛰기')
          }
          expect(second, 'reader skip link reachable by keyboard').not.toBeNull()
          expect(second!.href).not.toBe('#main-content')
          expect(second!.w).toBeGreaterThan(10)
          expect(second!.top).toBeGreaterThanOrEqual(0)
          await shot(page, `current-reader-skip-link-${width}`)
          // 이 링크로 실제로 본문에 닿는다(초점이 본문 영역 안).
          const target = second!.href!.slice(1)
          await page.keyboard.press('Enter')
          await sx.poll(() => page.evaluate((id) => {
            const t = document.getElementById(id)
            return !!t && (t === document.activeElement || t.contains(document.activeElement) || location.hash === `#${id}`)
          }, target)).toBe(true)
          // 탭 순서 기록(최대 40) — 각 초점이 보이는지(outline 또는 box-shadow)
          const order: { tag: string; text: string; go: string | null; visibleFocus: boolean }[] = []
          for (let i = 0; i < 40; i += 1) {
            const item = await page.evaluate(() => {
              const el = document.activeElement as HTMLElement
              const cs = getComputedStyle(el)
              const visibleFocus = (cs.outlineStyle !== 'none' && parseFloat(cs.outlineWidth) > 0) || cs.boxShadow !== 'none'
              return { tag: el.tagName.toLowerCase(), text: (el.textContent ?? '').trim().slice(0, 40), go: el.getAttribute('data-story-go') ?? el.getAttribute('data-story-complete') ?? el.getAttribute('data-story-source-toggle'), visibleFocus }
            })
            order.push(item)
            await page.keyboard.press('Tab')
          }
          fs.writeFileSync(path.join(WORK, `tab-order-${width}.json`), `${JSON.stringify(order, null, 2)}\n`)
          const idx = (pred: (o: (typeof order)[number]) => boolean) => order.findIndex(pred)
          const iComplete = idx((o) => o.go === 'ready')
          const iNext = idx((o) => o.go === 'next' || o.go === 'forward')
          const iToggle = idx((o) => o.text === '원문 대응 보기')
          const iToc = idx((o) => o.go === 'toc')
          const iSibling = idx((o) => o.text.startsWith('Easy Reader'))
          expect(iComplete).toBeGreaterThan(0)
          expect(iNext).toBeGreaterThan(iComplete)
          expect(iToggle).toBeGreaterThan(iNext)
          expect(iToc).toBeGreaterThan(iToggle)
          expect(iSibling).toBeGreaterThan(iToc)
          const invisible = order.filter((o) => o.tag !== 'body' && !o.visibleFocus)
          expect(invisible, 'every focus stop shows a visible focus indicator').toEqual([])

          // 키보드만으로: 읽음 표시(Space) → 상태 알림이 뷰포트 안 → 다음 단위(Enter) → 단위 제목 초점
          await completeBtn(page).focus()
          await page.keyboard.press('Space')
          await sx(page.locator('[data-story-complete="marked"][data-unit="1"]')).toBeVisible()
          await sx(statusDock(page)).toContainText('읽음으로 표시했어요')
          await sx(statusDock(page)).toBeInViewport()
          await sx(statusDock(page)).toHaveAttribute('aria-live', 'polite')
          await page.locator('[data-story-go="next"]').focus()
          await page.keyboard.press('Enter')
          await sx.poll(() => search(page).get('unit')).toBe('2')
          await sx(heading(page)).toBeFocused()
          await sx(heading(page)).toBeInViewport()
          await shot(page, `current-reader-keyboard-heading-focus-${width}`)
          // 셸 건너뛰기 링크 → main#main-content 초점
          await page.evaluate(() => window.scrollTo(0, 0))
          await page.locator('a[href="#main-content"]').focus()
          await page.keyboard.press('Enter')
          await sx.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('main-content')
          await closedTelemetry(page)
        } finally {
          finishRun(run, log)
        }
        assertQuietNetwork(log)
      })

      test('Books 면(현재 작업 트리) — 기준선 대비 탭 줄', async ({ page, context }) => {
        const run = newRun(`books-${width}`)
        const log = await readerHarness(context, `books@${width}`, run)
        try {
          await openStories(page, '/library/books')
          const tabs = page.getByRole('tablist', { name: '라이브러리 탭' })
          await sx(tabs).toBeVisible()
          const names = (await tabs.getByRole('tab').allInnerTexts()).map((t) => t.trim())
          const baseline = fs.existsSync(path.join(WORK, `baseline-tabs-${width}.json`)) ? (JSON.parse(fs.readFileSync(path.join(WORK, `baseline-tabs-${width}.json`), 'utf8')) as { tabNames: string[] }).tabNames : null
          fs.writeFileSync(path.join(WORK, `current-books-tabs-${width}.json`), `${JSON.stringify({ baseline, current: names }, null, 2)}\n`)
          // 기존 네 면은 그대로 같은 순서로 남는다(새 면은 더해질 수 있다)
          if (baseline) expect(names.filter((n) => baseline.includes(n))).toEqual(baseline)
          await noOverflow(page)
          await shot(page, `current-library-books-${width}`)
          expect(await closedTelemetry(page)).toEqual([])
        } finally {
          finishRun(run, log)
        }
        assertQuietNetwork(log)
      })
    })
  }
})
