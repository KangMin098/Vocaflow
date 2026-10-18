// apps/web/tests/e2e-isolated/csat-v32-mywords-sync.isolated.spec.ts
//
// FI-015(#308) 실제 브라우저 — 같은 학습자의 두 기기(별도 브라우저 컨텍스트)가 「내 말로」 노트를 저장할 때 서버 보존 · 재전송 계약.
// 실제 Next.js · 실제 /api/csat/state · 러너 안 로컬 Supabase(격리 Postgres). 공개 문항 2026#34(seed: meaning-support-isolated-seed).
//   ① 두 기기가 서로 다른 노트를 거의 동시에 저장 → 서버 · 새 기기에서 두 노트 모두
//   ② 409(다른 기기가 먼저 씀)를 받은 기기는 간격을 두고 같은 기록을 다시 보내 합친다 · 연속 409 도 성공 때까지
//   ③ 저장은 됐는데 응답 유실(502) → 재전송이 같은 노트를 중복 없이 한 번만 남긴다
//   ④ 페이지 이동 · 재진입 뒤에도 노트가 보인다(기기 + 서버)
// ⚠️ ②의 409 와 ③의 응답 유실은 **네트워크 가로채기**로 만든다 — 서버 안에서 두 요청이 「둘 다 읽은 뒤 쓰는」 순간은 브라우저에서
//   결정적으로 만들 수 없다. 그 서버 측 경합(비교 갱신이 늦은 쪽을 409 로 막는다)은 route-race.test.ts(PGlite barrier)가 본다.
//   여기서 보는 것은 실제 클라이언트 재전송 → 실제 서버 병합 → 격리 DB 보존이다.
// 보류 문항 공개 경계(GET 이 보류 문항 노트를 빼는 것)는 route-race · continuity 단위와 csat-v31 격리 spec 이 본다.
import fs from 'node:fs'
import path from 'node:path'

import { expect, test, type Browser, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
type Unit = { id: string }
const SUPPORT = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'lib', 'csat', 'meaning-support-data.json'), 'utf8')) as { items: Record<string, { units: Unit[] }> }
const UNITS = SUPPORT.items['2026#34'].units.map((u) => u.id)
const admin = () => createClient(URL_, SERVICE, { auth: { persistSession: false } })

test.beforeAll(() => {
  expect(URL_, '격리 e2e 는 로컬 Supabase(127.0.0.1:54321)에서만 돈다').toMatch(/^http:\/\/(127\.0\.0\.1|localhost):54321/)
  expect(UNITS.length, '2026#34 의미 단위 3개 이상').toBeGreaterThanOrEqual(3)
})

async function makeUser() {
  const email = `iso-mywords-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.com`
  const password = `Iso-${Math.random().toString(36).slice(2)}-Aa1`
  const { data, error } = await admin().auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  return { id: data.user.id, email, password }
}
async function device(browser: Browser, u: { email: string; password: string }, width: number): Promise<Page> {
  const ctx = await browser.newContext({ viewport: { width, height: 1000 } }) // 별도 기기: 쿠키 · IndexedDB 분리
  const page = await ctx.newPage()
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', u.email)
  await page.fill('input[type="password"]', u.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((x) => !x.pathname.startsWith('/login'))
  return page
}
async function openUnit(page: Page, unit: string) {
  await page.goto(`/csat/item/2026-34?scene=meaning&meaning=${unit}`, { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-testid="ms-explain"]')).toHaveAttribute('data-unit', unit, { timeout: 60_000 })
}
async function writeNote(page: Page, unit: string, text: string) {
  await openUnit(page, unit)
  await page.locator('[data-testid="ms-draft-open"]').click()
  await page.locator('[data-testid="ms-draft-text"]').fill(text)
  await page.locator('[data-testid="ms-draft-save"]').click()
  await expect(page.locator('[data-testid="ms-note"]')).toBeVisible({ timeout: 15_000 })
}
/** 서버(격리 DB) 사본의 노트 unitId — 실제 저장 결과 */
async function serverNotes(uid: string): Promise<string[]> {
  const r = await admin().from('csat_learner_state').select('record').eq('user_id', uid).maybeSingle()
  const notes = ((r.data as { record?: { meaningNotes?: { unitId: string }[] } } | null)?.record?.meaningNotes ?? []).map((n) => n.unitId)
  return notes.sort()
}
const noOverflow = async (page: Page) =>
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)).toBeLessThanOrEqual(1)

