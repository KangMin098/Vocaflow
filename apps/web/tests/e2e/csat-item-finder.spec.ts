// apps/web/tests/e2e/csat-item-finder.spec.ts
//
// 기출 찾기 팝업(FND0~FND4) — 실제 제품에서 조작한다. PC 1280 · 1440 라이트(다크 · 모바일 제외).
//   1. 문항 머리 주 버튼 → 팝업 → 네 구획 치수 · 검색 포커스 · 조작 영역 44 · 넘침 0 · axe · Esc 닫기 · 트리거로 포커스 복귀 (× 레일 접힘/펼침)
//   2. 2026#34 원문 이해(의미 · 깊이 · 초안 · 스크롤)를 고른 뒤 찾기 → 조건 · 행 선택 → 취소: 주소 · 선택 · 초안 · 스크롤 그대로
//   3. 다른 문항 선택 → 재검증 → 탐구 열기(기본 장면 · ret 유지 · pair/meaning 없음) → 「찾기 전 문항으로」 · 브라우저 뒤로 → 원래 주소 ·
//      늦은 정리가 새 페이지를 되돌리지 않음 · 같은 문항 선택은 이동 없음
//   4. 서가: killer 목적 · 스크롤 → 팝업 취소(그대로) · 조건 초기화 → 적용(목적 해제) · evidence/recent 별칭 · 팝업에서 문항 → ret 왕복
//   5. 지도 홈 입구 → 찾기 → 문항(from=map, 과제 문맥 없음) → 학습 지도로 · 독립 확인(check=1)에는 찾기 없음
//   6. 비교 없는 문항의 「다른 기출 찾기」 — 지금 유형으로 시작 · 고른 문항에 비교 쌍(pair)을 만들지 않음
//   7. 강의 재생 중 열기 → 멈춤(위치 유지) → 취소 뒤 자동 재개 없음 → 명시적 재개 · 다른 문항으로 가면 새 무대
//   8. 오류 상태(판정 실패 · 목록 실패 · 인증 만료 · 검색 0 · 열기 직전 보류/삭제/판정 실패 · 늦은 응답) · API 응답 allowlist · no-store · 401
//   9. 열고 닫기 반복 · 뒤로 · 앞으로 — history 한 칸 정리 · 새 페이지 역이동 없음 · 스크롤 잠금 해제
// CI 의 e2e 잡은 이 스펙을 돌리지 않는다(원문 문제지가 개발 기기에만 있다) — 로컬 실행 결과로만 보고한다.
//   PLAYWRIGHT_BASE_URL=http://localhost:3241 pnpm --filter web exec playwright test csat-item-finder
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import AxeBuilder from '@axe-core/playwright'
import { expect, test, type Page } from '@playwright/test'

const USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password:
    process.env.PLAYWRIGHT_RUNTIME_PASSWORD ??
    (() => {
      throw new Error('PLAYWRIGHT_RUNTIME_PASSWORD 가 없다 — apps/web/.env.local')
    })(),
}
const SHOTS = path.resolve('test-results-csat-learner/item-finder')

test.describe.configure({ mode: 'serial' })
test.setTimeout(420_000)

async function login(page: Page) {
  await page.route('**/api/analytics/event', (route) => route.fulfill({ json: { ok: true } }))
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', USER.email)
  await page.fill('input[type="password"]', USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60_000 })
}
async function noOverflow(page: Page, what: string) {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(o, `${what} 가로 넘침`).toBeLessThanOrEqual(0)
}
const finder = (page: Page) => page.getByTestId('item-finder')
async function ready(page: Page) {
  await expect(finder(page)).toBeVisible({ timeout: 30_000 })
  await expect(finder(page)).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
}
async function search(page: Page, q: string) {
  await page.getByTestId('item-finder-search').fill(q)
}
const row = (page: Page, id: string) => page.locator(`[data-testid="item-finder-items"] [data-item="${id}"]`)
async function closedClean(page: Page) {
  await expect(finder(page)).toHaveCount(0)
  // 오버레이 이력 칸이 걷혔고(맨 위가 우리 표식이 아님) 배경 스크롤 잠금이 풀렸다
  await expect.poll(() => page.evaluate(() => (window.history.state as { vocaflowOverlay?: boolean } | null)?.vocaflowOverlay === true)).toBe(false)
  expect(await page.evaluate(() => document.body.style.overflow)).not.toBe('hidden')
}
/** 서버가 그린 버튼에 React 처리기가 붙을 때까지(하이드레이션 전 클릭은 버려진다) */
async function hydrated(page: Page, testId: string) {
  await expect(page.getByTestId(testId)).toBeVisible({ timeout: 120_000 })
  await expect
    .poll(() => page.getByTestId(testId).evaluate((el) => Object.keys(el).some((k) => k.startsWith('__reactProps'))), { timeout: 120_000 })
    .toBe(true)
}
async function theaterReady(page: Page) {
  await expect(page.getByTestId('analysis-theater')).toBeVisible({ timeout: 120_000 })
  await hydrated(page, 'item-finder-open-btn')
}
/** 다른 문항 하나(현재 문항 · 보류 제외) — 실제 API 의 공개 목록에서 */
async function otherItem(page: Page, not: string): Promise<{ id: string; slug: string }> {
  const res = await page.request.get('/api/csat/item-finder')
  expect(res.status()).toBe(200)
  const body = (await res.json()) as { catalog: { items: { id: string; exam_id: string; no: number }[] } }
  const pick = body.catalog.items.find((i) => i.id !== not && i.exam_id === 'M2609' && i.no === 31) ?? body.catalog.items.find((i) => i.id !== not)!
  return { id: pick.id, slug: pick.id.replace('#', '-') }
}

