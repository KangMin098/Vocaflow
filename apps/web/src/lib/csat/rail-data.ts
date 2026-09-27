// apps/web/src/lib/csat/rail-data.ts
//
// 기출분석공간 화면들(홈 · 서가 · 내 기록)이 같이 쓰는 서버 쪽 재료 — **서버 전용**.
//   · 회차 목록: 구운 골격 JSON(DB 를 치지 않는다)
//   · 문항 id → 유형 id: 서가 카탈로그(프로세스 캐시). 넓이 · 「본 문항」 계산에만 쓴다.
import 'server-only'

import { loadBrowseCatalog } from './browse'
import { browseExamOrder, examAxis } from './browse-model'
import { skeletonExamMeta } from './skeleton'

export interface RailExam {
  exam_id: string
  label: string
  items: number
}

export function railExams(): RailExam[] {
  return skeletonExamMeta()
    .map((exam) => ({ ...exam, id: exam.exam_id, ...examAxis(exam.exam_id) }))
    .sort(browseExamOrder)
    .map(({ exam_id, label, items }) => ({ exam_id, label, items }))
}

/** 못 읽으면 빈 표 — 화면은 넓이를 0 으로 보이고 나머지는 그대로 선다. */
export async function itemTypeMap(): Promise<Record<string, string>> {
  const catalog = await loadBrowseCatalog()
  return Object.fromEntries(catalog.items.map((i) => [i.id, i.type_id]))
}
