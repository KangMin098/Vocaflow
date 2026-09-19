// apps/web/tests/e2e/utils/net-watch.ts
//
// **그 화면의 요청이 실패하지 않는가** — 전수 훑기의 일곱 번째 축.
//
// ── 왜 이 축을 올리는가 (실측 2026-08-26) ────────────────────────────────
// 전수 훑기 셋(학습자·관리자·공개) 중 **어느 것도 네트워크 실패를 보지 않았다.**
// 지금까지의 축은 전부 "화면이 뜨는가" 를 물었다 —
//   열림 · 조용함(콘솔) · 연결(링크) · 복귀(뒤로가기) · 가로스크롤 · 탭 대상.
// 그런데 화면은 멀쩡히 뜨고 콘솔도 조용한데 **그 화면의 데이터 요청이 500 을 뱉는** 경우가 있다.
// 학습자는 빈 목록을 보고, 우리는 그 화면을 100% 로 센다. 그건 통과가 아니다.
//
// 바를 "화면이 뜬다" 에서 **"화면이 뜨고 그 데이터도 온다"** 로 올린다.
//
// ── 무엇을 세고 무엇을 안 세는가 ────────────────────────────────────────
// **같은 출처(우리 서버)** 의 요청만 센다. Supabase·폰트·CDN 은 남의 서버라
// 여기서 실패해도 이 스펙이 고칠 수 있는 것이 아니고, 자리도 다르다(그건 가용성 이슈).
//
// 그리고 **정상인 4xx 가 있다** — 이름을 붙여 거른다:
//   · 401/403 : 로그아웃 상태에서 보호 API 를 찔러 보는 것은 정상 동작이다
//   · 404 on `/api/.../check` 류 : "있는지 물어보는" 요청은 없음이 정답일 수 있다
//   · favicon · `_next/image` 원격 표지 : 제3자 이미지 최적화 실패(별건으로 기록됨)
// 거르는 목록이 길어지면 축이 죽으므로, **이유 없이 넓히지 않는다.**

import type { Page } from '@playwright/test'

export interface NetFailure {
  url: string
  status: number
  method: string
}

/**
 * 감시자를 어떤 상태에서 다는가. **로그인 여부가 401/403 의 의미를 바꾼다.**
 *
 * · 로그아웃 훑기(공개 화면) — 보호 API 가 401 을 주는 것은 **서버가 옳게 막은 것**이다.
 * · 로그인 훑기(학습자·관리자) — 로그인한 사람이 자기 API 에서 401 을 받으면 **결함**이다.
 *   빈 목록이 뜨고 학습자는 "아직 아무것도 없네" 로 읽는다. 그걸 걸러 내면 안 된다.
 *
 * 기본값을 `authed` 로 둔다 — 넓게 거르는 쪽을 기본으로 하면 조용히 검증이 사라진다.
 */
export type NetContext = 'authed' | 'anonymous'

/** 이건 실패로 세지 않는다 — **이유가 있는 것만.** */
function isExpected(url: string, status: number, ctx: NetContext): boolean {
  // 로그아웃 상태에서 보호 API 를 찌른 것 — 서버가 옳게 막은 것이다.
  // ⚠️ 로그인 상태에서는 거르지 않는다. 그건 진짜 결함이다.
  if (ctx === 'anonymous' && (status === 401 || status === 403)) return true
  // 원격 표지 최적화 — 제3자(gutenberg 등) 가용성 문제이고 화면은 그대로 뜬다.
  // (이 사실 자체는 CHANGELOG 에 별도로 기록돼 있다.)
  if (/\/_next\/image/.test(url)) return true
  if (/favicon|apple-touch-icon|\.ico(\?|$)/i.test(url)) return true
  // 존재 확인용 조회 — 없음이 정답일 수 있다.
  if (status === 404 && /\/(check|exists|probe)(\/|\?|$)/i.test(url)) return true
  return false
}

/**
 * 페이지에 네트워크 감시를 붙이고, 떼는 함수와 수집함을 돌려준다.
 *
 * ```ts
 * const net = watchNetwork(page, baseURL)
 * … 화면을 연다 …
 * net.stop()
 * if (net.failures.length) …
 * ```
 */
export function watchNetwork(page: Page, origin: string, ctx: NetContext = 'authed') {
  const failures: NetFailure[] = []

  const onResponse = (res: { url: () => string; status: () => number; request: () => { method: () => string } }) => {
    const url = res.url()
    // **같은 출처만.** 남의 서버 실패는 이 축이 고칠 수 있는 것이 아니다.
    if (!url.startsWith(origin)) return
    const status = res.status()
    if (status < 400) return
    if (isExpected(url, status, ctx)) return
    failures.push({ url: url.slice(origin.length) || '/', status, method: res.request().method() })
  }

  page.on('response', onResponse as never)

  return {
    failures,
    stop() {
      page.off('response', onResponse as never)
    },
    /** 이번 화면 몫만 보고 비운다 — 라우트마다 따로 세기 위해. */
    drain(): NetFailure[] {
      const out = failures.slice()
      failures.length = 0
      return out
    },
  }
}

export const describeNetFailure = (f: NetFailure) => `${f.status} ${f.method} ${f.url.slice(0, 80)}`
