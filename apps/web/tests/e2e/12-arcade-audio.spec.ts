// apps/web/tests/e2e/12-arcade-audio.spec.ts
//
// 아케이드 오디오 회귀 — "소리가 실제로 실제 음악·실제 효과음인가"를 고정한다.
//
// 배경(v07.6 이전 결함 두 가지):
//   ① BGM 이 조용히 망가져 있었다. 크로스페이드가 사라지는 경로가 둘이나 있다 —
//      (a) 한 입력을 asplit 으로 쪼개 atrim 셋을 물리면 acrossfade 가 빈 스트림을 받고,
//      (b) `-t X` 로 뜬 조각이 MP3 프레임 경계 때문에 X 보다 살짝 짧으면 acrossfade=d=X
//          가 성립하지 않는다. 둘 다 파일은 멀쩡히 200 을 주고 재생도 되는데 1마디 짧고
//      루프마다 클릭이 난다 → **길이를 단언**해서 잡는다.
//   ② 효과음이 Kenney "Interface Sounds"(대역제한 합성음)라 말 그대로 컴퓨터 삑 소리였다.
//      FFT 실측: 6종 전부 모노 · 8 kHz 이상 에너지 0~0.6%. 교체본은 스테레오 실녹음이므로
//      **채널 수와 길이**를 단언해 합성음으로의 회귀를 막는다.
//
// 커버리지:
//   A 자산 존재 — 카탈로그 19게임의 BGM + SFX 6종이 전부 200
//   B 빌드 무결성 — BGM 110초(심리스 루프 구축 성공) · SFX 길이/채널
//   C 기본 ON(v07.6) — 선호 미설정 학습자가 게임 진입만으로 트랙을 받는가,
//     그리고 명시적 OFF 는 기본값 변경에 덮이지 않고 유지되는가
import { test, expect, type Page } from '@playwright/test';
import { seedBriefsSeen } from './utils/brief';

// v08.6 — `/play/*` 는 그 게임의 브리핑을 처음 여는 학습자에게 게임 대신 브리핑을 띄운다.
// 이 스펙들이 검증하는 것은 게임의 동작이므로 "돌아온 학습자" 를 재현한다.
// 게이트 자체의 회귀는 15-arcade-brief.spec.ts 가 심지 않은 상태로 본다.
test.beforeEach(async ({ page }) => {
  await seedBriefsSeen(page);
});


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

// v07.7 부터 루프를 **마디 정수배**로 자른다(되감기 지점의 박 위상을 맞추기 위해).
// 그래서 길이가 템포마다 다르다 — 실측 109.5~110.6초(59~74마디, 129~161 BPM).
// 이 창을 벗어나면 크로스페이드가 소실됐거나(1마디 짧아짐) 빌드 설정이 바뀐 것이다.
const LOOP_MIN = 108.8;
const LOOP_MAX = 111.4;

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
  test('A+B · BGM 19곡이 전부 존재하고 마디 정수배 심리스 루프로 구워져 있다', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' }); // fetch/AudioContext 실행 컨텍스트
    for (const slug of BGM_SLUGS) {
      const meta = await decodeMeta(page, `/audio/games/${slug}.mp3`);
      // 크로스페이드가 조용히 사라지면 정확히 1마디(1.5~1.9초) 짧게 구워진다 — 여기서 잡는다.
      expect(meta.duration, `${slug} 길이`).toBeGreaterThan(LOOP_MIN);
      expect(meta.duration, `${slug} 길이`).toBeLessThan(LOOP_MAX);
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

  test('C · 선호 미설정이면 기본 ON — 게임 진입만으로 그 게임의 트랙을 내려받는다', async ({ page }) => {
    await login(page);
    // 이전 테스트가 남긴 선호를 지워 "처음 온 학습자" 상태를 만든다.
    await page.goto('/arcade', { waitUntil: 'domcontentloaded' });
    await page.evaluate(() => localStorage.removeItem('vocaflow-arcade-music'));

    const requested: string[] = [];
    page.on('request', (r) => {
      const u = new URL(r.url());
      if (u.pathname.startsWith('/audio/games/')) requested.push(u.pathname);
    });

    await page.goto('/play/word-orrery', { waitUntil: 'domcontentloaded' });

    const musicBtn = page.locator('.gk-music-btn');
    await musicBtn.waitFor({ state: 'visible', timeout: 30_000 });
    await expect(musicBtn, '미설정 = 기본 ON').toHaveAttribute('data-on', '1');
    // v07.6 핵심 회귀: 토글을 누르지 않아도 트랙을 받아야 한다.
    // (기본 OFF 이던 시절에는 여기서 0건이라 아무도 음악을 듣지 못했다.)
    await expect
      .poll(() => requested.some((p) => p === '/audio/games/word-orrery.mp3'), { timeout: 20_000 })
      .toBe(true);

    // 끄면 꺼진 채로 남는다 — 기본값 변경이 명시적 OFF 를 덮어쓰지 않는다.
    await musicBtn.click();
    await expect(musicBtn).toHaveAttribute('data-on', '0');
    expect(await page.evaluate(() => localStorage.getItem('vocaflow-arcade-music'))).toBe('0');

    await page.reload({ waitUntil: 'domcontentloaded' });
    const afterReload = page.locator('.gk-music-btn');
    await afterReload.waitFor({ state: 'visible', timeout: 30_000 });
    await expect(afterReload, 'OFF 선택 유지').toHaveAttribute('data-on', '0');
  });
});