/** 실측 기록 — 테스트마다 기존 파일에 합친다(한 테스트가 실패해 워커가 바뀌어도 앞 기록이 남게) */
const evidence: Record<string, unknown> = {}
function saveEvidence() {
  mkdirSync(SHOTS, { recursive: true })
  const file = path.join(SHOTS, 'evidence.json')
  const prev = existsSync(file) ? (JSON.parse(readFileSync(file, 'utf8')) as Record<string, unknown>) : {}
  writeFileSync(file, JSON.stringify({ ...prev, ...evidence }, null, 2))
}

// ── 1. 치수 · 접근성 · 닫기 ──────────────────────────────────────────────
for (const width of [1280, 1440]) {
  for (const rail of ['collapsed', 'expanded'] as const) {
    test(`1. 주 버튼 → 네 구획 · 포커스 · 44px · 넘침 · 닫기 ${width} 레일 ${rail}`, async ({ page }) => {
      mkdirSync(SHOTS, { recursive: true })
      const errors: string[] = []
      page.on('pageerror', (e) => errors.push(e.message))
      await page.setViewportSize({ width, height: 900 })
      await login(page)
      await page.goto('/csat/item/2026-34?scene=task', { waitUntil: 'domcontentloaded' })
      await theaterReady(page)
      if (rail === 'expanded' && (await page.getByTestId('csat-rail').getAttribute('data-collapsed')) === 'true') await page.getByTestId('rail-toggle').click()
      if (rail === 'collapsed' && (await page.getByTestId('csat-rail').getAttribute('data-collapsed')) === 'false') await page.getByTestId('rail-toggle').click()
      await expect(page.getByTestId('csat-rail')).toHaveAttribute('data-collapsed', rail === 'collapsed' ? 'true' : 'false')

      const trigger = page.getByTestId('item-finder-open-btn')
      // 보이는 면은 32px 이어도 버튼 상자(조작 영역)는 44 이상 — 위 · 아래 끝 점이 실제로 버튼에 닿는다(다른 요소에 덮이지 않음)
      const tb = (await trigger.boundingBox())!
      expect(tb.height, '트리거 조작 영역 높이').toBeGreaterThanOrEqual(44)
      expect(tb.width, '트리거 조작 영역 폭').toBeGreaterThanOrEqual(44)
      const hit = await page.evaluate(
        ({ x, top, bottom }) => [document.elementFromPoint(x, top + 1)?.closest('[data-testid="item-finder-open-btn"]') != null, document.elementFromPoint(x, bottom - 1)?.closest('[data-testid="item-finder-open-btn"]') != null],
        { x: tb.x + tb.width / 2, top: tb.y, bottom: tb.y + tb.height },
      )
      expect(hit, '트리거 조작 영역이 덮이지 않음').toEqual([true, true])
      await trigger.click()
      await ready(page)
      // 초기 포커스 = 보이는 레이블이 있는 검색 필드
      await expect(page.getByTestId('item-finder-search')).toBeFocused()
      await expect(page.getByLabel('찾기', { exact: true })).toBeVisible()

      const m = await page.evaluate(() => {
        const panel = document.querySelector('[data-testid="item-finder"]') as HTMLElement
        const r = (el: Element | null) => (el ? el.getBoundingClientRect() : null)
        const cols = Array.from(panel.querySelectorAll(':scope > div:nth-of-type(3) > section')).map((s) => Math.round(r(s)!.width))
        const small = Array.from(panel.querySelectorAll('button, select, [role="option"]'))
          .map((el) => r(el)!)
          .filter((b) => b.width > 0 && b.height > 0 && (b.width < 44 || b.height < 44)).length
        const fonts = {
          title: getComputedStyle(panel.querySelector('h2')!).fontSize,
          colHead: getComputedStyle(panel.querySelector('h3')!).fontSize,
          row: getComputedStyle(panel.querySelector('[data-row]')!).fontSize,
        }
        return {
          panel: { w: Math.round(r(panel)!.width), h: Math.round(r(panel)!.height), x: Math.round(r(panel)!.x), y: Math.round(r(panel)!.y) },
          head: Math.round(r(panel.querySelector('[data-part="head"]'))!.height),
          searchRow: Math.round(r(panel.querySelector('[data-part="head"]')!.nextElementSibling)!.height),
          foot: Math.round(r(panel.querySelector('[data-part="foot"]'))!.height),
          cols,
          small,
          fonts,
          vw: window.innerWidth,
          vh: window.innerHeight,
        }
      })
      evidence[`geometry-${width}-${rail}`] = m
      expect(m.panel.w).toBe(Math.min(1160, width - 64))
      expect(m.panel.h).toBe(Math.min(760, m.vh - 64))
      // 레일과 관계없이 뷰포트 가운데
      expect(Math.abs(m.panel.x - (m.vw - m.panel.w) / 2)).toBeLessThanOrEqual(1)
      expect(m.head).toBe(48)
      expect(m.searchRow).toBe(48)
      expect(m.foot).toBe(52)
      expect(m.cols.slice(0, 3)).toEqual([176, 208, 220])
      expect(m.cols[3]).toBe(m.panel.w - 176 - 208 - 220)
      saveEvidence()
      expect(m.small, '44px 미만 조작 요소').toBe(0)
      expect(m.fonts).toEqual({ title: '13px', colHead: '12px', row: '12px' })
      // 지금 문항이 목록에 표시된다
      await search(page, '2026#34')
      await expect(row(page, '2026#34')).toHaveAttribute('data-current', 'true')
      await noOverflow(page, `finder ${width} ${rail}`)
      const axe = await new AxeBuilder({ page }).include('[data-testid="item-finder"]').analyze()
      expect(axe.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([])
      await page.screenshot({ path: path.join(SHOTS, `finder-${width}-${rail}.png`) })
      // Esc → 닫힘 · 포커스는 트리거로
      await page.keyboard.press('Escape')
      await closedClean(page)
      await expect(trigger).toBeFocused()
      expect(errors).toEqual([])
    })
  }
}

// ── 2. 학습 상태를 건드리지 않는 취소 ─────────────────────────────────────
test('2. 2026#34 원문 이해 상태 · 초안 · 스크롤 — 찾기 취소 뒤 그대로', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page)
  await page.goto('/csat/item/2026-34?scene=meaning', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('ms-panel')).toBeVisible({ timeout: 120_000 })
  await page.locator('[data-testid="ms-unit"][data-unit="u2"]').click()
  await page.getByTestId('ms-depth').locator('[data-depth="deep"]').click()
  await page.getByTestId('ms-draft-open').click()
  await page.getByTestId('ms-draft-text').fill('찾기 전 초안 — 남아 있어야 한다')
  await page.evaluate(() => window.scrollTo(0, 240))
  const before = { url: page.url(), y: await page.evaluate(() => Math.round(window.scrollY)), unit: await page.getByTestId('ms-explain').getAttribute('data-unit') }

  // 스크롤을 움직이지 않는 클릭(DOM click) — Playwright 클릭은 버튼을 먼저 화면으로 끌어와 기준 위치를 바꾼다
  await page.getByTestId('item-finder-open-btn').evaluate((el) => (el as HTMLButtonElement).click())
  await ready(page)
  // 조건 · 회차 · 문항 조작(주소를 바꾸지 않는다)
  await page.locator('[data-cond="kind-mock"]').click()
  await search(page, '31')
  await page.locator('[data-testid="item-finder-exams"] [data-row]').nth(1).click()
  await page.locator('[data-testid="item-finder-items"] [data-row]').first().click()
  await expect(page.getByTestId('item-finder-summary')).toContainText('31번')
  expect(page.url()).toBe(before.url)
  // 키보드: 행 Enter 는 고르기만(이동 없음) · ↓ 는 포커스만
  await page.locator('[data-testid="item-finder-items"] [data-row]').first().focus()
  await page.keyboard.press('Enter')
  expect(page.url()).toBe(before.url)
  await page.getByTestId('item-finder-cancel').click()
  await closedClean(page)

  expect(page.url()).toBe(before.url)
  await expect(page.getByTestId('ms-explain')).toHaveAttribute('data-unit', before.unit!)
  await expect(page.getByTestId('ms-depth').locator('[data-depth="deep"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('ms-draft-text')).toHaveValue('찾기 전 초안 — 남아 있어야 한다')
  expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(before.y)
  // 배경 클릭 · 뒤로가기도 취소
  await page.getByTestId('item-finder-open-btn').click()
  await ready(page)
  await page.mouse.click(8, 450)
  await closedClean(page)
  await page.getByTestId('item-finder-open-btn').click()
  await ready(page)
  await page.goBack()
  await closedClean(page)
  expect(page.url()).toBe(before.url)
  await expect(page.getByTestId('ms-draft-text')).toHaveValue('찾기 전 초안 — 남아 있어야 한다')
})

// ── 3. 다른 문항 이동 · 복귀 · 같은 문항 ─────────────────────────────────
test('3. 다른 문항 → 재검증 → 탐구 열기 · 찾기 전 문항으로 · 뒤로 · 같은 문항', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page)
  const ret = '/csat/browse?type=R-BLANK'
  const start = `/csat/item/2026-34?scene=meaning&pair=keep~me&ret=${encodeURIComponent(ret)}`
  await page.goto(start, { waitUntil: 'domcontentloaded' })
  await theaterReady(page)
  const origin = page.url()
  const target = await otherItem(page, '2026#34')

  // 같은 문항 — 팝업만 닫힌다
  await page.getByTestId('item-finder-open-btn').click()
  await ready(page)
  await search(page, '2026#34')
  await row(page, '2026#34').click()
  await expect(page.getByTestId('item-finder-current')).toBeVisible()
  await page.getByTestId('item-finder-open').click()
  await closedClean(page)
  expect(page.url()).toBe(origin)

  // 다른 문항 — 재검증 요청이 나가고 기본 장면으로
  await page.getByTestId('item-finder-open-btn').click()
  await ready(page)
  // 서가 조건(ret)으로 시작한다 — 유형 R-BLANK 가 눌린 상태
  await expect(page.locator('[data-cond="type-R-BLANK"]')).toHaveAttribute('aria-pressed', 'true')
  await page.locator('[data-cond="type-all"]').click()
  await search(page, target.id)
  await row(page, target.id).click()
  const verify = page.waitForRequest((r) => r.url().includes('/api/csat/item-finder?verify='))
  await page.getByTestId('item-finder-open').click()
  await verify
  await page.waitForURL((u) => u.pathname === `/csat/item/${target.slug}`, { timeout: 120_000 })
  await theaterReady(page)
  const arrived = new URL(page.url())
  expect(arrived.searchParams.get('scene')).toBe('task')
  expect(arrived.searchParams.get('ret')).toBe(ret)
  for (const k of ['pair', 'back', 'meaning', 'rel', 'depth', 'check']) expect(arrived.searchParams.has(k), k).toBe(false)
  // 늦은 정리(back)가 새 페이지를 되돌리지 않는다
  await page.waitForTimeout(1500)
  expect(new URL(page.url()).pathname).toBe(`/csat/item/${target.slug}`)
  await expect(finder(page)).toHaveCount(0)

  // 브라우저 뒤로 → 원래 문항 주소(팝업이 다시 열리지 않는다)
  await page.goBack()
  await page.waitForURL((u) => u.pathname === '/csat/item/2026-34', { timeout: 120_000 })
  expect(page.url()).toBe(origin)
  await theaterReady(page)
  await expect(finder(page)).toHaveCount(0)
  // 앞으로 → 도착 문항 → 「찾기 전 문항으로」
  await page.goForward()
  await page.waitForURL((u) => u.pathname === `/csat/item/${target.slug}`, { timeout: 120_000 })
  await expect(page.getByTestId('item-finder-back')).toBeVisible({ timeout: 60_000 })
  await page.getByTestId('item-finder-back').click()
  await page.waitForURL((u) => u.pathname === '/csat/item/2026-34', { timeout: 120_000 })
  const back = new URL(page.url())
  expect(back.searchParams.get('scene')).toBe('meaning')
  expect(back.searchParams.get('pair')).toBe('keep~me')
  expect(back.searchParams.get('ret')).toBe(ret)
})

