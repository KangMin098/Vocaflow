// apps/web/tests/e2e/09-text-extract-scale.spec.ts
//
// 장문 스크립트 런타임 측정 — /text/new 를 **실제 강연 분량**으로 돌린다.
//
// 왜 필요한가: v06.35 의 추출 개선(토크나이저 재작성 · 표제어 해석 의미보존 ·
// pending 오탐 제거)은 전부 정적 분석과 DB 질의로 검증됐다. 실제 브라우저에서
// 20,000자를 붙여넣고 저장까지 가는 경로는 한 번도 실행된 적이 없다.
//
// 이 스펙이 단언하는 것 (정적 분석으로는 닿지 않는 것들):
//   ① 장문 입력 → 토큰화 요약 렌더 · **상한 절단 경고 없음**
//   ② 추출 왕복이 장문에서도 완주
//   ③ pending_words 가 **사전 갭만** 받는다 (v06.35 계약 — 실제 경로 최초 실행)
//   ④ 저장 왕복 — 선택 단어가 vocabularies 에 실제로 적재
//
// · 계정: runtime-test-0705@vocaflow.dev
// · vocabularies / pending_words 는 finally 에서 반드시 원복 —
//   남기면 다음 실행의 추출 후보가 영구 축소되어 테스트가 스스로를 무력화한다.

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { test, expect, type Page } from '@playwright/test';

import {
  countVocabulariesSince,
  deletePendingWordsSince,
  deleteVocabulariesSince,
  fetchPendingWordsSince,
  unresolvedDictWords,
  userIdByEmail,
} from './utils/db';

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
};

const STATE_PATH = 'test-results/.auth-runtime-scale.json';

/** 커버리지 하네스와 **같은 샘플**을 읽는다 — 측정 기준을 단일 출처로 유지. */
const SAMPLE = readFileSync(
  resolve(__dirname, '../../../../scripts/extract-coverage/sample-talk.txt'),
  'utf8',
);

/**
 * 골든셋 L5(≈22분 강연 ≈20,000자) 규모 재현.
 *
 * ⚠️ 이것은 **입력 크기·지연·저장 왕복** 테스트다. 반복이므로 unique 단어 수는
 * 원본과 같다(≈242). 어휘 다양성 자체를 늘리는 테스트가 아님을 명시해 둔다 —
 * 그 축은 커버리지 하네스(scripts/extract-coverage)가 담당한다.
 */
const LONG_TEXT = Array.from({ length: 6 }, () => SAMPLE).join('\n\n');

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
    if (r.status() >= 400 && r.status() !== 404) {
      errors.push(`HTTP ${r.status()} ${r.url().slice(0, 160)}`);
    }
  });
  return errors;
}

function fatalErrors(errors: string[]): string[] {
  return errors.filter(
    (e) => !/favicon|404 \(Not Found\)|auth-js|auth\/v1\/token|Failed to fetch|ChunkLoadError/.test(e),
  );
}

