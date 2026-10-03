// apps/web/tests/e2e/93-tines-adoption.spec.ts
// PC 웹의 카탈로그 키보드·상세 팝업·자료 탭·게임 일시정지. 모바일은 디자인 작업 대상에서 제외한다.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Page, type Locator } from '@playwright/test'

const state = 'playwright-auth/.auth-tines-adoption.json'
// 운영 관리자 검사는 별도 세션을 제공한다. 미제공 시 접근 불가를 통과로 세지 않는다.
const adminState = process.env.PLAYWRIGHT_ADMIN_STORAGE_STATE
const shots = path.resolve(__dirname, '../../../../tmp/tines-adoption/flows')
test.beforeAll(async ({ browser }) => {
  test.setTimeout(120000)
  fs.mkdirSync(path.dirname(state), { recursive: true })
  fs.mkdirSync(shots, { recursive: true })
  const page = await browser.newPage({ storageState: { cookies: [], origins: [] } })
  await page.goto('/login')
  await page.getByLabel(/이메일/).fill(process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev')
  const password = process.env.PLAYWRIGHT_RUNTIME_PASSWORD
  if (!password) throw new Error('PLAYWRIGHT_RUNTIME_PASSWORD가 필요하다')
  await page.locator('input[type="password"]').fill(password)
  await page.getByRole('button', { name: /^로그인/ }).click()
  await page.waitForURL(url => !url.pathname.startsWith('/login'), { timeout: 90000 })
  await page.context().storageState({ path: state })
  await page.close()
})
test.use({ storageState: state })

async function surface(page: Page) {
  await expect(page.locator('html')).toHaveAttribute('data-skin', 'tines')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  expect(await page.locator('[data-design-scope="csat"]').count()).toBe(0)
  expect(await page.evaluate(() => [...document.images].filter(image => image.getBoundingClientRect().width > 0 && image.complete && image.naturalWidth === 0).length)).toBe(0)
}

async function contrast(control: Locator) {
  await expect.poll(() => control.evaluate(element => {
    const style = getComputedStyle(element)
    const luminance = (color: string) => {
      const values = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => { const c = value / 255; return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 })
      return values[0] * .2126 + values[1] * .7152 + values[2] * .0722
    }
    const a = luminance(style.color), b = luminance(style.backgroundColor)
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
  })).toBeGreaterThanOrEqual(4.5)
}

// 실제 캡처에서 글자 옆 배경을 읽는다. 그라데이션의 CSS 선언값만으로 대비를 추정하지 않는다.
async function textContrastOnCanvas(page: Page, text: Locator) {
  const sample = await text.evaluate(element => {
    const rect = element.getBoundingClientRect()
    return { foreground: getComputedStyle(element).color, x: Math.floor(rect.left - 8), y: Math.floor(rect.top + rect.height / 2) }
  })
  const shot = await page.screenshot()
  return page.evaluate(async ({ sample, png }) => {
    const picture = new Image()
    picture.src = png
    await picture.decode()
    const canvas = document.createElement('canvas')
    canvas.width = picture.width; canvas.height = picture.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(picture, 0, 0)
    const background = [...ctx.getImageData(sample.x, sample.y, 1, 1).data].slice(0, 3)
    ctx.fillStyle = sample.foreground; ctx.fillRect(0, 0, 1, 1)
    const foreground = [...ctx.getImageData(0, 0, 1, 1).data].slice(0, 3)
    const luminance = (rgb: number[]) => rgb.map(value => { const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4 }).reduce((sum, value, i) => sum + value * [.2126, .7152, .0722][i], 0)
    const a = luminance(foreground), b = luminance(background)
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
  }, { sample, png: 'data:image/png;base64,' + shot.toString('base64') })
}

