// apps/web/tests/e2e-isolated/vocab-core-roundtrip.isolated.spec.ts
//
// T-0069 — V1(v.core_meaning · 기본 의미) 학습 왕복을 격리 브라우저로(러너 안 로컬 Supabase · 실제 Next.js · 실제 Chromium · 공유 개발 DB 무관).
//   지도 → ws.vocab-context 팝업의 보조 V1 카드 → (키보드) 기존 WordVault 복습 → 실제 복습 한 번(뜻 보기 · 예문 · 자기 평가 = FSRS 기록) →
//   「학습 지도로」 → 같은 Workspace 팝업 복원. 복습은 학습 활동 — CSAT 시도 · G2 결속 · 계획/목표 이력은 늘지 않는다.
// fixture: 합성 학습자의 내 단어 1개를 기존 표(vocabularies)에 격리 DB 에만 넣는다(서비스 키 · 러너 안). 사람 결정 · 새 SQL 없음.
import { expect, test } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const T = 'ws.vocab-context'
const ORDER = ['v.contextual_sense', 'v.core_meaning', 'v.multiword']

test.beforeAll(() => {
  expect(URL, '격리 e2e 는 로컬 Supabase(127.0.0.1:54321)에서만 돈다').toMatch(/^http:\/\/(127\.0\.0\.1|localhost):54321/)
  expect(SERVICE.length).toBeGreaterThan(20)
})
const admin = () => createClient(URL, SERVICE, { auth: { persistSession: false } })

