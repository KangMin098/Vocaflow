// apps/web/src/lib/analytics/client.ts
//
// 공개 퍼널 계측 — PostHog 얇은 래퍼.
//
// 왜 래퍼인가: PostHog 를 화면에서 직접 부르면 `capture('아무거나', {아무거나})` 가 가능해진다.
//   `/fit` 은 "붙여넣은 지문은 저장하지 않습니다" 를 약속하고, 그 약속은 분석 도구에도 적용된다.
//   → 이 파일 밖에서는 PostHog 를 import 하지 않는다. 이벤트는 `events.ts` 의 닫힌 목록뿐이다.
//
// 무엇을 끄는가 (기본값이 위험하다):
//   · `autocapture` — 클릭한 요소의 **DOM 텍스트**를 그대로 담는다. 학습자가 붙여넣은 지문이
//     화면에 있는 상태에서 켜 두면 그게 그대로 나갈 수 있다. **끈다.**
//   · `session_recording` — 화면을 통째로 녹화한다. 같은 이유로 **끈다.**
//   · `capture_pageview` — 자동 페이지뷰는 URL 을 담는데, 공유 링크 URL 에는 결과 페이로드가
//     들어 있다. 자동 대신 **수동**으로 필요한 것만 보낸다.
//   · `person_profiles: 'identified_only'` — 공개 화면 방문자에게 프로필을 만들지 않는다.
//
// 키가 없으면 조용히 아무것도 하지 않는다 — 로컬·CI 에서 오류나 잡음이 없어야 한다.

'use client'

import type { PublicEvent } from './events'
import { ALLOWED_EVENTS, isSafeProps } from './events'

type PostHogLike = {
  init: (key: string, options: Record<string, unknown>) => void
  capture: (event: string, props?: Record<string, unknown>) => void
}

let ph: PostHogLike | null = null
let initPromise: Promise<PostHogLike | null> | null = null

/**
 * ⚠️ **점 표기여야 한다.** Next 는 `process.env.NEXT_PUBLIC_X` 를 빌드 때 **문자열 치환**하는데,
 *    대괄호 표기(`process.env['NEXT_PUBLIC_X']`)는 그 치환 대상이 아니다 —
 *    브라우저 번들에 값이 들어가지 않아 항상 `undefined` 가 되고, 이 함수는 조용히 `null` 을
 *    돌려준다. 그러면 **화면은 멀쩡한데 계측만 영원히 0** 이다(2026-08-17 실측으로 물림:
 *    이벤트 요청이 한 건도 나가지 않았다).
 *    서버 파일에서는 대괄호도 동작하므로, 이 함정은 클라이언트 코드에만 있다.
 */
function config(): { key: string; host: string } | null {
  const key = process.env.NEXT_PUBLIC_POSTHOG_KEY
  const host = process.env.NEXT_PUBLIC_POSTHOG_HOST
  if (!key || !host) return null
  return { key, host }
}

/**
 * 필요할 때 한 번만 적재한다(동적 import).
 *
 * 정적 import 하면 이 스크립트가 **모든 공개 화면의 첫 번째 로드**에 들어간다.
 * 가입 전 첫인상이 걸린 화면이라 그 무게를 기본값으로 지불할 이유가 없다.
 */
async function ensure(): Promise<PostHogLike | null> {
  if (ph) return ph
  if (initPromise) return initPromise

  const cfg = config()
  if (!cfg || typeof window === 'undefined') return null

  initPromise = import('posthog-js')
    .then((mod) => {
      const client = mod.default as unknown as PostHogLike
      client.init(cfg.key, {
        api_host: cfg.host,
        // ↓ 이 네 줄이 "지문이 새지 않는다" 의 실제 구현이다. 바꾸기 전에 파일 상단 주석을 읽을 것.
        autocapture: false,
        disable_session_recording: true,
        capture_pageview: false,
        person_profiles: 'identified_only',
        // 공개 화면이라 식별자를 만들 이유가 없다.
        capture_pageleave: false,
      })
      ph = client
      return client
    })
    .catch(() => null)

  return initPromise
}

/**
 * 공개 퍼널 이벤트 하나를 보낸다.
 *
 * 실패는 조용히 삼킨다 — 계측이 화면을 망가뜨리면 안 된다.
 * 다만 **허용 목록·속성 검사에 걸리면 개발 중에는 크게 알린다**(그건 코드 실수이지 런타임 문제가 아니다).
 */
export function track(event: PublicEvent): void {
  if (!ALLOWED_EVENTS.includes(event.name)) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[analytics] 허용되지 않은 이벤트: ${event.name}`)
    }
    return
  }
  if (!isSafeProps(event.props)) {
    if (process.env.NODE_ENV !== 'production') {
      console.error(`[analytics] 안전하지 않은 속성 — 전송 취소: ${event.name}`, event.props)
    }
    return
  }

  void ensure().then((client) => {
    client?.capture(event.name, event.props as Record<string, unknown>)
  })
}
