// apps/web/src/app/(marketing)/pricing/page.tsx
//
// 요금제 — 서버 껍데기. 화면은 `components/marketing/PricingClient` 가 그린다.
//
// 왜 나눴나 (2026-08-26):
//   이 화면의 "신뢰 지표" 세 수치가 소스에 **상수로** 박혀 있었고, 2026-08-17 실측을 적어 둔
//   그것이 **9일 만에 셋 다 어긋나 있었다**(도서–어휘 연결은 실제보다 79 **많게** 표시).
//   같은 파일이 "분기마다 재확인" 이라 적어 두고도 그랬다 — 수치는 매일 변하고 재확인은
//   분기에 한 번이니 구조적으로 항상 틀린다. 공개 라우트의 과대 표시는 표시광고법 사안이라
//   사람이 지키는 규칙에 맡기지 않고 **DB 에서 읽는다**.
//
//   토글(월간/연간)이 `useState` 라 화면 자체는 클라이언트여야 하고, DB 조회는 서버여야 한다.
//   그래서 서버가 읽어 props 로 내려 준다.

import type { Metadata } from 'next'

import { PricingClient } from '@/components/marketing/PricingClient'
import { fetchTrustSignals } from '@/lib/marketing/trust-signals'

export const metadata: Metadata = {
  title: '요금제 · Vocaflow',
  description:
    '내가 아는 비율로 글의 난이도를 재고, 편하게 읽히기까지 몇 단어가 남았는지 계산합니다. 무료로 시작할 수 있어요.',
  alternates: { canonical: '/pricing' },
}

/** 신뢰 지표는 매 요청 세지 않는다 — 하루에 한 번이면 충분하고, 그만큼 낡아도 무해하다. */
export const revalidate = 86400

export default async function PricingPage() {
  const signals = await fetchTrustSignals()
  return <PricingClient signals={signals} />
}
