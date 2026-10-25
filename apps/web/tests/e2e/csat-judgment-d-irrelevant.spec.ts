// apps/web/tests/e2e/csat-judgment-d-irrelevant.spec.ts
//
// **T-0161 D 판단 도구 R-IRRELEVANT 첫 제품 연결** — 실제 로그인 화면 · 실제 서버 · 개발 DB · PC 1280 · 1440.
// 수용 기준(T-0161 acceptance 0~6):
//   A0 결속 문항 페이지에 원문 + TypeJudgment 도구 · 도구 판본 = G 현재 결속 판본(published 1 · units 결속)
//   A1 문항 이동 · 늦은 응답 — 이전 판단 · 해설이 새 문항에 남지 않고, 늦게 온 응답은 버려진다
//   A2 공개 전 첫 HTML · RSC · (판본 불일치) API 응답에 정답 번호 · verdict · 정답 위치 · 해설 없음
//   A3 해설은 판단 라우트의 노출 원장 커밋 성공(200 · exposureId) 뒤에만 · 기록 실패(503) · 보류(423) · 판본 불일치(409) 시 미공개
//   A4 원문 · 도구 · 장면 왕복에서 학습자 선택 · 스크롤 유지, 키보드만으로 공개 · 근거 링크 · 포커스 유지
//   A5 수능 · 모평 미결속 · R-GRAMMAR · 다중 정답 문항에는 도구 없음
//   A6 위 항목을 1280 · 1440 실계정 브라우저로
//
// 대상 문항 선정(MCP SELECT, 2026-10-25): R-IRRELEVANT · body_ok · 단일 정답 · published 1판 ·
//   최신 published 의 (units_version, units_hash) = csat_current_units_many 결과 → H1803G2#35(정답 ③) · H1803G3#35(정답 ④)
// 세션: playwright-auth/.auth-csat-lecture-control.json (T-0152 합성 계정)

import fs from 'node:fs'

import { expect, test, type Page } from '@playwright/test'

const STATE_PATH = 'playwright-auth/.auth-csat-lecture-control.json'
const A = { slug: 'H1803G2-35', id: 'H1803G2#35', answer: 3 }
const B = { slug: 'H1803G3-35', id: 'H1803G3#35', answer: 4 }
// 공개 자료(해설) 조각 — 개발 DB 실측. 공개 전 응답에 있으면 누출
const SECRET: Record<string, string[]> = {
  [A.id]: ['은 저장 시 대기 조절이 중요하다는 화제다', 'carbon dioxide 를 저장 조절 대상으로 들여오자', '는 이산화탄소가 pollutant 로 여겨진다는 환경 관점이다'],
  [B.id]: ['은 독서를 관점 취하기의 기술로 규정하고', '는 Reading is 로 시작해'],
}
const LEAK = /"verdict"\s*:\s*"correct"|"why_correct"|"answerLocus"|"answer_locus"|"design_intent"|"how_to_reject"/
// 도구가 없어야 하는 문항: 수능(단위 결속 0) · 모평(단위 결속 0) · R-GRAMMAR(isolated) · 다중 정답(2015#25 도표 ④⑤)
const NO_TOOL = ['2025-35', 'M2506-35', 'H1803G1-29', '2015-25']

const tool = (page: Page) => page.getByTestId('judgment-tool-d')

async function openJudgment(page: Page, slug: string) {
  await page.goto(`/csat/item/${slug}?scene=judgment`, { waitUntil: 'domcontentloaded', timeout: 180_000 })
  await expect(page.getByTestId('analysis-theater')).toBeVisible({ timeout: 120_000 })
}

