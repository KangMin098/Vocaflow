// apps/web/tests/e2e-isolated/factory-card-request.isolated.spec.ts
//
// 2F — 실제 FactoryDcpCard 를 PC Chromium(1440px)에서: 빈 목록 → 요청 실패(502) → 다시 요청 → 잘못된 200(완료로 올리지 않음) →
// 제작 연결 대기 → 받음(첫 요지 링크 · 목록 새로고침). 서버 · 로그인 · 공유 DB 없음. 응답은 page.route 대역.
//
//   pnpm --dir apps/web exec tsx scripts/build-factory-card-harness.mts
//   pnpm --dir apps/web exec playwright test -c playwright.isolated.config.ts tests/e2e-isolated/factory-card-request.isolated.spec.ts
import fs from 'node:fs'
import path from 'node:path'

import { expect, test } from '@playwright/test'

const HTML = path.resolve(__dirname, '../fixtures/factory-card-harness.html')
const SHOTS = path.resolve(__dirname, '../../playwright-auth/shots-2f')
const ORIGIN = 'http://harness.local'
const FIRST = '00000000-0000-4000-8000-00000000f201'
const SRC = '00000000-0000-4000-8000-00000000f2a0'

test('공장 연습 자료 요청 — 실패 · 다시 요청 · 잘못된 200 · 연결 대기 · 받음', async ({ page }) => {
  expect(fs.existsSync(HTML), 'harness not built — run scripts/build-factory-card-harness.mts first').toBe(true)
  fs.mkdirSync(SHOTS, { recursive: true })
  await page.setViewportSize({ width: 1440, height: 900 })
  let delivered = false
  const bodies: unknown[] = []
  const replies = [
    { status: 502, body: { error: 'x', code: 'request_failed' } },
    { status: 200, body: { status: 'delivered', first: 'not-a-uuid', delivered: 3, replayed: false } },
    { status: 200, body: { status: 'waiting_link' } },
    { status: 200, body: { status: 'delivered', first: FIRST, delivered: 3, replayed: false } },
  ]
  await page.route(`${ORIGIN}/`, (r) => r.fulfill({ contentType: 'text/html; charset=utf-8', body: fs.readFileSync(HTML, 'utf8') }))
  await page.route(`${ORIGIN}/api/csat/factory?template=ws.central-meaning`, (r) => r.fulfill({ contentType: 'application/json', body: JSON.stringify(delivered
    ? { status: 'installed', sources: 1, rows: (['main_point', 'title', 'topic'] as const).map((type, i) => ({ deliveryId: `00000000-0000-4000-8000-00000000f20${i + 1}`, sourceId: SRC, type, state: 'ok', attempts: 0, lastCorrect: null })) }
    : { status: 'installed', sources: 0, rows: [] }) }))
  await page.route(`${ORIGIN}/api/csat/factory/request`, async (r) => {
    bodies.push(r.request().postDataJSON())
    const next = replies.shift()!
    if (next.body.status === 'delivered' && next.body.first === FIRST) delivered = true
    await r.fulfill({ status: next.status, contentType: 'application/json', body: JSON.stringify(next.body) })
  })
  const errors: string[] = []
  page.on('pageerror', (e) => errors.push(e.message))
  await page.goto(`${ORIGIN}/`)

  const card = page.getByTestId('ws-factory-dcp')
  await expect(card).toBeVisible()
  const button = page.getByRole('button', { name: '공장 연습 자료 요청' })
  const box = await button.boundingBox()
  expect(box && box.height).toBeGreaterThanOrEqual(44)
  await page.screenshot({ path: path.join(SHOTS, '01-empty.png'), fullPage: true })

  await button.focus()
  await page.keyboard.press('Enter')
  await expect(card.getByRole('alert')).toContainText('요청 결과를 확인하지 못했어요')
  await page.screenshot({ path: path.join(SHOTS, '02-failed.png'), fullPage: true })

  // 잘못된 200 — 받음으로 올리지 않는다(실패 유지 · 링크 없음)
  await page.getByRole('button', { name: '다시 요청' }).click()
  await expect(page.getByTestId('ws-factory-dcp-request')).toHaveAttribute('data-state', 'failed')
  await expect(page.getByTestId('ws-factory-dcp-first')).toHaveCount(0)

  await page.getByRole('button', { name: '다시 요청' }).click()
  await expect(card.getByRole('status')).toContainText('제작 연결 대기')
  await page.screenshot({ path: path.join(SHOTS, '03-waiting-link.png'), fullPage: true })

  await page.getByRole('button', { name: '공장 연습 자료 요청' }).click()
  const first = page.getByTestId('ws-factory-dcp-first')
  await expect(first).toBeVisible()
  expect(await first.getAttribute('href')).toContain(`/csat/factory/${FIRST}`)
  await expect(page.getByTestId('ws-factory-dcp-list').locator('li')).toHaveCount(3)
  await expect(card).not.toContainText(FIRST) // 학습자 화면에 내부 id 를 글로 보이지 않는다
  await page.screenshot({ path: path.join(SHOTS, '04-delivered.png'), fullPage: true })

  expect(bodies).toEqual(Array(4).fill({ template: 'ws.central-meaning' }))
  expect(await page.evaluate(() => (window as unknown as { __vfEvents?: unknown[] }).__vfEvents)).toEqual(
    ['failed', 'failed', 'waiting_link', 'delivered'].map((outcome) => ({ name: 'csat_factory_dcp_requested', props: { outcome } })))
  const width = await page.evaluate(() => document.documentElement.scrollWidth)
  expect(width).toBeLessThanOrEqual(1440)
  expect(errors).toEqual([])
})
