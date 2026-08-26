// apps/web/tests/e2e/utils/crash-screen.ts
//
// **이 화면이 에러 화면인가** — 판정의 단일 출처.
//
// ── 왜 한 곳으로 모으는가 (실측 2026-08-26) ─────────────────────────────
// `app/error.tsx` 와 `app/not-found.tsx` 는 **HTTP 200 에 본문도 충분하다.**
// 그래서 훑기의 여섯 축(열림·조용함·연결·복귀·가로스크롤·탭대상)이 **전부 통과한다** —
// 서버 컴포넌트가 던져서 에러 화면이 떠 있어도 우리는 그 화면을 성공으로 센다.
//
// 판정을 화면마다 각자 적게 뒀더니 실제로 셋이 서로 달라졌다:
//   · `26-learner-sweep`  두 문구 다 봄 (정상)
//   · `33-public-sweep`   `문제가 발생했어요` 를 **안 봄** — 에러 경계를 놓친다
//   · `30-admin-sweep`    조건이 **죽어 있었다**:
//         /문제가 발생했어요|다시 시도/.test(t) === false && false
//     `X === false && false` 는 **항상 false** 다. 관리자 33화면은
//     에러 경계로 떨어져도 영영 초록이었다.
//
// ── `다시 시도` 를 쓰지 않는 이유 ───────────────────────────────────────
// 죽은 조건의 원래 의도는 error.tsx 의 버튼 라벨(`다시 시도`)로도 잡는 것이었는데,
// 그 문구는 **정상 관리자 화면의 재시도 버튼**에도 흔하다. 넣으면 오탐이 쏟아진다.
// 그래서 에러 화면에만 있는 문구로 좁힌다 — 버튼 라벨이 아니라 **본문**으로 가른다.

import type { Page } from '@playwright/test'

/** `app/error.tsx` — 서버/클라이언트 컴포넌트가 던졌을 때 뜨는 표면. */
const ERROR_BOUNDARY = /문제가 발생했어요|페이지를 표시하는 중 오류/

/** `app/not-found.tsx` — `notFound()` 또는 없는 라우트. */
const NOT_FOUND = /페이지를 찾을 수 없어요/

/** Next 자체가 그리는 것들 — 우리 경계보다 앞단에서 깨졌을 때. */
const FRAMEWORK = /Application error|client-side exception|missing required error components/i

export type CrashKind = '에러 경계' | '404 화면' | '프레임워크 오류'

/** 본문 텍스트만으로 판정한다 — 페이지 핸들이 없는 자리(수집된 텍스트)에서도 쓴다. */
export function crashKindOf(bodyText: string): CrashKind | null {
  if (ERROR_BOUNDARY.test(bodyText)) return '에러 경계'
  if (NOT_FOUND.test(bodyText)) return '404 화면'
  if (FRAMEWORK.test(bodyText)) return '프레임워크 오류'
  return null
}

/** 열려 있는 화면이 에러 화면이면 그 종류를, 아니면 null 을 준다. */
export async function crashKind(page: Page): Promise<CrashKind | null> {
  const body = await page.evaluate(() => document.body?.innerText ?? '').catch(() => '')
  return crashKindOf(body)
}

/** 편의 — 종류가 필요 없을 때. */
export const isCrashScreen = (bodyText: string) => crashKindOf(bodyText) !== null
