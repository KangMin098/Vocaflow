// apps/web/tests/e2e/16-coupling-notice.spec.ts
//
// 세트 결합 — **세트로 놀면 그 단어가 내 단어가 되고 복습에도 나온다.**
//
// 배경(실측):
//   `recordGameResult` 는 학습자 `vocabularies` 에 없는 단어를 카드 갱신 없이 넘겼다.
//   그 비율이 **97.9%** 다(내 단어 225개 vs 세트 단어 56,079개 · 628세트 기준 겹침 2.1%).
//   세트로 한 세션을 다 놀아도 FSRS 에 0건이 남았다.
//
// 계약이 한 번 바뀌었다 (VOCAB_FRAMEWORK_PROPOSAL 결정 3):
//   v08.5 는 **B안(스킵 노출)** — "이 중 N개는 아직 내 단어가 아니에요" 를 띄웠다.
//   v08.6 은 **A안(lazy 승격)** — 설계안 권장안. 그 자리에서 담고 담았다고 알린다.
//   B안은 사실을 알려주기만 하고 학습자에게 한 걸음을 더 요구했다.
//   그래서 이 스펙의 단언도 뒤집혔다: 세트 스코프에서 기대하는 것은 **승격 고지**다.
//
// 왜 e2e 인가:
//   이 계약은 **런타임에서만** 검증된다. B안을 만들 때 훅을 early return 뒤에 두는 버그를
//   냈는데(`Rendered more hooks than during the previous render`) tsc·단위 테스트는 통과했고
//   런타임만 잡았다. 승격은 거기에 더해 **DB 에 실제로 쓰였는지**까지 봐야 한다 —
//   고지는 상태값으로도 뜰 수 있으니 화면만으로는 증명되지 않는다.
//
// ⚠️ finally 정리 필수 — 승격은 학습자 vocabularies 에 행을 만든다. 남기면
//   `pickSetWithoutOverlap` 이 고를 수 있는 세트가 실행할 때마다 줄어 테스트가 스스로를
//   무력화한다(08-text-extract-trust 의 word_familiarity 원복과 같은 이유).

import { test, expect } from '@playwright/test';

import {
  countVocabulariesSince,
  deleteVocabulariesSince,
  pickSetWithoutOverlap,
  userIdByEmail,
} from './utils/db';
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

const PROMOTED_RE = /내 단어장에 담았어요/;
const NOT_MINE_RE = /복습 일정에는 반영되지 않아요/;

