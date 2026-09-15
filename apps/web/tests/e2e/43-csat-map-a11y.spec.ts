// apps/web/tests/e2e/43-csat-map-a11y.spec.ts
//
// **서버 없이 지문 지도만 띄워 접근성을 실측한다.**
//
// ── 왜 이렇게까지 하나 (실측 2026-09-15) ──────────────────────────────
// 지도의 런타임 검증(`42-csat-item-map`)은 로그인이 필요하고, 로그인은 dev 서버가 Supabase 에
// 붙어야 된다. 그런데 이 머신은 **Node 의 TLS 가 막혀 있다**(TCP 23ms 정상 · curl 401 정상 ·
// `node fetch` = `UND_ERR_CONNECT_TIMEOUT`). 세 사이클 연속 못 돌렸다.
//
// 그래서 **전제를 바꿨다**: 이 컴포넌트의 접근성은 DB 와 아무 상관이 없다 — 마크업과 CSS 에만
// 달렸다. 그러므로 컴포넌트만 담은 정적 HTML 을 미리 구워 두고 그것을 연다.
// 로그인·네트워크·DB 가 전부 필요 없으므로 **CI 에서도 돌고, 이 머신에서도 돈다.**
//
// ⚠️ **굽는 단계가 따로 있는 이유**: Playwright 는 import 하는 TSX 를 **자기 JSX 런타임**으로
//    바꾼다. 그러면 `react-dom/server` 가 «Objects are not valid as a React child» 로 죽는다
//    (createElement 로 바꿔도 컴포넌트 **안쪽** JSX 에서 같은 일이 난다 — 실측). 그래서 렌더는
//    `scripts/build-map-harness.mts` 가 하고 여기서는 결과 파일만 읽는다.
//
//      pnpm --filter web build
//      npx tsx --tsconfig scripts/tsconfig.harness.json scripts/build-map-harness.mts
//      npx playwright test tests/e2e/43-csat-map-a11y.spec.ts
//
// ⚠️ 이것이 `42-…` 를 대신하지는 **않는다.** 여기서 못 보는 것: 서버가 실제로 골격을 내려주는가 ·
//    페이지 전체의 대비 · 진짜 클릭이 상태를 바꾸는가. 그건 로그인이 살아날 때 `42-…` 가 본다.
//    여기서 보는 것은 **컴포넌트 자체의 약속**이다.

import fs from 'node:fs'
import path from 'node:path'

import AxeBuilder from '@axe-core/playwright'
import { test, expect, type Page } from '@playwright/test'

const HARNESS = path.resolve(process.cwd(), 'tests/fixtures/csat-map-harness.html')
const html = fs.existsSync(HARNESS) ? fs.readFileSync(HARNESS, 'utf8') : null

/** 하네스에 넣은 문장 수 — `scripts/build-map-harness.mts` 의 고정값과 같아야 한다. */
const SENTENCE_COUNT = 8

test.describe('지문 지도 — 컴포넌트 접근성 (서버 없음)', () => {
  test.skip(
    html == null,
    'tests/fixtures/csat-map-harness.html 이 없다 — 먼저 구울 것(파일 머리말의 명령 참조)',
  )

  async function mount(page: Page, theme: 'light' | 'dark') {
    await page.setContent(html!.replace('<html lang="ko">', `<html lang="ko" data-theme="${theme}">`), {
      waitUntil: 'load',
    })
    // 전환이 끝난 뒤에 잰다 — 페이드 도중에 재면 조상 opacity 가 한 번 더 합성돼
    // 있지도 않은 대비 위반이 나온다(이 저장소가 2026-09-05 에 겪은 일).
    await page.waitForTimeout(400)
  }

  test('하네스가 실제로 지도를 담고 있다 — 아니면 아래 단언이 아무것도 안 지킨다', async ({ page }) => {
    await mount(page, 'light')
    await expect(page.getByRole('heading', { name: '지문 지도' })).toBeVisible()
    await expect(page.locator('li[aria-label*="번째 문장"]')).toHaveCount(SENTENCE_COUNT)
    expect(await page.locator('button').count(), '칩이 없다').toBeGreaterThan(2)
  })

  for (const theme of ['light', 'dark'] as const) {
    test(`${theme} — axe WCAG2 A/AA 위반 0`, async ({ page }) => {
      await mount(page, theme)
      const res = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .include('main')
        .analyze()
      const lines = res.violations.map(
        (v) =>
          `${v.impact}/${v.id} ×${v.nodes.length} :: ${(v.nodes[0]?.failureSummary || v.help)
            .replace(/\s+/g, ' ')
            .slice(0, 160)}`,
      )
      expect(lines, `${theme} axe 위반`).toEqual([])
    })
  }

  test('390px — 가로로 밀리지 않는다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await mount(page, 'light')
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    )
    expect(overflow, `390px 에서 가로로 ${overflow}px 밀린다`).toBeLessThanOrEqual(1)
  })

  test('390px — 모든 칩이 실제로 44px 이상이다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await mount(page, 'light')
    // **문자열이 아니라 렌더된 기하로 잰다.** `min-h-[44px]` 가 있어도 부모가 줄이면 소용없다.
    const small = await page.locator('button').evaluateAll((els) =>
      els
        .map((e) => ({ r: e.getBoundingClientRect(), t: (e.textContent || '').slice(0, 20) }))
        .filter(({ r }) => r.width > 0 && r.height > 0 && r.height < 44)
        .map(({ r, t }) => `${t} → ${Math.round(r.width)}×${Math.round(r.height)}`),
    )
    expect(small, '44px 미만 터치 타깃').toEqual([])
  })

  test('서버 렌더에 이미 근거가 열려 있다 — 클릭 0 으로 증명이 보인다', async ({ page }) => {
    await mount(page, 'light')
    const lit = await page.locator('li[aria-label*="근거가 여기 있어요"]').count()
    expect(lit, '열린 근거가 없다').toBeGreaterThan(0)
    expect(lit, '전부 열려 있으면 «어디인가» 를 말하지 않는 것이다').toBeLessThan(SENTENCE_COUNT)
  })

  test('위치를 못 찾은 근거도 칩으로 보이고 그렇게 적혀 있다', async ({ page }) => {
    await mount(page, 'light')
    // 조용히 아무 일도 안 일어나는 버튼을 만들지 않는다.
    await expect(page.getByText('위치 없음')).toBeVisible()
  })
})
