// apps/web/tests/e2e/csat-learning-loop.spec.ts
//
// **기출 학습 루프(G1) — 문항을 열어 마칠 때까지.** 계약: docs/csat-learner/G0_LEARNING_CONTRACT.md
//
// ⚠️ DB 에 쓰지 않는다. `/api/csat/state` 는 이 파일 안의 **가짜 서버**(실제 병합 함수 `mergeDissection`)가
//    받고, 분석 이벤트 · 그 밖의 쓰기 요청은 모두 가로채 기록만 한다. 두 기기 시나리오는 같은 가짜 서버를
//    공유하는 브라우저 컨텍스트 둘로 돈다. 합성 학습자 검증이다 — 학습 효과를 말하지 않는다.
// 스크린샷에는 평가원 지문이 찍힌다 → 저장소 밖(`test-results-csat-learner/`, D15).

import path from 'node:path'
import { expect, test, type Browser, type BrowserContext, type Page } from '@playwright/test'

import { mergeDissection } from '../../src/lib/csat/continuity'
import { emptyDissectionRecord, type DissectionRecord, type Prediction } from '../../src/lib/csat/dissect'
import type { LearningSession } from '../../src/lib/csat/learning-session'

const USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password:
    process.env.PLAYWRIGHT_RUNTIME_PASSWORD ??
    (() => {
      throw new Error('PLAYWRIGHT_RUNTIME_PASSWORD 가 없다 — apps/web/.env.local')
    })(),
}
const SHOTS = path.resolve('test-results-csat-learner/learning-loop')
const KICE = '2026-34' // 강의 14단계
const KICE_ID = '2026#34'
const HP = 'H2503G1-20' // 학평 — 강의 없음(단계 0)
const HP_ID = 'H2503G1#20'

let storage: Awaited<ReturnType<BrowserContext['storageState']>>

test.describe.configure({ mode: 'serial' })
test.setTimeout(180_000)

test.beforeAll(async ({ browser }) => {
  const ctx = await browser.newContext()
  // 로그인 화면 · 로그인 뒤 첫 화면도 분석 이벤트를 보낸다 — 여기서도 가로챈다(G1 실행 중 이 경로로
  // funnel_events 에 screen_viewed 3행이 실제로 쓰였다 · 2026-10-08 실측). 인증 요청만 통과시킨다.
  await ctx.route('**/api/analytics/event', (route) => route.fulfill({ json: { ok: true } }))
  const page = await ctx.newPage()
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.fill('input[type="email"]', USER.email)
  await page.fill('input[type="password"]', USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })
  storage = await ctx.storageState()
  await ctx.close()
})

/** 가짜 서버 — 실제 병합 함수로 합친다(route.ts 와 같은 규칙). puts 는 받은 PUT 수 */
class FakeServer {
  record: DissectionRecord | null
  puts = 0
  failPut = false
  constructor(seed: DissectionRecord | null = null) {
    this.record = seed
  }
}

interface Probe {
  page: Page
  ctx: BrowserContext
  writes: string[]
  events: string[]
}

