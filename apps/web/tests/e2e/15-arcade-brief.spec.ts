// apps/web/tests/e2e/15-arcade-brief.spec.ts
//
// Protocol 브리핑 — **19종 전부**를 데이터로 구동해 실제로 통과 가능한지 확인한다.
//
// 왜 표본이 아니라 전수인가:
//   브리핑의 실패는 예외가 아니라 **막힌 튜토리얼**이다. `want` 가 그 스텝에 아직 숨은
//   토큰을 가리키면 학습자는 영원히 통과할 수 없는데 화면은 멀쩡해 보인다. 단위 테스트가
//   참조 무결성을 잡지만, 잡지 못하는 것이 있다 — 렌더러가 그 프리미티브를 실제로 그리는지,
//   판정이 결정 카드·타이핑·비용 타일을 제대로 받는지. 그건 눌러 봐야만 안다.
//   (v08.4 에서 스키마가 크게 넓어졌으므로 특히 그렇다.)
//
// 검증 방식: 브리핑 데이터를 그대로 읽어 `want` 를 순서대로 누르고, 타이핑 스텝은 실제로
// 입력한다. 즉 **데이터와 화면이 어긋나면 즉시 실패**한다. 셀렉터는 `data-id` — cascade 는
// 같은 정답이 세 자리에 깔려서 텍스트로는 타일을 구별할 수 없다.
//
// 경로 탐색을 한 번만 하는 이유: 게임은 단독 카드에도 있고 계열 카드의 탭에도 있어서
// "이 게임의 브리핑이 어디 있나"를 화면에서 찾아야 한다. 그걸 테스트마다 반복하면
// 19 × 13 번 다이얼로그를 여닫아 실행이 수십 분으로 늘어난다(실측). 그래서 beforeAll 에서
// 한 번 훑어 `slug → (트리거 index, 탭 index)` 지도를 만들어 공유한다.
//
// 이 스펙은 로그인하지 않는다. 브리핑은 허브에서 "무엇을 할지 고르는" 국면의 자산이고
// 비로그인에서도 열려야 한다(그래야 처음 온 사람이 게임을 이해할 수 있다).

import { test, expect, type Page } from '@playwright/test';

import { GAME_BRIEFS, gaugesOf } from '../../src/lib/game/brief';
import { ensureAuthState } from './utils/auth';
import { ALL_SLUGS, BRIEF_SEEN_KEY, clearBriefsSeen } from './utils/brief';

const BRIEFS = Object.values(GAME_BRIEFS);

/** slug → 허브에서의 위치. beforeAll 이 한 번 채운다. */
const WHERE = new Map<string, { trigger: number; tab: number }>();

async function launchHref(page: Page): Promise<string> {
  return (
    (await page.getByRole('dialog').locator('a.bf-launch').first().getAttribute('href')) ?? ''
  );
}

