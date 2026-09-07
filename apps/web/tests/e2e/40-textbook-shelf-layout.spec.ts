// apps/web/tests/e2e/40-textbook-shelf-layout.spec.ts
//
// **교재 매대의 레이아웃 회귀** — 브라우저에서만 보이는 것.
//
// ── 왜 이 스펙이 생겼나 (실측 2026-09-01) ──────────────────────────────
// 같은 날 매대에서 두 가지가 조용히 무너졌고, **어떤 가드도 잡지 못했다.**
//
//   ① 표지를 키우자 모바일에서 **온전히 보이는 상품이 0개**가 됐다.
//      1열 격자 + 409px 표지 → 카드 636px = 뷰포트(844px)의 75%.
//      이미지 면적은 4.48% → 17.88% 로 올랐다. 그 축만 보면 성공이었다.
//   ② 매대의 본문 font-size 가 9종 → **11종**으로 늘었다.
//      `shelf-scale.ts` 가 스케일을 못 박고 테스트도 통과했다 —
//      그 테스트는 **매대 컴포넌트의 `text-[…px]` 만** 훑기 때문이다.
//      레벨 차트가 9.5px·11.5px 를 쓰고 있었고 가드 밖이었다.
//
// 둘 다 렌더된 문자열로는 안 보인다. `shelf-probes.test.tsx` 는 probe 문자열이 살아 있는지
// 보고, `shelf-scale.test.ts` 는 소스의 클래스를 본다 — **레이아웃이 끝난 뒤의 값**을
// 묻는 자리가 없었다. 손으로 `shelf-ux-probe.mjs` 를 돌려서 알았을 뿐이다.
//
// ── 무엇을 묻는가 ──────────────────────────────────────────────────────
// 경쟁사를 부르지 않는다(네트워크·느림·불안정). **우리 화면만** 보고, 기준선은
// 그때 실측한 값을 근거와 함께 적어 둔다. 경쟁 비교는 `shelf-ux-probe.mjs` 소관이다.
//
// ⚠️ 임계값은 **목표가 아니라 하한**이다. 여기를 올려서 점수를 만드는 것이 아니라,
//    "여기 밑으로 내려가면 그건 사고" 인 선을 긋는다.

import AxeBuilder from '@axe-core/playwright'
import { test, expect } from '@playwright/test'

const SHELF = '/library/textbooks'

/** 매대는 비로그인 공개 표면이다(apps/web/CLAUDE.md 공개 표면 표) — 로그인 없이 잰다. */
test.describe('교재 매대 레이아웃 (공개 표면)', () => {
  /**
   * 첫 화면에 **온전히** 보이는 상품 수.
   * 반만 보이는 카드는 "있다" 는 신호일 뿐 고를 수 있는 상품이 아니라 세지 않는다 —
   * `shelf-ux-probe.mjs` 의 `visibleInFold` 와 같은 정의다(자와 가드가 같은 것을 세야 한다).
   */
  async function fullyVisibleCards(page: import('@playwright/test').Page) {
    return page.evaluate(() => {
      const cards = Array.from(document.querySelectorAll('[data-volume-card]'))
      const vh = window.innerHeight
      return cards.filter((c) => {
        const r = c.getBoundingClientRect()
        const top = r.top + window.scrollY
        return top >= 0 && top + r.height <= vh
      }).length
    })
  }

  for (const [label, viewport, floor] of [
    // 실측 2026-09-01 — 고친 뒤 모바일 2 · 데스크톱 2. 상업 기준선(NE능률)은 둘 다 3.
    // 하한을 2 로 잡는 이유: 1 이면 "한 개씩 넘겨 보는 화면" 이고, 0 은 상품을 하나도
    // 다 못 보는 상태다(실제로 0 이었다). 3 을 하한으로 걸지 않는 이유는 표지 면적과
    // 맞바꿔야 하는 값이라 — 그 결정은 지수 리포트에서 하고 여기서는 사고만 막는다.
    ['mobile', { width: 390, height: 844 }, 2],
    ['desktop', { width: 1280, height: 900 }, 2],
  ] as const) {
    test(`${label}: 첫 화면에 상품이 ${floor}개 이상 온전히 보인다`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto(SHELF, { waitUntil: 'networkidle' })

      // 재고를 못 읽으면 카드가 안 그려질 수 있다 — 그때는 레이아웃을 판정할 수 없다.
      // 조용히 통과시키지 않고 **왜 못 쟀는지** 남긴다.
      const cards = await page.locator('[data-volume-card]').count()
      expect(cards, '상품 카드가 하나도 없다 — 재고 조회가 막혔는지 먼저 볼 것').toBeGreaterThan(0)

      const visible = await fullyVisibleCards(page)
      expect(
        visible,
        `${label} 첫 화면에 온전히 보이는 상품 ${visible}개 — 표지·머리글이 커지면 여기가 먼저 깎인다. ` +
          `자세한 비교는 scripts/textbook/shelf-ux-probe.mjs`,
      ).toBeGreaterThanOrEqual(floor)
    })
  }

  test('본문 font-size 종류가 늘어나지 않는다', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await page.goto(SHELF, { waitUntil: 'networkidle' })

    const sizes = await page.evaluate(() => {
      const main = document.querySelector('main') ?? document.body
      const seen = new Map<string, string>()
      for (const el of Array.from(main.querySelectorAll('*'))) {
        // 텍스트를 **직접** 가진 요소만 — 감싸는 div 까지 세면 상속값이 중복된다.
        const own = Array.from(el.childNodes).some(
          (n) => n.nodeType === 3 && n.textContent && n.textContent.trim(),
        )
        if (!own) continue
        const r = el.getBoundingClientRect()
        if (r.width === 0 || r.height === 0) continue
        const fs = getComputedStyle(el).fontSize
        if (!seen.has(fs)) seen.set(fs, `${el.tagName.toLowerCase()} «${(el.textContent ?? '').trim().slice(0, 16)}»`)
      }
      return [...seen.entries()].sort((a, b) => parseFloat(a[0]) - parseFloat(b[0]))
    })

    // 실측 2026-09-01: 고친 뒤 9종. 그중 매대가 만드는 것은 스케일 7종(`shelf-scale.ts`)이고
    // 나머지는 앱 셸(13.5px 하위 내비)·sr-only(14px)·SVG 표지 텍스트다.
    // ⚠️ 하한이 아니라 **상한**이다 — 늘어나는 쪽이 사고다(9 → 11 이 실제로 났다).
    //    새 크기가 정말 필요하면 `shelf-scale.ts` 를 먼저 고치고 이 숫자를 함께 올릴 것.
    const CAP = 9
    expect(
      sizes.length,
      `본문 font-size ${sizes.length}종 (상한 ${CAP}) — ${sizes.map(([s, ex]) => `${s} ${ex}`).join(' · ')}`,
    ).toBeLessThanOrEqual(CAP)
  })
})

