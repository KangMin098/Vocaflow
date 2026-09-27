// apps/web/src/components/library/LibraryTabs.tsx
//
// /library 하위 3탭 네비게이션 — 도서 / 스크립트 / 공용 단어장.
// 스크립트 = ACP(/admin/articles) 게시 아티클(짧은 글) 학습.
// 만화(v07)는 여기 탭이 아니라 **사이드바 최상위 메뉴 `/comics`** 로 분리(사용자 결정 2026-08-09).
//   데이터는 여전히 도서에 앵커된 포맷(Expression)이고, 도서 카드의 만화 배지/포맷 필터는 유지된다.
//   (docs/CCP_LIBRARY_INTEGRATION.md D1·D2)
// 모양은 공용 구역 내비(`components/layout/AreaNav` — 참조 AreaNav 알약 막대, DD-68).

'use client'

import { usePathname } from 'next/navigation'

import { AreaNav } from '@/components/layout/AreaNav'
import { routeArt } from '@/lib/design/route-art'
import { LIBRARY_TABS } from '@/lib/library/tabs'

// 목록·라벨은 `lib/library/tabs.ts` 하나가 갖는다 — 이 파일도, 사이드바 서브메뉴도 거기서 읽는다.
//   여기서 다시 적으면 사이드바와 갈라진다(같은 실패: 하단 탭이 자체 라벨을 들었던 v06.141).
//   라벨 자체의 출처는 그 파일이 참조하는 `MATERIAL_LABEL` 이다.
// ⚠️ 390px 에서는 막대가 넘친다 — AreaNav 의 `data-scroll-hint` 가 넘친 쪽을 흐린다. 이게 없으면
//    네 번째 탭(Textbooks)이 32px 만 보이고, 모바일에는 사이드바가 없어서 그 탭이 교재로 가는
//    유일한 통로인데도 없는 것처럼 보였다(실측 2026-08-22).

export function LibraryTabs() {
  const pathname = usePathname()
  return (
    <AreaNav
      area="서가"
      tint={routeArt(pathname)?.tint ?? 'lavender'}
      ariaLabel="라이브러리 탭"
      watch={pathname}
      items={LIBRARY_TABS.map((t) => ({
        href: t.href,
        label: t.label,
        icon: t.icon,
        ariaLabel: `${t.label} — ${t.says}`,
        active: pathname.startsWith(t.href),
      }))}
    />
  )
}
