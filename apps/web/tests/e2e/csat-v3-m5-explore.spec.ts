// apps/web/tests/e2e/csat-v3-m5-explore.spec.ts
//
// v3 M5 실화면 상호작용 — 직접 조작한다(캡처만 하지 않는다). PC 1280 · 1440(라이트. /csat 3B 스킨에 다크 규칙이 없어 다크는 미검증).
//   장면 이동(2026#34 · 빈칸/순서/삽입/어법/도표) · 비교 목록 키보드 선택 · 이 문항 근거 강조/해제 · 상대 문항 이동 → 같은 쌍 → 복귀 ·
//   원리 수준 · 성립/금지 조건 · 노트 저장 실패(기기 저장 실패 주입) → 입력 보존 → 다시 저장 → 새로 고침 재진입 · 학습 지도 복귀 유지 ·
//   데이터 없는 상태 · 가로 넘침 · 페이지 오류.
// CI 의 e2e 잡은 이 스펙을 돌리지 않는다(ci.yml 은 smoke 5종만) — 로컬 실행 결과로만 보고한다.
//   PLAYWRIGHT_BASE_URL=http://localhost:3218 pnpm --filter web exec playwright test csat-v3-m5-explore
import { mkdirSync } from 'node:fs'
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
const SHOTS = path.resolve('test-results-csat-learner/m5-explore')

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
/** 접근성(WCAG 2.1 A/AA) — 이번에 만든 패널 영역만, serious · critical 위반 0 */
async function axeClean(page: Page, selector: string) {
  const res = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa']).include(selector).analyze()
  const bad = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical').map((v) => `${v.impact}/${v.id} ×${v.nodes.length} ${v.nodes[0]?.target?.join(' ') ?? ''}`)
  expect(bad, `${selector} 접근성`).toEqual([])
}
async function noOverflow(page: Page, what: string) {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(o, `${what} 가로 넘침`).toBeLessThanOrEqual(0)
}

