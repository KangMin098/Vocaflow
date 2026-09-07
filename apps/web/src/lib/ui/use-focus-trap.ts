// apps/web/src/lib/ui/use-focus-trap.ts
//
// **열린 모달 안에 포커스를 가둔다** — 키보드 사용자가 뒤 화면을 더듬지 않게.
//
// ── 왜 훅으로 뽑았나 (실측 2026-09-05) ──────────────────────────────────
// 이 저장소의 다이얼로그 대부분은 `keydown` 에서 **Escape 만** 본다. 그래서 도서 상세
// 시트·시리즈 학습안내·단어장 미리보기를 열고 Tab 을 누르면 포커스가 오버레이 뒤의
// 카드·필터·탭으로 새어 나갔다. 화면은 덮여 있는데 포커스 링은 그 아래를 돌아다니므로,
// 키보드 사용자는 "지금 어디에 있는지" 를 잃는다. `SeriesInfoModal` 은 더해서 열 때
// 포커스를 옮기지도 않아, 팝업이 떴다는 사실 자체가 전달되지 않았다.
//
// 규칙 자체는 이미 저장소 안에 있었다 — `components/comic/ComicInfoDialog.tsx` 가
// Tab 순환·첫 요소 포커스·복원을 전부 구현해 두고 있었다. 문제는 그것이 **한 파일의
// 사정**이었다는 점이다. 세 모달이 같은 코드를 다시 쓰지 않았고, 앞으로 생길 모달도
// 그럴 이유가 없다. 그래서 `lib/ui/use-close-on-back.ts` 와 같은 자리에 같은 결로 뽑는다.
//
// ── 무엇을 하고, 무엇을 안 하나 ─────────────────────────────────────────
// 한다:
//   · 열 때 포커스를 패널 안으로 옮긴다 (패널 자체가 `tabIndex={-1}` 이면 패널로,
//     아니면 첫 포커스 가능 요소로 — 시트처럼 본문이 긴 것은 패널이 맞다)
//   · Tab / Shift+Tab 이 패널 안에서 **순환**한다
//   · 닫을 때 포커스를 열기 전 요소(=트리거)로 되돌린다
// 안 한다:
//   · Escape 닫기 — 호출부마다 닫는 방법이 다르다(상태·라우터·`useCloseOnBack`)
//   · `document.body` 스크롤 잠금 — 잠금 복구 규칙이 컴포넌트마다 다르다
//     (`GlobalBodyReset` 이 존재하는 이유가 그것이다)
//   · 배경에 `inert` 부여 — 포털·오버레이 구조가 화면마다 달라 한 훅이 정할 수 없다.
//     `aria-modal="true"` 를 다이얼로그에 두는 것이 호출부의 몫이다.
//
// ── 왜 포커스 목록을 keydown 마다 다시 구하나 ───────────────────────────
// 모달 안의 내용은 열린 뒤에 바뀐다 — 단어장 미리보기는 단어를 나중에 받아 오고,
// 챕터 아코디언은 펼칠 때 버튼이 열 개씩 늘어난다. 열 때 한 번 구해 캐시하면 나중에
// 생긴 요소가 순환에서 빠지고, 그러면 트랩은 "있는데 안 도는" 상태가 된다.

'use client'

import { useEffect, type RefObject } from 'react'

/**
 * 포커스를 받을 수 있는 요소들. `[tabindex="-1"]` 은 제외한다 —
 * 그건 "프로그램으로만 포커스" 라는 뜻이라 Tab 순환의 정거장이 아니다
 * (패널 자체가 보통 그 값이다).
 */
const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), ' +
  'textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

/**
 * 지금 실제로 누를 수 있는 것만 남긴다.
 *
 * `querySelectorAll` 은 접힌 아코디언 안의 버튼(`display:none`)도 돌려준다.
 * 그걸 순환에 넣으면 Tab 이 **보이지 않는 곳으로 사라진다** — 사용자에게는
 * 포커스가 그냥 없어진 것으로 보인다.
 */
function visibleFocusables(panel: HTMLElement): HTMLElement[] {
  return Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
    (el) => el.getClientRects().length > 0 && el.getAttribute('aria-hidden') !== 'true',
  )
}

/**
 * @param active 모달이 열려 있는가. `false` 면 아무것도 걸지 않는다.
 * @param panelRef 다이얼로그 패널(오버레이가 아니라 **내용 상자**)의 ref.
 * @param options.restoreFocus 닫을 때 열기 전 요소로 포커스를 되돌릴지. 기본 `true`.
 */
export function useFocusTrap(
  active: boolean,
  panelRef: RefObject<HTMLElement | null>,
  options?: { restoreFocus?: boolean },
): void {
  const restoreFocus = options?.restoreFocus ?? true

  useEffect(() => {
    if (!active) return
    const panel = panelRef.current
    if (!panel) return

    // 정리 시점에는 이 값이 이미 바뀌어 있을 수 있다 — 지금 붙잡아 둔다.
    const prevActive = document.activeElement as HTMLElement | null

    // 열 때 안으로 들여보낸다. 패널이 스스로 포커스를 받을 수 있으면(`tabIndex={-1}`)
    // 패널을 잡는다 — 긴 시트에서 첫 버튼(보통 「닫기」)으로 뛰면 본문을 건너뛴 셈이 된다.
    const panelFocusable = panel.getAttribute('tabindex') !== null
    if (panelFocusable) panel.focus()
    else visibleFocusables(panel)[0]?.focus()

    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Tab') return
      const nodes = visibleFocusables(panel)
      if (nodes.length === 0) {
        // 누를 것이 하나도 없는 모달 — 나가는 것보다 제자리가 낫다.
        e.preventDefault()
        if (panelFocusable) panel.focus()
        return
      }
      const first = nodes[0]
      const last = nodes[nodes.length - 1]
      const current = document.activeElement

      // 포커스가 아직 패널 밖이면(패널 자신에 있거나 배경에 있으면) 안으로 끌어온다.
      if (!(current instanceof HTMLElement) || !panel.contains(current) || current === panel) {
        e.preventDefault()
        ;(e.shiftKey ? last : first).focus()
        return
      }
      if (e.shiftKey && current === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && current === last) {
        e.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('keydown', onKey)
      // 닫으면 원래 있던 곳으로 — 키보드 사용자가 목록의 자리를 잃지 않게.
      if (restoreFocus && prevActive?.isConnected) prevActive.focus()
    }
  }, [active, panelRef, restoreFocus])
}
