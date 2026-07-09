// apps/web/tests/e2e/06-echomatch-fakemic.spec.ts
//
// EchoMatch 실주행(fake-mic) 회귀 — Chrome 합성 오디오로 전체 4-Phase 사이클을 자동 완주.
//   Listen(Piper TTS) → Repeat(MediaRecorder 합성오디오) → Compare(DTW) → Score(3축+overall).
//
// 목적: "채점 파이프라인이 실 오디오 캡처 경로에서 크래시/구조적 0점 없이 점수를 산출하는가"를
//   사람 없이 자동 검증(메모리 '육성 재주행' 잔여 항목의 자동화 대체).
// 한계: 합성 오디오(=실제 발화 아님)라 절대 점수의 '사람 보정(#1)'은 아님 — 파이프라인 생존/범위만.
//
// 실행: pnpm --filter web exec playwright test 06-echomatch-fakemic
//   (smoke 와 분리 — fake-mic 플래그 + Piper 모델 ~17MB 다운로드로 무겁고 네트워크 의존)
import { test, expect, type Page } from '@playwright/test'

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
}
// runtime-test 계정 소유 EchoMatch 시드 텍스트 (5문장) — 04-ui-smoke 와 동일
const ECHO_TEXT_ID = '89970bfa-f49d-44c2-92ce-75895a608317'
const STATE_PATH = 'test-results/.auth-echo-fakemic.json'

// fake-mic: getUserMedia 자동 허용 + 합성 오디오 장치 + 오디오 재생 제스처 요건 제거
test.use({
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      '--use-fake-device-for-media-stream',
      '--autoplay-policy=no-user-gesture-required',
    ],
  },
  permissions: ['microphone'],
})

async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800)
  await page.fill('input[type="email"]', RUNTIME_USER.email)
  await page.fill('input[type="password"]', RUNTIME_USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 })
}

/** 환경 노이즈 제외 — auth 경합·favicon·콜드컴파일 청크 + Piper 모델 CDN fetch(앱 결함 아님). */
function fatalErrors(errors: string[]): string[] {
  return errors.filter(
    (e) =>
      !/favicon|404 \(Not Found\)|auth-js|auth\/v1\/token|Failed to fetch|ChunkLoadError|onnx|wasm|huggingface|\.onnx|piper|voices|model/i.test(
        e,
      ),
  )
}

test.describe('EchoMatch fake-mic 실주행', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined })
    await login(page)
    await page.context().storageState({ path: STATE_PATH })
    await page.close()
  })
  test.use({ storageState: STATE_PATH })

  test('전체 4-Phase 사이클이 합성 오디오로 완주하고 점수를 산출한다', async ({ page }) => {
    test.setTimeout(200_000) // Piper 모델 ~17MB 다운로드 여유
    const errors: string[] = []
    page.on('console', (m) => {
      if (m.type() === 'error') errors.push(m.text().slice(0, 200))
    })
    page.on('pageerror', (e) => errors.push(`PAGEERROR: ${String(e).slice(0, 200)}`))

    await page.goto(`/text/${ECHO_TEXT_ID}/echo`, { waitUntil: 'domcontentloaded' })

    // 1) 마이크 권한 게이트 — fake-ui 로 getUserMedia 자동 허용
    const gate = page.getByRole('button', { name: /마이크 사용 허용/ })
    await gate.waitFor({ state: 'visible', timeout: 30_000 })
    await gate.click()

    // 2) Piper 모델 준비 — '시작' 버튼 활성 대기 (미준비면 '음성 모델 준비 중…')
    const start = page.getByRole('button', { name: /시작|음성 모델 준비/ })
    await start.waitFor({ state: 'visible', timeout: 30_000 })
    await expect(page.getByRole('button', { name: /^시작/ })).toBeEnabled({ timeout: 150_000 })
    await page.getByRole('button', { name: /^시작/ }).click()

    // 3) Listen 자동재생 → Repeat(녹음) 진입 → 합성오디오 ~2.5s 녹음 후 '완료'
    const done = page.getByRole('button', { name: /완료/ })
    await done.waitFor({ state: 'visible', timeout: 60_000 })
    await page.waitForTimeout(2500)
    await done.click()

    // 4) Compare → Score 완주 — ④ Score 패널 + ScoreCard overall 노출
    await expect(page.getByText('④ Score — 결과')).toBeVisible({ timeout: 60_000 })
    const card = page.locator('section').filter({ hasText: 'overall' })
    await expect(card).toBeVisible({ timeout: 30_000 })

    // 점수 범위 검증 + 로깅 (합성오디오라 값 자체는 참고용)
    const cardText = (await card.innerText()).replace(/\s+/g, ' ').trim()
    const m = cardText.match(/(\d+)\s*\/\s*100/)
    const overall = m ? Number(m[1]) : NaN
    console.log(`[echo-fakemic] overall=${overall} · card="${cardText.slice(0, 140)}"`)
    expect(Number.isFinite(overall), `overall 파싱 실패: "${cardText.slice(0, 80)}"`).toBe(true)
    // >0 강화: 합성 톤은 voiced 프레임을 가지므로 정상 파이프라인이면 non-zero.
    //   0 이면 구 절대값 비교의 '구조적 0점' 결함 회귀(v06.158 수리 대상) — 반드시 잡는다.
    expect(overall, '구조적 0점 회귀 의심').toBeGreaterThan(0)
    expect(overall).toBeLessThanOrEqual(100)

    // 에러 바운더리 미노출 + 치명 콘솔 에러 0
    await expect(page.getByText(/문제가 발생|problem occurred/)).toHaveCount(0)
    const fatal = fatalErrors(errors)
    expect(fatal, `console errors: ${fatal.join(' | ')}`).toHaveLength(0)
  })
})