// ── 4. 서가 ────────────────────────────────────────────────────────────
test('4. 서가 — 취소 · 조건 초기화 → 적용 · 별칭 · 팝업에서 문항 → ret 왕복', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page)
  await page.goto('/csat/browse?purpose=killer', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('csat-workspace')).toBeVisible({ timeout: 120_000 })
  await hydrated(page, 'browse-finder-open')
  await page.evaluate(() => window.scrollTo(0, 500))
  const before = { url: page.url(), y: await page.evaluate(() => Math.round(window.scrollY)), count: await page.getByTestId('browse-count').textContent() }
  // 같은 결과 — 팝업과 서가가 같은 함수
  // 스크롤을 움직이지 않는 클릭(DOM click) — 2번과 같은 이유
  await page.getByTestId('browse-finder-open').evaluate((el) => (el as HTMLButtonElement).click())
  await ready(page)
  await expect(page.locator('[data-cond="killer"]')).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByTestId('item-finder-status')).toContainText(`${before.count}문항`)
  await page.locator('[data-cond="kind-mock"]').click()
  await page.getByTestId('item-finder-cancel').click()
  await closedClean(page)
  expect(page.url()).toBe(before.url)
  expect(await page.evaluate(() => Math.round(window.scrollY))).toBe(before.y)
  await expect(page.getByTestId('browse-count')).toHaveText(before.count!)

  // 조건 초기화(목적까지) → 서가에 적용
  await page.getByTestId('browse-finder-open').click()
  await ready(page)
  await page.getByTestId('item-finder-reset').click()
  await expect(page.locator('[data-cond="killer"]')).toHaveAttribute('aria-pressed', 'false')
  await page.getByTestId('item-finder-apply').click()
  await closedClean(page)
  await expect.poll(() => new URL(page.url()).search).toBe('')
  await expect(page.getByTestId('browse-title')).toHaveText('기출 탐구 — 전체')

  // 유형 적용 → 요약 칩
  await page.getByTestId('browse-finder-open').click()
  await ready(page)
  await page.locator('[data-cond="type-R-BLANK"]').click()
  await page.getByTestId('item-finder-apply').click()
  await closedClean(page)
  await expect.poll(() => new URL(page.url()).searchParams.get('type')).toBe('R-BLANK')
  await expect(page.getByTestId('browse-detail-type')).toBeVisible()

  // 별칭 — evidence · recent 는 조건으로 펼쳐져 팝업에서도 눌린 상태, 손대지 않으면 적용이 비활성
  for (const [alias, cond] of [['evidence', 'evidence'], ['recent', 'recent']] as const) {
    await page.goto(`/csat/browse?purpose=${alias}`, { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('csat-workspace')).toBeVisible({ timeout: 120_000 })
    await hydrated(page, 'browse-finder-open')
    await page.getByTestId('browse-finder-open').click()
    await ready(page)
    await expect(page.locator(`[data-cond="${cond}"]`)).toHaveAttribute('aria-pressed', 'true')
    await expect(page.getByTestId('item-finder-apply')).toBeDisabled()
    await page.keyboard.press('Escape')
    await closedClean(page)
  }

  // 팝업에서 문항 → ret = 팝업의 확정 조건(목적 포함) → 「뒤로」 가 그 조건으로
  await page.goto('/csat/browse?purpose=killer', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('csat-workspace')).toBeVisible({ timeout: 120_000 })
  await hydrated(page, 'browse-finder-open')
  await page.getByTestId('browse-finder-open').click()
  await ready(page)
  await page.locator('[data-cond="kind-suneung"]').click()
  const first = page.locator('[data-testid="item-finder-items"] [data-row]').first()
  const id = (await first.getAttribute('data-item'))!
  await first.click()
  await page.getByTestId('item-finder-open').click()
  await page.waitForURL((u) => u.pathname === `/csat/item/${id.replace('#', '-')}`, { timeout: 120_000 })
  const ret = new URL(page.url()).searchParams.get('ret')!
  expect(new URLSearchParams(ret.split('?')[1]).get('purpose')).toBe('killer')
  expect(new URLSearchParams(ret.split('?')[1]).get('kind')).toBe('suneung')
  await theaterReady(page)
  await page.getByTestId('item-back-home').click()
  await page.waitForURL((u) => u.pathname === '/csat/browse', { timeout: 120_000 })
  expect(`${new URL(page.url()).pathname}${new URL(page.url()).search}`).toBe(ret)
  await expect(page.locator('[data-testid="browse-purpose"] [data-purpose="killer"]')).toHaveAttribute('aria-pressed', 'true')
})

