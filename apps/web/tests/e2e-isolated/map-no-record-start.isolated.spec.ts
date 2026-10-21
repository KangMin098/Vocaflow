// apps/web/tests/e2e-isolated/map-no-record-start.isolated.spec.ts
//
// T-0073 — 시험 기록 없는 학습자: 목표 → 상단의 실제 다음 행동(계획 확정 → 자료 받기 → 시작) → 첫 직접 확인 1회 → G2 → 같은 Workspace 복귀
// (격리 · 실제 Next · 실제 Chromium · 공유 개발 DB 무관). 시험 기록은 끝까지 0 — 미측정 안내는 유지되고 부족 · 숙달로 올리지 않는다.
// 다음 행동의 TASK 는 서버 계산(nextActionOf)이 정한다 — 시험은 그 TASK 를 그대로 따라가고, 풀이는 창작 형식별 정답 응답(authored-format 과 같은 data-* 조작)으로 한다.
import fs from 'node:fs'
import path from 'node:path'

import { expect, test, type Locator, type Page } from '@playwright/test'
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
  test(`T-0073 시험 기록 0 → 목표 → 첫 직접 확인 → 같은 Workspace 복귀 · ${width}px`, async ({ page }) => {
    test.setTimeout(300_000)
    await page.setViewportSize({ width, height: 1000 })
    const email = `iso-norecord-${width}-${Date.now()}@iso-learner.test`, password = `Iso-${Math.random().toString(36).slice(2)}-Aa1`
    const made = await admin().auth.admin.createUser({ email, password, email_confirm: true })
    expect(made.error).toBeNull()
    const uid = made.data.user!.id
    await page.goto('/login', { waitUntil: 'networkidle' })
    await page.fill('input[type="email"]', email); await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]'); await page.waitForURL((x) => !x.pathname.startsWith('/login'))
    const g = await page.request.put('/api/csat/diagnosis/map/goal', { data: { target: 80, exam: 'kice6', clientKey: crypto.randomUUID() } })
    expect(g.status(), await g.text()).toBe(200)
    const sessions = async () => (await admin().from('csat_dx_session').select('id', { count: 'exact', head: true }).eq('user_id', uid)).count
    expect(await sessions(), '시험 기록 0').toBe(0)

    const openMap = async (p: Page) => {
      await p.goto('/csat/diagnosis?tab=map&view=full', { waitUntil: 'domcontentloaded' })
      await expect(p.locator('[data-testid="unified-map"]')).toBeVisible({ timeout: 60_000 })
      const top = p.locator('[data-testid="umap-top"]')
      await expect(top, '미측정 상태 유지').toHaveAttribute('data-state', 'no_record')
      await expect(p.locator('[data-testid="umap-no-record-note"]')).toContainText('약점으로 정한 것은 없어요')
      await expect(p.locator('[data-testid="focus-record"]'), '기출 기록은 보조 행동').toBeVisible()
      return p.locator('[data-testid="umap-top-next"]')
    }

    // ① 상단 = 저장 전 계획 확정(키보드) → 같은 Workspace 계획 탭에서 확정
    let next = await openMap(page)
    await expect(next).toHaveAttribute('data-kind', 'plan')
    const task = (await next.getAttribute('data-task'))!
    await next.focus(); await page.keyboard.press('Enter')
    const dlg = page.locator('[role="dialog"][data-ws]')
    await expect(dlg).toBeVisible({ timeout: 30_000 })
    const ws = (await dlg.getAttribute('data-ws'))!
    await expect(dlg.locator('[data-testid="plan-save"]')).toBeVisible()
    await dlg.locator('[data-testid="plan-save"]').click()
    await expect(dlg.locator('[data-testid="plan-save-state"]')).toHaveAttribute('data-state', 'saved', { timeout: 30_000 })
    await page.keyboard.press('Escape')
    expect((await admin().from('learner_workspace_plan').select('reason').eq('user_id', uid)).data?.map((r) => r.reason)).toEqual(['initial'])
    await test.info().attach(`norecord-plan-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })

    // ② 상단 = 자료 받기(실제 공급) → 같은 TASK 혼자 확인 자료가 납품됨
    next = await openMap(page)
    await expect(next).toHaveAttribute('data-task', task)
    if ((await next.getAttribute('data-kind')) === 'supply') {
      await next.click()
      const d2 = page.locator(`[role="dialog"][data-ws="${ws}"]`)
      await expect(d2).toBeVisible({ timeout: 30_000 })
      const req = d2.locator('[data-testid="ws-authored-request"], [data-testid="ws-authored-support-request"]').first()
      await req.click()
      await expect.poll(async () => ((await admin().from('workspace_content_delivery').select('id').eq('user_id', uid).eq('role', 'independent_check')).data ?? []).length, { timeout: 30_000 }).toBeGreaterThan(0)
      await page.keyboard.press('Escape')
      // 자료 · 단계가 바뀌었으면 기존 규칙대로 다시 확정(같은 묶음)
      next = await openMap(page)
      if ((await next.getAttribute('data-kind')) === 'plan') {
        await next.click()
        const d3 = page.locator(`[role="dialog"][data-ws="${ws}"]`)
        await d3.locator('[data-testid="plan-save"]').click()
        await expect(d3.locator('[data-testid="plan-save-state"]')).toHaveAttribute('data-state', 'saved', { timeout: 30_000 })
        await page.keyboard.press('Escape')
        next = await openMap(page)
      }
    }

    // ③ 상단 = 시작(실제 링크 · 같은 지도 복귀 문맥) → 혼자 확인 1회 정답 → 학습 지도로 → 같은 Workspace
    await expect(next).toHaveAttribute('data-kind', 'start')
    const href = (await next.getAttribute('href'))!
    expect(new globalThis.URL(href, 'http://x').searchParams.get('from')).toBe('map')
    await next.focus(); await page.keyboard.press('Enter')
    const runner = page.locator('[data-testid="authored-runner"]')
    await expect(runner).toBeVisible({ timeout: 30_000 })
    const id = new globalThis.URL(page.url()).pathname.split('/').pop()!
    const meta = ITEMS.get(id)!
    expect(meta, `창작 문항 ${id}`).toBeTruthy()
    await answerRight(runner, meta.format, meta.item.gold, meta.item.body)
    await runner.getByRole('button', { name: '맞춰 보기' }).click()
    await expect(page.locator('[data-testid="authored-result"]')).toBeVisible({ timeout: 30_000 })
    await page.locator('[data-testid="authored-result"] a', { hasText: '학습 지도로' }).click()
    await expect(page.locator(`[role="dialog"][data-ws="${ws}"]`), '같은 Workspace 복귀').toBeVisible({ timeout: 60_000 })

    // 직접 수행 1회만 근거(G2) · 시험 기록 0 유지 · 첫 1회로 해소/숙달을 만들지 않음
    await expect.poll(async () => ((await admin().from('workspace_delivery_attempt').select('evidence').eq('user_id', uid)).data ?? []).filter((b) => b.evidence).length, { timeout: 15_000 }).toBe(1)
    expect(await sessions(), '시험 기록은 여전히 0').toBe(0)
    await page.keyboard.press('Escape')
    await openMap(page)
    expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)
    await test.info().attach(`norecord-after-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  })
}
