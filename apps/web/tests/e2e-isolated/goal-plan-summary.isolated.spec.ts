// apps/web/tests/e2e-isolated/goal-plan-summary.isolated.spec.ts
//
// T-0070 — 목표 → TASK 별 근거 · 이번 학습량 · 도달 조건 → 지금 할 행동 → 수행 후 근거 · PLAN 변화를 한 지도에서(격리 · 실제 Next · 실제 Chromium · 공유 개발 DB 무관).
//   대표 TASK = ws.option-match 의 중심 e.option_correspondence(창작 자료 · 실제 공급 · 서버 채점).
//   A(1440 · 학습이 필요한 학습자): 시험 기록 → 목표 → PLAN → 요약 행 = PLAN 편집기 값 → 요약의 실행 링크(키보드) → 독립 확인 2 오답 → 같은 Workspace 복귀 → 계획 재확정 → 요약 행 단계 = 바로잡기.
//   B(1280 · 확인이 진행된 학습자): 같은 시작 → 독립 확인 2 정답 → 근거 축적(직접 확인) → 요약 행 근거 · 단계가 서버 계산 그대로 바뀐다(규칙상 단계가 그대로여도 정상 대조).
// 숫자 비교 = 요약 행 data-planned/done ↔ PLAN 편집기 행 data-planned/done(같은 DTO) · 저장 값(learner_workspace_plan) · 서버 시도(learning_task_attempts).
import fs from 'node:fs'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const WS = 'ws.option-match', TASK = 'e.option_correspondence'
const ORDER = ['e.option_correspondence', 'v.semantic_relation', 'r.central_meaning']
type Item = { id: string; gold: Record<string, any> } // eslint-disable-line @typescript-eslint/no-explicit-any
const SET = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../src/lib/knowledge/authored/e-option-correspondence.v1.json'), 'utf8')) as { taskKey: string; items: Item[] }

test.beforeAll(() => {
  expect(URL, '격리 e2e 는 로컬 Supabase(127.0.0.1:54321)에서만 돈다').toMatch(/^http:\/\/(127\.0\.0\.1|localhost):54321/)
  expect(SERVICE.length).toBeGreaterThan(20)
})
const admin = () => createClient(URL, SERVICE, { auth: { persistSession: false } })
const noOverflow = async (page: Page) => expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)

