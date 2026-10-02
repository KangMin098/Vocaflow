// apps/web/src/lib/csat/map/memberships.ts
//
// 학습 지도 — 기준 시험의 각 문항이 어느 라인에 연결되는가. 순수 함수(DB 접근 없음).
//   A: 문항에 태그된 역량(weight>0)  — 라인 코드 = 역량 코드
//      듣기(문항 메타가 없는 번호)는 엔진 설정 listening.attribute 로(weight>0 일 때만, 1~to_no 번)
//   B: 문항 유형 → 라인(독해, 승인된 유형표) · 승인된 회차별 번호표(듣기)
//   C: 문항에 그 계열 함정 선지가 있으면 그 계열 라인(라인 코드 = 계열 코드)
//   D · I · J: 문항과 연결되지 않는다(과제 완료율)

import type { ItemKey, RefItem } from './target'
import { itemKey } from './target'

export interface MembershipInput {
  /** 지도의 라인 노드 코드 전부 */
  lineCodes: ReadonlySet<string>
  /** 기준 시험별 45문항 */
  exams: { id: string; items: RefItem[] }[]
  /** csat_items 에 있는 문항(18~45번) — 키는 `<시험>#<번호>` */
  metaByKey: Record<string, { itemId: string; typeId: string | null }>
  /** 문항 id → 역량 코드(weight>0) */
  attributesByItem: Record<string, string[]>
  /** 문항 id → 함정 계열 코드 */
  trapFamiliesByItem: Record<string, string[]>
  /** 독해 유형 id → B 라인(승인된 표) */
  byType: Record<string, string>
  /** `<시험>#<번호>` → B 라인(회차별로 승인된 듣기 번호표) */
  byNo: Record<string, string>
  /** 엔진 설정(활성 진단 설정)의 듣기 규칙 */
  listening: { attribute: string; weight: number; toNo: number }
}

export function lineItemKeys(input: MembershipInput): Record<string, ItemKey[]> {
  const out: Record<string, Set<ItemKey>> = {}
  const put = (line: string | undefined, key: ItemKey) => {
    if (line && input.lineCodes.has(line)) (out[line] ??= new Set()).add(key)
  }
  for (const exam of input.exams) {
    for (const item of exam.items) {
      const key = itemKey(item)
      const meta = input.metaByKey[key]
      if (meta) {
        for (const code of input.attributesByItem[meta.itemId] ?? []) put(code, key)
        if (meta.typeId) put(input.byType[meta.typeId], key)
        for (const family of input.trapFamiliesByItem[meta.itemId] ?? []) put(family, key)
      } else {
        // 문항 메타가 없는 번호 = 듣기. 엔진이 듣기 응답을 합산하는 역량과 목표 분모가 같도록 같은 규칙을 쓴다
        if (item.no <= input.listening.toNo && input.listening.weight > 0) put(input.listening.attribute, key)
        put(input.byNo[key], key)
      }
    }
  }
  return Object.fromEntries(Object.entries(out).map(([line, keys]) => [line, [...keys]]))
}
