// apps/web/tests/e2e/20-auth-flows.spec.ts
//
// 인증 전 경로 회귀 — 로그인 / 로그아웃 / 비밀번호 찾기 / 이메일 인증 / 콜백 / 라우트 가드.
//
// 배경 (v06.140 실측 결함 — 이 spec 이 전부의 회귀 락이다):
//   A. 복귀 파라미터 이름이 4종으로 갈라져 **모든 딥링크 복귀가 /hub 로 떨어졌다**
//      (미들웨어·페이지는 ?next=, requireAdmin 은 ?redirect=, 로그인 화면은 ?returnTo= 를 읽음)
//   B. 설정 화면 "로그아웃" 버튼에 onClick 이 없어 **앱에 로그아웃 수단이 아예 없었다**
//   C. 미들웨어만 role==='admin' 을 요구해 **curator 는 admin 화면에 못 들어갔다**
//   D. user_profiles.status 를 아무도 안 봐서 **정지 계정이 그대로 다 썼다**
//   E. 만료된 인증 링크가 "잘못된 접근입니다" 로 오안내됐다
//   F. 재설정/재발송 화면이 예외를 삼켜 실패가 조용히 사라졌다
//
// ⚠️ role·status 를 바꾸는 테스트는 finally 에서 반드시 원복한다 — 남기면 계정이 잠긴다.

import { test, expect, type Page } from '@playwright/test';

import {
  devAdminBypassActive,
  getUserRole,
  getUserStatus,
  setUserRole,
  setUserStatus,
  userIdByEmail,
} from './utils/db';

const RUNTIME_USER = {
  email: process.env.PLAYWRIGHT_RUNTIME_EMAIL || 'runtime-test-0705@vocaflow.dev',
  password: process.env.PLAYWRIGHT_RUNTIME_PASSWORD || 'RuntimeTest1!',
};

/**
 * 하이드레이션이 끝날 때까지 기다린다.
 *
 * 왜 필요한가: SSR 직후·하이드레이션 전에 submit 을 누르면 React onSubmit 이 아직 안 붙어
 * **브라우저 기본 폼 전송(GET)** 이 일어난다. 그러면 화면이 그냥 새로고침되고 검증 문구가
 * 안 뜬다 — 실제 결함이 아닌데 테스트만 빨갛게 되는 대표적 원인이다.
 *
 * `#__next-route-announcer__` 는 App Router 클라이언트가 하이드레이션 이후에 주입하므로
 * 정확한 신호가 된다. (data-theme 은 layout 의 선행 스크립트가 미리 넣으므로 신호가 못 된다.)
 */
async function waitForHydration(page: Page) {
  await page.waitForSelector('#__next-route-announcer__', { state: 'attached', timeout: 30_000 });
}

/** dev 서버 첫 컴파일이 느려 로그인 폼이 늦게 뜨는 경우가 있어 재시도한다. */
async function gotoLogin(page: Page, url = '/login') {
  for (let attempt = 0; attempt < 4; attempt++) {
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    try {
      await page.locator('input[type="email"]').waitFor({ state: 'visible', timeout: 15_000 });
      await waitForHydration(page);
      return;
    } catch {
      // 다음 시도
    }
  }
  throw new Error(`로그인 폼이 뜨지 않았다: ${url}`);
}

/** 폼이 있는 화면으로 이동 + 하이드레이션 대기 (로그인 외 인증 화면용). */
async function gotoHydrated(page: Page, url: string) {
  await page.goto(url, { waitUntil: 'domcontentloaded' });
  await waitForHydration(page);
}

async function submitLogin(page: Page, email: string, password: string) {
  await page.fill('input[type="email"]', email);
  await page.fill('input[type="password"]', password);
  await page.click('button[type="submit"]');
}

async function login(page: Page, url = '/login') {
  await gotoLogin(page, url);
  await submitLogin(page, RUNTIME_USER.email, RUNTIME_USER.password);
}

