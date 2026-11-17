// apps/web/tests/e2e-isolated/map-return-recap.isolated.spec.ts
//
// T-0062 — 학습 후 같은 지도로 돌아오면 TASK 정보의 「돌아온 뒤」 정리가 이번 기록 · 근거 채택 · 적용 진행 · 저장 계획과 제안을 사실대로 말한다.
// 같은 합성 학습자의 실제 경로(격리 로컬 Supabase · 실제 Next · Chromium): 기록 → 목표 → PLAN → 보조 TASK(e.task_demand) 자료 받기 →
//   혼자 확인 2 오답 → 복귀(독립 근거로 셈) → 확인 결과로 계획 다시 확정 → 바로잡기 자료 → 안내 연습 정답 → 복귀(독립 근거 아님 · 독립 근거 수 그대로) →
//   적용 단계 계획 확정 → 적용 자료(재고 1편 / 계획 2편) → 적용 1편 → 복귀(1 / 2편 — 완료 아님).
// 서버 계획 · 단계 · 채점은 브라우저에서 만들지 않는다. 1440×900 · 1280×800.
import fs from 'node:fs'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const SET = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../src/lib/knowledge/authored/e-task-demand.v1.json'), 'utf8')) as { taskKey: string; items: { id: string; role: string; gold: { answer: number } }[] }
const T = 'ws.evidence-locate', TASK = 'e.task_demand', ORDER = ['e.evidence_location', TASK]

test.beforeAll(() => {
  expect(URL, '격리 e2e 는 로컬 Supabase(127.0.0.1:54321)에서만 돈다').toMatch(/^http:\/\/(127\.0\.0\.1|localhost):54321/)
  expect(SERVICE.length).toBeGreaterThan(20)
})

const shot = async (page: Page, name: string) => test.info().attach(name, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
const admin = () => createClient(URL, SERVICE, { auth: { persistSession: false } })
const gold = (id: string) => SET.items.find((i) => i.id === id)!.gold.answer
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), '문서 가로 넘침').toBeLessThanOrEqual(1)
}
async function plan(page: Page, reason: string, expectedVersion: number, goal: number) {
  const r = await page.request.post('/api/csat/diagnosis/map/plan', { data: { template: T, order: ORDER, planned: {}, reason, expectedVersion, expectedGoalVersion: goal, clientKey: crypto.randomUUID() } })
  expect(r.status(), `계획 ${reason}: ${await r.text()}`).toBe(200)
}
async function openSupport(page: Page) {
  await page.goto('/csat/diagnosis?tab=map&view=full', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-testid="unified-map"]')).toBeVisible({ timeout: 60_000 })
  await page.locator(`[data-testid="ws-row"][data-ws="${T}"] [data-testid="ws-open"]`).click()
  return page.locator(`[data-testid="ws-authored-support"][data-task="${TASK}"]`)
}
async function supply(page: Page, uid: string, expectRole: string) {
  const card = await openSupport(page)
  await card.locator('[data-testid="ws-authored-support-request"]').click()
  await expect.poll(async () => ((await admin().from('workspace_content_delivery').select('role').eq('user_id', uid)).data ?? []).map((d) => d.role), { timeout: 30_000 }).toContain(expectRole)
  await page.reload({ waitUntil: 'domcontentloaded' })
  const again = await openSupport(page)
  await expect(again.locator(`[data-testid="ws-authored-support-list"] li[data-role="${expectRole}"]`).first()).toBeVisible({ timeout: 30_000 })
  return again
}
/** 자료를 열어 고르고 제출 → 결과 → 「학습 지도로」 복귀 → 팝업 닫고 TASK 정보의 돌아온 뒤 정리 */
/** 그 역할의 자료 링크(목록이 다 불러와진 뒤에 읽는다) */
async function hrefsOf(card: ReturnType<Page['locator']>, role: string) {
  const links = card.locator(`li[data-role="${role}"] a`)
  await expect(links.first()).toBeVisible({ timeout: 30_000 })
  return links.evaluateAll((as) => as.map((a) => a.getAttribute('href')!))
}
async function solveAndReturn(page: Page, href: string, choice: (id: string) => number) {
  expect(new globalThis.URL(href, 'http://x').searchParams.get('from'), '지도 복귀 문맥').toBe('map')
  const id = href.split('/')[3].split('?')[0]
  await page.goto(href, { waitUntil: 'domcontentloaded' })
  const runner = page.locator('[data-testid="authored-runner"]')
  await expect(runner).toBeVisible({ timeout: 30_000 })
  await runner.locator(`[data-choice="${choice(id)}"]`).first().click()
  await runner.getByRole('button', { name: '맞춰 보기' }).click()
  await expect(page.locator('[data-testid="authored-result"]')).toBeVisible({ timeout: 30_000 })
  await page.locator('[data-testid="authored-result"] a', { hasText: '학습 지도로' }).click()
  await expect(page.locator('[data-testid="unified-map"]')).toBeVisible({ timeout: 60_000 })
  // 복귀 문맥이 같은 Workspace 팝업을 복원하고, 그 맨 위에 이 TASK 의 「돌아온 뒤」 정리가 있다
  const dialog = page.locator(`[role="dialog"][data-ws="${T}"]`)
  await expect(dialog, '같은 Workspace 복원').toBeVisible({ timeout: 30_000 })
  const recap = dialog.locator('[data-testid="ws-return-summary"]')
  await expect(recap, '돌아온 뒤 정리').toBeVisible({ timeout: 30_000 })
  await expect(recap).toHaveAttribute('data-task', TASK)
  await noOverflow(page)
  const text = await recap.innerText()
  await shot(page, `return-${Date.now()}`)
  // 키보드로 닫히고 초점이 지도로 돌아온다
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  return text
}

