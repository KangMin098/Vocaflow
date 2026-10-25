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
import { createClient } from '@supabase/supabase-js'

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
      // 판단 장면에는 「이전 장면」 단추가 없다 — 학습자가 실제로 쓰는 하단 도크의 장면 아이콘으로 옮긴다(r3)
      const toScene = async (id: 'meaning' | 'judgment') => {
        await page.locator(`[data-testid="dock-scene"][data-scene="${id}"]`).click()
        await expect(page.getByTestId('workspace-frame')).toHaveAttribute('data-scene', id)
      }
      const toMeaning = () => toScene('meaning')
      await toMeaning()
      await page.getByTestId('ms-go-judgment').click()
      await expect(page.locator('[data-testid="ms-bridge"]:visible')).toHaveCount(1)
      await expect(J.getByTestId('ms-bridge').locator('visible=true')).toHaveCount(1)
      const B = J.locator('[data-tool-instance]:not([data-tool-instance="plain"])')
      await expect(B).toHaveCount(1)
      const bIf = B.getByRole('button', { name: 'If', exact: true })
      const bChoice2 = B.getByRole('region', { name: '왼쪽 비교 명제' }).getByRole('button', { name: '②', exact: true })
      await expect(bIf, 'bridge 인스턴스가 일반 인스턴스 선택을 넘겨받았다').toHaveAttribute('aria-pressed', 'false')
      await bIf.click()
      await bChoice2.click()
      await expect(bIf).toHaveAttribute('aria-pressed', 'true')
      await J.getByTestId('ms-bridge-return').click()
      await expect(page.getByTestId('workspace-frame')).toHaveAttribute('data-scene', 'meaning')
      await page.getByTestId('ms-go-judgment').click()
      await expect(page.locator('[data-testid="ms-bridge"]:visible')).toHaveCount(1)
      await expect(J.getByTestId('ms-bridge').locator('visible=true')).toHaveCount(1)
      await expect(B).toHaveCount(1)
      await expect(bIf, 'bridge 왕복 뒤 범위 선택이 사라졌다(재마운트)').toHaveAttribute('aria-pressed', 'true')
      await expect(bChoice2, 'bridge 왕복 뒤 비교 선택이 사라졌다(재마운트)').toHaveAttribute('aria-pressed', 'true')
      // 일반 판단 장면으로 돌아가면 일반 인스턴스의 선택이 그대로다
      await J.getByTestId('ms-bridge-return').click()
      await toScene('judgment')
      await expect(page.locator('[data-testid="ms-bridge"]:visible'), 'bridge 를 떠난 뒤에도 안내가 보인다').toHaveCount(0)
      // bridge 를 떠난 뒤 설계 장면에도 옛 bridge 안내가 보이지 않는다(숨김 유지 인스턴스가 문맥을 흘리지 않는다)
      await page.locator('[data-testid="dock-scene"][data-scene="design"]').click()
      await expect(page.getByTestId('workspace-frame')).toHaveAttribute('data-scene', 'design')
      await expect(page.locator('[data-testid="ms-bridge"]:visible'), '설계 장면에 옛 bridge 안내가 남았다').toHaveCount(0)
      await toScene('judgment')
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

  // ── R152-02 보강(r3) — r2 가 NOT_VERIFIED/PARTIAL 로 남긴 D1 · D2 · D3 · D4 · D6 · D7 · D8 범위를 실제 브라우저 · 실제 원장으로 단정한다 ──
  for (const width of [1280, 1440]) {
    test(`R152-02 보강 ${width}px`, async ({ page }) => {
      test.setTimeout(420_000)
      await page.setViewportSize({ width, height: 900 })
      const consoleErrors: string[] = []
      page.on('console', (m) => { if (m.type() === 'error') consoleErrors.push(m.text()) })
      page.on('pageerror', (e) => consoleErrors.push(String(e)))
      const judgments: { status: number; body: Record<string, unknown> | null }[] = []
      const exposureBodies: Record<string, unknown>[] = []
      page.on('request', (r) => {
        if (r.url().includes('/judgment') && r.method() === 'POST') exposureBodies.push((r.postDataJSON() ?? {}) as Record<string, unknown>)
      })
      page.on('response', async (r) => {
        if (!r.url().includes('/judgment') || r.request().method() !== 'POST') return
        judgments.push({ status: r.status(), body: (await r.json().catch(() => null)) as Record<string, unknown> | null })
      })
      // 공개 전 단계의 모든 fetch/XHR 응답(D4 — 엔드포인트를 나열하지 않고 실제로 오간 응답 전부)
      let preReveal = true
      const preBodies: { url: string; text: string }[] = []
      page.on('response', async (r) => {
        if (!preReveal) return
        const t = r.request().resourceType()
        if (t !== 'fetch' && t !== 'xhr') return
        preBodies.push({ url: r.url(), text: await r.text().catch(() => '') })
      })

      // D4 — RSC 요청은 상태까지 본다(로그인 화면 · 오류 본문으로 통과하지 않게)
      const rscRes = await page.request.get(`/csat/item/${SLUG}?scene=judgment`, { headers: { RSC: '1' }, timeout: 180_000 })
      expect(rscRes.status(), 'RSC 응답이 200 이 아니다').toBe(200)
      expect(rscRes.headers()['content-type'] ?? '', 'RSC 응답 형식이 아니다').toContain('text/x-component')
      const rscBody = await rscRes.text()
      expect(rscBody).not.toMatch(LEAK)
      for (const t of V3_TEXT) expect(rscBody, `RSC 에 v3 본문 「${t}」`).not.toContain(t)

      await page.goto(`/csat/item/${SLUG}?scene=judgment&lecture-debug=1&lecture-silent=1`, { waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('analysis-theater')).toBeVisible({ timeout: 120_000 })
      await expect(page.getByTestId('judgment-reveal')).toBeVisible()
      // 원문이 실제로 다 실렸다(문항 번호 · 지문 첫 문장)
      await expect(page.getByTestId('workspace-paper')).toContainText('34.', { timeout: 60_000 })
      await expect(page.getByTestId('workspace-paper')).toContainText('Kant was a strong defender')

      // D6 ② · ⑤ — 강의 경계 skip 은 정답을 숨긴 탐색 상태로 돌아오고, skip 은 판단 요청 · 원장 기록을 만들지 않는다
      const play = page.getByTestId('analysis-theater').locator('header button', { hasText: /하이라이트만|상영 시작/ })
      await expect(async () => {
        await play.click()
        await expect(page.getByTestId('lecture-chooser')).toBeVisible({ timeout: 2_000 })
      }).toPass({ timeout: 60_000 })
      // Escape 는 「닫기」와 같다 — 강의를 시작하지 않고 선택만 접는다(r3 관찰 결함 수정). 다시 열어 이어 간다
      await page.getByTestId('lecture-chooser').locator('button').first().focus()
      await page.keyboard.press('Escape')
      await expect(page.getByTestId('lecture-chooser'), 'Escape 로 강의 선택이 닫히지 않는다').toHaveCount(0)
      await expect(async () => {
        await play.click()
        await expect(page.getByTestId('lecture-chooser')).toBeVisible({ timeout: 2_000 })
      }).toPass({ timeout: 60_000 })
      await page.getByTestId('lecture-path-until').click()
      await expect(page.getByTestId('lecture-boundary')).toBeVisible({ timeout: 180_000 })
      await page.getByTestId('lecture-boundary-skip').click()
      const lectureStatus = () => page.evaluate(() => (window as unknown as { __LECTURE__?: { player?: { getState(): { status: string } } | null } }).__LECTURE__?.player?.getState().status ?? 'none')
      await expect.poll(lectureStatus, { timeout: 15_000 }).not.toBe('playing')
      // 경계 skip 뒤에는 「정답 직접 안내 전까지」 숨김 패널이 남는다(정답 · 오답 내용 감춤 · 공개 단추만)
      await expect(page.locator('[data-withheld="true"]:visible').first(), '경계 skip 뒤 정답 숨김이 풀렸다').toBeVisible()
      await expect(page.locator('[data-withheld="true"]:visible').first()).toContainText('감춰 두었어요')
      await expect(page.locator('[data-tool-scene="judgment"]').getByTestId('s2b-compare'), '경계 skip 이 판단 도구를 열었다').toHaveCount(0)
      expect(judgments, '경계 skip 이 판단 요청을 보냈다(skip ≠ 공개 · 기록)').toHaveLength(0)

      // D4 — 지금까지(공개 전) 실제로 오간 fetch/XHR 응답 전부에 정답 자료 · v3 본문이 없다
      expect(preBodies.length, '공개 전 응답을 하나도 못 잡았다(검사 무효)').toBeGreaterThan(0)
      for (const b of preBodies) {
        expect(b.text, `공개 전 응답 ${b.url} 에 정답 자료`).not.toMatch(LEAK)
        for (const t of V3_TEXT) expect(b.text, `공개 전 응답 ${b.url} 에 v3 본문 「${t}」`).not.toContain(t)
      }
      preReveal = false

      // D7 공개 실패 종단(r3 P2) — 비공개 화면에서 AnalysisTheater 의 실제 요청이 서버 원장 기록 실패(503)를 받으면 정답 · 도구는 계속 숨고, 다시 누르면 공개된다.
      // 실패는 진짜 서버에서 만든다: 같은 노출 id 를 다른 출처로 먼저 기록해 두고, 화면 요청의 노출 id 만 그 id 로 바꿔 보낸다(제품 코드 무변경 · 503 을 가짜로 꾸미지 않음)
      const admin = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!, { auth: { persistSession: false } })
      const ledger = async (id: string) => {
        const { data, error } = await admin.from('learning_exposures').select('id, source').eq('client_exposure_id', id)
        if (error) throw new Error(`원장 조회 실패: ${error.message}`)
        return data ?? []
      }
      const seedId = crypto.randomUUID()
      let uiOriginalId = ''
      let failStatus = 0
      await page.route(`**/api/csat/item/${SLUG}/judgment`, async (route) => {
        const sent = (route.request().postDataJSON() ?? {}) as Record<string, unknown>
        uiOriginalId = String(sent.clientExposureId)
        const seed = await page.request.post(`/api/csat/item/${SLUG}/judgment`, { data: { ...sent, clientExposureId: seedId, source: 'lecture_full' } })
        expect(seed.status(), '실패 주입용 선기록이 실패했다').toBe(200)
        const res = await route.fetch({ postData: JSON.stringify({ ...sent, clientExposureId: seedId }) })
        failStatus = res.status()
        await route.fulfill({ response: res })
      })
      const firstBtn = page.getByRole('button', { name: '정답 보기' }).locator('visible=true').first()
      await firstBtn.focus()
      await page.keyboard.press('Enter')
      await expect(page.getByTestId('answer-reveal-failed').first(), '기록 실패 안내가 없다').toBeVisible({ timeout: 90_000 })
      expect(failStatus, '서버가 원장 충돌을 실패로 돌려주지 않았다').toBe(503)
      await page.unroute(`**/api/csat/item/${SLUG}/judgment`)
      await page.waitForTimeout(1_500)
      // 이 시점은 강의 경계 skip 뒤라 숨김은 「정답 직접 안내 전까지」 패널(data-withheld)이다
      await expect(page.locator('[data-withheld="true"]:visible').first(), '기록 실패 뒤 정답 숨김이 풀렸다').toContainText('감춰 두었어요')
      await expect(page.locator('[data-tool-scene="judgment"]').getByTestId('s2b-compare'), '기록 실패 뒤 판단 도구가 열렸다').toHaveCount(0)
      expect(await page.content(), '기록 실패 뒤 화면에 v3 본문').not.toContain(V3_TEXT[0])
      expect(await ledger(seedId), '실패한 요청이 선기록 행을 바꿨다').toEqual([expect.objectContaining({ source: 'lecture_full' })])
      expect(await ledger(uiOriginalId), '실패한 화면 요청이 원장 행을 만들었다').toHaveLength(0)
      // 실패 단계의 요청 · 응답은 이후 단정(공개 1회)에서 뺀다
      judgments.length = 0
      exposureBodies.length = 0
      // 브라우저가 실패 응답에 남기는 자원 로드 오류 1건은 주입한 실패 그 자체다 — 그 문구만 뺀다(다른 오류는 그대로 남아 아래에서 실패한다)
      for (let i = consoleErrors.length - 1; i >= 0; i--) if (/^Failed to load resource: the server responded with a status of 503/.test(consoleErrors[i])) consoleErrors.splice(i, 1)

      // 공개(키보드) — 다시 누르면 판단 요청 1회로 공개된다
      const btn = page.getByRole('button', { name: '정답 보기' }).locator('visible=true').first()
      await expect(async () => {
        if (judgments.length === 0 && (await btn.count())) { await btn.focus(); await page.keyboard.press('Enter') }
        expect(judgments.length).toBe(1)
      }).toPass({ timeout: 90_000, intervals: [3_000] })
      expect(judgments[0].status).toBe(200)
      const J = page.locator('[data-tool-scene="judgment"]')
      await expect(J.getByTestId('s2b-compare')).toBeVisible({ timeout: 30_000 })
      const regions = {
        scope: J.getByRole('region', { name: '발문과 한정 범위 대조' }),
        qualifiers: J.getByRole('region', { name: '조건·한정 관계' }),
        evidence: J.getByRole('region', { name: '본문 근거 연결' }),
        compare: J.getByRole('region', { name: '완성 명제 두 개 대조' }),
      }

      // D1 — 원문과 네 도구가 실제 뷰포트 안에 보이고(가려지지 않음), 가로 넘침이 없다
      const inView = (sel: string) => page.evaluate((s) => {
        const el = document.querySelector(s) as HTMLElement | null
        if (!el) return { ok: false, why: 'none' }
        const r = el.getBoundingClientRect()
        // 실제로 보이는 부분 = 뷰포트 ∩ 스크롤 · 잘림이 있는 모든 조상의 표시 범위(판보다 큰 영역은 판 경계에서 잘린다)
        let top = Math.max(r.top, 0), bottom = Math.min(r.bottom, innerHeight), left = Math.max(r.left, 0), right = Math.min(r.right, innerWidth)
        for (let p = el.parentElement; p; p = p.parentElement) {
          const cs = getComputedStyle(p)
          if (!/(auto|scroll|hidden|clip)/.test(cs.overflowY + cs.overflowX)) continue
          const q = p.getBoundingClientRect()
          top = Math.max(top, q.top); bottom = Math.min(bottom, q.bottom); left = Math.max(left, q.left); right = Math.min(right, q.right)
        }
        if (bottom - top < 24 || right - left < 24) return { ok: false, why: `보이는 부분 없음 ${Math.round(r.top)}~${Math.round(r.bottom)}` }
        const hit = document.elementFromPoint((left + right) / 2, (top + bottom) / 2)
        return { ok: Boolean(hit && (el === hit || el.contains(hit))), why: hit ? `가림: ${hit.tagName}.${(hit as HTMLElement).className}`.slice(0, 120) : 'hit 없음' }
      }, sel)
      expect(await inView('[data-testid="workspace-paper"]'), '원문이 뷰포트에 보이지 않는다').toMatchObject({ ok: true })
      for (const [k, r] of Object.entries(regions)) {
        await r.evaluate((el) => el.setAttribute('data-r152', 'probe'))
        await r.scrollIntoViewIfNeeded()
        expect(await inView('[data-r152="probe"]'), `${k} 도구를 화면에서 볼 수 없다(가림 · 뷰포트)`).toMatchObject({ ok: true })
        await r.evaluate((el) => el.removeAttribute('data-r152'))
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), '가로로 넘친다').toBe(true)

      // D3 — Tab 만으로 네 도구 영역에 모두 닿는다(도구 안 첫 단추에서 출발)
      // 「본문 근거 연결」은 결과 패널이다 — 관계(명제 아래 표현)를 고르기 전에는 안내 문장뿐이라 닿을 단추가 없다. 키보드로 관계 하나를 먼저 고른다
      const relBtn = regions.compare.getByRole('group', { name: /등록 의미 관계/ }).first().getByRole('button').first()
      await relBtn.focus()
      await page.keyboard.press('Enter')
      await expect(regions.evidence.getByRole('button', { name: '선택한 관계로 돌아가기' })).toBeVisible()
      // 판단 도구 전체의 첫 조작 요소에서 출발한다(근거 연결 영역이 범위 대조보다 DOM 앞에 있을 수 있다)
      await J.locator('button:visible, [tabindex="0"]:visible').first().focus()
      const reached = new Set<string>()
      for (let i = 0; i < 80 && reached.size < 4; i++) {
        // 보이는 도구 영역(locator)마다 지금 포커스를 품는지 직접 본다 — 이름 문자열 재계산에 기대지 않는다
        for (const [k, r] of Object.entries(regions)) {
          if (await r.evaluate((el) => el.contains(document.activeElement)).catch(() => false)) reached.add(k)
        }
        await page.keyboard.press('Tab')
      }
      expect([...reached].sort(), 'Tab 으로 닿지 못한 도구가 있다').toEqual(Object.keys(regions).sort())

      // D2 — 근거 판(원문 쪽) 스크롤 · 도구 선택이 장면 왕복 뒤 보존, 돌아온 뒤 포커스가 사라지지 않는다. PDF 페이지 · 확대 조작은 제품에 없다
      const ifBtn = regions.scope.getByRole('button', { name: 'If', exact: true })
      if ((await ifBtn.getAttribute('aria-pressed')) !== 'true') await ifBtn.click()
      // 스크롤 판: 기준 요소(지문 지도 · 문제지)를 담은 가장 가까운 스크롤 조상, 없으면 그 안의 첫 스크롤 자손
      const paneScroll = (anchor: string, set?: number) => page.evaluate(([a, v]) => {
        const scrollable = (el: Element) => el.scrollHeight > el.clientHeight + 1 && /(auto|scroll)/.test(getComputedStyle(el).overflowY)
        const base = document.querySelector(a as string)
        if (!base) return -2
        let el: Element | null = base
        while (el && !scrollable(el)) el = el.parentElement
        if (!el) el = [...base.querySelectorAll('*')].find(scrollable) ?? null
        if (!el) return -1
        if (typeof v === 'number') el.scrollTop = v
        return Math.round(el.scrollTop)
      }, [anchor, set] as const)
      const PANES = { '근거 판(지문 지도)': '[data-proof="passage-map"]', '문제지': '[data-testid="workspace-paper"]' }
      const targets: Record<string, number> = {}
      for (const [k, sel] of Object.entries(PANES)) {
        targets[k] = await paneScroll(sel, 160)
        expect(targets[k], `${k} 스크롤 판을 찾지 못했다(또는 스크롤할 내용이 없다)`).toBeGreaterThan(0)
      }
      await page.locator('[data-testid="dock-scene"][data-scene="design"]').click()
      await expect(page.getByTestId('workspace-frame')).toHaveAttribute('data-scene', 'design')
      const back = page.locator('[data-testid="dock-scene"][data-scene="judgment"]')
      await back.focus()
      await page.keyboard.press('Enter')
      await expect(page.getByTestId('workspace-frame')).toHaveAttribute('data-scene', 'judgment')
      for (const [k, sel] of Object.entries(PANES)) await expect.poll(() => paneScroll(sel), { timeout: 5_000, message: `장면 왕복 뒤 ${k} 스크롤이 바뀌었다` }).toBe(targets[k])
      await expect(ifBtn, '장면 왕복 뒤 도구 선택이 사라졌다').toHaveAttribute('aria-pressed', 'true')
      // 포커스 복귀 대상(C7) = 장면 전환을 일으킨 판단 도크 단추 — 키보드로 누른 그 단추에 포커스가 정확히 남아 있어야 한다(문서 맨 위 · 다른 요소로 새지 않음)
      expect(await back.evaluate((el) => el === document.activeElement), '돌아온 뒤 포커스가 복귀 대상(누른 판단 도크 단추)이 아니다').toBe(true)
      await expect(back).toHaveAttribute('aria-current', 'page')
      expect(await page.getByTestId('workspace-paper').locator('input[type="range"], [aria-label*="확대"], [aria-label*="쪽"], [aria-label*="페이지"]').count(), 'PDF 페이지 · 확대 조작이 생겼다면 C7 보존 대상을 다시 정해야 한다').toBe(0)

      // D7 — 원장: 노출 id 마다 정확히 1행 · 같은 id 재전송은 멱등(같은 노출 id) · 같은 id 에 다른 출처는 503 · 정답 없음 · 원장 그대로
      const body0 = exposureBodies[0]
      expect(typeof body0?.clientExposureId, '노출 요청에 clientExposureId 가 없다').toBe('string')
      const rows = async () => {
        const { data, error } = await admin.from('learning_exposures').select('id, kind, source, item_ref, synthetic').eq('client_exposure_id', body0.clientExposureId as string)
        if (error) throw new Error(`원장 조회 실패: ${error.message}`)
        return data ?? []
      }
      const r1 = await rows()
      expect(r1, '노출 1회가 원장 1행이 아니다').toHaveLength(1)
      expect(r1[0]).toMatchObject({ kind: 'answer_direct', source: 'judgment_scene', item_ref: '2026#34', synthetic: true })
      const again = await page.request.post(`/api/csat/item/${SLUG}/judgment`, { data: body0 })
      expect(again.status(), '같은 노출 id 재전송이 실패했다').toBe(200)
      expect((await again.json()).exposureId, '같은 노출 id 재전송이 다른 원장 행을 가리킨다').toEqual(judgments[0].body?.exposureId)
      expect(await rows(), '같은 노출 id 재전송이 원장 행을 늘렸다').toHaveLength(1)
      const clash = await page.request.post(`/api/csat/item/${SLUG}/judgment`, { data: { ...body0, source: 'lecture_full' } })
      expect(clash.status(), '같은 노출 id 를 다른 내용으로 보냈는데 공개됐다').toBe(503)
      const clashBody = await clash.text()
      expect(clashBody, '실패 응답에 정답 자료가 실렸다').not.toMatch(LEAK)
      expect(clashBody).not.toContain('"reveal"')
      expect(clash.headers()['cache-control'] ?? '').toContain('no-store')
      const r2 = await rows()
      expect(r2, '실패한 요청이 원장을 바꿨다').toHaveLength(1)
      expect(r2[0].source).toBe('judgment_scene')
      expect(judgments, '도구 탐색 · 장면 이동이 판단 요청을 보냈다').toHaveLength(1)

      // D8 — 다른 화면에 갔다가 뒤로가기로 돌아오면(bfcache 포함) 캐시된 공개를 재사용하지 않는다: 감춘 상태이거나, 도구가 보인다면 판단 라우트를 새로 거쳤다
      const before = judgments.length
      await page.goto('/csat', { waitUntil: 'domcontentloaded', timeout: 180_000 }) // dev 첫 컴파일 여유(r152-02h 1280 은 30초 기본값에서 끊겼다)
      await page.goBack({ waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('analysis-theater')).toBeVisible({ timeout: 120_000 })
      await page.waitForTimeout(3_000)
      const hidden = await page.getByTestId('judgment-reveal').isVisible().catch(() => false)
      const toolsShown = await page.locator('[data-tool-scene="judgment"]').getByTestId('s2b-compare').isVisible().catch(() => false)
      expect(hidden || (toolsShown && judgments.length > before), '뒤로가기 복귀가 판단 라우트 확인 없이 공개 상태를 보였다').toBe(true)
      expect(consoleErrors.filter((e) => !/Download the React DevTools|favicon/i.test(e)), '콘솔 오류').toEqual([])
      console.log(`R152-02 ${width} exposure=${String(judgments[0].body?.exposureId)} preBodies=${preBodies.length} back=${hidden ? 'hidden' : 'rechecked'}`)
    })
  }
})
