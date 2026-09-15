// apps/web/tests/e2e/44-csat-sources-fold.spec.ts
//
// **「스크롤 없이 파악된다」를 숫자로 만든다.**
//
// ── 왜 (2026-09-16) ─────────────────────────────────────────────────
// 원문 적격 화면 재설계의 완료 조건이 「페이지 로드 후 스크롤 없이 KPI·병목 단계·소스
// 현황이 파악되어야 함」이었다. 이건 눈으로 판단하면 **측정이 아니라 인상**이다 —
// 보는 사람의 화면 크기·브라우저 크롬 높이에 따라 답이 달라지고, 다음에 누가 절을
// 하나 끼워 넣어도 아무도 모른다.
//
// 그래서 **실제 렌더 좌표**로 잰다: 세 요소의 아래 끝(y + height)이 뷰포트 높이 안인가.
//
// ⚠️ **1440 을 기준으로 하되 1280 도 함께 잰다.** 요구가 「1440 기준, 1280 에서 깨지지
//   않게」였다. 접힌 위 요구는 1440 에만 걸고, 1280 에서는 **가로 스크롤이 없는지**만
//   본다 — 세로로 밀리는 것은 좁은 화면에서 당연하고, 가로로 밀리는 것은 결함이다.
//
// ⚠️ 관리자 게이트는 `DEV_ADMIN_BYPASS` 로 통과한다. 그게 꺼져 있으면 화면이 로그인으로
//   튕기므로 **조용히 통과시키지 않고 skip 으로 남긴다** — 통과처럼 보이면 안 된다.

import AxeBuilder from '@axe-core/playwright'
import { test, expect } from '@playwright/test'

const ROUTE = '/admin/csat/sources'

/** 접힌 위에 있어야 하는 것 — 완료 조건이 이름으로 부른 셋. */
const MUST_BE_ABOVE_FOLD = [
  { name: 'KPI 4카드', selector: 'section[aria-label="요약"]' },
  { name: '병목 단계', selector: 'section[aria-label="다음 한 걸음"]' },
  // ⚠️ 소스 **표**가 아니라 요약 한 줄이다 — 표는 일곱 축 뒤가 제자리라(판정 기준을 먼저
  //   읽어야 표가 읽힌다) 접힌 위에는 요약만 올렸다(§SourceInventoryStrip).
  { name: '소스 현황 한 줄', selector: 'p:has-text("판정 0인 원천")' },
] as const

async function adminReachable(page: import('@playwright/test').Page): Promise<boolean> {
  const res = await page.goto(ROUTE, { waitUntil: 'domcontentloaded' })
  if (!res || res.status() !== 200) return false
  // 로그인으로 튕겼으면 이 화면의 제목이 없다.
  return (await page.locator('h2', { hasText: '원문 적격' }).count()) > 0
}

test.describe('원문 적격 — 접힌 위', () => {
  test('1440×900 에서 KPI 와 병목 단계가 스크롤 없이 보인다', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    test.skip(!(await adminReachable(page)), 'DEV_ADMIN_BYPASS 가 꺼져 있어 관리자 화면에 못 들어간다')

    const lines: string[] = []
    for (const target of MUST_BE_ABOVE_FOLD) {
      const box = await page.locator(target.selector).first().boundingBox()
      expect(box, `${target.name} 를 화면에서 못 찾았다 (${target.selector})`).not.toBeNull()
      const bottom = Math.round(box!.y + box!.height)
      lines.push(`${target.name}: 아래 끝 ${bottom}px`)
      expect(
        bottom,
        `${target.name} 의 아래 끝이 ${bottom}px 로 900px 을 넘는다 — 스크롤해야 보인다.\n` +
          lines.join(' · '),
      ).toBeLessThanOrEqual(900)
    }
    // 측정값을 남긴다 — 다음에 누가 절을 끼워 넣으면 이 수가 먼저 움직인다.
    console.log(`[fold 1440×900] ${lines.join(' · ')}`)

    await page.screenshot({ path: 'playwright-report/csat-sources-1440.png', fullPage: false })
  })

  test('1280 에서 가로 스크롤이 생기지 않는다', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 900 })
    test.skip(!(await adminReachable(page)), 'DEV_ADMIN_BYPASS 가 꺼져 있어 관리자 화면에 못 들어간다')

    // ⚠️ 표는 제 컨테이너 안에서 가로로 밀려도 된다(overflow-x-auto). 결함은 **문서 전체**가
    //   가로로 미는 것이다 — 그때만 사람이 페이지를 좌우로 끌어야 한다.
    const overflow = await page.evaluate(() => {
      const d = document.documentElement
      return { scrollWidth: d.scrollWidth, clientWidth: d.clientWidth }
    })
    expect(
      overflow.scrollWidth,
      `1280 에서 문서가 가로로 ${overflow.scrollWidth - overflow.clientWidth}px 밀린다`,
    ).toBeLessThanOrEqual(overflow.clientWidth + 1)

    await page.screenshot({ path: 'playwright-report/csat-sources-1280.png', fullPage: false })
  })

  test('소스별 재고 표가 실제로 그려진다 — 스냅샷이 비면 빈 표가 된다', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    test.skip(!(await adminReachable(page)), 'DEV_ADMIN_BYPASS 가 꺼져 있어 관리자 화면에 못 들어간다')

    const table = page.locator('section[aria-label="소스별 원문 관리"]')
    await expect(table).toBeVisible()
    // 21 원천이 스냅샷에 있다(2026-09-16 실측). 한 자리 수로 떨어지면 스캔이 깨진 것이다.
    const rows = await table.locator('tbody > tr').count()
    expect(rows, '소스별 재고 표의 행이 너무 적다 — 스냅샷이 비었는지 본다').toBeGreaterThan(10)
    console.log(`[소스별 재고] 행 ${rows}`)
  })
  test('axe — WCAG 2.1 A/AA 위반이 없다', async ({ page }) => {
    await page.setViewportSize({ width: 1440, height: 900 })
    test.skip(!(await adminReachable(page)), 'DEV_ADMIN_BYPASS 가 꺼져 있어 관리자 화면에 못 들어간다')

    // ⚠️ **main 안만 본다.** 사이드바 같은 전역 크롬은 이 화면이 만든 것이 아니라,
    //   섞으면 남의 위반이 이 화면의 빨간불로 남는다(14-learner-quality 와 같은 판단).
    const result = await new AxeBuilder({ page })
      .include('main')
      .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
      .analyze()

    const lines = result.violations.map(
      (v) => `${v.id} (${v.impact}) × ${v.nodes.length} — ${v.help}`,
    )
    expect(lines, `axe 위반:\n  ${lines.join('\n  ')}`).toEqual([])
  })
})
