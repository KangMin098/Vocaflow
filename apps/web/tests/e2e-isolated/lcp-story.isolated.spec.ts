// apps/web/tests/e2e-isolated/lcp-story.isolated.spec.ts
//
// T-0174 LCP Story S4 — /admin/curation 의 실제 클라이언트 컴포넌트(AdminShell 시각 틀 + AdminCurationClient + 원본 탭 + AdminScreenHelp)를
// 실제 앱 CSS(admin 스킨)로 PC Chromium 1440×900 · 1280×900 에서 연다. 하네스: scripts/build-lcp-story-harness.mts.
// 가짜 origin http://harness.local 에서 page.route 가 하네스 HTML · 알려진 하네스 요청만 응답하고, 그 밖의 모든 요청(Supabase/Auth · 계측 포함)은
// abort 하고 호스트를 기록한다(work/lcp-story-s4/network-log.jsonl). 데이터는 전부 합성 — 원본 줄 props 는 tests/fixtures/lcp-story/original-curation.ts,
// 이야기 줄 후보 파일은 scripts/lcp/story/s4-harness-fixtures.ts 가 gitignored work/lcp-story-s4/story-fixtures/ 에 매 실행 만든다(synthetic-for-harness).
//
// 이야기 줄 Server Action(9개)은 하네스 대역이 POST /__story/<name> 으로 보내고, 여기서 tsx 자식 프로세스 scripts/lcp/story/s4-harness-eval.ts 가
// **실제** 서버 로직(lib/library/story/admin.ts · witness.ts — 실제 S2 검증기 · plan · buildValidationAttestation)을 가짜 쿠키/서비스 클라이언트와
// 메모리 가짜 DB(S3 SQL 의 RPC 규칙 흉내)로 돌려 응답한다. 「로그인 계정」 전환(curator 제출자 ↔ admin 검수 · 발행자)은 이 스펙의 테스트 제어다 — 제품 기능이 아니다.
// 자식 프로세스에는 PATH · 임시 폴더 등 최소 환경만 넘긴다(Supabase 자격 · .env 없음).
//
// 표현하지 않는 것(정직한 경계): app/admin/layout.tsx requireAdmin · middleware · page.tsx RSC 데이터 로딩 · 실제 쿠키 인증 ·
// PostgREST/RPC 실행 · RLS · 잠금 · 실제 Server Action 전송. 이 스펙은 컴포넌트 수준 브라우저 증거다 — 전체 live cookie/RPC E2E 가 아니다.
//
//   pnpm.cmd --dir apps/web exec tsx scripts/build-lcp-story-harness.mts
//   pnpm.cmd --dir apps/web exec playwright test -c playwright.isolated.config.ts tests/e2e-isolated/lcp-story.isolated.spec.ts
import { spawnSync } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

import { expect, test, type BrowserContext, type Page, type Route } from '@playwright/test'

import { BOOKS, HARBOR_PAGE2_FIRST } from '../fixtures/lcp-story/original-curation'

const REPO = path.resolve(__dirname, '../../../..')
const WORK = path.join(REPO, 'work/lcp-story-s4')
/** LCP_STORY_HARNESS_HTML 로 기준선 재생성용 하네스(빌더의 LCP_STORY_HARNESS_BASE)를 줄 수 있다 */
const HTML = process.env.LCP_STORY_HARNESS_HTML ?? path.join(WORK, 'harness/curation-harness.html')
/** 원본 줄 캡처 접두 — r = 연결 뒤 회귀(기본), a0 = 기준 커밋 클라이언트로 다시 만든 기준선 */
const ORIGINAL_PREFIX = process.env.LCP_STORY_ORIGINAL_PREFIX ?? 'r'
const SHOTS = path.join(WORK, 'shots')
const ORIGIN = 'http://harness.local'
const PATH = '/admin/curation'

export interface NetLog {
  test: string
  fulfilled: string[]
  aborted_hosts: string[]
  aborted_harness_paths: string[]
  actions: { prefix: string; name: string }[]
  page_errors: string[]
}
export type ActionHandler = (prefix: string, name: string, args: unknown[]) => Promise<{ value?: unknown; __throw?: string }> | { value?: unknown; __throw?: string }

/** 알려진 하네스 요청만 응답하고 나머지는 abort. 원본 줄 Server Action 은 호출되면 기록만 하고 { ok:false } 를 돌려준다. */
export async function harness(context: BrowserContext, name: string, onAction?: ActionHandler): Promise<NetLog> {
  const log: NetLog = { test: name, fulfilled: [], aborted_hosts: [], aborted_harness_paths: [], actions: [], page_errors: [] }
  const watch = (p: Page) => p.on('pageerror', (e) => log.page_errors.push(String(e.message).slice(0, 400)))
  context.pages().forEach(watch)
  context.on('page', watch)
  await context.route('**/*', async (route: Route) => {
    const url = new URL(route.request().url())
    if (url.origin !== ORIGIN) {
      if (!log.aborted_hosts.includes(url.host)) log.aborted_hosts.push(url.host)
      return route.abort('blockedbyclient')
    }
    if (url.pathname === PATH && route.request().method() === 'GET') {
      log.fulfilled.push(`GET ${url.pathname}`)
      return route.fulfill({ contentType: 'text/html; charset=utf-8', body: fs.readFileSync(HTML, 'utf8') })
    }
    if (url.pathname === '/api/admin/library/curation-jobs' && route.request().method() === 'GET') {
      // 큐 상태 GET 폴링 대역 — 합성 빈 큐
      log.fulfilled.push(`GET ${url.pathname}?kind=${url.searchParams.get('kind')}`)
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify({ ok: true, data: [] }) })
    }
    const m = /^\/(__action|__story)\/([A-Za-z0-9_$]+)$/.exec(url.pathname)
    if (m && route.request().method() === 'POST') {
      const [, prefix, action] = m as unknown as [string, string, string]
      log.actions.push({ prefix, name: action })
      log.fulfilled.push(`POST ${url.pathname}`)
      const { args } = route.request().postDataJSON() as { args: unknown[] }
      const out = onAction ? await onAction(prefix, action, args) : { value: { ok: false, error: 'harness: action not wired' } }
      return route.fulfill({ contentType: 'application/json', body: JSON.stringify(out) })
    }
    log.aborted_harness_paths.push(`${route.request().method()} ${url.pathname}`)
    return route.abort('blockedbyclient')
  })
  return log
}