// ══════════════════════════════════════════════════════════════
// A. 로그인 폼 검증 — 잘못된 입력이 조용히 통과하지 않는다
// ══════════════════════════════════════════════════════════════
test.describe('A. 로그인 폼 검증', () => {
  test('빈 폼 제출 시 두 필드 모두 사유를 보여주고 이동하지 않는다', async ({ page }) => {
    await gotoLogin(page);
    await page.click('button[type="submit"]');

    await expect(page.getByText('이메일을 입력해주세요')).toBeVisible();
    await expect(page.getByText('비밀번호를 입력해주세요')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('이메일 형식이 깨지면 서버 호출 없이 막는다', async ({ page }) => {
    await gotoLogin(page);
    await page.fill('input[type="email"]', 'user@localhost');
    await page.fill('input[type="password"]', 'whatever123');
    await page.click('button[type="submit"]');

    await expect(page.getByText('올바른 이메일 형식이 아닙니다')).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
  });

  test('틀린 비밀번호는 한국어 배너로 알리고, 계정 존재 여부는 흘리지 않는다', async ({ page }) => {
    await gotoLogin(page);
    await submitLogin(page, RUNTIME_USER.email, 'DefinitelyWrong999!');

    const banner = page.getByTestId('auth-error');
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toContainText('이메일 또는 비밀번호가 일치하지 않습니다');
    await expect(page).toHaveURL(/\/login/);
  });

  test('없는 계정도 틀린 비밀번호와 똑같은 문구다 (계정 열거 방지)', async ({ page }) => {
    await gotoLogin(page);
    await submitLogin(page, `no-such-user-${Date.now()}@vocaflow.invalid`, 'Whatever123!');

    const banner = page.getByTestId('auth-error');
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toContainText('이메일 또는 비밀번호가 일치하지 않습니다');
  });

  test('에러 배너가 스크린리더에 즉시 읽힌다 (role=alert + aria-live)', async ({ page }) => {
    await gotoLogin(page);
    await submitLogin(page, RUNTIME_USER.email, 'DefinitelyWrong999!');

    const banner = page.getByTestId('auth-error');
    await expect(banner).toBeVisible({ timeout: 15_000 });
    await expect(banner).toHaveAttribute('aria-live', 'assertive');
  });
});

// ══════════════════════════════════════════════════════════════
// B. 복귀 경로 (v06.140 핵심 결함)
// ══════════════════════════════════════════════════════════════
test.describe('B. 로그인 후 복귀 경로', () => {
  // 학습자 보호 라우트(RSC redirect) — DEV_ADMIN_BYPASS 영향을 받지 않는다
  test('보호 라우트로 직접 가면 ?next= 를 달고 로그인으로 보낸다', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/wordvault/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/login/, { timeout: 30_000 });
    expect(new URL(page.url()).searchParams.get('next')).toBe('/wordvault/browse');
  });

  test('미들웨어가 막는 /admin 도 ?next= 를 싣는다', async ({ page, context }) => {
    test.skip(devAdminBypassActive(), 'DEV_ADMIN_BYPASS=1 — 미들웨어가 인증을 보지 않는다');
    await context.clearCookies();
    await page.goto('/admin/curation', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/login/, { timeout: 30_000 });
    expect(new URL(page.url()).searchParams.get('next')).toBe('/admin/curation');
  });

  test.describe.serial('별칭 3종 모두 복귀에 성공한다', () => {
    for (const param of ['next', 'returnTo', 'redirect']) {
      test(`?${param}=/wordvault/browse 로 들어오면 로그인 후 거기로 간다`, async ({ page }) => {
        await login(page, `/login?${param}=${encodeURIComponent('/wordvault/browse')}`);
        await page.waitForURL(/\/wordvault\/browse/, { timeout: 30_000 });
        expect(new URL(page.url()).pathname).toBe('/wordvault/browse');
      });
    }
  });

  test('복귀 경로가 없으면 기본 랜딩(/hub)', async ({ page }) => {
    await login(page);
    await page.waitForURL(/\/hub/, { timeout: 30_000 });
  });

  test('외부 URL 로는 절대 내보내지 않는다 (open redirect)', async ({ page }) => {
    await login(page, `/login?next=${encodeURIComponent('https://example.com/steal')}`);
    await page.waitForURL(/\/hub/, { timeout: 30_000 });
    expect(page.url()).toContain('localhost');
  });

  test('protocol-relative(//evil) 도 차단한다', async ({ page }) => {
    await login(page, `/login?next=${encodeURIComponent('//example.com')}`);
    await page.waitForURL(/\/hub/, { timeout: 30_000 });
    expect(page.url()).toContain('localhost');
  });

  test('?next=/login 자기참조는 무한 왕복 대신 /hub 로 흡수한다', async ({ page }) => {
    await login(page, `/login?next=${encodeURIComponent('/login')}`);
    await page.waitForURL(/\/hub/, { timeout: 30_000 });
  });
});

// ══════════════════════════════════════════════════════════════
// C. 세션 · 로그아웃
// ══════════════════════════════════════════════════════════════
test.describe('C. 세션과 로그아웃', () => {
  test('로그아웃 버튼이 실제로 세션을 끊는다 (예전엔 onClick 자체가 없었다)', async ({ page }) => {
    await login(page);
    await page.waitForURL(/\/hub/, { timeout: 30_000 });

    await gotoHydrated(page, '/settings');
    const logout = page.getByRole('button', { name: /로그아웃/ });
    await expect(logout).toBeVisible({ timeout: 20_000 });
    await logout.click();

    // 로그인 화면으로 이동
    await page.waitForURL(/\/login/, { timeout: 30_000 });

    // 그리고 세션이 실제로 끊겼는지 — 보호 라우트가 다시 막아야 한다
    // (/admin 이 아니라 학습자 라우트로 확인한다 — DEV_ADMIN_BYPASS 와 무관하게 유효)
    await page.goto('/wordvault/browse', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/login/, { timeout: 30_000 });
  });

  test('로그인 세션이 새로고침 후에도 유지된다', async ({ page }) => {
    await login(page);
    await page.waitForURL(/\/hub/, { timeout: 30_000 });

    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page).toHaveURL(/\/hub/);
  });
});