// ── 5. 지도 홈 · 독립 확인 ───────────────────────────────────────────────
test('5. 지도 홈 입구 → 찾기 → 문항 → 학습 지도로 · check=1 에는 찾기 없음', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page)
  await page.goto('/csat', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('home-explore')).toBeVisible({ timeout: 120_000 })
  await hydrated(page, 'home-finder-open')
  await page.getByTestId('home-finder-open').click()
  await ready(page)
  await search(page, '2026#34')
  await row(page, '2026#34').click()
  await page.getByTestId('item-finder-open').click()
  await page.waitForURL((u) => u.pathname === '/csat/item/2026-34', { timeout: 120_000 })
  const u = new URL(page.url())
  expect(u.searchParams.get('from')).toBe('map')
  for (const k of ['task', 'ws', 'step', 'check']) expect(u.searchParams.has(k), k).toBe(false)
  await theaterReady(page)
  await page.getByTestId('item-back-map').click()
  await page.waitForURL((x) => x.pathname === '/csat' && x.searchParams.get('from') === 'item', { timeout: 120_000 })
  // 독립 확인 — 일반 찾기를 노출하지 않는다
  await page.goto('/csat/item/2026-34?check=1&from=map', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-testid="item-check-mode"], [data-testid="analysis-theater"]').first()).toBeVisible({ timeout: 120_000 })
  await expect(page.getByTestId('item-finder-open-btn')).toHaveCount(0)
  await expect(page.getByTestId('v3-compare-find')).toHaveCount(0)
})