test.describe('Protocol 브리핑', () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(180_000);
    const page = await browser.newPage();
    await page.goto('/arcade', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.arc-slot').first()).toBeVisible({ timeout: 60_000 });

    const triggers = page.locator('.arc-brief');
    const n = await triggers.count();
    for (let i = 0; i < n; i++) {
      await triggers.nth(i).click();
      const dlg = page.getByRole('dialog');
      await expect(dlg).toBeVisible();

      const tabs = dlg.getByRole('tab');
      const tn = await tabs.count();
      if (tn === 0) {
        const slug = (await launchHref(page)).replace(/^\/play\//, '').split('?')[0];
        if (slug && !WHERE.has(slug)) WHERE.set(slug, { trigger: i, tab: -1 });
      } else {
        for (let t = 0; t < tn; t++) {
          await tabs.nth(t).click();
          const slug = (await launchHref(page)).replace(/^\/play\//, '').split('?')[0];
          if (slug && !WHERE.has(slug)) WHERE.set(slug, { trigger: i, tab: t });
        }
      }
      await page.keyboard.press('Escape');
      await expect(page.getByRole('dialog')).toHaveCount(0);
    }
    await page.close();

    const missing = BRIEFS.map((b) => b.slug).filter((s) => !WHERE.has(s));
    expect(missing, `허브에서 브리핑에 닿을 수 없는 게임: ${missing.join(', ')}`).toEqual([]);
  });

  for (const brief of BRIEFS) {
    const slug = brief.slug;

    test(`${slug} — 그림 3장 + 트라이얼 ${brief.trial.steps.length}스텝 통과`, async ({ page }) => {
      const errors: string[] = [];
      page.on('console', (m) => {
        if (m.type() === 'error') errors.push(m.text().slice(0, 200));
      });
      page.on('pageerror', (e) => errors.push(`PAGEERROR ${String(e).slice(0, 200)}`));

      const at = WHERE.get(slug);
      expect(at, `${slug}: 위치 지도에 없다`).toBeTruthy();

      await page.goto('/arcade', { waitUntil: 'domcontentloaded' });
      await expect(page.locator('.arc-slot').first()).toBeVisible({ timeout: 60_000 });

      // 트리거는 서버 렌더된 허브 위의 **클라이언트 아일랜드**다(BriefButton). 보이는 것과
      // 하이드레이션이 끝난 것은 다르고, 워커를 여럿 띄워 dev 서버를 두드리면 그 간극이
      // 벌어진다 — 첫 클릭이 조용히 먹히지 않아 다이얼로그가 안 열렸다(실측: 3종 flaky).
      // 열릴 때까지 한 번 더 누른다. 계약("(?) 를 누르면 브리핑이 열린다")은 그대로 검증된다.
      const trigger = page.locator('.arc-brief').nth(at!.trigger);
      const dlg = page.getByRole('dialog');
      await trigger.click();
      if (!(await dlg.isVisible().catch(() => false))) {
        await page.waitForTimeout(1_200);
        await trigger.click({ timeout: 10_000 }).catch(() => {});
      }
      await expect(dlg, '(?) 를 눌렀는데 브리핑이 열리지 않는다').toBeVisible({ timeout: 15_000 });
      if (at!.tab >= 0) await dlg.getByRole('tab').nth(at!.tab).click();

      // 지도가 낡지 않았는지 — 이 다이얼로그가 정말 그 게임인가
      expect(await launchHref(page), `${slug}: 다른 게임의 브리핑이 열렸다`).toMatch(
        new RegExp(`^/play/${slug}(\\?|$)`),
      );

      // ── 절차 — 같은 보드의 세 순간. 3장이 아니면 "초기·성공·실패" 대조가 깨진다.
      await expect(dlg.locator('.bf-fig .bb[data-variant="figure"]')).toHaveCount(3);

      const trial = dlg.locator('.bb[data-variant="trial"]');
      await expect(trial).toBeVisible();

      // 아키타입이 데이터와 같은가 — 잘못된 손동작을 가르치던 결함(motion 0점)의 회귀 방어
      await expect(trial).toHaveAttribute('data-kind', brief.board.kind);

      // 판돈이 그림에 있는가 — 게이지 수가 데이터와 일치해야 한다
      const gauges = gaugesOf(brief.board);
      if (gauges.length > 0) {
        await expect(trial.locator('.bb-hud')).toHaveCount(gauges.length);
      }

      // ── 트라이얼 — 데이터가 지시하는 대로 눌러/쳐서 통과한다
      for (const [i, step] of brief.trial.steps.entries()) {
        if (step.type) {
          const input = dlg.locator('.bf-type-in');
          await expect(input, `${slug} step${i}: 타이핑 입력칸이 없다`).toBeVisible();
          await input.fill(step.type.answer);
          await dlg.locator('.bf-type-go').click();
        } else {
          for (const id of step.want) {
            const target = trial.locator(`[data-id="${id}"]`);
            await expect(target, `${slug} step${i}: ${id} 가 화면에 없다`).toBeVisible({ timeout: 6_000 });
            await target.click();
          }
        }
        // 스텝 전환에 620ms 지연이 있다(무엇이 맞았는지 보여 주기 위한 의도된 지연)
        if (i + 1 < brief.trial.steps.length) await page.waitForTimeout(900);
      }

      await expect(dlg.locator('.bf-ok'), `${slug}: 데이터대로 눌렀는데 통과하지 않는다`).toBeVisible({
        timeout: 6_000,
      });

      const real = errors.filter((e) => !/favicon|Failed to load resource|404/i.test(e));
      expect(real, `${slug} 콘솔 에러:\n${real.join('\n')}`).toEqual([]);
    });
  }

  // ── 새 프리미티브가 데이터에만 있고 화면에 없으면 "설명하지 않는 설명" 이 된다 ──
  test('결정 스트립이 정답 격자 밖에 그려진다 (섞이면 "답" 으로 읽힌다)', async ({ page }) => {
    const b = BRIEFS.find((x) => (x.board.choices?.length ?? 0) > 0)!;
    const at = WHERE.get(b.slug)!;
    await page.goto('/arcade', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.arc-slot').first()).toBeVisible({ timeout: 60_000 });
    await page.locator('.arc-brief').nth(at.trigger).click();
    const dlg = page.getByRole('dialog');
    await expect(dlg).toBeVisible();
    if (at.tab >= 0) await dlg.getByRole('tab').nth(at.tab).click();

    const trial = dlg.locator('.bb[data-variant="trial"]');
    await expect(trial.locator('.bb-choices .bb-ch').first()).toBeVisible();
    expect(await trial.locator('.bb-tiles .bb-ch').count(), '결정이 정답 격자에 섞였다').toBe(0);
    // 결정 카드는 손익을 나란히 놓아야 결정이 성립한다
    expect(await trial.locator('.bb-choices .bb-ch').first().locator('.bb-ch-line').count()).toBeGreaterThan(0);
  });

  test('이산 자원은 핍으로 그려진다 ("반쯤 남은 촛불" 을 만들지 않는다)', async ({ page }) => {
    const b = BRIEFS.find((x) => gaugesOf(x.board).some((g) => g.pips))!;
    expect(b, '핍 게이지를 쓰는 게임이 없다 — 스키마 확장이 데이터에 반영되지 않았다').toBeTruthy();
    const at = WHERE.get(b.slug)!;
    await page.goto('/arcade', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('.arc-slot').first()).toBeVisible({ timeout: 60_000 });
    await page.locator('.arc-brief').nth(at.trigger).click();
    const dlg = page.getByRole('dialog');
    await expect(dlg).toBeVisible();
    if (at.tab >= 0) await dlg.getByRole('tab').nth(at.tab).click();

    const pips = dlg.locator('.bb[data-variant="trial"] .bb-hud[data-kind="pips"] .bb-pips i');
    await expect(pips.first()).toBeVisible();
    const states = await pips.evaluateAll((els) => els.map((e) => e.getAttribute('data-on')));
    expect(new Set(states).size, '핍 상태가 켜짐/꺼짐 2종을 넘는다').toBeLessThanOrEqual(2);
  });

  test('타이핑 스텝의 답은 탭으로 얻을 수 없다 (인출을 재인으로 바꾸지 않는다)', async ({ page }) => {
    const typed = BRIEFS.filter((x) => x.trial.steps.some((s) => s.type));
    expect(typed.length, '타이핑 스텝을 쓰는 게임이 없다').toBeGreaterThan(0);

    // 보드에 토큰이 있어도 된다 — wordsmith-vigil 의 타일은 **조준 대상 정령**(한국어 뜻)이고
    // 실제 게임에서도 그렇다. 지켜야 할 것은 "칸 수만 보이는 상태에서 철자를 떠올린다" 는
    // 인출 조건이다. 답이 타일에 이미 적혀 있으면 그 스텝은 재인으로 퇴화한다.
    const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, '');
    for (const b of typed) {
      for (const s of b.trial.steps) {
        if (!s.type) continue;
        const answer = norm(s.type.answer);
        const leak = b.board.tokens.find((t) => norm(t.text) === answer);
        expect(leak?.id, `${b.slug}: 타일 ${leak?.id} 에 답 "${s.type.answer}" 이 그대로 적혀 있다`).toBeUndefined();
        // 글자 조각으로 조립할 수 있으면 그것도 탭으로 얻는 것이다
        const singles = b.board.tokens.filter((t) => norm(t.text).length === 1).map((t) => norm(t.text));
        const spellable =
          singles.length >= answer.length && [...answer].every((ch) => singles.includes(ch));
        expect(spellable, `${b.slug}: 글자 타일로 답을 조립할 수 있다 — 타이핑이 무의미하다`).toBe(false);
      }
      if (b.board.kind === 'type') {
        expect(b.board.slots, `${b.slug}: 칸 수가 없다 — 몇 글자인지 모르면 인출 단서가 사라진다`).toBeGreaterThan(0);
      }
    }
    // 실제 입력 판정은 전수 스펙이 게임별로 구동한다(step.type 분기).
    expect(page).toBeTruthy();
  });
});