export function writeNetLog(log: NetLog) {
  fs.mkdirSync(WORK, { recursive: true })
  const file = path.join(WORK, 'network-log.jsonl')
  fs.appendFileSync(file, `${JSON.stringify({ ...log, observed_at: new Date().toISOString() })}\n`)
}

export async function overflow(page: Page) {
  return page.evaluate(() => {
    const s = document.scrollingElement!
    return { scrollWidth: s.scrollWidth, clientWidth: s.clientWidth }
  })
}

/**
 * 캡처 두 장: `<name>.viewport.png` = 지금 스크롤 위치의 실제 뷰포트, `<name>.png` = 문서 맨 위부터의 전체 페이지
 * (sticky 사이드바가 문서 중간에 찍히지 않게 잠깐 맨 위로 올렸다가 원래 스크롤로 되돌린다 — 초점 · 상태는 그대로).
 */
export async function shot(page: Page, name: string) {
  fs.mkdirSync(SHOTS, { recursive: true })
  const file = path.join(SHOTS, `${name}.png`)
  await page.screenshot({ path: path.join(SHOTS, `${name}.viewport.png`) })
  const y = await page.evaluate(() => window.scrollY)
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: file, fullPage: true })
  await page.evaluate((top) => window.scrollTo(0, top), y)
  return file
}

/**
 * 글꼴 충실도 — layout.tsx 와 같은 admin 글꼴(Inter Variable · JetBrains Mono)이 실제로 로드됐는지.
 * document.fonts.check 는 대체 글꼴로도 참이 되므로 load() 가 돌려준 FontFace 가 비어 있지 않고 loaded 인지 본다.
 */
async function assertFonts(page: Page) {
  const r = await page.evaluate(async () => {
    const specs = ['400 16px "Inter Variable"', '700 16px "Inter Variable"', '400 16px "JetBrains Mono"', '500 16px "JetBrains Mono"', '700 16px "JetBrains Mono"']
    const loaded = await Promise.all(
      specs.map(async (spec) => {
        const faces = await document.fonts.load(spec, 'Admin 0123')
        return { spec, count: faces.length, statuses: faces.map((face) => face.status) }
      })
    )
    await document.fonts.ready
    const root = getComputedStyle(document.documentElement)
    return {
      loaded,
      admin_sans: root.getPropertyValue('--font-admin-sans').trim(),
      admin_mono: root.getPropertyValue('--font-admin-mono').trim(),
      font_body: root.getPropertyValue('--font-body').trim(),
      body_family: getComputedStyle(document.body).fontFamily,
    }
  })
  for (const item of r.loaded) {
    expect(item.count, `${item.spec} FontFace`).toBeGreaterThan(0)
    expect(item.statuses.every((status) => status === 'loaded'), `${item.spec} loaded`).toBe(true)
  }
  expect(r.admin_sans).toContain('Inter Variable')
  expect(r.admin_mono).toContain('JetBrains Mono')
  fs.writeFileSync(path.join(WORK, 'fonts-check.json'), `${JSON.stringify(r, null, 2)}\n`)
}

async function open(page: Page, query = '') {
  await page.goto(`${ORIGIN}${PATH}${query}`)
  await expect(page.locator('[data-curation-ready]')).toBeVisible()
  await assertFonts(page)
}

const search = (page: Page) => new URL(page.url()).searchParams

