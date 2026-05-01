// apps/web/src/app/admin/settings/page.tsx

import { StubPage } from '@/components/dev/StubPage'

export default function AdminSettingsPage() {
  return (
    <StubPage
      title="시스템 설정"
      description="feature flags · AI 프롬프트 · 공지 · 점검 모드"
      upcoming={[
        'Feature flags — 기능 단위 ON/OFF 토글',
        'AI 프롬프트 관리 — 단어 추출 / 퀴즈 생성 프롬프트 버전',
        'OpenAI 모델 선택 — gpt-4o-mini / gpt-4o / gpt-5',
        '인앱 공지 — 전체/타겟 사용자 발송',
        '점검 모드 — 서비스 일시 중단 + 안내 페이지',
        '관리자 권한 관리 — RBAC 역할 할당',
      ]}
    />
  )
}
