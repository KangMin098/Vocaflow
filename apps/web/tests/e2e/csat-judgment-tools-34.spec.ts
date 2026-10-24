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
      const exposureIds: unknown[] = []
      page.on('response', async (r) => {
        if (!r.url().includes('/judgment') || r.request().method() !== 'POST') return
        judgments.push(r.status())
        exposureIds.push(((await r.json().catch(() => null)) as { exposureId?: unknown } | null)?.exposureId)
      })

      // D4 — 첫 HTML · RSC
      for (const scene of ['judgment', 'task', 'meaning', 'design']) {
        const res = await page.request.get(`/csat/item/${SLUG}?scene=${scene}`, { timeout: 180_000 })
        expect(res.status(), `${scene} 첫 응답이 200 이 아니다(로그인 화면 우회 금지)`).toBe(200)
        const html = await res.text()
        expect(html, `${scene} 첫 응답이 실제 해설 화면이 아니다`).toContain('analysis-theater')
        const rsc = await (await page.request.get(`/csat/item/${SLUG}?scene=${scene}`, { headers: { RSC: '1' }, timeout: 180_000 })).text()
        for (const body of [html, rsc]) {
          expect(body, `${scene} 첫 응답에 정답 자료`).not.toMatch(LEAK)
          for (const t of V3_TEXT) expect(body, `${scene} 첫 응답에 v3 본문 「${t}」`).not.toContain(t)
        }
      }

      await page.goto(`/csat/item/${SLUG}?scene=judgment&lecture-debug=1&lecture-silent=1`, { waitUntil: 'domcontentloaded' })
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
      // 공개 뒤 판단 도구는 장면마다 숨긴 채 유지된다(R152-01) — 판단 장면 컨테이너 안에서만 찾는다
      const J = page.locator('[data-tool-scene="judgment"]')
      expect(judgments).toEqual([200])
      await expect(J.getByTestId('s2b-compare')).toBeVisible({ timeout: 30_000 })
      await expect(J.getByTestId('s2b-scope')).toBeVisible()
      await expect(J.getByTestId('s2b-undisclosed')).toHaveCount(0)

      // D3 · D5 — 키보드만으로 네 도구 조작(Enter · Space · Tab) · 보이는 focus · ② 진위 미확정과 발문 불충족 분리 · 관계 표시
      const scope = J.getByRole('region', { name: '발문과 한정 범위 대조' })
      const qualifiers = J.getByRole('region', { name: '조건·한정 관계' })
      const evidenceRegion = J.getByRole('region', { name: '본문 근거 연결' })
      const compareRegion = J.getByRole('region', { name: '완성 명제 두 개 대조' })
      for (const r of [scope, qualifiers, evidenceRegion, compareRegion]) await expect(r).toBeVisible()
      const ifBtn = scope.getByRole('button', { name: 'If', exact: true })
      const scopeBefore = await J.getByTestId('s2b-scope').innerText()
      await ifBtn.focus()
      expect(await ifBtn.evaluate((el) => getComputedStyle(el).outlineStyle), 'focus 가 보이지 않는다').not.toBe('none')
      await page.keyboard.press('Enter')
      await expect(ifBtn).toHaveAttribute('aria-pressed', 'true')
      const scopeText = await J.getByTestId('s2b-scope').innerText()
      expect(scopeText, 'If 를 골라도 범위 설명이 바뀌지 않았다').not.toBe(scopeBefore)
      const condition = qualifiers.getByRole('button', { name: '조건 2', exact: true })
      await condition.focus()
      await page.keyboard.press('Space')
      await expect(condition).toHaveAttribute('aria-pressed', 'true')
      const left = J.getByRole('region', { name: '왼쪽 비교 명제' })
      const choice2 = left.getByRole('button', { name: '②', exact: true })
      await choice2.focus()
      await page.keyboard.press('Enter')
      await expect(choice2).toHaveAttribute('aria-pressed', 'true')
      await expect(left).toContainText('원문만으로 확정 불가')
      await expect(left).toContainText('발문 요구를 충족하지 못함')
      const rel = left.getByRole('button', { name: 'then the law cannot be', exact: true })
      await rel.focus()
      await page.keyboard.press('Enter')
      await expect(J.getByTestId('s2b-relation')).toBeVisible()
      await J.getByRole('button', { name: '선택한 관계로 돌아가기' }).click()
      // Tab 으로 도구 단추에 실제로 닿는다
      await ifBtn.focus()
      await page.keyboard.press('Tab')
      expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[data-tool-scene="judgment"]'))), 'Tab 이 판단 도구 밖으로 튀었다').toBe(true)

      // D1 — 원문(문제지 열) · 지도 · 판단 도구 · 관계가 한 화면, 가로 넘침 없음 · 도구 영역이 판 밖으로 넘치지 않음
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), '가로로 넘친다').toBe(true)
      await expect(page.locator('[data-proof="passage-map"]')).toBeVisible()
      await expect(page.getByTestId('workspace-paper')).toBeVisible()
      expect(await compareRegion.evaluate((el) => el.scrollWidth <= el.clientWidth + 1), '비교 영역이 가로로 넘친다').toBe(true)

      // D2 — 원문 쪽(근거 판) 접기 · 열기 왕복과 장면 왕복(판단 → 설계 → 판단) 뒤 도구 선택 보존(C7 · R152-01)
      await page.getByTestId('evidence-toggle').click()
      await page.getByTestId('evidence-toggle').click()
      await expect(page.locator('[data-proof="passage-map"]')).toBeVisible()
      await page.getByTestId('scene-next').click()
      await expect(page.getByTestId('workspace-frame')).toHaveAttribute('data-scene', 'design')
      // 래퍼는 display: contents 라 상자가 없다 — 그 안의 설계 도구가 보이는지로 본다
      await expect(page.locator('[data-tool-scene="design"] section').first()).toBeVisible()
      await page.goBack().catch(() => {})
      if ((await page.getByTestId('workspace-frame').getAttribute('data-scene')) !== 'judgment') {
        await page.getByRole('button', { name: /문항 설계/ }).first().click()
        await page.getByRole('button', { name: /문항 성립|판단/ }).first().click().catch(() => {})
      }
      await expect(page.getByTestId('workspace-frame')).toHaveAttribute('data-scene', 'judgment', { timeout: 10_000 })
      await expect(ifBtn, '장면 왕복 뒤 범위 선택이 사라졌다').toHaveAttribute('aria-pressed', 'true')
      await expect(condition, '장면 왕복 뒤 조건 선택이 사라졌다').toHaveAttribute('aria-pressed', 'true')
      await expect(choice2, '장면 왕복 뒤 비교 선택이 사라졌다').toHaveAttribute('aria-pressed', 'true')
      expect(await J.getByTestId('s2b-scope').innerText()).toBe(scopeText)

      // R152-01 — bridge 왕복(원문 이해 → 문항 성립 bridge → 돌아가기 → 다시 bridge)에서 재마운트로 선택이 지워지지 않는다.
      // bridge 인스턴스와 일반 인스턴스는 서로 섞이지 않는다(같은 문항 · 같은 revision 안에서만 각자 유지)
      const toMeaning = async () => {
        for (let i = 0; i < 4 && (await page.getByTestId('workspace-frame').getAttribute('data-scene')) !== 'meaning'; i++) await page.getByTestId('scene-prev').click()
        await expect(page.getByTestId('workspace-frame')).toHaveAttribute('data-scene', 'meaning')
      }
      await toMeaning()
      await page.getByTestId('ms-go-judgment').click()
      await expect(page.getByTestId('ms-bridge')).toBeVisible()
      const B = J.locator('[data-tool-instance]:not([data-tool-instance="plain"])')
      await expect(B).toHaveCount(1)
      const bIf = B.getByRole('button', { name: 'If', exact: true })
      const bChoice2 = B.getByRole('region', { name: '왼쪽 비교 명제' }).getByRole('button', { name: '②', exact: true })
      await expect(bIf, 'bridge 인스턴스가 일반 인스턴스 선택을 넘겨받았다').toHaveAttribute('aria-pressed', 'false')
      await bIf.click()
      await bChoice2.click()
      await expect(bIf).toHaveAttribute('aria-pressed', 'true')
      await page.getByTestId('ms-bridge-return').click()
      await expect(page.getByTestId('workspace-frame')).toHaveAttribute('data-scene', 'meaning')
      await page.getByTestId('ms-go-judgment').click()
      await expect(page.getByTestId('ms-bridge')).toBeVisible()
      await expect(B).toHaveCount(1)
      await expect(bIf, 'bridge 왕복 뒤 범위 선택이 사라졌다(재마운트)').toHaveAttribute('aria-pressed', 'true')
      await expect(bChoice2, 'bridge 왕복 뒤 비교 선택이 사라졌다(재마운트)').toHaveAttribute('aria-pressed', 'true')
      // 일반 판단 장면으로 돌아가면 일반 인스턴스의 선택이 그대로다
      await page.getByTestId('ms-bridge-return').click()
      await page.getByTestId('scene-next').click()
      await expect(page.getByTestId('workspace-frame')).toHaveAttribute('data-scene', 'judgment')
      await expect(page.getByTestId('ms-bridge')).toHaveCount(0)
      await expect(ifBtn, 'bridge 왕복 뒤 일반 범위 선택이 사라졌다').toHaveAttribute('aria-pressed', 'true')
      await expect(choice2).toHaveAttribute('aria-pressed', 'true')
      expect(judgments, 'bridge 왕복이 판단 요청을 다시 보냈다').toEqual([200])

      // D6 — 강의를 실제로 재생한 뒤 장면을 고르면 멈춘다 · 도구 포커스를 빼앗지 않는다
      const play = page.getByTestId('analysis-theater').locator('header button', { hasText: /하이라이트만|상영 시작/ })
      await expect(async () => {
        await play.click()
        await expect(page.getByTestId('lecture-chooser')).toBeVisible({ timeout: 2_000 })
      }).toPass({ timeout: 60_000 })
      await page.getByTestId('lecture-path-until').click()
      const status = () => page.evaluate(() => (window as unknown as { __LECTURE__?: { player?: { getState(): { status: string } } | null } }).__LECTURE__?.player?.getState().status ?? 'none')
      await expect.poll(status, { timeout: 30_000 }).toBe('playing')
      await ifBtn.focus()
      await page.waitForTimeout(1_500)
      expect(await page.evaluate(() => (document.activeElement?.textContent ?? '').trim()), '재생 중 강의가 도구 포커스를 가져갔다').toBe('If')
      await page.getByTestId('scene-next').click()
      await expect.poll(status, { timeout: 15_000 }).not.toBe('playing')

      // D7 — 공개 1회 = 판단 요청 1회(노출 id) · 도구 탐색 · 장면 이동은 요청 0
      expect(judgments).toEqual([200])
      expect(typeof exposureIds[0] === 'number' || typeof exposureIds[0] === 'string', '노출 id 가 없다').toBe(true)
      console.log(`EXPOSURE34 ${width} ${String(exposureIds[0])}`)

      // D8 — 다시 들어오면 다시 감춤 → 다시 공개하면 판단 라우트가 다시 확인(200) · 콘솔 오류 0(두 화면 모두)
      const fresh = await page.context().newPage()
      await fresh.setViewportSize({ width, height: 900 })
      const freshErrors: string[] = []
      fresh.on('pageerror', (e) => freshErrors.push(String(e)))
      fresh.on('console', (m) => { if (m.type() === 'error') freshErrors.push(m.text()) })
      const freshJudgments: number[] = []
      fresh.on('response', (r) => { if (r.url().includes('/judgment') && r.request().method() === 'POST') freshJudgments.push(r.status()) })
      await fresh.goto(`/csat/item/${SLUG}?scene=judgment`, { waitUntil: 'domcontentloaded' })
      await expect(fresh.getByTestId('analysis-theater')).toBeVisible({ timeout: 120_000 })
      await expect(fresh.getByTestId('judgment-reveal')).toBeVisible()
      await expect(fresh.getByTestId('s2b-compare')).toHaveCount(0)
      const again = fresh.getByTestId('judgment-reveal').getByRole('button', { name: '정답 보기' })
      await expect(async () => {
        if (freshJudgments.length === 0 && (await again.count())) await again.click()
        expect(freshJudgments.length).toBe(1)
      }).toPass({ timeout: 60_000, intervals: [3_000] })
      expect(freshJudgments).toEqual([200])
      await expect(fresh.locator('[data-tool-scene="judgment"]').getByTestId('s2b-compare')).toBeVisible({ timeout: 30_000 })
      await fresh.close()
      expect([...consoleErrors, ...freshErrors].filter((e) => !/Download the React DevTools|favicon/i.test(e)), '콘솔 오류').toEqual([])
      await page.screenshot({ path: `test-results/judgment-tools-34-${width}.png` })
    })
  }
})
