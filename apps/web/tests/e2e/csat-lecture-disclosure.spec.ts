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
      await page.goto(`/csat/item/${ITEM}?lecture-silent=1&lecture-debug=1`, { waitUntil: 'domcontentloaded' })
      const theater = page.getByTestId('analysis-theater')
      await expect(theater).toBeVisible({ timeout: 90_000 })

      // ① 고르기 전
      expect(await page.content(), '레일이 오답 번호를 드러낸다').not.toMatch(/오답 [①-⑤] 지우기/)
      expect(lectureCalls).toHaveLength(0)
      await theater.locator('header button', { hasText: /하이라이트만|상영 시작/ }).click()
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
