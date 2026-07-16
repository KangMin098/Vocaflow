// apps/web/tests/e2e/08-text-extract-trust.spec.ts
// 추출 신뢰 계층 런타임 회귀 — /text/new AI 단어 추출의 2·4단계 기능을 실 로그인 E2E 로 단언.
//   2단계: "알아요/몰라요" 판정 → word_familiarity 영속화(service-role DB 단언) + known 페이드/선택해제
//   4단계: expand "왜 추천했어요?" 근거 카드 렌더
//   · 계정: runtime-test-0705@vocaflow.dev (진단 v11 · vocab 10)
//   · known 판정은 다음 추출을 영구 축소하므로 finally 에서 반드시 정리(원복).
import { test, expect, type Page } from '@playwright/test';

import {
  countWordFamiliaritySince,
  deleteWordFamiliaritySince,
  userIdByEmail,
} from './utils/db';

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
};

const STATE_PATH = 'test-results/.auth-runtime-user.json';

// 난이도 스펙트럼이 넓은 지문 — 'text'(P75) 전략이 상위 단어를 안정적으로 산출.
//   굴절형(challenged/assumptions/hypotheses/researchers/principles)이 섞여 L2 형태해소 근거도 유발.
const PASSAGE =
  'The scientists observed an extraordinary phenomenon that challenged their assumptions. ' +
  'Nevertheless, they persisted, gathering evidence and refining their hypotheses. ' +
  'Their groundbreaking discovery transformed the field, inspiring countless researchers ' +
  'to reconsider fundamental principles that had long been accepted without question. ' +
  // 어근 링크가 확실한 단어(word_root_links) — 🏛 어원 힌트 검증용.
  'The inspector predicted the transport, respecting the spectacular structure.';

async function loginRuntimeUser(page: Page) {
  for (let attempt = 1; attempt <= 2; attempt++) {
    await page.goto('/login', { waitUntil: 'networkidle' });
    await page.waitForTimeout(800);
    await page.fill('input[type="email"]', RUNTIME_USER.email);
    await page.fill('input[type="password"]', RUNTIME_USER.password);
    await page.click('button[type="submit"]');
    try {
      await page.waitForURL((u) => !u.pathname.startsWith('/login'), { timeout: 25_000 });
      return;
    } catch (e) {
      if (attempt === 2) throw e;
      await page.waitForTimeout(2_000);
    }
  }
}

function collectConsoleErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text().slice(0, 200));
  });
  page.on('pageerror', (e) => errors.push(`PAGEERROR: ${String(e).slice(0, 200)}`));
  page.on('response', (r) => {
    if (r.status() >= 400 && r.status() !== 404) errors.push(`HTTP ${r.status()} ${r.url().slice(0, 160)}`);
  });
  return errors;
}

function fatalErrors(errors: string[]): string[] {
  return errors.filter(
    (e) => !/favicon|404 \(Not Found\)|auth-js|auth\/v1\/token|Failed to fetch|ChunkLoadError/.test(e),
  );
}

