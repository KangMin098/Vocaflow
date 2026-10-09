// apps/web/src/app/(app)/csat/practice/page.tsx
//
// `/csat/practice` 색인 — 연습 과제는 지금 「주장과 근거」 하나다. 404 대신 그 과제로 보낸다(2026-10-10 1440 통합).
// 과제가 늘면 여기서 목록을 그린다.
import { redirect } from 'next/navigation'

import { PRACTICE_SLUG } from '@/lib/knowledge/practice'

export default function PracticeIndexPage() {
  redirect(`/csat/practice/${PRACTICE_SLUG}`)
}
