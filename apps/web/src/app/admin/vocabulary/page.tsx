// apps/web/src/app/admin/vocabulary/page.tsx

import { StubPage } from '@/components/dev/StubPage'

export default function AdminVocabularyPage() {
  return (
    <StubPage
      title="단어장 마스터"
      description="표준 단어 DB · CEFR 레벨 · 예문 · 발음 보정"
      upcoming={[
        '표준 단어 사전 — lemma 기준 통합 관리',
        'CEFR 레벨 수동 보정 — A1~C2 재할당',
        '예문 추가/수정 — 영어 + 한국어 번역',
        '발음 (IPA) 일괄 검증',
        'TTS 캐시 관리 — Supabase Storage 정리',
      ]}
    />
  )
}
