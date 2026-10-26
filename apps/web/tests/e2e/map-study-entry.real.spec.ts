// apps/web/tests/e2e/map-study-entry.real.spec.ts
//
// T-0159 실계정(개발 DB 합성 학습자) 브라우저 검증 — 사용자 승인 2026-10-25 (b).
// 합성 도메인(vocaflow.dev) 계정 1명을 정상 가입 경로로 만들고, 앱이 정상적으로 남기는 최소 기록(목표 · 정답 공개 노출 1건)만 생긴다.
// 자격정보는 Git 밖: H_EMAIL · H_PASSWORD 환경 변수. 같은 지문 보호 · 노출 판정은 우회하지 않는다(모의 응답은 「서버 오류」 장면 하나뿐).
import { expect, test, type Page } from '@playwright/test'

const EMAIL = process.env.H_EMAIL ?? ''
const PASSWORD = process.env.H_PASSWORD ?? ''
const WS = 'ws.central-meaning'
const TASK = 'r.central_meaning'

test.describe.configure({ mode: 'serial' })
test.beforeAll(() => {
  expect(EMAIL, '합성 계정만').toMatch(/@vocaflow\.dev$/)
  expect(PASSWORD.length).toBeGreaterThan(11)
})

async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), '문서 가로 넘침').toBeLessThanOrEqual(1)
}
async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'networkidle', timeout: 240_000 })
  await page.fill('input[type="email"]', EMAIL); await page.fill('input[type="password"]', PASSWORD)
  await page.click('button[type="submit"]'); await page.waitForURL((x) => !x.pathname.startsWith('/login'), { timeout: 60_000 })
}
async function openStudy(page: Page) {
  await page.goto('/csat/diagnosis?tab=map&view=full', { waitUntil: 'domcontentloaded', timeout: 240_000 })
  await expect(page.locator('[data-testid="unified-map"]')).toBeVisible({ timeout: 120_000 })
  await page.locator(`[data-testid="ws-row"][data-ws="${WS}"] [data-testid="ws-open"]`).click()
  const dialog = page.locator(`[role="dialog"][data-ws="${WS}"]`)
  await dialog.locator('[data-testid="detail-tab-evidence"]').click()
  const study = dialog.locator('[data-testid="inspector-study"]')
  await expect(study).toBeVisible({ timeout: 60_000 })
  return { dialog, study }
}

test('가입 — 정상 경로 · 합성 도메인 1명', async ({ page }) => {
  test.skip(process.env.H_SIGNED_UP === '1', '이미 만든 합성 계정을 다시 쓴다(1명만)')
  test.setTimeout(180_000)
  await page.goto('/signup', { waitUntil: 'networkidle', timeout: 240_000 })
  await page.getByPlaceholder('홍길동').fill('합성학습자 H0159')
  await page.fill('input[type="email"]', EMAIL)
  for (const p of await page.locator('input[type="password"]').all()) await p.fill(PASSWORD)
  // 필수 동의만(이용약관 · 개인정보) — 시각용 상자가 입력을 덮어 입력 자체를 체크한다. 선택 동의(마케팅)는 하지 않는다
  for (const name of [/이용약관\s*에 동의/, /개인정보 처리방침\s*에 동의/]) {
    const box = page.getByRole('checkbox', { name })
    if (!(await box.isChecked())) await box.check({ force: true })
  }
  await page.click('button[type="submit"]')
  await page.waitForURL((x) => !x.pathname.startsWith('/signup'), { timeout: 60_000 })
  expect(new URL(page.url()).pathname, '메일 인증 대기가 아니라 바로 로그인').not.toBe('/verify-email')
})

test('목표 설정(앱 API) — 목표 관련 사실 표시의 전제', async ({ page }) => {
  test.setTimeout(300_000)
  await login(page)
  const r = await page.request.put('/api/csat/diagnosis/map/goal', { data: { target: 80, clientKey: crypto.randomUUID() }, timeout: 180_000 })
  expect(r.status(), await r.text()).toBe(200)
})