for (const width of [1440, 1280] as const) {
  test.describe(`원본 줄 기준선 @${width}`, () => {
    test.use({ viewport: { width, height: 900 } })
    let log: NetLog
    test.beforeEach(async ({ context }, info) => {
      expect(fs.existsSync(HTML), 'harness not built — run scripts/build-lcp-story-harness.mts').toBe(true)
      log = await harness(context, `${info.title}@${width}`)
    })
    test.afterEach(async ({ page }) => {
      writeNetLog(log)
      // 외부로 나간 요청은 0 — 전부 abort 됐고, 하네스가 모르는 harness.local 경로도 0
      expect(log.aborted_harness_paths).toEqual([])
      expect(log.page_errors).toEqual([])
      const events = await page.evaluate(() => (window as unknown as { __vfEvents?: unknown[] }).__vfEvents ?? []).catch(() => [])
      expect(events).toEqual([])
    })

    test('도서 목록 · 수집 · 검토 대기', async ({ page }) => {
      await open(page)
      await expect(page.getByRole('heading', { level: 1, name: '도서' })).toBeVisible()
      const nav = page.getByRole('navigation', { name: '도서 작업' })
      await expect(nav.getByRole('button', { name: '도서 목록' })).toHaveAttribute('aria-current', 'page')
      const summary = page.getByRole('list', { name: '도서 처리 요약' }).or(page.locator('dl[aria-label="도서 처리 요약"]'))
      await expect(summary).toContainText(String(BOOKS.length))
      await expect(page.getByText(`${BOOKS.length}권`, { exact: true })).toBeVisible()
      await expect(page.getByText(/1 \/ 2 페이지/)).toBeVisible()
      await expect.poll(() => overflow(page).then((o) => o.scrollWidth <= o.clientWidth)).toBe(true)
      await shot(page, `${ORIGINAL_PREFIX}-${width}-library`)

      await nav.getByRole('button', { name: '수집' }).click()
      await expect.poll(() => search(page).get('view')).toBe('collect')
      await expect(page.getByLabel('수집 방식')).toHaveValue('sources')
      await expect(page.getByText('Project Gutenberg').first()).toBeVisible()
      await expect.poll(() => overflow(page).then((o) => o.scrollWidth <= o.clientWidth)).toBe(true)
      await shot(page, `${ORIGINAL_PREFIX}-${width}-collect`)
      await page.getByLabel('수집 방식').selectOption('wikibooks')
      await expect.poll(() => search(page).get('method')).toBe('wikibooks')

      await nav.getByRole('button', { name: '검토 대기' }).click()
      await expect.poll(() => search(page).get('view')).toBe('review')
      expect(search(page).get('status')).toBe('ready')
      const ready = BOOKS.filter((b) => b.status === 'ready').length
      await expect(page.getByText(`${ready} / ${BOOKS.length}권`)).toBeVisible()
      await expect.poll(() => overflow(page).then((o) => o.scrollWidth <= o.clientWidth)).toBe(true)
      await shot(page, `${ORIGINAL_PREFIX}-${width}-review`)
    })

    test('URL 복원 · 상세 열기 · 도움말', async ({ page }) => {
      const q = `?view=library&q=harbor&status=published&page=2&selected=${HARBOR_PAGE2_FIRST.id}`
      await open(page, q)
      await expect(page.getByLabel('제목 또는 저자 검색')).toHaveValue('harbor')
      await expect(page.getByRole('radio', { name: /게시됨/ })).toHaveAttribute('aria-checked', 'true')
      await expect(page.getByText(/2 \/ 2 페이지 · 검색 결과 30권/)).toBeVisible()
      const dialog = page.getByRole('dialog')
      await expect(dialog).toBeVisible()
      await expect(dialog).toContainText(HARBOR_PAGE2_FIRST.title)
      await shot(page, `${ORIGINAL_PREFIX}-${width}-url-restore-detail`)
      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()
      await expect.poll(() => search(page).get('selected')).toBeNull()
      expect(search(page).get('q')).toBe('harbor')
      expect(search(page).get('status')).toBe('published')
      expect(search(page).get('page')).toBe('2')

      // 행 클릭으로 상세 열기 → URL 에 selected
      await page.getByRole('button', { name: HARBOR_PAGE2_FIRST.title, exact: true }).first().click()
      await expect(dialog).toBeVisible()
      await expect.poll(() => search(page).get('selected')).toBe(HARBOR_PAGE2_FIRST.id)
      await page.keyboard.press('Escape')
      await expect(dialog).toBeHidden()

      // 도움말 펼침
      await page.getByRole('button', { name: '화면 도움말' }).click()
      await expect(page.getByRole('region', { name: /화면 도움말/ })).toBeVisible()
      await expect(page.getByRole('region', { name: /화면 도움말/ })).toContainText('도서 목록')
      await expect.poll(() => overflow(page).then((o) => o.scrollWidth <= o.clientWidth)).toBe(true)
      await shot(page, `${ORIGINAL_PREFIX}-${width}-help`)
    })
  })
}

// ─────────────────────────────────────────────────────────────────────────────
// 이야기 판본 줄 — 실제 StoryCurationClient + 실제 서버 로직(자식 프로세스) + 메모리 가짜 DB
// ─────────────────────────────────────────────────────────────────────────────

const TSX = path.join(REPO, 'node_modules/tsx/dist/cli.mjs')
const FIX = path.join(WORK, 'story-fixtures')
/** 주입 시각(가짜 DB · 서버 로직 공통). 합성 검수 reviewed_at(2026-10-25T01:00Z)보다 뒤. */
const NOW = '2026-10-25T12:00:00.000Z'
interface Actor {
  uid: string
  role: string
  status: string
}
const CURATOR: Actor = { uid: '00000000-0000-4000-8000-0000000000c1', role: 'curator', status: 'active' }
const ADMIN: Actor = { uid: '00000000-0000-4000-8000-0000000000a1', role: 'admin', status: 'active' }
/** 합성 본문의 첫 문장 — URL · 브라우저 저장소에 나타나면 안 된다 */
const BODY_PROBE = 'Upon the bleak shoulder of Gull Rock'
const sx = expect.configure({ timeout: 15_000 })

/** 자식 프로세스 최소 환경 — 아래 목록 밖(.env · Supabase 자격 등)은 넘기지 않는다. spawnSync 의 ProcessEnv 타입으로는 호출부에서 단언만 한다(값을 넓히지 않는다). */
function childEnv(): Record<string, string> {
  const env: Record<string, string> = { NODE_OPTIONS: '--conditions=react-server' }
  for (const key of ['PATH', 'Path', 'PATHEXT', 'SystemRoot', 'SYSTEMROOT', 'windir', 'ComSpec', 'TEMP', 'TMP', 'USERPROFILE', 'HOME', 'APPDATA', 'LOCALAPPDATA']) {
    const value = process.env[key]
    if (value) env[key] = value
  }
  return env
}

