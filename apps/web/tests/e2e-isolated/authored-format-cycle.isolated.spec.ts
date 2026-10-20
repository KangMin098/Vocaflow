// apps/web/tests/e2e-isolated/authored-format-cycle.isolated.spec.ts
//
// T-0068 — 새 대표 형식 두 가지의 전체 순환을 격리 브라우저로(러너 안 로컬 Supabase · 실제 Next.js · 실제 Chromium · 공유 개발 DB 무관).
//   ① option_correspondence = ws.option-match 의 중심 e.option_correspondence(중심 카드)
//   ② segment_choice        = ws.sentence-core(중심 준비 중)의 보조 s.sentence_core(보조 카드)
// 흐름: 시험 기록 → 목표 → PLAN → 실제 공급(혼자 확인 2) → 첫 독립 오답 2 → 같은 TASK 복귀 → 바로잡기(안내 연습 정답) →
//       실제 다른 지문 전이 2 → 미노출 새 독립 확인 2(보충된 ind-3 · 4) → G2 결속 → MAP/PLAN(1440 = pass 해소 · 1280 = fail 새 바로잡기 회차).
// 오답은 「틀린 판단 + 맞는 이유」 — option_correspondence 는 판정 · 대응 문장은 맞고 고른 선지만 틀림, segment_choice 는 틀린 덩어리 + 맞는 이유.
// 전제: scripts/ci/authored-isolated-seed.mjs 가 창작 세트 전부를 「CI 격리 fixture — 사람 결정 아님」 으로 적재(실제 DB 적용 · 사람 승인 아님).
import fs from 'node:fs'
import path from 'node:path'

import { expect, test, type Locator, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const SET_DIR = path.resolve(__dirname, '../../src/lib/knowledge/authored')
type Item = { id: string; role: string; gold: Record<string, any>; body: Record<string, any> } // eslint-disable-line @typescript-eslint/no-explicit-any
const setOf = (file: string) => JSON.parse(fs.readFileSync(path.join(SET_DIR, file), 'utf8')) as { taskKey: string; items: Item[] }

test.beforeAll(() => {
  expect(URL, '격리 e2e 는 로컬 Supabase(127.0.0.1:54321)에서만 돈다').toMatch(/^http:\/\/(127\.0\.0\.1|localhost):54321/)
  expect(SERVICE.length).toBeGreaterThan(20)
})
const admin = () => createClient(URL, SERVICE, { auth: { persistSession: false } })

const CASES = [
  { name: 'option_correspondence', file: 'e-option-correspondence.v1.json', prefix: 'opt', ws: 'ws.option-match', task: 'e.option_correspondence', order: ['e.option_correspondence', 'v.semantic_relation'], core: true },
  { name: 'segment_choice', file: 's-sentence-core.v1.json', prefix: 'sc', ws: 'ws.sentence-core', task: 's.sentence_core', order: ['s.o.sentence_meaning_model', 's.sentence_core', 's.chunk_boundary', 's.structural_relation'], core: false },
] as const

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), '가로 넘침').toBeLessThanOrEqual(1)
}

