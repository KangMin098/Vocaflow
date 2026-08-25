// apps/web/tests/e2e/32-touch-targets.spec.ts
//
// **손가락이 누르는 것은 전부 44px 이상이다** — 학습자 전 화면 @390px.
//
// ── 왜 (실측 2026-08-26) ────────────────────────────────────────────────
// CLAUDE.md 는 "44px 미만 터치 타겟" 을 **절대 하지 않을 것**에 올려 두었는데,
// 그것을 재는 테스트는 없었다. 실제로 학습자 화면에서 10건이 나왔다 —
// 24×24 북마크 · 36×36 세션 닫기 · 32px 높이의 "뜻 보기"(학습 중 가장 자주 누르는 버튼) 등.
//
// ── 이 스펙이 세 번의 오탐을 거쳐 온 길 ─────────────────────────────────
//   ① 정적 grep(`h-8`/`h-9`)은 **62건**을 셌다 — 큰 탭 영역 안의 아이콘, 데스크톱 전용 도구,
//      화면에 안 뜨는 것까지 전부. 소스만 보고는 손가락이 겪는 것을 알 수 없다.
//   ② 런타임 1판은 `sr-only` 입력(1×1)을 그대로 셌다 — 스타일된 토글 **뒤에 숨긴 체크박스**다.
//      그대로 믿었으면 멀쩡한 `/settings` 토글 7개를 "고쳐" 놓을 뻔했다.
//   ③ 16×16 체크박스도 마찬가지였다 — `p-3` 라벨 안이라 **라벨 전체가 탭 대상**이다.
//   → 지금 규칙: 체크박스·라디오는 크기와 무관하게 **감싸는 label** 을 잰다.
//      본문 안 인라인 텍스트 링크는 이 규칙의 대상이 아니다(버튼·아이콘만 본다).
//
// 데스크톱에서는 재지 않는다 — 마우스 포인터는 1px 이라 이 규칙의 이유가 없다.

import { expect, test } from '@playwright/test';

import { ensureAuthState } from './utils/auth';
import { learnerRoutes, SESSION_ROUTES } from './utils/learner-routes';

const STATE_PATH = 'playwright-auth/.auth-touch-targets.json';
const MIN = 44;

interface Offender {
  route: string;
  tag: string;
  label: string;
  size: string;
}

test.describe('탭 대상 44px — 학습자 전 화면 @390px', () => {
  test.beforeAll(async ({ browser }) => {
    test.setTimeout(120_000);
    await ensureAuthState(browser, STATE_PATH);
  });
  test.use({ storageState: STATE_PATH, viewport: { width: 390, height: 844 } });

  test('44px 미만으로 눌러야 하는 것이 없다', async ({ page }) => {
    const routes = learnerRoutes();
    test.setTimeout(routes.length * 14_000 + 120_000);
    expect(routes.length, '라우트를 못 찾았다 — 목록 추출이 깨졌다').toBeGreaterThan(20);

    const offenders: Offender[] = [];

    for (const route of routes) {
      const res = await page
        .goto(route, { waitUntil: 'domcontentloaded', timeout: 40_000 })
        .catch(() => null);
      if (!res || res.status() >= 400 || /\/login/.test(page.url())) {
        await page.goto('about:blank').catch(() => {});
        continue;
      }
      // 세션 화면은 **열되 누르지 않는다** — 여기서도 재기만 한다(기록을 남기지 않는다).
      await page.waitForTimeout(SESSION_ROUTES.has(route) ? 1200 : 900);

      const found = await page
        .evaluate((min) => {
          const out: { tag: string; label: string; w: number; h: number }[] = [];
          const sel =
            'button, a[href], [role="button"], input[type="checkbox"], input[type="radio"], select';
          for (const el of Array.from(document.querySelectorAll(sel))) {
            const r0 = el.getBoundingClientRect();
            if (r0.width === 0 || r0.height === 0) continue;
            const cs = getComputedStyle(el);
            if (cs.visibility === 'hidden' || cs.display === 'none' || cs.pointerEvents === 'none')
              continue;

            // 체크박스·라디오는 크기와 무관하게 감싸는 label 이 탭 대상이다.
            let target: Element = el;
            if (el.tagName === 'INPUT') {
              const lab =
                el.closest('label') ??
                (el.id ? document.querySelector(`label[for="${CSS.escape(el.id)}"]`) : null);
              if (!lab) continue; // 라벨이 없으면 판단하지 않는다
              target = lab;
            }
            const r = target.getBoundingClientRect();
            if (Math.min(r.width, r.height) >= min) continue;

            // 본문 안 인라인 텍스트 링크는 대상이 아니다 — 문장 속 링크까지 44px 로 키우면
            // 읽는 글이 버튼 목록이 된다. 아이콘/버튼만 본다.
            if (el.tagName === 'A' && r.height < 30 && (el.textContent ?? '').trim().length > 3)
              continue;

            out.push({
              tag: el.tagName,
              label: (el.getAttribute('aria-label') ?? el.textContent ?? '')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 30),
              w: Math.round(r.width),
              h: Math.round(r.height),
            });
          }
          return out;
        }, MIN)
        .catch(() => []);

      for (const f of found) {
        offenders.push({ route, tag: f.tag, label: f.label, size: `${f.w}×${f.h}` });
      }
      await page.goto('about:blank').catch(() => {});
    }

    const summary = offenders
      .map((o) => `  ${o.size.padStart(8)}  ${o.tag.padEnd(7)} ${o.route} — ${o.label}`)
      .join('\n');

    expect(
      offenders,
      `44px 미만 탭 대상 ${offenders.length}건 (390px):\n${summary}`,
    ).toEqual([]);
  });
});