// ══════════════════════════════════════════════════════════════
// D. 라우트 가드 — 역할별
// ══════════════════════════════════════════════════════════════
test.describe('D. /admin 라우트 가드', () => {
  // DEV_ADMIN_BYPASS=1 이면 미들웨어·requireAdmin 이 인증을 아예 보지 않고 통과시킨다
  // (프로덕션에선 하드 게이트로 무효). 이 블록은 그때 검증 의미가 없으므로 건너뛴다.
  test.skip(
    () => devAdminBypassActive(),
    'DEV_ADMIN_BYPASS=1 — 끄고 재실행해야 admin 가드가 검증된다',
  );

  test('미인증은 /admin 에서 로그인으로 튕긴다', async ({ page, context }) => {
    await context.clearCookies();
    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/login/, { timeout: 30_000 });
  });

  test('일반 사용자(user)는 /admin 에서 /hub 로 돌려보낸다', async ({ page }) => {
    await login(page);
    await page.waitForURL(/\/hub/, { timeout: 30_000 });

    await page.goto('/admin', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/hub/, { timeout: 30_000 });
    expect(new URL(page.url()).pathname).not.toContain('/admin');
  });

  test('curator 는 /admin 에 들어갈 수 있다 (예전엔 미들웨어가 admin 만 허용해 막혔다)', async ({
    page,
  }) => {
    const uid = await userIdByEmail(RUNTIME_USER.email);
    test.skip(!uid, 'SERVICE_ROLE_KEY 없음 — 역할 조작 불가');

    const before = (await getUserRole(uid!)) ?? 'user';
    try {
      expect(await setUserRole(uid!, 'curator')).toBe(true);

      await login(page);
      // ⚠️ 로그인 완료를 기다리지 않고 곧장 이동하면 세션이 아직 없어 /login 으로 튕긴다
      await page.waitForURL(/\/hub/, { timeout: 30_000 });

      await page.goto('/admin', { waitUntil: 'domcontentloaded' });

      // /hub 로도 /login 으로도 튕기지 않아야 한다
      expect(new URL(page.url()).pathname).toContain('/admin');
    } finally {
      await setUserRole(uid!, before);
    }
  });
});