for (const c of CASES) for (const width of [1440, 1280]) {
  test(`T-0068 ${c.name} 전체 순환 — ${c.task} · ${width}px`, async ({ page }) => {
    test.setTimeout(360_000)
    await page.setViewportSize({ width, height: 1000 })
    const SET = setOf(c.file)
    const item = (id: string) => SET.items.find((x) => x.id === id)!
    const email = `iso-fmtcycle-${c.prefix}-${width}-${Date.now()}@iso-learner.test`, password = `Iso-${Math.random().toString(36).slice(2)}-Aa1`
    const made = await admin().auth.admin.createUser({ email, password, email_confirm: true })
    expect(made.error).toBeNull()
    const uid = made.data.user!.id
    await page.goto('/login', { waitUntil: 'networkidle' })
    await page.fill('input[type="email"]', email); await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]'); await page.waitForURL((x) => !x.pathname.startsWith('/login'))

    // 시험 기록 → 목표 → PLAN(학습자 API)
    const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
    const ex = await page.request.post('/api/csat/diagnosis/sessions', { data: { examId: 'M9901', mode: 'live', takenAt: today, clientKey: crypto.randomUUID(), choices: Object.fromEntries(Array.from({ length: 45 }, (_, i) => [i + 1, ((i + 1) % 5) + 1])) } })
    expect(ex.status(), await ex.text()).toBe(200)
    const g = await page.request.put('/api/csat/diagnosis/map/goal', { data: { target: 80, exam: 'kice6', clientKey: crypto.randomUUID() } })
    expect(g.status(), await g.text()).toBe(200)
    const goal = (await g.json() as { goalVersionId: number }).goalVersionId
    let version = 0
    const commit = async (reason: string) => {
      const r = await page.request.post('/api/csat/diagnosis/map/plan', { data: { template: c.ws, order: c.order, planned: {}, reason, expectedVersion: version, expectedGoalVersion: goal, clientKey: crypto.randomUUID() } })
      expect(r.status(), `계획 확정 ${reason}: ${await r.text()}`).toBe(200)
      version++
    }
    await commit('initial')

    // 중심 카드(ws-authored-*) · 보조 카드(ws-authored-support-*) 공통
    const tid = (s: string) => (c.core ? `ws-authored-${s}` : `ws-authored-support-${s}`)
    const openWs = async () => {
      await page.goto('/csat/diagnosis?tab=map&view=full', { waitUntil: 'domcontentloaded' })
      await expect(page.locator('[data-testid="unified-map"]')).toBeVisible({ timeout: 60_000 })
      const row = page.locator(`[data-testid="ws-row"][data-ws="${c.ws}"]`)
      if ((await row.getAttribute('data-kind')) === 'preparing' && !(await row.isVisible())) await page.locator('[data-testid="ws-preparing"] > summary').click()
      await row.locator('[data-testid="ws-open"]').click()
      const dialog = page.locator(`[role="dialog"][data-ws="${c.ws}"]`)
      await expect(dialog).toBeVisible()
      const overview = dialog.locator('[data-testid="ws-tab-overview"]')
      if ((await overview.getAttribute('aria-selected')) !== 'true') await overview.click()
      return c.core ? dialog.locator('[data-testid="ws-authored"]') : dialog.locator(`[data-testid="ws-authored-support"][data-task="${c.task}"]`)
    }
    const delivered = async (role: string) => ((await admin().from('workspace_content_delivery').select('artifact_ref').eq('user_id', uid).eq('role', role)).data ?? []).map((d) => d.artifact_ref).sort()
    const supply = async (role: string, n: number) => {
      const card = await openWs()
      await card.locator(`[data-testid="${c.core ? 'ws-authored-request' : 'ws-authored-support-request'}"]`).click()
      await expect.poll(async () => (await delivered(role)).length, { timeout: 30_000 }).toBe(n)
    }
    const hrefs = async (role: string, re?: RegExp) => {
      const card = await openWs()
      const links = card.locator(`[data-testid="${tid('list')}"] li[data-role="${role}"] a`)
      await expect(links.first()).toBeVisible({ timeout: 30_000 })
      return (await links.evaluateAll((as) => as.map((x) => x.getAttribute('href')!))).filter((h) => !re || re.test(h))
    }
    const act = async (runner: Locator, it: Item, right: boolean) => {
      const click = (sel: string) => runner.locator(sel).first().click()
      const gd = it.gold
      if (c.name === 'option_correspondence') {
        for (const [i, op] of (gd.options as { verdict: string; sentence: number | null }[]).entries()) {
          await click(`[data-option="${i}"][data-verdict="${op.verdict}"]`)
          if (op.sentence !== null) await runner.locator(`[data-option-sentence="${i}"]`).selectOption(String(op.sentence))
        }
        await click(`[data-choice="${right ? gd.answer : (gd.answer + 1) % 5}"]`)
      } else {
        await click(`[data-segment="${right ? gd.answer : (gd.answer + 1) % (it.body.segments as string[]).length}"]`)
        await click(`[data-reason="${gd.reason}"]`)
      }
    }
    const solve = async (href: string, right: boolean) => {
      expect(new globalThis.URL(href, 'http://x').searchParams.get('from'), '복귀 문맥').toBe('map')
      const id = href.split('/')[3].split('?')[0]
      await page.goto(href, { waitUntil: 'domcontentloaded' })
      const runner = page.locator('[data-testid="authored-runner"]')
      await expect(runner).toBeVisible({ timeout: 30_000 })
      await expect(page.locator('[data-testid="authored-result"]'), '풀기 전 결과 비노출').toHaveCount(0)
      await act(runner, item(id), right)
      await runner.getByRole('button', { name: '맞춰 보기' }).click()
      await expect(page.locator('[data-testid="authored-result"]')).toBeVisible({ timeout: 30_000 })
      await noOverflow(page)
      await page.locator('[data-testid="authored-result"] a', { hasText: '학습 지도로' }).click()
      await expect(page.locator(`[role="dialog"][data-ws="${c.ws}"]`), '같은 Workspace 팝업 복원').toBeVisible({ timeout: 60_000 })
    }
    const attempts = async () => ((await admin().from('learning_task_attempts').select('item_ref, is_correct').eq('user_id', uid).order('answered_at')).data ?? []).map((a) => [a.item_ref.replace(/^authored:/, ''), a.is_correct])

    // ① 확인 — 실제 공급 · 혼자 확인 2(서로 다른 지문) · 둘 다 오답
    await supply('independent_check', 2)
    expect(await delivered('independent_check')).toEqual([`authored:${c.prefix}-ind-1`, `authored:${c.prefix}-ind-2`])
    await noOverflow(page)
    await test.info().attach(`${c.prefix}-supplied-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
    await commit('content_change')
    for (const h of await hrefs('independent_check')) await solve(h, false)
    expect((await attempts()).every(([, ok]) => ok === false), '틀린 판단 + 맞는 이유 = 서버 채점 오답').toBe(true)
    await commit('check_result')

    // ② 바로잡기 — 서버 계획이 교수 · 안내 연습만 수요 · 안내 연습 정답(근거 아님)
    const card = await openWs()
    await card.locator(`[data-testid="${c.core ? 'ws-authored-request' : 'ws-authored-support-request'}"]`).click()
    await expect.poll(async () => (await delivered('guided_practice')).length, { timeout: 30_000 }).toBe(1)
    expect(await delivered('transfer'), '바로잡기 단계에 평가 자료 없음').toEqual([])
    await solve((await hrefs('guided_practice'))[0], true)
    await commit('check_result')

    // ③ 적용 — 서로 다른 지문 2(보충된 transfer-2 포함) 실제 공급 · 수행
    await supply('transfer', 2)
    expect(await delivered('transfer')).toEqual([`authored:${c.prefix}-transfer-1`, `authored:${c.prefix}-transfer-2`])
    for (const h of await hrefs('transfer')) await solve(h, true)
    await commit('check_result')

    // ④ 다시 확인 — 이미 본 ind-1 · 2 는 다시 납품하지 않고 미노출 새 2(ind-3 · 4)만
    await supply('independent_check', 4)
    expect(await delivered('independent_check')).toEqual([1, 2, 3, 4].map((k) => `authored:${c.prefix}-ind-${k}`))
    const pass = width === 1440
    const fresh = await hrefs('independent_check', new RegExp(`${c.prefix}-ind-[34]`))
    expect(fresh).toHaveLength(2)
    await solve(fresh[0], true)
    await solve(fresh[1], pass)

    // G2 — 독립 확인 4(처음 오답 2 + 새 2) · 적용 2 = 근거 · 안내 연습 = 근거 아님
    const evByRole = async () => { const r = (await admin().from('workspace_delivery_attempt').select('evidence, workspace_content_delivery(role)').eq('user_id', uid)).data ?? []; const n: Record<string, number> = {}; for (const b of r) if (b.evidence) { const role = (b.workspace_content_delivery as unknown as { role: string } | null)?.role ?? '?'; n[role] = (n[role] ?? 0) + 1 } return n }
    await expect.poll(evByRole, { timeout: 15_000 }).toEqual({ independent_check: 4, transfer: 2 })

    // MAP/PLAN — 같은 TASK 계획 행이 서버 계산 그대로
    await openWs()
    const dlg = page.locator(`[role="dialog"][data-ws="${c.ws}"]`)
    await dlg.locator('[data-testid="ws-tab-plan"]').click()
    const row = dlg.locator(`li[data-task="${c.task}"]`)
    if (pass) await expect(row, 'pass — 새 지문 독립 2 정답 = 해소').toHaveAttribute('data-achievement', 'resolved')
    else {
      await expect(row, 'fail — 새 바로잡기 회차(이전 안내 연습 성공 불승계)').toHaveAttribute('data-stage', 'repair')
      await expect(row).not.toHaveAttribute('data-achievement', 'resolved')
    }
    await noOverflow(page)
    await test.info().attach(`${c.prefix}-cycle-${pass ? 'pass' : 'fail'}-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

    // 그 TASK 자료 · 시도만(다른 TASK 공급 · 시도 없음)
    const all = (await admin().from('workspace_content_delivery').select('artifact_ref').eq('user_id', uid)).data ?? []
    expect(all.every((d) => d.artifact_ref.startsWith(`authored:${c.prefix}-`)), '그 TASK 자료만').toBe(true)
    expect(((await admin().from('learning_task_attempts').select('task_key').eq('user_id', uid)).data ?? []).every((x) => x.task_key === SET.taskKey)).toBe(true)
  })
}