for (const [width, scenario] of [[1440, 'A'], [1280, 'B']] as const) {
  test(`T-0070 목표 요약 — 시나리오 ${scenario} · ${width}px`, async ({ page }) => {
    test.setTimeout(300_000)
    await page.setViewportSize({ width, height: 1000 })
    const email = `iso-goalplan-${scenario}-${Date.now()}@iso-learner.test`, password = `Iso-${Math.random().toString(36).slice(2)}-Aa1`
    const made = await admin().auth.admin.createUser({ email, password, email_confirm: true })
    expect(made.error).toBeNull()
    const uid = made.data.user!.id
    await page.goto('/login', { waitUntil: 'networkidle' })
    await page.fill('input[type="email"]', email); await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]'); await page.waitForURL((x) => !x.pathname.startsWith('/login'))
    const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
    const ex = await page.request.post('/api/csat/diagnosis/sessions', { data: { examId: 'M9901', mode: 'live', takenAt: today, clientKey: crypto.randomUUID(), choices: Object.fromEntries(Array.from({ length: 45 }, (_, i) => [i + 1, ((i + 1) % 5) + 1])) } })
    expect(ex.status(), await ex.text()).toBe(200)
    const g = await page.request.put('/api/csat/diagnosis/map/goal', { data: { target: 80, exam: 'kice6', clientKey: crypto.randomUUID() } })
    expect(g.status(), await g.text()).toBe(200)
    const goal = (await g.json() as { goalVersionId: number }).goalVersionId
    let version = 0
    const commit = async (reason: string) => {
      const r = await page.request.post('/api/csat/diagnosis/map/plan', { data: { template: WS, order: ORDER, planned: {}, reason, expectedVersion: version, expectedGoalVersion: goal, clientKey: crypto.randomUUID() } })
      expect(r.status(), `계획 확정 ${reason}: ${await r.text()}`).toBe(200)
      version++
    }
    await commit('initial')
    // 확인 자료 실제 공급(기존 중심 카드 · 서버 공급 API)
    const openMap = async () => {
      await page.goto('/csat/diagnosis?tab=map&view=full', { waitUntil: 'domcontentloaded' })
      await expect(page.locator('[data-testid="unified-map"]')).toBeVisible({ timeout: 60_000 })
    }
    const summaryRow = async () => {
      const gp = page.locator('[data-testid="goal-plan"]')
      await expect(gp, '목표 요약').toBeVisible()
      if ((await gp.getAttribute('open')) === null) { await gp.locator('summary').focus(); await page.keyboard.press('Enter') }
      const row = gp.locator(`li[data-task="${TASK}"]`)
      await expect(row).toBeVisible()
      return row
    }
    await openMap()
    await page.locator(`[data-testid="ws-row"][data-ws="${WS}"] [data-testid="ws-open"]`).click()
    const dlg = page.locator(`[role="dialog"][data-ws="${WS}"]`)
    const ov = dlg.locator('[data-testid="ws-tab-overview"]')
    if ((await ov.getAttribute('aria-selected')) !== 'true') await ov.click()
    await dlg.locator('[data-testid="ws-authored-request"]').click()
    await expect.poll(async () => ((await admin().from('workspace_content_delivery').select('id').eq('user_id', uid).eq('role', 'independent_check')).data ?? []).length, { timeout: 30_000 }).toBe(2)
    await commit('content_change')

    // 요약 — 목표 → 근거 → 이번 학습량 · 조건 → 지금 할 행동 · 같은 Workspace 계획 = PLAN 편집기 값
    await openMap()
    await expect(page.locator('[data-testid="goal-plan"]'), '처음엔 접혀 지도를 밀어내지 않는다').not.toHaveAttribute('open', '')
    let row = await summaryRow()
    await expect(row).toHaveAttribute('data-stage', 'check')
    await expect(row.locator('[data-testid="goal-plan-amount"]')).toContainText('확인하기')
    const planned0 = await row.getAttribute('data-planned'), done0 = await row.getAttribute('data-done')
    await noOverflow(page)
    await test.info().attach(`goalplan-${scenario}-before-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
    await row.locator('[data-testid="goal-plan-open-plan"]').click()
    const planRow = page.locator(`[role="dialog"][data-ws="${WS}"] li[data-task="${TASK}"][data-planned]`)
    await expect(planRow, 'PLAN 편집기 행').toBeVisible({ timeout: 30_000 })
    expect([await planRow.getAttribute('data-planned'), await planRow.getAttribute('data-done')], '요약 = PLAN 편집기(같은 DTO)').toEqual([planned0, done0])
    await page.keyboard.press('Escape')

    // 지금 할 행동 — 요약의 실행 링크(키보드) → 실제 풀이 → 같은 Workspace 복귀
    const solveFromSummary = async (right: boolean) => {
      row = await summaryRow()
      const doLink = row.locator('[data-testid="goal-plan-do"]')
      await expect(doLink, '지금 할 수 있는 활동').toBeVisible()
      const href = (await doLink.getAttribute('href'))!
      expect(new globalThis.URL(href, 'http://x').searchParams.get('from'), '지도 복귀 문맥').toBe('map')
      const id = href.split('/')[3].split('?')[0]
      const gd = SET.items.find((x) => x.id === id)!.gold
      await doLink.focus(); await page.keyboard.press('Enter')
      const runner = page.locator('[data-testid="authored-runner"]')
      await expect(runner).toBeVisible({ timeout: 30_000 })
      for (const [i, op] of (gd.options as { verdict: string; sentence: number | null }[]).entries()) {
        await runner.locator(`[data-option="${i}"][data-verdict="${op.verdict}"]`).first().click()
        if (op.sentence !== null) await runner.locator(`[data-option-sentence="${i}"]`).selectOption(String(op.sentence))
      }
      await runner.locator(`[data-choice="${right ? gd.answer : (gd.answer + 1) % 5}"]`).first().click()
      await runner.getByRole('button', { name: '맞춰 보기' }).click()
      await expect(page.locator('[data-testid="authored-result"]')).toBeVisible({ timeout: 30_000 })
      await page.locator('[data-testid="authored-result"] a', { hasText: '학습 지도로' }).click()
      await expect(page.locator(`[role="dialog"][data-ws="${WS}"]`), '같은 Workspace 팝업 복원').toBeVisible({ timeout: 60_000 })
      await page.keyboard.press('Escape')
    }
    const right = scenario === 'B'
    await solveFromSummary(right)
    await solveFromSummary(right)
    const attempts = ((await admin().from('learning_task_attempts').select('task_key, is_correct').eq('user_id', uid)).data ?? [])
    expect(attempts.map((a) => [a.task_key, a.is_correct]), '서버 채점 기록').toEqual([[SET.taskKey, right], [SET.taskKey, right]])
    await expect.poll(async () => ((await admin().from('workspace_delivery_attempt').select('evidence').eq('user_id', uid)).data ?? []).filter((b) => b.evidence).length, { timeout: 15_000 }).toBe(2)
    await commit('check_result')

    // 수행 후 — 근거 · 계획이 서버 계산 그대로 바뀐다(저장 이력 = 학습자가 확정한 세 번)
    await openMap()
    row = await summaryRow()
    await expect(row.locator('dd[data-basis]'), '직접 확인 근거').toHaveAttribute('data-basis', 'direct_check')
    if (scenario === 'A') {
      await expect(row, 'A — 독립 오답 2 → 바로잡기').toHaveAttribute('data-stage', 'repair')
      await expect(row).toHaveAttribute('data-evidence', 'verified_need')
    } else {
      // B — 독립 정답 2: 규칙상 다음 단계 · 근거 상태는 서버 계산 그대로(억지 변화 없음) — 바로잡기로 가지 않는다
      await expect(row).not.toHaveAttribute('data-stage', 'repair')
      expect(['checking', 'resolved', 'verified_need']).toContain(await row.getAttribute('data-evidence'))
      await expect(row).not.toHaveAttribute('data-evidence', 'verified_need')
    }
    const plans = ((await admin().from('learner_workspace_plan').select('reason').eq('user_id', uid).order('plan_version')).data ?? []).map((r) => r.reason)
    expect(plans).toEqual(['initial', 'content_change', 'check_result'])
    await noOverflow(page)
    await test.info().attach(`goalplan-${scenario}-after-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  })
}
