// apps/web/tests/e2e/csat-judgment-tools-34.spec.ts
//
// **T-0145 판단 도구(2026-34 · Interactive34) × 공유 해설 화면** — 실제 로그인 화면 · 실제 서버 · 개발 DB · PC 1280 · 1440.
// 연결 계약 runtime/t0145-s2b/HANDOFF_T0140_CONTRACT.md D1~D8(T-0152):
//   D1 실제 /csat/item/2026-34 에서 원문 · 판단 도구 · 근거 관계 · 가로 넘침 없음
//   D2 근거 판(원문 쪽) 접기/열기 왕복 뒤 판단 도구 상태 보존
//   D3 키보드만으로 도구 조작 · 보이는 focus
//   D4 공개 전 HTML · RSC 응답에 정답 ③ · 34 판단 내용 · v3 본문 없음 · 도구는 안내만
//   D5 「정답 보기」(노출 원장 기록) 뒤에만 비교 · 관계 표시
//   D6 강의 ↔ 판단 도구 — 장면을 고르면 강의가 멈춘다(재개는 학습자)
//   D7 공개 1회 = 판단 요청 1회 · 도구 탐색 · 클릭은 요청 0
//   D8 콘솔 오류 0 · 다시 들어오면 다시 감춤
//
// 세션: playwright-auth/.auth-csat-lecture-control.json (계정 없으면 실행 불가)

import fs from 'node:fs'

import { expect, test } from '@playwright/test'

const STATE_PATH = 'playwright-auth/.auth-csat-lecture-control.json'
const SLUG = '2026-34'
// 실제 탐구 정본 2026#34 의 v3 본문 조각(의미 단위 · 선지 판정 · 발문 요약) — 공개 전 응답에 있으면 누출
const V3_TEXT = ['앞의 If 조건이 성립하면', '그들의 자유에 대한 구속으로 이해될 수 없다', 'cannot be 뒤 빈칸에 넣었을 때']
const LEAK = /정답 [①-⑤]|"selected_as_answer"|"why_correct"|"how_to_reject"|analysis:reject:\d/