test.describe('세트 결합 — 놀면 내 단어가 된다 (결정 3 · A안)', () => {
  test('세트 스코프로 놀면 그 단어가 vocabularies 에 담기고 화면이 알린다', async ({ page }) => {
    test.setTimeout(180_000);

    const userId = await userIdByEmail(RUNTIME_USER.email);
    test.skip(!userId, 'service-role 키 없음 — DB 대조 불가');

    // 내 단어와 **겹치지 않는** 세트를 DB 에서 고른다. 겹치는 세트로 하면 승격할 것이 없어
    // 고지가 안 뜨는 것이 정상이고, 그러면 "고지 없음" 이 결함인지 정상인지 구별할 수 없다.
    const picked = await pickSetWithoutOverlap(userId!, 12);
    test.skip(!picked, '내 단어와 겹치지 않는 세트를 찾지 못했다');

    const sinceIso = new Date().toISOString();

    try {
      await page.goto('/login', { waitUntil: 'domcontentloaded' });
      await page.fill('input[type="email"]', RUNTIME_USER.email);
      await page.fill('input[type="password"]', RUNTIME_USER.password);
      await page.getByRole('button', { name: /로그인|Sign in/ }).first().click();
      await page.waitForURL(/\/(hub|dashboard)/, { timeout: 30_000 }).catch(() => {});

      await page.goto(`/play/cascade?set=${picked!.setId}&from=%2Farcade`, {
        waitUntil: 'domcontentloaded',
      });

      // 보드가 뜨고 자료가 세트인지 확인 — 스코프가 mine 으로 폴백하면 계약이 성립하지 않는다
      await expect(page.locator('.cs-tile--word').first()).toBeVisible({ timeout: 60_000 });

      // **활성 타일만** 누른다. 잠긴 타일은 pointer-events: none 이라 force 클릭이 아래로 빠지고
      // 채점이 일어나지 않는다(실측: 그래서 서버액션 POST 가 0이었다).
      //
      // ⚠️ 클릭 수를 채점 수로 세면 안 된다 — cascade 는 타일을 눌러 **짝이 성립할 때** 채점한다.
      // 고정 횟수만 누르고 단언하면 보드 상태에 따라 채점이 0회인 채로 "승격이 동작하지 않는다"
      // 라고 잘못 보고한다(실제로 그렇게 만들었다가 배치 실행에서 오탐이 났다).
      // 그래서 **목표 신호(DB 적재)가 나올 때까지** 몰아간다.
      let clicked = 0;
      let promotedRows = 0;
      for (let round = 0; round < 18 && promotedRows < 1; round++) {
        const live = page.locator('.cs-tile--word[aria-disabled="false"]');
        const n = await live.count();
        if (n > 0) {
          await live.first().click({ timeout: 5_000 }).catch(() => {});
          clicked += 1;
        }
        await page.waitForTimeout(700);
        promotedRows = await countVocabulariesSince(userId!, sinceIso, 'shared_set');
      }

      // 하네스 실패(클릭이 한 번도 안 먹음)를 제품 실패로 보고하지 않는다 — 원인이 갈린다.
      expect(clicked, '활성 타일을 한 번도 누르지 못했다 — 게임 진입 자체가 실패했다').toBeGreaterThan(0);

      // **DB 가 근거다.** 고지는 상태값으로도 뜰 수 있어 화면만으로는 증명되지 않는다.
      expect(
        promotedRows,
        `세트 단어 타일을 ${clicked}회 눌렀는데 vocabularies 에 담긴 것이 없다 — 승격이 동작하지 않는다`,
      ).toBeGreaterThanOrEqual(1);

      const notice = page.getByText(PROMOTED_RE);
      await expect(notice, 'DB 에는 담겼는데 학습자에게 알리지 않는다 — 조용한 쓰기다').toBeVisible({
        timeout: 20_000,
      });

      // 승격했으므로 "내 단어가 아니다" 고지는 더 이상 뜨지 않아야 한다(계약 반전 확인)
      await expect(page.getByText(NOT_MINE_RE), 'A안인데 B안 고지가 남아 있다').toHaveCount(0);

      // 학습을 막지 않아야 한다 — 배지가 클릭을 가로채면 게임이 멈춘다
      const pe = await notice.first().evaluate((el) => getComputedStyle(el).pointerEvents);
      expect(pe, '고지가 포인터 이벤트를 가로챈다').toBe('none');

      // 모달이 아니어야 한다(학습 중 오버레이 금지)
      expect(await page.getByRole('dialog').count(), '고지가 모달로 떴다').toBe(0);
    } finally {
      await deleteVocabulariesSince(userId!, sinceIso);
    }
  });

  test('내 단어만으로 놀면 어떤 고지도 뜨지 않는다 (거짓 경보 금지)', async ({ page }) => {
    test.setTimeout(120_000);

    await page.goto('/login', { waitUntil: 'domcontentloaded' });
    await page.fill('input[type="email"]', RUNTIME_USER.email);
    await page.fill('input[type="password"]', RUNTIME_USER.password);
    await page.getByRole('button', { name: /로그인|Sign in/ }).first().click();
    await page.waitForURL(/\/(hub|dashboard)/, { timeout: 30_000 }).catch(() => {});

    // 스코프 없이 진입 = mine(내 due 큐) → 전부 내 단어라 승격할 것도, 알릴 것도 없다
    await page.goto('/play/cascade?from=%2Farcade', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.cs-tile--word').first()).toBeVisible({ timeout: 60_000 });

    for (let i = 0; i < 5; i++) {
      const live = page.locator('.cs-tile--word[aria-disabled="false"]');
      if ((await live.count()) === 0) break;
      await live.first().click({ timeout: 5_000 }).catch(() => {});
      await page.waitForTimeout(700);
    }
    await page.waitForTimeout(2_500);

    await expect(page.getByText(NOT_MINE_RE), '내 단어로 놀았는데 고지가 떴다').toHaveCount(0);
    await expect(page.getByText(PROMOTED_RE), '담을 것이 없는데 승격 고지가 떴다').toHaveCount(0);
  });
});
