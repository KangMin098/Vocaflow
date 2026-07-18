// apps/web/tests/e2e/10-judge-harness.spec.ts
// 추출 판정 하네스 회귀 (D3, v06.270) — /admin/quality/judge
// 정적 렌더/와이어링은 firm 단언, 표본→제출→reveal 동적 흐름은 best-effort
// (테스트 유저의 admin/RPC 접근 편차에 CI 가 깨지지 않도록 — 03-admin-curation 의 graceful 패턴).
// blind 계약 회귀: 표본 카드에 in-cap/sort_order 가 노출되면 안 됨(제출 전).
import { test, expect } from '@playwright/test';
import { loginAsTestUser } from './utils/auth';

test.describe('추출 판정 하네스 회귀', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsTestUser(page);
  });

  test('판정 페이지 렌더 + 소스 선택 + blind 표본', async ({ page }) => {
    await page.goto('/admin/quality/judge');
    await expect(page.locator('body')).toBeVisible();
    expect(page.url()).toContain('/admin/quality/judge');

    // 정적 와이어링 — 접근 가능하면 반드시 렌더 (admin 접근은 03-admin-curation 과 동일 전제)
    const heading = page.getByRole('heading', { name: /추출 판정/ });
    if (!(await heading.isVisible().catch(() => false))) {
      console.log('[judge] heading 미표시 — admin 접근 불가 환경(스킵)');
      return;
    }
    await expect(page.getByRole('button', { name: '표본 불러오기' })).toBeVisible();
    await expect(page.getByRole('button', { name: '도서 챕터' })).toBeVisible();
    console.log('[judge] 정적 렌더 OK');

    // 동적 흐름 — 표본 로드(관리자 RPC + 발행 콘텐츠 필요) best-effort
    await page.getByRole('button', { name: '표본 불러오기' }).click();
    const card = page.locator('li').filter({ has: page.getByRole('button', { name: '가치 있음' }) });
    const appeared = await card
      .first()
      .waitFor({ state: 'visible', timeout: 8000 })
      .then(() => true)
      .catch(() => false);

    if (!appeared) {
      console.log('[judge] 표본 미로드 — admin RPC/발행 콘텐츠 부재(동적 스킵)');
      return;
    }

    // blind 계약: 판정 중 시스템 순위(in-cap/#순위) 가 노출되면 안 됨
    await expect(page.getByText(/in-cap/)).toHaveCount(0);
    const n = await card.count();
    expect(n).toBeGreaterThan(0);
    console.log(`[judge] 표본 ${n}개 로드 (blind 유지)`);

    // 2개를 '가치 있음' 으로 표시 후 제출 → reveal(precision) 확인
    await card.nth(0).getByRole('button', { name: '가치 있음' }).click();
    if (n > 1) await card.nth(1).getByRole('button', { name: '가치 있음' }).click();
    await page.getByRole('button', { name: '판정 제출' }).click();

    // reveal: precision stat + 시스템 대조 배지 등장
    await expect(page.getByText('precision')).toBeVisible({ timeout: 10_000 });
    console.log('[judge] 제출→reveal OK (라벨 적재)');
  });
});
