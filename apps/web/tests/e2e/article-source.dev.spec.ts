// apps/web/tests/e2e/article-source.dev.spec.ts
// 기사 원문 출처 링크 — 실제 ReadingUniverse + /dev/article-source(합성 문단 · 주입 주소).
// 공개 주소 링크 · 새 탭 · noopener · 44px · 키보드 초점 · 부적합 주소 숨김 · 장 표식과 중복 없음 · 쓰기 없음.
// 개발 서버 전용 — 실제 /text/[id] 개봉 · DB 결속은 증명하지 않는다(단위 테스트·타입이 맡는다).
import { expect, test, type Page } from '@playwright/test'

async function open(page: Page, query = '') {
  const writes: string[] = []
  await page.route('**/*', (route) => {
    const r = route.request()
    if (r.method() !== 'GET' || /supabase|analytics|funnel|\/api\//.test(r.url())) {
      writes.push(`${r.method()} ${new URL(r.url()).pathname}`)
      return route.abort()
    }
    return route.continue()
  })
  await page.goto(`/dev/article-source${query}`)
  await expect(page.getByText('The river rose slowly')).toBeVisible()
  return writes
}

for (const width of [1280, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 900 } })

    test('공개 주소 → 원문 출처 링크(새 탭 · noopener · 44px · 초점)', async ({ page }) => {
      const writes = await open(page)
      const link = page.getByRole('link', { name: /원문 출처 bbc\.com/ })
      await expect(link).toHaveCount(1)
      await expect(link).toHaveText('원문 출처 · bbc.com ↗')
      await expect(link).toHaveAttribute('target', '_blank')
      await expect(link).toHaveAttribute('rel', 'noopener noreferrer')
      const box = await link.boundingBox()
      expect(box!.height).toBeGreaterThanOrEqual(44)
      await link.focus()
      await expect(link).toBeFocused()
      const outline = await link.evaluate((el) => getComputedStyle(el).outlineStyle)
      expect(outline).not.toBe('none')
      await page.screenshot({ path: `test-results/article-source-${width}.png`, fullPage: true })
      expect(writes).toEqual([])
    })

    test('부적합 주소 · 주소 없음 → 링크 없음', async ({ page }) => {
      for (const q of ['?src=javascript:alert(1)', '?src=article:123e4567-e89b-12d3-a456-426614174000', '?src=none']) {
        await open(page, q)
        await expect(page.getByRole('link', { name: /원문 출처/ })).toHaveCount(0)
      }
    })

    test('장 표식 출처가 있으면 하나만', async ({ page }) => {
      await open(page, '?chapter=1')
      await expect(page.getByRole('link', { name: /원문 출처/ })).toHaveCount(1)
      await expect(page.getByRole('link', { name: /gutenberg\.org/ })).toHaveCount(1)
    })
  })
}
