// apps/web/tests/e2e/utils/content-scope.ts
//
// **"이 화면에서 무엇이 본문인가" 의 단일 출처.**
//
// ── 왜 한 곳에 모았나 (실측 2026-08-30) ─────────────────────────────────
// 전수 훑기 세 스펙(26 동선 · 27 키보드 · 28 정체)이 저마다 같은 한 줄을 들고 있었다:
//
//     const main = document.querySelector('main')   // 없으면 body
//
// 셸(사이드바·하단탭)을 앞길로 세지 않으려는 규칙이고, `(main)` 그룹에서는 맞다.
// 그런데 `(app)/play/*` 게임 19종에서 **셋 다 같은 오답**을 냈다:
//
//   · 26 → 19화면 전부 "막다른 길 · 이동 대상 없음"
//   · 27 → 19화면 전부 "Tab 40번으로 본문 컨트롤에 못 닿았다"
//   · 28 → 19화면 전부 "본문에 h1 이 없다"
//
// 실제로는 눈앞에 "브리핑 닫기 · 시작하기 →" 가 있고 Tab 으로 다 닿는다. 원인은 둘이다:
//
//   ① **첫 진입에 게임을 마운트하지 않는다.** 브리핑(`role="dialog" aria-modal="true"`)을
//      읽는 동안 판이 소모되지 않게 하려는 의도적 설계다(`lib/game/play-scaffold.tsx`).
//      그래서 그 순간 `<main>` 의 innerHTML 은 **0자**이고, 브리핑 패널은 body 직계로 뜬다.
//   ② **`<main>` 과 세션 프레임의 중첩이 그룹마다 반대다.** `(main)` 에서는 SessionFrame 이
//      레이아웃의 `<main>` 안에 있고, `(app)` 에서는 play-scaffold 가 프레임 안에서 자기
//      `<main>` 을 연다. 그래서 화면 이름(h1)과 닫기가 본문 밖으로 나간다.
//      ⚠️ 중첩을 바꾸는 쪽은 이미 해 보고 되돌렸다 — `<main>` 을 프레임 밖으로 빼면
//         `(main)` 세션의 h1 이 본문 밖으로 나가 28 이 5건 깨진다(SessionFrame 머리 주석).
//         그러니 **구조가 아니라 계측 범위**를 맞춘다.
//
// 규칙을 세 곳에 복제해 두면 반드시 갈라진다(CONVENTIONS "같은 대상을 고르는 규칙을
// 두 곳에 쓰지 말 것"). 그래서 여기 한 벌만 둔다.
//
// ── 규칙 ────────────────────────────────────────────────────────────────
//   본문 = `<main>`
//        + **열려 있는 모달 대화상자**(지금 학습자가 보고 있는 것 자체다. 셸이 아니다)
//        + `<main>` 이 없거나 **비어 있는 풀스크린 세션**에서는 문서 전체
//          (그 화면의 컨트롤이 프레임 쪽에 있다 — 셸이 곧 본문인 화면이다)

/** 26 용 — CSS 선택자 앞에 붙일 스코프들. */
export function contentScopes(hasMain: boolean, hasDialog: boolean): string[] {
  const base = hasMain ? 'main' : 'body'
  return hasDialog && base !== 'body' ? [base, '[role="dialog"]'] : [base]
}

/**
 * 27·28 용 — **브라우저 안에서** 도는 판정.
 *
 * `page.evaluate(...)` 로 통째로 넘어가므로 **클로저를 쓰지 않는다**(모듈 스코프의
 * 어떤 값도 참조하지 않는다). 인자는 하나뿐이다 — Playwright 의 evaluate 제약.
 */
export function focusProbe(isFullScreen: boolean) {
  const el = document.activeElement as HTMLElement | null
  if (!el || el === document.body) return null

  const main = document.querySelector('main')
  const dialog = el.closest('[role="dialog"]')
  const mainEmpty = !main || main.innerHTML.trim().length === 0
  // 본문 판정 — 파일 머리 §규칙.
  const inMain = !main
    ? true
    : main.contains(el) || dialog !== null || (isFullScreen && mainEmpty)

  const tag = el.tagName.toLowerCase()
  const role = el.getAttribute('role') || ''
  const actionable =
    tag === 'a' ||
    tag === 'button' ||
    tag === 'input' ||
    tag === 'select' ||
    tag === 'textarea' ||
    ['button', 'link', 'checkbox', 'tab', 'menuitem'].includes(role)

  // 포커스 표시 — outline 이 그려지거나 ring(box-shadow) 이 붙거나.
  // ⚠️ 클래스 문자열(`focus-visible:ring-2`)을 세면 안 된다. 그건 "적혀 있다" 이지
  //    "그려진다" 가 아니다 — 상위 규칙에 덮이면 적혀 있어도 안 보인다.
  const cs = getComputedStyle(el)
  const ow = parseFloat(cs.outlineWidth || '0')
  const hasOutline = cs.outlineStyle !== 'none' && ow > 0
  const hasRing = cs.boxShadow !== 'none' && cs.boxShadow !== ''
  const visible = hasOutline || hasRing

  const label = (el.getAttribute('aria-label') || el.textContent || '').trim().slice(0, 28) || tag

  const href = el.getAttribute('href') || ''
  const isSkip = tag === 'a' && href.startsWith('#')

  return { inMain, actionable, visible, tag, label, isSkip }
}

/** 28 용 — 화면 정체(제목·h1·랜드마크). 위와 같은 이유로 클로저를 쓰지 않는다. */
export function identityProbe(isFullScreen: boolean) {
  const main = document.querySelector('main')
  const scope: ParentNode = main ?? document.body
  let h1s = Array.from(scope.querySelectorAll('h1'))
  // main 에서 못 찾았을 때만 문서 전체를 본다 — 찾은 화면의 판정은 그대로 둔다.
  if (isFullScreen && h1s.length === 0) h1s = Array.from(document.querySelectorAll('h1'))
  return {
    title: document.title.trim(),
    h1Count: h1s.length,
    h1Text: (h1s[0]?.textContent || '').trim().slice(0, 40),
    hasMain: main !== null,
    hasNav: document.querySelector('nav, [role="navigation"]') !== null,
  }
}
