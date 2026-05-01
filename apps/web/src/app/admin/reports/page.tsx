// apps/web/src/app/admin/reports/page.tsx

import { StubPage } from '@/components/dev/StubPage'

export default function AdminReportsPage() {
  return (
    <StubPage
      title="신고/문의"
      description="콘텐츠 신고 · 사용자 문의 · 버그 리포트"
      upcoming={[
        '콘텐츠 신고 — 부적절 / 저작권 / 오류 카테고리',
        '사용자 문의 — 이메일 응답 · 상태 추적',
        '버그 리포트 — 스크린샷 · 환경 정보',
        '처리 워크플로우 — 접수 → 검토 → 처리 → 회신',
        '담당자 배정 · SLA 모니터링',
      ]}
    />
  )
}
