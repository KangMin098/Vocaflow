// apps/web/tests/e2e/19-content-scope.spec.ts
//
// 콘텐츠 스코프 일반화 — **큐레이션 도서 챕터로 enroll 없이 논다** (프레임워크 Phase 2).
//
// 배경(설계안 §6):
//   스코프가 `?set=` / `?text=` 두 가지뿐이라, 도서로 놀려면 반드시 enroll 해서 texts 로
//   들어가야 했다. 콘텐츠 유형이 늘 때마다 스코프를 받는 곳마다 파라미터가 늘어난 것도
//   같은 원인이다(유형 추가 비용이 7곳에 흩어짐).
//   `ContentRef` 하나로 모으고 해석을 `fetchWordsForContent` 한 곳에 두면
//   유형 추가는 **어댑터 한 줄**이 된다.
//
// 왜 e2e 인가:
//   해석이 RLS 를 통과해야 성립한다. `shared_words` 는 **발행 도서**의 단어만 읽히므로
//   (`read words of published` 정책), 순수 함수 테스트로는 "학습자가 실제로 읽을 수 있는가"
//   를 증명하지 못한다. 실제로 이 스펙을 만들며 `status='ready'` 도서를 골라 0단어가 나왔고,
//   그게 결함이 아니라 **정상 동작**이라는 것을 RLS 를 보고서야 알았다.

import { test, expect } from '@playwright/test';

import { serviceClient } from './utils/db';
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

/**
 * 발행 도서 + 챕터 단어장을 DB 에서 고른다.
 * id 하드코딩은 데이터가 바뀌면 조용히 낡는다 — 조건(발행·저작권 안전·단어 충분)으로 찾는다.
 */
async function pickPublishedBookWithChapterSet(
  minWords: number,
): Promise<{ bookId: string; chapter: number; words: number } | null> {
  const c = serviceClient();
  if (!c) return null;

  const { data: books } = await c
    .from('library_books')
    .select('id')
    .eq('status', 'published')
    .eq('copyright_safe_in_kr', true)
    .limit(20);

  for (const b of ((books ?? []) as Array<{ id: string }>)) {
    const { data: sets } = await c
      .from('shared_word_sets')
      .select('id, curation_query')
      .eq('category', 'library_book')
      .eq('is_published', true)
      .filter('curation_query->>book_id', 'eq', b.id);

    for (const s of ((sets ?? []) as Array<{ id: string; curation_query: Record<string, unknown> | null }>)) {
      const { count } = await c
        .from('shared_words')
        .select('*', { count: 'exact', head: true })
        .eq('set_id', s.id);
      if ((count ?? 0) >= minWords) {
        return {
          bookId: b.id,
          chapter: Number(s.curation_query?.['chapter_idx'] ?? 1),
          words: count ?? 0,
        };
      }
    }
  }
  return null;
}

test.describe('콘텐츠 스코프 — 도서 챕터로 바로 논다 (Phase 2)', () => {
  test('?book=&chapter= 로 큐레이션 챕터 단어가 로드된다 (enroll 불필요)', async ({ page }) => {
    test.setTimeout(150_000);

    const picked = await pickPublishedBookWithChapterSet(8);
    test.skip(!picked, 'service-role 키 없음 또는 발행 도서 챕터 세트를 찾지 못했다');

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="email"]', RUNTIME_USER.email);
    await page.fill('input[type="password"]', RUNTIME_USER.password);
    await page.getByRole('button', { name: /로그인|Sign in/ }).first().click();
    await page.waitForURL(/\/(hub|dashboard)/, { timeout: 30_000 }).catch(() => {});

    await page.goto(
      `/play/cascade?book=${picked!.bookId}&chapter=${picked!.chapter}&from=%2Farcade`,
      { waitUntil: 'domcontentloaded' },
    );

    // 보드가 뜬다 = 스코프 해석이 성공해 minWords 를 넘겼다는 뜻
    await expect(page.locator('.cs-tile--word').first()).toBeVisible({ timeout: 60_000 });

    // 자료 표기가 그 도서의 챕터 단어장이어야 한다 — mine/demo 로 폴백하면 계약이 깨진 것이다
    const label = await page
      .locator('[aria-label^="현재 학습:"]')
      .first()
      .getAttribute('aria-label');
    expect(label, '자료 라벨이 없다').toBeTruthy();
    expect(label, `맛보기로 폴백했다: ${label}`).not.toContain('맛보기');
    expect(label, `단어 수가 표기되지 않았다: ${label}`).toMatch(/\d+개 단어/);
  });

  test('챕터를 생략하면 첫 챕터로 연다 ("도서로 논다" 의 시작점)', async ({ page }) => {
    test.setTimeout(150_000);

    const picked = await pickPublishedBookWithChapterSet(8);
    test.skip(!picked, 'service-role 키 없음 또는 발행 도서 챕터 세트를 찾지 못했다');

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="email"]', RUNTIME_USER.email);
    await page.fill('input[type="password"]', RUNTIME_USER.password);
    await page.getByRole('button', { name: /로그인|Sign in/ }).first().click();
    await page.waitForURL(/\/(hub|dashboard)/, { timeout: 30_000 }).catch(() => {});

    await page.goto(`/play/cascade?book=${picked!.bookId}&from=%2Farcade`, {
      waitUntil: 'domcontentloaded',
    });

    await expect(page.locator('.cs-tile--word').first()).toBeVisible({ timeout: 60_000 });
    const label = await page
      .locator('[aria-label^="현재 학습:"]')
      .first()
      .getAttribute('aria-label');
    expect(label, `챕터 생략 시 자료가 잡히지 않았다: ${label}`).toMatch(/Ch\.?\s*\d+|Chapter/i);
  });
});
