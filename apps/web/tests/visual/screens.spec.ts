// apps/web/tests/visual/screens.spec.ts
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import fs from 'node:fs'
import path from 'node:path'
import { assertNoOverflow, assertScreen, measureOverflow } from './checks'

const stylePath = path.join(__dirname, 'capture.css')
const style = fs.readFileSync(stylePath, 'utf8')

const screens: { path: string; heading: string | RegExp; auth: boolean }[] = [
  { path: '/fit', heading: '이 지문, 우리 반에 맞을까?', auth: false },
  { path: '/csat', heading: '다른 지문, 같은 설계.', auth: true },
  { path: '/csat/formulas', heading: '내 공식', auth: true },
  // 화면 재설계 실행(2026-09-19) — h1 이 오늘의 단어·문장이라 형태만 확인한다.
  { path: '/hub', heading: /.+/, auth: true },
  { path: '/diagnostic', heading: '답할수록 이 글이 내 눈에 보이는 대로 칠해져요', auth: true },
]
const requested = (process.env.DESIGN_ROUTES ?? '/fit').split(',').map(value => value.trim())
const unknown = requested.filter(value => !screens.some(screen => screen.path === value))
if (unknown.length) throw new Error(`DESIGN_ROUTES에 등록되지 않은 경로: ${unknown.join(', ')}`)
const selected = screens.filter(screen => requested.includes(screen.path))
const mode = process.env.DESIGN_MODE ?? 'capture'
if (!['capture', 'compare'].includes(mode)) throw new Error('DESIGN_MODE는 capture 또는 compare')
if (selected.some(screen => screen.auth) && !process.env.DESIGN_STORAGE_STATE) {
  throw new Error('로그인 화면 검증에는 DESIGN_STORAGE_STATE로 playwright-auth/의 인증 상태를 지정하세요.')
}

for (const screen of selected) test.describe(screen.path, () => {
  // Public proof is checked as a guest even when an authenticated route is also selected.
  test.use({ storageState: screen.auth ? process.env.DESIGN_STORAGE_STATE : { cookies: [], origins: [] } })

  test('render, access, capture', async ({ page, browser, colorScheme }, info) => {
    const errors: string[] = []
    const consoleErrors: string[] = []
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error') consoleErrors.push(message.text()) })
    const theme = colorScheme === 'dark' ? 'dark' : 'light'
    await page.addInitScript(theme => localStorage.setItem('vocaflow-theme', theme), theme)
    const response = await page.goto(screen.path, { waitUntil: 'domcontentloaded' })
    expect(response?.ok(), '화면 응답 실패').toBe(true)
    await assertScreen(page, screen.path, screen.heading)
    await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
    if (screen.path === '/fit') await expect(page.getByRole('region', { name: '레벨 프로파일' })).toBeVisible()
    if (screen.path === '/csat') await expect(page.getByTestId('today-card')).toHaveAttribute('aria-busy', 'false')
    if (screen.path === '/csat/formulas') await expect(page.getByTestId('formula-metrics')).toBeVisible()
    // 진단 목록은 클라이언트가 불러온다 — 목록이 서기 전에 찍으면 로더가 기준이 된다
    if (screen.path === '/diagnostic') await expect(page.getByRole('button', { name: /진단 시작/ })).toBeVisible()
    await page.evaluate(() => document.fonts.ready)
    await expect.poll(() => page.evaluate(() => document.getAnimations().filter(animation =>
      animation instanceof CSSTransition && animation.playState === 'running').length)).toBe(0)

    // Capture first, so failed layout/accessibility checks still leave evidence for critique.
    for (const fullPage of [false, true]) {
      const name = fullPage ? 'full.png' : 'fold.png'
      await page.screenshot({ path: info.outputPath(name), fullPage, animations: 'disabled', style })
      await info.attach(name, { path: info.outputPath(name), contentType: 'image/png' })
      const snapshotName = `${screen.path.slice(1).replaceAll('/', '-')}-${name}`
      if (mode === 'compare') await expect.soft(page).toHaveScreenshot(snapshotName, {
        fullPage, animations: 'disabled', stylePath, maxDiffPixels: 100,
      })
    }
    // Next's development error badge belongs to the browser tooling, not the app.
    // Keep actual page exceptions fatal and preserve console errors for diagnosis.
    const audit = await new AxeBuilder({ page }).exclude('nextjs-portal')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
    await info.attach('audit.json', {
      body: JSON.stringify({
        capturedAt: new Date().toISOString(), path: screen.path, theme,
        project: info.project.name, viewport: page.viewportSize(), browser: browser.version(),
        platform: process.platform, mode,
        metrics: await measureOverflow(page), violations: audit.violations, errors, consoleErrors,
      }, null, 2),
      contentType: 'application/json',
    })
    expect.soft(audit.violations, '자동 접근성 검사').toEqual([])
    expect.soft(errors, '브라우저 실행 오류').toEqual([])
    await assertNoOverflow(page)

    // Real keyboard activation and visible state change; no data is submitted.
    if (screen.path === '/fit') {
      const clear = page.getByRole('button', { name: '지우기', exact: true })
      await clear.focus()
      await expect(clear).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(page.getByRole('textbox')).toHaveValue('')
      await expect(clear).toBeDisabled()
    }
  })
})
