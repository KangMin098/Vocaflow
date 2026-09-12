// apps/web/src/lib/ui/use-close-on-back.ts
//
// **뒤로가기로 팝업을 닫는다** — 열려 있는 오버레이의 공통 계약.
//
// ── 왜 한 곳에 모으나 (실측 2026-08-30) ─────────────────────────────────
// `31-popup-return` 이 팝업의 다섯 축(열림·주소·스크롤·잠금·포커스)을 이미 보고 있었는데,
// **뒤로가기는 한 번도 누르지 않았다**(그 스펙의 `goBack` 호출 수가 0이었다). 축을 올리자
// 재던 팝업 6개 중 **6개 전부**가 같은 방식으로 틀렸다:
//
//   · `/library/books` 상세 시트 열고 뒤로가기 → `/library/scripts` 로 **떠남**
//   · `/library/vocab` 미리보기 열고 뒤로가기 → 고르던 카테고리를 잃음
//   · `/arcade` 게임 설명 · `/library/scripts` 학습 안내 · `/comics` 콘텐츠 정보 — 같음
//
// 폰에는 Esc 가 없다. 뒤로가기(제스처)가 **덮인 것을 치우는** 가장 흔한 동작인데,
// 그걸 누르면 학습자는 보던 것에서 튕겨 나가고 고르던 자리(필터·스크롤·펼친 만큼)를
// 함께 잃는다. 화면은 멀쩡히 뜨므로 어떤 오류로도 잡히지 않는다.
//
// 여섯 곳에 같은 useEffect 를 베껴 넣으면 반드시 갈라진다(CONVENTIONS "같은 규칙을
// 두 곳에 쓰지 말 것"). 그래서 훅 하나로 둔다 — 다음에 생기는 팝업도 한 줄이면 된다.
//
// ── 어떻게 ─────────────────────────────────────────────────────────────
// 열릴 때 히스토리에 표식을 하나 쌓고(`pushState`), `popstate` 를 받으면 이동 대신 닫는다.
// 다른 방법으로 닫혔을 때(Esc·닫기 버튼·바깥 클릭)는 쌓아 둔 항목을 **되감아** 히스토리를
// 원래대로 돌려놓는다 — 안 그러면 닫은 뒤 뒤로가기를 **두 번** 눌러야 앞 화면으로 간다.
// 시트를 연 것은 이동이 아니므로 그것도 틀린 동작이다.
//
// ⚠️ 주소는 바꾸지 않는다(`pushState(state, '')` — 현재 URL 유지). 팝업은 이동이 아니고,
//    `31-popup-return` 의 "열고 닫아도 URL 이 그대로다" 계약도 그대로 지켜야 한다.
//
// ⚠️ `onClose` 는 **매 렌더 새로 만들어도 된다** — 훅이 ref 로 최신 값을 읽으므로
//    effect 가 재실행되지 않는다. 호출부가 useCallback 을 강제당하면 적용이 안 퍼진다.

'use client'

import { useEffect, useRef } from 'react'

/**
 * 되감기 예약 — **StrictMode 안전장치.**
 *
 * ⚠️ 이게 없으면 개발 모드에서 팝업이 열리자마자 닫힌다. React 18 StrictMode(Next 14 기본값)는
 *    effect 를 **mount → cleanup → mount** 로 두 번 돌린다. 순진하게 짜면:
 *      mount① pushState → cleanup① history.back() → mount② 리스너 부착
 *      → ①이 부른 back 의 popstate 가 **②의 리스너**에 걸려 곧바로 onClose()
 *    실측 2026-08-30: `SeriesInfoModal` 이 정확히 이렇게 열리자마자 닫혔고,
 *    이미 통과하던 "열고 닫아도 …" 검사까지 같이 깨졌다. 나머지 팝업은 타이밍이
 *    운 좋게 어긋나 통과했을 뿐이라 **전부 같은 경주 위에 있었다.**
 *
 * 그래서 되감기를 한 틱 미룬다. 곧바로 다시 mount 되면(= StrictMode 재실행이거나
 * 리렌더) 예약을 취소하고 쌓아 둔 항목을 그대로 쓴다 — 히스토리는 언제나 한 칸만 는다.
 */
let pendingUnwind: ReturnType<typeof setTimeout> | null = null

/**
 * @param open   팝업이 열려 있는가
 * @param onClose 닫는 함수 (매 렌더 새 참조여도 된다)
 */
export function useCloseOnBack(open: boolean, onClose: () => void): void {
  const closeRef = useRef(onClose)
  closeRef.current = onClose

  useEffect(() => {
    if (!open) return
    if (typeof window === 'undefined') return

    // 방금 예약된 되감기가 있으면 취소한다 — 그 항목을 우리가 이어서 쓴다(위 주석 참조).
    let reusedEntry = false
    if (pendingUnwind !== null) {
      clearTimeout(pendingUnwind)
      pendingUnwind = null
      reusedEntry = true
    }
    if (!reusedEntry) window.history.pushState({ vocaflowOverlay: true }, '')

    let unwound = false
    const onPop = () => {
      // 뒤로가기가 우리 표식을 이미 걷어냈다 — 되감을 것이 없다.
      unwound = true
      closeRef.current()
    }
    window.addEventListener('popstate', onPop)

    return () => {
      window.removeEventListener('popstate', onPop)
      // 뒤로가기가 아닌 방법으로 닫혔으면 우리가 쌓은 항목을 직접 걷어낸다 — 다만
      // 곧바로 다시 열리는 경우(StrictMode)를 위해 한 틱 미룬다.
      if (unwound) return
      pendingUnwind = setTimeout(() => {
        pendingUnwind = null
        window.history.back()
      }, 0)
    }
  }, [open])
}
