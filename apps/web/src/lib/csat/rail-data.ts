// apps/web/src/lib/csat/rail-data.ts
//
// 기출분석공간 화면들(홈 · 내 기록)이 같이 쓰는 서버 쪽 재료 — **서버 전용**.
//   · 문항 id → 유형 id: 서가 카탈로그(프로세스 캐시). 넓이 · 「본 문항」 계산에만 쓴다.
// (회차 목록 `railExams` 는 2026-10-11 메뉴에서 회차별을 빼며 지웠다 — 학평 골격 준비는 각 화면이 직접 한다.)
import 'server-only'

import { loadBrowseCatalog } from './browse'

/** 못 읽으면 빈 표 — 화면은 넓이를 0 으로 보이고 나머지는 그대로 선다. */
export async function itemTypeMap(): Promise<Record<string, string>> {
  const catalog = await loadBrowseCatalog()
  return Object.fromEntries(catalog.items.map((i) => [i.id, i.type_id]))
}
