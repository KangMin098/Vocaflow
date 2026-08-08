// apps/web/tests/e2e/12-arcade-audio.spec.ts
//
// 아케이드 오디오 회귀 — "소리가 실제로 실제 음악·실제 효과음인가"를 고정한다.
//
// 배경(v07.6 이전 결함 두 가지):
//   ① BGM 이 조용히 망가져 있었다. 루프 세그먼트를 asplit + atrim 으로 만들었더니
//      acrossfade 가 빈 스트림을 받아 통째로 사라져, 110초여야 할 트랙이 104초(body 만)로
//      구워졌다. 파일은 멀쩡히 200 을 주니 아무도 몰랐다 → **길이를 단언**한다.
//   ② 효과음이 Kenney "Interface Sounds"(대역제한 합성음)라 말 그대로 컴퓨터 삑 소리였다.
//      FFT 실측: 6종 전부 모노 · 8 kHz 이상 에너지 0~0.6%. 교체본은 스테레오 실녹음이므로
//      **채널 수와 길이**를 단언해 합성음으로의 회귀를 막는다.
//
// 커버리지:
//   A 자산 존재 — 카탈로그 19게임의 BGM + SFX 6종이 전부 200
//   B 빌드 무결성 — BGM 110초(심리스 루프 구축 성공) · SFX 길이/채널
//   C 실제 재생 경로 — 게임에서 배경음악 토글 시 그 게임의 mp3 를 실제로 요청하는가
import { test, expect, type Page } from '@playwright/test';

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
};

/** lib/game/catalog 의 music 필드와 1:1. 새 게임 추가 시 여기도 늘어나야 한다. */
const BGM_SLUGS = [
  'cascade', 'connections', 'daily-blitz', 'ghost-race', 'glyph-tongue',
  'letter-forge', 'lexicon-detective', 'lexicon-estate', 'lexicon-hands',
  'morpheme-rules', 'morphmerge', 'pirate-quest', 'silent-rule',
  'word-customs', 'word-economy', 'word-orrery', 'wordblitz',
  'wordfall-cadence', 'wordsmith-vigil',
] as const;

/** [파일, 최소초, 최대초] — sfx-build 목표 길이 ±0.1초. */
const SFX_FILES: Array<[string, number, number]> = [
  ['correct.wav', 0.55, 0.75],
  ['wrong.wav', 0.2, 0.4],
  ['combo.wav', 0.85, 1.05],
  ['click.wav', 0.1, 0.25],
  ['coin.wav', 0.35, 0.55],
  ['complete.ogg', 2.7, 2.9],
];

const LOOP_SECONDS = 110;

async function login(page: Page) {
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    const email = page.locator('input[type="email"]');
    try {
      await email.waitFor({ state: 'visible', timeout: 15_000 });
    } catch {
      await page.reload({ waitUntil: 'domcontentloaded' }); // 콜드 .next 청크 404 복구
      continue;
    }
    await page.waitForTimeout(1000); // 하이드레이션 — controlled input 리셋 방지
    for (let i = 0; i < 3; i++) {
      await email.fill(RUNTIME_USER.email);
      await page.fill('input[type="password"]', RUNTIME_USER.password);
      if ((await email.inputValue()) === RUNTIME_USER.email) break;
      await page.waitForTimeout(500);
    }
    await page.click('button[type="submit"]');
    try {
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 20_000 });
      return;
    } catch {
      await page.reload({ waitUntil: 'domcontentloaded' });
    }
  }
  throw new Error('로그인 실패 — 4회 재시도 후에도 리다이렉트 안 됨');
}

/** 브라우저에서 실제로 디코드해 길이·채널을 잰다(HTTP 200 만으로는 손상 파일을 못 잡는다). */
async function decodeMeta(page: Page, url: string) {
  return page.evaluate(async (u) => {
    const res = await fetch(u);
    if (!res.ok) throw new Error(`${u} HTTP ${res.status}`);
    const ab = await res.arrayBuffer();
    const bytes = ab.byteLength; // decodeAudioData 가 버퍼를 detach 하므로 미리 잰다
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const ctx = new AC();
    const buf = await ctx.decodeAudioData(ab);
    const meta = { duration: buf.duration, channels: buf.numberOfChannels, bytes };
    await ctx.close();
    return meta;
  }, url);
}

test.describe('아케이드 오디오 자산', () => {
  test('A+B · BGM 19곡이 전부 존재하고 110초 심리스 루프로 구워져 있다', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' }); // fetch/AudioContext 실행 컨텍스트
    for (const slug of BGM_SLUGS) {
      const meta = await decodeMeta(page, `/audio/games/${slug}.mp3`);
      // 104초로 구워지던 회귀(크로스페이드 소실)를 여기서 잡는다.
      expect(meta.duration, `${slug} 길이`).toBeGreaterThan(LOOP_SECONDS - 1);
      expect(meta.duration, `${slug} 길이`).toBeLessThan(LOOP_SECONDS + 1.5);
      expect(meta.channels, `${slug} 채널`).toBe(2);
      expect(meta.bytes, `${slug} 용량`).toBeGreaterThan(700_000);
    }
  });

  test('B · 효과음 6종이 실녹음 규격(스테레오 · 목표 길이)을 지킨다', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    for (const [file, lo, hi] of SFX_FILES) {
      const meta = await decodeMeta(page, `/audio/sfx/${file}`);
      expect(meta.duration, `${file} 길이`).toBeGreaterThan(lo);
      expect(meta.duration, `${file} 길이`).toBeLessThan(hi);
      // Kenney 합성음 세트는 전부 모노였다 — 2채널 요구가 그 회귀를 막는다.
      expect(meta.channels, `${file} 채널`).toBe(2);
    }
  });

  test('C · 게임에서 배경음악을 켜면 그 게임의 트랙을 실제로 내려받는다', async ({ page }) => {
    await login(page);

    const requested: string[] = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (u.pathname.startsWith('/audio/games/')) requested.push(u.pathname);
    });

    await page.goto('/play/word-orrery', { waitUntil: 'domcontentloaded' });

    const musicBtn = page.locator('.gk-music-btn');
    await musicBtn.waitFor({ state: 'visible', timeout: 30_000 });
    // 기본 OFF 이므로 켜기 전에는 트랙을 받지 않는다(불필요한 1.5MB 전송 방지).
    expect(requested, '토글 전 선다운로드 없음').toHaveLength(0);

    await musicBtn.click(); // 사용자 제스처 = 자동재생 정책 통과
    await expect(musicBtn).toHaveAttribute('data-on', '1');

    await expect
      .poll(() => requested.some((p) => p === '/audio/games/word-orrery.mp3'), { timeout: 15_000 })
      .toBe(true);
  });
});
