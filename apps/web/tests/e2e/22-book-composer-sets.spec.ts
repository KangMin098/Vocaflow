// apps/web/tests/e2e/22-book-composer-sets.spec.ts
// 컴포저 단어장이 **읽으려는 자리**에서 만나지는지 (v06.35).
//
// 지키는 것: 도서 상세의 "보조 단어장" 자리에 이 책으로 만든 단어장(해금·재등장)이 뜨고,
// 각 카드가 **왜 이 목록인지**를 학습자 말로 말한다.
//
// 왜 이 spec 이 필요한가: 이 자리는 v06.31 부터 "아직 준비되지 않았어요" 로 비어 있었다.
// 세트를 발행해도 학습자가 만나지 못하면 없는 것과 같은데, 발행은 DB 에서 성공으로 보이므로
// 화면 단언 없이는 그 상태를 알 수 없다. (같은 함정을 category='library_book' 로 한 번 밟았다 —
// 발행됐는데 카탈로그 9 카테고리에 없어서 보이지 않았다.)
//
// 비로그인으로 검증한다 — 도서 카탈로그는 공개 유지 대상이고(apps/web/CLAUDE.md),
// enroll 한 계정은 학습 재개로 redirect 되므로 `?preview=1` escape hatch 를 쓴다.

import { test, expect, type Page } from '@playwright/test'

/** Pride and Prejudice — 61챕터. unlock/recycle 세트가 이 책으로 발행돼 있다. */
const BOOK_ID = 'ac506006-6147-4d23-8dba-72698eb7e9ae'

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = []
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 200))
  })
  page.on('pageerror', (e) => errors.push(`PAGEERROR: ${String(e).slice(0, 200)}`))
  return errors
}

function fatalErrors(errors: string[]): string[] {
  return errors.filter(
    (e) => !/favicon|404 \(Not Found\)|auth-js|auth\/v1\/token|Failed to fetch|ChunkLoadError/.test(e),
  )
}

test.describe('도서 상세 — 이 책으로 만든 단어장', () => {
  test('보조 단어장 자리에 해금·재등장 세트가 이유와 함께 뜬다', async ({ page }) => {
    test.setTimeout(120_000)
    const errors = collectConsoleErrors(page)

    await page.goto(`/library/books/${BOOK_ID}?preview=1`, {
      waitUntil: 'domcontentloaded',
      timeout: 60_000,
    })

    const supplementary = page.getByText('보조 단어장 (선택)')
    await expect(supplementary).toBeVisible({ timeout: 30_000 })

    // 자리가 채워졌다 — 종전 placeholder 문구가 남아 있으면 배선이 끊긴 것이다.
    await expect(page.getByText('아직 준비되지 않았어요')).toHaveCount(0)

    await supplementary.click()

    // 해금 — 이 유형의 값(열리는 문장 수)이 학습자 말로 나온다
    await expect(page.getByText(/이 \d+단어를 알면 이 책의 문장 [\d,]+개가 온전히 읽혀요/)).toBeVisible()

    // 재등장 — 재등장 평균을 숫자로 내걸지 않는다 (과장처럼 읽히고 숫자 게이지 금지)
    await expect(page.getByText(/배운 뒤 이 책에서 다시 만나는 단어부터예요/)).toBeVisible()
    await expect(page.getByText(/평균 \d+번 더 만나요/)).toHaveCount(0)

    // 챕터 목록(61개)과 섞이지 않는다 — 두 목록은 고르는 기준이 다르다
    await expect(page.getByText(/읽는 순서가 아니라/)).toBeVisible()

    expect(fatalErrors(errors), `콘솔 에러: ${fatalErrors(errors).join(' | ')}`).toHaveLength(0)
  })
})