// ── 6. 비교 없는 문항의 일반 찾기 ─────────────────────────────────────────
test('6. 비교 없음 → 다른 기출 찾기(지금 유형) · 비교 쌍을 만들지 않음', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page)
  await page.goto('/csat/item/2026-34?scene=compare', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('v3-compare-absent')).toBeVisible({ timeout: 120_000 })
  await hydrated(page, 'v3-compare-find')
  await page.getByTestId('v3-compare-find').click()
  await ready(page)
  await expect(finder(page)).toHaveAttribute('data-origin', 'compare')
  const pressed = page.locator('[data-testid="item-finder-conditions"] [data-cond^="type-"][aria-pressed="true"]')
  await expect(pressed).toHaveCount(1)
  expect(await pressed.getAttribute('data-cond')).not.toBe('type-all')
  // 조건 해제 가능
  await page.locator('[data-cond="type-all"]').click()
  await expect(page.locator('[data-cond="type-all"]')).toHaveAttribute('aria-pressed', 'true')
  const target = await otherItem(page, '2026#34')
  await search(page, target.id)
  await row(page, target.id).click()
  await page.getByTestId('item-finder-open').click()
  await page.waitForURL((u) => u.pathname === `/csat/item/${target.slug}`, { timeout: 120_000 })
  const u = new URL(page.url())
  expect(u.searchParams.get('scene')).toBe('task')
  expect(u.searchParams.has('pair')).toBe(false)
  expect(u.searchParams.has('back')).toBe(false)
})

