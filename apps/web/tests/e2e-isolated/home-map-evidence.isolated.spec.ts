// apps/web/tests/e2e-isolated/home-map-evidence.isolated.spec.ts
//
// T-0079 — 실제 Next + 격리 DB: 시험 기록 0 인 학습자가 지도에서 계획 → 자료 → 혼자 확인 1회로 직접 근거를 만든 뒤 홈(/csat)에 오면
//   「기록 없음 · 시험 기록을 넣어야」 안내가 아니라 지도의 다음 학습으로 간다(첫 제안 check · 지도에서 보기). 시험 기록은 끝까지 0.
//   진짜 첫 사용자(직접 근거 0)는 no_records 이지만 시험 기록을 필수라 하지 않는다. 정답 입력은 map-no-record-start 의 형식별 helper 와 같다.
import fs from 'node:fs'
import path from 'node:path'

import { expect, test, type Locator } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const SET_DIR = path.resolve(__dirname, '../../src/lib/knowledge/authored')
type Item = { id: string; gold: Record<string, any>; body: Record<string, any> } // eslint-disable-line @typescript-eslint/no-explicit-any
const ITEMS = new Map<string, { item: Item; format: string }>()
for (const f of fs.readdirSync(SET_DIR).filter((x) => x.endsWith('.json'))) {
  const s = JSON.parse(fs.readFileSync(path.join(SET_DIR, f), 'utf8')) as { format?: string; items: Item[] }
  for (const it of s.items) ITEMS.set(it.id, { item: it, format: s.format ?? 'central_meaning' })
}

test.beforeAll(() => {
  expect(URL, '격리 e2e 는 로컬 Supabase(127.0.0.1:54321)에서만 돈다').toMatch(/^http:\/\/(127\.0\.0\.1|localhost):54321/)
  expect(SERVICE.length).toBeGreaterThan(20)
})
const admin = () => createClient(URL, SERVICE, { auth: { persistSession: false } })

async function answerRight(runner: Locator, format: string, g: Record<string, any>, body: Record<string, any>) { // eslint-disable-line @typescript-eslint/no-explicit-any
  const click = (sel: string) => runner.locator(sel).first().click()
  switch (format) {
    case 'central_meaning':
      await click(`[data-sentence="${g.claim}"]`); await click(`[data-sentence="${g.support[0]}"]`)
      if (await runner.locator('[data-relation]').count()) await click(`[data-relation="${g.relationProbe?.relation ?? 'reason'}"]`)
      await click(`[data-choice="${g.answer}"]`); break
    case 'choice_evidence': await click(`[data-choice="${g.answer}"]`); await click(`[data-sentence="${g.decisive}"]`); break
    case 'contextual_sense': await click(`[data-choice="${g.answer}"]`); await click(`[data-sentence="${g.cue[0]}"]`); break
    case 'demand_choice': await click(`[data-choice="${g.answer}"]`); break
    case 'option_correspondence':
      for (const [i, op] of (g.options as { verdict: string; sentence: number | null }[]).entries()) {
        await click(`[data-option="${i}"][data-verdict="${op.verdict}"]`)
        if (op.sentence !== null) await runner.locator(`[data-option-sentence="${i}"]`).selectOption(String(op.sentence))
      }
      await click(`[data-choice="${g.answer}"]`); break
    case 'sentence_relation': for (const [i, p] of (g.pairs as { relation: string }[]).entries()) await click(`[data-pair="${i}"][data-pair-rel="${p.relation}"]`); break
    case 'form_scope': await click(`[data-mark="${g.answer}"]`); await click(`[data-reason="${g.reason}"]`); break
    case 'segment_choice': await click(`[data-segment="${g.answer}"]`); await click(`[data-reason="${g.reason}"]`); break
    case 'discourse_roles':
      for (const [i, r] of (g.roles as string[]).entries()) await runner.locator(`[data-role-index="${i}"]`).selectOption(r)
      await click(`[data-pattern="${g.pattern}"]`); break
    case 'equivalence': await click(`[data-same="${String(g.same)}"]`); await click(`[data-mrel="${g.relation}"]`); break
    default: throw new Error(`형식 ${format} — body ${Object.keys(body).length}`)
  }
}

