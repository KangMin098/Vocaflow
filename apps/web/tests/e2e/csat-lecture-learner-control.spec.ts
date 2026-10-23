// apps/web/tests/e2e/csat-lecture-learner-control.spec.ts
//
// **강의는 학습자의 장면 · 스크롤을 빼앗지 않는다** — PC 1280 · 1440.
//
// 지키는 계약(2026-10-24 사용자 결정 1·3):
//   ① 재생 중 강의가 다른 장면의 블록을 설명해도 장면(주소 scene)이 저절로 바뀌지 않는다 — 안내 단추만 뜬다
//   ② 안내 단추를 누를 때만 그 장면으로 간다(학습자 선택)
//   ③ 학습자가 휠로 스크롤하면 따라가기가 꺼지고, 다음 큐가 와도 화면을 끌고 가지 않는다
//   ④ 「지금 설명 위치로」 를 누르면 따라가기가 다시 켜진다
//
// 세션: npx tsx scripts/e2e-session.mts .auth-csat-lecture-control.json

import fs from 'node:fs'

import { test, expect, type Page } from '@playwright/test'

const STATE_PATH = 'playwright-auth/.auth-csat-lecture-control.json'
const ITEM = process.env.LECTURE_CONTROL_ITEM ?? '2026-34'

const sceneOf = (page: Page) => page.evaluate(() => new URL(window.location.href).searchParams.get('scene'))
const statusOf = (page: Page) =>
  page.evaluate(() => (window as unknown as { __LECTURE__?: { player?: { getState(): { status: string } } | null } }).__LECTURE__?.player?.getState().status ?? 'none')

test.describe('강의 학습자 제어', () => {
  test.use({ storageState: STATE_PATH })

  test.beforeAll(() => {
    if (!fs.existsSync(STATE_PATH)) throw new Error(`세션 파일이 없다 — npx tsx scripts/e2e-session.mts .auth-csat-lecture-control.json`)
  })

  for (const width of [1280, 1440]) {
    test(`① ② ③ ④ ${width}px`, async ({ page }) => {
      test.setTimeout(240_000)
      await page.setViewportSize({ width, height: 900 })
      await page.goto(`/csat/item/${ITEM}?lecture-debug=1&lecture-silent=1`, { waitUntil: 'domcontentloaded' })
      const theater = page.getByTestId('analysis-theater')
      await expect(theater).toBeVisible({ timeout: 90_000 })

      const play = theater.locator('header button', { hasText: /하이라이트만|상영 시작/ })
      await expect(play).toBeVisible({ timeout: 30_000 })
      await play.click()
      await expect.poll(() => statusOf(page), { timeout: 30_000 }).toBe('playing')

      // 학습자가 지금 쥔 선택(눌린 단추 · 고른 항목 · 열린 층 · 주소의 의미/관계) — 강의 진행 뒤에도 같아야 한다
      const choices = () =>
        page.evaluate(() => ({
          pressed: Array.from(document.querySelectorAll('[data-csat-theater] [aria-pressed="true"], [data-csat-theater] [aria-checked="true"], [data-csat-theater] [aria-selected="true"]')).map((el) => el.textContent?.trim().slice(0, 40)),
          open: Array.from(document.querySelectorAll('[data-csat-theater] details')).map((d) => (d as HTMLDetailsElement).open),
          query: ['meaning', 'rel', 'depth'].map((k) => new URL(window.location.href).searchParams.get(k)),
        }))

      // ① 큐를 끝까지 넘기며 장면이 저절로 바뀌는지 본다(→ 는 스크롤 키가 아니다)
      const startScene = await sceneOf(page)
      const startChoices = await choices()
      let offered = false
      for (let i = 0; i < 16; i++) {
        await page.locator('body').press('ArrowRight')
        await page.waitForTimeout(400)
        expect(await sceneOf(page), `큐 ${i + 1}: 장면이 학습자 선택 없이 바뀌었다`).toBe(startScene)
        if (await page.getByTestId('lecture-offer-scene').isVisible()) {
          offered = true
          break
        }
      }

      expect(await choices(), '강의 진행이 학습자의 선택 · 열린 층 · 주소 상태를 바꿨다').toEqual(startChoices)

      // ② 안내가 떴다면 누를 때만 옮긴다
      if (offered) {
        await page.getByTestId('lecture-offer-scene').click()
        await expect.poll(() => sceneOf(page)).not.toBe(startScene)
        // 누른 단추가 사라져도 포커스는 안내 줄에 남는다
        await expect(page.getByTestId('lecture-offer')).toBeFocused()
      } else {
        test.info().annotations.push({ type: 'note', description: '이 문항 강의는 넘긴 범위에서 다른 장면을 설명하지 않았다 — ② 미관측' })
      }

      // ③ 휠 스크롤 → 따라가기 꺼짐 · 다음 큐가 와도 스크롤 위치 유지
      await expect.poll(() => statusOf(page)).toBe('playing')
      await page.mouse.move(width / 2, 450)
      await page.mouse.wheel(0, 300)
      // 따라가기 단추는 늘 있고 켜짐/꺼짐만 바뀐다(aria-pressed)
      const follow = page.getByTestId('lecture-offer-follow')
      await expect(follow).toHaveAttribute('aria-pressed', 'false', { timeout: 5_000 })
      const scrollOf = () =>
        page.evaluate(() => {
          const els = [document.scrollingElement, ...Array.from(document.querySelectorAll<HTMLElement>('[data-csat-theater] *'))].filter(
            (el): el is Element => el != null && el.scrollHeight > el.clientHeight + 1,
          )
          return els.map((el) => Math.round(el.scrollTop)).join(',')
        })
      const before = await scrollOf()
      await page.locator('body').press('ArrowRight')
      await page.waitForTimeout(1_200)
      expect(await scrollOf(), '따라가기를 끈 뒤 강의가 화면을 옮겼다').toBe(before)

      // ④ 학습자가 다시 고르면 켜진다
      await follow.click()
      await expect(follow).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 })
      await expect(follow).toBeFocused()
      await page.screenshot({ path: `test-results/lecture-learner-control-${width}.png` })
    })
  }
})