async function device(browser: Browser, server: FakeServer, opts: { noPaper?: boolean; lecture500?: boolean } = {}): Promise<Probe> {
  const ctx = await browser.newContext({ storageState: storage, viewport: { width: 1440, height: 900 } })
  const page = await ctx.newPage()
  const probe: Probe = { page, ctx, writes: [], events: [] }
  await page.route('**/*', async (route) => {
    const req = route.request()
    const url = req.url()
    const method = req.method()
    if (url.includes('/api/csat/state')) {
      if (method === 'GET') return route.fulfill({ json: { ok: true, record: server.record } })
      if (method === 'PUT') {
        server.puts += 1
        if (server.failPut) return route.fulfill({ status: 503, json: { ok: false } })
        const incoming = (JSON.parse(req.postData() ?? '{}') as { record: DissectionRecord }).record
        server.record = server.record ? mergeDissection(incoming, server.record) : incoming
        return route.fulfill({ json: { ok: true } })
      }
      return route.fulfill({ json: { ok: true } })
    }
    if (opts.noPaper && url.includes('/api/csat/dev-paper')) return route.fulfill({ status: 404, json: {} })
    if (opts.lecture500 && url.includes('/api/csat/lecture')) return route.fulfill({ status: 500, json: { ok: false } })
    const write = method !== 'GET' && method !== 'HEAD' && method !== 'OPTIONS' && !url.includes('/auth/v1/')
    // 문제지 좌표 조회(POST · 읽기)는 통과시킨다 — 글자 없는 번호 좌표만 돌려준다
    if (write && !url.includes('/api/csat/paper')) {
      probe.writes.push(`${method} ${new URL(url).pathname}`)
      if (url.includes('/api/analytics/event')) {
        try {
          // 클라이언트 본문은 { name, props, surface } (lib/analytics/client.ts)
          const body = JSON.parse(req.postData() ?? '{}') as { name?: string }
          probe.events.push(String(body.name ?? 'unknown'))
        } catch {
          probe.events.push('unparsed')
        }
      }
      return route.fulfill({ json: { ok: true } })
    }
    return route.continue()
  })
  // 기기 기록은 깨끗한 상태에서 — 이전 실행의 IndexedDB 가 남지 않게(컨텍스트마다 새 저장소지만 명시)
  return probe
}

async function readRecord(page: Page): Promise<DissectionRecord | null> {
  return page.evaluate(
    () =>
      new Promise<DissectionRecord | null>((resolve) => {
        const req = indexedDB.open('vocaflow-csat', 1)
        req.onerror = () => resolve(null)
        req.onsuccess = () => {
          const db = req.result
          if (!db.objectStoreNames.contains('record')) return resolve(null)
          const get = db.transaction('record', 'readonly').objectStore('record').get('dissection-v1')
          get.onsuccess = () => resolve((get.result as DissectionRecord | undefined) ?? null)
          get.onerror = () => resolve(null)
        }
      }),
  )
}

const sessionsFor = (r: DissectionRecord | null, item: string): LearningSession[] => (r?.sessions ?? []).filter((s) => s.item === item)

async function openItem(p: Probe, slug: string) {
  await p.page.goto(`/csat/item/${slug}`, { waitUntil: 'domcontentloaded' })
  await expect(p.page.getByTestId('analysis-theater')).toBeVisible({ timeout: 90_000 })
}

/** 예측 관문은 없다(F01 · 2026-10-10) — 열자마자 해설 블록이 모두 보이고 상영할 수 있다 */
async function expectOpen(page: Page) {
  await expect(page.getByTestId('predict-gate')).toHaveCount(0)
  await expect(page.locator('[data-block="analysis:answer"]')).toBeVisible({ timeout: 30_000 })
  // 블록은 서버 HTML 로 먼저 보인다 — 키 입력 전에 하이드레이션 · 세션 읽기가 끝났음을 「마치기」 단추(클라이언트 상태)로 기다린다
  await expect(page.getByTestId('finish-item').or(page.getByTestId('session-done'))).toBeVisible({ timeout: 30_000 })
}

async function stepTo(page: Page, n: number) {
  await page.locator('body').click({ position: { x: 5, y: 5 } })
  for (let i = 0; i < n; i++) await page.keyboard.press('ArrowRight')
}

async function shot(page: Page, name: string) {
  await page.waitForTimeout(400)
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) })
}

const legacyPrediction = (over: Partial<Prediction>): Prediction => ({
  item: KICE_ID, type: 'R-BLANK', step: 1, hit: false, at: Date.UTC(2026, 8, 30), source: 'theater', sentence: 1, choice: 3, confidence: 4, ...over,
})