for (const [width, height] of [[1440, 900], [1280, 800]] as const) {
  test(`돌아온 뒤 — 이번 기록 · 근거 채택 · 적용 1/2편 · 저장 계획과 제안 (${width}×${height})`, async ({ page }) => {
    test.setTimeout(420_000)
    await page.setViewportSize({ width, height })
    // 1440 = 합성 아닌 격리 계정(진짜 독립 근거 대조군) · 1280 = 명시적 합성 계정(example.com — 근거 제외 경로). 둘 다 격리 fixture 이며 학습 효과 근거가 아니다
    const genuine = width === 1440
    const email = `iso-recap-${width}-${Date.now()}@${genuine ? 'iso-learner.test' : 'example.com'}`, password = `Iso-${Math.random().toString(36).slice(2)}-Aa1`
    const made = await admin().auth.admin.createUser({ email, password, email_confirm: true })
    expect(made.error).toBeNull()
    const uid = made.data.user!.id
    await page.goto('/login', { waitUntil: 'networkidle' })
    await page.fill('input[type="email"]', email); await page.fill('input[type="password"]', password)
    await page.click('button[type="submit"]'); await page.waitForURL((x) => !x.pathname.startsWith('/login'))
    const today = new Date(Date.now() + 9 * 3600_000).toISOString().slice(0, 10)
    expect((await page.request.post('/api/csat/diagnosis/sessions', { data: { examId: 'M9901', mode: 'live', takenAt: today, clientKey: crypto.randomUUID(), choices: Object.fromEntries(Array.from({ length: 45 }, (_, i) => [i + 1, ((i + 1) % 5) + 1])) } })).status()).toBe(200)
    const g = await page.request.put('/api/csat/diagnosis/map/goal', { data: { target: 80, exam: 'kice6', clientKey: crypto.randomUUID() } })
    const goal = (await g.json() as { goalVersionId: number }).goalVersionId
    await plan(page, 'initial', 0, goal)

    // ① 혼자 확인 2 — 오답 → 복귀: 독립 근거로 셈 · 틀렸어요
    let card = await supply(page, uid, 'independent_check')
    await plan(page, 'content_change', 1, goal)
    card = await openSupport(page)
    const wrong = (id: string) => (gold(id) === 0 ? 1 : 0)
    const inds = await hrefsOf(card, 'independent_check')
    expect(inds).toHaveLength(2)
    await solveAndReturn(page, inds[0], wrong)
    const r1 = await solveAndReturn(page, inds[1], wrong)
    console.log(`RECAP_INDEPENDENT_${width}=${JSON.stringify(r1)}`)
    expect(r1, '이번 활동 = 방금 연 자료(복귀 문맥 map_item · 본인 기록 대조)').toContain('이번 활동(')
    expect(r1).toContain('틀렸어요')
    expect(r1).toContain('저장한 학습계획 v2')
    // 최근 기록의 근거 판정과 독립 근거 수 줄이 서로 맞는다(셌다고 하면서 0개라고 하지 않는다)
    if (genuine) {
      expect(r1, '진짜 독립 오답은 독립 근거로 센다').toContain('독립 근거로 셌어요')
      expect(r1).toContain('독립 근거 2개')
    } else {
      expect(r1, '합성 계정 제외는 「도움 뒤」가 아니라 합성 사유').toContain('시험 · 합성 계정 기록')
      expect(r1).not.toContain('도움 · 해설을 본 뒤')
      expect(r1).toContain('독립 근거로 센 풀이는 없어요')
    }
    const countOf = (text: string) => text.split(/\n/).find((l) => l.includes('독립 근거') && !l.startsWith('이번 활동'))
    const countLine = countOf(r1)

    // ② 확인 결과로 다시 확정 → 바로잡기 자료 → 안내 연습 정답 → 복귀: 안내 연습(독립 근거 아님) · 독립 근거 수 그대로
    await plan(page, 'check_result', 2, goal)
    card = await supply(page, uid, 'guided_practice')
    const r2 = await solveAndReturn(page, (await hrefsOf(card, 'guided_practice'))[0], gold)
    expect(r2).toContain('안내 연습')
    expect(r2).toContain('독립 근거로 세지 않아요')
    console.log(`RECAP_GUIDED_${width}=${JSON.stringify(r2)}`)
    expect(countOf(r2), '안내 연습은 독립 근거 수를 바꾸지 않는다').toBe(countLine)
    expect(r2).toContain('직전 v2')

    // T0062-F1 — 이미 푼 안내 연습을 새 답 없이 다시 열고 돌아오면, 지난 답을 「이번 활동」이라 부르지 않는다
    {
      const again = await openSupport(page)
      const guidedHref = (await hrefsOf(again, 'guided_practice'))[0]
      await page.goto(guidedHref, { waitUntil: 'domcontentloaded' })
      await expect(page.locator('[data-testid="authored-result"]'), '지난 풀이 결과').toBeVisible({ timeout: 30_000 })

      // T-0091 — 원리 정리는 제공된 설명 + 과거 노트 읽기 전용. 새 노트 작성 · 고쳐 쓰기 · 대조는 없다
      const noteForm = page.locator('[data-testid="reasoning-note"]')
      await expect(noteForm, '교수 · 안내 연습의 원리 정리').toBeVisible({ timeout: 30_000 })
      await expect(noteForm).toHaveAttribute('data-readonly', 'true')
      await expect(noteForm.locator('textarea')).toHaveCount(0)
      await expect(noteForm.locator('[data-testid="note-save"], [data-testid="note-revise"]')).toHaveCount(0)
      await noOverflow(page)
      await shot(page, `note-readonly-${width}`)
      await page.locator('[data-testid="authored-result"] a', { hasText: '학습 지도로' }).click()
      await expect(page.locator('[data-testid="unified-map"]')).toBeVisible({ timeout: 60_000 })
      const dlg = page.locator(`[role="dialog"][data-ws="${T}"]`)
      const reopen = await dlg.locator('[data-testid="ws-return-summary"]').innerText({ timeout: 30_000 })
      console.log(`RECAP_REOPEN_${width}=${JSON.stringify(reopen)}`)
      expect(reopen, '새 제출 없음 = 이번 활동 특정 안 함').toContain('이번 활동을 특정하지 못했어요')
      expect(reopen).not.toMatch(/이번 활동\(/)

      // T-0071 — 같은 TASK 의 받은 자료 카드에서 과거 원리 노트 칸(읽기 전용) 펼치기 → 유효 교수 자료로 이어 보기 → 같은 지도 복귀
      //   T-0091 이후 이 흐름에서 새 노트를 쓰지 않는다 — 기록 계보 표시는 ReasoningNoteRevision 단위 테스트가 지킨다
      const ov = dlg.locator('[data-testid="ws-tab-overview"]')
      if ((await ov.getAttribute('aria-selected')) !== 'true') await ov.click()
      const notes = dlg.locator(`[data-testid="ws-authored-support"][data-task="${TASK}"] [data-testid="ws-notes-support"]`)
      await expect(notes, '접힌 원리 노트').toBeVisible()
      await expect(notes).not.toHaveAttribute('open', '')
      await notes.locator('summary').focus(); await page.keyboard.press('Enter')
      await expect(notes.locator('textarea')).toHaveCount(0)
      const before = { binds: (await admin().from('workspace_delivery_attempt').select('attempt_id', { count: 'exact', head: true }).eq('user_id', uid)).count, plans: (await admin().from('learner_workspace_plan').select('id', { count: 'exact', head: true }).eq('user_id', uid)).count }
      await shot(page, `notes-reentry-${width}`)
      const open = notes.locator('[data-testid="ws-notes-support-open"]')
      const openHref = (await open.getAttribute('href'))!
      const oq = new globalThis.URL(openHref, 'http://x').searchParams
      expect(oq.get('from')).toBe('map'); expect(oq.get('map_task')).toBe(TASK)
      expect(oq.has('map_item') || oq.has('map_attempt'), '옛 영수증을 넘기지 않는다').toBe(false)
      await open.focus(); await page.keyboard.press('Enter')
      await expect(page.locator('[data-testid="reasoning-note"]'), '유효 교수 자료로 이동').toBeVisible({ timeout: 30_000 })
      await page.locator('[data-testid="authored-result"] a', { hasText: '학습 지도로' }).click()
      await expect(page.locator(`[role="dialog"][data-ws="${T}"]`), '같은 지도 복귀').toBeVisible({ timeout: 60_000 })
      // 노트 조회 · 이어 보기는 근거 · 계획을 바꾸지 않는다
      expect({ binds: (await admin().from('workspace_delivery_attempt').select('attempt_id', { count: 'exact', head: true }).eq('user_id', uid)).count, plans: (await admin().from('learner_workspace_plan').select('id', { count: 'exact', head: true }).eq('user_id', uid)).count }).toEqual(before)
      await page.keyboard.press('Escape')
    }

    // ③ 적용 단계 확정 → 적용 자료(재고 1편 · 계획 2편) → 적용 1편 → 복귀: 1 / 2편 — 완료 아님
    await plan(page, 'check_result', 3, goal)
    card = await supply(page, uid, 'transfer')
    const r3 = await solveAndReturn(page, (await hrefsOf(card, 'transfer'))[0], gold)
    console.log(`RECAP_TRANSFER_${width}=${JSON.stringify(r3)}`)
    // 1편 수행 뒤: 「1 / 2편 — 아직 계획만큼 하지 않았어요」 또는 근거를 못 읽었으면 「확인할 수 없어요」 — 「기록 없음」 · 「계획만큼 했어요」는 거짓
    expect(r3).toMatch(/처음 보는 지문 적용 1 \/ 2편 — 아직 계획만큼 하지 않았어요|처음 보는 지문 적용 기록을 지금 확인할 수 없어요/)
    expect(r3).not.toContain('적용한 기록은 아직 없어요')
    expect(r3).not.toContain('계획만큼 했어요')

    // 근거 결속 = 처음 독립 확인 2 뿐(안내 연습 · 적용은 독립 근거가 아니다) · 계획 이력 = 학습자 확정 4회
    // 평가 근거 결속 = 처음 독립 확인 2 + 적용 1(평가 자료) · 안내 연습은 근거 아님
    const binds = (await admin().from('workspace_delivery_attempt').select('evidence, session_id, annotation_hash, attempt_id, delivery_id, workspace_content_delivery(role)').eq('user_id', uid)).data ?? []
    const roleOf = (b: (typeof binds)[number]) => (b.workspace_content_delivery as unknown as { role: string } | null)?.role
    expect(binds.filter((b) => b.evidence).map(roleOf).sort()).toEqual(['independent_check', 'independent_check', 'transfer'])
    expect(binds.filter((b) => roleOf(b) === 'guided_practice').every((b) => !b.evidence)).toBe(true)
    // 진단 기록 — 지도가 결속된 독립 확인을 「도움 뒤」로 읽는 원인(해시 · 세션 대조) 확인용
    const atts = (await admin().from('learning_task_attempts').select('id, session_id, content_hash, help_level, activity, phase').eq('user_id', uid)).data ?? []
    console.log(`BIND_DIAG_${width}=${JSON.stringify({ binds: binds.map((b) => ({ a: b.attempt_id, ev: b.evidence, s: b.session_id, h: String(b.annotation_hash).slice(0, 12), role: roleOf(b) })), atts: atts.map((a) => ({ id: a.id, s: a.session_id, h: String(a.content_hash).slice(0, 12), help: a.help_level, act: a.activity, ph: a.phase })) })}`)
    expect((await admin().from('learner_workspace_plan').select('id', { count: 'exact', head: true }).eq('user_id', uid)).count).toBe(4)
  })
}
