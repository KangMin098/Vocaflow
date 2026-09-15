// apps/web/tests/e2e/utils/goto-settled.ts
//
// **주소가 멈추고 본문이 나올 때까지 기다린 뒤에 잰다.**
//
// 전수 훑기 세 축(26 열림/앞길 · 27 키보드 · 28 정체)이 같은 화면을 같은 규칙으로 재야
// 한다. 그런데 이 함수는 26 안에만 있었고 27·28 은 `goto` + 고정 대기 1초를 썼다.
// 그래서 같은 결함이 축마다 다른 얼굴로 나타났다 —
//
//   실측 2026-09-06 · `/dictate/setup` 과 `/dictate/results` 는 **클라이언트에서**
//   `/dictate` 로 되돌린다(설정은 자료 선택이 없어서, 결과는 sessionId 가 없어서).
//   리다이렉트 **전에** 재면 "h1 이 없다", **후에** 재면 "제목이 겹친다" 로 찍힌다.
//   같은 빌드에서 실행마다 답이 갈렸고, 둘 다 화면이 아니라 **읽은 시점**의 문제였다.
//
// 그래서 세 축이 이 한 벌을 나눠 쓴다(이미 `content-scope` 를 그렇게 쓰고 있다).

import type { Page } from '@playwright/test'

/** 본문이 "나왔다" 고 볼 최소 길이. 이보다 짧으면 아직 그리는 중으로 본다. */
const MIN_BODY = 40

/**
 * 라우트를 열고 **착지한 pathname** 을 돌려준다.
 *
 * 세 단계로 기다린다:
 *   ① 순수 `redirect()` 페이지는 본문이 빈 채로 잠깐 머문다 — 주소가 바뀔 때까지 기다린다.
 *      (첫 판은 여기서 성급히 읽고 `/library`·`/my`·`/my/texts` 를 "본문이 비어 있다" 로 적었다.)
 *   ② 주소가 **더 이상 안 바뀔 때까지** — 클라이언트 리다이렉트는 렌더 뒤에 온다.
 *   ③ 본문이 나올 때까지, **상한을 두고**.
 *
 * ⚠️ **"비어 있다" 는 "아직 안 나왔다" 와 다르다** (실측 2026-09-06).
 *    ②까지만 하면 약 1.3초 시점의 본문을 읽는데, 동적 서버 화면은 콜드 진입에서 그보다
 *    오래 걸린다 — `/wordvault` **2,831ms** · `/dashboard` 1,722ms · `/hub` 1,125ms.
 *    그래서 `/my/texts`(→ `/text` 로 보내는 껍데기)가 목적지의 콜드 렌더에 걸려
 *    "본문이 비어 있다" 로 찍혔다 — 화면은 멀쩡했고 **계측기가 일찍 읽은 것**이다.
 *
 * ⚠️ 상한(8초)을 둔다. 여기서 물어야 할 것은 "언젠가 그려지는가" 이고, 영영 안 그려지는
 *    화면은 상한을 넘겨 그대로 실패로 남는다 — 느린 것을 통과로 세지 않으려면 속도는 별도 축이다.
 */
export async function gotoSettled(page: Page, url: string): Promise<string> {
  const want = new URL(url, 'http://x').pathname
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 45_000 }).catch(() => {})
  await page.waitForTimeout(700)

  const empty =
    ((await page.locator('body').innerText().catch(() => '')) || '').trim().length < MIN_BODY
  if (empty) {
    await page.waitForURL((u) => u.pathname !== want, { timeout: 6_000 }).catch(() => {})
    await page.waitForTimeout(600)
  }

  let last = page.url()
  for (let i = 0; i < 3; i++) {
    await page.waitForTimeout(400)
    if (page.url() === last) break
    last = page.url()
  }

  for (let waited = 0; waited < 8_000; waited += 250) {
    const n = ((await page.locator('body').innerText().catch(() => '')) || '').trim().length
    if (n >= MIN_BODY) break
    await page.waitForTimeout(250)
  }
  return new URL(page.url()).pathname
}
