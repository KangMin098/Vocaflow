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

import { leakedAnswerKeys } from '../../src/lib/csat/judgment/evidence'

const STATE_PATH = 'playwright-auth/.auth-csat-lecture-control.json'
const A = { slug: 'H1803G2-35', id: 'H1803G2#35', answer: 3 }
const B = { slug: 'H1803G3-35', id: 'H1803G3#35', answer: 4 }
// 공개 자료(해설) 조각 — 개발 DB 실측. 공개 전 응답에 있으면 누출
const SECRET: Record<string, string[]> = {
  [A.id]: ['은 저장 시 대기 조절이 중요하다는 화제다', 'carbon dioxide 를 저장 조절 대상으로 들여오자', '는 이산화탄소가 pollutant 로 여겨진다는 환경 관점이다'],
  [B.id]: ['은 독서를 관점 취하기의 기술로 규정하고', '는 Reading is 로 시작해'],
}
// 문서 전체(HTML · RSC)에서 정답을 확정하는 키 — 따옴표가 이스케이프된 RSC(\"key\":)도 잡는다.
// answer · answers · correct 같은 범용 키는 다른 화면 자료(예: 빈 gate)에도 있어 문서 전체가 아니라 직렬화된 judgmentItem 에만 T-0171 별칭 전체로 검사한다
const DOC_KEYS = ['verdict', 'why_correct', 'answerLocus', 'answer_locus', 'design_intent', 'how_to_reject', 'isCorrect', 'is_correct', 'answer_no', 'correctIndex', 'correct_choice']
const docLeaks = (body: string) => DOC_KEYS.filter((k) => body.includes(`"${k}":`) || body.includes(`\\"${k}\\":`))
/** RSC 에 직렬화된 judgmentItem 객체를 꺼낸다(중괄호 균형) — 이스케이프된 형태면 한 번 풀어서 */
function serializedJudgmentItem(body: string): unknown {
  const raw = body.includes('"judgmentItem":') ? body : body.replace(/\\"/g, '"')
  const at = raw.indexOf('"judgmentItem":')
  if (at < 0) return undefined
  const after = raw.slice(at + '"judgmentItem":'.length).trimStart()
  if (after.startsWith('null')) return null
  if (!after.startsWith('{')) return undefined
  let i = raw.indexOf('{', at)
  const start = i
  let depth = 0
  let inStr = false
  for (; i < raw.length; i += 1) {
    const ch = raw[i]
    if (inStr) { if (ch === '\\') i += 1; else if (ch === '"') inStr = false; continue }
    if (ch === '"') inStr = true
    else if (ch === '{') depth += 1
    else if (ch === '}') { depth -= 1; if (depth === 0) break }
  }
  return JSON.parse(raw.slice(start, i + 1))
}
const UNITS_HASH_FAKE = '0'.repeat(64)
// 도구가 없어야 하는 문항: 수능(단위 결속 0) · 모평(단위 결속 0) · R-GRAMMAR(isolated) · 다중 정답(2015#25 도표 ④⑤)
// 2025#35 · M2506#35 는 R-IRRELEVANT 이면서 강의가 있다(lecture-data/index.json) — 강의 문항에는 도구를 붙이지 않는다(T-0161 r2 P1-2)
const NO_TOOL = ['2025-35', 'M2506-35', 'H1804G3-28', '2015-25']

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
          expect(docLeaks(body), `${it.id} 첫 응답에 정답 자료 키`).toEqual([])
          for (const t of SECRET[it.id]) expect(body, `${it.id} 첫 응답에 해설 「${t}」`).not.toContain(t)
        }
        // 실제 직렬화된 도구 props — T-0171 별칭 전체(evidence.ts ANSWER_KEYS 12개)
        const props = serializedJudgmentItem(rsc) as { id?: string; version?: { analysisVersion?: number; unitsHash?: string } } | undefined
        expect(props?.id, 'RSC 에 judgmentItem').toBe(it.id)
        expect(leakedAnswerKeys(props), `${it.id} 도구 props 에 정답 키`).toEqual([])
        expect(props?.version?.analysisVersion).toBe(1)
        expect(props?.version?.unitsHash).toMatch(/^[0-9a-f]{64}$/)
      }
      // A2 · A3 — 판본 불일치 API: 409 · 원장 없음 · 정답 자료 없음
      const mism = await page.request.post(`/api/csat/item/${A.slug}/judgment`, { data: { analysisVersion: 99, clientExposureId: crypto.randomUUID(), source: 'judgment_scene' } })
      expect(mism.status()).toBe(409)
      const mismText = await mism.text()
      expect(mismText).not.toMatch(/"judgment"|"reveal"|"answer"/)
      for (const t of SECRET[A.id]) expect(mismText).not.toContain(t)
      // P1-1 — 화면 도구 결속(unitsHash)이 지금 결속과 다르다 → 409 · 응답 전체에 정답 자료 없음(원장 기록 전)
      const stale = await page.request.post(`/api/csat/item/${A.slug}/judgment`, { data: { analysisVersion: 1, clientExposureId: crypto.randomUUID(), source: 'judgment_scene', tool: { analysisVersion: 1, unitsHash: UNITS_HASH_FAKE } } })
      expect(stale.status(), '결속 불일치는 409').toBe(409)
      const staleText = await stale.text()
      expect(leakedAnswerKeys(JSON.parse(staleText))).toEqual([])
      expect(staleText).not.toMatch(/"judgment"|"reveal"|"gate"|"blocks"/)
      for (const t of SECRET[A.id]) expect(staleText).not.toContain(t)
      // P1-2 — 강의 있는 R-IRRELEVANT(2025#35)에 도구 provider 형태 요청 → 결속 없음 409 · 정답 자료 없음
      const lecItem = await page.request.get('/csat/item/2025-35?scene=judgment', { timeout: 180_000 })
      expect(lecItem.status()).toBe(200)
      const lecHtml = await lecItem.text()
      // 최신 published 판본(MCP SELECT 2026-10-25: 2025#35 → 4). 판본이 바뀌어도 라우트는 409(판본)로 막는다
      const lecVer = 4
      expect(lecHtml).not.toContain('judgment-tool-d')
      const lecRsc = await (await page.request.get('/csat/item/2025-35?scene=judgment', { headers: { RSC: '1' }, timeout: 180_000 })).text()
      expect(serializedJudgmentItem(lecRsc) ?? null, '강의 문항 judgmentItem 은 null').toBeNull()
      {
        const lecPost = await page.request.post('/api/csat/item/2025-35/judgment', { data: { analysisVersion: lecVer, clientExposureId: crypto.randomUUID(), source: 'judgment_scene' } })
        expect(lecPost.status()).toBe(409)
      }
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
      // 늦은 응답(유효한 실제 응답): B 의 판단 응답을 서버에서 받아 둔 채 붙잡고, 「같은 유형 다음 문항」(클라이언트 이동)으로 옮긴 뒤 놓는다.
      // 새 화면 어디에도 B 의 해설이 그려지면 안 된다
      let release!: () => void
      const gate = new Promise<void>((r) => { release = r })
      let lateBody: Record<string, unknown> | null = null
      await page.route(`**/api/csat/item/${B.slug}/judgment`, async (r) => {
        const real = await r.fetch()
        lateBody = (await real.json().catch(() => null)) as Record<string, unknown> | null
        await gate
        await r.fulfill({ response: real, json: lateBody ?? undefined }).catch(() => {})
      })
      await shellB.locator('[data-reveal-btn]').focus()
      await page.keyboard.press('Enter')
      await expect(shellB.locator('[data-reveal-loading]')).toBeVisible()
      await expect.poll(() => lateBody != null, { timeout: 60_000 }).toBe(true)
      expect((lateBody as unknown as { judgment?: { id?: string } }).judgment?.id, '붙잡은 응답은 유효한 B 공개 자료').toBe(B.id)
      const nextLink = page.getByTestId('next-item')
      await expect(nextLink).toBeVisible()
      await nextLink.click()
      await page.waitForURL((u) => !u.pathname.endsWith(B.slug), { timeout: 120_000 })
      await expect(page.getByTestId('analysis-theater')).toBeVisible({ timeout: 120_000 })
      release()
      await page.waitForTimeout(1500)
      if (await tool(page).count()) expect(await tool(page).getAttribute('data-item')).not.toBe(B.id)
      await expect(page.locator('[data-revealed]'), '이동한 화면에 B 의 늦은 해설 없음').toHaveCount(0)
      for (const t of SECRET[B.id]) expect(await page.content()).not.toContain(t)
      await page.unroute(`**/api/csat/item/${B.slug}/judgment`)

      // ── A5 · 도구 미노출 문항 ──
      for (const slug of NO_TOOL) {
        const res = await page.request.get(`/csat/item/${slug}?scene=judgment`, { timeout: 180_000 })
        expect(res.status(), `${slug} 는 실제 문항 화면이어야 한다(404 를 통과로 세지 않는다)`).toBe(200)
        expect(await res.text()).toContain('analysis-theater')
        const again = await (await page.request.get(`/csat/item/${slug}?scene=judgment`, { timeout: 180_000 })).text()
        expect(again, `${slug} 에 도구`).not.toContain('judgment-tool-d')
      }
      await openJudgment(page, NO_TOOL[0])
      await expect(tool(page)).toHaveCount(0)

      console.log('4xx/5xx', JSON.stringify(bad))
      // 허용: 이 스펙이 일부러 만든 503 · 423(가로챈 응답) · 학평 회차 로컬 문제지 없음(dev-paper 404, 기존 동작)
      //       · 빠른 클라이언트 이동 중 학습 상태 저장의 판본 충돌(409 PUT /api/csat/state — 상태 저장소의 기존 동시성 제어, 판단 자료와 무관)
      expect(bad.filter((b) => !/^(503|423) POST \/api\/csat\/item\/H1803G2-35\/judgment$|^404 GET \/api\/csat\/dev-paper$|^409 PUT \/api\/csat\/state$/.test(b)), '예상 밖 오류 응답').toEqual([])
      expect(consoleErrors.filter((e) => !/favicon|Download the React DevTools|Failed to load resource/.test(e)), '콘솔 오류').toEqual([])
    })
  }
})
