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
//
// #1 보정 다리: ECHO_FAKE_WAV=<abs .wav> 설정 시 그 wav 를 마이크로 주입한다.
//   → **실제 사람 육성 녹음**(문장 낭독)을 넣으면 자동으로 채점 경로를 태워 실측 점수를 얻는다.
//   예) ECHO_FAKE_WAV="C:/…/read.wav" pnpm --filter web exec playwright test 06-echomatch-fakemic
//   주의: 합성 톤(기본) 점수는 캡처 타이밍에 따라 변동(48~76 관측) — 보정 아닌 '파이프라인 생존/변별' 검증용.
//   파일 주입은 wav 가 루프되므로 녹음 창을 파일보다 길게(6s) 잡아 발화 전체를 포함시킨다.
import { test, expect, type Page } from '@playwright/test'

import {
  countLearningRecordsSince,
  deleteVocabularyById,
  seedScopedVocabulary,
  userIdByEmail,
} from './utils/db'

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
}
// runtime-test 계정 소유 EchoMatch 시드 텍스트 (5문장) — 04-ui-smoke 와 동일
const ECHO_TEXT_ID = '89970bfa-f49d-44c2-92ce-75895a608317'
const STATE_PATH = 'playwright-auth/.auth-echo-fakemic.json'

// 오디오 소스: 기본은 Chrome 합성 톤(CI-safe). ECHO_FAKE_WAV 설정 시 그 wav 파일을 마이크로 주입 —
//   실제 영어 발화(SAPI TTS) 또는 **사람 육성 녹음**을 그대로 채점 경로에 넣을 수 있다(#1 보정 다리).
const FAKE_WAV = process.env.ECHO_FAKE_WAV
const AUDIO_MODE = FAKE_WAV ? `file:${FAKE_WAV}` : 'synthetic-tone'
const audioArg = FAKE_WAV
  ? `--use-file-for-fake-audio-capture=${FAKE_WAV}`
  : '--use-fake-device-for-media-stream'

// fake-mic: getUserMedia 자동 허용 + 오디오 소스 + 재생 제스처 요건 제거
test.use({
  launchOptions: {
    args: [
      '--use-fake-ui-for-media-stream',
      audioArg,
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

    // ── 청각 면(F3) 신호 준비 ──
    // 같은 사이클에 얹는다 — 별도 테스트로 두면 Piper 17MB 를 **두 번** 받는다
    // (이 스펙이 smoke 와 분리돼 있는 이유가 그 무게다).
    // 검증 텍스트에는 학습자 단어가 0개라 아무것도 심지 않으면 신호 경로가 한 번도
    // 실행되지 않은 채 초록이 된다. 첫 문장에 든 단어 하나를 심고 **반드시 되돌린다**.
    const userId = await userIdByEmail(RUNTIME_USER.email)
    const vocabId = userId
      ? await seedScopedVocabulary(userId, ECHO_TEXT_ID, 'village') // 첫 문장의 단어
      : null
    const sinceIso = new Date(Date.now() - 5_000).toISOString()

    try {
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
      // 파일 주입 모드는 wav 가 루프되므로, 녹음 창이 발화 전체를 확실히 포함하도록 길게(파일 길이↑).
      //   합성 톤 모드는 상시 voiced 라 무관.
      await page.waitForTimeout(FAKE_WAV ? 6000 : 2500)
      await done.click()

      // 4) Compare → Score 완주 — ④ Score 패널 + ScoreCard overall 노출
      await expect(page.getByText('④ Score — 결과')).toBeVisible({ timeout: 60_000 })
      const card = page.locator('section').filter({ hasText: 'overall' })
      await expect(card).toBeVisible({ timeout: 30_000 })

      // 점수 범위 검증 + 로깅 (합성오디오라 값 자체는 참고용)
      const cardText = (await card.innerText()).replace(/\s+/g, ' ').trim()
      const m = cardText.match(/(\d+)\s*\/\s*100/)
      const overall = m ? Number(m[1]) : NaN
      console.log(`[echo-fakemic] audio=${AUDIO_MODE} · overall=${overall} · card="${cardText.slice(0, 140)}"`)
      expect(Number.isFinite(overall), `overall 파싱 실패: "${cardText.slice(0, 80)}"`).toBe(true)
      // >0 강화: 합성 톤은 voiced 프레임을 가지므로 정상 파이프라인이면 non-zero.
      //   0 이면 구 절대값 비교의 '구조적 0점' 결함 회귀(v06.158 수리 대상) — 반드시 잡는다.
      expect(overall, '구조적 0점 회귀 의심').toBeGreaterThan(0)
      expect(overall).toBeLessThanOrEqual(100)

      // 에러 바운더리 미노출 + 치명 콘솔 에러 0
      await expect(page.getByText(/문제가 발생|problem occurred/)).toHaveCount(0)
      const fatal = fatalErrors(errors)
      expect(fatal, `console errors: ${fatal.join(' | ')}`).toHaveLength(0)

      // 5) 청각 면(F3) 신호 — **플레이어 배선**이 이 스펙의 나머지 절반이다.
      //    판정 규칙은 단위(word-signal)와 실 DB 통합(sound-signal)이 덮지만
      //    loadSoundLemmas → soundRecords → recordEchoSound 는 어느 쪽도 안 탄다.
      //    받아쓰기에서 정확히 그 지점이 깨졌었다(도서 챕터 content 가 NULL 이라 문장 0개 —
      //    타입·단위 전부 통과했고 e2e 만 잡았다).
      if (vocabId && userId) {
        // 판정은 **화면에 뜬 실제 점수**로 갈린다 — 합성 톤은 실행마다 값이 흔들리므로
        // "기록이 있어야 한다" 로 고정하면 스펙이 무작위로 빨개진다(탐지가 아니라 소음이다).
        // 카드는 "인토네이션 40% 26" 처럼 **가중치와 점수를 나란히** 쓴다.
        // `\D*(\d+)` 로 잡으면 가중치(40)를 점수로 읽는다 — 실점수가 0이어도 credible 로
        // 판정돼 있지도 않은 기록을 요구하게 된다. 가중치를 명시적으로 건너뛴다.
        const axis = (label: string) =>
          Number(cardText.match(new RegExp(`${label}\\s*\\d+%\\s*(\\d+)`))?.[1] ?? NaN)
        const pitch = axis('인토네이션')
        const energy = axis('강세')
        expect(
          Number.isFinite(pitch) && Number.isFinite(energy),
          `3축 파싱 실패: ${cardText.slice(0, 120)}`,
        ).toBe(true)

        // 적재는 fire-and-forget 이라 화면보다 늦을 수 있다
        await page.waitForTimeout(2000)
        const rows = await countLearningRecordsSince(userId, 'echo', sinceIso)
        const credible = pitch > 0 || energy > 0
        console.log(`[echo-signal] pitch=${pitch} energy=${energy} credible=${credible} rows=${rows}`)

        if (credible) {
          expect(rows, '발화가 있었는데 청각 기록이 0이다 (배선 끊김)').toBeGreaterThan(0)
        } else {
          // 측정 실패(전 축 0)를 오답으로 적재하면 마이크 문제가 청각 처방이 된다
          expect(rows, '측정 실패인데 기록이 남았다').toBe(0)
        }
      }
    } finally {
      // 심은 단어와 거기 달린 기록을 되돌린다 — 남기면 다음 실행의 면 분포가 달라진다
      if (vocabId) await deleteVocabularyById(vocabId)
    }
  })
})
