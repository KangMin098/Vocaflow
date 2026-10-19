// apps/web/tests/e2e-isolated/authored-supply.isolated.spec.ts
//
// FINAL LEVEL 1 — 격리 브라우저 종단(러너 안 로컬 Supabase · 실제 Next.js · 실제 Chromium). 공유 개발 DB 에 닿지 않는다.
// 전제(CI 단계): 보류 창작 SQL 을 **러너 DB 에만** 적용 → scripts/ci/authored-isolated-seed.mjs 가 R5 창작 9문항 + 자격 + 결정 + 승인을
//   「CI 격리 fixture — 사람 결정 아님」 으로 적재. 이 시험의 사람 결정 행은 버려지는 러너 DB 의 시험 행이다.
// 흐름: 학습자 계획 확정 → 지도 → Workspace 「받은 자료」 → 자료 받기 → 혼자 확인 열기(?d= 출처) → 키보드 · 클릭으로 풀이 →
//   결과 · 결속(근거) → DB 단언 → 같은 제출 재전송 멱등 → 새로고침(지난 결과) → 다른 학습자 차단 → 지도 복귀.
// 각 단계에서 정답 사전 노출(풀기 전 한 줄 요지 · 정답 표시 없음) · 가로 넘침(1280 · 1440)을 확인한다.
import { expect, test, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const TEMPLATE = 'ws.central-meaning'
const ORDER = ['r.central_meaning', 'r.discourse_function', 'r.discourse_structure']

test.beforeAll(() => {
  expect(URL, '격리 e2e 는 로컬 Supabase(127.0.0.1:54321)에서만 돈다').toMatch(/^http:\/\/(127\.0\.0\.1|localhost):54321/)
  expect(SERVICE.length).toBeGreaterThan(20)
})

const admin = () => createClient(URL, SERVICE, { auth: { persistSession: false } })
async function makeUser(tag: string) {
  const email = `iso-authored-${tag}-${Date.now()}@example.com`
  const password = `Iso-${Math.random().toString(36).slice(2)}-Aa1`
  const { data, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  return { id: data.user.id, email, password }
}
async function login(page: Page, u: { email: string; password: string }) {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', u.email)
  await page.fill('input[type="password"]', u.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((x) => !x.pathname.startsWith('/login'))
}
async function noOverflow(page: Page) {
  const o = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(o, '가로 넘침').toBeLessThanOrEqual(1)
}
/** 학습자 세션으로 확정한 계획(지도 화면의 「계획 확정」과 같은 API) */
async function commitPlan(page: Page) {
  const r = await page.request.post('/api/csat/diagnosis/map/plan', {
    data: { template: TEMPLATE, order: ORDER, planned: {}, reason: 'initial', expectedVersion: 0, clientKey: crypto.randomUUID() },
  })
  expect(r.status(), `계획 확정: ${await r.text()}`).toBe(200)
}

for (const width of [1440, 1280]) {
  test(`창작 공급 종단 — ${width}px`, async ({ page, browser }) => {
    await page.setViewportSize({ width, height: 1000 })
    const a = await makeUser(`a${width}`)
    await login(page, a)
    await commitPlan(page)

    // 지도 → Workspace 팝업 → 받은 자료
    await page.goto(`/csat/diagnosis?tab=map&view=full`, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-testid="unified-map"]')).toBeVisible({ timeout: 60_000 })
    await page.locator(`[data-testid="ws-row"][data-ws="${TEMPLATE}"] [data-testid="ws-open"]`).click()
    const card = page.locator('[data-testid="ws-authored"]')
    await expect(card).toBeVisible()
    await expect(page.locator('[data-testid="ws-authored-empty"]')).toBeVisible()
    await noOverflow(page)
    // 중복 클릭 — 두 번 눌러도 공급은 한 번(요청 키 결정적 · 버튼 잠금)
    const req = page.locator('[data-testid="ws-authored-request"]')
    await req.click()
    await req.click({ trial: true }).catch(() => undefined)
    await expect(page.locator('[data-testid="ws-authored-msg"]')).toBeVisible({ timeout: 30_000 })
    const list = page.locator('[data-testid="ws-authored-list"]')
    await expect(list).toBeVisible()
    const deliveries = (await admin().from('workspace_content_delivery').select('id, artifact_ref, role').eq('user_id', a.id)).data ?? []
    expect(deliveries.length).toBeGreaterThan(0)
    expect(new Set(deliveries.map((d) => `${d.artifact_ref}|${d.role}`)).size).toBe(deliveries.length)

    // 혼자 확인 자료가 있으면 그것, 없으면 첫 자료(단계에 따라 다르다) — 링크는 출처(?d=)를 가진다
    const link = list.locator('li[data-role="independent_check"] a').first().or(list.locator('li a').first()).first()
    const href = await link.getAttribute('href')
    // 출처(?d=) + 지도 복귀 문맥(from=map · TASK · Workspace · PLAN — C7 P2 · outgoingCtx)
    expect(href).toMatch(/^\/csat\/learn\/[a-z0-9.-]+\?d=[0-9a-f-]{36}(&|$)/)
    expect(href).toContain('from=map')
    await link.click()
    const runner = page.locator('[data-testid="authored-runner"]')
    await expect(runner).toBeVisible({ timeout: 30_000 })
    await noOverflow(page)

    // 정답 사전 노출 없음 — 결과 영역 · 「정답」 표시 · 한 줄 요지 없음
    await expect(page.locator('[data-testid="authored-result"]')).toHaveCount(0)
    await expect(runner).not.toContainText('한 줄 요지')
    await expect(runner.getByText('정답', { exact: true })).toHaveCount(0)

    // 키보드: 첫 문장 버튼에 초점 → Enter 로 중심 문장 선택
    const bars = runner.locator('ol li button')
    await bars.nth(0).focus()
    await expect(bars.nth(0)).toBeFocused()
    await page.keyboard.press('Enter')
    await expect(bars.nth(0)).toHaveAttribute('aria-pressed', 'true')
    await bars.nth(1).click()
    const chips = runner.locator('fieldset').first().locator('button')
    if (await chips.count()) await chips.first().click()
    await runner.locator('fieldset').last().locator('button').first().click()
    const submit = runner.getByRole('button', { name: '맞춰 보기' })
    await expect(submit).toBeEnabled()
    await submit.click()
    const result = page.locator('[data-testid="authored-result"]')
    await expect(result).toBeVisible({ timeout: 30_000 })
    await expect(result).toContainText('한 줄 요지')
    await noOverflow(page)

    // DB 단언 — 시도 1행 · 결속은 화면이 연 납품에만
    const did = new globalThis.URL(href!, 'http://x').searchParams.get('d')!
    await expect.poll(async () => (await admin().from('workspace_delivery_attempt').select('delivery_id').eq('user_id', a.id)).data?.map((r) => r.delivery_id) ?? [], { timeout: 15_000 }).toEqual([did])
    const ref = `authored:${href!.split('/')[3].split('?')[0]}`
    expect((await admin().from('learning_task_attempts').select('id', { count: 'exact', head: true }).eq('user_id', a.id).eq('item_ref', ref)).count).toBe(1)

    // 새로고침 — 지난 결과가 보이고 다시 풀 수 없다
    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-testid="authored-result"]')).toBeVisible({ timeout: 30_000 })
    await expect(runner.getByRole('button', { name: '맞춰 보기' })).toHaveCount(0)

    // 다른 학습자 — 같은 링크로 열어도 자료가 열리지 않는다(남의 납품 · 미리보기 없음)
    const b = await makeUser(`b${width}`)
    const ctx = await browser.newContext({ viewport: { width, height: 1000 } })
    const pb = await ctx.newPage()
    await login(pb, b)
    await pb.goto(href!, { waitUntil: 'domcontentloaded' })
    await expect(pb.getByText('아직 받지 않은 자료예요')).toBeVisible({ timeout: 30_000 })
    await expect(pb.locator('[data-testid="authored-runner"]')).toHaveCount(0)
    const forged = await pb.request.post(`/api/csat/authored/${href!.split('/')[3].split('?')[0]}/attempt`, {
      data: { deliveryId: did, response: { claim: 0, support: [1], relation: 'reason', choice: 0 }, clientSessionId: crypto.randomUUID(), clientMutationId: crypto.randomUUID(), answeredAt: new Date().toISOString(), helpLevel: 'independent' },
    })
    expect(forged.status()).toBe(403)
    await ctx.close()

    // 지도 복귀 — 받은 자료 카드에 결과가 돌아온다
    await page.locator('[data-testid="authored-result"] a', { hasText: '학습 지도로' }).click()
    await expect(page.locator('[data-testid="unified-map"]')).toBeVisible({ timeout: 60_000 })
    await page.locator(`[data-testid="ws-row"][data-ws="${TEMPLATE}"] [data-testid="ws-open"]`).click()
    await expect(page.locator('[data-testid="ws-authored-list"]')).toContainText('풀었어요')
    await noOverflow(page)
  })
}
