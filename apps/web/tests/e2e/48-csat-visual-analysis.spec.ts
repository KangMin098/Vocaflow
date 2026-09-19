// apps/web/tests/e2e/48-csat-visual-analysis.spec.ts
import fs from 'node:fs'
import path from 'node:path'
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.use({ storageState: 'playwright-auth/.auth-csat-learner.json' })
for (const width of [1280, 1440, 1728]) test(`출제 구조 양방향 탐색 ${width}px`, async ({ page }, info) => {
  test.setTimeout(180000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width, height: 1000 })
  await page.goto('/csat')
  const comparison = page.getByTestId('visual-comparison')
  await expect(comparison.getByTestId('question-architecture')).toHaveCount(2)
  await expect(comparison.getByRole('button', { name: /점선 · 오답 유인/ })).toHaveCount(1)
  await expect(comparison.getByRole('button', { name: /점선 · 오답 배제/ })).toHaveCount(1)
  await page.screenshot({ path: info.outputPath('home-before-interaction.png'), fullPage: true })
  await page.screenshot({ path: info.outputPath('home-fold.png') })
  await comparison.getByRole('button', { name: /점선 · 오답 배제/ }).first().focus()
  await page.keyboard.press('Enter')
  await expect(comparison.locator('[data-focus=distractor]')).toHaveCount(2)
  await expect(comparison.getByRole('heading', { name: '같은 공식에서도, 함정은 달라져요' })).toBeVisible()
  await expect(page.getByTestId('visual-pattern-map').getByRole('link')).not.toHaveCount(0)
  await page.screenshot({ path: info.outputPath('home-comparison.png'), fullPage: true })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  expect(errors).toEqual([])
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
  await page.goto('/csat/dissect?item=2026-32')
  const input = page.getByTestId('paper-input')
  await expect(input.or(page.getByTestId('analysis-reading'))).toBeVisible({ timeout: 90000 })
  if (await input.count()) {
    const directory = 'C:/Users/Administrator/Documents/영어/수능영어기출/수능기출'
    const file = fs.readdirSync(directory).find(f => f.includes('2026') && f.includes('영어') && f.endsWith('.pdf') && !f.includes('정답'))!
    await input.setInputFiles(path.join(directory, file))
  }
  const workbench = page.getByTestId('analysis-workbench')
  await expect(workbench).toBeVisible({ timeout: 90000 })
  await workbench.getByRole('button', { name: /점선 · 오답 배제/ }).click()
  await expect(workbench).toHaveAttribute('data-focus', 'distractor')
  await expect(workbench.locator('[data-testid=visual-source-sentence][data-reject=true][aria-pressed=true]').first()).toBeVisible()
  await workbench.getByTestId('visual-source-sentence').filter({ hasText: '━━ 정답 근거' }).first().click()
  await expect(workbench).toHaveAttribute('data-focus', 'evidence')
  await workbench.getByRole('button', { name: '정답 연결', exact: true }).click()
  await expect(workbench).toHaveAttribute('data-focus', 'evidence')
  await expect(workbench.locator('[data-testid=visual-source-sentence][aria-pressed=true] mark').first()).toBeVisible()
  await page.evaluate(() => window.scrollTo(0, 0))
  await page.screenshot({ path: info.outputPath('analysis.png'), fullPage: true })
  await page.screenshot({ path: info.outputPath('analysis-fold.png') })
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()).violations).toEqual([])
  await page.evaluate(() => document.documentElement.setAttribute('data-theme', 'dark'))
  await expect.poll(() => page.evaluate(() => document.getAnimations().filter(a => a instanceof CSSTransition && a.playState === 'running').length)).toBe(0)
  await page.screenshot({ path: info.outputPath('analysis-dark.png'), fullPage: true })
  expect((await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa']).analyze()).violations).toEqual([])
  await page.emulateMedia({ reducedMotion: 'reduce' })
  await workbench.getByRole('button', { name: '오답 변형', exact: true }).click()
  await expect(workbench.getByTestId('question-architecture')).toHaveAttribute('data-focus', 'distractor')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  expect(errors).toEqual([])
})