for (const width of [1440, 1280]) {
  test(`V1 기본 의미 — 지도 → 내 단어 복습 → 같은 Workspace 복귀 · ${width}px`, async ({ page }) => {
    test.setTimeout(240_000)
    await page.setViewportSize({ width, height: 1000 })
    const email = `iso-vocab-core-${width}-${Date.now()}@iso-learner.test`, password = `Iso-${Math.random().toString(36).slice(2)}-Aa1`
    const made = await admin().auth.admin.createUser({ email, password, email_confirm: true })
    expect(made.error).toBeNull()
    const uid = made.data.user!.id
    const ins = await admin().from('vocabularies').insert({ user_id: uid, word: 'vivid', meaning: '생생한', example_sentence: 'She has a vivid memory of her first school day.' }).select('id').single()
    expect(ins.error, ins.error?.message).toBeNull()
    const vocabId = ins.data!.id as string

    await page.goto('/login', { waitUntil: 'networkidle' })
    await page.fill('input[type="email"]', email); await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]'); await page.waitForURL((x) => !x.pathname.startsWith('/login'))
    const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
    const ex = await page.request.post('/api/csat/diagnosis/sessions', { data: { examId: 'M9901', mode: 'live', takenAt: today, clientKey: crypto.randomUUID(), choices: Object.fromEntries(Array.from({ length: 45 }, (_, i) => [i + 1, ((i + 1) % 5) + 1])) } })
    expect(ex.status(), await ex.text()).toBe(200)
    const g = await page.request.put('/api/csat/diagnosis/map/goal', { data: { target: 80, exam: 'kice6', clientKey: crypto.randomUUID() } })
    expect(g.status(), await g.text()).toBe(200)
    const goal = (await g.json() as { goalVersionId: number }).goalVersionId
    const r = await page.request.post('/api/csat/diagnosis/map/plan', { data: { template: T, order: ORDER, planned: {}, reason: 'initial', expectedVersion: 0, expectedGoalVersion: goal, clientKey: crypto.randomUUID() } })
    expect(r.status(), await r.text()).toBe(200)
    const snap = async () => ({
      plans: ((await admin().from('learner_workspace_plan').select('plan_version').eq('user_id', uid)).data ?? []).length,
      goals: (await admin().from('csat_map_goal_version').select('id', { count: 'exact', head: true }).eq('user_id', uid)).count,
      attempts: (await admin().from('learning_task_attempts').select('id', { count: 'exact', head: true }).eq('user_id', uid)).count,
      bindings: (await admin().from('workspace_delivery_attempt').select('attempt_id', { count: 'exact', head: true }).eq('user_id', uid)).count,
    })
    const before = await snap()

    // 지도 → Workspace 팝업 → 보조 V1 카드
    await page.goto('/csat/diagnosis?tab=map&view=full', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-testid="unified-map"]')).toBeVisible({ timeout: 60_000 })
    const row = page.locator(`[data-testid="ws-row"][data-ws="${T}"]`)
    if ((await row.getAttribute('data-kind')) === 'preparing' && !(await row.isVisible())) await page.locator('[data-testid="ws-preparing"] > summary').click()
    await row.locator('[data-testid="ws-open"]').click()
    const dialog = page.locator(`[role="dialog"][data-ws="${T}"]`)
    await expect(dialog).toBeVisible()
    const overview = dialog.locator('[data-testid="ws-tab-overview"]')
    if ((await overview.getAttribute('aria-selected')) !== 'true') await overview.click()
    const card = dialog.locator('[data-testid="ws-vocab"]')
    await expect(card).toBeVisible()
    await expect(card).toContainText('보조 TASK')
    await expect(card.locator('[data-testid="ws-vocab-note"]')).toContainText('확인 도구는 아직 없어요')
    await expect(dialog.locator('[data-testid="ws-authored-support"][data-task="v.core_meaning"]'), 'V1 은 창작 공급 카드가 아니다').toHaveCount(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
    await test.info().attach(`vocab-card-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

    // 키보드로 복습 진입
    const link = card.locator('[data-testid="ws-vocab-review"]')
    const href = (await link.getAttribute('href'))!
    const q = new globalThis.URL(href, 'http://x').searchParams
    expect(q.get('from')).toBe('map'); expect(q.get('map_task')).toBe('v.core_meaning'); expect(q.get('ws')).toBe(T)
    expect(q.has('map_item') || q.has('map_attempt'), '어휘 활동에 자료 · 수행 id 를 싣지 않는다').toBe(false)
    await link.focus(); await expect(link).toBeFocused(); await page.keyboard.press('Enter')
    await page.waitForURL((x) => x.pathname === '/wordvault/review')
    await expect(page.locator('[data-testid="vocab-map-bar"]')).toContainText('근거로 세지 않아요')

    // 실제 복습 한 번 — 뜻 보기(Space) → 예문(Space) → 자기 평가 3 → 완료 화면 · FSRS 기록
    await expect(page.getByText('vivid').first()).toBeVisible({ timeout: 30_000 })
    await page.keyboard.press('Space'); await expect(page.getByText('생생한').first()).toBeVisible()
    await page.keyboard.press('Space'); await page.keyboard.press('3')
    await expect(page.getByText('오늘 잘 마쳤어요')).toBeVisible({ timeout: 30_000 })
    await expect.poll(async () => (await admin().from('learning_records').select('id', { count: 'exact', head: true }).eq('user_id', uid)).count, { timeout: 30_000 }).toBeGreaterThan(0)
    await expect.poll(async () => ((await admin().from('vocabularies').select('review_count').eq('id', vocabId).single()).data?.review_count ?? 0), { timeout: 30_000 }).toBeGreaterThan(0)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
    await test.info().attach(`vocab-done-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

    // 같은 Workspace 로 복귀(수행 뒤에도 문맥 유지) — 키보드
    const back = page.locator('[data-testid="vocab-map-return"]')
    await back.focus(); await page.keyboard.press('Enter')
    await expect(page.locator('[data-testid="unified-map"]')).toBeVisible({ timeout: 60_000 })
    await expect(page.locator(`[role="dialog"][data-ws="${T}"]`), '같은 Workspace 팝업 복원').toBeVisible({ timeout: 30_000 })
    const url = new globalThis.URL(page.url())
    expect(url.searchParams.get('map_item')).toBeNull(); expect(url.searchParams.get('map_attempt')).toBeNull()

    // 복습은 학습 활동 — CSAT 시도 · G2 결속 · 계획 · 목표 이력 불변
    expect(await snap()).toEqual(before)
    await test.info().attach(`vocab-return-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  })
}
