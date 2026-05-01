// apps/web/src/app/(main)/settings/page.tsx

import { StubPage } from '@/components/dev/StubPage'

export default function SettingsPage() {
  return (
    <StubPage
      title="설정"
      description="계정 · 테마 · TTS · 학습 환경 · 알림 · 데이터 관리"
      upcoming={[
        '계정 — 프로필 · 이메일 변경 · 비밀번호 변경 · 로그아웃',
        '테마 — Light / Dark / System 자동',
        'TTS — 기본 속도 · 음성 선택 (영어 원어민)',
        '학습 — 일일 목표 · 알림 시간',
        '데이터 — 백업 / 내보내기 / 계정 삭제',
      ]}
    />
  )
}
