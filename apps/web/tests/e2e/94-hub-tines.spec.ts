// apps/web/tests/e2e/94-hub-tines.spec.ts
// PC 허브의 참조 구성, 테마 대비, 살아 있는 플랫폼 탭 및 학습 진입. 모바일 디자인 제외.
import fs from 'node:fs'
import path from 'node:path'
import { test, expect, type Locator } from '@playwright/test'

const state = 'playwright-auth/.auth-hub-tines.json'
const out = path.resolve(__dirname, '../../../../tmp/hub-tines/qa')
test.beforeAll(async ({ browser }) => {
  test.setTimeout(120000)
  fs.mkdirSync(path.dirname(state), { recursive: true })
  fs.mkdirSync(out, { recursive: true })
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

async function contrast(text: Locator, surface: Locator) {
  const bg = await surface.evaluate(node => getComputedStyle(node).backgroundColor)
  return text.evaluate((node, background) => {
    const luminance = (color: string) => {
      const rgb = color.match(/[\d.]+/g)!.slice(0, 3).map(Number).map(value => { const c = value / 255; return c <= .04045 ? c / 12.92 : ((c + .055) / 1.055) ** 2.4 })
      return rgb.reduce((sum, c, i) => sum + c * [.2126, .7152, .0722][i], 0)
    }
    const a = luminance(getComputedStyle(node).color), b = luminance(background)
    return (Math.max(a, b) + .05) / (Math.min(a, b) + .05)
  }, bg)
}

for (const width of [1440, 1280]) for (const dark of [false, true]) test(`Tines 허브 ${width}px ${dark ? 'dark' : 'light'}`, async ({ page }) => {
  test.setTimeout(180000)
  await page.setViewportSize({ width, height: 900 })
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await page.addInitScript(theme => localStorage.setItem('vocaflow-theme', theme), dark ? 'dark' : 'light')
  await page.goto('/hub')
  const hub = page.locator('.tines-hub')
  await expect(hub.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 60000 })
  expect(await hub.evaluate(node => getComputedStyle(node).paddingLeft)).toBe('40px')
  expect(await page.locator('.hub-hero h1').evaluate(node => getComputedStyle(node).fontSize)).toBe('64px')
  await expect(page.locator('.hub-garden')).toBeVisible()
  expect(await contrast(page.locator('.hub-hero h1'), hub.locator('..').locator('..'))).toBeGreaterThanOrEqual(3)
  await page.screenshot({ path: path.join(out, `hero-${width}-${dark}.png`) })
  for (const name of ['hub-statement', 'hub-solution', 'hub-reading', 'hub-wall', 'hub-why']) {
    const section = hub.locator(`.${name}`)
    await section.scrollIntoViewIfNeeded()
    const images = section.locator('img')
    await images.evaluateAll(nodes => Promise.all(nodes.map(node => (node as HTMLImageElement).decode())))
    await section.screenshot({ path: path.join(out, `${name}-${width}-${dark}.png`) })
  }
  const features = page.locator('.hub-solution-features article')
  expect(new Set(await features.evaluateAll(nodes => nodes.map(node => getComputedStyle(node).backgroundColor))).size).toBe(4)
  for (const card of await features.all()) expect(await contrast(card.locator('p'), card)).toBeGreaterThanOrEqual(4.5)
  // 하위 화면 어휘(2026-10-04): 웨비나형 글 카드 · 메이슨리 서가 벽 · 파스텔 USP — 면마다 색이 달라야 하고 글자는 읽혀야 한다
  const articleCards = page.locator('.hub-reading ul').first().locator('li > div')
  if (await articleCards.count() > 1) {
    expect(new Set(await articleCards.evaluateAll(nodes => nodes.map(node => getComputedStyle(node).backgroundColor))).size).toBeGreaterThanOrEqual(2)
    for (const card of await articleCards.all()) expect(await contrast(card.locator('button > span').nth(1), card)).toBeGreaterThanOrEqual(4.5)
  }
  const usp = page.locator('.hub-why li > a')
  expect(new Set(await usp.evaluateAll(nodes => nodes.map(node => getComputedStyle(node).backgroundColor))).size).toBe(4)
  for (const card of await usp.all()) expect(await contrast(card.locator('p'), card)).toBeGreaterThanOrEqual(4.5)
  const wall = page.locator('.hub-wall > div a, .hub-wall > div > div > div')
  expect(new Set(await wall.evaluateAll(nodes => nodes.map(node => getComputedStyle(node).backgroundColor))).size).toBeGreaterThanOrEqual(4)
  const reading = hub.locator('.hub-reading')
  expect(await contrast(reading.getByRole('heading', { level: 2 }), reading)).toBeGreaterThanOrEqual(3)
  const tabs = page.getByRole('tablist', { name: 'Vocaflow 플랫폼' })
  await tabs.getByRole('tab').first().focus()
  await page.keyboard.press('ArrowRight')
  await expect(tabs.getByRole('tab').nth(1)).toBeFocused()
  for (const tab of await tabs.getByRole('tab').all()) {
    await tab.click()
    await expect(tab).toHaveAttribute('aria-selected', 'true')
    const panel = page.getByRole('tabpanel').filter({ has: page.getByRole('heading', { level: 3 }) })
    await expect(panel).toBeVisible()
    expect(await contrast(panel.getByRole('heading', { level: 3 }).first(), panel)).toBeGreaterThanOrEqual(3)
    await expect(panel.getByRole('link').first()).toHaveAttribute('href', /^\//)
  }
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  const cta = page.locator('.hub-hero a').filter({ hasText: /Flashcard 시작|진단 시작|복습 시작|읽기 시작|계속|시작/ }).first()
  const href = await cta.getAttribute('href')
  expect(href).toMatch(/^\//)
  await page.keyboard.press('Tab')
  await cta.focus()
  await expect(cta).toBeFocused()
  expect(await cta.evaluate(node => {
    const style = getComputedStyle(node)
    return (style.outlineStyle !== 'none' && parseFloat(style.outlineWidth) > 0) || style.boxShadow !== 'none'
  })).toBe(true)
  await page.keyboard.press('Enter')
  await page.waitForURL(url => url.pathname + url.search === href || href!.startsWith(url.pathname + '?'), { timeout: 60000 })
  await expect(page.getByRole('heading').first()).toBeVisible()
})