test.describe('추출 신뢰 — /text/new 알아요·몰라요 + 근거 카드', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined });
    await loginRuntimeUser(page);
    await page.context().storageState({ path: STATE_PATH });
    await page.close();
  });
  test.use({ storageState: STATE_PATH });

  test('추출 → 근거 카드 + 알아요/몰라요 판정 영속화', async ({ page }) => {
    test.setTimeout(120_000);
    const errors = collectConsoleErrors(page);
    const userId = await userIdByEmail(RUNTIME_USER.email);
    // service-role 키 없으면 DB 단언만 건너뛰고 UI 는 검증. 정리 기준 시각(clock skew 대비 2분 back-buffer).
    const sinceIso = new Date(Date.now() - 120_000).toISOString();

    try {
      await page.goto('/text/new', { waitUntil: 'domcontentloaded', timeout: 30_000 });

      // 본문 입력 → ExtractionPanel 활성 (본문 ≥ 50자)
      await page.locator('textarea').first().fill(PASSAGE);

      // 'text'(글 P75) 전략 — 계정 V-Level 무관하게 상위 단어 산출 보장.
      //   hydration 지연 시 라디오 체크/버튼 클릭이 유실될 수 있어 결과가 뜰 때까지 toPass 재시도.
      const molayo = page.getByRole('button', { name: /몰라요/ });
      await expect(async () => {
        const textRadio = page.locator('input[name="strategy"][value="text"]');
        if (!(await textRadio.isChecked().catch(() => false))) {
          await textRadio.check({ timeout: 2_000 }).catch(() => {});
        }
        await page.getByRole('button', { name: /추출 분석/ }).click({ timeout: 2_000 }).catch(() => {});
        await expect(molayo.first()).toBeVisible({ timeout: 8_000 });
      }).toPass({ timeout: 60_000 });

      // 결과 행 = 알아요 버튼을 가진 listitem
      const rows = page.getByRole('listitem').filter({ has: page.getByRole('button', { name: /알아요/ }) });
      const rowCount = await rows.count();
      expect(rowCount, '추출 결과 행 수').toBeGreaterThanOrEqual(2);

      // ── 어원 이중배당: 어근 링크가 있는 단어에 🏛 어근 힌트 칩(best-effort, async) ──
      //   전체(100%) 표시로 전환해 어근 링크 단어가 확실히 렌더되게 한 뒤 단언.
      await page.getByRole('radio', { name: /전체/ }).click();
      await expect(page.locator('span[title^="어원:"]').first()).toBeVisible({ timeout: 10_000 });

      // ── 4단계: 첫 행 expand → "왜 추천했어요?" 근거 카드 + 기술 breakdown ──
      const firstRow = rows.first();
      await firstRow.getByRole('button', { name: '평가 상세' }).click();
      await expect(firstRow.getByText('왜 추천했어요?')).toBeVisible({ timeout: 5_000 });
      await expect(firstRow.getByText(/스코어 breakdown/)).toBeVisible();

      // ── 2단계(known): 첫 행 '알아요' → ✓ 상태 + 선택 해제 + DB 영속화 ──
      const firstKnow = firstRow.getByRole('button', { name: /알아요/ });
      await firstKnow.click();
      await expect(firstKnow).toHaveAttribute('aria-pressed', 'true');
      await expect(firstKnow).toContainText('✓');
      await expect(firstRow.getByRole('checkbox')).not.toBeChecked();

      // ── 2단계(unknown): 둘째 행 '몰라요' → pressed 상태 ──
      const secondRow = rows.nth(1);
      const secondUnknow = secondRow.getByRole('button', { name: /몰라요/ });
      await secondUnknow.click();
      await expect(secondUnknow).toHaveAttribute('aria-pressed', 'true');

      // ── DB 영속화 단언 (service-role) — fire-and-forget RPC 라 폴링 ──
      if (userId) {
        await expect
          .poll(() => countWordFamiliaritySince(userId, sinceIso, 'known'), {
            message: 'word_familiarity known 행 적재',
            timeout: 15_000,
          })
          .toBeGreaterThanOrEqual(1);
        await expect
          .poll(() => countWordFamiliaritySince(userId, sinceIso, 'unknown'), {
            message: 'word_familiarity unknown 행 적재',
            timeout: 15_000,
          })
          .toBeGreaterThanOrEqual(1);
        console.log('[extract-trust] word_familiarity known+unknown 영속화 확인');
      } else {
        console.log('[extract-trust] SERVICE_ROLE_KEY 없음 — DB 단언 건너뜀(UI 는 검증됨)');
      }

      const fatal = fatalErrors(errors);
      expect(fatal, `console errors: ${fatal.join(' | ')}`).toHaveLength(0);
    } finally {
      // known 판정이 다음 추출을 영구 제외하지 않도록 이 테스트가 만든 행 정리(원복).
      if (userId) {
        const removed = await deleteWordFamiliaritySince(userId, sinceIso);
        console.log(`[extract-trust] cleanup: word_familiarity ${removed}행 삭제`);
      }
    }
  });
});
