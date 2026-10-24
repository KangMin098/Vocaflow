// apps/web/src/app/dev/f08/layout.tsx
//
// F08 화면 후보 비교 프로토타입(대량작업 J). 제품 화면이 아니다 — 프로덕션 빌드에서는 F08_PROTO=on 일 때만 열리고
// 어떤 제품 라우트도 이 아래를 import 하지 않는다. 최종 배치는 공식 owner 가 정한다.

import { notFound } from 'next/navigation'

import { f08ProtoOpen } from '@/lib/csat/f08-proto/gate'

export const metadata = {
  title: 'F08 후보 비교 (dev)',
  robots: { index: false, follow: false },
}

export default function F08Layout({ children }: { children: React.ReactNode }) {
  if (!f08ProtoOpen()) notFound()
  return <div className="min-h-screen bg-[#fbfaf7] px-8 py-6 font-sans text-[#1f1d1a]">{children}</div>
}
