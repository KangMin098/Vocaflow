// apps/web/src/components/comic/ComicsTabs.tsx
//
// /comics 하위 2탭.
//
// 라벨을 Adapted / Restored 에서 바꾼 이유 (2026-08-09):
//   그 둘은 **우리 파이프라인 용어**였다 — 원작에 무슨 처리를 했는지를 말할 뿐,
//   학습자가 "무엇을 읽게 되는지"는 하나도 알려주지 않는다. 각색·복원은 우리 사정이고
//   학습자에게는 *읽는 책의 만화판*인지 *진짜 옛 영어 만화책*인지가 유일하게 중요한 차이다.
//
// 지금 이름은 **읽을 거리 자체**를 가리킨다:
//   · Book Comics    — 라이브러리 도서를 만화로 (CCP). 원문·퀴즈와 이어진다.
//   · Vintage Comics — 1940~50년대 실제 영어 만화책 (PDCP). 만화 자체가 원작.
//
// LibraryTabs 와 같은 구역 내비(`components/layout/AreaNav`, role=tablist + aria-selected + 44px) — 학습자가 이미 아는 구조.
// URL 슬러그(adapted/restored)는 그대로 둔다 — 화면 문구가 아니고, 지금 바꾸면 다른 작업과 충돌한다.

'use client'

import { BookImage, ScanLine } from 'lucide-react'
import { usePathname } from 'next/navigation'

import { AreaNav } from '@/components/layout/AreaNav'

const TABS = [
  { label: 'Book Comics', ko: '읽는 책을 만화로', href: '/comics/adapted', icon: BookImage },
  { label: 'Vintage Comics', ko: '옛 영어 만화책', href: '/comics/restored', icon: ScanLine },
] as const

export function ComicsTabs() {
  const pathname = usePathname()
  return (
    <AreaNav
      area="만화"
      tint="yellow"
      ariaLabel="만화 탭"
      watch={pathname}
      items={TABS.map((t) => ({
        href: t.href,
        label: t.label,
        icon: t.icon,
        note: t.ko,
        ariaLabel: `${t.label} — ${t.ko}`,
        active: pathname.startsWith(t.href),
      }))}
    />
  )
}
