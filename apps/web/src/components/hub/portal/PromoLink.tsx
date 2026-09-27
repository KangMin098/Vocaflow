// apps/web/src/components/hub/portal/PromoLink.tsx
//
// 플랫폼 메인의 홍보 면 링크 — 누르면 **어느 면의 몇 번째**인지 센다(`hub_promo_clicked`).
// 서버 컴포넌트가 면을 그리고, 나가는 문만 이 클라이언트 조각이 맡는다.

'use client'

import Link from 'next/link'
import type { ReactNode } from 'react'

import { track } from '@/lib/analytics/client'
import type { PublicEvent } from '@/lib/analytics/events'

export type PromoSlot = Extract<PublicEvent, { name: 'hub_promo_clicked' }>['props']['slot']

export function PromoLink({
  href,
  slot,
  index,
  className,
  children,
  ariaLabel,
}: {
  href: string
  slot: PromoSlot
  index: number
  className?: string
  children: ReactNode
  ariaLabel?: string
}) {
  return (
    <Link
      href={href}
      aria-label={ariaLabel}
      className={className}
      onClick={() => track({ name: 'hub_promo_clicked', props: { slot, index } })}
    >
      {children}
    </Link>
  )
}
