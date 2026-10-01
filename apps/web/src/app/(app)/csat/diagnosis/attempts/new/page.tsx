// apps/web/src/app/(app)/csat/diagnosis/attempts/new/page.tsx
//
// 옛 주소 — 시험 기록은 이제 내 진단 화면의 「새 시험 기록」 모달이다.

import { redirect } from 'next/navigation'

export default function DiagnosisAttemptPage() {
  redirect('/csat/diagnosis?tab=records&modal=new')
}
