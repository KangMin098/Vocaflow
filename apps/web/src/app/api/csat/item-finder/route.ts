// apps/web/src/app/api/csat/item-finder/route.ts
//
// GET /api/csat/item-finder              → 기출 찾기 팝업의 목록(회차 · 번호 · 유형 · 배점 · 강의/지도 유무) — 보류 문항 제외
// GET /api/csat/item-finder?verify=2026#34 → 「탐구 열기」 직전 재검증: open · held · missing · error
//
// 로그인 필요(401 `auth`). 응답은 private · no-store(오류 포함). 목록 원본 실패 503 `list` · 보류 판정 실패 503 `gate`.
// 정답 · 발문 · 지문 · 선지 · 분석 · 강의 대본 · 개인 기록은 싣지 않는다. 본체는 `lib/csat/item-finder-server.ts`.

import { handleFinderGet } from '@/lib/csat/item-finder-server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

export async function GET(req: Request) {
  return handleFinderGet(req)
}