for (const [width, height] of [[1440, 900], [1280, 800]] as const) {
  test(`지도 기출 목록 — 새 코드 · 이유 · 목표 사실 · 보호 · 복귀 문맥 · 포커스 ${width}×${height}`, async ({ page }) => {
    test.setTimeout(300_000)
    await page.setViewportSize({ width, height })
    await login(page)
    const { study } = await openStudy(page)
    // 새 코드 표지 — 이 testid 들은 T-0159 코드에만 있다(서버가 검증 SHA 의 코드를 제공하는지)
    await expect(study.locator('[data-testid="inspector-study-goal"]')).toHaveAttribute('data-goal', 'linked')
    await expect(study.locator('[data-testid="inspector-study-goal"]')).toContainText('점수 상승을 약속하지는 않아요')
    await expect(study.locator('[data-testid="inspector-study-withheld"]')).toContainText('같은 지문')
    const links = study.locator('[data-testid="inspector-study-link"]')
    const hrefs = await links.evaluateAll((as) => as.map((a) => (a as HTMLAnchorElement).getAttribute('href') ?? ''))
    test.info().annotations.push({ type: 'study-links', description: hrefs.join(' ') || '(none)' })
    // 보호 — 지도 어디든 확인 링크(check=1) 대상 문항이 기출 해설 목록에 없다
    const confirmPaths = await page.evaluate(() => [...document.querySelectorAll('a[href*="check=1"]')].map((a) => new URL((a as HTMLAnchorElement).href).pathname))
    for (const h of hrefs) {
      expect(h).toContain('from=map'); expect(h).toContain(`map_task=${TASK}`); expect(h).toContain('map_goal=')
      expect(confirmPaths).not.toContain(new URL(h, 'http://x').pathname)
    }
    if (hrefs.length) {
      await expect(study.locator('[data-testid="inspector-study-why"]').first()).toContainText('판단 능력')
      await expect(study.locator('[data-testid="inspector-study-meaning"]')).toContainText('혼자 판단한 기록으로는 세지 않아요')
      // 키보드 포커스 — 첫 링크에 초점이 가고 보인다
      // 실제 키보드 이동으로 초점을 준다(:focus-visible 은 프로그램 focus() 로는 켜지지 않는다)
      await links.first().focus(); await page.keyboard.press('Shift+Tab'); await page.keyboard.press('Tab')
      await expect(links.first()).toBeFocused()
      const outline = await links.first().evaluate((el) => { const s = getComputedStyle(el); return `${s.outlineStyle}|${s.boxShadow}` })
      expect(outline, '보이는 포커스 표시').not.toBe('none|none')
      // 포커스 외곽선(2px + 간격 2px)이 아래 추천 이유 첫 줄을 가리지 않는다(1440 실화면 겹침 회귀)
      const linkBox = await links.first().boundingBox()
      const whyBox = await study.locator('[data-testid="inspector-study-why"]').first().boundingBox()
      expect(whyBox!.y, '추천 이유가 포커스 외곽선 아래에 있다').toBeGreaterThanOrEqual(linkBox!.y + linkBox!.height + 4)
    }
    await noOverflow(page)
    await test.info().attach(`map-study-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  })
}

for (const width of [1280, 1440] as const) test(`왕복 · map_av · 목표 변경 알림 · 재로그인 — ${width}`, async ({ page, context }) => {
  test.setTimeout(420_000)
  await page.setViewportSize({ width, height: 900 })
  await login(page)
  const { study } = await openStudy(page)
  const first = study.locator('[data-testid="inspector-study-link"]').first()
  test.skip((await first.count()) === 0, '열 수 있는 연구 사례 없음 — 왕복 NOT_RUN')
  await first.click()
  await page.waitForURL(/\/csat\/item\//, { timeout: 240_000 }) // 콜드 서버 첫 문항 화면 컴파일
  const back = page.locator('[data-testid="item-back-map"]')
  await expect(back).toBeVisible({ timeout: 120_000 })
  const backHref = (await back.getAttribute('href')) ?? ''
  expect(backHref).toContain(`map_task=${TASK}`); expect(backHref).toContain('map_goal=')
  // T-0167 — 지도 링크가 map_av 를 실었으면 「학습 지도로」 가 같은 값을 싣는다. 지도가 아직 싣지 않는 경우를 위해
  //   같은 문항 주소에 map_av 를 실어 다시 연다(지도에서 판본을 싣고 들어온 경우). 형식 밖 값은 버린다
  const itemUrl = new URL(page.url())
  const linkAv = itemUrl.searchParams.get('map_av')
  test.info().annotations.push({ type: 'study-link-map_av', description: linkAv ?? '(지도 링크에 없음)' })
  // T-0186 — 지도 링크를 그대로 눌러 들어왔다: 링크가 결속 분석 판본(1 이상 정수)을 싣고, 「학습 지도로」 가 같은 값을 싣는다
  expect(linkAv, '지도 링크가 결속 분석 판본 map_av 를 싣는다').toMatch(/^[1-9][0-9]{0,8}$/)
  expect(new URL(backHref, 'http://x').searchParams.getAll('map_av'), '지도 링크의 map_av 를 그대로').toEqual([linkAv])
  for (const [given, want] of [['7', '7'], ['0', null], ['12x', null], ['1234567890', null]] as const) {
    const u = new URL(itemUrl); u.searchParams.set('map_av', given)
    await page.goto(u.pathname + u.search, { waitUntil: 'domcontentloaded', timeout: 240_000 })
    await expect(back).toBeVisible({ timeout: 120_000 })
    const h = new URL((await back.getAttribute('href')) ?? '', 'http://x')
    expect(h.searchParams.getAll('map_av'), `map_av=${given}`).toEqual(want ? [want] : [])
    // 기존 복귀 문맥은 그대로
    expect(h.searchParams.get('map_task')).toBe(TASK); expect(h.searchParams.get('map_goal')).toBe(new URL(backHref, 'http://x').searchParams.get('map_goal'))
    for (const k of ['map_ws', 'map_plan', 'step', 'ws', 'task']) expect(h.searchParams.get(k), k).toBe(new URL(backHref, 'http://x').searchParams.get(k))
  }
  await back.scrollIntoViewIfNeeded(); await back.focus()
  await page.screenshot({ path: test.info().outputPath(`item-back-map-${width}.png`) })
  await test.info().attach(`item-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  // 떠난 뒤 목표 변경 → 돌아오면 「목표가 바뀌었어요」
  const r = await page.request.put('/api/csat/diagnosis/map/goal', { data: { target: 85, clientKey: crypto.randomUUID() }, timeout: 180_000 })
  expect(r.status(), await r.text()).toBe(200)
  await back.click()
  await expect(page.locator('[data-testid="unified-map"]')).toBeVisible({ timeout: 120_000 })
  await expect(page.getByText('떠난 뒤 목표가 바뀌었어요').first()).toBeVisible({ timeout: 60_000 })
  await test.info().attach(`return-goal-changed-${width}`, { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  // 재로그인 — 쿠키를 지우고 다시 로그인해도 같은 지도 · 목록
  await context.clearCookies()
  await login(page)
  await openStudy(page)
})

test('정답 공개 — 서버 오류(503 모의)면 정답 · 결정적 근거 없음, 실제 요청은 200 · 노출 기록(P6) 결속 뒤 공개 — 1280', async ({ page }) => {
  test.setTimeout(300_000)
  await page.setViewportSize({ width: 1280, height: 800 })
  await login(page)
  await page.goto('/csat/item/2015-32?scene=judgment', { waitUntil: 'domcontentloaded', timeout: 240_000 })
  const reveal = page.getByTestId('judgment-reveal')
  await expect(reveal).toBeVisible({ timeout: 120_000 })
  const answerBlock = page.locator('[data-block="analysis:answer"]')
  const evidenceChips = page.locator('[role="group"][aria-label="근거 고르기"] > *')
  // 공개 전 — 정답 근거 블록 · 근거 칩이 화면에 없다
  await expect(answerBlock).toHaveCount(0)
  await expect(evidenceChips).toHaveCount(0)
  let fail = true
  let mocked = 0
  await page.route('**/api/csat/item/*/judgment', (route) => (fail ? (mocked++, route.fulfill({ status: 503, contentType: 'application/json', body: JSON.stringify({ ok: false, error: '지금은 정답을 열 수 없어요' }) })) : route.continue()))
  // 콜드 개발 서버는 하이드레이션 전 클릭을 버린다 — 요청이 실제로 나갈 때까지만 다시 누른다(응답 · 판정은 건드리지 않는다)
  await expect.poll(async () => { if (mocked === 0) await reveal.getByRole('button', { name: '정답 보기' }).click(); return mocked }, { timeout: 120_000, intervals: [3_000] }).toBeGreaterThan(0)
  expect(mocked, '503 장면은 요청 1회').toBe(1)
  // 503 — 실패 안내 · 정답 근거 블록 0 · 근거 칩 0 · 다시 누를 수 있다
  await expect(page.getByTestId('answer-reveal-failed').first()).toBeVisible({ timeout: 60_000 })
  await expect(answerBlock).toHaveCount(0)
  await expect(evidenceChips).toHaveCount(0)
  await expect(reveal.getByRole('button', { name: '정답 보기' }), '실패 뒤 다시 누를 수 있다').toBeEnabled()
  await test.info().attach('reveal-503-1280', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  // 실제 요청 — 정확히 200 · ok · exposureId, 그 뒤에만 정답 근거가 그려진다
  fail = false
  const res = page.waitForResponse((r) => /\/api\/csat\/item\/.+\/judgment$/.test(new URL(r.url()).pathname) && r.request().method() === 'POST', { timeout: 180_000 })
  await reveal.getByRole('button', { name: '정답 보기' }).click()
  const real = await res
  expect(real.status(), await real.text()).toBe(200)
  const body = await real.json() as { ok?: boolean; exposureId?: number | string; reveal?: unknown }
  expect(body.ok).toBe(true)
  expect(body.exposureId, '노출 원장 행 id').toBeTruthy()
  expect(body.reveal, '공개 자료').toBeTruthy()
  await expect(answerBlock.first()).toBeVisible({ timeout: 60_000 })
  await test.info().attach('reveal-real-1280', { body: await page.screenshot({ fullPage: true }), contentType: 'image/png' })
  // P6 결속 — 응답의 exposureId 행이 이 합성 계정 · 이 문항 · 정답 직접 노출 · 판단 장면 · 합성 표지인가(서버 키로 읽기만)
  const SB = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '', KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? ''
  expect(SB).toMatch(/jajenrevcbmrpaliomxv/)
  const q = await fetch(`${SB}/rest/v1/learning_exposures?id=eq.${body.exposureId}&select=user_id,item_ref,kind,source,synthetic,received_at`, { headers: { apikey: KEY, authorization: `Bearer ${KEY}` } })
  expect(q.status).toBe(200)
  const rows = await q.json() as { user_id: string; item_ref: string; kind: string; source: string; synthetic: boolean; received_at: string }[]
  expect(rows).toHaveLength(1)
  const u = await fetch(`${SB}/auth/v1/admin/users/${rows[0].user_id}`, { headers: { apikey: KEY, authorization: `Bearer ${KEY}` } })
  expect((await u.json() as { email?: string }).email).toBe(EMAIL)
  expect(rows[0]).toMatchObject({ item_ref: '2015#32', kind: 'answer_direct', source: 'judgment_scene', synthetic: true })
})
