// apps/web/tests/e2e/27-tts-voice-stability.spec.ts
//
// **듣는 도중 억양이 바뀌지 않는지** — 사용자 신고(2026-08-16, Edge) 회귀 락.
//
// 무슨 일이 있었나: 단어를 이어 듣다가 `fundamental` 에서 갑자기 다른 지역 발음이 났다.
// `voiceschanged` 는 한 번만 오지 않는다 — Edge 는 로컬 음성을 먼저 주고 온라인(신경망)
// 음성을 뒤이어 흘려보내며 **여러 번** 발화한다. 그때마다 목록을 다시 훑어 고르면
// `en-US` 가 잠깐 빠진 중간 상태에서 `en-GB` 로 갈아타고 **그 뒤 단어부터** 그 억양이 된다.
// 오류도 로그도 없다 — 학습자 귀에만 잡힌다.
//
// 단위 테스트(`speech-delivery`)는 `nextVoice` 의 판단만 본다. 여기서는 **실제 화면이
// 그 판단을 쓰는지** 를 본다 — 훅 배선이 끊기면 단위 테스트는 그대로 통과한다.
//
// 방법: `speechSynthesis` 를 페이지 스크립트보다 먼저 가짜로 바꿔치기하고(addInitScript),
// Edge 의 순서를 그대로 재현한다 — ① en-US 있는 목록 → 한 단어 재생 → ② en-US 가 빠진
// 중간 목록으로 `voiceschanged` 발화 → ③ 다음 단어 재생. 두 발화의 음성이 같아야 한다.

import { test, expect, type Page } from '@playwright/test'

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
}
const STATE_PATH = 'playwright-auth/.auth-tts-voice.json'

/** 페이지에 심는 가짜 TTS — 발화될 때마다 어떤 음성이 물렸는지 기록한다. */
const FAKE_TTS = `
(() => {
  const US = { lang: 'en-US', voiceURI: 'us-1', name: 'US One', default: true, localService: true };
  const US2 = { lang: 'en-US', voiceURI: 'us-2', name: 'US Two', default: false, localService: false };
  const GB = { lang: 'en-GB', voiceURI: 'gb-1', name: 'GB One', default: false, localService: true };
  const AU = { lang: 'en-AU', voiceURI: 'au-1', name: 'AU One', default: false, localService: true };
  const KO = { lang: 'ko-KR', voiceURI: 'ko-1', name: 'KO One', default: false, localService: true };

  window.__ttsVoiceSets = { US, US2, GB, AU, KO };
  let voices = [KO, US, GB];
  const listeners = new Set();

  window.__ttsLog = [];

  // 실제 SpeechSynthesisUtterance 는 voice 에 SpeechSynthesisVoice 만 받는다 —
  // 가짜 음성 객체를 물리려면 utterance 도 함께 가짜여야 한다.
  window.SpeechSynthesisUtterance = class {
    constructor(text) {
      this.text = text;
      this.voice = null;
      this.lang = '';
      this.rate = 1;
      this.onend = null;
      this.onerror = null;
    }
  };

  // WARN: window.speechSynthesis 는 Window 프로토타입의 읽기 전용 접근자다 —
  // 그냥 대입하면 조용히 무시되고 진짜 엔진이 쓰인다(헤드리스에선 음성 0개라 무음).
  // 그러면 이 테스트는 "발화 기록 0" 으로만 실패해서 원인이 안 보인다.
  const fakeSynth = {
    getVoices: () => voices.slice(),
    speak: (u) => {
      window.__ttsLog.push({
        text: u.text,
        voiceURI: u.voice ? u.voice.voiceURI : null,
        voiceLang: u.voice ? u.voice.lang : null,
        utterLang: u.lang,
      });
      // 큐가 다음으로 넘어가야 하므로 완료를 알린다
      setTimeout(() => { if (u.onend) u.onend(); }, 0);
    },
    cancel: () => {},
    pause: () => {},
    resume: () => {},
    addEventListener: (type, fn) => { if (type === 'voiceschanged') listeners.add(fn); },
    removeEventListener: (type, fn) => { if (type === 'voiceschanged') listeners.delete(fn); },
    set onvoiceschanged(fn) { if (fn) listeners.add(fn); },
    get onvoiceschanged() { return null; },
  };
  Object.defineProperty(window, 'speechSynthesis', {
    value: fakeSynth,
    configurable: true,
    writable: true,
  });

  /** 테스트가 Edge 의 목록 교체를 흉내낼 때 부른다. */
  window.__setVoices = (next) => {
    voices = next;
    listeners.forEach((fn) => fn());
  };
})();
`

async function login(page: Page) {
  await page.goto('/login', { waitUntil: 'networkidle' })
  await page.waitForTimeout(800) // hydration
  await page.fill('input[type="email"]', RUNTIME_USER.email)
  await page.fill('input[type="password"]', RUNTIME_USER.password)
  await page.click('button[type="submit"]')
  await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 30_000 })
}

