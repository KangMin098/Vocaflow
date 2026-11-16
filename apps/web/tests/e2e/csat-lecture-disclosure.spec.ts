// apps/web/tests/e2e/csat-lecture-disclosure.spec.ts
//
// **강의 정답 공개 경로(P1~P5)** — 실제 해설 화면 · PC 1280 · 1440.
//   ① 고르기 전에는 강의 API 요청도 재생도 없다(레일에 오답 번호 없음)
//   ② 원문부터 — 강의 요청 없음
//   ③ 정답 직접 안내 전까지 — 요청 scope=until · 받은 cue 수 = 경계 · 대본에 정답 낭독 없음 · 경계에서 계속/멈춤/원문
//   ④ 계속 — scope=full 로 다시 받아 경계부터
//
// 세션: npx tsx scripts/e2e-session.mts .auth-csat-lecture-control.json  (계정 없으면 실행 불가 — BLOCKED_AUTH)

import fs from 'node:fs'

import { test, expect } from '@playwright/test'

const STATE_PATH = 'playwright-auth/.auth-csat-lecture-control.json'
const ITEM = process.env.LECTURE_DISCLOSURE_ITEM ?? '2026-22'
const ANSWER_SAID = /정답은\s*[^.?!]{0,12}?(?:일|이|삼|사|오)\s+번/

test.describe('강의 정답 공개 경로', () => {
  test.use({ storageState: STATE_PATH })
  test.beforeAll(() => {
    if (!fs.existsSync(STATE_PATH)) throw new Error(`세션 파일이 없다 — npx tsx scripts/e2e-session.mts .auth-csat-lecture-control.json`)
  })

  for (const width of [1280, 1440]) {
    test(`① ② ③ ④ ${width}px`, async ({ page }) => {
      test.setTimeout(240_000)
      const lectureCalls: string[] = []
      page.on('request', (r) => { if (r.url().includes('/api/csat/lecture')) lectureCalls.push(r.url()) })
      await page.setViewportSize({ width, height: 900 })
      // 첫 컴파일이 느린 dev 서버 — 진입 대기만 늘린다(검사 내용은 그대로)
      await page.goto(`/csat/item/${ITEM}?lecture-silent=1&lecture-debug=1`, { waitUntil: 'domcontentloaded', timeout: 180_000 })
      const theater = page.getByTestId('analysis-theater')
      await expect(theater).toBeVisible({ timeout: 90_000 })

      // ① 고르기 전
      expect(await page.content(), '레일이 오답 번호를 드러낸다').not.toMatch(/오답 [①-⑤] 지우기/)
      expect(lectureCalls).toHaveLength(0)
      // 서버 HTML 의 단추는 하이드레이션 전에도 보인다 — 첫 클릭이 버려지면 선택 창이 열릴 때까지 다시 누른다(열리기 전 강의 요청 0 은 아래에서 그대로 본다)
      await expect(async () => {
        await theater.locator('header button', { hasText: /하이라이트만|상영 시작/ }).click()
        await expect(page.getByTestId('lecture-chooser')).toBeVisible({ timeout: 2_000 })
      }).toPass({ timeout: 60_000 })
      await expect(page.getByTestId('lecture-chooser')).toBeVisible()
      expect(lectureCalls, '고르기 전에 강의를 받았다').toHaveLength(0)

      // ② 원문부터
      await page.getByTestId('lecture-path-self').click()
      await page.waitForTimeout(800)
      expect(lectureCalls).toHaveLength(0)

      // ③ 정답 직접 안내 전까지
      await theater.locator('header button', { hasText: /하이라이트만|상영 시작/ }).click()
      await expect(page.getByTestId('lecture-path-until')).toBeVisible()
      await expect(page.getByTestId('lecture-until-note')).toContainText('단서')
      await page.getByTestId('lecture-path-until').click()
      await expect.poll(() => lectureCalls.at(-1) ?? '').toContain('scope=until')
      await page.getByRole('tab', { name: /읽기 강의/ }).click().catch(() => {})
      const script = await page.getByTestId('reading-lecture').innerText().catch(() => '')
      expect(script).not.toMatch(ANSWER_SAID)
      await expect(page.getByTestId('lecture-boundary')).toBeVisible({ timeout: 120_000 })

      // ④ 계속
      await page.getByTestId('lecture-boundary-continue').click()
      await expect.poll(() => lectureCalls.at(-1) ?? '').not.toContain('scope=until')
      await page.screenshot({ path: `test-results/lecture-disclosure-${width}.png` })
    })
  }
})

// ── 판단 장면 정답 지연 조회 (b) · 화면 간 이동(T-0147 navigation_progress) — 실제 로그인 화면 · 실제 서버 · 개발 DB ──────────────
// 첫 HTML · RSC 응답에 정답 자료가 없고, 「정답 보기」 → 판단 라우트(노출 원장 기록) 200 → 공개 · 장면 이동해도 공개 유지 ·
// 다른 문항으로 가면 그 문항은 다시 감춤(요청 0) · 돌아와도 저장소로 되살리지 않는다. 기록된 노출 id 는 출력해 DB 로 대조한다.
const NAV_ITEM = process.env.JUDGMENT_ITEM ?? '2026-30'
const NAV_OTHER = process.env.JUDGMENT_OTHER ?? '2026-31'
const ANSWER_LEAK = /정답 [①-⑤]|analysis:reject:\d|"selected_as_answer"|"why_correct"|"how_to_reject"/

