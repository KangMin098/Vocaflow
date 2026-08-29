// apps/web/src/lib/wordvault/state-filter.ts
//
// `?filter=state:*` — 기억 상태로 단어를 거르는 **단일 출처**.
//
// ── 왜 생겼나 (실측 2026-08-29) ──────────────────────────────────────
// `VaultIdentity` 의 CTA 는 2026-08-16 부터 `/wordvault/browse?filter=state:new` 로
// 보내고 있었다. 그런데 **그 문자열을 읽는 코드가 저장소에 하나도 없었다** —
// `WordVaultBrowseClient` 는 `set:` 과 `text:` 만 분기하고 나머지는 조용히 통과시킨다.
// 결과: 버튼이 "새 단어 익히기 11" 이라고 약속하고 **252개 전체 목록**을 열었다.
// 활성 칩도 없어서(칩 id 에 `state:new` 가 없다) 학습자는 무엇을 보고 있는지도 알 수 없었다.
//
// 조용히 무시되는 필터는 없는 필터보다 나쁘다 — 화면이 거짓말을 하고, 그 거짓말이
// 링크를 만든 쪽에서는 보이지 않는다. 그래서 **읽는 자를 여기 하나로 만든다.**
//
// ── `attention` 이 4상태에 없는 이유 ─────────────────────────────────
// 상단 리본의 "다시 볼" 칸은 `risk + shaky` 합계다(`memory-labels.MEMORY_ATTENTION_LABEL`).
// 그 칸을 눌렀을 때 갈 곳이 필요한데 4상태 중 어느 하나도 그 집합이 아니다.
// 이름을 `state:risk` 로 적으면 리본이 말한 수(135)와 도착지의 수(20)가 어긋난다 —
// `memory-labels.ts` 가 이미 한 번 겪고 규칙으로 적어 둔 어긋남이다.
// 그래서 합계에는 합계의 키를 준다.
//
// ⚠️ 상태는 R(t) 동적 계산이다. `memory_state` 컬럼은 금지 — 판정은 언제나
//    `getMemoryState` 하나를 거친다(표가 둘이면 반드시 어긋난다).

import { MEMORY_ATTENTION_LABEL, MEMORY_LABEL } from '@/lib/framework/memory-labels'
import { getMemoryState } from '@/lib/srs'
import type { MemoryState, SrsCard } from '@/lib/srs/types'

/** 4상태 + 합계 하나. URL 에 나타나는 키와 1:1. */
export type StateFilterKey = MemoryState | 'attention'

const KEYS: readonly StateFilterKey[] = ['stable', 'shaky', 'risk', 'new', 'attention']

/** URL 쿼리 접두사 — `?filter=state:new` */
export const STATE_FILTER_PREFIX = 'state:'

/**
 * `filter` 쿼리 문자열에서 상태 키를 뽑는다.
 *
 * 상태 필터가 아니거나(`set:…`·`text:…`·`all`) 모르는 키면 `null` —
 * 호출부는 그 경우 **거르지 않는다**(기존 동작 유지).
 */
export function parseStateFilter(filter: string | null | undefined): StateFilterKey | null {
  if (!filter || !filter.startsWith(STATE_FILTER_PREFIX)) return null
  const key = filter.slice(STATE_FILTER_PREFIX.length)
  return (KEYS as readonly string[]).includes(key) ? (key as StateFilterKey) : null
}

/** 상태 키를 URL 값으로 되돌린다. */
export function toStateFilterValue(key: StateFilterKey): string {
  return `${STATE_FILTER_PREFIX}${key}`
}

/** 이 카드가 상태 키에 걸리는가. `attention` 은 risk + shaky 합집합. */
export function matchesStateFilter(
  card: SrsCard,
  key: StateFilterKey,
  now: Date = new Date(),
): boolean {
  const state = getMemoryState(card, now)
  if (key === 'attention') return state === 'risk' || state === 'shaky'
  return state === key
}

/**
 * 학습자가 읽는 이름 — 화면에서 짓지 않는다.
 * 4상태는 `MEMORY_LABEL`, 합계는 `MEMORY_ATTENTION_LABEL` 이 소유한다.
 */
export function stateFilterLabel(key: StateFilterKey): string {
  return key === 'attention' ? MEMORY_ATTENTION_LABEL : MEMORY_LABEL[key].label
}

/** 사람의 말투 한 줄 — 배너 보조 문구. */
export function stateFilterSays(key: StateFilterKey): string {
  return key === 'attention' ? '지금 손이 필요해요' : MEMORY_LABEL[key].says
}

/**
 * 이 상태의 색 토큰. 합계는 구성 요소 중 더 흐린 쪽(`risk`)의 색을 쓴다 —
 * 합계를 누르는 이유가 그쪽이기 때문이다.
 *
 * ⚠️ 하드코딩 금지. 반환값은 언제나 `--memory-*` 토큰 이름이다.
 */
export function stateFilterToken(key: StateFilterKey): string {
  return key === 'attention' ? MEMORY_LABEL.risk.token : MEMORY_LABEL[key].token
}

/**
 * 목록 필터 — 카드가 달린 항목이면 무엇이든 거른다.
 *
 * `srs` 는 `WordItem` 에서 선택 필드다(목업·인계 단어에는 없다). **카드가 없는 단어는
 * `new` 로 본다** — SRS 이력이 없다는 것과 한 번도 만나지 않았다는 것은 같은 말이고,
 * 여기서 조용히 버리면 "새 단어 11" 을 누른 학습자가 11개보다 적게 받는다.
 */
export function filterByMemoryState<T extends { srs?: SrsCard | null }>(
  items: readonly T[],
  key: StateFilterKey,
  now: Date = new Date(),
): T[] {
  return items.filter((item) =>
    item.srs ? matchesStateFilter(item.srs, key, now) : key === 'new',
  )
}