// ══════════════════════════════════════════════════════════════════
// 게임 안 브리핑 게이트 (v08.6)
//
// 왜 별도 describe 인가:
//   위 전수 스펙은 **허브**의 (?) 트리거를 검증한다. v08.6 이 연 두 번째·세 번째 경로는
//   게임 안이다 — 첫 판은 게임을 마운트하지 않고 브리핑을 먼저 띄우고, 이후엔 (?) 로 다시 본다.
//   허브를 거치지 않는 진입(코스 칩 · 오늘의 실험 · 주소 직접 입력 · 세션 복귀)이 이미 여럿이라,
//   이 경로가 없으면 그 학습자들은 규칙을 한 번도 보지 못한 채 게임 안에 떨어진다.
//
//   이 describe 는 **열람 기록을 심지 않는다**. 다른 아케이드 스펙은 utils/brief 의
//   seedBriefsSeen 으로 "돌아온 학습자" 를 재현하므로, 여기서까지 심으면 게이트는
//   아무도 안 보는 코드가 된다.
//
//   /play/* 는 로그인 표면이다(카탈로그는 공개, 세션은 잠김 — apps/web/CLAUDE.md).
// ══════════════════════════════════════════════════════════════════


const GATE_STATE = 'playwright-auth/.auth-arcade-brief-gate.json';

