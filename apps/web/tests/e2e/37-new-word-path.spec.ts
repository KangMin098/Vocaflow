// apps/web/tests/e2e/37-new-word-path.spec.ts
//
// **"새 단어 N" 을 누른 학생이 학습을 시작하기까지** — 폰 390px 에서 끝까지 밟는다.
//
// ── 왜 (실측 2026-08-29) ─────────────────────────────────────────────
// 리본에 "새 단어 N" 칸이 생긴 것은 2026-08-27 이다(교사가 보낸 낱말이 "오늘 할 일" 에
// 닿지 않던 결함). 그런데 **그 칩을 누른 다음이 한 번도 밟힌 적이 없었다.** 밟아 보니:
//   ① 칩 → `/wordvault` 허브 → 같은 수를 다시 세어 보여 주고 CTA 를 또 눌러야 했다
//   ② CTA 가 보내는 `?filter=state:new` 를 **읽는 코드가 저장소에 0개**였다
//      → 11개를 약속하고 252개 전체가 열렸다. 오류도 경고도 없다
//   ③ 그 목록 화면에는 **학습으로 나가는 문이 없었다**(풀스크린이라 세그먼트도 없다)
//
// 셋 다 "화면은 뜨는데 말한 것과 다른 것이 온다" 는 같은 계열이고, 렌더 테스트로는
// 안 잡힌다 — 각 화면은 저마다 정상이었다. **이어서 밟아야만** 보인다.
//
// 판정은 화면이 말한 수를 다음 화면이 지키는지로 한다(하드코딩한 기대값을 쓰지 않는다 —
// 계정 데이터가 바뀌면 조용히 통과하는 테스트가 된다).

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { expect, test } from '@playwright/test';

import { ensureAuthState } from './utils/auth';
import { describeOffender, scanTapTargets, TAP_MIN, TAP_MIN_TEXT_WIDTH } from './utils/tap-target';

const STATE_PATH = 'playwright-auth/.auth-new-word-path.json';
const PHONE = { width: 390, height: 844 };

test.describe('새 단어 경로 — 칩에서 학습 시작까지', () => {
  test.beforeAll(async ({ browser }) => {
    await ensureAuthState(browser, STATE_PATH);
  });

  test.use({ storageState: STATE_PATH, viewport: PHONE });

  test('칩이 말한 수를 목록과 세션이 지킨다', async ({ page }) => {
    // ── ① 허브 리본의 "새 단어" 칩 ──
    await page.goto('/hub', { waitUntil: 'networkidle' });

    const chip = page.getByRole('link', { name: /아직 안 배운 단어 \d+개 보기/ });
    await expect(chip, '리본에 "새 단어" 칩이 없다 — 계정에 미학습 낱말이 없거나 띠가 안 뜬다').toBeVisible();

    const chipLabel = (await chip.getAttribute('aria-label')) ?? '';
    const promised = Number(chipLabel.match(/(\d+)개/)?.[1] ?? '0');
    expect(promised, '칩이 0을 말하고 있다 — 그러면 이 경로를 잴 수 없다').toBeGreaterThan(0);

    // ── ② 누른 자리가 곧 걸러진 목록이어야 한다 (허브 경유 금지) ──
    await chip.click();
    await page.waitForURL(/\/wordvault\/browse\?.*filter=state%3Anew|\/wordvault\/browse\?filter=state:new/, {
      timeout: 15_000,
    });

    // ── ③ 목록이 약속한 수를 지키는가 ──
    const bar = page.getByText(/새 단어\s+[\d,]+개/).first();
    await expect(bar, '상태 필터 머리말이 없다 — 무엇을 보고 있는지 화면이 말하지 않는다').toBeVisible();
    const shown = Number(((await bar.textContent()) ?? '').replace(/[^\d]/g, ''));
    expect(shown, `칩은 ${promised} 라 했는데 목록은 ${shown} 이다`).toBe(promised);

    // ── ④ 여기서 학습으로 나가는 문이 있는가 ──
    const start = page.getByRole('link', { name: /이 단어로 학습 시작/ });
    await expect(start, '목록에서 학습으로 나가는 문이 없다 — 세어 주고 시작할 수 없는 화면').toBeVisible();

    // ── ⑤ 세션이 그 묶음으로 열리는가 ──
    await start.click();
    await page.waitForURL(/\/wordvault\/study\?filter=state(%3A|:)new/, { timeout: 15_000 });

    // ⚠️ "빈 상태가 없다" 로 재지 않는다 — 화면이 500 으로 죽어도 그 문구는 없다.
    //    **있어야 할 것이 있는지**로 잰다(부재 단언은 크래시를 통과시킨다).
    const counter = page.locator('span', { hasText: /^\d+ \/ \d+$/ }).first();
    await expect(counter, '학습 카드가 뜨지 않았다 — 세션이 열리지 않았거나 화면이 죽었다').toBeVisible({
      timeout: 15_000,
    });

    // 세션 길이 = min(약속한 수, 세션 상한). 상한은 코드에서 읽는다(값을 베끼면 갈라진다).
    const capSrc = readFileSync(resolve(__dirname, '../../src/lib/wordvault/study-queries.ts'), 'utf8');
    const cap = Number(capSrc.match(/STUDY_SESSION_CAP\s*=\s*(\d+)/)?.[1] ?? '0');
    expect(cap, 'STUDY_SESSION_CAP 을 소스에서 못 읽었다').toBeGreaterThan(0);

    const total = Number(((await counter.textContent()) ?? '').split('/')[1]?.trim() ?? '0');
    expect(total, `목록은 ${promised} 개인데 세션은 ${total} 장이다 (상한 ${cap})`).toBe(
      Math.min(promised, cap),
    );
  });

  test('경로의 조작 요소가 폰에서 44px 이상이다', async ({ page }) => {
    const routes = ['/hub', '/wordvault/browse?filter=state:new', '/wordvault/study?filter=state:new'];
    const failures: string[] = [];

    for (const route of routes) {
      await page.goto(route, { waitUntil: 'networkidle' });
      const offenders = await page.evaluate(scanTapTargets, {
        min: TAP_MIN,
        minTextWidth: TAP_MIN_TEXT_WIDTH,
      });
      for (const o of offenders) failures.push(`${route} — ${describeOffender(o)}`);
    }

    expect(failures, `폰 ${PHONE.width}px 에서 작은 조작 요소:\n${failures.join('\n')}`).toEqual([]);
  });
});
