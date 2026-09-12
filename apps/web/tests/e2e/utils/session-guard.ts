// apps/web/tests/e2e/utils/session-guard.ts
//
// **실행 도중 세션이 죽는 것을 견딘다.**
//
// 왜 필요한가 (실측 2026-09-06):
// 이 워크스페이스는 여러 세션이 **검증 계정 하나를 공유**한다. Supabase 는 리프레시 토큰을
// 회전시키므로, 다른 세션이 같은 계정으로 로그인하면 이쪽의 토큰이 조용히 무효가 된다.
// 그러면 훑기 도중부터 모든 라우트가 `/login` 으로 튕기고, 스펙은 (옳게) 그것을 실패로 적는다.
//
//   같은 코드·같은 빌드로 세 번 돌린 결과: **100% → 86.1% → 50.9%**
//   키보드 훑기에서는 60개 중 **51개**가 "로그인으로 튕겼다 — 재지 않음" 으로 찍혔다.
//
// ⚠️ 이건 앱 결함이 아니라 **환경**이다. 그런데 성적표에는 앱 결함과 똑같이 보인다 —
//    그래서 진짜 결함이 그 잡음에 묻힌다. 재는 쪽이 견뎌야 한다.
//
// ⚠️ **감추지는 않는다.** 다시 로그인한 횟수를 세고, 예산을 넘기면 그대로 실패시킨다.
//    조용히 무한 재로그인하면 "인증이 깨져도 초록" 이 되어 더 나쁘다.

import type { BrowserContext, Page } from '@playwright/test'

/** 이 주소가 로그인으로 튕긴 것인가. */
export function bouncedToLogin(url: string): boolean {
  try {
    return new URL(url).pathname.startsWith('/login')
  } catch {
    return url.startsWith('/login')
  }
}

/**
 * 한 실행에서 다시 로그인할 수 있는 횟수를 쥐고 있는 문지기.
 *
 * 예산을 다 쓰면 더 시도하지 않는다 — 계정이 계속 회전당하는 중이라면 재로그인을 반복해도
 * 같은 일이 반복될 뿐이고, 그때는 **측정을 포기했다고 말하는 것**이 맞다.
 */
export class SessionGuard {
  private used = 0

  constructor(
    private readonly context: BrowserContext,
    private readonly login: (page: Page) => Promise<void>,
    private readonly budget = 3,
  ) {}

  /** 지금까지 다시 로그인한 횟수. */
  get reauths(): number {
    return this.used
  }

  /** 예산이 남았는가. */
  get hasBudget(): boolean {
    return this.used < this.budget
  }

  /**
   * 같은 컨텍스트 안에서 다시 로그인한다 — 쿠키가 그 자리에서 갱신되므로
   * 이미 열려 있는 다른 탭도 다음 이동부터 새 세션을 쓴다.
   *
   * @returns 다시 로그인했으면 true, 예산이 없거나 실패했으면 false
   */
  async reauth(): Promise<boolean> {
    if (!this.hasBudget) return false
    this.used += 1
    const page = await this.context.newPage()
    try {
      await this.login(page)
      return true
    } catch {
      return false
    } finally {
      await page.close().catch(() => {})
    }
  }

  /**
   * 라우트를 연다. 로그인으로 튕기면 **한 번** 다시 로그인하고 같은 라우트를 다시 연다.
   *
   * @param open 라우트를 여는 동작. 도착한 pathname 을 돌려줘야 한다.
   * @returns 최종 pathname 과, 다시 로그인해서 되살렸는지 여부
   */
  async openWithRetry(open: () => Promise<string>): Promise<{ landed: string; recovered: boolean }> {
    const first = await open()
    if (!bouncedToLogin(first)) return { landed: first, recovered: false }
    if (!(await this.reauth())) return { landed: first, recovered: false }
    const second = await open()
    return { landed: second, recovered: !bouncedToLogin(second) }
  }
}
