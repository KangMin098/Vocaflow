// apps/web/tests/e2e/47-csat-session.spec.ts
//
// **기출 세션 루프 런타임 회귀** — docs/csat-learner-brief.md [F] 의 F3 · F6 를 상시로 잠근다.
//
// 지키는 계약:
//   ① 문제지가 없는 기기에서는 문항 자리에 「받기/놓기」가 뜨고, 놓으면 **그 자리에서** 문항이 선다
//   ② 답을 고르기 전 DOM 에 밑줄·설명·정오 표식이 **없다**(F3)
//   ③ 근거 문장을 누르면 **바로 아래** 설명이 열리고, 다시 누르면 접힌다(F6)
//   ④ 오답 카드를 누르면 한 줄이 열리고 관련 문장이 **화면 안으로 스크롤**돼 강조된다(F6)
//   ⑤ 문장 단추가 문단을 끊지 않는다 — `display: inline`(버튼이면 inline-block 이라 문장마다 줄이 바뀐다)
//   ⑥ [헷갈려요] 뒤 끝 화면이 「다음 복습」을 말한다
//
//   ⑦ 기록이 기기와 **서버**(`csat_session_attempts` · `csat_review_queue`)에 남는다
//
//   · 계정: runtime-test-0705@vocaflow.dev · 시작 때 이 계정의 기출 세션 기록을 지운다(자기 행만 · RLS)
//
// ⚠️ 원본 PDF 는 저장소에 없다(평가원 저작물). 없으면 **소리 내어** 건너뛴다.

import fs from 'node:fs';
import path from 'node:path';

import { test, expect } from '@playwright/test';

const STATE_PATH = 'playwright-auth/.auth-csat-learner.json';
const PAPER_CANDIDATES = [
  'C:/Users/Administrator/Documents/영어/수능영어기출/수능기출',
].flatMap((d) => (fs.existsSync(d) ? fs.readdirSync(d).map((f) => path.join(d, f)) : []));
/** 2026 수능 영어 문제지 — 파일 이름이 흔들려 온 전력이 있어 해시 대신 이름 두 규칙을 본다 */
const paperPath =
  PAPER_CANDIDATES.find((p) => /2026_영어영역.*문제지\.pdf$/.test(p) || /2026_.*영어.*\.pdf$/.test(p) && !p.includes('정답')) ??
  null;

test.describe('기출 세션 — 한 문항 = 한 화면', () => {
  test.skip(!fs.existsSync(STATE_PATH), `미리 구운 세션이 없다 — npx tsx scripts/e2e-session.mts ${path.basename(STATE_PATH)}`);
  test.skip(!paperPath, '2026 수능 영어 문제지 원본이 이 기기에 없다 — 파일 모드 검사를 건너뛴다');
  test.use({ storageState: STATE_PATH, viewport: { width: 375, height: 812 }, isMobile: true, hasTouch: true });

  test('풀기 → 이해 → 한 줄 · 설명은 제출 뒤에만', async ({ page }) => {
    test.setTimeout(240_000);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));

    // 깨끗한 기기 — 서버 기록도(읽을 때 기기 기록과 합쳐진다)
    await page.request.delete('/api/csat/session/record');
    await page.goto('/csat/progress', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    await page.evaluate(
      () =>
        new Promise<void>((res) => {
          const r = indexedDB.deleteDatabase('vocaflow-csat');
          r.onsuccess = r.onerror = r.onblocked = () => res();
        }),
    );

    await page.goto('/csat/session?set=2026-18&k=order', { waitUntil: 'domcontentloaded', timeout: 120_000 });
    // ① 문제지 놓기
    await expect(page.getByTestId('paper-need')).toBeVisible({ timeout: 60_000 });
    await page.getByTestId('paper-input').setInputFiles(paperPath!);
    const screen = page.locator('[data-testid="item-screen"][data-phase="solve"]');
    await expect(screen).toBeVisible({ timeout: 90_000 });
    await expect(page.getByTestId('passage')).toContainText('Amanda Clark');

    // ② 제출 전 — 표식이 없다
    await expect(page.locator('[data-note-kind]')).toHaveCount(0);
    await expect(page.getByTestId('sentence-note')).toHaveCount(0);
    await expect(page.getByTestId('verdict')).toHaveCount(0);
    await expect(page.locator('[data-state="answer"]')).toHaveCount(0);

    // 오답을 고른다(2026#18 의 답은 ②)
    await page.locator('[data-choice="1"]').click();
    await expect(page.locator('[data-testid="item-screen"][data-phase="understand"]')).toBeVisible({ timeout: 60_000 });
    await expect(page.locator('[data-choice="2"]')).toHaveAttribute('data-state', 'answer');
    await expect(page.locator('[data-choice="1"]')).toHaveAttribute('data-state', 'wrong');

    // ③ 근거 문장 → 설명
    const ev = page.locator('[data-note-kind="evidence"]').first();
    await expect(ev).toBeVisible();
    // ⑤ 문장 단추는 인라인이다
    expect(await ev.evaluate((el) => getComputedStyle(el).display)).toBe('inline');
    await ev.click();
    await expect(ev).toHaveAttribute('aria-expanded', 'true');
    await expect(page.getByTestId('sentence-note')).toBeVisible();
    await ev.click();
    await expect(page.getByTestId('sentence-note')).toHaveCount(0);

    // ④ 오답 카드 → 한 줄 + 관련 문장 스크롤·강조
    await page.evaluate(() => window.scrollTo({ top: document.body.scrollHeight }));
    await page.locator('[data-choice="1"]').click();
    await expect(page.getByTestId('choice-note')).toBeVisible();
    await expect
      .poll(
        () =>
          page.evaluate(() => {
            const el = [...document.querySelectorAll<HTMLElement>('[data-sentence]')].find((e) =>
              /ju-light/.test(e.className),
            );
            if (!el) return false;
            const r = el.getBoundingClientRect();
            return r.bottom > 0 && r.top < window.innerHeight;
          }),
        { timeout: 3_000 },
      )
      .toBe(true);

    // ⑥ 헷갈려요 → 끝 화면
    await page.getByTestId('mark-confused').click();
    await expect(page.getByTestId('finish')).toContainText('다음 복습');

    // ⑦ 서버에도 남았다 — 다른 기기에서 복습 큐가 따라온다
    await expect
      .poll(async () => {
        const res = await page.request.get('/api/csat/session/record');
        const json = (await res.json()) as { attempts?: { item_id: string; confused: boolean }[] };
        return (json.attempts ?? []).filter((a) => a.item_id === '2026#18' && a.confused).length;
      }, { timeout: 10_000 })
      .toBe(1);
    expect(errors, errors.join('\n')).toEqual([]);
  });
});