// ── 7. 강의(TTS) ──────────────────────────────────────────────────────
test('7. 강의 재생 중 열기 → 멈춤 · 취소 뒤 자동 재개 없음 · 명시적 재개 · 다른 문항은 새 무대', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page)
  await page.goto('/csat/item/2026-34?scene=task', { waitUntil: 'domcontentloaded' })
  await theaterReady(page)
  const play = page.getByRole('button', { name: /상영 시작|하이라이트만|멈춤|이어서|처음부터/ })
  await play.click()
  await expect(play).toHaveText(/멈춤/, { timeout: 60_000 })
  await page.getByTestId('item-finder-open-btn').click()
  await ready(page)
  await expect(play).toHaveText(/이어서/)
  // 팝업 안 ←/→ · Space 가 배경 강의로 새지 않는다
  await page.locator('[data-testid="item-finder-exams"] [data-row]').first().focus()
  await page.keyboard.press('ArrowDown')
  await page.keyboard.press(' ')
  await page.getByTestId('item-finder-cancel').click()
  await closedClean(page)
  await page.waitForTimeout(1500)
  await expect(play).toHaveText(/이어서/)
  await play.click()
  await expect(play).toHaveText(/멈춤/)
  // 다른 문항 — 새 무대(앞 문항의 재생이 이어지지 않는다)
  const target = await otherItem(page, '2026#34')
  await page.getByTestId('item-finder-open-btn').click()
  await ready(page)
  await search(page, target.id)
  await row(page, target.id).click()
  await page.getByTestId('item-finder-open').click()
  await page.waitForURL((u) => u.pathname === `/csat/item/${target.slug}`, { timeout: 120_000 })
  await theaterReady(page)
  const play2 = page.getByRole('button', { name: /상영 시작|하이라이트만|멈춤|이어서|처음부터/ })
  if (await play2.count()) await expect(play2).toHaveText(/상영 시작|하이라이트만/)
})

