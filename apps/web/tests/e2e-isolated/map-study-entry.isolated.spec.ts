// apps/web/tests/e2e-isolated/map-study-entry.isolated.spec.ts
//
// T-0159 — 학습지도 「기출 해부로 공부하기」(TaskInspector)가 실제 Next · 실제 로그인 · 실제 지도에서
// 같은 지문 보호(entriesFor · studyExposure)를 거친 목록만 보이고, 추천 이유 · 판단 능력 · 복귀 문맥을 싣는지(1440×900 · 1280×800).
// 합성 계정(iso-learner.test)만 쓴다 — 실제 학습자 · 개발 DB 증거가 아니다. 연구 사례가 로컬 DB 에 없으면 목록은 보류 안내만 보인다(그것도 계약).
import { expect, test, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const SB_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const WS = 'ws.central-meaning'

test.beforeAll(() => {
  expect(SB_URL, '격리 e2e 는 로컬 Supabase(127.0.0.1:54321)에서만 돈다').toMatch(/^http:\/\/(127\.0\.0\.1|localhost):54321/)
  expect(SERVICE.length).toBeGreaterThan(20)
})
const admin = () => createClient(SB_URL, SERVICE, { auth: { persistSession: false } })
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), '문서 가로 넘침').toBeLessThanOrEqual(1)
}

for (const [width, height] of [[1440, 900], [1280, 800]] as const) {
  test(`지도 기출 목록 — 보호 · 이유 · 복귀 문맥 · 왕복 ${width}×${height}`, async ({ page }) => {
    test.setTimeout(240_000)
    await page.setViewportSize({ width, height })
    const email = `iso-map-study-${width}-${Date.now()}@iso-learner.test`, password = `Iso-${Math.random().toString(36).slice(2)}-Aa1`
    const made = await admin().auth.admin.createUser({ email, password, email_confirm: true })
    expect(made.error).toBeNull()
    await page.goto('/login', { waitUntil: 'networkidle' })
    await page.fill('input[type="email"]', email); await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]'); await page.waitForURL((x) => !x.pathname.startsWith('/login'))

    await page.goto('/csat/diagnosis?tab=map&view=full', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-testid="unified-map"]')).toBeVisible({ timeout: 60_000 })
    await page.locator(`[data-testid="ws-row"][data-ws="${WS}"] [data-testid="ws-open"]`).click()
    const dialog = page.locator(`[role="dialog"][data-ws="${WS}"]`)
    await dialog.locator('[data-testid="detail-tab-evidence"]').click()

    const study = dialog.locator('[data-testid="inspector-study"]')
    await expect(study, '기록 없는 학습자도 보류 안내(안 푼 확인 문항)는 보인다').toBeVisible({ timeout: 30_000 })
    await expect(study.locator('[data-testid="inspector-study-withheld"]')).toContainText('같은 지문')

    // 안 푼 확인 문항(지도 확인 링크의 대상)은 해설 링크로 열리지 않는다
    const confirmTargets = await page.evaluate(() => [...document.querySelectorAll('a[href*="check=1"]')].map((a) => new URL((a as HTMLAnchorElement).href).pathname))
    const links = study.locator('[data-testid="inspector-study-link"]')
    const hrefs = await links.evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? ''))
    for (const h of hrefs) {
      expect(h, '복귀 문맥').toContain('from=map')
      expect(h).toContain('map_task=r.central_meaning')
      expect(confirmTargets).not.toContain(new URL(h, 'http://x').pathname)
    }
    if (hrefs.length > 0) {
      await expect(study.locator('[data-testid="inspector-study-why"]').first()).toContainText('왜:')
      await expect(study.locator('[data-testid="inspector-study-meaning"]')).toContainText('혼자 판단한 기록으로는 세지 않아요')
    }
    await expect(study.locator('[data-testid="inspector-study-goal"]').or(study.locator('[data-testid="inspector-study-withheld"]')).first()).toBeVisible()
    await noOverflow(page)
    await test.info().attach(`map-study-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

    // 왕복 — 링크가 있으면 문항 화면 → 「학습 지도로」 가 같은 TASK 문맥을 돌려준다
    if (hrefs.length > 0) {
      await links.first().click()
      await page.waitForURL(/\/csat\/item\//)
      const back = page.locator('[data-testid="item-back-map"]')
      await expect(back).toBeVisible({ timeout: 60_000 })
      expect(await back.getAttribute('href')).toContain('map_task=r.central_meaning')
      await noOverflow(page)
      await test.info().attach(`map-study-item-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
      await back.click()
      await expect(page.locator('[data-testid="unified-map"]')).toBeVisible({ timeout: 60_000 })
    }
    test.info().annotations.push({ type: 'study-links', description: String(hrefs.length) })
  })
}