for (const width of [1440, 1280]) {
  test(`「내 말로」 두 기기 저장 — ${width}px`, async ({ browser }) => {
    test.setTimeout(240_000)
    const u = await makeUser()
    const a = await device(browser, u, width)
    const b = await device(browser, u, width)

    // ① 서로 다른 노트를 거의 동시에 — 두 기기 모두 같은(빈) 서버 사본에서 출발
    await Promise.all([writeNote(a, UNITS[0], '기기 A 가 쓴 내 말 설명입니다'), writeNote(b, UNITS[1], '기기 B 가 쓴 내 말 설명입니다')])
    await expect.poll(() => serverNotes(u.id), { timeout: 60_000, intervals: [1000] }).toEqual([UNITS[0], UNITS[1]].sort())
    await noOverflow(a)

    // ② 409 — B 의 다음 전송 두 번을 409 로 막는다(다른 기기가 먼저 썼다는 응답). 실제 클라이언트가 간격을 두고 다시 보내 합친다
    let blocked = 0
    const puts: number[] = []
    await b.route('**/api/csat/state', async (route) => {
      if (route.request().method() !== 'PUT') return route.continue()
      puts.push(Date.now())
      if (blocked < 2) { blocked++; return route.fulfill({ status: 409, contentType: 'application/json', body: '{"ok":false,"error":"conflict"}' }) }
      return route.continue()
    })
    await writeNote(b, UNITS[2], '기기 B 가 두 번째로 쓴 설명입니다')
    await expect.poll(() => serverNotes(u.id), { timeout: 60_000, intervals: [1000] }).toEqual([UNITS[0], UNITS[1], UNITS[2]].sort())
    expect(blocked, '연속 409 두 번').toBe(2)
    expect(puts.length, '409 두 번 + 성공 한 번').toBe(3)
    expect(puts[1] - puts[0], '첫 재전송 간격(3s 표)').toBeGreaterThanOrEqual(2500)
    await b.unroute('**/api/csat/state')

    // ③ 응답 유실 — A 의 다음 전송은 서버가 저장하지만 응답을 502 로 바꾼다 → 재전송 · 같은 노트 한 번만
    let lost = false
    await a.route('**/api/csat/state', async (route) => {
      if (route.request().method() !== 'PUT' || lost) return route.continue()
      lost = true
      await route.fetch()
      return route.fulfill({ status: 502, body: 'gateway' })
    })
    // A 는 같은 노트를 고친다(같은 unitId) — 새 노트가 아니므로 서버 노트 수는 그대로여야 한다
    await openUnit(a, UNITS[0])
    await a.locator('[data-testid="ms-revise-open"]').click()
    await a.locator('[data-testid="ms-revise-text"]').fill('기기 A 가 고친 내 말 설명입니다')
    await a.locator('[data-testid="ms-revise-change"]').fill('핵심 줄기를 더 분명하게')
    await a.locator('[data-testid="ms-revise-save"]').click()
    await expect.poll(async () => {
      const r = await admin().from('csat_learner_state').select('record').eq('user_id', u.id).maybeSingle()
      const notes = (r.data as { record?: { meaningNotes?: { unitId: string; revised?: string }[] } } | null)?.record?.meaningNotes ?? []
      return { count: notes.length, revised: notes.find((n) => n.unitId === UNITS[0])?.revised ?? null }
    }, { timeout: 60_000, intervals: [1000] }).toEqual({ count: 3, revised: '기기 A 가 고친 내 말 설명입니다' })
    expect(lost).toBe(true)
    await a.unroute('**/api/csat/state')

    // ④ 새 기기 · 페이지 이동 뒤 재진입 — 서버 노트 전체가 보인다
    const c = await device(browser, u, width)
    for (const unit of UNITS.slice(0, 3)) {
      await openUnit(c, unit)
      await expect(c.locator('[data-testid="ms-note"]'), `새 기기에서 ${unit} 노트`).toBeVisible({ timeout: 30_000 })
    }
    await b.goto('/csat', { waitUntil: 'domcontentloaded' })
    await openUnit(b, UNITS[0])
    await expect(b.locator('[data-testid="ms-note"]')).toBeVisible({ timeout: 30_000 })
    await noOverflow(c)
    await Promise.all([a.context().close(), b.context().close(), c.context().close()])
  })
}
