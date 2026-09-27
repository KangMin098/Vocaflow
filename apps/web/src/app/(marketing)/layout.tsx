// apps/web/src/app/(marketing)/layout.tsx
// 마케팅/공개 페이지 공통 레이아웃 — 공통 헤더(메가메뉴 · 모바일 서랍) · 끝 꽃밭 CTA · 다단 푸터(DD-68).
// 랜딩(`app/page.tsx`)도 같은 헤더·푸터를 쓴다 — 공개 화면의 틀은 이 세 부품이 한 벌이다.
// 서버 컴포넌트다: 헤더와 CTA 판정만 클라이언트이고, 페이지 본문은 초기 HTML 에 그대로 남는다.

import { MarketingTail } from '@/components/marketing/site/MarketingTail'
import { SiteFooter } from '@/components/marketing/site/SiteFooter'
import { SiteHeader } from '@/components/marketing/site/SiteHeader'

export default function MarketingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col bg-[var(--bg)] text-[var(--t1)]">
      <SiteHeader />
      <main className="flex-1">{children}</main>
      <MarketingTail />
      <SiteFooter />
    </div>
  )
}
