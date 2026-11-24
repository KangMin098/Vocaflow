// apps/web/tests/e2e/scriptquiz-result.dev.spec.ts
// 퀴즈 결과 화면(사실 문구·전체 단어장·키보드). 개발 서버 + 실제 QA 로그인 전용 — CI 대상 아님.
// ⚠️ 데모를 끝까지 풀면 recordGameScore 가 브라우저에서 scores 에 INSERT 한다 — REST 쓰기를 전부 보내기 전에 끊는다.
//    점수 저장 검증이 아니다. 끊은 수를 annotation 으로 남긴다.
import { expect, test } from '@playwright/test'

const STATE = process.env.QA_STORAGE_STATE
test.skip(!STATE, 'QA_STORAGE_STATE 없음')
test.use({ storageState: STATE })

for (const width of [1280, 1440]) {
  test(`${width}px — 데모 완주 결과: 사실 문구 · 전체 단어장 · Tab 초점 (점수 쓰기 차단)`, async ({ page }, info) => {
    await page.setViewportSize({ width, height: 1000 })
    // 실제 점수 저장은 브라우저의 Supabase REST INSERT(scores)다 — server action 이 아니다.
    // REST 쓰기(POST/PATCH/PUT/DELETE · /rest/v1/)는 **전부** 보내기 전에 끊는다: scores 와 그 밖을 나눠 센다.
    // 채점은 server action(샘플)이라 그대로 보낸다. 마지막 채점 뒤에는 어떤 action 도 보내지 않는다(이중 안전).
    let scoresBlocked = 0
    let otherRestWritesBlocked = 0
    let actionsPassed = 0
    let actionsBlockedAfterFinish = 0
    let finishing = false
    await page.context().route('**/*', async (route) => {
      const req = route.request()
      const m = req.method()
      const url = req.url()
      if (url.includes('/rest/v1/') && m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS') {
        if (url.includes('/rest/v1/scores')) scoresBlocked++
        else otherRestWritesBlocked++
        return route.abort()
      }
      // 완료 뒤에는 GET 이 아닌 요청(같은 출처 /api 이벤트 등)도 전부 끊는다
      if (finishing && m !== 'GET' && m !== 'HEAD' && m !== 'OPTIONS') {
        actionsBlockedAfterFinish++
        return route.abort()
      }
      if (m === 'POST' && req.headers()['next-action']) {
        if (finishing) {
          actionsBlockedAfterFinish++
          return route.abort()
        }
        actionsPassed++
      }
      return route.continue()
    })

    await page.goto('/scriptquiz/play')
    await page.getByRole('button', { name: /시작/ }).first().click()
    for (let i = 1; i <= 5; i++) {
      await expect(page.getByText(`0${i} / 05`)).toBeVisible()
      await page.keyboard.press('1')
      await expect(page.locator('[aria-live="polite"]').filter({ hasText: /맞혔어요|아쉬워요|시간이/ })).toBeVisible()
      if (await page.getByTestId('evidence-picker').count()) await page.keyboard.press('1')
      await page.waitForTimeout(150)
      if (i === 5) finishing = true
      await page.keyboard.press('Enter')
    }
    await expect(page.getByText('오늘 잘 마쳤어요')).toBeVisible()
    await expect.poll(() => scoresBlocked, { timeout: 10_000 }).toBe(1)

    const main = page.locator('body')
    await expect(main).not.toContainText(/깊이 이해|기억을 단단하게|인지적 분투|오답 단어/)
    await expect(page.getByText(/문제 (모두 맞혔어요|중 \d+문제를 맞혔어요)|맞힌 문항이 없어요/)).toBeVisible()
    const wv = page.getByTestId('result-wordvault')
    await expect(wv).toHaveText(/전체 단어장으로/)
    await expect(wv).toHaveAttribute('href', '/wordvault')
    // 데모는 확인된 읽기 맥락이 없다 → 「읽던 글로」 없음
    await expect(page.getByTestId('result-return')).toHaveCount(0)

    // 키보드: 다시 풀기 → 전체 단어장 순서로 보이는 초점
    const retry = page.getByRole('button', { name: /다시 풀기/ })
    await retry.focus()
    await page.keyboard.press('Tab')
    await expect(wv).toBeFocused()
    expect(await wv.evaluate((el) => getComputedStyle(el).outlineStyle)).not.toBe('none')
    expect((await wv.boundingBox())!.height).toBeGreaterThanOrEqual(44)
    await page.screenshot({ path: info.outputPath(`result-${width}.png`), fullPage: true })
    info.annotations.push({ type: 'scores-insert-blocked', description: String(scoresBlocked) }, { type: 'other-rest-writes-blocked', description: String(otherRestWritesBlocked) }, { type: 'grade-actions-passed', description: String(actionsPassed) }, { type: 'actions-blocked-after-finish', description: String(actionsBlockedAfterFinish) })
  })
}
