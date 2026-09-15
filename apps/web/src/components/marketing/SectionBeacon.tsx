// apps/web/src/components/marketing/SectionBeacon.tsx
//
// 랜딩 구획 도달 신호 — **이탈이 어디서 나는지** 를 재는 최소 장치.
//
// 왜 이렇게 작나: 랜딩(`app/page.tsx`)은 서버 컴포넌트이고 하루치 캐시로 내려간다. 구획마다
// `'use client'` 를 씌우면 화면 전체가 클라이언트가 되어 초기 HTML 에 크롤러가 읽을 내용이
// 사라진다. 그래서 **관측점만** 클라이언트로 두고, 구획 자체는 서버 렌더 그대로 남긴다.
//
// 한 번만 보낸다 — 스크롤을 오르내려도 같은 구획은 다시 세지 않는다(분모가 부푼다).
// `IntersectionObserver` 가 없는 환경에서는 아무것도 하지 않는다. 계측 실패가 화면을 막지 않는다.

'use client'

import { useEffect, useRef } from 'react'

import { track } from '@/lib/analytics/client'
import type { PublicEvent } from '@/lib/analytics/events'

type Section = Extract<PublicEvent, { name: 'landing_section_reached' }>['props']['section']

export function SectionBeacon({ section }: { section: Section }) {
  const el = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const node = el.current
    if (!node || typeof IntersectionObserver === 'undefined') return

    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue
          track({ name: 'landing_section_reached', props: { section } })
          io.disconnect()
        }
      },
      // 구획이 조금이라도 화면에 들어오면 도달로 본다 — "봤다" 가 아니라 "닿았다" 를 센다.
      { rootMargin: '0px 0px -20% 0px' },
    )
    io.observe(node)
    return () => io.disconnect()
  }, [section])

  return <div ref={el} aria-hidden className="h-px w-full" />
}