function runTsx(script: string, input?: string): string {
  const r = spawnSync(process.execPath, [TSX, script], { cwd: REPO, input, encoding: 'utf8', env: childEnv() as NodeJS.ProcessEnv, maxBuffer: 1 << 26 })
  if (r.status !== 0) throw new Error(`${script} failed: ${r.stderr.slice(0, 2000)}`)
  return r.stdout
}

interface StoryRun {
  statePath: string
  actor: Actor | null
  actions: string[]
  rpc: { fn: string; result: string; code?: string }[]
}

function newRun(name: string): StoryRun {
  const statePath = path.join(WORK, 'state', `${name}.json`)
  fs.mkdirSync(path.dirname(statePath), { recursive: true })
  fs.writeFileSync(statePath, JSON.stringify({ seq: 0, sources: [], policies: [], slots: [], versions: [], reviews: [], rights: [], attestations: [], releases: [], faults: {}, rpc_log: [] }))
  return { statePath, actor: CURATOR, actions: [], rpc: [] }
}

function storyEval(run: StoryRun, action: string, args: unknown[]): unknown {
  const out = JSON.parse(runTsx('scripts/lcp/story/s4-harness-eval.ts', JSON.stringify({ action, args, statePath: run.statePath, actor: run.actor, now: NOW }))) as {
    value: unknown
    rpc_calls: { fn: string; result: string; code?: string }[]
  }
  run.actions.push(action)
  run.rpc.push(...out.rpc_calls)
  return out.value
}

/** 다음 한 번의 RPC 를 네트워크 실패로 만든다(가짜 DB 의 장애 주입 — 재시도 경로 확인용) */
function faultOnce(run: StoryRun, fn: string) {
  const state = JSON.parse(fs.readFileSync(run.statePath, 'utf8'))
  state.faults[fn] = { kind: 'network', times: 1 }
  fs.writeFileSync(run.statePath, JSON.stringify(state))
}

const encFile = (field: string, name: string) => [field, { __file: true, name, type: 'application/json', text: fs.readFileSync(path.join(FIX, name), 'utf8') }]

async function storyHarness(context: BrowserContext, name: string, run: StoryRun) {
  return harness(context, name, (prefix, action, args) => {
    if (prefix !== '__story') return { value: { ok: false, error: 'harness: original action not wired' } }
    return { value: storyEval(run, action, args) }
  })
}

const panel = (page: Page) => page.locator('section[aria-labelledby="story-files-title"]')
const nextBox = (page: Page) => page.locator('section[aria-labelledby="story-next-title"]')
const noOverflow = async (page: Page) => expect.poll(() => overflow(page).then((o) => o.scrollWidth <= o.clientWidth)).toBe(true)
const mutating = (run: StoryRun) => run.actions.filter((a) => /^(recordStoryRights|attestStoryValidation|publishStory|withdrawStory)Action$/.test(a))

async function pick(page: Page, label: string, file: string) {
  await panel(page).getByLabel(label, { exact: true }).setInputFiles(path.join(FIX, file))
}

async function storage(page: Page) {
  return page.evaluate(() => {
    const dump = (s: Storage) =>
      Array.from({ length: s.length }, (_, i) => s.key(i)!).map((k) => ({ key: k, bytes: (s.getItem(k) ?? '').length, value: s.getItem(k) ?? '' }))
    return { local: dump(localStorage), session: dump(sessionStorage), nav: ((window as unknown as { __vfNav?: { url: string }[] }).__vfNav ?? []).map((n) => n.url) }
  })
}

