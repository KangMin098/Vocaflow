// apps/web/tests/e2e/23-word-web-reader.spec.ts
//
// **읽기 중 낱말 조회 창의 낱말 그물이 실브라우저에서 뜨는가.**
//
// 플래시카드 쪽은 `22-word-web.spec.ts` 가 덮는다. 여기는 두 번째 표면 —
// 읽다가 모르는 낱말을 눌렀을 때 뜨는 창이다. **두 곳이 같은 것을 보여 주지 않으면
// 학습자는 두 곳을 다른 사전으로 여긴다.**
//
// ── 왜 낱말을 DB 에 물어보고 고르는가 ───────────────────────────────
// 파생어·유의어·반의어는 낱말마다 있지 않다(보유율 58.8%·71.1%·51.5%). 아무 낱말이나
// 누르면 **그물이 없는 낱말**이 걸려 스펙이 "기능이 깨졌다" 로 잘못 죽는다.
// 그래서 화면에 실제로 떠 있는 낱말들을 모은 뒤, **그중 그물이 있는 것을 DB 에 물어**
// 그 낱말을 누른다. 데이터가 바뀌어도 스펙은 살아 있다.
//
// ⚠️ 22-word-web 에서 배운 것: 클래스 선택자는 스타일을 고치면 조용히 어긋난다.
//   여기서는 `data-word` 를 쓴다 — 그것이 클릭 대상을 정하는 **기능상의 계약**이라
//   (`ChapterContent.handleClick` 이 `closest('[data-word]')` 로 읽는다) 스타일과 무관하다.

import { test, expect } from '@playwright/test'
import { loginAsTestUser } from './utils/auth'
import { serviceClient } from './utils/db'

/** 장이 많아 본문이 확실히 있는 발행 도서. */
const BOOK_ID = 'dfa8b6a3-59f1-46ea-b268-dd8ab1ec1cf0' // Clarissa

/** 툴팁의 그물 이름표 — 카드(파생어·비슷한 말·반대말)와 달리 짧다. */
const TOOLTIP_LABELS = /파생|비슷|반대/

test.describe('낱말 그물 — 읽기 중 낱말 조회 창', () => {
  test('본문에서 낱말을 누르면 파생어·유의어·반의어가 뜬다', async ({ page }) => {
    const db = serviceClient()
    test.skip(!db, 'SERVICE_ROLE_KEY 가 없다 — 낱말을 고를 수 없어 건너뛴다')

    await loginAsTestUser(page)
    await page.goto(`/library/books/${BOOK_ID}`, { waitUntil: 'domcontentloaded' })
    await page.waitForLoadState('networkidle')

    // 본문이 렌더될 때까지 — 클릭 대상은 `data-word` 를 단 토큰이다.
    const tokens = page.locator('[data-word]')
    await expect(tokens.first()).toBeVisible({ timeout: 20_000 })

    const onPage = [
      ...new Set(
        (await tokens.evaluateAll((els) =>
          els.map((e) => (e.getAttribute('data-word') ?? '').toLowerCase()),
        )).filter((w) => w.length > 2),
      ),
    ].slice(0, 400)
    expect(onPage.length, '본문에 클릭 가능한 낱말이 없다').toBeGreaterThan(0)

    // 그물이 있는 낱말을 DB 에 물어 고른다 — 없는 낱말을 눌러 놓고 "기능이 깨졌다" 로
    // 결론 내리지 않기 위해서다.
    const { data, error } = await db!
      .from('shared_dictionary')
      .select('word, derived_forms, synonyms, antonyms')
      .in('word', onPage)
      .limit(400)
    expect(error, `사전 조회 실패: ${error?.message}`).toBeNull()

    const withWeb = (data ?? []).find(
      (d: { derived_forms: string[] | null; synonyms: string[] | null; antonyms: string[] | null }) =>
        (d.derived_forms?.length ?? 0) > 0
        || (d.synonyms?.length ?? 0) > 0
        || (d.antonyms?.length ?? 0) > 0,
    ) as { word: string } | undefined

    test.skip(!withWeb, '이 장의 낱말 중 그물을 가진 것이 없다 — 다른 장에서 다시 볼 것')
    console.log(`[word-web/reader] "${withWeb!.word}" 를 누른다`)

    await page.locator(`[data-word="${withWeb!.word}"]`).first().click()

    // 조회 창은 RPC 왕복 뒤에 내용이 찬다.
    const popover = page.locator('text=' + withWeb!.word).first()
    await expect(popover).toBeVisible({ timeout: 10_000 })
    await page.waitForTimeout(1_500)

    const body = (await page.locator('body').textContent()) ?? ''
    const hit = body.match(TOOLTIP_LABELS)?.[0]
    console.log(`[word-web/reader] 이름표 "${hit ?? '(없음)'}"`)
    expect(
      hit,
      `"${withWeb!.word}" 는 사전에 그물이 있는데 조회 창에 안 떴다 — `
        + 'reader-queries 의 select 에서 derived_forms·synonyms·antonyms 가 빠졌는지 확인할 것',
    ).toBeTruthy()
  })
})