test.describe('판단 도구 34 × 해설 화면', () => {
  test.use({ storageState: STATE_PATH })
  test.beforeAll(() => {
    if (!fs.existsSync(STATE_PATH)) throw new Error('세션 파일이 없다 — 실계정 E2E 는 합성 계정 세션이 필요하다')
  })

  for (const width of [1280, 1440]) {
    test(`D1~D8 ${width}px`, async ({ page }) => {
      test.setTimeout(300_000)
      await page.setViewportSize({ width, height: 900 })
      const consoleErrors: string[] = []
      page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
      page.on('pageerror', (e) => consoleErrors.push(String(e)))
      const judgments: number[] = []
      page.on('response', (r) => { if (r.url().includes('/judgment') && r.request().method() === 'POST') judgments.push(r.status()) })

      // D4 — 첫 HTML · RSC
      for (const scene of ['judgment', 'task', 'design']) {
        const html = await (await page.request.get(`/csat/item/${SLUG}?scene=${scene}`)).text()
        const rsc = await (await page.request.get(`/csat/item/${SLUG}?scene=${scene}`, { headers: { RSC: '1' } })).text()
        for (const body of [html, rsc]) {
          expect(body, `${scene} 첫 응답에 정답 자료`).not.toMatch(LEAK)
          for (const t of V3_TEXT) expect(body, `${scene} 첫 응답에 v3 본문 「${t}」`).not.toContain(t)
        }
      }

      await page.goto(`/csat/item/${SLUG}?scene=judgment`, { waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('analysis-theater')).toBeVisible({ timeout: 120_000 })
      // 공개 전 — 도구는 안내만, 비교 · 관계 없음
      await expect(page.getByTestId('judgment-reveal')).toBeVisible()
      await expect(page.getByTestId('s2b-compare')).toHaveCount(0)
      await expect(page.getByTestId('s2b-relation')).toHaveCount(0)
      expect(judgments).toHaveLength(0)

      // D5 · D7 — 키보드 「정답 보기」 → 판단 요청 1회(200) → 도구가 열린다
      const btn = page.getByTestId('judgment-reveal').getByRole('button', { name: '정답 보기' })
      await expect(async () => {
        if (judgments.length === 0 && (await btn.count())) {
          await btn.focus()
          await page.keyboard.press('Enter')
        }
        expect(judgments.length).toBe(1)
      }).toPass({ timeout: 90_000, intervals: [3_000] })
      expect(judgments).toEqual([200])
      await expect(page.getByTestId('s2b-compare')).toBeVisible({ timeout: 30_000 })
      await expect(page.getByTestId('s2b-scope')).toBeVisible()
      await expect(page.getByTestId('s2b-undisclosed')).toHaveCount(0)

      // D3 — 키보드만으로 범위 표현 고르기 · 보이는 focus
      const ifBtn = page.getByRole('button', { name: 'If', exact: true }).first()
      await ifBtn.focus()
      expect(await ifBtn.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none')
      await page.keyboard.press('Enter')
      const scopeText = await page.getByTestId('s2b-scope').innerText()
      expect(scopeText.length).toBeGreaterThan(0)

      // D1 — 가로 넘침 없음 · 원문(지도) · 도구 · 관계가 한 화면에
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), '가로로 넘친다').toBe(true)
      await expect(page.locator('[data-proof="passage-map"]')).toBeVisible()

      // D2 — 근거 판(원문 쪽) 접기 → 열기 뒤 도구 상태 보존
      await page.getByTestId('evidence-toggle').click()
      await page.getByTestId('evidence-toggle').click()
      await expect(page.locator('[data-proof="passage-map"]')).toBeVisible()
      expect(await page.getByTestId('s2b-scope').innerText(), '원문 쪽 왕복 뒤 도구 선택이 바뀌었다').toBe(scopeText)

      // D6 — 강의를 틀고 장면을 고르면 멈춘다
      const play = page.getByTestId('analysis-theater').locator('header button', { hasText: /하이라이트만|상영 시작/ })
      await expect(async () => {
        await play.click()
        await expect(page.getByTestId('lecture-chooser')).toBeVisible({ timeout: 2_000 })
      }).toPass({ timeout: 60_000 })
      await page.getByTestId('lecture-path-until').click()
      const status = () => page.evaluate(() => (window as unknown as { __LECTURE__?: { player?: { getState(): { status: string } } | null } }).__LECTURE__?.player?.getState().status ?? 'none')
      await page.waitForTimeout(500)
      await page.getByTestId('scene-next').click()
      await expect.poll(status, { timeout: 15_000 }).not.toBe('playing')

      // D7 — 도구 탐색 · 장면 이동은 판단 요청을 더 만들지 않는다
      expect(judgments).toHaveLength(1)

      // D8 — 다시 들어오면 다시 감춤 · 콘솔 오류 0
      const fresh = await page.context().newPage()
      await fresh.setViewportSize({ width, height: 900 })
      const freshErrors: string[] = []
      fresh.on('pageerror', (e) => freshErrors.push(String(e)))
      await fresh.goto(`/csat/item/${SLUG}?scene=judgment`, { waitUntil: 'domcontentloaded' })
      await expect(fresh.getByTestId('analysis-theater')).toBeVisible({ timeout: 120_000 })
      await expect(fresh.getByTestId('judgment-reveal')).toBeVisible()
      await expect(fresh.getByTestId('s2b-compare')).toHaveCount(0)
      await fresh.close()
      expect([...consoleErrors, ...freshErrors].filter((e) => !/Download the React DevTools|favicon/i.test(e)), '콘솔 오류').toEqual([])
      await page.screenshot({ path: `test-results/judgment-tools-34-${width}.png` })
    })
  }
})
