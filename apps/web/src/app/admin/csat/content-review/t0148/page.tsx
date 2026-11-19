// apps/web/src/app/admin/csat/content-review/t0148/page.tsx
//
// **T-0148 사람 블라인드 채점 보조 도구(F5).** 정리 cue 대본 26건을 기준 A(현재 main)·B(v3 후보)로 채점한다.
//
// ⚠️ 판정 격리: 정답 키(과잉/정상)와 AI 채점은 이 화면·번들 어디에도 없다. 집계는
//   `scripts/csat/content-review/t0148-aggregate.mjs` 가 연구 경로의 키를 **채점이 끝난 뒤에만** 읽는다.
//   2단계 반례 자료도 props 로 싣지 않는다 — 1단계 잠금 뒤 `/api/admin/csat/content-review/t0148-counterexamples` 로 받는다.
// ⚠️ 채점 결과는 브라우저 초안 + CSV 내려받기뿐이다. DB 에 쓰지 않고, 반려된 생성 지침을 승격하지 않는다.

import { requireAdmin } from '@/lib/auth/require-admin'
import blind from '@/lib/csat/content-review/t0148/blind.json'

import { T0148ScoringClient, type BlindData } from './T0148ScoringClient'

export const dynamic = 'force-dynamic'

export default async function AdminCsatT0148Page() {
  await requireAdmin('/admin/csat/content-review/t0148')
  return <T0148ScoringClient blind={blind as unknown as BlindData} />
}
