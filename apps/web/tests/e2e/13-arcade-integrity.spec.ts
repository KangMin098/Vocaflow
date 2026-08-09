// apps/web/tests/e2e/13-arcade-integrity.spec.ts
//
// 아케이드 "자료 연계" 회귀 — 게임이 **학습자의 실제 자료로 도는가**를 고정한다.
//
// 왜 새 spec 인가:
//   07-arcade-games 는 "마운트 + 첫 입력 반응 + 콘솔 에러 0"만 본다. 그래서 게임이
//   wordPool 을 통째로 무시하고 하드코딩 콘텐츠로 돌아도 초록불이 켜졌다.
//   v07.8 전수 감사에서 실제로 그런 게임이 여럿 나왔다(word-orrery 는 wordPool 을
//   버렸고, lexicon-detective 는 셔플조차 없는 고정 대본이었다).
//
//   그 결과는 재미 문제로 끝나지 않았다 — recordGameResult 는 **사용자 vocabularies 에
//   없는 단어를 silent skip** 하므로, 내장 뱅크로만 도는 게임은 아무리 플레이해도
//   learning_records 가 0건이다. DB 조회로 확인했다(큐레이션 계열 10종이 0건이었다).
//   즉 "이 게임이 자료를 쓰는가"는 학습 기록이 남는가와 같은 질문이다.
//
// 커버리지:
//   A 게임별 스코프 수용 — 19종 전부가 ?set= 으로 들어온 자료를 실제로 싣는가
//   B 허브 팬아웃 — /arcade?set= 이 모든 카드 링크에 스코프를 전달하는가
//   C 진입점 — 스크립트 화면에 아케이드 문이 있는가
import { test, expect, type Page } from '@playwright/test';

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
};

const STATE_PATH = 'test-results/.auth-arcade-integrity.json';

/** 공용 단어장 픽스처 — 실 단어 40개(전 게임 최대 요구치 12를 충분히 넘음). */
const FIXTURE_SET = { id: 'dcb6f06e-bc30-4fe3-80bf-577ad08be233', title: 'Twenty years after' };
/** 사용자 스크립트 픽스처 — vocabularies 50개. */
const FIXTURE_TEXT = { id: 'b79172ee-db04-4219-83d3-0505dc84b20c' };

/** lib/game/catalog 의 GAME_CATALOG 와 1:1. 새 게임 추가 시 여기도 늘어나야 한다. */
const ALL_GAMES = [
  'cascade', 'ghost-race', 'word-economy', 'wordfall-cadence', 'letter-forge',
  'wordsmith-vigil', 'morphmerge', 'daily-blitz', 'connections', 'glyph-tongue',
  'word-customs', 'morpheme-rules', 'silent-rule', 'lexicon-hands', 'lexicon-detective',
  'lexicon-estate', 'word-orrery', 'wordblitz', 'pirate-quest',
] as const;

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