test('1 처음 열기 → 제출 없이 해설 · 강의 → 화살표 한 칸씩 → 완료 (viewed_first)', async ({ browser }) => {
  const server = new FakeServer()
  const p = await device(browser, server)
  await openItem(p, KICE)
  await expectOpen(p.page)
  // 큐가 가리키지 않아도 오답 블록까지 처음부터 읽힌다(F03)
  await expect(p.page.locator('[data-block^="analysis:reject"]').first()).toBeVisible()
  // ← → 는 한 칸씩(F12 — 전에는 극장 · 강의 무대가 둘 다 받아 두 칸씩 갔다)
  await stepTo(p.page, 3)
  await expect(p.page.getByText('4 / 14', { exact: false }).first()).toBeVisible()
  // 추정 위치를 「지난 시간」이라 하지 않는다(F13)
  await expect(p.page.getByText(/지난 시간|지남/)).toHaveCount(0)
  await p.page.getByTestId('finish-item').click() // 마지막 단계까지 넘기지 않아도 마칠 수 있다
  const done = p.page.getByTestId('session-done')
  await expect(done).toBeVisible()
  await expect(done).toHaveAttribute('data-completion', 'guided')
  await expect(done).toContainText('설계 설명을 읽고 마쳤어요')
  await shot(p.page, '1-done-viewed-first')
  const r = await readRecord(p.page)
  const s = sessionsFor(r, KICE_ID)
  expect(s).toHaveLength(1)
  expect(s[0]).toMatchObject({ stage: 'finished', help: 'viewed_first', activity: 'theater', phase: 'practice', sv: 1 })
  expect(s[0].attempt).toBeUndefined() // 해설 열람은 시도가 아니다
  expect((r?.predictions ?? []).filter((x) => x.item === KICE_ID)).toHaveLength(0)
  await p.ctx.close()
})

test('2 강의 없는 학평 문항 — 열자마자 읽고 마친다 (guided)', async ({ browser }) => {
  const server = new FakeServer()
  const p = await device(browser, server)
  await openItem(p, HP)
  await expect(p.page.getByTestId('predict-gate')).toHaveCount(0)
  // 학평도 지문 지도가 있다(F09 · 2026-10-11 학평 골격 2,299행 적재 — 전엔 37문항뿐이었다)
  await expect(p.page.getByText(/\d+ SENTENCES/).first()).toBeVisible({ timeout: 30_000 })
  await expect(p.page.getByText('NO MAP')).toHaveCount(0)
  await p.page.getByTestId('finish-item').click()
  const done = p.page.getByTestId('session-done')
  await expect(done).toHaveAttribute('data-completion', 'guided')
  await expect(done).toContainText('스스로 푼 기록으로 세지 않아요')
  await shot(p.page, '2-done-guided')
  const s = sessionsFor(await readRecord(p.page), HP_ID)
  expect(s[0]).toMatchObject({ stage: 'finished', help: 'viewed_first' })
  expect(s[0].attempt).toBeUndefined() // 열람은 시도가 아니다
  await p.ctx.close()
})

test('3 중도 이탈 → 재접속 → 이전 단계 복원', async ({ browser }) => {
  const server = new FakeServer()
  const p = await device(browser, server)
  await openItem(p, KICE)
  await expectOpen(p.page)
  await stepTo(p.page, 5)
  await expect.poll(async () => sessionsFor(await readRecord(p.page), KICE_ID)[0]?.step).toBe(5)
  await p.page.reload({ waitUntil: 'domcontentloaded' })
  await expect(p.page.getByTestId('resume-notice')).toContainText('6단계', { timeout: 60_000 })
  await expect(p.page.getByTestId('predict-gate')).toHaveCount(0)
  await expect(p.page.getByText('6 / 14', { exact: false }).first()).toBeVisible()
  await shot(p.page, '3-resumed')
  expect(sessionsFor(await readRecord(p.page), KICE_ID)).toHaveLength(1)
  await p.ctx.close()
})

test('4 같은 완료를 반복해도 완료 1건 · 다시 열면 완료 화면', async ({ browser }) => {
  const server = new FakeServer()
  const p = await device(browser, server)
  await openItem(p, HP)
  const finish = p.page.getByTestId('finish-item')
  await finish.dblclick()
  await expect(p.page.getByTestId('session-done')).toBeVisible()
  const first = sessionsFor(await readRecord(p.page), HP_ID)
  expect(first.filter((s) => s.finishedAt != null)).toHaveLength(1)
  await p.page.reload({ waitUntil: 'domcontentloaded' })
  await expect(p.page.getByTestId('session-done')).toBeVisible({ timeout: 60_000 })
  const again = sessionsFor(await readRecord(p.page), HP_ID)
  expect(again).toHaveLength(1)
  expect(again[0].finishedAt).toBe(first[0].finishedAt)
  // 다시 보기 예약도 한 번만
  await p.page.getByTestId('done-review').click()
  await expect(p.page.getByTestId('done-review-set')).toBeVisible()
  const reviewAt = sessionsFor(await readRecord(p.page), HP_ID)[0].reviewAt
  expect(reviewAt).toBeGreaterThan(Date.now())
  await p.ctx.close()
})

