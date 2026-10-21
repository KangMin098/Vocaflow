// apps/web/tests/e2e/csat-v32-my-words.spec.ts
//
// v3.2 「내 말로 이해하기」(scene=meaning) — 실제 제품 화면으로 확인한다.
//   ① 입력 없이 쉬운 설명 열람(입력칸은 펼치기 전에는 없다) · 쓰지 않고도 다른 장면으로 이동
//   ② 작성 → 저장 실패(기기 쓰기 막음) → 글 보존 · 「다시 저장」 → 저장 → 새로 고침 뒤 한 건
//   ③ 검수된 쉬운 말과 나란히 · 지킬 조건 표시 · 점수 없음 안내 → 고쳐 쓰기(처음 설명 보존 · 달라진 점) → 수정 전후 표시
//   ④ 대조 뒤 「이 의미가 이어지는 곳」 — 앞뒤 관계 · 글 전체 단계 · 문항 성립으로 이동하고 돌아와도 노트 유지
//   ⑤ 이 의미 읽어 주기는 검수된 설명만 읽는다(학습자 글은 읽지 않는다)
// 테스트 계정 기록에 노트가 남는다 — 이미 있으면 작성 · 실패 단계를 건너뛰고 대조 · 고쳐 쓰기부터 본다(재실행 안전).

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
  test(`내 말로 이해하기 — 작성 · 실패 · 대조 · 고쳐 쓰기 · 이어지는 곳 ${width}`, async ({ page }) => {
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

    // ② 작성 → 저장 실패 → 글 보존 · 다시 저장 → 저장
    if (!existing.some((n) => n.unitId === 'u1')) {
      await press(page, 'ms-draft-open', async () => expect(page.getByTestId('ms-draft-text')).toBeVisible({ timeout: 1000 }))
      const text = `이상적인 법은 어차피 안 할 일만 막는다 ${Date.now()}`
      await page.getByTestId('ms-draft-text').fill(text)
      await page.evaluate(() => { (window as unknown as { __failPut?: boolean }).__failPut = true })
      await page.getByTestId('ms-draft-save').click()
      await expect(page.getByTestId('ms-draft-failed')).toBeVisible({ timeout: 10_000 })
      await expect(page.getByTestId('ms-draft-text')).toHaveValue(text)
      await expect(page.getByTestId('ms-draft-save')).toHaveText(/다시 저장/)
      await page.evaluate(() => { (window as unknown as { __failPut?: boolean }).__failPut = false })
      await page.getByTestId('ms-draft-save').click()
      await expect(page.getByTestId('ms-note')).toBeVisible({ timeout: 10_000 })
      await expect(page.getByTestId('ms-note')).toContainText(text)
      // 새로 고침 뒤 한 건 — 재시도가 중복을 만들지 않는다
      await page.reload({ waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('ms-note')).toBeVisible({ timeout: 120_000 })
      const after = await deviceNotes(page, '2026#34')
      expect(after.filter((n) => n.unitId === 'u1')).toHaveLength(1)
      expect(after.find((n) => n.unitId === 'u1')!.first).toBe(text)
    }

    // ③ 대조 — 내 말 · 검수된 쉬운 말 · 지킬 조건 · 점수 없음
    await press(page, 'ms-draft-compare-open', async () => expect(page.getByTestId('ms-draft-compare')).toBeVisible({ timeout: 1000 }))
    const cmp = page.getByTestId('ms-draft-compare')
    await expect(cmp).toContainText('검수된 쉬운 말')
    await expect(cmp).toContainText('내 말에도 남아 있는지 볼 조건')
    await expect(cmp).toContainText('점수는 매기지 않아요')
    await expect(async () => expect((await deviceNotes(page, '2026#34')).find((n) => n.unitId === 'u1')?.compared).toBe(true)).toPass({ timeout: 10_000 })
    await page.screenshot({ path: `${SHOTS}/${width}-1-compare.png` })

    // 고쳐 쓰기 — 처음 설명은 남고 고친 설명 · 달라진 점이 따로
    const before = (await deviceNotes(page, '2026#34')).find((n) => n.unitId === 'u1')!
    await page.getByTestId('ms-revise-open').click()
    await expect(page.getByTestId('ms-draft-revise')).toContainText(before.first)
    const revised = `이상적인 법이 이성적으로 어차피 안 할 일만 금지한다면, 그 법은 자유를 묶는다고 볼 수 없다 ${Date.now()}`
    await page.getByTestId('ms-revise-text').fill(revised)
    await page.getByTestId('ms-revise-change').fill('「이상적인 법」 · 「만약」 조건을 빠뜨렸었다')
    await page.getByTestId('ms-revise-save').click()
    await expect(page.getByTestId('ms-note')).toHaveAttribute('data-revised', 'true', { timeout: 10_000 })
    // 대조 칸이 열려 있으면 처음 설명은 접힌 칸에 — 펼쳐서 수정 전후를 확인한다
    const hist = page.getByTestId('ms-note-history')
    if (await hist.evaluate((el) => el.tagName === 'DETAILS')) await hist.locator('summary').click()
    await expect(hist).toContainText(before.first)
    await expect(page.getByTestId('ms-note')).toContainText(revised)
    await expect(hist).toContainText('달라진 점')
    const saved = (await deviceNotes(page, '2026#34')).find((n) => n.unitId === 'u1')!
    expect(saved.first).toBe(before.first)
    expect(saved.revised).toBe(revised)
    await page.screenshot({ path: `${SHOTS}/${width}-2-revised.png` })

    // ④ 이어지는 곳 — 대조는 고쳐 쓴 뒤에도 열려 있다(고친 글로 바로 다시 대조) · 관계 · 글 전체 단계
    await expect(page.getByTestId('ms-draft-compare')).toContainText(revised)
    await expect(page.getByTestId('ms-note-next')).toBeVisible()
    const rel = page.getByTestId('ms-note-relation').first()
    if (await rel.count()) {
      await rel.click()
      await expect(page.getByTestId('ms-relation')).toBeVisible()
    }
    await page.getByTestId('ms-note-whole').click()
    await expect(page.getByTestId('ms-whole-steps')).toBeVisible()
    await page.screenshot({ path: `${SHOTS}/${width}-3-next.png` })
    // 문항 성립으로 갔다가 뒤로 — 노트가 그대로
    await page.getByTestId('ms-go-judgment').click()
    await expect(page).toHaveURL(/scene=judgment/)
    await page.goBack()
    await expect(page.getByTestId('ms-note')).toHaveAttribute('data-revised', 'true', { timeout: 30_000 })

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