/**
 * **심각 이상 접근성 위반 0** — 공개 매대는 아무나 오는 화면이다.
 *
 * ── 왜 여기서도 재나 (실측 2026-09-01) ────────────────────────────────
 * `shelf-ux-probe.mjs` 에 이 축(U7)을 새로 넣자마자 **우리 쪽에서 하나가 나왔다**:
 *   serious/color-contrast ×2 — 표지 배지가 `--active`(금색) 위에 `--bg`(종이)를 얹어
 *   대비 3.23:1 (10px bold 는 4.5:1 필요).
 *
 * 뼈아픈 것은 **토큰이 이미 그 답을 갖고 있었다**는 점이다 —
 * `--on-active` 는 주석에 같은 값(3.24:1)을 적어 두고 정확히 이 실수를 막으려고 만든 토큰이다.
 * 그런데 새 배지가 다시 밟았고, 손으로 재기 전까지 아무도 몰랐다.
 * 그래서 지수 리포트에만 두지 않고 여기로 내린다.
 *
 * ⚠️ 0 을 요구한다 — "경쟁사보다 적게" 가 아니라 **없어야** 한다.
 *    경쟁 비교(U7)는 지수 리포트 소관이고, 여기는 우리 화면의 하한이다.
 *    (참고 실측: NE능률 3종 · 비상교재 0~1종. 낮은 바가 아니다.)
 */
test.describe('교재 매대 접근성 (공개 표면)', () => {
  for (const [label, viewport] of [
    ['mobile', { width: 390, height: 844 }],
    ['desktop', { width: 1280, height: 900 }],
  ] as const) {
    test(`${label}: 심각 이상 위반이 없다`, async ({ page }) => {
      await page.setViewportSize(viewport)
      await page.goto(SHELF, { waitUntil: 'networkidle' })

      const res = await new AxeBuilder({ page })
        // 태그·범위를 `shelf-ux-probe.mjs` 와 같게 맞춘다 — 자와 가드가 다른 것을 세면 둘 다 못 믿는다.
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .include('main')
        .analyze()

      const bad = res.violations.filter((v) => v.impact === 'serious' || v.impact === 'critical')
      expect(
        bad.map((v) => `${v.impact}/${v.id} ×${v.nodes.length} :: ${(v.nodes[0]?.failureSummary ?? v.help).replace(/\s+/g, ' ').slice(0, 140)}`),
        `${label} 매대에 심각 이상 접근성 위반`,
      ).toEqual([])
    })
  }
})
