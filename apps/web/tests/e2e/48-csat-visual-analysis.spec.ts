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
  // 홈 부분 갱신(v3 M1 · 2026-10-13) — 옛 홈의 「같은 공식에서도, 함정은 달라져요」 비교 판(visual-comparison · visual-pattern-map)은
  //   cbd5d134c 「기출분석공간 재설계」 로 홈에서 사라졌다(main 58bfc15b1 에서도 이 단계는 이미 실패). 지금 홈 = 내 학습 지도:
  //   지도 홈이 서고 해부(출제 구조) 진입이 열려 있는지만 본다. 아래 해부 화면의 출제 구조 양방향 탐색은 그대로 검사한다.
  await page.goto('/csat')
  await expect(page.getByTestId('csat-home')).toBeVisible({ timeout: 90000 })
  await expect(page.getByTestId('home-start')).toHaveAttribute('href', '/csat/dissect')
  await page.screenshot({ path: info.outputPath('home-fold.png') })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
  expect(errors).toEqual([])
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
