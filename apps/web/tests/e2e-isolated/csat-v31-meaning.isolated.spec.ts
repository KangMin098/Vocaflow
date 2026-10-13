// apps/web/tests/e2e-isolated/csat-v31-meaning.isolated.spec.ts
//
// PR 필수 e2e(격리) — v3.1 원문 이해 교수 설명의 공개 · stale fallback · 실제 보류/해제(정본 Reveal Gate ①–④ + taxonomy v0.1 복원 시드).
// 전제: CI 가 `scripts/csat/meaning-support-isolated-seed.mjs --commit`(namespace csat-v31)으로 로컬 Supabase 에
//   2026#34 = 분석 v5(배포 결속) · 2026#38 = 분석 v6(stale) · 2026#22 = 분석 v5 와 소유 학습자(iso-csat-v31-<run>)를 적재했고,
//   게이트 RPC 가 있고 taxonomy v0.1 이 봉인돼 있고 2026 보류가 없다. 학습자는 `.agent-logs/csat-v31-owner.json` 의 marker 로 찾는다.
//
//   A. 보류 없음 — embargoed_items([22,34,38]) = [] · 34 공개(ms-panel · SSR/Flight 양성 대조) · 38 stale(설명 비노출)
//   B. 실제 보류 — service_role `csat_ec_record_session_held`(정본 시그니처 · participant=true · taxonomy v0.1 · targets {} · evidence_eligible=false)
//      → 회차 2026 보류 → 세 문항 모두 item-held · SSR/Flight/화면에 교수 설명 없음
//   C. 실제 해제 — 그 학습자 JWT 로 `csat_ec_capture_open` → `csat_ec_capture_finish`(evidence_eligible=false → completed)
//      → 보류 없음 · 34 다시 공개 · 38 여전히 stale
//   정리 단언(C 끝 · afterAll): 2026 에 활성 capture(held/collecting) · 열린 묘비 없음(embargoed_exams = []) + 이 세션 capture 가 completed.
//   실패하면 playwright 가 non-zero 로 끝나 job 이 멈춘다(러너는 폐기된다 — 공유 DB 는 없다). 앱 플래그 · 가짜 RPC · 테스트 전용 API 없음.
//   이 파일은 이름순으로 map-goal 보다 먼저 돈다 — 그래서 C 의 해제와 afterAll 정리 단언이 뒤 spec 에 보류를 남기지 않음을 보장한다.
//   게이트 고장(fail-closed)은 별도 job `e2e-gate-faultclosed` 의 tests/e2e-isolated-fault 가 본다.
// 전제가 어긋나면 **실패**한다(skip 없음). 공유 개발 DB · 운영 데이터에 닿지 않는다(로컬 service_role · anon 은 로컬 데모 키).
import { randomUUID } from 'node:crypto'
import fs from 'node:fs'
import path from 'node:path'

import { expect, test, type Page } from '@playwright/test'
import { createClient } from '@supabase/supabase-js'

const URL_ = process.env.NEXT_PUBLIC_SUPABASE_URL ?? ''
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? ''
const SERVICE = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
const ITEMS = ['2026#22', '2026#34', '2026#38']
const ROUTES = ITEMS.map((id) => ({ id, slug: id.replace('#', '-') }))

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

/** seed 의 소유 marker — 이 run 의 fixture 학습자 */
function ownerLearner(): { id: string; email: string } {
  const file = path.join(__dirname, '..', '..', '..', '..', '.agent-logs', 'csat-v31-owner.json')
  const m = JSON.parse(fs.readFileSync(file, 'utf8')) as { namespace?: string; learner?: { id: string; email: string } }
  if (m.namespace !== 'csat-v31' || !m.learner?.id || !/^iso-csat-v31-[0-9]+-[0-9]+@example\.com$/.test(m.learner.email)) {
    throw new Error('seed 소유 marker 에 csat-v31 fixture 학습자가 없다')
  }
  return m.learner
}

test.describe.configure({ mode: 'serial' })

test.beforeAll(() => {
  expect(URL_, '격리 e2e 는 로컬 Supabase(127.0.0.1)에서만 돈다').toMatch(/^http:\/\/(127\.0\.0\.1|localhost):54321/)
  expect(SERVICE.length).toBeGreaterThan(20)
  expect(ANON.length).toBeGreaterThan(20)
})

const admin = () => createClient(URL_, SERVICE, { auth: { persistSession: false } })

/** 학습자 비밀번호를 이번 실행용으로 정하고(로컬 service role) 그 값을 돌려준다 — 파일에 비밀번호를 남기지 않는다 */
async function learnerPassword(learner: { id: string }) {
  const password = `Iso-${randomUUID()}-Aa1`
  const { error } = await admin().auth.admin.updateUserById(learner.id, { password })
  if (error) throw error
  return password
}
async function learnerClient(learner: { id: string; email: string }) {
  const password = await learnerPassword(learner)
  const c = createClient(URL_, ANON, { auth: { persistSession: false } })
  const { error } = await c.auth.signInWithPassword({ email: learner.email, password })
  if (error) throw error
  return c
}

