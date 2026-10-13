// apps/web/tests/e2e/csat-f08-paper-marks.spec.ts
//
// v3 F08 — 근거로 고른 선지의 밑줄을 원본 크롭 위에 짚는다(실화면 · 문제지를 직접 놓는 경로).
// 개발 서버의 로컬 문제지 자동 공급을 끈 채로(CSAT_LOCAL_PAPERS=off) 학습자처럼 PDF 를 놓는다 — 자동 공급 경로와 혼동하지 않는다.
// 공개 문제지 PDF 는 저장소에 없다(저작물) — CSAT_F08_PAPER_2026 또는 이 PC 의 기본 위치에 없으면 건너뛴다(CI 는 건너뜀).
// 확인: PC 1280 · 1440 · 선택 → 밑줄 1곳 · 해제 → 0 · 장면 이동 → 0 · 확대(zoom) · 문제지 폭 조절에도 크롭 안 같은 비율 위치 ·
//       세트 (a)~(e) · 함축(평가 과제 장면) · 다른 PDF 를 다시 놓으면 이전 좌표가 남지 않음.

import fs from 'node:fs'
import path from 'node:path'
import { expect, test, type Page } from '@playwright/test'

const USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password:
    process.env.PLAYWRIGHT_RUNTIME_PASSWORD ??
    (() => {
      throw new Error('PLAYWRIGHT_RUNTIME_PASSWORD 가 없다 — apps/web/.env.local')
    })(),
}
const PAPER = process.env.CSAT_F08_PAPER_2026 || 'C:/Users/Administrator/Documents/영어/수능영어기출/수능기출/2026_영어영역_문제지.pdf'
const OTHER = process.env.CSAT_F08_PAPER_OTHER || 'C:/Users/Administrator/Documents/영어/모의평가/202706_영어영역_문제지.pdf'
const SHOTS = path.resolve('test-results-csat-learner/f08')

test.describe.configure({ mode: 'serial' })
test.setTimeout(300_000)
test.skip(!fs.existsSync(PAPER), '공개 문제지 PDF 가 이 환경에 없다(저작물 — 저장소에 두지 않는다)')

async function login(page: Page) {
  await page.route('**/api/analytics/event', (route) => route.fulfill({ json: { ok: true } }))
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', USER.email)
  await page.fill('input[type="password"]', USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60_000 })
}

/** 문제지를 놓는다 — 처음이면 놓는 칸, 추출본만 있고 이번 탭에 원본이 없으면 「문제지 다시 놓기」 뒤 놓는 칸 */
async function dropPaper(page: Page, file = PAPER) {
  const input = page.getByTestId('paper-input')
  const again = page.getByRole('button', { name: '문제지 다시 놓기' })
  // 문제지를 여는 중이면 기다린다 — 놓는 칸 또는 「다시 놓기」 가 나올 때까지
  await expect(input.or(again).first()).toBeAttached({ timeout: 60_000 })
  if (!(await input.count())) await again.click()
  await page.getByTestId('paper-input').setInputFiles(file)
}

/** 판단 장면 — 선지 탭을 고른 뒤 그 선지의 근거 버튼(choice-n)을 누른다 */
async function choose(page: Page, n: number) {
  await page.locator(`button[data-choice="${n}"]`).first().click()
  await page.locator(`[data-testid="v3-evidence"][data-key="choice-${n}"]`).click()
}

/** 밑줄 상자의 크롭 이미지 안 비율 위치 */
async function relPos(page: Page) {
  return page.evaluate(() => {
    const img = document.querySelector('[data-testid="paper-crop-frame"] img')!.getBoundingClientRect()
    const u = document.querySelector('[data-testid="paper-underline"]')!.getBoundingClientRect()
    return { x: (u.left - img.left) / img.width, y: (u.top - img.top) / img.height, w: u.width / img.width, inside: u.left >= img.left - 1 && u.right <= img.right + 1 && u.top >= img.top - 1 && u.bottom <= img.bottom + 1 }
  })
}