test.describe('D 판단 도구 R-IRRELEVANT × 해설 화면', () => {
  test.use({ storageState: STATE_PATH })
  test.beforeAll(() => {
    if (!fs.existsSync(STATE_PATH)) throw new Error('세션 파일이 없다 — 실계정 E2E 는 합성 계정 세션이 필요하다')
  })

  for (const width of [1280, 1440]) {
    test(`A0~A6 ${width}px`, async ({ page }) => {
      test.setTimeout(420_000)
      await page.setViewportSize({ width, height: 900 })
      const consoleErrors: string[] = []
      page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
      page.on('pageerror', (e) => consoleErrors.push(String(e)))
      const posts: { status: number; body: Record<string, unknown> | null }[] = []
      const bad: string[] = []
      page.on('response', (r) => { if (r.status() >= 400) bad.push(`${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`) })
      page.on('response', async (r) => {
        if (!r.url().includes('/judgment') || r.request().method() !== 'POST') return
        posts.push({ status: r.status(), body: (await r.json().catch(() => null)) as Record<string, unknown> | null })
      })

      // ── A2 · 첫 HTML · RSC (인증 세션) ──
      for (const it of [A, B]) {
        const res = await page.request.get(`/csat/item/${it.slug}?scene=judgment`, { timeout: 180_000 })
        expect(res.status(), '첫 응답 200(로그인 우회 금지)').toBe(200)
        const html = await res.text()
        expect(html).toContain('analysis-theater')
        expect(html, '도구가 첫 응답에 있어야 한다').toContain('judgment-tool-d')
        const rsc = await (await page.request.get(`/csat/item/${it.slug}?scene=judgment`, { headers: { RSC: '1' }, timeout: 180_000 })).text()
        for (const body of [html, rsc]) {
          expect(body, `${it.id} 첫 응답에 정답 자료 키`).not.toMatch(LEAK)
          for (const t of SECRET[it.id]) expect(body, `${it.id} 첫 응답에 해설 「${t}」`).not.toContain(t)
        }
      }
      // A2 · A3 — 판본 불일치 API: 409 · 원장 없음 · 정답 자료 없음
      const mism = await page.request.post(`/api/csat/item/${A.slug}/judgment`, { data: { analysisVersion: 99, clientExposureId: crypto.randomUUID(), source: 'judgment_scene' } })
      expect(mism.status()).toBe(409)
      const mismText = await mism.text()
      expect(mismText).not.toMatch(/"judgment"|"reveal"|"answer"/)
      for (const t of SECRET[A.id]) expect(mismText).not.toContain(t)
      // 비로그인 API: 401 · 정답 자료 없음
      const anon = await page.context().browser()!.newContext({ storageState: { cookies: [], origins: [] } })
      const anonRes = await anon.request.post(`${test.info().project.use.baseURL ?? process.env.PLAYWRIGHT_BASE_URL}/api/csat/item/${A.slug}/judgment`, { data: { analysisVersion: 1, clientExposureId: crypto.randomUUID(), source: 'judgment_scene' }, maxRedirects: 0 })
      // 미들웨어가 로그인으로 돌리거나(3xx) 라우트가 401 — 어느 쪽이든 정답 자료 없음
      expect([401, 302, 303, 307, 308]).toContain(anonRes.status())
      expect(await anonRes.text()).not.toMatch(/"judgment"/)
      await anon.close()

      // ── A0 · 도구 연결 · 판본 ──
      await openJudgment(page, A.slug)
      await expect(tool(page)).toBeVisible({ timeout: 60_000 })
      await expect(tool(page)).toHaveAttribute('data-item', A.id)
      await expect(tool(page)).toHaveAttribute('data-analysis-version', '1')
      const shell = tool(page).locator('[data-judgment-shell]')
      await expect(shell.locator('[data-scroll-pane="evidence"]')).toBeVisible()
      await expect(shell.locator('[data-scroll-pane="judgment"]')).toBeVisible()
      await expect(shell.locator('[data-revealed]')).toHaveCount(0)
      // 가로 넘침 없음 · 두 면이 함께 보인다
      const geo = await page.evaluate(() => {
        const s = document.querySelector('[data-testid="judgment-tool-d"] [data-judgment-shell]')!.getBoundingClientRect()
        const ev = document.querySelector('[data-scroll-pane="evidence"]')!.getBoundingClientRect()
        const jd = document.querySelector('[data-scroll-pane="judgment"]')!.getBoundingClientRect()
        return { docW: document.documentElement.scrollWidth, vw: window.innerWidth, s: s.right, ev: [ev.left, ev.right, ev.width], jd: [jd.left, jd.right, jd.width] }
      })
      expect(geo.docW, '가로 넘침').toBeLessThanOrEqual(geo.vw)
      expect(geo.s).toBeLessThanOrEqual(geo.vw)
      expect(geo.ev[2]).toBeGreaterThan(280)
      expect(geo.jd[2]).toBeGreaterThan(280)
      expect(geo.jd[0]).toBeGreaterThanOrEqual(geo.ev[1] - 1)
      expect(posts, '도구 렌더 · 탐색은 판단 요청 0').toHaveLength(0)
      await page.screenshot({ path: test.info().outputPath(`a0-${width}.png`) })

      // ── A4 · 학습자 선택 · 스크롤 → 장면 왕복 · 근거 판 접기 뒤 유지 ──
      const tab2 = shell.locator('[role="tablist"] [data-slot="2"]')
      await tab2.focus()
      await page.keyboard.press('Enter')
      await expect(tab2).toHaveAttribute('aria-selected', 'true')
      const firstVerdict = shell.locator('[data-seam="back"] [data-verdict="holds"]')
      await firstVerdict.focus()
      await page.keyboard.press('Enter')
      await expect(firstVerdict).toHaveAttribute('aria-pressed', 'true')
      const ev = shell.locator('[data-scroll-pane="evidence"]')
      await ev.evaluate((el) => { el.scrollTop = 120 })
      const evTop = await ev.evaluate((el) => el.scrollTop)
      await page.locator('[data-testid="dock-scene"][data-scene="task"]').first().click()
      await expect(tool(page)).toBeHidden()
      await page.locator('[data-testid="dock-scene"][data-scene="judgment"]').first().click()
      await expect(tool(page)).toBeVisible()
      await expect(tab2).toHaveAttribute('aria-selected', 'true')
      await expect(firstVerdict).toHaveAttribute('aria-pressed', 'true')
      expect(await ev.evaluate((el) => el.scrollTop), '장면 왕복 뒤 원문 스크롤 유지').toBe(evTop)
      await page.getByTestId('evidence-toggle').click()
      await page.getByTestId('evidence-toggle').click()
      await expect(firstVerdict).toHaveAttribute('aria-pressed', 'true')
      expect(posts).toHaveLength(0)

      // ── A3 · 기록 실패(503) · 보류(423) 응답이면 해설 없음 ──
      for (const [status, reason] of [[503, 'fetch'], [423, 'held']] as const) {
        await page.route(`**/api/csat/item/${A.slug}/judgment`, (r) => r.fulfill({ status, contentType: 'application/json', headers: { 'cache-control': 'no-store' }, body: JSON.stringify({ ok: false, error: 'x' }) }))
        await shell.locator('[data-reveal-btn]').focus()
        await page.keyboard.press('Enter')
        await expect(shell.locator(`[data-reveal-error="${reason}"]`)).toBeVisible()
        await expect(shell.locator('[data-revealed]')).toHaveCount(0)
        await page.unroute(`**/api/csat/item/${A.slug}/judgment`)
      }
      // 200 인데 judgment 없음(원장만 성공 · 결속 깨짐) → 형식 오류로 닫힘
      await page.route(`**/api/csat/item/${A.slug}/judgment`, (r) => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, exposureId: 1, reveal: null, judgment: null }) }))
      await shell.locator('[data-reveal-btn]').focus()
      await page.keyboard.press('Enter')
      await expect(shell.locator('[data-reveal-error="shape"]')).toBeVisible()
      await page.unroute(`**/api/csat/item/${A.slug}/judgment`)
      posts.length = 0

      // ── A3 · A4 — 키보드 공개: 실제 라우트(노출 원장 커밋) 200 뒤에만 해설 ──
      await shell.locator('[data-reveal-btn]').focus()
      await page.keyboard.press('Enter')
      await expect(shell.locator('[data-revealed]')).toBeVisible({ timeout: 90_000 })
      const ok = posts.filter((p) => p.status === 200)
      expect(ok, '판단 요청 1회 200').toHaveLength(1)
      expect(ok[0].body?.exposureId, '노출 원장 id').toBeTruthy()
      const j = ok[0].body?.judgment as { id: string; analysisVersion: number; answer: number; unitsHash: string } | null
      expect(j).toMatchObject({ id: A.id, analysisVersion: 1, answer: A.answer })
      expect(j!.unitsHash).toMatch(/^[0-9a-f]{16,}$/)
      // 포커스가 body 로 떨어지지 않는다
      expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[data-judgment-shell]')))).toBe(true)
      // 근거 링크(키보드) — 눌러도 포커스는 도구 안
      const ref = shell.locator('[data-revealed] button').first()
      await ref.focus()
      await page.keyboard.press('Enter')
      expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[data-judgment-shell]')))).toBe(true)
      await page.screenshot({ path: test.info().outputPath(`a3-revealed-${width}.png`) })

      // ── A1 · 늦은 응답 + 문항 이동 — 다른 문항 B 에 A 의 상태 · 해설 없음 ──
      await openJudgment(page, B.slug)
      await expect(tool(page)).toHaveAttribute('data-item', B.id)
      const shellB = tool(page).locator('[data-judgment-shell]')
      await expect(shellB.locator('[data-revealed]')).toHaveCount(0)
      await expect(shellB.locator('[data-reveal-btn]')).toBeVisible()
      expect(await shellB.locator('[aria-pressed="true"][data-verdict]').count()).toBe(0)
      // 늦은 응답: 요청을 걸어 둔 채 다시 열고(같은 문항 새 인스턴스) — 늦게 온 응답이 새 화면에 해설을 만들지 않는다
      let release!: () => void
      const gate = new Promise<void>((r) => { release = r })
      await page.route(`**/api/csat/item/${B.slug}/judgment`, async (r) => { await gate; await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, exposureId: 1, judgment: { id: A.id, analysisVersion: 1, unitsVersion: 1, unitsHash: 'x', answer: 3, choices: [] } }) }).catch(() => {}) })
      await shellB.locator('[data-reveal-btn]').focus()
      await page.keyboard.press('Enter')
      await expect(shellB.locator('[data-reveal-loading]')).toBeVisible()
      await openJudgment(page, A.slug)
      release()
      await page.waitForTimeout(1500)
      await expect(tool(page)).toHaveAttribute('data-item', A.id)
      await expect(tool(page).locator('[data-revealed]'), '새 화면에 이전 공개 상태 없음').toHaveCount(0)
      await page.unroute(`**/api/csat/item/${B.slug}/judgment`)

      // ── A5 · 도구 미노출 문항 ──
      for (const slug of NO_TOOL) {
        const res = await page.request.get(`/csat/item/${slug}?scene=judgment`, { timeout: 180_000 })
        if (res.status() === 404) continue
        expect(res.status()).toBe(200)
        expect(await res.text(), `${slug} 에 도구`).not.toContain('judgment-tool-d')
      }
      await openJudgment(page, NO_TOOL[0])
      await expect(tool(page)).toHaveCount(0)

      console.log('4xx/5xx', JSON.stringify(bad))
      // 허용: 이 스펙이 일부러 만든 503 · 423(가로챈 응답) · 학평 회차 로컬 문제지 없음(dev-paper 404, 기존 동작)
      expect(bad.filter((b) => !/^(503|423) POST \/api\/csat\/item\/H1803G2-35\/judgment$|^404 GET \/api\/csat\/dev-paper$/.test(b)), '예상 밖 오류 응답').toEqual([])
      expect(consoleErrors.filter((e) => !/favicon|Download the React DevTools|Failed to load resource/.test(e)), '콘솔 오류').toEqual([])
    })
  }
})
