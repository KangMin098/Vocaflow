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
      // 서버 HTML 의 단추는 하이드레이션 전에도 보인다 — 느린 dev 서버에서 첫 클릭이 버려지면 경로 선택이 열릴 때까지 다시 누른다
      await expect(async () => {
        await play.click()
        await expect(page.getByTestId('lecture-chooser')).toBeVisible({ timeout: 2_000 })
      }).toPass({ timeout: 60_000 })
      // 정답 공개 경로(P1) — 재생은 경로를 고른 뒤에만 시작한다
      await expect(page.getByTestId('lecture-chooser')).toBeVisible()
      expect(await statusOf(page), '고르기 전에 재생이 시작됐다').not.toBe('playing')
      await page.getByTestId('lecture-path-full').click()
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
      // 요소별로 잰다 — 위치 목록을 문자열로 이으면 다음 큐로 스크롤 가능한 요소가 하나 늘기만 해도 목록이 밀려 오탐한다
      // (실계정 E2E 2026-10-24: `0,75,0,…` → `0,0,75,…`, 기존 값은 그대로). 처음 있던 요소는 같은 요소의 위치를, 새로 생긴 요소는 0 인지를 본다
      // Codex 5822d24b1 REJECT 보완 — 처음 있던 요소는 **같은 요소 참조**로 다시 잰다(overflow 가 빠져도). 사라지거나 교체된 요소는
      // 처음 위치가 0 이 아니었으면 이동으로 본다(같은 영역이 새 노드로 바뀌며 맨 위로 돌아간 경우). 문서 스크롤은 필터와 관계없이 늘 잰다
      const snapshot = () =>
        page.evaluate(() => {
          const w = window as unknown as { __scrollRefs?: Map<string, Element> }
          w.__scrollRefs ??= new Map()
          const els = Array.from(document.querySelectorAll<HTMLElement>('[data-csat-theater] *')).filter((el) => el.scrollHeight > el.clientHeight + 1)
          let n = Number(document.body.dataset.scrollSeq ?? 0)
          const current: Record<string, number> = {}
          for (const el of els) {
            if (!el.dataset.scrollId) el.dataset.scrollId = String(n++)
            w.__scrollRefs.set(el.dataset.scrollId, el)
            current[el.dataset.scrollId] = Math.round(el.scrollTop)
          }
          document.body.dataset.scrollSeq = String(n)
          // 앞서 잰 요소는 지금 overflow 여부와 관계없이 같은 참조로 — 연결이 끊겼으면 gone
          const known: Record<string, number | 'gone'> = {}
          for (const [id, el] of w.__scrollRefs) known[id] = el.isConnected ? Math.round(el.scrollTop) : 'gone'
          return { doc: Math.round(window.scrollY), current, known }
        })
      const before = await snapshot()
      await page.locator('body').press('ArrowRight')
      await page.waitForTimeout(1_200)
      const after = await snapshot()
      const moved: string[] = []
      if (after.doc !== before.doc) moved.push(`document ${before.doc}→${after.doc}`)
      for (const [id, y] of Object.entries(before.current)) {
        const now = after.known[id]
        if (now === 'gone' ? y !== 0 : now !== y) moved.push(`#${id} ${y}→${now}`)
      }
      for (const [id, y] of Object.entries(after.current)) if (!(id in before.current) && y !== 0) moved.push(`new #${id} ${y}`)
      expect(moved, `따라가기를 끈 뒤 강의가 화면을 옮겼다 — 전 ${JSON.stringify(before)} · 후 ${JSON.stringify(after)}`).toEqual([])

      // ④ 학습자가 다시 고르면 켜진다
      await follow.click()
      await expect(follow).toHaveAttribute('aria-pressed', 'true', { timeout: 5_000 })
      await expect(follow).toBeFocused()
      await page.screenshot({ path: `test-results/lecture-learner-control-${width}.png` })
    })

    // 재진입 — 강의 경로는 저장하지 않는다(컴포넌트 상태). 앞 실행에서 「전체(정답 포함)」 를 골랐던 같은 계정 · 같은 문항으로 다시 들어와도
    // 자동 재생 · 강의 요청 · 정답 포함 강의 자동 전환이 없고, 재생을 누르면 경로를 다시 고르게 한다
    test(`재진입 ${width}px — 저장된 경로 복원 없음 · 자동 재생 없음 · 다시 고르기`, async ({ page }) => {
      test.setTimeout(180_000)
      await page.setViewportSize({ width, height: 900 })
      const lectureCalls: string[] = []
      page.on('request', (r) => { if (r.url().includes('/api/csat/lecture')) lectureCalls.push(r.url()) })
      await page.goto(`/csat/item/${ITEM}?lecture-debug=1&lecture-silent=1`, { waitUntil: 'domcontentloaded' })
      const theater = page.getByTestId('analysis-theater')
      await expect(theater).toBeVisible({ timeout: 90_000 })
      await page.waitForTimeout(3_000)
      expect(await statusOf(page), '재진입에서 저절로 재생됐다').not.toBe('playing')
      expect(lectureCalls, '고르기 전에 강의를 받았다').toEqual([])
      const play = theater.locator('header button', { hasText: /하이라이트만|상영 시작/ })
      await expect(async () => {
        await play.click()
        await expect(page.getByTestId('lecture-chooser')).toBeVisible({ timeout: 2_000 })
      }).toPass({ timeout: 60_000 })
      expect(lectureCalls, '선택 창을 여는 것만으로 강의를 받았다').toEqual([])
      // 「정답 직전까지」 를 고르면 until 만 — 앞서 고른 전체로 자동 전환되지 않는다
      await page.getByTestId('lecture-path-until').click()
      await expect.poll(() => lectureCalls.at(-1) ?? '').toContain('scope=until')
      expect(lectureCalls.every((u) => u.includes('scope=until'))).toBe(true)
    })
  }
})
