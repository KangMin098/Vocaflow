// apps/web/tests/e2e-isolated/csat-system-learning.browser.spec.ts
//
// T-0091 학습 정리 — 실제 컴포넌트 하네스(서버 · DB 없음 · 실제 서버 종단 아님)로 PC 1280/1440 상태별 화면 · 상호작용을 확인한다.
// 먼저 굽는다: pnpm --filter web exec tsx scripts/build-csat-system-learning-harness.mts (출력 = 작업트리 .vfc-runs/)
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'

import { expect, test, type Page } from '@playwright/test'

const HARNESS = path.resolve(__dirname, '../../../../.vfc-runs/csat-system-learning-harness.html')
const SHOTS = path.resolve(__dirname, '../../../../.vfc-runs/ui')
const url = (state: string) => `${pathToFileURL(HARNESS).href}#${state}`

test.beforeAll(() => {
  expect(fs.existsSync(HARNESS), '하네스를 먼저 굽는다').toBe(true)
  fs.mkdirSync(SHOTS, { recursive: true })
})

const noWriting = async (page: Page) => {
  await expect(page.locator('textarea')).toHaveCount(0)
  await expect(page.locator('input[type="text"], [contenteditable="true"]')).toHaveCount(0)
}

for (const width of [1280, 1440]) {
  test.describe(`PC ${width}×900`, () => {
    test.use({ viewport: { width, height: 900 } })

    test('준비된 문항 — 관계 · 제공 근거 · 원리 · 확인 과제 · 다음 활동, 서술 입력 없음 [0][1][2][5]', async ({ page }) => {
      await page.goto(url('prepared'))
      const s = page.getByTestId('learning-summary')
      await expect(s).toHaveAttribute('data-checks', 'prepared')
      await expect(s.getByRole('heading', { name: '학습 정리' })).toBeVisible()
      await expect(page.getByTestId('summary-relation')).toContainText('판단 문장')
      await expect(page.getByTestId('summary-relation')).toContainText('근거 단위: 문장 · 표 칸')
      await expect(page.getByTestId('summary-evidence-item')).toHaveCount(2)
      await expect(page.getByTestId('summary-principle')).toContainText('쓰면 안 되는 조건(반례)')
      await expect(page.getByTestId('summary-checks')).toContainText('숙달 · 목표 달성으로 세지 않아요')
      await expect(page.getByTestId('summary-history')).toHaveCount(0)
      await noWriting(page)
      // 44px · break-keep · 긴 설명 줄바꿈
      for (const b of await page.locator('[data-testid="learning-summary"] button').all()) {
        expect((await b.boundingBox())!.height, await b.innerText()).toBeGreaterThanOrEqual(44)
      }
      expect(await page.getByTestId('summary-evidence').locator('ul').evaluate((el) => getComputedStyle(el).wordBreak)).toBe('keep-all')
      const ev = await page.getByTestId('summary-evidence-item').first().boundingBox()
      expect(ev!.width).toBeLessThanOrEqual(width)
      await page.screenshot({ path: `${SHOTS}/prepared-${width}.png`, fullPage: true })
    })

    test('보관 · 다음 활동 이동 · 뒤로가기 · 도크 키보드 [1][3][4]', async ({ page }) => {
      await page.goto(url('prepared'))
      await page.getByTestId('summary-keep').click()
      await expect(page.getByTestId('summary-keep')).toHaveText('내 원리에 보관됨')
      await expect(page.getByTestId('summary-keep')).toBeDisabled()
      await page.getByTestId('summary-next-checks').click()
      await expect(page.getByTestId('other-scene')).toHaveAttribute('data-scene', 'judgment')
      expect(page.url()).toContain('scene=judgment')
      // 도크로 학습 정리로 돌아온다(scene=explain 호환) · 키보드 포커스 표시
      const dockExplain = page.locator('[data-testid="dock-scene"][data-scene="explain"]')
      await expect(dockExplain).toHaveAttribute('aria-label', '학습 정리')
      await dockExplain.focus()
      await page.keyboard.press('Enter')
      await expect(page.getByTestId('learning-summary')).toBeVisible()
      expect(page.url()).toContain('scene=explain')
      const outline = await dockExplain.evaluate((el) => { const c = getComputedStyle(el); return c.outlineStyle !== 'none' || c.boxShadow !== 'none' })
      expect(outline, 'focus 표시').toBe(true)
      await page.getByTestId('summary-next-lecture').click()
      const acts = await page.evaluate(() => (window as unknown as { __vfActions: unknown[] }).__vfActions)
      expect(acts).toEqual([{ keep: true }, { go: 'judgment' }, { go: 'explain' }, { lecture: true }])
    })

    test('과제 없음 — 「확인 과제 준비 중」, 풀기 · 자유입력 · 가짜 평가 없음 [2][5]', async ({ page }) => {
      await page.goto(url('preparing'))
      await expect(page.getByTestId('summary-checks')).toHaveAttribute('data-readiness', 'preparing')
      await expect(page.getByTestId('summary-checks-preparing')).toContainText('확인 과제 준비 중')
      await expect(page.getByTestId('summary-next-checks')).toHaveCount(0)
      await expect(page.getByTestId('summary-next-evidence')).toBeVisible()
      await noWriting(page)
      await page.screenshot({ path: `${SHOTS}/preparing-${width}.png`, fullPage: true })
    })

    test('자료 전체 미준비 · 기록 읽는 중 — 준비 중과 읽는 중을 섞지 않는다 [2][5]', async ({ page }) => {
      await page.goto(url('empty'))
      await expect(page.getByTestId('summary-relation')).toContainText('준비 중')
      await expect(page.getByTestId('summary-principle')).toContainText('준비 중')
      await expect(page.getByTestId('summary-keep')).toHaveCount(0)
      await expect(page.getByTestId('summary-next')).toContainText('준비된 활동이 아직 없어요')
      await page.screenshot({ path: `${SHOTS}/empty-${width}.png`, fullPage: true })
      await page.goto(url('loading'))
      await page.reload()
      await expect(page.getByTestId('summary-history-loading')).toBeVisible()
      await page.screenshot({ path: `${SHOTS}/loading-${width}.png`, fullPage: true })
    })

    test('과거 작성 기록 — 읽기 전용 · 원본 · 고친 설명 모두 보존 · 근거 짚기 [0][4][5]', async ({ page }) => {
      await page.goto(url('history'))
      const hist = page.getByTestId('summary-history')
      await hist.locator('summary').click()
      await expect(hist.getByTestId('self-explain-history-item')).toHaveCount(1)
      await expect(hist.getByTestId('note-mine')).toContainText('처음 설명')
      await expect(hist.getByTestId('note-revised')).toContainText('원본은 그대로')
      await expect(hist.getByTestId('reasoning-note')).toHaveAttribute('data-readonly', 'true')
      await noWriting(page)
      await expect(hist.getByRole('button', { name: /저장|고쳐|대조/ })).toHaveCount(0)
      await hist.getByTestId('note-evidence-show').click()
      const acts = await page.evaluate(() => (window as unknown as { __vfActions: unknown[] }).__vfActions)
      expect(acts).toEqual([{ evidence: [2, 3] }])
      // 설명 판 독립 스크롤
      const pane = page.getByTestId('pane-explain')
      expect(await pane.evaluate((el) => getComputedStyle(el).overflowY)).toBe('auto')
      await page.screenshot({ path: `${SHOTS}/history-${width}.png`, fullPage: true })
    })
  })
}
