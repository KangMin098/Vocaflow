// apps/web/src/components/marketing/site/MarketingTail.tsx
// 공개 화면 끝 꽃밭 CTA — 약관·개인정보 화면에는 두지 않는다(참조도 법률 화면에는 CTA 가 없다).

'use client'

import { usePathname } from 'next/navigation'

import { FlowerCta } from './FlowerCta'

const WITHOUT_CTA = ['/terms', '/privacy']

export function MarketingTail() {
  const path = usePathname() ?? ''
  if (WITHOUT_CTA.some((p) => path === p || path.startsWith(`${p}/`))) return null
  return <FlowerCta />
}