test.describe('판단 장면 정답 지연 · 화면 이동', () => {
  test.use({ storageState: STATE_PATH })

  for (const width of [1280, 1440]) {
    test(`T-0147 navigation_progress ${width}px`, async ({ page }) => {
      test.setTimeout(300_000)
      await page.setViewportSize({ width, height: 900 })
      const judgments: { status: number; body: unknown }[] = []
      page.on('response', async (r) => {
        if (r.url().includes('/judgment') && r.request().method() === 'POST') judgments.push({ status: r.status(), body: await r.json().catch(() => null) })
      })

      // 첫 응답(HTML · RSC 직렬화) — 로그인 세션 그대로 서버에 직접 묻는다
      for (const slug of [NAV_ITEM, NAV_OTHER]) {
        const html = await (await page.request.get(`/csat/item/${slug}?scene=judgment`, { timeout: 180_000 })).text()
        expect(html, `${slug} 첫 HTML 에 정답 자료`).not.toMatch(ANSWER_LEAK)
        const rsc = await (await page.request.get(`/csat/item/${slug}?scene=judgment`, { headers: { RSC: '1' }, timeout: 180_000 })).text()
        expect(rsc.length, `${slug} RSC 응답이 비었다`).toBeGreaterThan(1000)
        expect(rsc, `${slug} RSC 에 정답 자료`).not.toMatch(ANSWER_LEAK)
      }

      await page.goto(`/csat/item/${NAV_ITEM}?scene=judgment`, { waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('analysis-theater')).toBeVisible({ timeout: 120_000 })
      const reveal = page.getByTestId('judgment-reveal')
      await expect(reveal).toBeVisible()
      expect(judgments, '마운트만으로 정답을 요청했다').toHaveLength(0)

      // 키보드로 「정답 보기」 → 판단 라우트 200(노출 원장 기록 뒤) → 공개 · 포커스는 정답 근거 쪽
      const btn = reveal.getByRole('button', { name: '정답 보기' })
      // 하이드레이션 전 키 입력은 버려진다 — 요청이 나갈 때까지 포커스 + Enter 를 다시(이미 나갔으면 단추가 사라져 더 누르지 않는다)
      await expect(async () => {
        if (judgments.length === 0 && (await btn.count())) {
          await btn.focus()
          await page.keyboard.press('Enter')
        }
        expect(judgments.length).toBe(1)
      }).toPass({ timeout: 90_000, intervals: [3_000] })
      expect(judgments[0].status).toBe(200)
      const exposureId = (judgments[0].body as { exposureId?: unknown })?.exposureId
      expect(typeof exposureId === 'number' || typeof exposureId === 'string').toBe(true)
      console.log(`EXPOSURE ${width} ${NAV_ITEM} ${String(exposureId)}`)
      await expect(page.getByTestId('judgment-reveal')).toHaveCount(0)
      await expect(page.locator('[data-block="analysis:answer"]')).toBeVisible()

      // 장면 이동 — 공개 상태 유지 · 새 요청 없음 · 화면 이동은 학습자 조작으로만
      const sceneBefore = await page.getByTestId('workspace-frame').getAttribute('data-scene')
      await page.getByTestId('scene-next').click()
      await expect(page.getByTestId('workspace-frame')).not.toHaveAttribute('data-scene', sceneBefore ?? '')
      await expect(page.locator('[data-withheld="true"]')).toHaveCount(0)
      expect(judgments).toHaveLength(1)

      // 다른 문항 — 그 문항은 다시 감춤 · 요청 0
      await page.goto(`/csat/item/${NAV_OTHER}?scene=judgment`, { waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('analysis-theater')).toBeVisible({ timeout: 120_000 })
      await expect(page.getByTestId('judgment-reveal')).toBeVisible()
      expect(await page.content()).not.toMatch(/정답 [①-⑤]/)
      expect(judgments).toHaveLength(1)

      // 돌아오기 — 브라우저 bfcache 가 메모리 상태(이미 기록된 공개)를 복원할 수는 있다. 그러나 새 요청은 없고,
      // 받은 정답 자료를 브라우저 저장소(localStorage · sessionStorage)에 남기지 않는다
      await page.goBack({ waitUntil: 'domcontentloaded' })
      await expect(page.getByTestId('analysis-theater')).toBeVisible({ timeout: 120_000 })
      expect(judgments).toHaveLength(1)
      const stored = await page.evaluate(() => [localStorage, sessionStorage].flatMap((s) => Object.keys(s).map((k) => s.getItem(k) ?? '')).join('\n'))
      expect(stored, '정답 자료가 브라우저 저장소에 남았다').not.toMatch(/"why_correct"|"how_to_reject"|"selected_as_answer"|정답 근거|analysis:reject:\d/)
      // 새로 연 문항 화면(같은 문항 새 탭)은 다시 감춘다 — 공개는 다시 요청해야 한다
      const fresh = await page.context().newPage()
      await fresh.setViewportSize({ width, height: 900 })
      await fresh.goto(`/csat/item/${NAV_ITEM}?scene=judgment`, { waitUntil: 'domcontentloaded' })
      await expect(fresh.getByTestId('analysis-theater')).toBeVisible({ timeout: 120_000 })
      await expect(fresh.getByTestId('judgment-reveal')).toBeVisible()
      await fresh.close()
      await page.screenshot({ path: `test-results/judgment-nav-${width}.png` })
    })
  }
})