// ── 8. 오류 · 경계 · 응답 ────────────────────────────────────────────────
test('8. 판정 실패 · 목록 실패 · 인증 만료 · 검색 0 · 열기 직전 보류/삭제/실패 · 늦은 응답 · API 계약', async ({ page, browser }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await login(page)

  // API — allowlist · no-store
  const api = await page.request.get('/api/csat/item-finder')
  expect(api.status()).toBe(200)
  expect(api.headers()['cache-control']).toBe('private, no-store')
  const body = (await api.json()) as { catalog: { items: Record<string, unknown>[]; exams: Record<string, unknown>[] } }
  expect(Object.keys(body.catalog.items[0]).sort()).toEqual(['exam_id', 'id', 'lecture', 'map', 'no', 'points', 'sec', 'type_id'])
  expect(JSON.stringify(body)).not.toMatch(/"(answer|stem|passage|choices|why_correct|explanation|script|cues)"/)
  evidence.api = { items: body.catalog.items.length, exams: body.catalog.exams.length }
  saveEvidence()
  // 로그인 없는 요청은 401
  const anon = await browser.newContext()
  const anonRes = await anon.request.get(`${new URL(page.url()).origin}/api/csat/item-finder`)
  expect(anonRes.status()).toBe(401)
  expect(anonRes.headers()['cache-control']).toBe('private, no-store')
  await anon.close()

  await page.goto('/csat/item/2026-34?scene=task', { waitUntil: 'domcontentloaded' })
  await theaterReady(page)
  // SSR · Flight 에 팝업 목록이 실리지 않는다(팝업을 열기 전에는 API 를 부르지 않는다)
  expect(await page.content()).not.toContain('item-finder-items')

  const openWith = async (status: number, json: unknown) => {
    await page.route('**/api/csat/item-finder', (r) => r.fulfill({ status, json, headers: { 'cache-control': 'private, no-store' } }))
    await page.getByTestId('item-finder-open-btn').click()
    await expect(finder(page)).toBeVisible()
  }
  for (const [status, json, reason] of [
    [503, { ok: false, error: 'gate' }, 'gate'],
    [503, { ok: false, error: 'list' }, 'list'],
    [401, { ok: false, error: 'auth' }, 'auth'],
  ] as const) {
    await openWith(status, json)
    await expect(page.getByTestId('item-finder-error')).toHaveAttribute('data-reason', reason)
    // 오류를 0건으로 말하지 않는다
    await expect(page.getByTestId('item-finder-status')).toHaveText('목록을 받지 못했어요')
    await expect(page.getByTestId('item-finder-open')).toHaveAttribute('aria-disabled', 'true')
    await page.keyboard.press('Escape')
    await closedClean(page)
    await page.unroute('**/api/csat/item-finder')
  }
  // 다시 불러오기 — 누르기 전까지 실패(개발 모드 StrictMode 는 첫 요청을 한 번 버리므로 「첫 요청만 실패」 로 흉내 내지 않는다)
  let fail = true
  await page.route('**/api/csat/item-finder', async (r) => (fail ? r.fulfill({ status: 503, json: { ok: false, error: 'gate' } }) : r.continue()))
  await page.getByTestId('item-finder-open-btn').click()
  await expect(page.getByTestId('item-finder-error')).toHaveAttribute('data-reason', 'gate')
  fail = false
  await page.getByTestId('item-finder-retry').click()
  await ready(page)
  await page.unroute('**/api/csat/item-finder')
  // 검색 0 — 오류와 구분
  await search(page, '없는낱말')
  await expect(page.getByTestId('item-finder-empty')).toBeVisible()
  await expect(page.getByTestId('item-finder-status')).toContainText('0문항')
  // 열기 직전 보류 · 삭제 · 판정 실패 — 이동하지 않는다
  const target = await otherItem(page, '2026#34')
  await search(page, target.id)
  await row(page, target.id).click()
  for (const v of ['held', 'missing', 'error'] as const) {
    await page.route('**/api/csat/item-finder?verify=*', (r) => r.fulfill({ json: { ok: true, verify: v } }))
    await page.getByTestId('item-finder-open').click()
    await expect(page.getByTestId('item-finder-blocked')).toHaveAttribute('data-reason', v)
    expect(new URL(page.url()).pathname).toBe('/csat/item/2026-34')
    await page.unroute('**/api/csat/item-finder?verify=*')
    // 막힌 동안 열기는 비활성 — 안내대로 목록을 다시 받으면 다시 확인할 수 있다(검색 · 선택은 그대로)
    await expect(page.getByTestId('item-finder-open')).toHaveAttribute('aria-disabled', 'true')
    await page.getByTestId('item-finder-blocked').getByRole('button', { name: '목록 다시 불러오기' }).click()
    await ready(page)
    await expect(page.getByTestId('item-finder-blocked')).toHaveCount(0)
    await expect(page.getByTestId('item-finder-open')).toHaveAttribute('aria-disabled', 'false')
  }
  await page.keyboard.press('Escape')
  await closedClean(page)

  // 늦은 응답 — 닫은 뒤 도착한 목록이 팝업을 다시 열거나 오류를 내지 않는다
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.route('**/api/csat/item-finder', async (r) => {
    await new Promise((res) => setTimeout(res, 2500))
    await r.continue().catch(() => undefined)
  })
  await page.getByTestId('item-finder-open-btn').click()
  await expect(page.getByTestId('item-finder-loading')).toBeVisible()
  await page.keyboard.press('Escape')
  await closedClean(page)
  await page.waitForTimeout(3500)
  await expect(finder(page)).toHaveCount(0)
  await page.unroute('**/api/csat/item-finder')
  expect(errors).toEqual([])
})