test('5 기존 기록(세션 없는 옛 확정 · 모르겠어요) → 새 모델로 이어 받기', async ({ browser }) => {
  const seed: DissectionRecord = {
    ...emptyDissectionRecord(11),
    predictions: [legacyPrediction({ sentence: null, choice: null, confidence: 1 })],
    updatedAt: Date.UTC(2026, 8, 30),
  }
  const server = new FakeServer(seed)
  const p = await device(browser, server)
  await openItem(p, KICE)
  await expect(p.page.getByTestId('gate-diff')).toBeVisible({ timeout: 30_000 })
  await expect(p.page.getByTestId('predict-gate')).toHaveCount(0)
  await expect(p.page.getByTestId('gate-diff')).toContainText('모르겠어요')
  const r = await readRecord(p.page)
  const s = sessionsFor(r, KICE_ID)
  expect(s[0]).toMatchObject({ stage: 'revealed', help: 'viewed_first' })
  // 옛 저장값은 그대로(읽는 시점 해석만)
  expect(r?.predictions.find((x) => x.item === KICE_ID)).toMatchObject({ sentence: null, choice: null, confidence: 1, hit: false })
  await p.ctx.close()
})

test('6 두 기기 — 단계는 이어지고, 마친 것은 되돌아가지 않는다', async ({ browser }) => {
  test.setTimeout(420_000) // 기기 둘 · 문항 세 번 열기(dev 컴파일 포함)
  const server = new FakeServer()
  const a = await device(browser, server)
  await openItem(a, KICE)
  await expectOpen(a.page)
  await stepTo(a.page, 3)
  await expect.poll(() => server.record?.sessions?.find((s) => s.item === KICE_ID)?.step ?? -1, { timeout: 15_000 }).toBe(3)

  const b = await device(browser, server)
  await openItem(b, KICE)
  await expect(b.page.getByTestId('resume-notice')).toContainText('4단계', { timeout: 60_000 })
  await stepTo(b.page, 10)
  await b.page.getByTestId('finish-item').click()
  await expect(b.page.getByTestId('session-done')).toBeVisible()
  await expect.poll(() => server.record?.sessions?.find((s) => s.item === KICE_ID)?.stage, { timeout: 15_000 }).toBe('finished')

  // A 는 옛 화면에서 단계를 더 넘긴다 — 늦게 올라가도 완료는 되돌아가지 않는다
  await stepTo(a.page, 2)
  const puts = server.puts
  await expect.poll(() => server.puts, { timeout: 15_000 }).toBeGreaterThan(puts)
  const merged = server.record?.sessions?.filter((s) => s.item === KICE_ID) ?? []
  expect(merged).toHaveLength(1)
  expect(merged[0].stage).toBe('finished')
  await openItem(a, KICE)
  await expect(a.page.getByTestId('session-done')).toBeVisible({ timeout: 60_000 })
  await a.ctx.close()
  await b.ctx.close()
})

test('7 삭제 표시한 세션은 다시 나타나지 않는다', async ({ browser }) => {
  const t = Date.UTC(2026, 9, 1)
  const gone: LearningSession = { id: 'gone-1', sv: 1, item: KICE_ID, activity: 'theater', phase: 'practice', stage: 'revealed', help: 'independent', step: 7, steps: 14, startedAt: t, updatedAt: t + 10, deleted: true }
  const server = new FakeServer({ ...emptyDissectionRecord(5), sessions: [gone], updatedAt: t + 10 })
  const p = await device(browser, server)
  await openItem(p, KICE)
  await expectOpen(p.page) // 지워진 세션으로 재개하지 않는다
  await expect(p.page.getByTestId('resume-notice')).toHaveCount(0)
  const local = sessionsFor(await readRecord(p.page), KICE_ID)
  expect(local.find((s) => s.id === 'gone-1')?.deleted).toBe(true)
  expect(local.filter((s) => !s.deleted)).toHaveLength(1)
  await expect.poll(() => server.record?.sessions?.find((s) => s.id === 'gone-1')?.deleted ?? null, { timeout: 15_000 }).toBe(true)
  await p.ctx.close()
})

