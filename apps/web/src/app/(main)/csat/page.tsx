// apps/web/src/app/(main)/csat/page.tsx
//
// **기출 홈 — 오늘의 세션 한 장.** (docs/csat-learner-brief.md)
//
// 2026-09-17 까지 이 자리는 오답 분포 지도 + 모드 넷 + 유형 카드 26장이었다. 분석가의 사고 구조를
// 학습자에게 그대로 펼친 화면이라, 학습자가 「무엇을 하러 왔는지」를 먼저 골라야 했다.
// 이제는 시스템이 고른다 — 카드 한 장, [시작] 하나. 옛 화면은 `/admin/kice` 로 옮겼다.
//
// 서버는 **글자 없는 카탈로그**만 넘긴다(문항 id · 유형 · 배점 · 회차 이름). 세션은 기기의 기록으로
// 브라우저가 짠다(기록이 기기에 있다 — DECISIONS.md D7).

import type { Metadata } from 'next'

import { SessionHome } from '@/components/csat/session/SessionHome'
import { loadSessionCatalog } from '@/lib/csat/session/catalog'

export const metadata: Metadata = {
  title: '기출 — 오늘의 세션',
  description: '평가원 기출 세 문항, 10분. 먼저 풀고, 근거 문장에서 이해하고, 한 줄 남깁니다.',
}

export const dynamic = 'force-dynamic'

export default async function CsatHomePage() {
  const { catalog } = await loadSessionCatalog()
  return <SessionHome catalog={catalog} />
}
