// apps/web/src/lib/csat/trap-atlas-examples.ts
//
// **오답 지도 예시의 정답 민감 부분 — 서버 전용.** 문항 id · 오답 선지 번호 · 끌리는 이유 · 버리는 법.
// `scripts/csat/build-trap-atlas.mjs` 가 `trap-atlas-examples.json` 으로 구워 둔다(클라이언트 번들 `trap-atlas.json` 에는 없다).
// 내보낼 때마다 Reveal Gate 보류 범위(embargo-gate)로 거른다 — 보류 시험(오답 원인 Pilot 수집 중) 문항의 예시는 빠진다(판정 실패면 전부).

import 'server-only'

import { isItemHeld, loadRevealScope } from './embargo-gate'
import raw from './trap-atlas-examples.json'

export interface TrapExampleDetail {
  item_id: string
  slug: string
  exam_label: string
  no: number
  type_id: string
  choice: number
  tempting: string
  reject: string
}

const DETAIL = (raw as { traps: Record<string, TrapExampleDetail[]> }).traps

/** 함정 key → 예시(보류 문항 제외). 서버 컴포넌트가 읽어 화면에 넘긴다 */
export async function loadTrapExamples(): Promise<Record<string, TrapExampleDetail[]>> {
  const scope = await loadRevealScope()
  return Object.fromEntries(Object.entries(DETAIL).map(([key, list]) => [key, list.filter((e) => !isItemHeld(scope, e.item_id))]))
}
