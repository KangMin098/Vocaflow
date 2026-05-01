// apps/web/src/app/admin/billing/page.tsx

import { StubPage } from '@/components/dev/StubPage'

export default function AdminBillingPage() {
  return (
    <StubPage
      title="결제/구독"
      description="요금제 관리 · 결제 내역 · 환불 · 쿠폰"
      upcoming={[
        '요금제 — 무료 / 베이직 / 프로 플랜 가격 · 한도 설정',
        '결제 내역 — 사용자별 검색 · 영수증 발급',
        '환불 처리 — 사유 · 부분/전체 환불',
        '쿠폰 관리 — 발급 · 만료 · 사용 통계',
        'Webhook 로그 — Stripe / 토스 / 카카오 결제',
      ]}
    />
  )
}
