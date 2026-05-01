// apps/web/src/app/admin/library/page.tsx

import { StubPage } from '@/components/dev/StubPage'

export default function AdminLibraryPage() {
  return (
    <StubPage
      title="콘텐츠 관리"
      description="원문 CRUD · 카테고리 · 큐레이션 · 공식 라이브러리"
      upcoming={[
        '원문 등록/수정/삭제 — 제목 · 저자 · CEFR · 카테고리',
        'AI 분석 재실행 — 단어 추출 결과 갱신',
        '큐레이션 — 추천 콘텐츠 선정 · 정렬',
        '공식/사용자 콘텐츠 분리',
        '신고된 콘텐츠 처리 — 검토 · 비공개 전환',
      ]}
    />
  )
}