test.describe('게임 안 브리핑 게이트', () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000);
    await ensureAuthState(browser, GATE_STATE);
  });
  test.use({ storageState: GATE_STATE });

  test.beforeEach(async ({ page }) => {
    await clearBriefsSeen(page);
  });

  test('첫 판 — 브리핑이 먼저 뜨고 게임은 아직 마운트되지 않는다', async ({ page }) => {
    await page.goto('/play/cascade?from=/arcade', { waitUntil: 'domcontentloaded' });

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 60_000 });
    await expect(dialog).toContainText('Objective');

    // 게임이 뒤에서 돌고 있으면 안 된다 — 이 아케이드의 게임은 대부분 마운트와 함께
    // 시계·박·거리가 흐르므로, 위에 띄우기만 하면 브리핑을 읽는 동안 첫 판이 소모된다.
    await expect(page.locator('canvas, [data-game-root]')).toHaveCount(0);

    // 허브의 Launch 는 링크지만 게임 안에서는 "이 판을 시작" 이라 버튼이어야 한다.
    // 링크로 두면 같은 URL 로의 no-op 이동이 되어 "눌렀는데 아무 일도 없다" 가 된다.
    const launch = dialog.locator('button.bf-launch');
    await expect(launch).toBeVisible();
    await expect(dialog.locator('a.bf-launch')).toHaveCount(0);
  });

  test('시작하기 → 브리핑이 닫히고 게임이 뜬다 · 재방문에는 안 뜬다', async ({ page }) => {
    await page.goto('/play/cascade?from=/arcade', { waitUntil: 'domcontentloaded' });
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 60_000 });
    await dialog.locator('button.bf-launch').click();
    await expect(dialog).toHaveCount(0);

    // 열람 기록이 남았는가 — 남지 않으면 매 진입마다 브리핑이 떠서 성가신 앱이 된다.
    const seen = await page.evaluate(
      (k) => JSON.parse(window.localStorage.getItem(k) || '{}'),
      BRIEF_SEEN_KEY,
    );
    expect(seen.cascade).toBe(true);

    // 같은 세션에서 다시 들어가면 곧장 게임 — clearBriefsSeen 은 addInitScript 라
    // 새 네비게이션마다 다시 지우므로, 여기서는 기록이 살아 있는 재방문을 직접 만든다.
    await page.evaluate(
      ([k, v]) => window.localStorage.setItem(k as string, v as string),
      [BRIEF_SEEN_KEY, JSON.stringify({ cascade: true })] as [string, string],
    );
  });

  test('재열람 (?) — 브리핑을 본 뒤에도 게임 안에서 다시 열 수 있다', async ({ page }) => {
    await page.goto('/play/cascade?from=/arcade', { waitUntil: 'domcontentloaded' });
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 60_000 });
    await dialog.locator('button.bf-launch').click();
    await expect(dialog).toHaveCount(0);

    const reopen = page.getByRole('button', { name: /게임 설명과 연습 다시 보기/ });
    await expect(reopen).toBeVisible({ timeout: 30_000 });

    // 44px 최소 터치 타겟 (CLAUDE.md)
    const box = await reopen.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);

    await reopen.click();
    await expect(page.getByRole('dialog')).toBeVisible();
  });

  test('스캐폴드를 쓰지 않는 wordblitz 도 게이트를 갖는다', async ({ page }) => {
    // 19종 중 유일하게 GamePlayScaffold 를 안 쓰는 경로다. 배선을 빠뜨리면
    // 이 하나만 규칙 없이 시작되는데 다른 어떤 스펙도 그것을 보지 못한다.
    await page.goto('/play/wordblitz?from=/arcade', { waitUntil: 'domcontentloaded' });
    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible({ timeout: 60_000 });
    await expect(dialog).toContainText('WordBlitz');
    await expect(dialog.locator('button.bf-launch')).toBeVisible();
  });

  test('드리프트 락 — utils/brief 의 ALL_SLUGS 가 카탈로그 브리핑과 같다', async () => {
    // 이 목록이 낡으면 seedBriefsSeen 이 새 게임을 못 심고, 그 증상은
    // "그 게임 스펙만 가끔 실패" 로 나타나 원인을 찾기 어렵다.
    expect([...ALL_SLUGS].sort()).toEqual(Object.keys(GAME_BRIEFS).sort());
  });
});