test('8 적중률에서 「모르겠어요」를 뺀다 — 맞음 1 · 틀림 1 · 모르겠어요 2 → 50%', async ({ browser }) => {
  const at = Date.UTC(2026, 9, 1)
  const seed: DissectionRecord = {
    ...emptyDissectionRecord(3),
    predictions: [
      legacyPrediction({ item: '2026#20', hit: true, at }),
      legacyPrediction({ item: '2026#21', hit: false, at: at + 1 }),
      legacyPrediction({ item: '2026#22', hit: false, sentence: null, choice: null, confidence: 1, at: at + 2 }),
      legacyPrediction({ item: '2026#23', hit: false, sentence: null, choice: null, confidence: 1, at: at + 3 }),
    ],
    updatedAt: at + 3,
  }
  const p = await device(browser, new FakeServer(seed))
  await p.page.goto('/csat/formulas', { waitUntil: 'domcontentloaded' })
  await expect(p.page.getByText('예측 적중률')).toBeVisible({ timeout: 60_000 })
  await expect(p.page.locator('dd', { hasText: '%' }).first()).toHaveText('50%', { timeout: 30_000 })
  await p.ctx.close()
})

test('9 해부 화면 회귀 — 열리고 세트가 시작된다(시작 이벤트 1회)', async ({ browser }) => {
  const p = await device(browser, new FakeServer())
  const errors: string[] = []
  p.page.on('pageerror', (e) => errors.push(e.message))
  await p.page.goto('/csat/dissect', { waitUntil: 'domcontentloaded' })
  await expect(p.page.getByText('기출 해부').first()).toBeVisible({ timeout: 90_000 })
  await p.page.waitForTimeout(4000)
  expect(errors).toEqual([])
  expect(p.events.filter((e) => e === 'csat_session_started').length).toBeLessThanOrEqual(1)
  await p.ctx.close()
})

test('10 원문 없음 · 강의 오류 · 서버 저장 실패에서도 마칠 수 있다', async ({ browser }) => {
  const server = new FakeServer()
  server.failPut = true
  const p = await device(browser, server, { noPaper: true, lecture500: true })
  await openItem(p, KICE)
  await expect(p.page.getByTestId('item-paper-missing')).toBeVisible({ timeout: 60_000 })
  await expectOpen(p.page)
  await p.page.getByRole('button', { name: /상영 시작|하이라이트만/ }).click()
  await expect(p.page.locator('[role="status"]').filter({ hasText: /.+/ }).first()).toBeVisible({ timeout: 30_000 })
  await stepTo(p.page, 13)
  await p.page.getByTestId('finish-item').click()
  await expect(p.page.getByTestId('session-done')).toBeVisible()
  await shot(p.page, '10-failures-done')
  expect(sessionsFor(await readRecord(p.page), KICE_ID)[0]?.stage).toBe('finished') // 기기 기록은 남는다
  expect(server.record).toBeNull() // 서버 저장은 실패했다
  await p.ctx.close()
})

test('11 진단 화면 진입 이벤트는 한 번', async ({ browser }) => {
  const p = await device(browser, new FakeServer())
  await p.page.goto('/csat/diagnosis', { waitUntil: 'domcontentloaded' })
  // 첫 이벤트를 기다린 뒤, 두 번째가 오지 않는지 더 지켜본다(StrictMode 이중 effect 회귀)
  await expect.poll(() => p.events.filter((e) => e === 'csat_dx_viewed').length, { timeout: 60_000 }).toBeGreaterThanOrEqual(1)
  await p.page.waitForTimeout(4000)
  expect(p.events.filter((e) => e === 'csat_dx_viewed')).toHaveLength(1)
  await p.ctx.close()
})