// ══════════════════════════════════════════════════════════════
// D2. 개인 화면 가드 — 로그아웃 상태에서 열려 있던 32 라우트
// ══════════════════════════════════════════════════════════════
test.describe('D2. 개인 화면은 로그아웃 상태로 열리지 않는다', () => {
  for (const path of ['/hub', '/settings', '/dashboard', '/reports', '/my/words', '/plan']) {
    test(`${path} → 로그인으로 보내고 복귀 경로를 싣는다`, async ({ page, context }) => {
      await context.clearCookies();
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await page.waitForURL(/\/login/, { timeout: 30_000 });
      expect(new URL(page.url()).searchParams.get('next')).toBe(path);
    });
  }

  // 과잉 차단 방지 — 카탈로그는 비회원에게도 열려 있어야 한다 (발견·SEO)
  for (const path of ['/library', '/comics', '/pricing', '/about']) {
    test(`${path} 는 비회원에게도 열려 있다`, async ({ page, context }) => {
      await context.clearCookies();
      await page.goto(path, { waitUntil: 'domcontentloaded' });
      await expect(page).not.toHaveURL(/\/login/, { timeout: 15_000 });
      expect(new URL(page.url()).pathname).toBe(path);
    });
  }
});

// ══════════════════════════════════════════════════════════════
// E. 계정 상태 게이트 (정지 계정)
// ══════════════════════════════════════════════════════════════
test.describe('E. 정지 계정', () => {
  test('정지된 계정은 로그인해도 들어오지 못하고 사유를 본다', async ({ page }) => {
    const uid = await userIdByEmail(RUNTIME_USER.email);
    test.skip(!uid, 'SERVICE_ROLE_KEY 없음 — 상태 조작 불가');

    const before = (await getUserStatus(uid!)) ?? 'active';
    try {
      expect(await setUserStatus(uid!, 'suspended')).toBe(true);

      await gotoLogin(page);
      await submitLogin(page, RUNTIME_USER.email, RUNTIME_USER.password);

      const banner = page.getByTestId('auth-error');
      await expect(banner).toBeVisible({ timeout: 20_000 });
      await expect(banner).toContainText('정지');
      await expect(page).toHaveURL(/\/login/);
    } finally {
      await setUserStatus(uid!, before);
    }
  });

  test('정지가 풀리면 다시 로그인된다 (게이트가 영구 잠금이 아니다)', async ({ page }) => {
    const uid = await userIdByEmail(RUNTIME_USER.email);
    test.skip(!uid, 'SERVICE_ROLE_KEY 없음');

    expect(await getUserStatus(uid!)).toBe('active');
    await login(page);
    await page.waitForURL(/\/hub/, { timeout: 30_000 });
  });
});

