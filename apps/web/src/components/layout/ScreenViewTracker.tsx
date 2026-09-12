// apps/web/src/components/layout/ScreenViewTracker.tsx
//
// **학습자 화면 진입을 한 곳에서 센다** (CLAUDE.md D2 — 새 공개 화면은 진입 이벤트를 같은 커밋에).
//
// ── 왜 셸에 있나 (실측 2026-09-05) ────────────────────────────────────
// 학습자 화면 77개 중 진입 이벤트를 가진 화면이 **0개**였다. 정의된 14개 이벤트는 전부
// 공개 퍼널(`/fit` · 랜딩 · 서가)과 셸 패널의 것이라, 로그인한 학습자가 어느 화면에 머물고
// 어디서 새는지를 어떤 표도 말해 주지 않았다. 화면마다 손으로 심으면 반드시 빠진다 —
// 지금까지 정확히 그랬다. 그래서 라우트 그룹 레이아웃 두 곳(`(main)` · `(app)`)에 한 번씩만
// 놓고, 경로가 바뀔 때마다 **레지스트리의 닫힌 id** 로 접어 한 번 보낸다.
//
// ── 무엇을 보내지 않나 ────────────────────────────────────────────────
// 경로 원문·동적 세그먼트(id·slug)·쿼리는 보내지 않는다. `screenIdOf()` 가
// `/text/abc-123/echo` 를 `text-echo` 같은 고정 이름으로 접는다. 목록 밖이면 `'other'` —
// 그 비율이 오르면 `lib/framework/learner-routes.ts` 가 낡은 것이다(레지스트리 회귀가 있다).
//
// ── 중복 방지 ────────────────────────────────────────────────────────
// 같은 pathname 에 대해 한 번만 보낸다. React StrictMode 의 이중 이펙트도, 쿼리만 바뀌는
// `router.replace` 도 두 번으로 세지 않는다(쿼리는 화면이 아니다).
//
// ⚠️ 기억은 **모듈 수준**이어야 한다 — `useRef` 로 두면 컴포넌트가 다시 마운트될 때 초기화되고,
//    그 순간 같은 화면이 두 번 세어진다. 실측 2026-09-06(프로덕션 빌드 · `29-learner-waste`):
//    `/arcade` · `/library/vocab` · `/pairflip/play` 세 화면이 정확히 그렇게
//    `POST /api/analytics/event` 를 2회씩 보내고 있었다(57화면 중 3화면).
//    분모가 부풀면 그 화면의 이탈률·전환율이 통째로 틀린다.
//
//    A → B → A 로 돌아오면 다시 보낸다(경로가 바뀌었으므로 새 조회다) — 막는 것은
//    **같은 경로에서의 재마운트**뿐이다.

'use client'

import { usePathname } from 'next/navigation'
import { useEffect } from 'react'

import { track } from '@/lib/analytics/client'
import { UNKNOWN_SCREEN, screenIdOf } from '@/lib/framework/learner-routes'

/** 마지막으로 보낸 경로. 마운트 수명보다 오래 살아야 한다(위 주석 참조). */
let lastSentPath: string | null = null

interface Props {
  /** 어느 라우트 그룹의 셸인가 — `(app)` 은 풀스크린 게임 전용이다. */
  group: 'main' | 'app'
}

export function ScreenViewTracker({ group }: Props) {
  const pathname = usePathname()

  useEffect(() => {
    if (!pathname || lastSentPath === pathname) return
    lastSentPath = pathname
    const screen = screenIdOf(pathname)
    track({
      name: 'screen_viewed',
      props: { screen, group, known: screen !== UNKNOWN_SCREEN },
    })
  }, [pathname, group])

  return null
}
