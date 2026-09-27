// apps/web/src/lib/csat/factory-pick.ts
//
// 「글감 고르기」 걸음의 숫자 — 실어도 되는지 판정 스냅샷에서 읽는다.
// 소재 적격 화면(`/admin/csat/sources`)과 **같은 파일**을 읽는다: 두 화면이 다른 스냅샷을 보면
// 같은 걸음을 다른 수로 말한다.

import 'server-only'

import eligibilitySnapshot from '@/lib/textbook/source-eligibility-snapshot.json'

import type { PickSnapshot } from './factory-plain'

export function loadPickSnapshot(): PickSnapshot | null {
  const t = eligibilitySnapshot?.total
  if (!t || typeof t.total !== 'number') return null
  return {
    measuredAt: eligibilitySnapshot.measuredAt,
    total: t.total,
    // 「조판 가능」 — 책으로 묶을 때 실제로 싣는 글감이다(판정 등급 usable·excerpt 의 합).
    usable: t.composable,
    unjudged: t.byGrade.unjudged,
    blocked: t.byGrade.blocked,
  }
}
