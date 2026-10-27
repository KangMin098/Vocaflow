// apps/web/tests/e2e/scriptquiz-evidence.dev.spec.ts
// T-0193 — 채점 뒤 근거 문장 짚기. 개발 서버 + 실제 QA 로그인(storageState) 전용 — CI 대상 아님.
// 데모 세션(서버 샘플 채점 · DB 없음). ⚠️ 마지막 문항 뒤 결과로 넘기지 않는다 — 넘기면 점수가 기록된다.
import { expect, test, type Page } from '@playwright/test'

const STATE = process.env.QA_STORAGE_STATE
test.skip(!STATE, 'QA_STORAGE_STATE 없음 — 실로그인 세션이 필요하다')
test.use({ storageState: STATE })

const MIN = 44

async function startDemo(page: Page) {
  await page.goto('/scriptquiz/play')
  await page.getByRole('button', { name: /시작/ }).first().click()
  await expect(page.getByText('01 / 05')).toBeVisible()
}

async function answerWithKey(page: Page, key: string) {
  await page.keyboard.press(key)
  await expect(page.locator('[aria-live="polite"]').filter({ hasText: /맞혔어요|아쉬워요/ })).toBeVisible()
  // 판정 상자의 등장 애니메이션(스케일)이 끝난 뒤에 잰다 — 도중에는 크기가 작게 읽힌다
  await page.waitForFunction(() => document.getAnimations().every((a) => a.playState !== 'running'))
}

for (const width of [1280, 1440]) {
  test.describe(`${width}px`, () => {
    test.use({ viewport: { width, height: 1000 } })

    test('채점 전 근거 비노출 → 답 → 피커(근거 숨김) → Tab·Enter 선택 → 등록 근거 대조 · Enter 로 다음', async ({ page }) => {
      await startDemo(page)
      await expect(page.getByTestId('evidence-picker')).toHaveCount(0)
      await expect(page.getByText('스크립트 근거')).toHaveCount(0)
      await answerWithKey(page, '1')
      const picker = page.getByTestId('evidence-picker')
      await expect(picker).toBeVisible()
      await expect(page.getByText('스크립트 근거')).toHaveCount(0)
      const options = picker.locator('[data-evidence-option]')
      await expect(options).toHaveCount(4)
      for (let i = 0; i < 4; i++) expect((await options.nth(i).boundingBox())!.height).toBeGreaterThanOrEqual(MIN)
      // 피커 중 Enter 는 다음으로 넘기지 않는다
      await options.nth(0).focus()
      const ring = await options.nth(0).evaluate((el) => getComputedStyle(el).outlineStyle)
      expect(ring).not.toBe('none')
      await page.keyboard.press('Enter')
      await expect(page.getByText('01 / 05')).toBeVisible()
      await expect(picker.getByRole('status')).toContainText(/등록된 근거/)
      await expect(picker.getByText('등록된 근거', { exact: true })).toHaveCount(1)
      await expect(page.getByText('스크립트 근거')).toBeVisible()
      await expect(options.nth(0)).toBeFocused()
      await page.keyboard.press('Enter')
      await expect(page.getByText('02 / 05')).toBeVisible()
      await expect(page.getByTestId('evidence-picker')).toHaveCount(0)
    })

    test('숫자 키로 근거 선택 · 건너뛰기 · 본문에 없는 근거(q5)는 피커 없이 근거만', async ({ page }) => {
      await startDemo(page)
      await answerWithKey(page, '1')
      await page.keyboard.press('3')
      await expect(page.getByTestId('evidence-picker').getByRole('status')).toBeVisible()
      await page.keyboard.press('Enter')
      await expect(page.getByText('02 / 05')).toBeVisible()
      await answerWithKey(page, '1')
      const skip = page.getByRole('button', { name: /근거 보기\(건너뛰기\)/ })
      expect((await skip.boundingBox())!.height).toBeGreaterThanOrEqual(MIN)
      await skip.click()
      await expect(page.getByTestId('evidence-picker').getByRole('status')).toContainText('표시된 문장이 등록된 근거예요')
      // 건너뛰기 버튼이 사라져도 포커스는 등록 근거 문장으로 — body 로 떨어지지 않는다
      await expect(page.getByTestId('evidence-picker').locator('[data-evidence-option]:focus')).toContainText('등록된 근거')
      for (const n of ['03', '04', '05']) {
        await page.keyboard.press('Enter')
        await expect(page.getByText(`${n} / 05`)).toBeVisible()
        if (n === '05') break
        await answerWithKey(page, '1')
        if (await page.getByTestId('evidence-picker').count()) await page.keyboard.press('1')
      }
      await answerWithKey(page, '1')
      await expect(page.getByTestId('evidence-picker')).toHaveCount(0)
      await expect(page.getByText('스크립트 근거')).toBeVisible()
    })

    test('범위를 주었는데 문항이 없으면 데모 대신 빈 상태', async ({ page }) => {
      await page.goto('/scriptquiz/play?text=00000000-0000-4000-8000-000000000000')
      await expect(page.getByRole('heading', { name: '이 글에는 아직 퀴즈가 없어요' })).toBeVisible()
      await expect(page.getByText('The Great Gatsby')).toHaveCount(0)
      const back = page.getByRole('link', { name: '읽던 곳으로' })
      expect((await back.boundingBox())!.height).toBeGreaterThanOrEqual(MIN)
    })
  })
}