for (const width of [1280, 1440]) {
  test(`F08 원본 크롭 위 밑줄 — 직접 놓기 · ${width}`, async ({ page }) => {
    fs.mkdirSync(SHOTS, { recursive: true })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.setViewportSize({ width, height: 900 })
    await login(page)

    // ① 어법 2026#29 — 판단 장면에서 선지 ③ 근거
    await page.goto('/csat/item/2026-29?scene=judgment', { waitUntil: 'domcontentloaded' })
    await dropPaper(page)
    await expect(page.getByTestId('paper-crop-frame')).toBeVisible({ timeout: 120_000 })
    await expect(page.getByTestId('paper-underline')).toHaveCount(0)
    await choose(page, 3)
    await expect(page.getByTestId('paper-underline')).toHaveCount(1)
    await expect(page.getByTestId('paper-underline-note')).toHaveAttribute('data-state', 'shown')
    const base = await relPos(page)
    expect(base.inside).toBe(true)
    await page.getByTestId('paper-crop-frame').screenshot({ path: `${SHOTS}/${width}-1-choice3.png` })

    // 확대 · 축소 — 크롭 안 비율 위치가 같다
    for (const z of ['1.25', '0.8']) {
      await page.evaluate((v) => { document.documentElement.style.zoom = v }, z)
      const p = await relPos(page)
      expect(Math.abs(p.x - base.x), `zoom ${z} x`).toBeLessThan(0.005)
      expect(Math.abs(p.y - base.y), `zoom ${z} y`).toBeLessThan(0.005)
    }
    await page.evaluate(() => { document.documentElement.style.zoom = '1' })
    // 문제지 폭 조절 — 같다
    const resizer = page.getByTestId('paper-resizer')
    if (await resizer.count()) {
      await resizer.focus()
      for (let i = 0; i < 6; i++) await page.keyboard.press('ArrowRight')
      const p = await relPos(page)
      expect(Math.abs(p.x - base.x), '폭 조절 x').toBeLessThan(0.005)
      expect(Math.abs(p.y - base.y), '폭 조절 y').toBeLessThan(0.005)
      await page.getByTestId('paper-crop-frame').screenshot({ path: `${SHOTS}/${width}-2-resized.png` })
    }

    // 다른 선지로 바꾸면 그 밑줄 하나 · 같은 선지를 다시 누르면 해제
    await choose(page, 5)
    await expect(page.getByTestId('paper-underline')).toHaveCount(1)
    expect((await relPos(page)).y).toBeGreaterThan(base.y)
    await page.locator('[data-testid="v3-evidence"][data-key="choice-5"]').click()
    await expect(page.getByTestId('paper-underline')).toHaveCount(0)
    // 장면 이동 — 근거 선택이 풀리고 밑줄도 사라진다
    await choose(page, 3)
    await expect(page.getByTestId('paper-underline')).toHaveCount(1)
    await page.getByRole('tab', { name: '원문 이해', exact: true }).click()
    await expect(page.getByTestId('paper-underline')).toHaveCount(0)

    // ② 세트 2026#44 — 선지 ③ = (c) (선지 구조로 연결)
    await page.goto('/csat/item/2026-44?scene=judgment', { waitUntil: 'domcontentloaded' })
    await dropPaper(page)
    await expect(page.getByTestId('paper-crop-frame')).toBeVisible({ timeout: 120_000 })
    if (await page.locator('button[data-choice="3"]').count()) {
      await choose(page, 3)
      await expect(page.getByTestId('paper-underline')).toHaveCount(1)
      expect((await relPos(page)).inside).toBe(true)
      // 크롭 아래쪽 밑줄도 보이는 자리로 스크롤된다
      await expect(page.getByTestId('paper-underline')).toBeInViewport()
      await page.screenshot({ path: `${SHOTS}/${width}-3-set-c.png` })
    }

    // ③ 함축 2026#21 — 평가 과제 장면에서 밑줄 어구
    await page.goto('/csat/item/2026-21?scene=task', { waitUntil: 'domcontentloaded' })
    await dropPaper(page)
    await expect(page.getByTestId('paper-crop-frame')).toBeVisible({ timeout: 120_000 })
    await expect(page.getByTestId('paper-underline')).toHaveCount(1)
    expect((await relPos(page)).inside).toBe(true)
    await page.getByTestId('paper-crop-frame').screenshot({ path: `${SHOTS}/${width}-4-implied.png` })
    await page.getByRole('tab', { name: '원문 이해', exact: true }).click()
    await expect(page.getByTestId('paper-underline')).toHaveCount(0)

    // ④ 다른 회차 PDF 를 놓으면 이 회차 크롭 · 좌표가 남지 않는다(같은 PDF 해시에 묶임)
    if (fs.existsSync(OTHER)) {
      await page.goto('/csat/item/2026-29?scene=judgment', { waitUntil: 'domcontentloaded' })
      await dropPaper(page, OTHER)
      await page.waitForTimeout(3000)
      await expect(page.getByTestId('paper-underline')).toHaveCount(0)
      await expect(page.getByTestId('paper-crop-frame')).toHaveCount(0)
    }
    expect(errors).toEqual([])
  })
}