test.describe('이야기 판본 줄', () => {
  // 없는 요소를 시나리오 전체 타임아웃까지 기다리지 않는다(동작 10s · 단언 15s — 실제 서버 로직 자식 프로세스 왕복 포함)
  test.use({ actionTimeout: 10_000 })
  test.beforeAll(() => {
    runTsx('scripts/lcp/story/s4-harness-fixtures.ts')
  })

  for (const width of [1440, 1280] as const) {
    test.describe(`@${width}`, () => {
      test.use({ viewport: { width, height: 900 } })

      test('빈 상태 → 후보 검사 → 등록(부분 실패 · 재개) → 검수 · 차단 · 증인 · 발행 · 철회 → 원본 줄 복원', async ({ page, context }) => {
        test.setTimeout(420_000)
        expect(fs.existsSync(HTML), 'harness not built').toBe(true)
        const run = newRun(`flow-${width}`)
        const log = await storyHarness(context, `story-flow@${width}`, run)
        const shotName = (n: string) => `b-${width}-${n}`
        try {
          // 1) 원본 줄 조건(검색 · 상태 · 2쪽)에서 이야기 줄로
          await open(page, '?view=library&q=harbor&status=published&page=2')
          await sx(page.getByText(/2 \/ 2 페이지/)).toBeVisible()
          const lines = page.getByRole('navigation', { name: '작업 라인' })
          await lines.getByRole('button', { name: '이야기 판본' }).click()
          await sx(page.locator('[data-curation-line="story"]')).toBeVisible()
          await sx(page.getByText('등록된 판본 자리가 없습니다')).toBeVisible()
          expect(Object.fromEntries(['line', 'view', 'q', 'status', 'page'].map((k) => [k, search(page).get(k)]))).toEqual({
            line: 'story',
            view: 'library',
            q: 'harbor',
            status: 'published',
            page: '2',
          })
          // 화면 진입 · 목록 읽기만으로는 읽기 액션 1개뿐 — 권리 · 증인 · 발행 요청 0
          expect(run.actions).toEqual(['listStorySlotsAction'])
          await noOverflow(page)
          await shot(page, shotName('01-story-empty'))

          // 2) 도움말 — 이야기 판본 탭 내용
          await page.getByRole('button', { name: '화면 도움말' }).click()
          const help = page.getByRole('region', { name: /화면 도움말/ })
          await sx(help).toContainText('이야기 판본')
          await noOverflow(page)
          await shot(page, shotName('02-story-help'))
          await page.getByRole('button', { name: '화면 도움말' }).click()
          await sx(help).toBeHidden()

          // 3) 후보 파일 — 합성 자료는 fixture_only 로 거부(등록 버튼 막힘, DB 호출 0)
          await page.getByRole('button', { name: '후보 파일 열기' }).first().click()
          await sx.poll(() => search(page).get('story_panel')).toBe('files')
          await sx(page.locator('#story-files-title')).toBeFocused()
          await pick(page, '원천 스냅숏 (필수)', 'source.synthetic.json')
          await pick(page, '편집 기준', 'policy.json')
          await pick(page, '판본 결과물', 'edition.synthetic.json')
          await panel(page).getByRole('button', { name: '파일 검사' }).click()
          await sx(panel(page).getByRole('status')).toContainText('파일 검사를 마쳤습니다')
          await sx(panel(page)).toContainText('예 — 적재할 수 없음')
          // 실제 S2 plan 은 검수가 없으면(review_missing) 합성이어도 status=hold 로 낸다 — 거부는 서버의 synthetic_not_allowed · fixture 사유가 한다
          await sx(panel(page)).toContainText('synthetic_not_allowed')
          await sx(panel(page)).toContainText('합성 자료 · 합성 원천이다')
          // D1(ui-defects.md) 수정 뒤: plan=hold 여도 fixture 사유가 있으면 「합성 자료 — 적재할 수 없음」으로 보인다
          await sx(panel(page)).toContainText('계획 판정 · 합성 자료 — 적재할 수 없음')
          await sx(panel(page)).not.toContainText('관리자 초안으로만 저장')
          await sx(panel(page)).toContainText('합성(시험용) 자료는 원천 · 판본 어느 단계로도 적재하지 않습니다')
          await sx(panel(page).getByRole('button', { name: '원천 등록', exact: true })).toBeDisabled()
          await sx(panel(page).getByRole('button', { name: '판본 제출', exact: true })).toBeDisabled()
          expect(run.rpc.filter((c) => c.fn.startsWith('story_admin_register') || c.fn === 'story_admin_submit_edition')).toEqual([])
          await shot(page, shotName('03-check-fixture-only'))

          // 4) 파일 오류(JSON 아님) → 고친 파일로 다시 검사 → hold(관리자 초안)
          await pick(page, '원천 스냅숏 (필수)', 'broken.json')
          await panel(page).getByRole('button', { name: '파일 검사' }).click()
          await sx(panel(page).getByRole('status')).toContainText('파일 검사 실패')
          await sx(panel(page).getByRole('status')).toContainText('upload_invalid_json')
          await shot(page, shotName('04-check-file-error'))
          await pick(page, '원천 스냅숏 (필수)', 'source.a.json')
          await pick(page, '판본 결과물', 'edition.a.json')
          await panel(page).getByRole('button', { name: '파일 검사' }).click()
          await sx(panel(page).getByRole('status')).toContainText('파일 검사를 마쳤습니다')
          await sx(panel(page)).toContainText('계획 판정 · 관리자 초안으로만 저장 · 학습자 발행 아님')
          await sx(panel(page)).toContainText('적재할 수 있습니다')
          await noOverflow(page)
          await shot(page, shotName('05-check-hold'))

          // 5) 단계 등록 — 원천 · 편집 기준 성공, 판본 제출은 네트워크 실패 → 앞 단계 결과 유지 · 같은 파일로 재개
          await panel(page).getByRole('button', { name: '원천 등록', exact: true }).click()
          await sx(panel(page).getByRole('status')).toContainText('원천 등록 · 새로 등록됨')
          await panel(page).getByRole('button', { name: '편집 기준 등록', exact: true }).click()
          await sx(panel(page).getByRole('status')).toContainText('판본 자리 2개')
          faultOnce(run, 'story_admin_submit_edition')
          await panel(page).getByRole('button', { name: '판본 제출', exact: true }).click()
          const failure = panel(page).getByRole('status')
          await sx(failure).toContainText('판본 제출 실패 — 앞 단계는 저장되어 있습니다')
          const steps = panel(page).getByRole('list', { name: '등록 단계' })
          // 판본 제출 단계도 원천 · 편집 기준 RPC 를 다시 부른다(같은 파일 → created=false) — 앞 단계 결과는 화면에 남는다
          await sx(steps).toContainText('같은 원천을 그대로 이어 씁니다')
          await sx(steps).toContainText('판본 자리 2개')
          await sx(steps).not.toContainText('새 판으로 제출됨')
          const panelText = await panel(page).innerText()
          expect(panelText, '부분 실패를 롤백으로 주장하지 않는다').not.toMatch(/롤백(되었|했|됨|합니다)|되돌렸|취소되었/)
          await shot(page, shotName('06-register-partial'))
          const beforeRetry = run.rpc.length
          await failure.getByRole('button', { name: '다시 시도' }).click()
          await sx.poll(() => search(page).get('story_slot')).not.toBeNull()
          await sx(steps).toContainText('이미 있음 — 같은 원천을 그대로 이어 씁니다')
          await sx(steps).toContainText('새 판으로 제출됨')
          expect(run.rpc.slice(beforeRetry).filter((c) => /register|submit_edition/.test(c.fn)).map((c) => `${c.fn}:${c.result}`)).toEqual([
            'story_admin_register_source:ok',
            'story_admin_register_policy:ok',
            'story_admin_submit_edition:ok',
          ])
          await shot(page, shotName('07-register-resumed'))
          const b1Slot = search(page).get('story_slot')!

          // 6) 제출 계정(curator)으로 보는 검수 상태 — 다른 스태프 필요 안내 · 업로드 막힘
          await page.getByRole('button', { name: '파일 패널 닫기' }).first().click()
          await sx(panel(page)).toHaveCount(0)
          await sx(nextBox(page).locator('#story-next-title')).toHaveText('다른 스태프의 검수 결과 올리기')
          await sx(nextBox(page)).toContainText('이 판을 제출한 계정은 검수·발행할 수 없습니다 — 다른 인증 스태프가 필요합니다')
          await sx(nextBox(page).getByRole('button', { name: '검수 결과 올리기' })).toBeDisabled()
          expect(mutating(run)).toEqual([])
          await noOverflow(page)
          await shot(page, shotName('08-review-state-producer'))

          // 7) 판본 미제출 자리 → 재개 안내 · 뒤로/앞으로 복원
          await page.getByRole('list', { name: '판본 자리' }).getByRole('button', { name: /easy-a2/ }).click()
          await sx(nextBox(page).locator('#story-next-title')).toHaveText('원천·편집 기준 파일을 다시 열기')
          const easySlot = search(page).get('story_slot')!
          expect(easySlot).not.toBe(b1Slot)
          await shot(page, shotName('09-draft-slot'))
          await page.goBack()
          await sx.poll(() => search(page).get('story_slot')).toBe(b1Slot)
          await sx(page.locator('#story-bundle-title')).toBeVisible()
          await page.goForward()
          await sx.poll(() => search(page).get('story_slot')).toBe(easySlot)
          await sx(nextBox(page).locator('#story-next-title')).toHaveText('원천·편집 기준 파일을 다시 열기')
          await page.goBack()
          await sx(page.locator('#story-bundle-title')).toBeVisible()

          // 8) 비교 — 단위 선택이 원문 구간 강조 · 변경 기록을 바꾼다(클릭 · 화살표)
          const units = page.getByRole('list', { name: /판본 단위/ }).getByRole('button')
          await units.nth(2).click()
          await sx(units.nth(2)).toHaveAttribute('aria-pressed', 'true')
          const source = page.getByRole('region', { name: '원문 구간' })
          await sx.poll(() => source.locator('p[lang="en"] mark').count()).toBeGreaterThan(0)
          const before = await page.getByRole('region', { name: '판본 단위 본문' }).innerText()
          await units.nth(2).press('ArrowDown')
          await sx(units.nth(3)).toHaveAttribute('aria-pressed', 'true')
          await sx(units.nth(3)).toBeFocused()
          expect(await page.getByRole('region', { name: '판본 단위 본문' }).innerText()).not.toBe(before)
          await noOverflow(page)
          await shot(page, shotName('10-compare-unit'))

          // 9) admin 으로 로그인한 것으로 바꾸고 새로 불러오기(URL 복원) → 자기 검수 파일은 거부
          run.actor = ADMIN
          await page.reload()
          await sx(page.locator('#story-bundle-title')).toBeVisible()
          expect(search(page).get('story_slot')).toBe(b1Slot)
          await sx(page.getByText('로그인 역할 · admin (화면 안내용)')).toBeVisible()
          await nextBox(page).getByLabel('검수 결과 파일 (.json)').setInputFiles(path.join(FIX, 'review.a.self.json'))
          await nextBox(page).getByRole('button', { name: '검수 결과 올리기' }).click()
          await sx(nextBox(page).getByRole('status')).toContainText('검수 결과 올리기 실패')
          await sx(nextBox(page).getByRole('status')).toContainText('self_review')
          await shot(page, shotName('11-blocked-self-review'))

          // 10) 독립 세션 검수 → 발행 자격
          await nextBox(page).getByLabel('검수 결과 파일 (.json)').setInputFiles(path.join(FIX, 'review.a.json'))
          await nextBox(page).getByRole('button', { name: '검수 결과 올리기' }).click()
          await sx(nextBox(page).getByRole('status')).toContainText('새 검수로 저장됨 · 발행 자격 있음')
          await sx(nextBox(page).locator('#story-next-title')).toHaveText('admin 권리 결정')
          // 새로고침으로 다음 작업이 바뀌어도 성공 알림이 남아 보인다
          await sx(nextBox(page).getByRole('status')).toBeVisible()
          await sx(nextBox(page).getByRole('status')).toBeInViewport()

          // 11) 권리 미확정 발행 → DB 거부 / 권리 확인 뒤 증명 없는 발행 → DB 거부
          const more = page.locator('details').filter({ has: page.locator('summary', { hasText: /다른 작업/ }) })
          await more.locator('summary').click()
          const publishBox = more.getByRole('region', { name: '발행 (admin)' })
          await publishBox.getByRole('button', { name: '발행', exact: true }).click()
          await publishBox.getByRole('button', { name: '발행 확정' }).click()
          // D2 수정 뒤: 결과 알림은 「다음 작업」 상자의 role=status 하나 — 결과가 생기면 그 영역을 뷰포트로 데려온다(smooth 스크롤 → 자동 재시도로 기다림)
          await sx(nextBox(page).getByRole('status')).toContainText('발행 실패')
          await sx(nextBox(page).getByRole('status')).toContainText('권리가 관리자 결정으로 확인되지 않았습니다')
          await sx(nextBox(page).getByRole('status')).toBeInViewport()
          // 컴포넌트는 실패 뒤 재시도를 위해 확인 단계(발행 확정 · 취소)를 남긴다 — 제품 동작 그대로 두고 명시적으로 닫는다
          await sx(publishBox.getByRole('button', { name: '발행 확정' })).toBeVisible()
          await shot(page, shotName('12-blocked-rights'))
          await publishBox.getByRole('button', { name: '취소' }).click()
          await nextBox(page).getByLabel('근거 (필수)').fill('하네스 합성 결정 — 실제 권리 심사 아님')
          await nextBox(page).getByLabel(/근거 자료 위치/).fill('harness-only')
          await nextBox(page).getByRole('button', { name: '권리 결정 기록' }).click()
          await sx(nextBox(page).getByRole('status')).toContainText('권리 결정 기록 · 원문')
          await sx(nextBox(page).locator('#story-next-title')).toHaveText('검증 증인 — 검증 실행')
          await sx(nextBox(page).getByRole('status')).toBeVisible()
          await sx(nextBox(page).getByRole('status')).toBeInViewport()
          // 증인은 버튼을 누르기 전에는 한 번도 불리지 않았다
          expect(run.actions.filter((a) => a === 'attestStoryValidationAction')).toEqual([])
          expect(run.rpc.filter((c) => c.fn.startsWith('story_service_'))).toEqual([])
          if (!(await more.evaluate((d) => (d as HTMLDetailsElement).open))) await more.locator('summary').click()
          await more.getByRole('region', { name: '발행 (admin)' }).getByRole('button', { name: '발행', exact: true }).click()
          await more.getByRole('region', { name: '발행 (admin)' }).getByRole('button', { name: '발행 확정' }).click()
          await sx(nextBox(page).getByRole('status')).toContainText('검증 증명이 없습니다')
          await sx(nextBox(page).getByRole('status')).toBeInViewport()
          await shot(page, shotName('13-blocked-not-attested'))
          await more.getByRole('region', { name: '발행 (admin)' }).getByRole('button', { name: '취소' }).click()

          // 12) 키보드만으로 「검증 실행」에 닿아 Enter — 보이는 초점 확인
          await page.locator('#story-next-title').click()
          let reached = false
          for (let i = 0; i < 40 && !reached; i += 1) {
            await page.keyboard.press('Tab')
            reached = await page.evaluate(() => document.activeElement?.textContent?.trim() === '검증 실행')
          }
          expect(reached, 'Tab 으로 「검증 실행」에 닿는다').toBe(true)
          expect(await page.evaluate(() => getComputedStyle(document.activeElement!).outlineStyle)).not.toBe('none')
          await shot(page, shotName('14-keyboard-focus'))
          await page.keyboard.press('Enter')
          await sx(nextBox(page).getByRole('status')).toContainText('검증 증인 · 증명 기록됨')
          expect(run.rpc.filter((c) => c.fn.startsWith('story_service_')).map((c) => `${c.fn}:${c.result}`)).toEqual([
            'story_service_validation_input:ok',
            'story_service_attest_validation:ok',
          ])
          await sx(nextBox(page).locator('#story-next-title')).toHaveText('admin 발행')
          await shot(page, shotName('15-witness-success'))

          // 13) 발행 성공
          await nextBox(page).getByRole('button', { name: '발행', exact: true }).click()
          await nextBox(page).getByRole('button', { name: '발행 확정' }).click()
          await sx(nextBox(page).getByRole('status')).toContainText(/발행 · 발행됨 · lsr_[0-9a-f]{32}/)
          await sx(nextBox(page).locator('#story-next-title')).toHaveText('이 자리에 열린 발행본 — 필요하면 철회')
          await sx(page.getByRole('region', { name: '발행본', exact: true })).toContainText('열람 가능')
          await shot(page, shotName('16-publish-success'))

          // 14) 철회 — 네트워크 실패 → 다시 시도 → 철회됨
          await nextBox(page).getByLabel('철회 사유 (필수)').fill('하네스 철회 시험')
          await nextBox(page).getByRole('button', { name: '철회', exact: true }).click()
          faultOnce(run, 'story_admin_withdraw')
          await nextBox(page).getByRole('button', { name: '철회 확정' }).click()
          await sx(nextBox(page).getByRole('status')).toContainText('철회 실패')
          await sx(nextBox(page).getByRole('status')).toContainText('서버에 연결하지 못했습니다')
          await shot(page, shotName('17-error-retry'))
          await nextBox(page).getByRole('status').getByRole('button', { name: '다시 시도' }).click()
          await sx(nextBox(page).getByRole('status')).toContainText('철회 · 철회됨')
          await sx(page.getByRole('region', { name: '발행본', exact: true })).toContainText('철회됨')
          // D3 수정 뒤: 같은 판 · 같은 검수의 철회본(예상 발행 키와 같음)이 있으면 다시 발행이 아니라 새 판 제출을 권한다
          await sx(nextBox(page).locator('#story-next-title')).toHaveText('새 판 제출')
          await sx(nextBox(page)).toContainText('발행 키가 같아 다시 발행할 수 없습니다')
          await noOverflow(page)
          await shot(page, shotName('18-withdraw'))

          // 15) 원본 줄 복원 — view · q · status · page 그대로 · 뒤로 가면 이야기 줄 자리 그대로
          await page.getByRole('navigation', { name: '작업 라인' }).getByRole('button', { name: '원본 도서' }).click()
          await sx(page.locator('[data-curation-line="original"]')).toBeVisible()
          expect(search(page).get('line')).toBeNull()
          expect(Object.fromEntries(['view', 'q', 'status', 'page'].map((k) => [k, search(page).get(k)]))).toEqual({ view: 'library', q: 'harbor', status: 'published', page: '2' })
          await sx(page.getByLabel('제목 또는 저자 검색')).toHaveValue('harbor')
          await sx(page.getByText(/2 \/ 2 페이지 · 검색 결과 30권/)).toBeVisible()
          await shot(page, shotName('19-original-restored'))
          await page.goBack()
          await sx(page.locator('[data-curation-line="story"]')).toBeVisible()
          expect(search(page).get('story_slot')).toBe(b1Slot)

          // 16) 선택한 도서까지 — 이야기 줄 URL 에 원본 selected 가 있으면 원본으로 돌아갈 때 상세가 다시 열린다
          await page.goto(`${ORIGIN}${PATH}?view=library&q=harbor&status=published&page=2&selected=${HARBOR_PAGE2_FIRST.id}&line=story&story_slot=${b1Slot}`)
          await sx(page.locator('#story-bundle-title')).toBeVisible()
          await page.getByRole('navigation', { name: '작업 라인' }).getByRole('button', { name: '원본 도서' }).click()
          await sx(page.getByRole('dialog')).toContainText(HARBOR_PAGE2_FIRST.title)
          await page.keyboard.press('Escape')

          // 17) 브라우저 저장소 · URL 에 원문 · 판본 본문이 없다
          const dump = await storage(page)
          for (const entry of [...dump.local, ...dump.session]) {
            expect(entry.value, `storage ${entry.key}`).not.toContain(BODY_PROBE)
            expect(entry.value, `storage ${entry.key}`).not.toContain('"units"')
          }
          for (const url of dump.nav) expect(url).not.toContain('Gull')
          fs.writeFileSync(
            path.join(WORK, `storage-${width}.json`),
            `${JSON.stringify({ local: dump.local.map(({ key, bytes }) => ({ key, bytes })), session: dump.session.map(({ key, bytes }) => ({ key, bytes })), nav_count: dump.nav.length }, null, 2)}\n`
          )
        } finally {
          writeNetLog(log)
          fs.writeFileSync(path.join(WORK, `story-run-${width}.json`), `${JSON.stringify({ actions: run.actions, rpc: run.rpc }, null, 2)}\n`)
        }
        expect(log.aborted_harness_paths).toEqual([])
        expect(log.page_errors).toEqual([])
      })
    })
  }

  test('source_url 보존 — 쿼리 · 프래그먼트 http URL 은 그대로 링크, null 은 없음, http/https 밖은 글자만', async ({ page, context }) => {
    test.setTimeout(240_000)
    const run = newRun('source-url')
    const seeded: Record<string, string> = {}
    // 시드도 같은 실제 서버 로직(registerStoryCandidate)을 거친다 — 화면 밖에서 부를 뿐이다
    for (const key of ['a', 'b', 'c']) {
      const form = { __formData: [['step', 'edition'], encFile('source', `source.${key}.json`), encFile('policy', 'policy.json'), encFile('edition', `edition.${key}.json`)] }
      const out = storyEval(run, 'registerStoryCandidateAction', [form]) as { ok: boolean; data: { edition: { slot_id: string } } }
      expect(out.ok).toBe(true)
      seeded[key] = out.data.edition.slot_id
    }
    const manifest = JSON.parse(fs.readFileSync(path.join(FIX, 'manifest.json'), 'utf8')) as { variants: Record<string, { source_url: string | null }> }
    const log = await storyHarness(context, 'story-source-url@1440', run)
    run.actions.length = 0
    try {
      const sourceSection = page.getByRole('region', { name: '원천', exact: true })
      // D4 수정 뒤: 같은 작품 키 · 판본 키의 서로 다른 원천 자리가 목록에서 구분된다(원천 · 기준 id 줄)
      await page.goto(`${ORIGIN}${PATH}?line=story`)
      const b1Buttons = page.getByRole('list', { name: '판본 자리' }).getByRole('button', { name: /story-b1/ })
      await sx(b1Buttons).toHaveCount(3)
      const labels = await b1Buttons.allInnerTexts()
      expect(new Set(labels).size, '세 원천의 story-b1 자리 라벨이 서로 다르다').toBe(3)
      for (const label of labels) expect(label).toMatch(/원천 [0-9a-f-]{36}/)
      await page.goto(`${ORIGIN}${PATH}?line=story&story_slot=${seeded.a}`)
      await sx(page.locator('#story-bundle-title')).toBeVisible()
      const link = sourceSection.getByRole('link')
      await sx(link).toHaveAttribute('href', manifest.variants.a!.source_url!)
      await sx(link).toHaveText(manifest.variants.a!.source_url!)
      await shot(page, 'b-1440-20-source-url-http')

      await page.goto(`${ORIGIN}${PATH}?line=story&story_slot=${seeded.b}`)
      await sx(page.locator('#story-bundle-title')).toBeVisible()
      await sx(sourceSection).toContainText('원천 URL · 없음')
      await sx(sourceSection.getByRole('link')).toHaveCount(0)

      await page.goto(`${ORIGIN}${PATH}?line=story&story_slot=${seeded.c}`)
      await sx(page.locator('#story-bundle-title')).toBeVisible()
      await sx(sourceSection).toContainText(manifest.variants.c!.source_url!)
      await sx(sourceSection.getByRole('link')).toHaveCount(0)
      await shot(page, 'b-1440-21-source-url-non-http')
      // 읽기만 했다 — 목록 · 번들 외 액션 0
      expect(run.actions.filter((a) => a !== 'listStorySlotsAction' && a !== 'loadStoryBundleAction')).toEqual([])
    } finally {
      writeNetLog(log)
    }
    expect(log.aborted_harness_paths).toEqual([])
    expect(log.page_errors).toEqual([])
  })
})
