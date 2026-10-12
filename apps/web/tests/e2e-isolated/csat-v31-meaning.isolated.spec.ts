// apps/web/tests/e2e-isolated/csat-v31-meaning.isolated.spec.ts
//
// PR 필수 e2e(격리) — v3.1 원문 이해 교수 설명이 **접근 gate 가 닫힌 문항**에서 SSR/Flight/화면 어디에도 새지 않는지.
//
// ⚠️ 공개 · stale 격리 케이스는 지금 막혀 있다: 이 저장소 migrations 에 Reveal Gate(csat_ec_embargoed_items/exams)가 없다
//    (feat/ec-pilot-gate 의 20261005170000 미병합 — 적용은 DB 변경이라 별도 사용자 결정). RPC 가 없으면 canRevealItem 이
//    fail-closed 로 모든 문항을 held 로 본다. 그래서 이 spec 은 그 상태(세 문항 모두 item-held · 교수 설명 비노출)를 단언한다.
//    Reveal Gate 가 들어오면 이 spec 을 공개(2026#34 · 분석 v5) / stale(2026#38 · 분석 v6) / 보류 케이스로 갱신해야 한다 —
//    seed(`scripts/csat/meaning-support-isolated-seed.mjs --commit`)가 RPC 출현을 감지하면 실패해 그 시점을 크게 알린다.
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
/** 그 문항 교수 설명의 식별 가능한 한국어 문장들(쉬운 말 · 정확한 뜻) */
const distinct = (id: string): string[] => {
  const s = SUPPORT.items[id]
  if (!s) throw new Error(`배포 교수 설명 없음: ${id}`)
  const out = s.units.flatMap((u) => [u.simpleKo, u.exactKo]).filter((x) => typeof x === 'string' && x.length >= 12)
  if (out.length === 0) throw new Error(`식별 문장 없음: ${id}`)
  return out
}
const MARKERS = ['meaning-support', 'contentHash']
const ROUTES = [
  { id: '2026#34', slug: '2026-34' },
  { id: '2026#38', slug: '2026-38' },
  { id: '2026#22', slug: '2026-22' },
]

test.beforeAll(() => {
  expect(URL_, '격리 e2e 는 로컬 Supabase(127.0.0.1)에서만 돈다').toMatch(/^http:\/\/(127\.0\.0\.1|localhost):54321/)
  expect(SERVICE.length).toBeGreaterThan(20)
})

const admin = () => createClient(URL_, SERVICE, { auth: { persistSession: false } })

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

/** SSR HTML + Flight(RSC: 1) — 같은 세션 쿠키로 같은 주소. 둘 다 200 이어야 한다(notFound · 오류는 실패) */
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

test('v3.1 원문 이해 — Reveal Gate 부재(fail-closed) · 세 문항 보류 · 교수 설명 비노출(격리 DB)', async ({ page }) => {
  // 전제(크게): Reveal Gate RPC 가 없다 → canRevealItem fail-closed. 생겼으면 이 spec 을 공개/stale 케이스로 갱신해야 한다
  const gi = await admin().rpc('csat_ec_embargoed_items', { p_items: ROUTES.map((r) => r.id) })
  expect(gi.error, 'Reveal Gate 가 격리 DB 에 생겼다 — 이 spec 을 공개/stale 케이스로 갱신해야 한다').not.toBeNull()
  expect(`${gi.error?.code ?? ''} ${gi.error?.message ?? ''}`, 'RPC 부재 오류여야 한다(다른 오류는 전제 실패)').toMatch(/PGRST202|42883|does not exist|Could not find the function|schema cache/i)

  await login(page)

  for (const r of ROUTES) {
    const url = `/csat/item/${r.slug}?scene=meaning`
    const both = await fetchBoth(page, url)
    const needles = [...distinct(r.id), ...MARKERS]
    expectNone(both.html, needles, `${r.id} SSR`)
    expectNone(both.flight, needles, `${r.id} Flight`)

    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-testid="item-held"]'), `${r.id} 보류 안내`).toBeVisible({ timeout: 60_000 })
    await expect(page.locator('[data-testid="ms-panel"]')).toHaveCount(0)
    await expect(page.locator('[data-testid="map-sentence-pick"]')).toHaveCount(0)
  }
})