for (const width of [1440, 1280]) {
  test(`T-0079 직접 확인 있는 기록 0 학습자 → 홈이 지도 다음 학습으로 · ${width}px`, async ({ page }) => {
    test.setTimeout(300_000)
    await page.setViewportSize({ width, height: 1000 })
    const email = `iso-homemap-${width}-${Date.now()}@iso-learner.test`, password = `Iso-${Math.random().toString(36).slice(2)}-Aa1`
    const made = await admin().auth.admin.createUser({ email, password, email_confirm: true })
    expect(made.error).toBeNull()
    const uid = made.data.user!.id
    await page.goto('/login', { waitUntil: 'networkidle' })
    await page.fill('input[type="email"]', email); await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]'); await page.waitForURL((x) => !x.pathname.startsWith('/login'))
    const sessions = async () => (await admin().from('csat_dx_session').select('id', { count: 'exact', head: true }).eq('user_id', uid)).count

    // 목표 없음 → 홈 첫 제안 = 목표 정하기
    await page.goto('/csat', { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-testid="home-suggest"]')).toHaveAttribute('data-kind', 'goal', { timeout: 60_000 })
    const g = await page.request.put('/api/csat/diagnosis/map/goal', { data: { target: 80, exam: 'kice6', clientKey: crypto.randomUUID() } })
    expect(g.status(), await g.text()).toBe(200)
    // 진짜 첫 사용자 — no_records 이지만 시험 기록이 필수라 하지 않는다
    await page.goto('/csat', { waitUntil: 'domcontentloaded' })
    const sug = page.locator('[data-testid="home-suggest"]')
    await expect(sug).toHaveAttribute('data-kind', 'no_records', { timeout: 60_000 })
    await expect(sug).toContainText('약점을 정한 것은 아니에요')
    await expect(sug).not.toContainText('기록을 넣으면 그려져요')

    // 지도 — 계획 확정 → (필요하면) 자료 받기 → 시작 → 혼자 확인 1회
    await page.goto('/csat/diagnosis?tab=map&view=full', { waitUntil: 'domcontentloaded' })
    let next = page.locator('[data-testid="umap-top-next"]')
    await expect(next).toHaveAttribute('data-kind', 'plan', { timeout: 60_000 })
    await next.click()
    const dlg = page.locator('[role="dialog"][data-ws]')
    await dlg.locator('[data-testid="plan-save"]').click()
    await expect(dlg.locator('[data-testid="plan-save-state"]')).toHaveAttribute('data-state', 'saved', { timeout: 30_000 })
    const ws = (await dlg.getAttribute('data-ws'))!
    await page.keyboard.press('Escape')
    for (let i = 0; i < 3; i++) {
      await page.goto('/csat/diagnosis?tab=map&view=full', { waitUntil: 'domcontentloaded' })
      next = page.locator('[data-testid="umap-top-next"]')
      await expect(next).toBeVisible({ timeout: 60_000 })
      const kind = await next.getAttribute('data-kind')
      if (kind === null) break // 실행 링크(a · data-kind 없음)
      await next.click()
      const d = page.locator(`[role="dialog"][data-ws="${ws}"]`)
      if (kind === 'supply') await d.locator('[data-testid="ws-authored-request"], [data-testid="ws-authored-support-request"]').first().click()
      else if (kind === 'plan') { await d.locator('[data-testid="plan-save"]').click(); await expect(d.locator('[data-testid="plan-save-state"]')).toHaveAttribute('data-state', 'saved', { timeout: 30_000 }) }
      await page.waitForTimeout(1000)
      await page.keyboard.press('Escape')
    }
    const start = page.locator('a[data-testid="umap-top-next"]')
    await expect(start).toBeVisible()
    await start.click()
    const runner = page.locator('[data-testid="authored-runner"]')
    await expect(runner).toBeVisible({ timeout: 30_000 })
    const id = new globalThis.URL(page.url()).pathname.split('/').pop()!
    const meta = ITEMS.get(id)!
    await answerRight(runner, meta.format, meta.item.gold, meta.item.body)
    await runner.getByRole('button', { name: '맞춰 보기' }).click()
    await expect(page.locator('[data-testid="authored-result"]')).toBeVisible({ timeout: 30_000 })
    await expect.poll(async () => ((await admin().from('workspace_delivery_attempt').select('evidence').eq('user_id', uid)).data ?? []).filter((b) => b.evidence).length, { timeout: 15_000 }).toBe(1)
    expect(await sessions(), '시험 기록 0 유지').toBe(0)

    // 홈 — 기록 없음으로 되돌리지 않는다 · 지도 다음 학습(키보드로 지도 진입)
    await page.goto('/csat', { waitUntil: 'domcontentloaded' })
    await expect(sug).not.toHaveAttribute('data-kind', 'no_records', { timeout: 60_000 })
    await expect(sug).not.toHaveAttribute('data-kind', 'error')
    await expect(sug).not.toContainText('시험 기록이 없')
    const toMap = sug.locator('a[href="#umap-h"]')
    await toMap.focus(); await page.keyboard.press('Enter')
    await expect(page.locator('[data-testid="home-map"]')).toBeVisible()
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
    await test.info().attach(`home-map-evidence-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  })
}
