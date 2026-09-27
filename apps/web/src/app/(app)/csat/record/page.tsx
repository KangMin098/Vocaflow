// apps/web/src/app/(app)/csat/record/page.tsx
//
// **내 기록** — 기출분석공간의 하위 화면(ia-design §2-6). 진척을 넓이로 보인다.
// 기록 자체는 브라우저가 읽는다(기기 + `/api/csat/state`). 서버는 회차 목록과 문항 → 유형 표만 넘긴다.
import type { Metadata } from 'next'

import { RecordScreen } from '@/components/csat/home/RecordScreen'
import { itemTypeMap, railExams } from '@/lib/csat/rail-data'

export const metadata: Metadata = { title: '내 기록 — 기출분석공간' }
export const dynamic = 'force-dynamic'

export default async function CsatRecordPage() {
  return <RecordScreen exams={railExams()} itemTypes={await itemTypeMap()} />
}