for (const width of [1440, 1280]) for (const dark of [false, true]) {
  test(`Tines 학습 화면과 기능 ${width}px ${dark ? 'dark' : 'light'}`, async ({ page }) => {
    test.setTimeout(240000)
    await page.setViewportSize({ width, height: 900 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    await page.addInitScript(theme => localStorage.setItem('vocaflow-theme', theme), dark ? 'dark' : 'light')
    const name = `${width}-${dark ? 'dark' : 'light'}`

    await page.goto('/library/vocab')
    const catalog = page.getByRole('group', { name: '단어장 목록 — 화살표로 이동, Enter 로 열기' })
    await expect(catalog).toBeVisible({ timeout: 60000 })
    const cards = catalog.getByRole('button')
    expect(await cards.count()).toBeGreaterThan(1)
    await cards.first().focus()
    await page.keyboard.press('ArrowRight')
    await expect(cards.nth(1)).toBeFocused()
    await page.screenshot({ path: path.join(shots, `catalog-${name}.png`) })
    await page.keyboard.press('Enter')
    const detail = page.getByRole('dialog')
    await expect(detail).toBeVisible({ timeout: 30000 })
    await expect(detail.getByRole('heading')).toBeVisible()
    await page.screenshot({ path: path.join(shots, `detail-${name}.png`) })
    await detail.getByRole('button', { name: '닫기', exact: true }).first().click()
    await expect(detail).not.toBeVisible()
    await surface(page)
    const categories = page.getByRole('tablist', { name: '카테고리', exact: true })
    await categories.getByRole('tab').last().click()
    await expect(categories.getByRole('tab').last()).toHaveAttribute('aria-selected', 'true')
    await contrast(categories.getByRole('tab').last())

    await page.goto('/dictate')
    await expect(page.getByRole('heading', { name: '받아쓰기', exact: true })).toBeVisible({ timeout: 30000 })
    const sources = page.getByRole('tablist', { name: '받아쓸 자료 종류' })
    for (const tab of await sources.getByRole('tab').all()) { await tab.click(); await expect(tab).toHaveAttribute('aria-selected', 'true') }
    await surface(page)
    await page.screenshot({ path: path.join(shots, `dictate-${name}.png`) })

    await page.goto('/play/letter-forge')
    const brief = page.getByRole('dialog')
    await expect(brief).toBeVisible({ timeout: 30000 })
    await brief.getByRole('button', { name: /시작/ }).click()
    await expect(brief).not.toBeVisible()
    const pause = page.getByRole('button', { name: '일시정지', exact: true })
    await expect(pause).toBeVisible({ timeout: 30000 })
    await pause.click()
    const resume = page.getByRole('button', { name: '계속하기', exact: true })
    await expect(resume).toBeVisible()
    await contrast(resume)
    await page.screenshot({ path: path.join(shots, `pause-${name}.png`) })
    await resume.click()
    await expect(resume).not.toBeVisible()
    await surface(page)
    await page.goto('/play/word-orrery')
    const orreryBrief = page.getByRole('dialog')
    await expect(orreryBrief).toBeVisible({ timeout: 30000 })
    await orreryBrief.getByRole('button', { name: /시작/ }).click()
    const orreryHelp = page.locator('.wo-help')
    await expect(orreryHelp).toBeVisible({ timeout: 30000 })
    expect(await textContrastOnCanvas(page, orreryHelp)).toBeGreaterThanOrEqual(4.5)
    expect(await textContrastOnCanvas(page, page.locator('.gk-score'))).toBeGreaterThanOrEqual(4.5)
    await page.screenshot({ path: path.join(shots, `orrery-${name}.png`) })
  })

}

test.describe('Tines 관리자', () => {
  test.use({ storageState: adminState || state })
  for (const width of [1440, 1280]) for (const dark of [false, true]) test(`화면 ${width}px ${dark ? 'dark' : 'light'}`, async ({ page }) => {
    test.setTimeout(120000)
    await page.setViewportSize({ width, height: 900 })
    await page.addInitScript(theme => localStorage.setItem('vocaflow-theme', theme), dark ? 'dark' : 'light')
    await page.goto('/admin/analytics')
    test.skip(!adminState && new URL(page.url()).pathname !== '/admin/analytics', '관리자 세션 없음 — PLAYWRIGHT_ADMIN_STORAGE_STATE 또는 기존 개발 관리자 환경 필요')
    await expect(page.getByRole('heading', { name: '플랫폼 분석', exact: true })).toBeVisible({ timeout: 30000 })
    await expect(page.getByRole('button', { name: '관리자 메뉴 열기', includeHidden: true })).toHaveCount(0)
    await surface(page)
    await page.screenshot({ path: path.join(shots, `admin-${width}-${dark ? 'dark' : 'light'}.png`) })
    // 새 상단 바가 기존 viewport-sticky 사전 패널의 제목/닫기를 덮지 않는다.
    await page.goto('/admin/vocabulary')
    const firstWord = page.locator('tbody tr[role="button"]').first()
    await expect(firstWord).toBeVisible({ timeout: 30000 })
    await firstWord.click()
    const wordDetail = page.getByRole('complementary', { name: 'word detail' })
    await expect(wordDetail).toBeVisible({ timeout: 30000 })
    await page.evaluate(() => window.scrollTo(0, 650))
    const header = page.locator('[data-area="admin"] > header')
    await expect.poll(async () => {
      const topBar = await header.boundingBox(), panel = await wordDetail.boundingBox()
      return panel && topBar ? panel.y - topBar.y - topBar.height : -1
    }).toBeGreaterThanOrEqual(-1)
    const maxHeight = await wordDetail.evaluate(element => parseFloat(getComputedStyle(element).maxHeight))
    const topBar = await header.boundingBox()
    expect(maxHeight).toBeLessThanOrEqual(900 - topBar!.height - 16)
    await page.screenshot({ path: path.join(shots, `admin-word-detail-${width}-${dark ? 'dark' : 'light'}.png`) })
    await wordDetail.getByRole('button', { name: 'Close detail panel (Esc)' }).click()
    await expect(wordDetail).toHaveCount(0)
  })
})