for (const width of [1280, 1440]) {
  test(`M5 탐구 상호작용 ${width}`, async ({ page }) => {
    mkdirSync(SHOTS, { recursive: true })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.setViewportSize({ width, height: 900 })
    // 기기 저장 실패 주입 스위치 — window.__failPut 이 true 면 IndexedDB put 이 던진다
    await page.addInitScript(() => {
      const orig = IDBObjectStore.prototype.put
      IDBObjectStore.prototype.put = function (this: IDBObjectStore, ...args: Parameters<IDBObjectStore['put']>) {
        if ((window as unknown as { __failPut?: boolean }).__failPut) throw new DOMException('주입된 저장 실패', 'QuotaExceededError')
        return orig.apply(this, args)
      } as IDBObjectStore['put']
    })
    await login(page)

    // ① 장면 이동 — 2026#34 일곱 장면 탭을 직접 누른다
    await page.goto('/csat/item/2026-34?scene=task', { waitUntil: 'domcontentloaded' })
    for (const label of ['원문 이해', '문항 성립', '설계 재구성', '기출 비교', '조건부 원리', '내 설명', '평가 과제']) {
      await page.getByRole('tab', { name: label, exact: true }).click()
      await expect(page).toHaveURL(/scene=/)
    }
    // 2026#34 는 검수된 비교가 없다 — 데이터 없는 상태를 이유와 함께
    await page.getByRole('tab', { name: '기출 비교', exact: true }).click()
    await expect(page.getByTestId('v3-compare-absent')).toHaveAttribute('data-reason', 'none')
    await noOverflow(page, '2026#34')

    // ② 순서 · 어법 · 도표 — 문항 성립 장면이 열리고 넘침이 없다
    for (const slug of ['2026-36', '2026-29', '2026-25']) {
      await page.goto(`/csat/item/${slug}?scene=judgment`, { waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('v3-judgment')).toBeVisible({ timeout: 60_000 })
      await noOverflow(page, slug)
    }

    // ③ 삽입 2026#38 — 학습 지도에서 온 맥락(from=map)으로 비교 장면
    await page.goto('/csat/item/2026-38?scene=compare&from=map', { waitUntil: 'domcontentloaded' })
    await expect(page.getByTestId('item-back-map')).toBeVisible()
    const list = page.getByTestId('v3-pair-list')
    await expect(list).toBeVisible({ timeout: 60_000 })
    const options = page.getByTestId('v3-pair-option')
    expect(await options.count()).toBeGreaterThan(0)
    await expect(page.getByTestId('v3-pair')).toHaveCount(0) // 고르기 전에는 상세 없음

    // 키보드: 첫 항목에 초점 → Enter 로 선택
    await options.first().focus()
    await page.keyboard.press('Enter')
    const detail = page.getByTestId('v3-pair')
    await expect(detail).toBeVisible()
    await expect(page).toHaveURL(/pair=/)
    const pairId = new URL(page.url()).searchParams.get('pair')!
    // 대응 · 판정 조건 · 한계가 보인다
    await expect(detail.getByTestId('v3-mapping').first()).toBeVisible()
    await expect(detail).toContainText('이 비교가 말하지 않는 것')
    // 이 문항 근거 강조 → 해제
    const ev = detail.getByTestId('v3-mapping-self').first()
    await ev.click()
    await expect(ev).toHaveAttribute('aria-pressed', 'true')
    // 왼쪽 지문 지도가 그 근거 문장을 실제로 비춘다(학습자가 고른 근거 표시)
    await expect(page.getByTestId('map-chosen-evidence')).toBeVisible({ timeout: 30_000 })
    await page.screenshot({ path: path.join(SHOTS, `compare-selected_${width}.png`) })
    await ev.click()
    await expect(ev).toHaveAttribute('aria-pressed', 'false')
    await expect(page.getByTestId('map-chosen-evidence')).toHaveCount(0)
    // 강조를 켠 채 다른 쌍으로 바꾸면 옛 쌍의 강조가 꺼진다(보이는 비교 ↔ 지도 강조 일치)
    await detail.getByTestId('v3-mapping-self').first().click()
    await expect(page.getByTestId('map-chosen-evidence')).toBeVisible({ timeout: 30_000 })
    if ((await options.count()) > 1) {
      await options.nth(1).click()
      await expect(page.getByTestId('map-chosen-evidence')).toHaveCount(0)
      await expect(page.getByTestId('v3-pair').getByTestId('v3-mapping-self').first()).toHaveAttribute('aria-pressed', 'false')
      await options.first().click()
    }
    // 강조를 켠 채 Esc(목록에서) 로 선택 해제 → 강조도 꺼진다 → 다시 선택
    await page.getByTestId('v3-pair').getByTestId('v3-mapping-self').first().click()
    await expect(page.getByTestId('map-chosen-evidence')).toBeVisible({ timeout: 30_000 })
    await options.first().focus()
    await page.keyboard.press('Escape')
    await expect(page.getByTestId('v3-pair')).toHaveCount(0)
    await expect(page.getByTestId('map-chosen-evidence')).toHaveCount(0)
    await page.keyboard.press('Enter')
    await expect(page.getByTestId('v3-pair')).toBeVisible()
    // 강조를 켠 채 다른 장면으로 가면 꺼진다(보이지 않는 비교가 지도를 계속 비추지 않음)
    await page.getByTestId('v3-pair').getByTestId('v3-mapping-self').first().click()
    await expect(page.getByTestId('map-chosen-evidence')).toBeVisible({ timeout: 30_000 })
    await page.getByRole('tab', { name: '원문 이해', exact: true }).click()
    await expect(page.getByTestId('map-chosen-evidence')).toHaveCount(0)
    await page.getByRole('tab', { name: '기출 비교', exact: true }).click()
    await expect(page.getByTestId('v3-pair')).toBeVisible() // 주소의 pair 로 같은 쌍이 다시 열린다

    // 상대 문항으로 이동 → 같은 쌍이 열려 있고 · 학습 지도 복귀 유지 · 돌아오기
    await page.getByTestId('v3-pair-go-other').click()
    await page.waitForURL(/back=2026-38/, { waitUntil: 'commit', timeout: 90_000 })
    await expect(page.getByTestId('v3-pair')).toBeVisible({ timeout: 60_000 })
    expect(new URL(page.url()).searchParams.get('pair')).toBe(pairId)
    await expect(page.getByTestId('item-back-map')).toBeVisible()
    await page.getByTestId('v3-compare-return').first().click()
    await page.waitForURL(/\/csat\/item\/2026-38/, { waitUntil: 'commit', timeout: 90_000 })
    await expect(page.getByTestId('v3-pair')).toBeVisible({ timeout: 60_000 })
    expect(new URL(page.url()).searchParams.get('pair')).toBe(pairId)
    await noOverflow(page, '2026#38 비교')
    await axeClean(page, '[data-testid="v3-compare"]')

    // ④ 조건부 원리 — 수준 · 성립/금지 조건
    await page.getByRole('tab', { name: '조건부 원리', exact: true }).click()
    const levels = page.getByTestId('v3-principle-levels')
    await expect(levels).toBeVisible()
    await expect(levels).toContainText('이 문항에서 얻은 잠정 원리')

    // ⑤ 원리 노트 — 저장 실패 주입 → 입력 보존 → 다시 저장 → 재진입
    await page.getByRole('tab', { name: '내 설명', exact: true }).click()
    const note = page.getByTestId('reasoning-note')
    await expect(note).toBeVisible()
    const statement = `M5 노트 ${width} — 주어진 문장은 기대는 문장과 근거 사이에 넣지 않는다`
    await note.getByTestId('note-statement').fill(statement)
    await note.getByTestId('note-limit').fill('지시어가 없으면 다르다')
    await page.evaluate(() => { (window as unknown as { __failPut: boolean }).__failPut = true })
    await note.getByTestId('note-save').click()
    await expect(note.getByTestId('note-status')).toHaveAttribute('data-status', 'failed')
    await expect(note.getByTestId('note-statement')).toHaveValue(statement) // 입력 보존
    await expect(note.getByTestId('note-save')).toHaveText('다시 저장')
    await page.screenshot({ path: path.join(SHOTS, `note-failed_${width}.png`) })
    await page.evaluate(() => { (window as unknown as { __failPut: boolean }).__failPut = false })
    await note.getByTestId('note-save').click()
    await expect(note.getByTestId('note-status')).toHaveAttribute('data-status', 'saved')
    await expect(note.getByTestId('note-compare')).toContainText(statement)
    await axeClean(page, '[data-testid="reasoning-note"]')
    await note.getByTestId('note-open-model').click()
    // 재진입 — 새로 고침 뒤에도 노트가 남아 있다
    await page.reload({ waitUntil: 'domcontentloaded' })
    await page.getByRole('tab', { name: '내 설명', exact: true }).click()
    await expect(page.getByTestId('note-show-last')).toBeVisible({ timeout: 60_000 })
    await page.getByTestId('note-show-last').click()
    await expect(page.getByTestId('note-compare')).toContainText(statement)

    // ⑥ 학습 지도 복귀 — 링크가 지도로 간다
    await expect(page.getByTestId('item-back-map')).toHaveAttribute('href', '/csat/diagnosis')
    expect(errors, '페이지 오류').toEqual([])
  })
}
