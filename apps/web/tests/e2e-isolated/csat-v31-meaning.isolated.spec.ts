// apps/web/tests/e2e-isolated/csat-v31-meaning.isolated.spec.ts
//
// PR 필수 e2e(격리) — v3.1 원문 이해 교수 설명의 공개 · stale fallback (정본 Reveal Gate 마이그레이션 ①–④ 적용 DB).
// 전제: CI 가 `scripts/csat/meaning-support-isolated-seed.mjs --commit`(namespace csat-v31)으로 로컬 Supabase 에
//   2026#34 = 분석 v5(배포 결속) · 2026#38 = 분석 v6(stale) · 2026#22 = 분석 v5 를 적재했고, 게이트 RPC 가 있고 2026 보류가 없다.
//
//   A. 보류 없음 — embargoed_items([22,34,38]) = [] · 34 공개(ms-panel · ms-explain · SSR/Flight 양성 대조) · 38 stale(설명 비노출)
//   B/C(보류 시작 csat_ec_record_session_held → 학습자 capture_open/finish 해제)는 **아직 없다**: 보류 시작에 필요한 sealed taxonomy 를
//     정본 경로(마이그레이션 시드 + csat_ec_taxonomy_seal → is_admin())로 격리 DB 에 만들 수 없다(is_admin 정의 20260706010000 이
//     known-migration-failure). 우회(superuser 직접 UPDATE · 가짜 RPC)는 금지라 멈췄다 — 결정되면 여기에 B/C 를 더한다.
//   게이트 고장(fail-closed)은 별도 job `e2e-gate-faultclosed` 의 tests/e2e-isolated-fault 가 본다.
//   정리 단언(afterAll): 2026 에 활성 보류 · 열린 묘비가 없다(embargoed_exams). 실패하면 playwright 가 non-zero 로 끝나 job 이 멈춘다
//   (러너는 폐기된다 — 공유 DB 는 없다).
// 전제가 어긋나면 **실패**한다(skip 없음). 공유 개발 DB · 운영 데이터에 닿지 않는다(로컬 service_role 은 로컬 데모 키).
import fs from 'node:fs'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''

type Unit = { id: string; simpleKo: string; exactKo: string }
const SUPPORT = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'src', 'lib', 'csat', 'meaning-support-data.json'), 'utf8')) as {
  items: Record<string, { defaultUnitId: string; units: Unit[] }>
}
const distinct = (id: string): string[] => {
  const s = SUPPORT.items[id]
  if (!s) throw new Error(`배포 교수 설명 없음: ${id}`)
  const out = s.units.flatMap((u) => [u.simpleKo, u.exactKo]).filter((x) => typeof x === 'string' && x.length >= 12)
  if (out.length === 0) throw new Error(`식별 문장 없음: ${id}`)
  return out
}
const MARKERS = ['meaning-support', 'contentHash']

test.describe.configure({ mode: 'serial' })

test.beforeAll(() => {
  expect(URL_, '격리 e2e 는 로컬 Supabase(127.0.0.1)에서만 돈다').toMatch(/^http:\/\/(127\.0\.0\.1|localhost):54321/)
  expect(SERVICE.length).toBeGreaterThan(20)
})

const admin = () => createClient(URL_, SERVICE, { auth: { persistSession: false } })

/** 2026 회차에 활성 보류(capture held/collecting) · 열린 묘비가 없다 — 정본 RPC 로 */
async function expectNoHold2026() {
  const ge = await admin().rpc('csat_ec_embargoed_exams', { p_exams: ['2026'] })
  expect(ge.error, 'csat_ec_embargoed_exams 가 있어야 한다').toBeNull()
  expect(ge.data ?? null, '2026 에 활성 보류 · 열린 묘비가 없어야 한다').toEqual([])
}

test.afterAll(async () => {
  await expectNoHold2026()
})

async function login(page: Page) {
  const email = `iso-ms-${Date.now()}@example.com`
  const password = `Iso-${Math.random().toString(36).slice(2)}-Aa1`
  const { error } = await admin().auth.admin.createUser({ email, password, email_confirm: true })
  if (error) throw error
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'))
}

async function fetchBoth(page: Page, url: string) {
  const html = await page.request.get(url)
  expect(html.status(), `${url} SSR 은 404 가 아니어야 한다`).toBe(200)
  const flight = await page.request.get(url, { headers: { RSC: '1' } })
  expect(flight.status(), `${url} Flight`).toBe(200)
  return { html: await html.text(), flight: await flight.text() }
}
function expectNone(body: string, needles: string[], where: string) {
  for (const n of needles) expect(body.includes(n), `${where} 에 「${n.slice(0, 24)}…」 가 없어야 한다`).toBe(false)
}

test('A — 보류 없음: 2026#34 공개 · 2026#38 stale fallback', async ({ page }) => {
  const gi = await admin().rpc('csat_ec_embargoed_items', { p_items: ['2026#22', '2026#34', '2026#38'] })
  expect(gi.error, '게이트 RPC(csat_ec_embargoed_items)가 있어야 한다').toBeNull()
  expect(gi.data ?? null).toEqual([])
  await expectNoHold2026()

  await login(page)

  // 공개 — 양성 대조(SSR · Flight 에 기본 의미 설명)
  const pub = SUPPORT.items['2026#34']
  const pubDefault = pub.units.find((u) => u.id === pub.defaultUnitId) ?? pub.units[0]
  const pubBoth = await fetchBoth(page, '/csat/item/2026-34?scene=meaning')
  expect(pubBoth.html.includes(pubDefault.simpleKo), 'SSR 에 기본 의미 설명').toBe(true)
  expect(pubBoth.flight.includes(pubDefault.simpleKo), 'Flight 에 기본 의미 설명').toBe(true)

  await page.goto('/csat/item/2026-34?scene=meaning', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-testid="ms-panel"]')).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('[data-testid="ms-explain"]')).toBeVisible()
  await expect(page.locator('[data-testid="item-held"]')).toHaveCount(0)
  const current = await page.locator('[data-testid="ms-explain"]').getAttribute('data-unit')
  const other = pub.units.find((u) => u.id !== current)
  expect(other, '다른 의미 단위가 있어야 한다').toBeTruthy()
  await page.locator(`[data-testid="ms-unit"][data-unit="${other!.id}"]`).click()
  await expect(page).toHaveURL(new RegExp(`[?&]meaning=${other!.id}(&|$)`))
  await expect(page.locator('[data-testid="ms-explain"]')).toHaveAttribute('data-unit', other!.id)

  // stale — 분석 v6 ≠ 결속 v5: 패널 없음 · SSR/Flight 에 교수 설명 없음(기존 화면으로 fallback)
  const staleBoth = await fetchBoth(page, '/csat/item/2026-38?scene=meaning')
  const needles = [...distinct('2026#38'), ...MARKERS]
  expectNone(staleBoth.html, needles, 'stale SSR')
  expectNone(staleBoth.flight, needles, 'stale Flight')
  await page.goto('/csat/item/2026-38?scene=meaning', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-testid="scene-question"]')).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('[data-testid="ms-panel"]')).toHaveCount(0)
  await expect(page.locator('[data-testid="item-held"]')).toHaveCount(0)
})