test.describe('TTS 음성 안정성 — 듣는 도중 억양이 바뀌지 않는다', () => {
  test.describe.configure({ mode: 'serial', timeout: 120_000 })

  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined })
    await login(page)
    await page.context().storageState({ path: STATE_PATH })
    await page.close()
  })
  test.use({ storageState: STATE_PATH })

  test.beforeEach(async ({ page }) => {
    await page.addInitScript(FAKE_TTS)
    await page.goto('/wordvault/browse', { waitUntil: 'networkidle' })
    expect(page.url()).not.toContain('/login')
    await page.waitForSelector('[data-testid="word-row"]', { timeout: 30_000 })

    // 전제 검사 — 가짜가 안 깔렸으면 이 스펙은 **아무것도 검증하지 못한다**.
    // 그 상태로 "발화 0" 만 보면 원인이 화면인지 도구인지 알 수 없다.
    const probe = await page.evaluate(() => ({
      hasLog: Array.isArray(window.__ttsLog),
      speakIsFake: String(window.speechSynthesis.speak).includes('__ttsLog'),
      voiceCount: window.speechSynthesis.getVoices().length,
    }))
    expect(probe, '가짜 TTS 설치 실패').toEqual({
      hasLog: true,
      speakIsFake: true,
      voiceCount: 3,
    })
  })

  test('🔴 회귀: en-US 가 잠깐 빠진 목록이 와도 다음 단어가 같은 음성으로 읽힌다', async ({
    page,
  }) => {
    const rows = page.locator('[data-testid="word-row"] span.h-7.w-7')
    expect(await rows.count(), '단어가 없으면 이 검증은 무의미하다').toBeGreaterThan(1)

    // ① 첫 단어 — en-US 가 있는 목록
    await rows.nth(0).click()
    await expect
      .poll(async () => (await page.evaluate(() => window.__ttsLog.length)) as number)
      .toBeGreaterThan(0)
    const first = await page.evaluate(() => window.__ttsLog[0])
    expect(first.voiceLang, '첫 발화가 en-US 가 아니다 — 전제가 깨졌다').toBe('en-US')

    // ② Edge 가 목록을 갈아끼우는 중간 상태 — en-US 가 아직 안 돌아왔다
    await page.evaluate(() => {
      const v = window.__ttsVoiceSets
      window.__setVoices([v.KO, v.GB, v.AU])
    })
    await page.waitForTimeout(150) // 상태 반영

    // ③ 다음 단어 — 여기서 억양이 바뀌면 그게 신고된 결함이다
    await rows.nth(1).click()
    await expect
      .poll(async () => (await page.evaluate(() => window.__ttsLog.length)) as number)
      .toBeGreaterThan(1)

    const log = await page.evaluate(() => window.__ttsLog)
    const langs = [...new Set(log.map((l) => l.voiceLang))]
    expect(langs, `듣는 도중 음성이 바뀌었다 — 발화 기록: ${JSON.stringify(log)}`).toEqual([
      'en-US',
    ])
  })

  test('en-US 가 뒤늦게 나타나면 지역 변종에서 올라간다 (승격은 허용)', async ({ page }) => {
    // 처음부터 en-US 가 없는 환경 — 이때는 en-GB 로 시작하는 것이 맞다
    await page.evaluate(() => {
      const v = window.__ttsVoiceSets
      window.__setVoices([v.KO, v.GB])
    })
    await page.waitForTimeout(150)

    const rows = page.locator('[data-testid="word-row"] span.h-7.w-7')
    await rows.nth(0).click()
    await expect
      .poll(async () => (await page.evaluate(() => window.__ttsLog.length)) as number)
      .toBeGreaterThan(0)
    expect((await page.evaluate(() => window.__ttsLog[0])).voiceLang).toBe('en-GB')

    // Edge 온라인 음성이 도착 — en-US 가 생기면 올라가야 한다
    await page.evaluate(() => {
      const v = window.__ttsVoiceSets
      window.__setVoices([v.KO, v.GB, v.US])
    })
    await page.waitForTimeout(150)

    await rows.nth(1).click()
    await expect
      .poll(async () => (await page.evaluate(() => window.__ttsLog.length)) as number)
      .toBeGreaterThan(1)
    const log = await page.evaluate(() => window.__ttsLog)
    expect(log[log.length - 1]!.voiceLang, 'en-US 가 왔는데 올라가지 않았다').toBe('en-US')
  })

  test('utter.lang 이 물린 음성과 어긋나지 않는다', async ({ page }) => {
    // `lang='en-US'` 와 en-GB 음성을 함께 물리면 어느 쪽이 이기는지 브라우저마다 다르다.
    await page.evaluate(() => {
      const v = window.__ttsVoiceSets
      window.__setVoices([v.KO, v.GB])
    })
    await page.waitForTimeout(150)

    await page.locator('[data-testid="word-row"] span.h-7.w-7').nth(0).click()
    await expect
      .poll(async () => (await page.evaluate(() => window.__ttsLog.length)) as number)
      .toBeGreaterThan(0)

    const rec = await page.evaluate(() => window.__ttsLog[0])
    expect(rec.utterLang, `lang(${rec.utterLang}) 과 음성(${rec.voiceLang}) 이 어긋난다`).toBe(
      rec.voiceLang
    )
  })
})

declare global {
  interface Window {
    __ttsLog: {
      text: string
      voiceURI: string | null
      voiceLang: string | null
      utterLang: string
    }[]
    __ttsVoiceSets: Record<string, { lang: string; voiceURI: string }>
    __setVoices: (voices: { lang: string; voiceURI: string }[]) => void
  }
}