// ── 9. 이력 · StrictMode 반복 ───────────────────────────────────────────
test('9. 열고 닫기 반복 · 뒤로/앞으로 — history 한 칸 · 역이동 없음 · 잠금 해제', async ({ page }) => {
  await page.setViewportSize({ width: 1280, height: 900 })
  await login(page)
  await page.goto('/csat/browse', { waitUntil: 'domcontentloaded' })
  await expect(page.getByTestId('csat-workspace')).toBeVisible({ timeout: 120_000 })
  await hydrated(page, 'browse-finder-open')
  await page.goto('/csat/item/2026-34?scene=task', { waitUntil: 'domcontentloaded' })
  await theaterReady(page)
  const url = page.url()
  const len0 = await page.evaluate(() => window.history.length)
  for (let i = 0; i < 4; i++) {
    await page.getByTestId('item-finder-open-btn').click()
    await expect(finder(page)).toBeVisible()
    if (i % 2) await page.keyboard.press('Escape')
    else await page.getByTestId('item-finder-close').click()
    await closedClean(page)
    expect(page.url()).toBe(url)
  }
  // 닫은 뒤 뒤로가기 한 번이면 앞 화면(서가)으로 — 표식이 남았으면 두 번 눌러야 한다
  const len1 = await page.evaluate(() => window.history.length)
  evidence.history = { len0, len1 }
  await page.goBack()
  await page.waitForURL((u) => u.pathname === '/csat/browse', { timeout: 60_000 })
  await page.goForward()
  await page.waitForURL((u) => u.pathname === '/csat/item/2026-34', { timeout: 60_000 })
  await theaterReady(page)
  // 열린 상태에서 뒤로 → 닫기만(떠나지 않는다)
  await page.getByTestId('item-finder-open-btn').click()
  await expect(finder(page)).toBeVisible()
  await page.goBack()
  await closedClean(page)
  expect(new URL(page.url()).pathname).toBe('/csat/item/2026-34')
  await page.waitForTimeout(800)
  expect(new URL(page.url()).pathname).toBe('/csat/item/2026-34')
  saveEvidence()
})