test.describe('아케이드 자료 연계', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined });
    await login(page);
    await page.context().storageState({ path: STATE_PATH });
    await page.close();
  });
  test.use({ storageState: STATE_PATH });

  test('A · 19종 전부가 ?set= 으로 들어온 공용 단어장을 실제로 싣는다', async ({ page }) => {
    test.setTimeout(19 * 30_000);
    const failures: string[] = [];

    for (const slug of ALL_GAMES) {
      await page.goto(`/play/${slug}?set=${FIXTURE_SET.id}&from=%2Farcade`, {
        waitUntil: 'domcontentloaded',
      });

      // 세션 셸이 "지금 무슨 단어로 놀고 있는지"를 aria-label 로 노출한다
      // (SessionFrame — `현재 학습: <타입>, <자료명>, <부제>`).
      const res = page.locator('[aria-label^="현재 학습:"]').first();
      try {
        await res.waitFor({ state: 'attached', timeout: 25_000 });
      } catch {
        failures.push(`${slug}: 자료 컨텍스트가 렌더되지 않음(로딩 실패 또는 NotEnoughWords)`);
        continue;
      }
      const label = (await res.getAttribute('aria-label')) ?? '';

      // 픽스처 단어장 이름이 실려야 한다 = 게임이 그 자료를 받았다는 뜻.
      if (!label.includes(FIXTURE_SET.title)) {
        failures.push(`${slug}: 자료명 누락 — aria-label="${label.slice(0, 90)}"`);
      }
      // "맛보기"면 내장 뱅크로 떨어진 것 = 자료 연계 실패(FSRS 도 안 남는다).
      if (label.includes('맛보기')) {
        failures.push(`${slug}: 맛보기로 degrade — 자료를 명시했는데 내장 뱅크로 떨어졌다`);
      }
    }

    expect(failures, `자료 연계 실패:\n${failures.join('\n')}`).toEqual([]);
  });

  test('A2 · ?text= (내 스크립트) 도 같은 방식으로 실린다', async ({ page }) => {
    // 스크립트 경로는 vocabularies 기반이라 set 경로와 쿼리가 다르다 — 대표 3종으로 확인.
    for (const slug of ['cascade', 'wordblitz', 'connections']) {
      await page.goto(`/play/${slug}?text=${FIXTURE_TEXT.id}&from=%2Farcade`, {
        waitUntil: 'domcontentloaded',
      });
      const res = page.locator('[aria-label^="현재 학습:"]').first();
      await res.waitFor({ state: 'attached', timeout: 25_000 });
      const label = (await res.getAttribute('aria-label')) ?? '';
      expect(label, `${slug} 스크립트 스코프`).not.toContain('맛보기');
    }
  });

  test('B · /arcade?set= 이 모든 카드 링크에 스코프를 전달한다', async ({ page }) => {
    await page.goto(`/arcade?set=${FIXTURE_SET.id}&chapter=2`, { waitUntil: 'domcontentloaded' });

    // 스코프 배너 — 지금 어떤 자료로 노는지 + 푸는 길
    await expect(page.locator('.arc-scope')).toBeVisible({ timeout: 30_000 });
    await expect(page.locator('.arc-scope')).toContainText(FIXTURE_SET.title);
    await expect(page.locator('.arc-scope-clear')).toHaveAttribute('href', '/arcade');

    // v07.8 이전 결함: 카드가 gamePlayHref(slug,{from:'/arcade'}) 하드코딩이라
    // 허브까지 온 스코프가 게임 진입 순간 증발했다.
    const hrefs = await page.locator('a[href*="/play/"]').evaluateAll((els) =>
      els.map((e) => (e as HTMLAnchorElement).getAttribute('href') ?? ''),
    );
    expect(hrefs.length, '플레이 링크가 하나도 없음').toBeGreaterThan(10);
    const dropped = hrefs.filter((h) => !h.includes(`set=${FIXTURE_SET.id}`));
    expect(dropped, `스코프를 잃은 링크:\n${dropped.join('\n')}`).toEqual([]);
    // 복귀(from)도 스코프를 유지해야 "이 도서로 여러 게임" 흐름이 끊기지 않는다.
    expect(hrefs.every((h) => h.includes('from=')), 'from 누락').toBe(true);
  });

  test('C · 스크립트 화면에 아케이드 진입 문이 있다', async ({ page }) => {
    await page.goto(`/text/${FIXTURE_TEXT.id}`, { waitUntil: 'domcontentloaded' });
    // ⚠️ 사이드바에도 "아케이드" 링크가 있다(스코프 없는 /arcade). 반드시 ModePills 안으로
    // 한정해야 한다 — 안 그러면 사이드바를 잡고 "스코프가 없다"고 잘못 실패한다.
    const pill = page
      .locator('nav[aria-label="학습 단계 선택"]')
      .getByRole('link', { name: /아케이드/ })
      .first();
    await expect(pill).toBeVisible({ timeout: 30_000 });
    const href = (await pill.getAttribute('href')) ?? '';
    // 스코프가 허브로 넘어가야 19종 전부에 적용된다.
    expect(href, `아케이드 pill href=${href}`).toContain('/arcade');
    // 도서 챕터로 열린 텍스트는 ?set=(shared_words), 사용자 스크립트는 ?text=(vocabularies).
    // text/[id]/page.tsx 의 scopeQuery 가 그 둘을 가르므로 둘 중 하나면 통과다.
    expect(/[?&](set|text)=/.test(href), `스코프 없는 아케이드 링크 — href=${href}`).toBe(true);
  });
});