async function embargoedExams() {
  const ge = await admin().rpc('csat_ec_embargoed_exams', { p_exams: ['2026'] })
  expect(ge.error, 'csat_ec_embargoed_exams 가 있어야 한다').toBeNull()
  return ge.data as string[] | null
}
async function embargoedItems() {
  const gi = await admin().rpc('csat_ec_embargoed_items', { p_items: ITEMS })
  expect(gi.error, 'csat_ec_embargoed_items 가 있어야 한다').toBeNull()
  return [...((gi.data as string[] | null) ?? [])].sort()
}
/** 2026 에 활성 capture(held/collecting) · 열린 묘비가 없다 — exam_answer_embargoed 가 두 표를 함께 본다 */
async function expectNoHold2026() {
  expect(await embargoedExams(), '2026 에 활성 보류 · 열린 묘비가 없어야 한다').toEqual([])
  expect(await embargoedItems()).toEqual([])
}

// B 가 만든 기록 — C 와 정리 단언이 쓴다
let heldSession: string | null = null

test.afterAll(async () => {
  await expectNoHold2026()
  if (heldSession) {
    const c = await learnerClient(ownerLearner())
    const st = await c.rpc('csat_ec_my_capture_state', { p_session: heldSession })
    expect(st.error).toBeNull()
    expect((st.data as { status?: string } | null)?.status, 'B 의 capture 가 끝나 있어야 한다').toBe('completed')
  }
})

