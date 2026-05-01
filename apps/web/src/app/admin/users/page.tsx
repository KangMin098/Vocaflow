// apps/web/src/app/admin/users/page.tsx

import { StubPage } from '@/components/dev/StubPage'

export default function AdminUsersPage() {
  return (
    <StubPage
      title="사용자 관리"
      description="가입 · 제재 · 구독 상태 · 학습 통계"
      upcoming={[
        '사용자 목록 — 검색 · 필터 (구독/상태/가입일)',
        '상세 페이지 — 학습 기록 · 단어 mastery · 결제 내역',
        '제재 — 일시정지 / 영구차단 / 경고',
        '구독 변경 — 무료 / 베이직 / 프로 플랜 전환',
        '대량 작업 — CSV 내보내기 · 메일 발송',
      ]}
    />
  )
}
