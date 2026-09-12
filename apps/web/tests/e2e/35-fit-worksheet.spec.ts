// apps/web/tests/e2e/35-fit-worksheet.spec.ts
//
// **인쇄물이 빈 장을 달고 나오는 것**을 잡는다 — 인쇄해 보기 전에는 아무도 모르는 실패다.
//
// 2026-08-26 실측: 학습지를 결과 화면 안에 두고 `visibility: hidden` 으로 나머지를 지웠다.
// 잉크는 정확했다 — 화면 캡처로도, print 미디어 스크린샷으로도 멀쩡해 보였다.
// 그런데 **문서 높이가 그대로라 1장짜리 목록이 4쪽으로 인쇄됐다.**
// 교사는 그것을 인쇄기 앞에서 알게 된다. 종이 세 장을 버린 뒤에.
//
// 그래서 **실제 PDF 를 만들어 쪽수를 센다.** 이것 말고 이 실패를 잡는 방법이 없다.
//
// (`display:none` 으로 접으면 조상과 함께 학습지까지 사라져 쓸 수 없다. 그래서 학습지는
//  `document.body` 직속으로 portal 하고 `body > *:not(.vf-sheet)` 만 접는다.)

import { readFileSync } from 'node:fs'
import { test, expect, type Page } from '@playwright/test'

/** 비로그인 — 교사가 처음 오는 상태 그대로. 인쇄물은 가입 없이 나와야 한다. */
test.use({ storageState: { cookies: [], origins: [] } })

const SAMPLE = [
  'Photosynthesis is the process by which plants convert sunlight into chemical energy.',
  'This apparent simplicity conceals an intricate cascade of reactions,',
  'and the nuance of each step still puzzles researchers.',
  'Other organisms have evolved different strategies to harvest light,',
  'and some bacteria exploit wavelengths that plants ignore entirely.',
].join(' ')

/** PDF 안의 페이지 객체를 센다 — 라이브러리 없이 쪽수만 알면 된다. */
function pdfPageCount(path: string): number {
  const raw = readFileSync(path).toString('latin1')
  return (raw.match(/\/Type\s*\/Page[^s]/g) ?? []).length
}

async function analyze(page: Page) {
  await page.goto('/fit', { waitUntil: 'domcontentloaded' })
  await page.locator('textarea').first().fill(SAMPLE)
  await page.waitForSelector('section[aria-label="수업에 쓰기"]', { timeout: 60_000 })
}

test.describe('/fit — 인쇄 학습지', () => {
  test('화면에는 안 보이고, 인쇄하면 고른 만큼만 나온다', async ({ page }, testInfo) => {
    await analyze(page)

    // 결과 화면이 두 배로 길어지면 안 된다 — 미리보기는 브라우저의 몫이다.
    await expect(page.locator('.vf-sheet')).toBeHidden()

    const cases: ReadonlyArray<{ label: string; pages: number }> = [
      { label: '어휘 목록', pages: 1 },
      { label: '빈칸 확인', pages: 1 },
      { label: '둘 다', pages: 2 },
    ]

    for (const c of cases) {
      await page.getByRole('radio', { name: c.label }).click()
      const file = testInfo.outputPath(`worksheet-${c.pages}-${c.label}.pdf`)
      await page.pdf({ path: file, format: 'A4' })

      expect(
        pdfPageCount(file),
        `"${c.label}" 이 ${c.pages}쪽이 아니다 — 빈 장이 딸려 나오면 교사는 인쇄기 앞에서 안다`,
      ).toBe(c.pages)
    }
  })

  test('학습지에 지문이 실리지 않는다 — 붙여넣은 글은 저장도 인쇄도 하지 않는다', async ({
    page,
  }, testInfo) => {
    await analyze(page)
    await page.getByRole('radio', { name: '어휘 목록' }).click()

    const file = testInfo.outputPath('worksheet-no-passage.pdf')
    await page.pdf({ path: file, format: 'A4' })
    const raw = readFileSync(file).toString('latin1')

    // 지문에만 있고 낱말 목록에는 없는 구절. 이것이 PDF 에 있으면 원문이 새어 나간 것이다.
    // (PDF 텍스트는 압축될 수 있어 **없음**만 신뢰한다 — 그래서 이 검사는 한 방향이다.)
    expect(raw).not.toContain('by which plants convert')
    expect(raw).not.toContain('still puzzles researchers')
  })

  /**
   * QR 이 사라지거나 촘촘해지는 것을 잡는다.
   *
   * QR 은 **모듈 크기가 전부**다. 담는 주소가 길어지면 모듈 수가 늘고 같은 지면에서
   * 각 모듈이 작아진다 — 화면에서는 멀쩡해 보이고 **종이에서만 실패한다.**
   * (실측: `/fit/s/<payload>` 434자 → 81×81 → 30mm 에서 0.37mm/모듈, 복사본에서 불가.
   *  `/fit` 25자 → 25×25 → 1.20mm/모듈. 지면에서 잘라 독립 디코더로 읽히는 것을 확인했다.)
   *
   * 밀도 자체는 `lib/worksheet/__tests__/qr.test.ts` 가 못 박는다. 여기서는
   * **지면에 실제로 실렸는지**와 크기가 사람이 찍을 만한지를 본다.
   */
  test('인쇄 지면에 QR 이 실린다 — 종이에서 웹으로 돌아오는 유일한 길이다', async ({ page }) => {
    await analyze(page)
    await page.emulateMedia({ media: 'print' })

    const qr = page.locator('.vf-sheet svg').first()
    await expect(qr, '지면에 QR 이 없다 — 종이를 집어 든 사람이 돌아올 길이 사라졌다').toHaveCount(1)

    const box = await qr.boundingBox()
    expect(box, 'QR 이 그려지지 않았다').not.toBeNull()
    // 22mm 하한(약 83px @96dpi)보다 작으면 찍기 어렵다. printSizeMm 이 그 하한을 지킨다.
    expect(box!.width, `QR 이 ${Math.round(box!.width)}px 로 너무 작다`).toBeGreaterThan(60)
  })
})