async function loginAs(page: Page, email: string, password: string) {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.fill('input[type="email"]', email)
  await page.fill('input[type="password"]', password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'))
}
async function loginLearner(page: Page) {
  const l = ownerLearner()
  await loginAs(page, l.email, await learnerPassword(l))
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

/** 공개 2026#34 — ms-panel · ms-explain · SSR/Flight 양성 대조 */
async function expectPublic34(page: Page, { switchUnit }: { switchUnit: boolean }) {
  const pub = SUPPORT.items['2026#34']
  const pubDefault = pub.units.find((u) => u.id === pub.defaultUnitId) ?? pub.units[0]
  const both = await fetchBoth(page, '/csat/item/2026-34?scene=meaning')
  expect(both.html.includes(pubDefault.simpleKo), 'SSR 에 기본 의미 설명').toBe(true)
  expect(both.flight.includes(pubDefault.simpleKo), 'Flight 에 기본 의미 설명').toBe(true)
  await page.goto('/csat/item/2026-34?scene=meaning', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-testid="ms-panel"]')).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('[data-testid="ms-explain"]')).toBeVisible()
  await expect(page.locator('[data-testid="item-held"]')).toHaveCount(0)
  if (!switchUnit) return
  const current = await page.locator('[data-testid="ms-explain"]').getAttribute('data-unit')
  const other = pub.units.find((u) => u.id !== current)
  expect(other, '다른 의미 단위가 있어야 한다').toBeTruthy()
  await page.locator(`[data-testid="ms-unit"][data-unit="${other!.id}"]`).click()
  await expect(page).toHaveURL(new RegExp(`[?&]meaning=${other!.id}(&|$)`))
  await expect(page.locator('[data-testid="ms-explain"]')).toHaveAttribute('data-unit', other!.id)
}
/** stale 2026#38 — 패널 없음 · SSR/Flight 에 교수 설명 없음(기존 화면 fallback) */
async function expectStale38(page: Page) {
  const both = await fetchBoth(page, '/csat/item/2026-38?scene=meaning')
  const needles = [...distinct('2026#38'), ...MARKERS]
  expectNone(both.html, needles, 'stale SSR')
  expectNone(both.flight, needles, 'stale Flight')
  await page.goto('/csat/item/2026-38?scene=meaning', { waitUntil: 'domcontentloaded' })
  await expect(page.locator('[data-testid="scene-question"]')).toBeVisible({ timeout: 60_000 })
  await expect(page.locator('[data-testid="ms-panel"]')).toHaveCount(0)
  await expect(page.locator('[data-testid="item-held"]')).toHaveCount(0)
}

/**
 * 기출 찾기(2026-10-13) — 같은 실제 보류 · 해제 상태에서 목록 API · 열기 직전 재검증 · 서가 팝업이 관문을 따르는가.
 *   open: 목록에 2026 세 문항 · verify=open / held: 목록에서 빠지고(회차 · 유형 수도 다시 셈) verify=held · 서가 팝업 검색 0.
 *   목록 원본은 프로세스 캐시(10분)지만 보류는 요청마다 판정한다 — B 는 A 가 캐시를 채운 뒤에 돈다.
 */
async function expectFinder(page: Page, state: 'open' | 'held') {
  const list = await page.request.get('/api/csat/item-finder')
  expect(list.status(), '기출 찾기 목록').toBe(200)
  expect(list.headers()['cache-control']).toBe('private, no-store')
  const ids = ((await list.json()) as { catalog: { items: { id: string }[]; exams: { id: string }[] } }).catalog
  for (const id of ITEMS) expect(ids.items.some((i) => i.id === id), `${id} 목록(${state})`).toBe(state === 'open')
  expect(ids.exams.some((e) => e.id === '2026'), '2026 회차').toBe(state === 'open')
  const v = await page.request.get(`/api/csat/item-finder?verify=${encodeURIComponent('2026#34')}`)
  expect(v.status()).toBe(200)
  expect(((await v.json()) as { verify: string }).verify, '열기 직전 재검증').toBe(state)
  await page.goto('/csat/browse', { waitUntil: 'domcontentloaded' })
  await page.getByTestId('browse-finder-open').click()
  await expect(page.getByTestId('item-finder')).toHaveAttribute('data-state', 'ready', { timeout: 60_000 })
  await page.getByTestId('item-finder-search').fill('2026#34')
  if (state === 'open') await expect(page.locator('[data-testid="item-finder-items"] [data-item="2026#34"]')).toBeVisible()
  else await expect(page.getByTestId('item-finder-empty')).toBeVisible()
  await page.keyboard.press('Escape')
  await expect(page.getByTestId('item-finder')).toHaveCount(0)
}

test('A — 보류 없음: 2026#34 공개 · 2026#38 stale fallback', async ({ page }) => {
  await expectNoHold2026()
  await loginLearner(page)
  await expectPublic34(page, { switchUnit: true })
  await expectStale38(page)
  await expectFinder(page, 'open')
})

test('B — 실제 보류(record_session_held): 세 문항 item-held · 교수 설명 비노출', async ({ page }) => {
  const learner = ownerLearner()
  // 정본 시그니처(20261005170000): (p_session jsonb, p_responses jsonb, p_participant boolean, p_taxonomy text, p_config jsonb, p_targets smallint[], p_evidence_eligible boolean)
  //   service_role 만 EXECUTE. p_session 은 csat_dx_record_session 의 열(user_id · exam_id · mode · taken_at · client_key …),
  //   p_responses 는 문항당 한 행(저장된 응답 수 = 배열 길이 · chosen_option 일치를 함수가 검사한다). 정답 · 원문 없음(chosen_option null).
  const held = await admin().rpc('csat_ec_record_session_held', {
    p_session: { user_id: learner.id, exam_id: '2026', mode: 'live', taken_at: '2025-11-13', total_minutes: 70, entered_by: 'learner', client_key: randomUUID() },
    p_responses: ROUTES.map((r) => ({ item_no: Number(r.id.split('#')[1]), item_id: r.id, chosen_option: null, is_correct: false, confidence: 'sure' })),
    p_participant: true,
    p_taxonomy: 'v0.1',
    p_config: {},
    p_targets: [],
    p_evidence_eligible: false,
  })
  expect(held.error, 'csat_ec_record_session_held 가 성공해야 한다').toBeNull()
  const hv = held.data as { session_id?: string; held?: boolean; status?: string }
  expect(hv.held).toBe(true)
  expect(hv.status).toBe('held')
  expect(typeof hv.session_id).toBe('string')
  heldSession = hv.session_id!

  expect(await embargoedExams()).toEqual(['2026'])
  expect(await embargoedItems()).toEqual([...ITEMS].sort())

  await loginLearner(page)
  for (const r of ROUTES) {
    const url = `/csat/item/${r.slug}?scene=meaning`
    const both = await fetchBoth(page, url)
    const needles = [...distinct(r.id), ...MARKERS]
    expectNone(both.html, needles, `${r.id} SSR(보류)`)
    expectNone(both.flight, needles, `${r.id} Flight(보류)`)
    await page.goto(url, { waitUntil: 'domcontentloaded' })
    await expect(page.locator('[data-testid="item-held"]'), `${r.id} 보류 안내`).toBeVisible({ timeout: 60_000 })
    await expect(page.locator('[data-testid="ms-panel"]')).toHaveCount(0)
  }
  await expectFinder(page, 'held')
})

test('C — 학습자 해제(capture_open → capture_finish): 34 다시 공개 · 38 stale 유지 · 정리 단언', async ({ page }) => {
  expect(heldSession, 'B 의 보류 기록이 있어야 한다').toBeTruthy()
  const c = await learnerClient(ownerLearner())
  const opened = await c.rpc('csat_ec_capture_open', { p_session: heldSession })
  expect(opened.error, 'csat_ec_capture_open').toBeNull()
  expect(opened.data).toBe('collecting')
  // collecting 도 보류다
  expect(await embargoedExams()).toEqual(['2026'])
  const finished = await c.rpc('csat_ec_capture_finish', { p_session: heldSession })
  expect(finished.error, 'csat_ec_capture_finish').toBeNull()
  expect((finished.data as { status?: string } | null)?.status).toBe('completed')

  await expectNoHold2026()
  await loginLearner(page)
  await expectPublic34(page, { switchUnit: false })
  await expectStale38(page)
  await expectFinder(page, 'open')

  // 정리 단언 — 활성 capture · 열린 묘비 없음 + 이 세션 capture completed
  await expectNoHold2026()
  const st = await c.rpc('csat_ec_my_capture_state', { p_session: heldSession })
  expect(st.error).toBeNull()
  expect((st.data as { status?: string } | null)?.status).toBe('completed')
})