// ══════════════════════════════════════════════════════════════
// F. 비밀번호 재설정
// ══════════════════════════════════════════════════════════════
test.describe('F. 비밀번호 재설정', () => {
  test('로그인 화면의 "비밀번호 찾기" 가 재설정 화면으로 연결된다', async ({ page }) => {
    await gotoLogin(page);
    await page.getByRole('link', { name: /비밀번호 찾기/ }).click();
    await page.waitForURL(/\/reset-password/, { timeout: 20_000 });
    await expect(page.getByRole('heading', { name: /비밀번호를/ })).toBeVisible();
  });

  test('빈/잘못된 이메일은 발송하지 않고 사유를 보여준다', async ({ page }) => {
    await gotoHydrated(page, '/reset-password');
    const submit = page.getByRole('button', { name: /재설정 링크 받기/ });
    await expect(submit).toBeVisible({ timeout: 20_000 });

    await submit.click();
    await expect(page.getByText('이메일을 입력해주세요')).toBeVisible();

    await page.fill('input[type="email"]', 'user@localhost');
    await submit.click();
    await expect(page.getByText('올바른 이메일 형식이 아닙니다')).toBeVisible();
  });

  test('?mode=update 로 들어오면 새 비밀번호 폼이 뜬다 (recovery 콜백 목적지)', async ({ page }) => {
    await gotoHydrated(page, '/reset-password?mode=update');
    await expect(page.getByRole('heading', { name: /새 비밀번호 설정/ })).toBeVisible({
      timeout: 20_000,
    });
  });

  test('update 모드에서 규칙 위반과 불일치를 각각 잡는다', async ({ page }) => {
    await gotoHydrated(page, '/reset-password?mode=update');
    const submit = page.getByRole('button', { name: /비밀번호 변경/ });
    await expect(submit).toBeVisible({ timeout: 20_000 });

    const fields = page.locator('input[type="password"]');

    // 너무 짧음
    await fields.nth(0).fill('ab1');
    await fields.nth(1).fill('ab1');
    await submit.click();
    await expect(page.getByText('8자 이상 입력해주세요')).toBeVisible();

    // 길이는 되지만 숫자 없음 (signup 과 같은 규칙인지 확인)
    await fields.nth(0).fill('abcdefgh');
    await fields.nth(1).fill('abcdefgh');
    await submit.click();
    await expect(page.getByText('영문과 숫자를 모두 포함해주세요')).toBeVisible();

    // 확인 불일치
    await fields.nth(0).fill('abcdefg1');
    await fields.nth(1).fill('abcdefg2');
    await submit.click();
    await expect(page.getByText('비밀번호가 일치하지 않습니다')).toBeVisible();
  });

  test('update 모드에서도 발송 폼으로 빠져나갈 수 있다 (예전엔 갇혔다)', async ({ page }) => {
    await gotoHydrated(page, '/reset-password?mode=update');
    const escape = page.getByRole('button', { name: /대신 재설정 메일 받기/ });
    await expect(escape).toBeVisible({ timeout: 20_000 });
    await escape.click();
    await expect(page.getByRole('button', { name: /재설정 링크 받기/ })).toBeVisible();
  });
});

// ══════════════════════════════════════════════════════════════
// G. 이메일 인증 대기 화면
// ══════════════════════════════════════════════════════════════
test.describe('G. 이메일 인증 대기', () => {
  test('?email 이 있으면 주소를 보여주고 재발송 버튼이 살아 있다', async ({ page }) => {
    await gotoHydrated(page, `/verify-email?email=${encodeURIComponent('probe@vocaflow.dev')}`);
    await expect(page.getByText('probe@vocaflow.dev')).toBeVisible({ timeout: 20_000 });
    await expect(page.getByRole('button', { name: /인증 메일 다시 보내기/ })).toBeEnabled();
  });

  test('?email 이 없으면 재발송 버튼을 잠그고 이유를 말한다 (예전엔 눌러도 무반응)', async ({
    page,
  }) => {
    await gotoHydrated(page, '/verify-email');
    const resend = page.getByRole('button', { name: /인증 메일 다시 보내기/ });
    await expect(resend).toBeVisible({ timeout: 20_000 });
    await expect(resend).toBeDisabled();
    await expect(page.getByText(/재발송할 수 없어요/)).toBeVisible();
  });
});

