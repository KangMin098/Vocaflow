// apps/web/src/app/(main)/csat/progress/page.tsx
// @form: 시험지 사물 — 유형별 정오 기록을 막대와 맞힌 수/푼 수로 펼친다
//
// **기록 — 숫자 셋과 막대 한 열.** 스트릭 · 이번 주 문항 · 복습 대기 + 유형별 정확도.
// 기록은 기기에 있어(DECISIONS.md D7) 화면이 브라우저에서 읽는다. 서버는 유형 이름만 넘긴다.

import type { Metadata } from 'next'

import { ProgressView } from '@/components/csat/session/ProgressView'
import { ATLAS_TYPES } from '@/lib/csat/trap-atlas'

export const metadata: Metadata = {
  title: '기출 — 기록',
}

export default function CsatProgressPage() {
  const types = ATLAS_TYPES.map((t) => ({ id: t.id, name: t.name, time_budget_sec: null }))
  return <ProgressView types={types} />
}
