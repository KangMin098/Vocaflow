// apps/web/src/hooks/useSrsFlushOnLeave.ts
//
// **학습 세션이 어떤 방식으로 끝나도 평가가 DB 로 간다.**
//
// ── 무엇이 새던가 (실측 2026-09-05) ────────────────────────────────────
// flush 를 부르는 조건이 "완주" 하나뿐이었다. 30장 중 12장을 평가하고
//   · 상단 ✕ 를 누르거나 (SessionFrame 의 `<Link>`)
//   · Esc 를 치거나 (`router.push`)
//   · 브라우저 뒤로가기를 하거나
//   · 사이드바로 다른 화면에 가거나
//   · 탭을 닫으면
// 12장은 어디에도 기록되지 않았다. 학습자는 공부를 했는데 SRS 는 아무 일도 없었던 것이 된다.
// 나가는 길은 다섯 갈래인데 저장은 한 갈래에만 붙어 있었다 — **저장을 길이 아니라
// 화면의 수명에 건다.** 화면이 사라지는 것은 다섯 갈래 모두에서 일어난다.
//
// ── 세 시점 ─────────────────────────────────────────────────────────────
//   ① 진입   — 이전 탭·이전 세션에서 못 올라간 큐를 올린다(응답을 기다리는 확인 전송)
//   ② 숨김   — 탭 전환·화면 잠금(`visibilitychange`). 모바일에서 앱을 떠나는 실제 경로다
//   ③ 언마운트/pagehide — SPA 이동과 탭 닫기. `beforeunload` 는 **모바일 Safari 에서 안 뜬다**
//
// 세 시점 모두 같은 큐를 보내므로 중복이 생길 수 있다. 그건 서버가 막는다
// (`lib/srs/flush-actions.ts` 의 (vocabulary_id, attempted_at) 멱등 가드).
// 중복을 두려워해 전송을 줄이면 다시 유실로 돌아간다 — **유실보다 중복이 낫다**,
// 중복은 고칠 수 있고 유실은 못 고친다.

'use client'

import { useEffect } from 'react'

import { flushOnLeave, flushPendingSession } from '@/lib/srs/flush-session'

/**
 * @param active 세션이 살아 있는 동안만 건다. 기본 `true`.
 *   (완료 화면처럼 더 이상 평가가 쌓이지 않는 구간에서 꺼도 되지만, 켜 둬도 해가 없다 —
 *    빈 큐면 no-op 이다.)
 */
export function useSrsFlushOnLeave(active = true): void {
  useEffect(() => {
    if (!active) return

    // ① 진입 — 지난번에 못 올라간 것을 먼저 정리한다.
    void flushPendingSession()

    // ② 숨김 — 되돌아오지 못할 수 있다.
    const onVisibility = () => {
      if (document.visibilityState === 'hidden') flushOnLeave()
    }
    // ③ 문서 폐기 — 탭 닫기 · 뒤로가기로 bfcache 진입.
    const onPageHide = () => flushOnLeave()

    document.addEventListener('visibilitychange', onVisibility)
    window.addEventListener('pagehide', onPageHide)

    return () => {
      document.removeEventListener('visibilitychange', onVisibility)
      window.removeEventListener('pagehide', onPageHide)
      // 화면이 사라진다 = 학습자가 세션을 떠났다(✕ · Esc · 뒤로가기 · 사이드바 이동).
      flushOnLeave()
    }
  }, [active])
}