// ══════════════════════════════════════════════════════════════
// H. 인증 콜백 — 사용자에게 정확한 사유를 준다
// ══════════════════════════════════════════════════════════════
test.describe('H. /api/auth/callback', () => {
  test('파라미터 없는 진입은 "잘못된 접근" 으로', async ({ page }) => {
    await page.goto('/api/auth/callback', { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/login\?error=invalid_callback/, { timeout: 20_000 });
    await expect(page.getByTestId('auth-error')).toContainText('잘못된 접근입니다');
  });

  test('만료 링크는 "만료" 로 안내한다 (예전엔 "잘못된 접근" 으로 오안내)', async ({ page }) => {
    const url =
      '/api/auth/callback?error=access_denied&error_code=otp_expired' +
      '&error_description=Email+link+is+invalid+or+has+expired';
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForURL(/\/login\?error=link_expired/, { timeout: 20_000 });
    await expect(page.getByTestId('auth-error')).toContainText('만료');
  });

  test('취소/거부는 별도 문구로 안내한다', async ({ page }) => {
    await page.goto('/api/auth/callback?error=access_denied&error_code=user_cancelled', {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForURL(/\/login\?error=access_denied/, { timeout: 20_000 });
    await expect(page.getByTestId('auth-error')).toBeVisible();
  });

  test('잘못된 token_hash 는 인증 실패로 분류된다', async ({ page }) => {
    await page.goto('/api/auth/callback?token_hash=deadbeef-not-a-real-token&type=signup', {
      waitUntil: 'domcontentloaded',
    });
    await page.waitForURL(/\/login\?error=/, { timeout: 25_000 });
    const code = new URL(page.url()).searchParams.get('error');
    expect(['email_verification_failed', 'link_expired', 'already_verified']).toContain(code);
    await expect(page.getByTestId('auth-error')).toBeVisible();
  });

  test('모든 에러 코드가 한국어 배너로 렌더된다 (매핑 누락 = 빈 화면)', async ({ page }) => {
    for (const code of [
      'oauth_failed',
      'email_verification_failed',
      'link_expired',
      'invalid_callback',
      'already_verified',
      'access_denied',
    ]) {
      await page.goto(`/login?error=${code}`, { waitUntil: 'domcontentloaded' });
      const banner = page.getByTestId('auth-error');
      await expect(banner, `코드 ${code} 에 배너가 없다`).toBeVisible({ timeout: 20_000 });
      await expect(banner).toContainText(/[가-힣]/);
    }
  });
});

// ══════════════════════════════════════════════════════════════
// I. 회원가입 폼 검증
// ══════════════════════════════════════════════════════════════
test.describe('I. 회원가입 폼 검증', () => {
  test('빈 폼은 네 가지 사유를 모두 보여준다', async ({ page }) => {
    await gotoHydrated(page, '/signup');
    const submit = page.getByRole('button', { name: /가입하고 학습 시작하기/ });
    await expect(submit).toBeVisible({ timeout: 20_000 });
    await submit.click();

    await expect(page.getByText('이름은 2자 이상이어야 해요')).toBeVisible();
    await expect(page.getByText('이메일을 입력해주세요')).toBeVisible();
    await expect(page.getByText('비밀번호를 입력해주세요')).toBeVisible();
    await expect(page.getByText('필수 약관에 동의해주세요')).toBeVisible();
  });

  test('비밀번호 규칙이 로그인·재설정과 같은 문구를 쓴다', async ({ page }) => {
    await gotoHydrated(page, '/signup');
    const submit = page.getByRole('button', { name: /가입하고 학습 시작하기/ });
    await expect(submit).toBeVisible({ timeout: 20_000 });

    await page.fill('input[type="text"]', '홍길동');
    await page.fill('input[type="email"]', `probe-${Date.now()}@vocaflow.dev`);
    await page.fill('input[type="password"]', 'abcdefgh'); // 숫자 없음
    await submit.click();
    await expect(page.getByText('영문과 숫자를 모두 포함해주세요')).toBeVisible();
  });

  test('이미 가입된 이메일은 명확히 알린다 (대기 화면으로 보내지 않는다)', async ({ page }) => {
    await gotoHydrated(page, '/signup');
    const submit = page.getByRole('button', { name: /가입하고 학습 시작하기/ });
    await expect(submit).toBeVisible({ timeout: 20_000 });

    await page.fill('input[type="text"]', '홍길동');
    await page.fill('input[type="email"]', RUNTIME_USER.email);
    await page.fill('input[type="password"]', 'SomeOtherPass123');
    // 필수 약관 2개
    const boxes = page.locator('input[type="checkbox"]');
    await boxes.nth(0).check({ force: true });
    await boxes.nth(1).check({ force: true });
    await submit.click();

    const banner = page.getByTestId('auth-error');
    await expect(banner).toBeVisible({ timeout: 20_000 });
    await expect(banner).toContainText('이미 가입된 이메일입니다');
    await expect(page).toHaveURL(/\/signup/);
  });
});
