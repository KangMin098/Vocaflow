// apps/web/tests/e2e/csat-v32-my-words.spec.ts
//
// v3.2 원문 이해(scene=meaning) — 실제 제품 화면으로 확인한다. T-0091 이후 「내 말로」 작성 · 대조 · 고쳐 쓰기는 없다.
//   ① 입력 없이 쉬운 설명 열람 · 쓰는 칸 없이 다른 장면으로 이동
//   ② 예전 노트가 있으면 읽기 전용으로 그대로 · 문항 성립으로 갔다가 돌아와도 기기 기록 불변
//   ⑤ 이 의미 읽어 주기는 검수된 설명만 읽는다(학습자 글은 읽지 않는다)

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
const SHOTS = path.resolve('test-results-csat-learner/v32-my-words')

test.describe.configure({ mode: 'serial' })
test.setTimeout(300_000)

async function login(page: Page) {
  await page.route('**/api/analytics/event', (route) => route.fulfill({ json: { ok: true } }))
  await page.addInitScript(() => {
    const put = IDBObjectStore.prototype.put
    IDBObjectStore.prototype.put = function (...args: Parameters<typeof put>) {
      if ((window as unknown as { __failPut?: boolean }).__failPut) throw new DOMException('test: put blocked', 'QuotaExceededError')
      return put.apply(this, args)
    }
  })
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', USER.email)
  await page.fill('input[type="password"]', USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 60_000 })
}

/** 기기 기록의 이 문항 「내 말로」 노트 */
const deviceNotes = (page: Page, item: string) =>
  page.evaluate(async (id) => {
    const db: IDBDatabase = await new Promise((ok, no) => { const r = indexedDB.open('vocaflow-csat'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error) })
    const rec = await new Promise<{ meaningNotes?: { item: string; unitId: string; first: string; revised?: string; change?: string; compared: boolean }[] }>((ok) => {
      const g = db.transaction('record').objectStore('record').get('dissection-v1')
      g.onsuccess = () => ok(g.result ?? {})
    })
    return (rec.meaningNotes ?? []).filter((x) => x.item === id)
  }, item)

/** 하이드레이션 전 클릭은 사라질 수 있다 — 결과가 보일 때까지 */
async function press(page: Page, testId: string, then: () => Promise<void>) {
  await expect(async () => {
    await page.getByTestId(testId).first().click()
    await then()
  }).toPass({ timeout: 30_000 })
}

for (const width of [1280, 1440]) {
  test(`원문 이해 — 서술 입력 없음 · 과거 노트 읽기 전용 · 이어지는 곳 ${width}`, async ({ page }) => {
    fs.mkdirSync(SHOTS, { recursive: true })
    const errors: string[] = []
    page.on('pageerror', (e) => errors.push(e.message))
    await page.setViewportSize({ width, height: 900 })
    await login(page)
    // 이 스펙이 남긴 예전 노트를 지운다(서버 동기화 전에 기기 · 서버 둘 다 비도록 저장 경로 대신 기록 자체에서 뺀다)
    await page.goto('/csat/item/2026-34?scene=meaning&meaning=u1', { waitUntil: 'domcontentloaded', timeout: 180_000 })
    await expect(page.getByTestId('ms-panel')).toBeVisible({ timeout: 120_000 })

    // ① 입력 없이 열람 — 정확한 뜻 · 쉬운 말 · 지킬 조건이 보이고, 입력칸은 펼치기 전에는 없다
    const explain = page.getByTestId('ms-explain')
    await expect(explain).toContainText('정확한 뜻')
    await expect(explain).toContainText('쉬운 말')
    await expect(page.getByTestId('ms-preserves')).toBeVisible()
    await expect(page.getByTestId('ms-draft-text')).toHaveCount(0)
    const existing = await deviceNotes(page, '2026#34')

    // ② T-0091 — 「내 말로」 작성 · 저장 · 대조 · 고쳐 쓰기는 없다. 예전 노트가 있으면 읽기 전용으로 그대로, 없으면 칸 자체가 없다
    await expect(page.getByTestId('ms-draft-open')).toHaveCount(0)
    await expect(page.locator('[data-testid="ms-panel"] textarea')).toHaveCount(0)
    const old = existing.find((n) => n.unitId === 'u1')
    if (old) {
      const note = page.getByTestId('ms-note')
      await expect(note).toHaveAttribute('data-readonly', 'true')
      await note.locator('summary').click()
      await expect(note).toContainText(old.first)
    } else {
      await expect(page.getByTestId('ms-note')).toHaveCount(0)
    }
    await page.screenshot({ path: `${SHOTS}/${width}-1-readonly.png` })

    // ③ 문항 성립으로 갔다가 뒤로 — 기기 기록은 그대로(열람이 지우거나 덮지 않는다)
    await press(page, 'ms-go-judgment', async () => expect(page).toHaveURL(/scene=judgment/, { timeout: 1000 }))
    await page.goBack()
    await expect(page.getByTestId('ms-panel')).toBeVisible({ timeout: 30_000 })
    expect(await deviceNotes(page, '2026#34')).toEqual(existing)

    // ⑤ 이 의미 읽어 주기 — 검수된 설명만(학습자 글은 읽지 않는다): 읽는 칸은 정확한 뜻 · 쉬운 말 · 지킬 조건 중 하나
    await page.getByTestId('ms-unit-speak').click()
    const speaking = page.locator('[data-testid="ms-panel"] [data-speaking="true"]')
    await expect(speaking).toHaveCount(1, { timeout: 30_000 })
    await expect(page.getByTestId('ms-note').locator('[data-speaking="true"]')).toHaveCount(0)
    await page.getByTestId('ms-unit-speak').click() // 멈춤
    await page.getByTestId('ms-unit').nth(1).click() // 다른 의미 → 읽기 중단
    await expect(speaking).toHaveCount(0, { timeout: 10_000 })

    // ① 쓰지 않은 의미에서도 다른 장면으로 자유롭게
    await expect(page.getByTestId('ms-draft-text')).toHaveCount(0)
    await page.getByTestId('ms-go-design').click()
    await expect(page).toHaveURL(/scene=design/)

    // 가로 넘침 없음
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(0)
    expect(errors).toEqual([])
  })
}
