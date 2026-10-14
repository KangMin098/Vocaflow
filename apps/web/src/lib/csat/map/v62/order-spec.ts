// apps/web/src/lib/csat/map/v62/order-spec.ts
//
// v6.2 P-F3(dry-run) — 공급이 부족한 수요 줄을 **기존 교재공장 공정**의 생산 명세로 바꾼다(순수 · 실행 · 적재 · DB 쓰기 없음).
// 기존 공장은 영속 주문이 없고(P-F0) 「권(series × step)」 단위로 생산한다. 그래서 이 명세는
//   ① 어떤 공장 문항 유형(SeriesItemType)이 그 평가원 유형에 대응하는가(CSAT_BACKING 을 뒤집음 — 짐작하지 않는다)
//   ② 어떤 기존 명령(드레인)이 그 유형을 만드는가
//   ③ 학습 지도 공급까지 무엇이 빠져 있는가(단위 불일치 · 문항 단위 권리 · TASK 적합 검수 · Gold · 실행 화면)
// 를 정확히 적는다. 「생산 가능」과 「학습자에게 공급 가능」을 섞지 않는다.

import { CSAT_BACKING } from '../../order-model'

import type { DemandLine, MaterialRole } from './demand'

export interface OrderSpec {
  role: MaterialRole
  task: string
  csatTypes: string[]
  /** 그 평가원 유형을 만드는 공장 문항 유형 — 없으면 빈 배열 */
  factoryTypes: string[]
  /** 기존 공정 명령(사람 · Claude 가 차례로 실행) — 주문 대기열이 아니다 */
  commands: string[]
  /** 공장이 이 수요 단위를 그대로 만들 수 있는가 — 지금 공장은 권 단위만 */
  unitSupported: false
  /** 생산 뒤에도 학습 지도 공급까지 빠진 것 */
  gaps: ('unit_mismatch' | 'item_level_rights' | 'task_fit_review' | 'gold_rubric' | 'workspace_runner' | 'no_factory_type' | 'assessment_not_from_factory')[]
  /** 이 명세를 실제로 돌리려면 필요한 승인 */
  approvals: ('bulk_generation_cost' | 'db_schema_orders' | 'content_release')[]
}

/** 평가원 유형 → 공장 문항 유형(CSAT_BACKING 을 그대로 뒤집는다) */
export function factoryTypesFor(csatTypes: readonly string[]): string[] {
  return Object.entries(CSAT_BACKING).filter(([, backs]) => backs.some((b) => csatTypes.includes(b))).map(([t]) => t)
}

export function orderSpecFor(line: DemandLine): OrderSpec {
  const factoryTypes = factoryTypesFor(line.csatTypes)
  const gaps: OrderSpec['gaps'] = ['unit_mismatch', 'item_level_rights', 'task_fit_review', 'workspace_runner']
  if (factoryTypes.length === 0) gaps.push('no_factory_type')
  // 독립 확인 · 전이 · 지연 재확인은 Gold · 루브릭 · 학생별 노출 원장이 있는 확인 과제로만 — 공장 문항으로 대신하지 않는다
  if (line.requires.gold) gaps.push('gold_rubric', 'assessment_not_from_factory')
  return {
    role: line.role,
    task: line.task,
    csatTypes: [...line.csatTypes],
    factoryTypes,
    commands: factoryTypes.length
      ? [
          'node scripts/textbook/write-drain-export.mjs   # 그 유형 문항 초안 청크',
          'node scripts/textbook/write-drain-import.mjs --commit   # csat_dcp_items 적재(승인 · 비용 확인 뒤)',
          'node scripts/textbook/explain-drain-export.mjs → -import.mjs --commit   # 해설',
          'node scripts/textbook/item-review-drain-export.mjs → -import.mjs --commit   # 페르소나 검수',
        ]
      : [],
    unitSupported: false,
    gaps,
    approvals: ['bulk_generation_cost', 'db_schema_orders', 'content_release'],
  }
}
