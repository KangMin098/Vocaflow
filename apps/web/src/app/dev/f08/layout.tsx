// apps/web/src/app/dev/f08/layout.tsx
//
// F08 화면 후보 비교 프로토타입(대량작업 J). 제품 화면이 아니다 — 프로덕션 빌드에서는 F08_PROTO=on 일 때만 열리고
// 어떤 제품 라우트도 이 아래를 import 하지 않는다. 최종 배치는 공식 owner 가 정한다.
// data-design-scope="csat" — 제품 /csat 와 같은 3B 스킨 토큰(skins/csat-app.css)·서체를 받는다. 셸(CsatRail)은 통합 때 붙인다.

import { notFound } from 'next/navigation'

import { f08ProtoOpen } from '@/lib/csat/f08-proto/gate'

import './f08.css'

export const metadata = {
  title: 'F08 후보 비교 (dev)',
  robots: { index: false, follow: false },
}

export default function F08Layout({ children }: { children: React.ReactNode }) {
  if (!f08ProtoOpen()) notFound()
  return (
    <div data-design-scope="csat" data-f08-canvas className="min-h-screen break-keep bg-[var(--csat-canvas)] px-8 py-6 font-[family-name:var(--font-sans)] text-[var(--csat-ink)]">
      {children}
    </div>
  )
}
