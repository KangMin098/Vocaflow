// apps/web/src/lib/layout/full-screen-routes.ts
//
// 풀스크린 (= 사이드바 + FlowNav 둘 다 숨김) 라우트 판정.
// 학습 세션 진입 시 working memory 보호(Sweller) — Calm UI 정합.
//
// ── 왜 패턴을 걷어냈나 (v08.6) ─────────────────────────────────────
//
// 예전 판정은 `p.endsWith('/play')` + `p.startsWith('/play/')` 였다. 라우트가 두 규약
// (`/x/play` · `/play/x`)으로 갈려 있어서 둘 다 필요했는데, 그 결과 **판정이 경로 문자열
// 모양에 걸려 있었다**:
//   · `/notes/play` 같은 무관한 라우트가 생기는 순간 조용히 풀스크린이 된다
//   · 규약 밖에 놓인 세션(예: `/dictate/session`)은 매번 여기에 손으로 추가해야 한다
//     — 실제로 그렇게 쌓였고, 빠뜨리면 세션이 사이드바를 달고 뜬다
//
// 경로는 **선언의 대상이지 추측의 대상이 아니다.** 활동의 정본은
// `lib/framework/registry` 의 `route.fullScreen` 이고, 이 파일은 그 선언을 그대로 옮긴 목록이다.
//
// 왜 레지스트리를 import 하지 않는가:
//   레지스트리는 `game/catalog` 를 거쳐 `GAME_MARKS`(ReactNode)까지 끌고 온다.
//   사이드바·FlowNav·SessionFrame 이 그것을 import 하면 그 JSX 가 전 화면 번들에 딸려 온다.
//   그래서 목록은 여기 손으로 두고, **드리프트는 단위 테스트가 막는다** —
//   `framework.test.ts` 가 `fullScreenActivityPaths()` 와 이 목록을 대조한다.
//   목록을 고치면 테스트가 같이 빨개진다.

/** 활동 세션 — registry.route.fullScreen === true 인 것과 1:1. */
const ACTIVITY_FULL_SCREEN: ReadonlySet<string> = new Set([
  // 모듈 세션
  '/flashcard/play',
  '/pairflip/play',
  '/scriptquiz/play',
  '/spellforge/play',
  '/dictate/session',
  // 아케이드 19종 — `(app)/play/<slug>` 규약
  '/play/cascade',
  '/play/connections',
  '/play/daily-blitz',
  '/play/ghost-race',
  '/play/glyph-tongue',
  '/play/letter-forge',
  '/play/lexicon-detective',
  '/play/lexicon-estate',
  '/play/lexicon-hands',
  '/play/morpheme-rules',
  '/play/morphmerge',
  '/play/pirate-quest',
  '/play/silent-rule',
  '/play/word-customs',
  '/play/word-economy',
  '/play/word-orrery',
  '/play/wordblitz',
  '/play/wordfall-cadence',
  '/play/wordsmith-vigil',
])

/**
 * 활동이 아니면서 풀스크린인 화면.
 * 활동 레지스트리에 넣을 수 없는 것들이라 여기서만 선언한다 — 늘어나면 그때 이유를 적는다.
 */
const NON_ACTIVITY_FULL_SCREEN: ReadonlySet<string> = new Set([
  // WordVault Browse 세션 (v06.21.6) — 워크스페이스 접근 용이성
  '/wordvault/browse',
])

// 비포함 (의도적):
//   - /text/[id]          : 자체 Focus Mode(30초 무활동) 보유
//   - /text/[id]/echo     : 워크스페이스 안에서 열린다(registry: fullScreen false)
//   - /dictate/setup      : 설정 단계, 사이드바 유지가 효율적
//   - /dictate/results    : 결과 검토, 다음 모듈 이동 빈번
//   - /text/new           : 입력 양식, 라이브러리 전환 유도
//   - /wordvault?view=*   : 쿼리 파라미터, 같은 hub 라우트

/** 판정에 rawpathname 을 쓴다 — 쿼리·해시는 라우트가 아니므로 호출부가 넘기지 않는다. */
export function isFullScreenRoute(pathname: string | null | undefined): boolean {
  if (!pathname) return false
  // 후행 슬래시는 같은 라우트다(`/play/cascade/` ≡ `/play/cascade`).
  const p = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  return ACTIVITY_FULL_SCREEN.has(p) || NON_ACTIVITY_FULL_SCREEN.has(p)
}

/** 테스트 전용 — 레지스트리 대조용 스냅샷. */
export const FULL_SCREEN_ACTIVITY_ROUTES: readonly string[] = [...ACTIVITY_FULL_SCREEN].sort()
