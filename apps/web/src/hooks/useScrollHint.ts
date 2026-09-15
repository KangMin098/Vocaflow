// apps/web/src/hooks/useScrollHint.ts
//
// 가로 스크롤 줄이 **더 있다는 것을 알리게** 한다.
//
// ── 왜 필요한가 (실측 2026-08-22) ──────────────────────────────────────
// 탭줄에 `overflow-x-auto` 만 걸어 두면 넘치는 항목은 "스크롤하면 나오는" 것이 아니라
// **없는 것**이 된다. 390px 에서 Library 탭줄의 네 번째 탭 `Textbooks` 는 32px,
// My Library 탭줄에서는 **9px** 만 보였다 — 손가락을 대 볼 이유가 화면에 없었다.
// 데스크톱 사이드바는 `hidden md:flex` 라, 모바일 학습자에게는 그 탭이 교재로 가는
// **유일한 통로**였다.
//
// 이 훅이 하는 일은 둘뿐이다:
//   ① 넘치는지 실제로 재서 `data-scroll-hint` 를 붙인다(스타일과 테스트가 그것을 읽는다)
//   ② 어느 쪽으로 더 있는지(`start`/`end`/`both`)를 알려 가장자리 표시를 한쪽만 그리게 한다
//
// ⚠️ 추측하지 않는다 — 항목 수나 화면 폭으로 넘침을 예측하면 글꼴·언어·확대 배율에서 어긋난다.
//    `scrollWidth > clientWidth` 를 **실제로** 잰다. 리사이즈·스크롤·내용 변경에 모두 반응한다.

'use client'

import { useCallback, useEffect, useRef, useState } from 'react'

export type ScrollHint = 'none' | 'start' | 'end' | 'both'

export function useScrollHint<T extends HTMLElement>() {
  const ref = useRef<T | null>(null)
  const [hint, setHint] = useState<ScrollHint>('none')

  const measure = useCallback(() => {
    const el = ref.current
    if (!el) return
    // 1px 여유 — 소수점 레이아웃에서 scrollWidth 가 clientWidth 를 미세하게 넘는다.
    const overflowing = el.scrollWidth > el.clientWidth + 1
    if (!overflowing) {
      setHint('none')
      return
    }
    const atStart = el.scrollLeft <= 1
    const atEnd = el.scrollLeft + el.clientWidth >= el.scrollWidth - 1
    setHint(atStart ? 'end' : atEnd ? 'start' : 'both')
  }, [])

  useEffect(() => {
    const el = ref.current
    if (!el) return

    measure()
    el.addEventListener('scroll', measure, { passive: true })

    // 내용이 바뀌어도(탭 추가·라벨 변경) 다시 잰다 — 한 번만 재면 그 순간의 사실만 남는다.
    const ro = new ResizeObserver(measure)
    ro.observe(el)
    for (const child of Array.from(el.children)) ro.observe(child)

    return () => {
      el.removeEventListener('scroll', measure)
      ro.disconnect()
    }
  }, [measure])

  return { ref, hint, measure }
}

/**
 * 활성 항목을 **보이는 자리로 끌어온다.**
 *
 * 주소로 곧장 들어온 경우(`/text?view=textbooks`) 활성 탭이 화면 밖이면
 * 학습자는 자기가 어디 있는지 알 수 없다 — 탭줄이 위치를 말하는 장치인데 그 말을 못 한다.
 *
 * ⚠️ `block: 'nearest'` — 세로로 스크롤시키면 본문이 튄다. 가로만 움직인다.
 */
export function scrollActiveIntoView(container: HTMLElement | null, selector: string) {
  if (!container) return
  const active = container.querySelector<HTMLElement>(selector)
  if (!active) return
  const cRect = container.getBoundingClientRect()
  const aRect = active.getBoundingClientRect()
  if (aRect.left >= cRect.left && aRect.right <= cRect.right) return // 이미 보인다
  active.scrollIntoView({ block: 'nearest', inline: 'center', behavior: 'auto' })
}