test.describe('추출 스케일 — 강연 분량 스크립트 런타임', () => {
  test.beforeAll(async ({ browser }) => {
    const page = await browser.newPage({ storageState: undefined });
    await loginRuntimeUser(page);
    await page.context().storageState({ path: STATE_PATH });
    await page.close();
  });
  test.use({ storageState: STATE_PATH });

  test('20,000자 입력 → 추출 → 저장 · pending 은 사전 갭만', async ({ page }) => {
    test.setTimeout(240_000);
    const errors = collectConsoleErrors(page);
    const userId = await userIdByEmail(RUNTIME_USER.email);
    const sinceIso = new Date(Date.now() - 120_000).toISOString();

    console.log(`[scale] 입력 크기 ${LONG_TEXT.length.toLocaleString()}자`);

    try {
      await page.goto('/text/new', { waitUntil: 'domcontentloaded', timeout: 30_000 });

      // ── ① 장문 입력 → 토큰화 요약 ──
      const tFill = Date.now();
      await page.locator('textarea').first().fill(LONG_TEXT);
      console.log(`[scale] textarea fill ${Date.now() - tFill}ms`);

      // TokenizationSummary — "본문 N어 · 서로 다른 단어 M개 · 분석 후보 K개"
      const summary = page.getByText(/본문\s+[\d,]+어/);
      await expect(summary).toBeVisible({ timeout: 20_000 });
      const summaryText = (await summary.textContent()) ?? '';
      console.log(`[scale] 토큰화 요약: ${summaryText.replace(/\s+/g, ' ').trim()}`);

      // ── 입력 무단 절단 회귀 락 (v06.35) ──
      //   TextInput 에 maxLength={5100} 하드 속성이 있어 20,818자 입력이 5,100자로
      //   **조용히 잘려** 본문 783어만 인식됐다(경고 없음 · 저장은 성공).
      //   본문 단어 수가 입력 규모에 비례하는지 직접 단언한다 — 요약 숫자는 절단을 숨기지 못한다.
      const reportedWords = Number((summaryText.match(/본문\s+([\d,]+)어/)?.[1] ?? '0').replace(/,/g, ''));
      console.log(`[scale] 인식된 본문 ${reportedWords.toLocaleString()}어`);
      expect(
        reportedWords,
        `본문이 잘렸다 — 입력 ${LONG_TEXT.length}자에 비해 인식 단어가 너무 적다`,
      ).toBeGreaterThan(3_000);

      // 상한(5,000) 절단 경고가 뜨면 안 된다 — 강연 분량은 여유로 수용해야 한다.
      await expect(page.getByText(/후보에서 덜어냈어요/)).toHaveCount(0);

      // 전처리 내역 펼침 (Progressive Disclosure) — 축약형·화자 라벨 처리가 보여야 한다
      await page.getByRole('button', { name: /본문을 어떻게 읽었는지 보기/ }).click();
      await expect(page.getByText('축약형 복원')).toBeVisible({ timeout: 5_000 });
      await expect(page.getByText('화자 라벨 제거')).toBeVisible();

      // ── ② 추출 왕복 ──
      const molayo = page.getByRole('button', { name: /몰라요/ });
      const tExtract = Date.now();
      await expect(async () => {
        const textRadio = page.locator('input[name="strategy"][value="text"]');
        if (!(await textRadio.isChecked().catch(() => false))) {
          await textRadio.check({ timeout: 2_000 }).catch(() => {});
        }
        await page.getByRole('button', { name: /추출 분석/ }).click({ timeout: 2_000 }).catch(() => {});
        await expect(molayo.first()).toBeVisible({ timeout: 15_000 });
      }).toPass({ timeout: 120_000 });
      console.log(`[scale] 추출 왕복 ${Date.now() - tExtract}ms`);

      const rows = page
        .getByRole('listitem')
        .filter({ has: page.getByRole('button', { name: /알아요/ }) });
      const rowCount = await rows.count();
      console.log(`[scale] 표시 행 ${rowCount}`);
      expect(rowCount, '추출 결과 행 수').toBeGreaterThanOrEqual(2);

      // ── ③ pending_words 계약 — 사전 갭만 받는다 (v06.35) ──
      //    fire-and-forget 이라 폴링. service-role 없으면 건너뜀.
      const pending = await (async () => {
        for (let i = 0; i < 10; i++) {
          const got = await fetchPendingWordsSince(sinceIso);
          if (got.length > 0) return got;
          await page.waitForTimeout(1_500);
        }
        return [];
      })();

      if (pending.length > 0) {
        console.log(`[scale] pending_words 적재 ${pending.length}개: ${pending.slice(0, 15).join(', ')}`);
        // 적재된 lemma 를 사전에 되물어, 전부 실제로 해석 실패인지 교차 검증.
        const stillUnresolved = new Set(await unresolvedDictWords(pending));
        const falsePositives = pending.filter((w) => !stillUnresolved.has(w));
        expect(
          falsePositives,
          `pending_words 오탐(사전에 있는데 갭으로 기록됨): ${falsePositives.join(', ')}`,
        ).toHaveLength(0);
        console.log('[scale] pending_words 오탐 0 — 사전 갭만 적재 확인');
      } else {
        console.log('[scale] pending_words 적재 없음 — 이 본문에 사전 갭이 없거나 service-role 미설정');
      }

      // ── ④ 저장 왕복 ──
      await page.getByRole('radio', { name: /상위 10%/ }).click();
      const before = userId ? await countVocabulariesSince(userId, sinceIso) : -1;
      const tSave = Date.now();
      await page.getByRole('button', { name: /내 단어장에 추가/ }).click();
      await expect(page.getByText(/개 단어를 내 단어장에 추가했어요/).first()).toBeVisible({
        timeout: 30_000,
      });
      console.log(`[scale] 저장 왕복 ${Date.now() - tSave}ms`);

      if (userId && before >= 0) {
        await expect
          .poll(() => countVocabulariesSince(userId, sinceIso), {
            message: 'vocabularies 적재',
            timeout: 20_000,
          })
          .toBeGreaterThan(before);
        console.log('[scale] vocabularies 적재 확인');
      }

      const fatal = fatalErrors(errors);
      expect(fatal, `console errors: ${fatal.join(' | ')}`).toHaveLength(0);
    } finally {
      if (userId) {
        const v = await deleteVocabulariesSince(userId, sinceIso);
        console.log(`[scale] cleanup: vocabularies ${v}행 삭제`);
      }
      const p = await deletePendingWordsSince(sinceIso);
      console.log(`[scale] cleanup: pending_words ${p}행 삭제`);
    }
  });
});
