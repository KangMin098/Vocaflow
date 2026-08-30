// apps/web/tests/e2e/39-library-catalog-reveal.spec.ts
//
// **도서 카탈로그가 카탈로그와 함께 무거워지지 않는가** — 점진 노출의 회귀.
//
// ── 왜 (실측 2026-08-30) ────────────────────────────────────────────────
// 상한이 없을 때 `/library/books` 의 HTML 은 **1.79MB** 였고, 그중 79%가 발행 316권을
// 전부 서버 렌더한 카드 DOM 이었다. 이 비용은 카탈로그와 **선형으로** 자란다 —
// 발행 대기가 303권 더 있으므로 그냥 두면 다음 발행 물결에서 3MB 를 넘긴다.
//
// 그래서 처음 60장만 그리고 나머지는 접는다(`BooksExplorer` 의 GRID_PAGE).
// 이 스펙이 지키는 것은 **두 방향 모두**다:
//   · 접혀 있는가 — 초기 HTML 이 예산 안이다 (안 접히면 다시 무거워진다)
//   · 펼 수 있는가 — 눌러서 실제로 더 나온다 (접기만 하고 길을 막으면 그건 기능 삭제다)
//
// ⚠️ 바이트 예산은 **전체 HTML** 로 잰다. 카드 DOM 만 재면 셸·RSC 데이터가 자라는 것을
//    놓치고, 학습자가 실제로 내려받는 것은 전체다.
//
// ── ⚠️ 이 예산이 재는 것은 **네트워크가 아니다** (2026-08-30 정정) ─────────
// 처음에는 이 상한의 근거를 "1.79MB → 0.89MB 전송량 개선" 으로 적었다. **틀린 프레이밍이었다.**
// 응답은 gzip 으로 나가고, 무게의 대부분은 행마다 반복되는 Tailwind class 문자열이라
// 압축이 거의 다 먹는다 — 실측 전송량은 **149KB → 111KB** 로 25% 차이일 뿐이다.
//
// 이 상한이 실제로 지키는 것은 **브라우저가 만들 DOM 과 하이드레이션 비용**이다.
// 4배 CPU 감속 · 390px 실측:
//     316장 전량  6,450 노드 · FCP 15.3초
//      60장 접음  2,063 노드 · FCP  9.1초   (-40%)
// 우리 목표 사용자는 데스크톱이 아니다. 원바이트는 **노드 수의 대리 지표**로 쓴다 —
// 재기 쉽고 회귀에 민감해서다. 다만 개선을 말할 때는 바이트가 아니라 노드·FCP 로 말할 것.

import { test, expect } from '@playwright/test'

/** 비로그인 — 카탈로그는 공개 표면이고, 가장 무거운 경우가 그쪽이다(추천 레일이 다 뜬다). */
test.use({ storageState: { cookies: [], origins: [] } })

/**
 * 초기 HTML 예산.
 *
 * 실측: 접기 전 1,829,901B → 접은 뒤 852,455B (2026-08-30, 발행 316권).
 * 1.2MB 는 지금 값에 여유를 둔 선이다 — 카드 60장은 카탈로그가 늘어도 그대로이므로,
 * 여기를 넘긴다면 카드 수가 아니라 **다른 무언가**가 자란 것이고 그때 다시 봐야 한다.
 */
const HTML_BUDGET = 1_200_000

test.describe('도서 카탈로그 — 점진 노출', () => {
  test('초기 HTML 이 예산 안이고, 전량을 서버에서 그리지 않는다', async ({ request }) => {
    const res = await request.get('/library/books')
    expect(res.status()).toBe(200)

    const html = await res.text()
    expect(
      html.length,
      `초기 HTML 이 ${html.length}B — 예산 ${HTML_BUDGET}B 초과. 그리드 상한이 풀렸는지 본다`,
    ).toBeLessThan(HTML_BUDGET)

    // 카드가 전량 그려졌는지는 **개수**로 본다. 스포트라이트·레일이 있으므로 60보다는
    // 많지만, 카탈로그 전체(수백)보다는 훨씬 적어야 한다.
    const cards = (html.match(/role="listitem"/g) ?? []).length
    expect(cards, '전체 탐색 그리드가 접히지 않았다').toBeLessThan(200)
  })

  test('“더 보기”로 실제로 더 나오고, 남은 수를 숫자로 말한다', async ({ page }) => {
    await page.goto('/library/books', { waitUntil: 'domcontentloaded' })

    const grid = page.getByRole('list').filter({ has: page.getByRole('listitem') }).last()
    await expect(grid).toBeVisible()

    const more = page.getByRole('button', { name: /권 더 보기/ })
    // 카탈로그가 60권 이하면 이 검사는 성립하지 않는다 — 조용히 통과시키지 않고 말한다.
    const hasMore = await more.isVisible().catch(() => false)
    test.skip(!hasMore, '발행 도서가 한 화면 분량(60권) 이하 — 접을 것이 없다')

    // 몇 권 중 몇 권을 보고 있는지 화면이 말해야 한다("더 보기" 만으로는 판단할 수 없다).
    const counter = page.locator('text=/^\\d+ \\/ \\d+$/').last()
    await expect(counter).toBeVisible()
    const before = await counter.innerText()

    const countBefore = await page.getByRole('listitem').count()
    await more.click()

    await expect
      .poll(async () => page.getByRole('listitem').count(), {
        message: '더 보기를 눌렀는데 카드가 늘지 않았다',
        timeout: 10_000,
      })
      .toBeGreaterThan(countBefore)

    await expect(counter, '카운터가 그대로다 — 늘어난 것을 말하지 않는다').not.toHaveText(before)
  })

  test('필터를 바꾸면 펼친 만큼이 되돌아간다', async ({ page }) => {
    await page.goto('/library/books', { waitUntil: 'domcontentloaded' })

    const more = page.getByRole('button', { name: /권 더 보기/ })
    test.skip(!(await more.isVisible().catch(() => false)), '접을 것이 없다')

    await more.click()
    const counter = page.locator('text=/^\\d+ \\/ \\d+$/').last()
    await expect(counter).toContainText('120 /')

    // 조건을 바꾼다 — 정렬 하나면 충분하다(목록이 달라지는 것이 요점).
    const sort = page.getByRole('combobox').first()
    if (await sort.isVisible().catch(() => false)) {
      await sort.selectOption({ index: 1 })
      await expect(
        counter,
        '조건을 바꿨는데 펼친 장수가 그대로다 — 새 목록이 통째로 쏟아진다',
      ).toContainText('60 /')
    } else {
      test.skip(true, '정렬 컨트롤을 못 찾았다 — 필터 UI 가 바뀌었는지 본다')
    }
  })
})
